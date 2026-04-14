import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { JwtHelperService } from '@auth0/angular-jwt';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { ChamadoService } from '../../services/chamado.service';
import { AuthenticationService } from '../../services/authentication.service';
import { UsuarioService } from '../../services/usuario.service';
import { ClienteService } from '../../services/cliente.service';
import { TecnicoService } from '../../services/tecnico.service';
import { TelefoneService } from '../../services/telefone.service';
import { Chamado } from '../../models/chamado';
import { Cliente } from '../../models/cliente';
import { Tecnico } from '../../models/tecnico';
import { Telefone } from '../../models/telefone';

import { MatDialog } from '@angular/material/dialog';
import { GenericDialogComponent } from '../molecules/generic-dialog/generic-dialog.component';
import { CriticalAlertDialogComponent } from '../molecules/critical-alert-dialog/critical-alert-dialog.component';
import { RankingDialogComponent } from '../molecules/ranking-dialog/ranking-dialog.component';

interface Atividade {
  icon: string;
  iconColor: string;
  acaoLabel: string;
  detalhe: string;     // nome do cliente, técnico, dono do telefone, etc.
  tempo: string;
  dataRef: Date | null;
  sortKey: number;     // timestamps (datados) >> IDs (sem data) → ordenação automática
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  /**
   * Remove accents, trim, and lowercase a string for robust comparison.
   */
  private normalize(str: string): string {
    return str
      ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
      : '';
  }

  nomeUsuario = 'Usuário';
  chamados:   Chamado[]  = [];
  clientes:   Cliente[]  = [];
  tecnicos:   Tecnico[]  = [];
  telefones:  Telefone[] = [];
  isLoading    = true;
  isRefreshing = false;   // polling silencioso (sem spinner principal)
  ultimaAtualizacao: Date | null = null;
  periodo = 30;
  atividadesRecentes: Atividade[] = [];

  private timerInterval:  any;
  private reloadInterval: any;

  // ── Bar chart ────────────────────────────────────────────
  barChartType: ChartType = 'bar';

  barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      { data: [], label: 'Abertos',      backgroundColor: '#1976d2' },
      { data: [], label: 'Em Andamento', backgroundColor: '#f57c00' },
      { data: [], label: 'Críticos',     backgroundColor: '#e53935' },
    ]
  };

  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#90a4ae', font: { size: 11 } }
      },
      y: {
        min: 0,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { color: '#90a4ae', font: { size: 11 }, stepSize: 2 }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { boxWidth: 12, padding: 20, color: '#546e7a', usePointStyle: true }
      },
      tooltip: { mode: 'index', intersect: false }
    }
  };

  private jwtHelper = new JwtHelperService();
  private refreshSub: Subscription;
  private alertDialogRef: any;


  constructor(
    private chamadoService:  ChamadoService,
    private authService:     AuthenticationService,
    private usuarioService:  UsuarioService,
    private clienteService:  ClienteService,
    private tecnicoService:  TecnicoService,
    private telefoneService: TelefoneService,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadUserInfo();
    // Escuta refresh$ de todos os serviços para recarregar o feed imediatamente
    this.refreshSub = new Subscription();
    this.refreshSub.add(this.chamadoService.refresh$.subscribe(() => this.loadDados(false)));
    this.refreshSub.add(this.clienteService.refresh$.subscribe(() => this.loadDados(false)));
    this.refreshSub.add(this.tecnicoService.refresh$.subscribe(() => this.loadDados(false)));
    this.refreshSub.add(this.telefoneService.refresh$.subscribe(() => this.loadDados(false)));
    // ── Polling em tempo real ──────────────────────────────────
    this.reloadInterval = setInterval(() => this.loadDados(false), 30000);
    this.timerInterval  = setInterval(() => this.atualizarTempos(), 60000);
  }

  openRanking(): void {
    this.dialog.open(RankingDialogComponent, {
      width: '780px',
      maxWidth: '96vw',
      maxHeight: '90vh',
      data: {
        chamados: this.chamados,
        tecnicos: this.tecnicos
      },
      panelClass: 'ranking-dialog-panel'
    });
  }

  ngOnDestroy(): void {
    if (this.refreshSub)     { this.refreshSub.unsubscribe(); }
    if (this.timerInterval)  { clearInterval(this.timerInterval); }
    if (this.reloadInterval) { clearInterval(this.reloadInterval); }
  }

  // ── User info ─────────────────────────────────────────────
  private loadUserInfo(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.loadDados(true);
      return;
    }

    try {
      const decoded = this.jwtHelper.decodeToken(token);
      const email: string = decoded?.sub || decoded?.email || '';
      if (!email) {
        this.loadDados(true);
        return;
      }

      // /user/all retorna IUsuario[] com o campo 'nome' cadastrado
      this.usuarioService.findAll().subscribe(
        users => {
          const match = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
          this.nomeUsuario = match?.nome
            ? match.nome.trim()          // nome completo: "William Martins Gonçalves"
            : this.emailFallback(email);
          this.loadDados(true);
        },
        () => {
          this.nomeUsuario = this.emailFallback(email);
          this.loadDados(true);
        }
      );
    } catch {
      this.nomeUsuario = 'Usuário';
      this.loadDados(true);
    }
  }

  private emailFallback(email: string): string {
    const base = email.includes('@') ? email.split('@')[0] : email;
    return base ? base.charAt(0).toUpperCase() + base.slice(1).toLowerCase() : 'Usuário';
  }

  // ── Data ──────────────────────────────────────────────────
  /**
   * showSpinner=true  → carregamento inicial (mostra spinner)
   * showSpinner=false → polling silencioso (não mostra spinner, só atualiza dados)
   */
  public loadDados(showSpinner: boolean): void {
    if (showSpinner) { this.isLoading = true; }
    else             { this.isRefreshing = true; }

    forkJoin({
      chamados:  this.chamadoService.findAll().pipe(catchError(() => of([]))),
      clientes:  this.clienteService.findAll().pipe(catchError(() => of([]))),
      tecnicos:  this.tecnicoService.findAll().pipe(catchError(() => of([]))),
      telefones: this.telefoneService.findAll().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ chamados, clientes, tecnicos, telefones }) => {
        this.chamados  = chamados;
        this.clientes  = clientes;
        this.tecnicos  = tecnicos;
        this.telefones = telefones;
        this.isLoading    = false;
        this.isRefreshing = false;
        this.ultimaAtualizacao = new Date();
        this.buildChart();
        this.buildAtividades();

        // ── ALERTA MODAL DE CHAMADOS CRÍTICOS ──
        this.exibirAlertaChamadosCriticos();
      },
      error: () => { this.isLoading = false; this.isRefreshing = false; }
    });
  }

  /**
   * Retorna a quantidade de chamados críticos atribuídos ao técnico logado.
   * Considera apenas chamados com prioridade 3 (crítica), não encerrados, e técnico igual ao usuário logado.
   */
  get totalCriticosDoTecnico(): number {
    return this.chamados.filter(c =>
      c.prioridade == '3' &&
      c.status != '2' &&
      c.nomeTecnico &&
      this.normalize(c.nomeTecnico) === this.normalize(this.nomeUsuario)
    ).length;
  }

  /**
   * Exibe o alerta modal de chamados críticos atribuídos ao técnico logado, apenas uma vez por sessão.
   */
  private exibirAlertaChamadosCriticos(): void {
    const normalizedNomeUsuario = this.normalize(this.nomeUsuario);

    // Filtra chamados críticos, não encerrados, atribuídos ao técnico logado
    const criticosDoTecnico = this.chamados.filter(c =>
      c.prioridade == '3' &&
      c.status != '2' &&
      this.normalize(c.nomeTecnico || '') === normalizedNomeUsuario
    );

    // Só exibe se houver chamados críticos atribuídos ao técnico logado
    if (criticosDoTecnico.length === 0) { return; }

    // Só exibe uma vez por sessão (reseta ao fazer login novamente)
    if (sessionStorage.getItem('alertaChamadosCriticosExibido')) { return; }

    sessionStorage.setItem('alertaChamadosCriticosExibido', '1');

    // Encontra o timestamp da data de abertura do chamado crítico mais antigo
    let oldestTimestamp = 0;
    for (const c of criticosDoTecnico) {
      if (c.dataAbertura) {
        const parsed = this.parseDate(c.dataAbertura);
        if (parsed) {
          const ts = parsed.getTime();
          // Queremos o mais antigo → menor timestamp
          if (oldestTimestamp === 0 || ts < oldestTimestamp) {
            oldestTimestamp = ts;
          }
        }
      }
    }

    this.alertDialogRef = this.dialog.open(CriticalAlertDialogComponent, {
      width: '500px',
      maxWidth: '94vw',
      data: {
        count: criticosDoTecnico.length,
        userName: this.nomeUsuario,
        oldestOpenedAt: oldestTimestamp
      },
      panelClass: 'critical-alert-dialog-panel',
      disableClose: true
    });

    // Ao fechar o dialog, verifica se o usuário clicou em "Ver chamados críticos"
    this.alertDialogRef.afterClosed().subscribe((result: any) => {
      this.alertDialogRef = null;
      if (result?.action === 'view') {
        this.router.navigate(['/chamados'], {
          queryParams: { prioridade: '3', search: this.nomeUsuario }
        });
      }
    });

    // Fecha automaticamente após 8 segundos (mais tempo para leitura)
    setTimeout(() => {
      if (this.alertDialogRef) {
        this.alertDialogRef.close();
        this.alertDialogRef = null;
      }
    }, 8000);
  }

  // ── Period selector ───────────────────────────────────────
  setPeriodo(dias: number): void {
    this.periodo = dias;
    this.buildChart();
  }

  private buildChart(): void {
    const now = new Date();
    const labels: string[]  = [];
    const abertos: number[] = [];
    const andamento: number[] = [];
    const criticos: number[]  = [];

    if (this.periodo <= 7) {
      // Daily – last 7 days
      for (let i = 6; i >= 0; i--) {
        const day = new Date(now);
        day.setDate(now.getDate() - i);
        const key = this.toYMD(day);
        labels.push(day.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }));
        const slice = this.chamados.filter(c => this.toYMD(this.parseDate(c.dataAbertura)) === key);
        abertos.push(slice.filter(c => c.status == '0').length);
        andamento.push(slice.filter(c => c.status == '1').length);
        criticos.push(slice.filter(c => c.prioridade == '3' && c.status != '2').length);
      }
    } else {
      // Weekly – last 5 weeks
      for (let w = 4; w >= 0; w--) {
        const weekEnd = new Date(now); weekEnd.setDate(now.getDate() - w * 7);
        const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6);
        labels.push(weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }));
        const slice = this.chamados.filter(c => {
          const d = this.parseDate(c.dataAbertura);
          return d && d >= weekStart && d <= weekEnd;
        });
        abertos.push(slice.filter(c => c.status == '0').length);
        andamento.push(slice.filter(c => c.status == '1').length);
        criticos.push(slice.filter(c => c.prioridade == '3' && c.status != '2').length);
      }
    }

    this.barChartData = {
      labels,
      datasets: [
        { data: abertos,   label: 'Abertos',      backgroundColor: '#1976d2', borderRadius: 4 } as any,
        { data: andamento, label: 'Em Andamento',  backgroundColor: '#f57c00', borderRadius: 4 } as any,
        { data: criticos,  label: 'Críticos',      backgroundColor: '#e53935', borderRadius: 4 } as any,
      ]
    };
  }

  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    // Formato do backend: "dd/MM/yyyy - HH:mm"  (separador " - ")
    // Suporta também "dd/MM/yyyy" sem horário
    const parts = dateStr.split('/');
    if (parts.length >= 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const rest   = parts[2]; // ex: "2026 - 14:32"  ou  "2026"
      const sepIdx = rest.indexOf(' - ');
      const y    = sepIdx >= 0 ? rest.substring(0, sepIdx).trim() : rest.trim();
      const time = sepIdx >= 0 ? rest.substring(sepIdx + 3).trim() : null; // pula " - "
      // Monta ISO local: "yyyy-mm-ddTHH:mm:00"
      const isoStr = time ? `${y}-${m}-${d}T${time}:00` : `${y}-${m}-${d}T00:00:00`;
      const date = new Date(isoStr);
      return isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }

  private toYMD(d: Date | null): string {
    if (!d) return '';
    return d.toISOString().split('T')[0];
  }

  // ── KPI getters ───────────────────────────────────────────
  get totalAbertos(): number {
    return this.chamados.filter(c => c.status == '0').length;
  }

  get totalEmAndamento(): number {
    return this.chamados.filter(c => c.status == '1').length;
  }

  get totalEncerrados(): number {
    return this.chamados.filter(c => c.status == '2').length;
  }

  get totalCriticos(): number {
    return this.chamados.filter(c => c.prioridade == '3' && c.status != '2').length;
  }

  get resolucaoPercent(): number {
    if (!this.chamados.length) return 0;
    return Math.round(this.totalEncerrados / this.chamados.length * 100);
  }

  // ── Avisos Importantes ────────────────────────────────────
  get avisosImportantes(): { icon: string; color: string; texto: string }[] {
    const list: { icon: string; color: string; texto: string }[] = [];

    if (this.totalCriticos > 0) {
      list.push({
        icon: 'warning',
        color: '#e53935',
        texto: `${this.totalCriticos} chamado(s) crítico(s) aguardando atenção imediata`
      });
    }
    if (this.totalAbertos > 5) {
      list.push({
        icon: 'info',
        color: '#f57c00',
        texto: `${this.totalAbertos} chamados em aberto — carga elevada na fila`
      });
    }
    if (this.resolucaoPercent >= 80) {
      list.push({
        icon: 'check_circle',
        color: '#43a047',
        texto: `Taxa de resolução em ${this.resolucaoPercent}% — excelente desempenho`
      });
    }
    if (list.length === 0) {
      list.push({
        icon: 'check_circle_outline',
        color: '#43a047',
        texto: 'Nenhum aviso crítico no momento. Tudo sob controle!'
      });
    }
    return list;
  }

  // ── Activities ────────────────────────────────────────────
  private buildAtividades(): void {
    const lista: Atividade[] = [];

    // ── Chamados ───────────────────────────────────────────
    this.chamados
      .filter(c => !!c.dataAbertura)
      .forEach(c => {
        const dataRef = this.parseDate(c.dataAbertura);
        lista.push({
          icon:      this.getStatusIcon(c.status),
          iconColor: this.getStatusColor(c.status),
          acaoLabel: this.buildLabel(c),
          detalhe:   c.nomeCliente,
          tempo:     this.formatTempoRelativo(dataRef),
          dataRef,
          sortKey:   this.parseSortKey(c.dataAbertura)
        });
      });

    // ── Clientes ───────────────────────────────────────────
    this.clientes
      .filter(cl => !!(cl.dataHoraCriacao || cl.dataCriacao))
      .forEach(cl => {
        // Prefere dataHoraCriacao (datetime exato) → senão cai para dataCriacao (date-only)
        const dateStr = cl.dataHoraCriacao || cl.dataCriacao;
        const dataRef = this.parseDate(dateStr);
        lista.push({
          icon:      'person_add',
          iconColor: '#8e24aa',
          acaoLabel: `Novo cliente: ${cl.nome}`,
          detalhe:   cl.email,
          tempo:     this.formatTempoRelativo(dataRef),
          dataRef,
          sortKey:   this.parseSortKey(dateStr)
        });
      });

    // ── Técnicos ───────────────────────────────────────────
    this.tecnicos
      .filter(t => !!(t.dataHoraCriacao || t.dataCriacao))
      .forEach(t => {
        const dateStr = t.dataHoraCriacao || t.dataCriacao;
        const dataRef = this.parseDate(dateStr);
        lista.push({
          icon:      'engineering',
          iconColor: '#0097a7',
          acaoLabel: `Novo técnico: ${t.nome}`,
          detalhe:   t.email,
          tempo:     this.formatTempoRelativo(dataRef),
          dataRef,
          sortKey:   this.parseSortKey(dateStr)
        });
      });

    // ── Telefones ──────────────────────────────────────────
    // Agora têm dataCriacao real → entram no feed unificado com tempo relativo
    this.telefones
      .filter(tel => !!tel.dataCriacao)
      .forEach(tel => {
        const dataRef = this.parseDate(tel.dataCriacao);
        lista.push({
          icon:      'phone',
          iconColor: '#5c6bc0',
          acaoLabel: `Telefone cadastrado: ${tel.numero}`,
          detalhe:   tel.nomeTecnico,
          tempo:     this.formatTempoRelativo(dataRef),
          dataRef,
          sortKey:   this.parseSortKey(tel.dataCriacao)
        });
      });

    // ── Montar feed final ──────────────────────────────────
    // Todos os itens datados ordenados desc → top 9
    this.atividadesRecentes = lista
      .sort((a, b) => b.sortKey - a.sortKey)
      .slice(0, 9);
  }

  /**
   * Calcula o sortKey correto para cada tipo de data:
   * – Chamados têm hora real   → usam o timestamp exato
   * – Clientes/técnicos são date-only → usam 23:59:59 do dia para garantir
   *   que apareçam ACIMA dos chamados do mesmo dia (evita sumir no ranking)
   */
  private parseSortKey(dateStr: string): number {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length < 3) return 0;
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const rest    = parts[2];
    const sepIdx  = rest.indexOf(' - ');
    if (sepIdx >= 0) {
      // Chamado: tem hora real → timestamp exato
      const y    = rest.substring(0, sepIdx).trim();
      const time = rest.substring(sepIdx + 3).trim();
      return new Date(`${y}-${m}-${d}T${time}:00`).getTime() || 0;
    } else {
      // Date-only (clientes/técnicos): usa fim do dia para garantir visibilidade
      const y = rest.trim();
      return new Date(`${y}-${m}-${d}T23:59:59`).getTime() || 0;
    }
  }

  /** Recalcula apenas o campo `tempo` dos itens com data (telefones mantêm ''). */
  private atualizarTempos(): void {
    this.atividadesRecentes = this.atividadesRecentes.map(a => ({
      ...a,
      tempo: a.dataRef ? this.formatTempoRelativo(a.dataRef) : a.tempo
    }));
  }

  private buildLabel(c: Chamado): string {
    if (c.status == '0') return `Novo chamado: ${c.titulo}`;
    if (c.status == '1') return `Em andamento: ${c.titulo}`;
    return `Encerrado: ${c.titulo}`;
  }

  private getStatusColor(status: any): string {
    if (status == '0') return '#1976d2';
    if (status == '1') return '#f57c00';
    return '#43a047';
  }

  private getStatusIcon(status: any): string {
    if (status == '0') return 'add_circle_outline';
    if (status == '1') return 'autorenew';
    return 'check_circle_outline';
  }

  private formatTempoRelativo(date: Date | null): string {
    if (!date) return '';
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMin < 1)   return 'agora mesmo';
    if (diffMin === 1) return 'há 1 minuto';
    if (diffMin < 60)  return `há ${diffMin} minutos`;
    const h = Math.floor(diffMin / 60);
    if (h === 1)  return 'há 1 hora';
    if (h < 24)   return `há ${h} horas`;
    const d = Math.floor(h / 24);
    if (d === 1)  return 'há 1 dia';
    if (d < 30)   return `há ${d} dias`;
    const mo = Math.floor(d / 30);
    if (mo === 1) return 'há 1 mês';
    return `há ${mo} meses`;
  }
}
