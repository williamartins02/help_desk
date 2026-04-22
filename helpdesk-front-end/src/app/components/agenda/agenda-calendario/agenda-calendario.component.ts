import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { Subscription, forkJoin } from 'rxjs';
import { Tarefa } from '../../../models/tarefa';
import { TarefaService } from '../../../services/tarefa.service';
import { TecnicoService } from '../../../services/tecnico.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { ChamadoService } from '../../../services/chamado.service';
import { Tecnico } from '../../../models/tecnico';
import { TarefaFormDialogComponent, TarefaDialogData } from '../tarefa-form-dialog/tarefa-form-dialog.component';
import { JwtHelperService } from '@auth0/angular-jwt';

export interface MiniCalCell { dia: number; data: string; externo: boolean; }
export interface DiaSemana  { data: string; label: string; numDia: string; mes: string; }

@Component({
  selector: 'app-agenda-calendario',
  templateUrl: './agenda-calendario.component.html',
  styleUrls: ['./agenda-calendario.component.css']
})
export class AgendaCalendarioComponent implements OnInit, OnDestroy {

  // ── Visualização ──────────────────────────────────────────────────────────
  viewMode: 'dia' | 'semana' = 'semana';
  dataSelecionada = this.fmtData(new Date());
  carregando = false;

  // ── Perfil ────────────────────────────────────────────────────────────────
  tecnicoId!: number;
  nomeUsuario = '';
  isAdmin = false;

  // ── Dados ─────────────────────────────────────────────────────────────────
  tecnicos: Tecnico[] = [];
  tecnicoFiltroId: number | null = null;
  /** key = `${tecnicoId}_${data}` */
  tarefasMap = new Map<string, Tarefa[]>();
  todasTarefas: Tarefa[] = [];

  // ── Semana ────────────────────────────────────────────────────────────────
  diasSemana: DiaSemana[] = [];

  // ── Mini calendário ───────────────────────────────────────────────────────
  miniMes: number = new Date().getMonth();
  miniAno: number = new Date().getFullYear();

  readonly MINI_LABELS_DIA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  readonly MESES_NOMES = [
    'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
  ];

  // ── Tipos e cores ─────────────────────────────────────────────────────────
  readonly TIPO_COR: Record<string, string> = {
    atendimento: '#1565c0',
    reuniao:     '#e65100',
    manutencao:  '#2e7d32',
    interna:     '#6a1b9a',
    problema:    '#c62828',
    outros:      '#37474f',
  };
  readonly TIPO_BG: Record<string, string> = {
    atendimento: '#e3f2fd',
    reuniao:     '#fff3e0',
    manutencao:  '#e8f5e9',
    interna:     '#f3e5f5',
    problema:    '#ffebee',
    outros:      '#eceff1',
  };
  readonly TIPO_LABEL: Record<string, string> = {
    atendimento: 'Atendimento',
    reuniao:     'Reunião',
    manutencao:  'Manutenção',
    interna:     'Tarefa Interna',
    problema:    'Problema',
    outros:      'Outros',
  };
  readonly LEGENDA = Object.entries(this.TIPO_LABEL)
    .map(([k, v]) => ({ key: k, label: v, cor: this.TIPO_COR[k] }));

  /** Slots de hora para a visão diária (07:00 → 20:00) */
  readonly HORAS_DIA: string[] = Array.from({ length: 14 }, (_, i) =>
    `${String(7 + i).padStart(2, '0')}:00`
  );

  // ── Subscrições ───────────────────────────────────────────────────────────
  private jwtHelper = new JwtHelperService();
  private tecnicoSub!: Subscription;
  private chamadoRefreshSub!: Subscription;

  constructor(
    private tarefaService: TarefaService,
    private tecnicoService: TecnicoService,
    private authService: AuthenticationService,
    private chamadoService: ChamadoService,
    private dialog: MatDialog,
    private toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    this.lerPerfil();

    // Recarrega o calendário sempre que um chamado for criado ou atualizado
    // (inclui encerramento, reatribuição de técnico, etc.)
    this.chamadoRefreshSub = this.chamadoService.refresh$.subscribe(() => {
      this.carregarDados();
      this.toastr.info('Calendário atualizado — chamado alterado.', '', { timeOut: 2500 });
    });
  }

  ngOnDestroy(): void {
    if (this.tecnicoSub)       this.tecnicoSub.unsubscribe();
    if (this.chamadoRefreshSub) this.chamadoRefreshSub.unsubscribe();
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  get hojeStr(): string { return this.fmtData(new Date()); }

  get tecnicosFiltrados(): Tecnico[] {
    if (this.tecnicoFiltroId !== null)
      return this.tecnicos.filter(t => t.id === this.tecnicoFiltroId);
    return this.tecnicos;
  }

  get resumoHoje() {
    const hoje = this.hojeStr;
    const atrasadas = this.todasTarefas.filter(t =>
      t.status !== 2 && this.isAnterior(t.data, hoje));
    const hojeList  = this.todasTarefas.filter(t => t.data === hoje);
    const proximas  = this.todasTarefas.filter(t =>
      t.status !== 2 && this.isPosterior(t.data, hoje));
    const concluidas = hojeList.filter(t => t.status === 2);
    return {
      atrasadas:  atrasadas.length,
      hoje:       hojeList.length,
      proximas:   proximas.length,
      concluidas: concluidas.length,
    };
  }

  get alertas(): { msg: string; tipo: string; icone: string }[] {
    const list: { msg: string; tipo: string; icone: string }[] = [];
    const { atrasadas } = this.resumoHoje;
    if (atrasadas > 0)
      list.push({ msg: `${atrasadas} tarefa${atrasadas > 1 ? 's' : ''} atrasada${atrasadas > 1 ? 's' : ''}`, tipo: 'erro',  icone: 'warning' });

    const semHor = this.todasTarefas.filter(t => !t.horaInicio && t.status === 0).length;
    if (semHor > 0)
      list.push({ msg: `${semHor} tarefa${semHor > 1 ? 's' : ''} sem horário definido`, tipo: 'info',  icone: 'schedule' });

    const criticas = this.todasTarefas.filter(t => t.prioridade === 3 && t.status !== 2).length;
    if (criticas > 0)
      list.push({ msg: `${criticas} tarefa${criticas > 1 ? 's' : ''} crítica${criticas > 1 ? 's' : ''} pendente${criticas > 1 ? 's' : ''}`, tipo: 'aviso', icone: 'priority_high' });

    if (list.length === 0)
      list.push({ msg: 'Nenhum alerta. Tudo sob controle! ✅', tipo: 'ok', icone: 'check_circle' });
    return list;
  }

  get tarefasSemHorario(): Tarefa[] {
    const hoje = this.hojeStr;
    return this.todasTarefas.filter(t => !t.horaInicio && t.data === hoje);
  }

  // ── Mini calendário ───────────────────────────────────────────────────────

  get miniCalTitulo(): string {
    return `${this.MESES_NOMES[this.miniMes]} ${this.miniAno}`;
  }

  miniCalNavegar(delta: number): void {
    this.miniMes += delta;
    if (this.miniMes > 11) { this.miniMes = 0; this.miniAno++; }
    if (this.miniMes < 0)  { this.miniMes = 11; this.miniAno--; }
  }

  get miniCalGrid(): MiniCalCell[][] {
    const firstDay = new Date(this.miniAno, this.miniMes, 1);
    const lastDay  = new Date(this.miniAno, this.miniMes + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0

    const cells: MiniCalCell[] = [];

    for (let i = 0; i < startDow; i++) {
      const d = new Date(firstDay);
      d.setDate(firstDay.getDate() - startDow + i);
      cells.push({ dia: d.getDate(), data: this.fmtData(d), externo: true });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      cells.push({ dia: d, data: this.fmtData(new Date(this.miniAno, this.miniMes, d)), externo: false });
    }
    while (cells.length % 7 !== 0) {
      const extra = cells.length - startDow - lastDay.getDate() + 1;
      cells.push({ dia: extra, data: this.fmtData(new Date(this.miniAno, this.miniMes + 1, extra)), externo: true });
    }

    const weeks: MiniCalCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }

  datasComTarefas = (): Set<string> => new Set(this.todasTarefas.map(t => t.data));

  selecionarDataMiniCal(data: string): void {
    this.dataSelecionada = data;
    const [, m, y] = data.split('/').map(Number);
    this.miniMes = m - 1;
    this.miniAno = y;
    this.carregarDados();
  }

  // ── Tipo / cor de tarefa ──────────────────────────────────────────────────

  getTipo(t: Tarefa): string {
    const titulo = (t.titulo || '').toLowerCase();
    if (t.prioridade === 3) return 'problema';
    if (t.chamado)          return 'atendimento';
    if (titulo.includes('reuni') || titulo.includes('meeting'))        return 'reuniao';
    if (titulo.includes('manut') || titulo.includes('deploy')  ||
        titulo.includes('backup') || titulo.includes('atualiz') ||
        titulo.includes('install') || titulo.includes('servidor'))     return 'manutencao';
    return 'interna';
  }

  getCorTarefa(t: Tarefa): string  { return this.TIPO_COR[this.getTipo(t)]  || '#37474f'; }
  getBgTarefa(t: Tarefa):  string  { return this.TIPO_BG[this.getTipo(t)]   || '#eceff1'; }
  getLabelTipo(t: Tarefa): string  { return this.TIPO_LABEL[this.getTipo(t)] || 'Outros'; }

  // ── Dados por célula ──────────────────────────────────────────────────────

  getTarefasDia(tecnicoId: number, data: string): Tarefa[] {
    return this.tarefasMap.get(`${tecnicoId}_${data}`) || [];
  }

  getTarefasHora(data: string, hora: string): Tarefa[] {
    const h = hora.split(':')[0];
    return this.todasTarefas.filter(t =>
      t.data === data && t.horaInicio?.startsWith(h)
    );
  }

  getTarefasDiaHora(tecnicoId: number, data: string, hora: string): Tarefa[] {
    const h = hora.split(':')[0];
    return this.getTarefasDia(tecnicoId, data)
      .filter(t => t.horaInicio?.startsWith(h));
  }

  totalDia(data: string): number {
    return this.tecnicos.reduce((sum, tec) =>
      sum + this.getTarefasDia(tec.id, data).length, 0);
  }

  // ── Ações ─────────────────────────────────────────────────────────────────

  novaTarefa(dataPadrao?: string, tecnicoIdParam?: number): void {
    const idCriacao = tecnicoIdParam
      || (this.isAdmin && this.tecnicoFiltroId ? this.tecnicoFiltroId : this.tecnicoId);

    const dPad = dataPadrao || this.dataSelecionada;
    const ref = this.dialog.open(TarefaFormDialogComponent, {
      data: {
        tecnicoId:    idCriacao,
        dataPadrao:   dPad,
        tarefasDoDia: this.todasTarefas.filter(t => t.data === dPad),
        isAdmin:      this.isAdmin,
      } as TarefaDialogData,
      width: '620px', maxWidth: '98vw', maxHeight: '92vh',
      panelClass: 'dialog-no-padding', disableClose: true, autoFocus: false
    });
    ref.afterClosed().subscribe(r => { if (r) this.carregarDados(); });
  }

  editarTarefa(tarefa: Tarefa): void {
    const ref = this.dialog.open(TarefaFormDialogComponent, {
      data: {
        tarefa,
        tecnicoId:    tarefa.tecnico,
        tarefasDoDia: this.todasTarefas.filter(t => t.data === tarefa.data),
        isAdmin:      this.isAdmin,
      } as TarefaDialogData,
      width: '620px', maxWidth: '98vw', maxHeight: '92vh',
      panelClass: 'dialog-no-padding', disableClose: true, autoFocus: false
    });
    ref.afterClosed().subscribe(r => { if (r) this.carregarDados(); });
  }

  // ── Navegação de período ──────────────────────────────────────────────────

  irParaHoje(): void {
    this.dataSelecionada = this.hojeStr;
    const [, m, y] = this.dataSelecionada.split('/').map(Number);
    this.miniMes = m - 1; this.miniAno = y;
    this.carregarDados();
  }

  navAnterior(): void {
    this.dataSelecionada = this.viewMode === 'semana'
      ? this.deslocarData(this.diasSemana[0]?.data || this.dataSelecionada, -7)
      : this.deslocarData(this.dataSelecionada, -1);
    this.carregarDados();
  }

  navProximo(): void {
    this.dataSelecionada = this.viewMode === 'semana'
      ? this.deslocarData(this.diasSemana[0]?.data || this.dataSelecionada, 7)
      : this.deslocarData(this.dataSelecionada, 1);
    this.carregarDados();
  }

  trocarModo(modo: 'dia' | 'semana'): void {
    this.viewMode = modo;
    this.carregarDados();
  }

  selecionarTecnico(id: number | null): void {
    this.tecnicoFiltroId = id;
    this.carregarDados();
  }

  onDataChange(val: string): void {
    if (!val) return;
    const [y, m, d] = val.split('-');
    this.dataSelecionada = `${d}/${m}/${y}`;
    this.carregarDados();
  }

  // ── Labels e helpers ──────────────────────────────────────────────────────

  get tituloPeriodo(): string {
    if (this.viewMode === 'dia') {
      return this.dataSelecionada === this.hojeStr
        ? `Hoje — ${this.dataSelecionada}`
        : this.dataSelecionada;
    }
    if (!this.diasSemana.length) return '';
    const ini = this.diasSemana[0];
    const fim = this.diasSemana[6];
    const [di, mi] = ini.data.split('/').map(Number);
    const [df, mf, yf] = fim.data.split('/').map(Number);
    if (mi === mf) return `${di} – ${df} de ${this.MESES_NOMES[mi - 1]} de ${yf}`;
    return `${di} ${this.MESES_NOMES[mi - 1].substr(0,3)} – ${df} ${this.MESES_NOMES[mf - 1].substr(0,3)} de ${yf}`;
  }

  inicialDoNome(nome: string): string { return (nome || '?')[0].toUpperCase(); }

  corAvatar(nome: string): string {
    const cores = ['#1565c0','#2e7d32','#6a1b9a','#c62828','#e65100','#00695c','#283593'];
    return cores[(nome || '').charCodeAt(0) % cores.length];
  }

  toInputDate(ddMMyyyy: string): string {
    if (!ddMMyyyy?.includes('/')) return '';
    const [d, m, y] = ddMMyyyy.split('/');
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // ── Carregamento ──────────────────────────────────────────────────────────

  private carregarDados(): void {
    this.viewMode === 'semana' ? this.carregarSemana() : this.carregarDia();
  }

  private carregarSemana(): void {
    this.diasSemana = this.getDiasSemana();
    this.carregando = true;
    this.tarefasMap.clear();
    this.todasTarefas = [];

    const obs = this.diasSemana.map(d => {
      let tp: number | undefined;
      if (!this.isAdmin)                    tp = this.tecnicoId;
      else if (this.tecnicoFiltroId !== null) tp = this.tecnicoFiltroId;
      return this.tarefaService.findAll(d.data, tp);
    });

    forkJoin(obs).subscribe({
      next: (resultados) => {
        resultados.forEach((tarefas, i) => {
          const data = this.diasSemana[i].data;
          this.todasTarefas.push(...tarefas);
          tarefas.forEach(t => {
            const key = `${t.tecnico}_${data}`;
            if (!this.tarefasMap.has(key)) this.tarefasMap.set(key, []);
            this.tarefasMap.get(key)!.push(t);
          });
        });
        this.carregando = false;
      },
      error: () => { this.toastr.error('Erro ao carregar tarefas.'); this.carregando = false; }
    });
  }

  private carregarDia(): void {
    this.carregando = true;
    this.tarefasMap.clear();
    this.todasTarefas = [];

    let tp: number | undefined;
    if (!this.isAdmin)                    tp = this.tecnicoId;
    else if (this.tecnicoFiltroId !== null) tp = this.tecnicoFiltroId;

    this.tarefaService.findAll(this.dataSelecionada, tp).subscribe({
      next: (tarefas) => {
        this.todasTarefas = tarefas;
        tarefas.forEach(t => {
          const key = `${t.tecnico}_${this.dataSelecionada}`;
          if (!this.tarefasMap.has(key)) this.tarefasMap.set(key, []);
          this.tarefasMap.get(key)!.push(t);
        });
        this.carregando = false;
      },
      error: () => { this.toastr.error('Erro ao carregar tarefas.'); this.carregando = false; }
    });
  }

  private getDiasSemana(): DiaSemana[] {
    const LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const [d, m, y] = this.dataSelecionada.split('/').map(Number);
    const date = new Date(y, m - 1, d);
    const dow  = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() + (dow === 0 ? -6 : 1 - dow));

    return Array.from({ length: 7 }, (_, i) => {
      const dia = new Date(monday);
      dia.setDate(monday.getDate() + i);
      return {
        data:   this.fmtData(dia),
        label:  LABELS[i],
        numDia: String(dia.getDate()),
        mes:    this.MESES_NOMES[dia.getMonth()].substring(0, 3),
      };
    });
  }

  private lerPerfil(): void {
    const token = localStorage.getItem('token');
    if (!token) { this.carregarDados(); return; }

    const decoded = this.jwtHelper.decodeToken(token);
    const email: string = decoded?.sub ?? '';
    if (!email) { this.carregarDados(); return; }

    this.authService.getUserInfo(email).subscribe({
      next: (info: any) => {
        this.tecnicoId   = info.id   ?? 0;
        this.nomeUsuario = info.nome ?? '';
        const authorities: string[] = (info.authorities || [])
          .map((a: any) => typeof a === 'string' ? a : (a?.authority ?? ''));
        this.isAdmin = authorities.includes('ROLE_ADMIN');

        if (this.isAdmin) {
          this.tecnicoService.findAllAtivos().subscribe({
            next: lista => { this.tecnicos = lista; this.carregarDados(); },
            error: () => { this.toastr.error('Erro ao carregar técnicos.'); this.carregarDados(); }
          });
        } else {
          this.tecnicos = [{ id: this.tecnicoId, nome: this.nomeUsuario } as Tecnico];
          this.carregarDados();
        }
      },
      error: () => this.carregarDados()
    });
  }

  private fmtData(date: Date): string {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${date.getFullYear()}`;
  }

  private deslocarData(dataStr: string, dias: number): string {
    const [d, m, y] = dataStr.split('/').map(Number);
    const data = new Date(y, m - 1, d);
    data.setDate(data.getDate() + dias);
    return this.fmtData(data);
  }

  private isAnterior(data: string, ref: string): boolean {
    const ts = (s: string) => { const [d,m,y] = s.split('/').map(Number); return new Date(y,m-1,d).getTime(); };
    return ts(data) < ts(ref);
  }

  private isPosterior(data: string, ref: string): boolean {
    const ts = (s: string) => { const [d,m,y] = s.split('/').map(Number); return new Date(y,m-1,d).getTime(); };
    return ts(data) > ts(ref);
  }
}

