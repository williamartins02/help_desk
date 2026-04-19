import { Component, OnInit, OnDestroy, NgZone, HostListener } from '@angular/core';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { Client } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Subscription } from 'rxjs';

import { BiService } from '../../../../services/bi.service';
import { TecnicoService } from '../../../../services/tecnico.service';
import { ChamadoService } from '../../../../services/chamado.service';
import { AgendaWsService } from '../../../../services/agenda-ws.service';
import { AuthenticationService } from '../../../../services/authentication.service';
import { BiDashboard } from '../../../../models/bi-dashboard';
import { Tecnico } from '../../../../models/tecnico';
import { API_CONFIG } from '../../../../config/api.config';

@Component({
  selector: 'app-bi-dashboard',
  templateUrl: './bi-dashboard.component.html',
  styleUrls: ['./bi-dashboard.component.css']
})
export class BiDashboardComponent implements OnInit, OnDestroy {

  // ── Perfil do usuário logado ───────────────────────────────
  /** true → ROLE_ADMIN: vê o filtro de técnico e todos os dados */
  isAdmin   = false;
  /** true → ROLE_TECNICO puro: dados filtrados ao próprio técnico, sem filtro visível */
  isTecnico = false;
  /** ID do técnico logado — preenchido quando isTecnico = true */
  private usuarioLogadoId: number | null = null;

  // ── Filtros ────────────────────────────────────────────────
  filtroInicio: string = this.defaultInicio();
  filtroFim:    string = this.today();
  filtroTecnico: number | null = null;
  filtroStatus:  number | null = null;
  filtroPrioridade: number | null = null;

  // ── Dropdown custom state ───────────────────────────────────
  openDropdown: 'tecnico' | 'status' | 'prioridade' | null = null;

  @HostListener('document:click')
  fecharDropdowns() { this.openDropdown = null; }

  toggleDropdown(name: 'tecnico' | 'status' | 'prioridade', e: Event) {
    e.stopPropagation();
    this.openDropdown = this.openDropdown === name ? null : name;
  }

  selectTecnico(id: number | null, e: Event) {
    e.stopPropagation();
    this.filtroTecnico = id;
    this.openDropdown = null;
  }

  selectStatus(val: number | null, e: Event) {
    e.stopPropagation();
    this.filtroStatus = val;
    this.openDropdown = null;
  }

  selectPrioridade(val: number | null, e: Event) {
    e.stopPropagation();
    this.filtroPrioridade = val;
    this.openDropdown = null;
  }

  get selectedTecnicoLabel(): string {
    if (this.filtroTecnico === null) return 'Todos';
    const t = this.tecnicos.find(t => t.id === this.filtroTecnico);
    return t ? t.nome : 'Todos';
  }
  get selectedStatusLabel(): string {
    const s = this.statusOpcoes.find(s => s.value === this.filtroStatus);
    return s ? s.label : 'Todos';
  }
  get selectedPrioridadeLabel(): string {
    const p = this.prioridadeOpcoes.find(p => p.value === this.filtroPrioridade);
    return p ? p.label : 'Todas';
  }

  /** Retorna true quando há pelo menos um filtro diferente do padrão */
  get temFiltroAtivo(): boolean {
    // Para técnico puro, filtroTecnico é sempre o próprio ID (fixo) — não conta como filtro ativo
    const tecnicoAtivo = this.isAdmin ? this.filtroTecnico !== null : false;
    return tecnicoAtivo ||
           this.filtroStatus    !== null ||
           this.filtroPrioridade !== null ||
           this.filtroInicio    !== this.defaultInicio() ||
           this.filtroFim       !== this.today();
  }

  tecnicos: Tecnico[] = [];
  statusOpcoes = [
    { label: 'Todos', value: null },
    { label: 'Aberto',    value: 0 },
    { label: 'Andamento', value: 1 },
    { label: 'Encerrado', value: 2 }
  ];
  prioridadeOpcoes = [
    { label: 'Todas',   value: null },
    { label: 'Baixa',   value: 0 },
    { label: 'Média',   value: 1 },
    { label: 'Alta',    value: 2 },
    { label: 'Crítica', value: 3 }
  ];

  // ── Estado ─────────────────────────────────────────────────
  isLoading = true;
  ultimaAtualizacao: Date | null = null;
  dashboard: BiDashboard | null = null;

  // ── WebSocket ──────────────────────────────────────────────
  private wsClient!: Client;
  private wsConnected = false;

  // ── Subscriptions — Central de Chamados + Kanban ────────────
  private chamadoRefreshSub!: Subscription;
  private chamadoWsSub!: Subscription;

  // ── Chart: Evolução por dia (Line) ────────────────────────
  lineChartType: ChartType = 'line';
  lineChartData: ChartData<'line'> = { labels: [], datasets: [] };
  lineChartOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: { y: { beginAtZero: true } }
  };

  // ── Chart: Por Status (Doughnut) ──────────────────────────
  doughnutStatusType: ChartType = 'doughnut';
  doughnutStatusData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  doughnutOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
  };

  // ── Chart: Por Categoria (Pie) ────────────────────────────
  pieCategType: ChartType = 'pie';
  pieCategData: ChartData<'pie'> = { labels: [], datasets: [] };
  pieOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
  };

  // ── Chart: Técnicos (Bar) ─────────────────────────────────
  barTecType: ChartType = 'bar';
  barTecData: ChartData<'bar'> = { labels: [], datasets: [] };
  barTecOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: { legend: { position: 'bottom' } },
    scales: { x: { beginAtZero: true } }
  };

  constructor(
    private biService: BiService,
    private tecnicoService: TecnicoService,
    private chamadoService: ChamadoService,
    private agendaWs: AgendaWsService,
    private authService: AuthenticationService,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    // ── 1. Resolver perfil do usuário logado ───────────────────────────────
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = this.authService.jwtService.decodeToken(token);
      const email: string = decoded?.sub ?? '';
      if (email) {
        this.authService.getUserInfo(email).subscribe({
          next: (info: any) => {
            const authorities: string[] = (info.authorities || [])
              .map((a: any) => typeof a === 'string' ? a : (a?.authority ?? ''));

            this.isAdmin   = authorities.includes('ROLE_ADMIN');
            this.isTecnico = authorities.includes('ROLE_TECNICO') && !this.isAdmin;

            // Técnico puro → fixa o filtro no próprio ID automaticamente
            if (this.isTecnico) {
              this.usuarioLogadoId = info.id ?? null;
              this.filtroTecnico   = this.usuarioLogadoId;
            }

            // Apenas admin carrega a lista de técnicos para o dropdown
            if (this.isAdmin) {
              this.tecnicoService.findAllAtivos().subscribe(t => this.tecnicos = t);
            }

            this.carregarDados();
          },
          error: () => {
            // Fallback: Admin assume como padrão em caso de erro
            this.isAdmin = true;
            this.tecnicoService.findAllAtivos().subscribe(t => this.tecnicos = t);
            this.carregarDados();
          }
        });
      } else {
        this.carregarDados();
      }
    } else {
      this.carregarDados();
    }

    this.conectarWebSocket();

    // ── 2. Integração com Central de Chamados e Kanban ──────────────────────
    this.chamadoRefreshSub = this.chamadoService.refresh$.subscribe(() => {
      this.zone.run(() => this.carregarDados());
    });

    this.agendaWs.connect();
    this.chamadoWsSub = this.agendaWs.chamadoAtualizado$.subscribe(() => {
      this.zone.run(() => this.carregarDados());
    });
  }

  ngOnDestroy(): void {
    this.desconectarWebSocket();
    if (this.chamadoRefreshSub) this.chamadoRefreshSub.unsubscribe();
    if (this.chamadoWsSub)      this.chamadoWsSub.unsubscribe();
  }

  // ── Filtros ────────────────────────────────────────────────
  aplicarFiltros(): void { this.carregarDados(); }

  limparFiltros(): void {
    this.filtroInicio     = this.defaultInicio();
    this.filtroFim        = this.today();
    // Admin: limpa o técnico; Técnico puro: mantém o próprio ID fixo
    this.filtroTecnico    = this.isTecnico ? this.usuarioLogadoId : null;
    this.filtroStatus     = null;
    this.filtroPrioridade = null;
    this.carregarDados();
  }

  setPeriodoPredefinido(dias: number): void {
    const hoje = new Date();
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - dias);
    this.filtroInicio = this.toISODate(inicio);
    this.filtroFim    = this.toISODate(hoje);
    this.carregarDados();
  }

  // ── Carga de dados ─────────────────────────────────────────
  carregarDados(): void {
    this.isLoading = true;
    this.biService.getDashboard({
      dataInicio:  this.filtroInicio,
      dataFim:     this.filtroFim,
      tecnicoId:   this.filtroTecnico,
      status:      this.filtroStatus,
      prioridade:  this.filtroPrioridade
    }).subscribe({
      next: data => {
        this.dashboard = data;
        this.isLoading = false;
        this.ultimaAtualizacao = new Date();
        this.buildCharts(data);
      },
      error: () => { this.isLoading = false; }
    });
  }

  // ── Charts ─────────────────────────────────────────────────
  private buildCharts(d: BiDashboard): void {
    // Line: evolução diária
    this.lineChartData = {
      labels: d.evolucao.map(e => e.data),
      datasets: [
        { data: d.evolucao.map(e => e.abertos),      label: 'Abertos',    borderColor: '#1976d2', backgroundColor: 'rgba(25,118,210,0.1)', tension: 0.4, fill: true },
        { data: d.evolucao.map(e => e.emAndamento),  label: 'Andamento',  borderColor: '#f57c00', backgroundColor: 'rgba(245,124,0,0.1)',   tension: 0.4, fill: true },
        { data: d.evolucao.map(e => e.encerrados),   label: 'Encerrados', borderColor: '#43a047', backgroundColor: 'rgba(67,160,71,0.1)',   tension: 0.4, fill: true }
      ]
    };

    // Doughnut: por status
    const statusKeys = Object.keys(d.porStatus);
    this.doughnutStatusData = {
      labels: statusKeys,
      datasets: [{ data: statusKeys.map(k => d.porStatus[k]), backgroundColor: ['#1976d2','#f57c00','#43a047'] }]
    };

    // Pie: por categoria
    const catKeys = Object.keys(d.porCategoria);
    this.pieCategData = {
      labels: catKeys,
      datasets: [{ data: catKeys.map(k => d.porCategoria[k]), backgroundColor: ['#7b1fa2','#0097a7','#e53935','#ff8f00'] }]
    };

    // Bar: técnicos (top 10)
    const top = d.tecnicosRanking.slice(0, 10);
    this.barTecData = {
      labels: top.map(t => t.nome),
      datasets: [
        { data: top.map(t => t.totalResolvidos), label: 'Resolvidos', backgroundColor: '#1976d2', borderRadius: 4 } as any,
        { data: top.map(t => Math.round(t.slaPercent)), label: 'SLA %',      backgroundColor: '#43a047', borderRadius: 4 } as any
      ]
    };
  }

  // ── Formatações ────────────────────────────────────────────
  formatarTempo(mins: number): string {
    if (!mins || mins <= 0) return '—';
    if (mins < 60) return `${Math.round(mins)} min`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h < 24) return m > 0 ? `${h}h ${m}min` : `${h}h`;
    const d = Math.floor(h / 24);
    const r = h % 24;
    return r > 0 ? `${d}d ${r}h` : `${d}d`;
  }

  slaColor(pct: number): string {
    if (pct >= 90) return '#43a047';
    if (pct >= 70) return '#f57c00';
    return '#e53935';
  }

  tempoColor(mins: number): string {
    if (mins <= 60)  return '#43a047';
    if (mins <= 480) return '#f57c00';
    return '#e53935';
  }

  posicaoEmoji(pos: number): string {
    if (pos === 1) return '🥇';
    if (pos === 2) return '🥈';
    if (pos === 3) return '🥉';
    return `#${pos}`;
  }

  // ── WebSocket ──────────────────────────────────────────────
  private conectarWebSocket(): void {
    this.wsClient = new Client();
    this.wsClient.webSocketFactory = () =>
      new SockJS(API_CONFIG.baseUrl + '/chat-websocket');

    this.wsClient.onConnect = () => {
      this.zone.run(() => {
        this.wsConnected = true;
        this.wsClient.subscribe('/bi/refresh', () => {
          this.zone.run(() => this.carregarDados());
        });
      });
    };
    this.wsClient.activate();
  }

  private desconectarWebSocket(): void {
    if (this.wsClient && this.wsConnected) {
      try { this.wsClient.deactivate(); } catch (_) {}
    }
  }

  // ── Export CSV Premium ──────────────────────────────────────
  exportarCSV(): void {
    if (!this.dashboard) return;
    const d   = this.dashboard;
    const S   = ';';
    const now = new Date().toLocaleString('pt-BR');
    const tecnicoLabel    = this.filtroTecnico    !== null ? this.selectedTecnicoLabel    : 'Todos';
    const statusLabel     = this.filtroStatus     !== null ? this.selectedStatusLabel     : 'Todos';
    const prioridadeLabel = this.filtroPrioridade !== null ? this.selectedPrioridadeLabel : 'Todas';

    // ── Número fixo de colunas do relatório ───────────────────────────────────
    const COLS = 7;

    // ── Helper: envolve em aspas e escapa aspas internas (CSV-safe) ───────────
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

    // ── Helper: linha com N células vazias ───────────────────────────────────
    const blank = () => Array(COLS).fill('""').join(S);

    // ── Helper: separador sólido (═══) ───────────────────────────────────────
    const divider = () => Array(COLS).fill(q('═══════════════════')).join(S);

    // ── Helper: separador leve (───) ─────────────────────────────────────────
    const thinSep = () => Array(COLS).fill(q('───────────────────')).join(S);

    // ── Helper: cabeçalho de seção destacado ─────────────────────────────────
    const secHead = (icon: string, title: string) => {
      const cell = q(`${icon}  ${title.toUpperCase()}`);
      const fill = Array(COLS - 1).fill('""').join(S);
      return `${cell}${S}${fill}`;
    };

    // ── Helper: linha de cabeçalho de tabela (7 colunas, preenchendo com vazio) ─
    const tableHead = (...labels: string[]) => {
      const cells = labels.map(q);
      while (cells.length < COLS) cells.push('""');
      return cells.join(S);
    };

    // ── Helper: linha de dados (7 colunas) ───────────────────────────────────
    const row = (...vals: (string | number)[]) => {
      const cells = vals.map(q);
      while (cells.length < COLS) cells.push('""');
      return cells.join(S);
    };

    // ── Helper: barra ASCII de progresso (20 chars) ───────────────────────────
    const asciiBar = (val: number, max: number) => {
      const filled = Math.round((val / (max || 1)) * 20);
      return '█'.repeat(filled) + '░'.repeat(20 - filled);
    };

    // ── Helper: emoji de avaliação SLA ────────────────────────────────────────
    const slaEmoji = (pct: number) =>
      pct >= 90 ? '✅ Excelente' : pct >= 70 ? '⚠️  Aceitável' : '🚨 Crítico';

    // ── Helper: % formatado ───────────────────────────────────────────────────
    const pct = (val: number, total: number) =>
      total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '—';

    // ── Metadados gerais ──────────────────────────────────────────────────────
    const taxaResolucao = d.totalChamados > 0
      ? ((d.totalEncerrados / d.totalChamados) * 100).toFixed(1) + '%'
      : '—';

    // ═══════════════════════════════════════════════════════════════════════════
    const lines: string[] = [];

    // ────────────────────────────────────────────────────────────────────────
    //  CABEÇALHO DO DOCUMENTO
    // ────────────────────────────────────────────────────────────────────────
    lines.push(
      divider(),
      row('📊  HELP DESK — RELATÓRIO DE BUSINESS INTELLIGENCE', '', '', '', '', '', ''),
      divider(),
      blank(),
      tableHead('📅  Gerado em',        now,            '', '', '', '', ''),
      tableHead('📆  Período',           `${this.filtroInicio}  →  ${this.filtroFim}`, '', '', '', '', ''),
      tableHead('👤  Técnico filtrado',  tecnicoLabel,   '', '', '', '', ''),
      tableHead('🔖  Status filtrado',   statusLabel,    '', '', '', '', ''),
      tableHead('⚡  Prioridade filtrada', prioridadeLabel, '', '', '', '', ''),
      blank(),
      divider(),
    );

    // ────────────────────────────────────────────────────────────────────────
    //  1. INDICADORES GERAIS DE DESEMPENHO
    // ────────────────────────────────────────────────────────────────────────
    lines.push(
      blank(),
      secHead('📈', '1. Indicadores Gerais de Desempenho'),
      thinSep(),
      tableHead('Indicador', 'Valor', '% do Total', 'Avaliação / Detalhe', 'Barra de Progresso', '', ''),
      thinSep(),
      row('🗂️  Total de Chamados',           d.totalChamados,                        '100%',
          'Chamados no período selecionado',  asciiBar(d.totalChamados, d.totalChamados), '', ''),
      row('🟡  Abertos',                      d.totalAbertos,                         pct(d.totalAbertos,   d.totalChamados),
          'Aguardando atendimento',           asciiBar(d.totalAbertos,   d.totalChamados), '', ''),
      row('🔵  Em Andamento',                 d.totalAndamento,                       pct(d.totalAndamento, d.totalChamados),
          'Em execução agora',                asciiBar(d.totalAndamento, d.totalChamados), '', ''),
      row('🟢  Encerrados',                   d.totalEncerrados,                      pct(d.totalEncerrados, d.totalChamados),
          'Resolvidos no período',            asciiBar(d.totalEncerrados, d.totalChamados), '', ''),
      row('🔴  Críticos em Aberto',           d.totalCriticos,                        pct(d.totalCriticos,  d.totalChamados),
          'Prioridade Crítica não encerrados', asciiBar(d.totalCriticos, d.totalChamados), '', ''),
      thinSep(),
      row('⏱️  Tempo Médio de Resolução (TMR)', this.formatarTempo(d.tempoMedioResolucaoMins),
          '', 'Média dos chamados encerrados', '', '', ''),
      row('🎯  Taxa de Resolução',            taxaResolucao,    '', 'Encerrados / Total',        '', '', ''),
      row('📋  SLA Cumprido',                 d.slaPercent.toFixed(1) + '%',
          '', slaEmoji(d.slaPercent),          asciiBar(d.slaPercent, 100), '', ''),
      thinSep(),
    );

    // ────────────────────────────────────────────────────────────────────────
    //  2. DISTRIBUIÇÃO POR STATUS
    // ────────────────────────────────────────────────────────────────────────
    const statusEntries = Object.entries(d.porStatus) as [string, number][];
    const maxStatus = Math.max(...statusEntries.map(([, v]) => v), 1);
    lines.push(
      blank(),
      secHead('🔖', '2. Distribuição por Status'),
      thinSep(),
      tableHead('Status', 'Quantidade', '% do Total', 'Barra de Progresso', '', '', ''),
      thinSep(),
      ...statusEntries.map(([k, v]) =>
        row(k, v, pct(v, d.totalChamados), asciiBar(v, maxStatus), '', '', '')
      ),
      thinSep(),
      row('TOTAL', d.totalChamados, '100%', '', '', '', ''),
      thinSep(),
    );

    // ────────────────────────────────────────────────────────────────────────
    //  3. DISTRIBUIÇÃO POR PRIORIDADE
    // ────────────────────────────────────────────────────────────────────────
    const prioEntries = Object.entries(d.porPrioridade) as [string, number][];
    const maxPrio = Math.max(...prioEntries.map(([, v]) => v), 1);
    const prioEmoji: Record<string, string> = {
      BAIXA: '🔵 Baixa', MEDIA: '🟡 Média', MÉDIA: '🟡 Média',
      ALTA: '🟠 Alta', CRITICA: '🔴 Crítica', CRÍTICA: '🔴 Crítica'
    };
    lines.push(
      blank(),
      secHead('⚡', '3. Distribuição por Prioridade'),
      thinSep(),
      tableHead('Prioridade', 'Quantidade', '% do Total', 'Barra de Progresso', '', '', ''),
      thinSep(),
      ...prioEntries.map(([k, v]) => {
        const chave = k.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const label = prioEmoji[chave] || k;
        return row(label, v, pct(v, d.totalChamados), asciiBar(v, maxPrio), '', '', '');
      }),
      thinSep(),
      row('TOTAL', d.totalChamados, '100%', '', '', '', ''),
      thinSep(),
    );

    // ────────────────────────────────────────────────────────────────────────
    //  4. DISTRIBUIÇÃO POR CATEGORIA
    // ────────────────────────────────────────────────────────────────────────
    const catEntries = Object.entries(d.porCategoria) as [string, number][];
    const maxCat = Math.max(...catEntries.map(([, v]) => v), 1);
    const catTotal = catEntries.reduce((acc, [, v]) => acc + v, 0);
    lines.push(
      blank(),
      secHead('🗂️', '4. Distribuição por Categoria'),
      thinSep(),
      tableHead('Categoria', 'Quantidade', '% do Total', 'Barra de Progresso', '', '', ''),
      thinSep(),
      ...catEntries
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .map(([k, v]) => row(k, v, pct(v as number, d.totalChamados), asciiBar(v as number, maxCat), '', '', '')),
      thinSep(),
      row('TOTAL', catTotal, '100%', '', '', '', ''),
      thinSep(),
    );

    // ────────────────────────────────────────────────────────────────────────
    //  5. RANKING DE TÉCNICOS
    // ────────────────────────────────────────────────────────────────────────
    const medalIcon = (pos: number) =>
      pos === 1 ? '🥇 1º Lugar' : pos === 2 ? '🥈 2º Lugar' : pos === 3 ? '🥉 3º Lugar' : `  ${pos}º`;
    const totalResolvidos = d.tecnicosRanking.reduce((acc, t) => acc + t.totalResolvidos, 0);
    lines.push(
      blank(),
      secHead('🏆', '5. Ranking de Técnicos'),
      thinSep(),
      tableHead('Posição', 'Técnico', 'Chamados Resolvidos', '% dos Resolvidos',
                'Tempo Médio de Resolução', 'SLA Cumprido (%)', 'Avaliação SLA'),
      thinSep(),
      ...d.tecnicosRanking.map(t =>
        row(
          medalIcon(t.posicao),
          t.nome,
          t.totalResolvidos,
          pct(t.totalResolvidos, totalResolvidos || 1),
          this.formatarTempo(t.tempoMedioResolucaoMins),
          t.slaPercent.toFixed(1) + '%',
          slaEmoji(t.slaPercent)
        )
      ),
      thinSep(),
      row('TOTAL', `${d.tecnicosRanking.length} técnico(s)`, totalResolvidos,
          '100%', '', '', ''),
      thinSep(),
    );

    // ────────────────────────────────────────────────────────────────────────
    //  6. EVOLUÇÃO DIÁRIA
    // ────────────────────────────────────────────────────────────────────────
    const totalAbertosEvo    = d.evolucao.reduce((s, e) => s + e.abertos, 0);
    const totalAndamentoEvo  = d.evolucao.reduce((s, e) => s + e.emAndamento, 0);
    const totalEncerradosEvo = d.evolucao.reduce((s, e) => s + e.encerrados, 0);
    const totalGeralEvo      = totalAbertosEvo + totalAndamentoEvo + totalEncerradosEvo;
    lines.push(
      blank(),
      secHead('📅', '6. Evolução Diária de Chamados'),
      thinSep(),
      tableHead('Data', '🟡 Abertos', '🔵 Em Andamento', '🟢 Encerrados', 'Total do Dia', '% Encerrados no Dia', ''),
      thinSep(),
      ...d.evolucao.map(e => {
        const totalDia = e.abertos + e.emAndamento + e.encerrados;
        return row(
          e.data,
          e.abertos,
          e.emAndamento,
          e.encerrados,
          totalDia,
          pct(e.encerrados, totalDia || 1),
          ''
        );
      }),
      thinSep(),
      row('TOTAL DO PERÍODO', totalAbertosEvo, totalAndamentoEvo,
          totalEncerradosEvo, totalGeralEvo, pct(totalEncerradosEvo, totalGeralEvo || 1), ''),
      thinSep(),
    );

    // ────────────────────────────────────────────────────────────────────────
    //  LEGENDA & RODAPÉ
    // ────────────────────────────────────────────────────────────────────────
    lines.push(
      blank(),
      divider(),
      secHead('📌', 'Legenda e Notas'),
      thinSep(),
      row('✅ Excelente', 'SLA ≥ 90%',   '', '', '', '', ''),
      row('⚠️  Aceitável', 'SLA ≥ 70%',  '', '', '', '', ''),
      row('🚨 Crítico',   'SLA < 70%',   '', '', '', '', ''),
      row('TMR',          'Tempo Médio de Resolução — média de todos os chamados encerrados no período', '', '', '', '', ''),
      row('Barra (█░)',   'Representação visual proporcional ao maior valor da coluna', '', '', '', '', ''),
      thinSep(),
      row('Relatório gerado automaticamente pelo sistema Help Desk.', '', '', '', '', '', ''),
      row('Documento de uso interno. Não distribua externamente.', '', '', '', '', '', ''),
      row(`© Help Desk — ${now}`, '', '', '', '', '', ''),
      divider(),
    );

    // ── Gera e baixa o arquivo ────────────────────────────────────────────────
    const bom  = '\uFEFF'; // BOM UTF-8: garante acentos corretos no Excel
    const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `HelpDesk_BI_${this.today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Export PDF Premium ──────────────────────────────────────
  exportarPDF(): void {
    if (!this.dashboard) return;
    const d   = this.dashboard;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw  = doc.internal.pageSize.getWidth();   // 210 mm
    const ph  = doc.internal.pageSize.getHeight();  // 297 mm
    const now = new Date().toLocaleString('pt-BR');
    const tecLabel = this.filtroTecnico !== null ? this.selectedTecnicoLabel : 'Todos';

    // ── Paleta (todas sólidas — jsPDF não suporta alpha) ──────────────────────
    const NAVY   : [number,number,number] = [13,  44,  84];
    const NAVY2  : [number,number,number] = [20,  60, 110];
    const BLUE   : [number,number,number] = [25, 118, 210];
    const LBLUE  : [number,number,number] = [227,242, 253];
    const DBLUE  : [number,number,number] = [21,  96, 189];
    const TEAL   : [number,number,number] = [0,  137, 123];
    const LTEAL  : [number,number,number] = [224,242, 241];
    const GREEN  : [number,number,number] = [46, 125,  50];
    const LGREEN : [number,number,number] = [232,245, 233];
    const AMBER  : [number,number,number] = [230,119,   0];
    const LAMBER : [number,number,number] = [255,243, 224];
    const RED    : [number,number,number] = [198, 40,  40];
    const LRED   : [number,number,number] = [255,235, 238];
    const PURPLE : [number,number,number] = [106, 27, 154];
    const LPURPL : [number,number,number] = [243,229, 245];
    const LGRAY  : [number,number,number] = [245,247, 250];
    const MGRAY  : [number,number,number] = [158,158, 158];
    const DGRAY  : [number,number,number] = [55,  55,  55];
    const WHITE  : [number,number,number] = [255,255, 255];

    // ── Estado de paginação ───────────────────────────────────────────────────
    let pageNum = 0;

    // ── Helper: cabeçalho de página (após capa) ───────────────────────────────
    const addPageHeader = (title: string) => {
      pageNum++;
      // fundo NAVY
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, pw, 14, 'F');
      // listra azul embaixo
      doc.setFillColor(...BLUE);
      doc.rect(0, 14, pw, 2, 'F');
      // mini-logo
      doc.setFillColor(...DBLUE);
      doc.roundedRect(7, 2.5, 10, 10, 1, 1, 'F');
      doc.setTextColor(...WHITE);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.text('HD', 12, 8.8, { align: 'center' });
      // título e página
      doc.setFontSize(8);
      doc.text(`HELP DESK  —  ${title}`, 21, 9.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Pág. ${pageNum}`, pw - 8, 9.5, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    };

    // ── Helper: rodapé de página ──────────────────────────────────────────────
    const addPageFooter = () => {
      // listra topo do footer
      doc.setFillColor(...BLUE);
      doc.rect(0, ph - 12, pw, 0.8, 'F');
      doc.setFillColor(...LGRAY);
      doc.rect(0, ph - 11.2, pw, 11.2, 'F');
      doc.setFontSize(6.5);
      doc.setTextColor(...MGRAY);
      doc.text(
        `Gerado em: ${now}   |   Período: ${this.filtroInicio} → ${this.filtroFim}   |   Técnico: ${tecLabel}`,
        10, ph - 5
      );
      doc.text('Help Desk © Sistema Interno — Documento Confidencial', pw - 10, ph - 5, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    };

    // ── Helper: título de seção (barra lateral sólida + fundo pastel sólido) ─
    const sectionHead = (
      text: string, yy: number,
      color: [number,number,number],
      bg: [number,number,number]
    ): number => {
      // fundo pastel
      doc.setFillColor(...bg);
      doc.rect(10, yy, pw - 20, 8, 'F');
      // barra lateral colorida
      doc.setFillColor(...color);
      doc.rect(10, yy, 4, 8, 'F');
      // texto
      doc.setTextColor(...color);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text(text, 17, yy + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      return yy + 12;
    };

    // ── Helper: barra de progresso com % e quantidade ─────────────────────────
    const drawBar = (
      label: string, qty: number, maxQty: number, pctTotal: number,
      yy: number, color: [number,number,number], bgColor: [number,number,number]
    ): number => {
      const labelW = 42, barX = 10 + labelW + 2, barW = pw - 20 - labelW - 28, barH = 5.5;
      const fillW  = Math.max((qty / (maxQty || 1)) * barW, 1.5);
      // label
      doc.setFontSize(7.5);
      doc.setTextColor(...DGRAY);
      doc.setFont('helvetica', 'normal');
      doc.text(label, 10, yy + 4.2);
      // trilha
      doc.setFillColor(...bgColor);
      doc.roundedRect(barX, yy, barW, barH, 1, 1, 'F');
      // fill
      doc.setFillColor(...color);
      doc.roundedRect(barX, yy, fillW, barH, 1, 1, 'F');
      // valor direita
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...color);
      doc.text(`${qty}  (${pctTotal.toFixed(1)}%)`, pw - 10, yy + 4.2, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      return yy + 9;
    };

    // ══════════════════════════════════════════════════════════════════════════
    // PÁGINA 1 — CAPA
    // ══════════════════════════════════════════════════════════════════════════
    pageNum++;

    // Fundo total NAVY
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pw, ph, 'F');

    // Faixa lateral esquerda BLUE
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, 7, ph, 'F');

    // Faixa lateral direita escura
    doc.setFillColor(...NAVY2);
    doc.rect(pw - 5, 0, 5, ph, 'F');

    // Faixa horizontal decorativa central
    doc.setFillColor(20, 55, 105);
    doc.rect(0, 130, pw, 55, 'F');

    // Badge circular HD
    doc.setFillColor(...BLUE);
    doc.roundedRect(pw / 2 - 20, 42, 40, 40, 6, 6, 'F');
    // sombra (retângulo escuro logo abaixo)
    doc.setFillColor(...DBLUE);
    doc.rect(pw / 2 - 20, 62, 40, 20, 'F');
    doc.roundedRect(pw / 2 - 20, 62, 40, 20, 0, 6, 'F');
    // texto do badge
    doc.setTextColor(...WHITE);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('HD', pw / 2, 68, { align: 'center' });
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 220, 255);
    doc.text('HELP DESK', pw / 2, 76, { align: 'center' });

    // Título
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.text('DASHBOARD DE BI', pw / 2, 100, { align: 'center' });

    // Subtítulo
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MGRAY);
    doc.text('Relatório Executivo de Desempenho Operacional', pw / 2, 110, { align: 'center' });

    // Linha divisória azul
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.7);
    doc.line(20, 116, pw - 20, 116);

    // Metadados de filtro
    doc.setFontSize(8.5);
    doc.setTextColor(...WHITE);
    doc.text(`Período: ${this.filtroInicio}  →  ${this.filtroFim}`, pw / 2, 125, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(...MGRAY);
    doc.text(`Gerado em: ${now}   |   Técnico filtrado: ${tecLabel}`, pw / 2, 132, { align: 'center' });

    // ── KPI Cards da capa (7 cards: 4 + 3) ──────────────────────────────────
    const capaCards = [
      { label: 'TOTAL',      value: String(d.totalChamados),                   color: BLUE,   top: DBLUE  },
      { label: 'ABERTOS',    value: String(d.totalAbertos),                    color: AMBER,  top: [180,90,0] as [number,number,number] },
      { label: 'ANDAMENTO',  value: String(d.totalAndamento),                  color: TEAL,   top: [0,100,90] as [number,number,number] },
      { label: 'ENCERRADOS', value: String(d.totalEncerrados),                 color: GREEN,  top: [34,95,38] as [number,number,number] },
      { label: 'CRITICOS',   value: String(d.totalCriticos),                   color: RED,    top: [150,20,20] as [number,number,number] },
      { label: 'TMR',        value: this.formatarTempo(d.tempoMedioResolucaoMins), color: PURPLE, top: [80,15,120] as [number,number,number] },
      { label: 'SLA',        value: d.slaPercent.toFixed(1) + '%',             color: d.slaPercent >= 70 ? GREEN : RED, top: d.slaPercent >= 70 ? [34,95,38] as [number,number,number] : [150,20,20] as [number,number,number] },
    ];

    const cW = 25, cH = 32, gap = 4;
    const r1n = 4, r1total = r1n * cW + (r1n - 1) * gap;
    const r2n = 3, r2total = r2n * cW + (r2n - 1) * gap;
    const r1x = (pw - r1total) / 2, r1y = 143;
    const r2x = (pw - r2total) / 2, r2y = r1y + cH + 5;

    capaCards.forEach((c, i) => {
      const inRow2 = i >= r1n;
      const idx    = inRow2 ? i - r1n : i;
      const bx     = (inRow2 ? r2x : r1x) + idx * (cW + gap);
      const by     = inRow2 ? r2y : r1y;
      // card fundo
      doc.setFillColor(25, 60, 115);
      doc.roundedRect(bx, by, cW, cH, 2.5, 2.5, 'F');
      // borda superior colorida
      doc.setFillColor(...c.top);
      doc.rect(bx, by, cW, 3, 'F');
      doc.roundedRect(bx, by, cW, 3, 2.5, 2.5, 'F');
      // valor
      doc.setTextColor(...WHITE);
      doc.setFontSize(c.value.length > 5 ? 8.5 : 12);
      doc.setFont('helvetica', 'bold');
      doc.text(c.value, bx + cW / 2, by + 17, { align: 'center' });
      // label
      doc.setFontSize(4.8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 210, 255);
      doc.text(c.label, bx + cW / 2, by + 25, { align: 'center' });
    });

    // Rodapé da capa
    doc.setFillColor(...BLUE);
    doc.rect(0, ph - 10, pw, 10, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(...WHITE);
    doc.text('Help Desk © Sistema Interno  —  Documento Confidencial', pw / 2, ph - 4, { align: 'center' });

    // ══════════════════════════════════════════════════════════════════════════
    // PÁGINA 2 — KPIs + SLA + Distribuições
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    addPageHeader('Indicadores e Distribuicoes');
    let y = 20;

    // ── KPIs via autoTable (layout tabular premium) ───────────────────────────
    y = sectionHead('INDICADORES GERAIS DE DESEMPENHO', y, BLUE, LBLUE);

    const kpiDefs = [
      { label: 'Total de Chamados',  value: String(d.totalChamados),                   detail: 'no período selecionado', color: BLUE   },
      { label: 'Abertos',            value: String(d.totalAbertos),                    detail: 'aguardando atendimento', color: AMBER  },
      { label: 'Em Andamento',       value: String(d.totalAndamento),                  detail: 'em execução agora',      color: TEAL   },
      { label: 'Encerrados',         value: String(d.totalEncerrados),                 detail: 'resolvidos no período',  color: GREEN  },
      { label: 'Criticos Abertos',   value: String(d.totalCriticos),                   detail: 'prioridade crítica',     color: RED    },
      { label: 'Tempo Médio (TMR)',   value: this.formatarTempo(d.tempoMedioResolucaoMins), detail: 'de resolução',       color: PURPLE },
      { label: 'SLA Cumprido',       value: d.slaPercent.toFixed(1) + '%',             detail: d.slaPercent >= 90 ? 'Excelente' : d.slaPercent >= 70 ? 'Aceitavel' : 'Critico', color: d.slaPercent >= 70 ? GREEN : RED },
    ];

    // 4 cards por linha, desenhados manualmente com coordenadas corretas
    const ncols = 4;
    const cCardW = (pw - 20 - (ncols - 1) * 3) / ncols;
    const cCardH = 22;

    kpiDefs.forEach((k, i) => {
      const col = i % ncols;
      const row = Math.floor(i / ncols);
      const bx  = 10 + col * (cCardW + 3);
      const by  = y + row * (cCardH + 4);

      const bgMap: Record<string, [number,number,number]> = {
        '#1976d2': LBLUE, '#e67700': LAMBER, '#00897b': LTEAL,
        '#2e7d32': LGREEN, '#c62828': LRED, '#6a1b9a': LPURPL
      };
      const colorKey = k.color === BLUE ? '#1976d2' : k.color === AMBER ? '#e67700' :
                       k.color === TEAL ? '#00897b' : k.color === GREEN ? '#2e7d32' :
                       k.color === RED  ? '#c62828' : k.color === PURPLE ? '#6a1b9a' :
                       k.color === GREEN ? '#2e7d32' : '#c62828';
      const cardBg: [number,number,number] = bgMap[colorKey] ?? LGRAY;

      // fundo card
      doc.setFillColor(...cardBg);
      doc.roundedRect(bx, by, cCardW, cCardH, 2, 2, 'F');
      // barra lateral sólida (rect simples, sem roundedRect para evitar artefatos)
      doc.setFillColor(...k.color);
      doc.rect(bx, by, 3.5, cCardH, 'F');
      // arredondar apenas cantos esquerdos: sobrepor um rect nos cantos direitos da barra
      // (solução: deixar rect simples — mais confiável no jsPDF)

      // valor
      doc.setTextColor(...k.color);
      doc.setFontSize(k.value.length > 6 ? 9.5 : 12);
      doc.setFont('helvetica', 'bold');
      doc.text(k.value, bx + cCardW / 2 + 1.5, by + 9.5, { align: 'center' });
      // label
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DGRAY);
      doc.text(k.label, bx + cCardW / 2 + 1.5, by + 15, { align: 'center' });
      // detalhe
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MGRAY);
      doc.text(k.detail, bx + cCardW / 2 + 1.5, by + 19.5, { align: 'center' });
    });

    y += Math.ceil(kpiDefs.length / ncols) * (cCardH + 4) + 6;

    // ── Barra SLA ─────────────────────────────────────────────────────────────
    y = sectionHead('SLA — NIVEL DE SERVICO', y, TEAL, LTEAL);
    const slaBarW = pw - 20;
    const slaFill = Math.max((d.slaPercent / 100) * slaBarW, 4);
    const slaCol  = d.slaPercent >= 90 ? GREEN : d.slaPercent >= 70 ? AMBER : RED;
    const slaAval = d.slaPercent >= 90 ? 'Excelente' : d.slaPercent >= 70 ? 'Aceitavel' : 'Critico';
    // trilha cinza
    doc.setFillColor(215, 215, 215);
    doc.roundedRect(10, y, slaBarW, 10, 2, 2, 'F');
    // fill colorido
    doc.setFillColor(...slaCol);
    doc.roundedRect(10, y, slaFill, 10, 2, 2, 'F');
    // percentual dentro da barra
    doc.setFontSize(7.5);
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    if (slaFill > 25) doc.text(`${d.slaPercent.toFixed(1)}%`, 10 + slaFill / 2, y + 6.8, { align: 'center' });
    // avaliação fora (direita)
    doc.setFontSize(7.5);
    doc.setTextColor(...slaCol);
    doc.text(slaAval, pw - 10, y + 6.8, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    y += 16;

    // ── Distribuição por Status ───────────────────────────────────────────────
    y = sectionHead('DISTRIBUICAO POR STATUS', y, BLUE, LBLUE);
    const statusColorMap: Record<string, [number,number,number]> = {
      Aberto: AMBER, 'Em Andamento': TEAL, Encerrado: GREEN
    };
    const statusBgMap: Record<string, [number,number,number]> = {
      Aberto: LAMBER, 'Em Andamento': LTEAL, Encerrado: LGREEN
    };
    const statusEntries = Object.entries(d.porStatus);
    const maxS = Math.max(...statusEntries.map(([, v]) => v as number), 1);
    statusEntries.forEach(([label, val]) => {
      const sc = statusColorMap[label] ?? BLUE;
      const bg = statusBgMap[label] ?? LGRAY;
      const pct = d.totalChamados > 0 ? ((val as number) / d.totalChamados) * 100 : 0;
      y = drawBar(label, val as number, maxS, pct, y, sc, bg);
    });
    y += 4;

    // ── Distribuição por Prioridade ───────────────────────────────────────────
    y = sectionHead('DISTRIBUICAO POR PRIORIDADE', y, PURPLE, LPURPL);
    const prioColorMap: Record<string, [number,number,number]> = {
      BAIXA: [66,165,245], MEDIA: AMBER, ALTA: RED, CRITICA: [120,0,0]
    };
    const prioBgMap: Record<string, [number,number,number]> = {
      BAIXA: LBLUE, MEDIA: LAMBER, ALTA: LRED, CRITICA: [255,220,220] as [number,number,number]
    };
    const prioEntries = Object.entries(d.porPrioridade);
    const maxP = Math.max(...prioEntries.map(([, v]) => v as number), 1);
    prioEntries.forEach(([label, val]) => {
      const key = label.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const pc  = prioColorMap[key] ?? PURPLE;
      const pbg = prioBgMap[key] ?? LGRAY;
      const pct = d.totalChamados > 0 ? ((val as number) / d.totalChamados) * 100 : 0;
      y = drawBar(label, val as number, maxP, pct, y, pc, pbg);
    });

    addPageFooter();

    // ══════════════════════════════════════════════════════════════════════════
    // PÁGINA 3 — Ranking de Técnicos
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    addPageHeader('Ranking de Tecnicos');
    y = 20;
    y = sectionHead('RANKING DETALHADO DE TECNICOS', y, NAVY, LBLUE);

    const rankRows = d.tecnicosRanking.map(t => [
      t.posicao === 1 ? '1o Lugar' : t.posicao === 2 ? '2o Lugar' : t.posicao === 3 ? '3o Lugar' : `${t.posicao}o`,
      t.nome,
      String(t.totalResolvidos),
      this.formatarTempo(t.tempoMedioResolucaoMins),
      `${t.slaPercent.toFixed(1)}%`,
      t.slaPercent >= 90 ? 'Excelente' : t.slaPercent >= 70 ? 'Aceitavel' : 'Critico',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Posicao', 'Tecnico', 'Resolvidos', 'Tempo Medio', 'SLA (%)', 'Avaliacao SLA']],
      body: rankRows.length > 0 ? rankRows : [['—', 'Nenhum tecnico no periodo', '—', '—', '—', '—']],
      theme: 'striped',
      headStyles: {
        fillColor: NAVY,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
        cellPadding: 4,
      },
      bodyStyles:           { fontSize: 8, cellPadding: 3.5, textColor: DGRAY },
      alternateRowStyles:   { fillColor: LBLUE },
      columnStyles: {
        0: { halign: 'center', cellWidth: 22 },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'center', cellWidth: 26 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'center', cellWidth: 28 },
      },
      didDrawCell: (data: any) => {
        if (data.section !== 'body') return;
        const cx  = data.cell.x + data.cell.width / 2;
        const cy  = data.cell.y + data.cell.height / 2 + 1.5;
        const raw = String(data.cell.raw);

        // Coluna Posição: cor da medalha
        if (data.column.index === 0) {
          const mc: [number,number,number] =
            raw.startsWith('1') ? [218,165, 32] :
            raw.startsWith('2') ? [140,140,145] :
            raw.startsWith('3') ? [160, 82, 10] : DGRAY;
          data.doc.setTextColor(...mc);
          data.doc.setFontSize(8.5);
          data.doc.setFont('helvetica','bold');
          data.doc.text(raw, cx, cy, { align: 'center' });
          data.doc.setTextColor(0,0,0);
          data.doc.setFont('helvetica','normal');
        }

        // Coluna SLA %: cor por performance
        if (data.column.index === 4) {
          const v = parseFloat(raw);
          if (!isNaN(v)) {
            const c: [number,number,number] = v >= 90 ? GREEN : v >= 70 ? AMBER : RED;
            data.doc.setTextColor(...c);
            data.doc.setFontSize(8.5);
            data.doc.setFont('helvetica','bold');
            data.doc.text(raw, cx, cy, { align: 'center' });
            data.doc.setTextColor(0,0,0);
            data.doc.setFont('helvetica','normal');
          }
        }

        // Coluna Avaliação: badge colorido com fundo pastéis
        if (data.column.index === 5) {
          const bc: [number,number,number] = raw === 'Excelente' ? GREEN  : raw === 'Aceitavel' ? AMBER : RED;
          const bb: [number,number,number] = raw === 'Excelente' ? LGREEN : raw === 'Aceitavel' ? LAMBER : LRED;
          const tw = (data.doc.getStringUnitWidth(raw) * 8) / data.doc.internal.scaleFactor;
          const bx2 = cx - tw / 2 - 2.5;
          data.doc.setFillColor(...bb);
          data.doc.roundedRect(bx2, cy - 3.5, tw + 5, 5.5, 1, 1, 'F');
          data.doc.setTextColor(...bc);
          data.doc.setFontSize(7.5);
          data.doc.setFont('helvetica','bold');
          data.doc.text(raw, cx, cy + 0.5, { align: 'center' });
          data.doc.setTextColor(0,0,0);
          data.doc.setFont('helvetica','normal');
        }
      },
      margin: { left: 10, right: 10 },
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    // ── Categoria ─────────────────────────────────────────────────────────────
    if (y + 50 > ph - 16) { doc.addPage(); addPageHeader('Distribuicao por Categoria'); y = 20; }
    y = sectionHead('CHAMADOS POR CATEGORIA', y, TEAL, LTEAL);

    const catRows = Object.entries(d.porCategoria).map(([k, v]) => [
      k,
      String(v),
      d.totalChamados > 0 ? ((v as number / d.totalChamados) * 100).toFixed(1) + '%' : '—',
    ]);
    autoTable(doc, {
      startY: y,
      head: [['Categoria', 'Quantidade', '% do Total']],
      body: catRows.length > 0 ? catRows : [['Sem dados', '0', '0%']],
      theme: 'striped',
      headStyles:           { fillColor: TEAL, textColor: WHITE, fontStyle: 'bold', fontSize: 8.5, halign: 'center', cellPadding: 3.5 },
      bodyStyles:           { fontSize: 8, cellPadding: 3, textColor: DGRAY },
      alternateRowStyles:   { fillColor: LTEAL },
      columnStyles: { 1: { halign: 'center', cellWidth: 28 }, 2: { halign: 'center', cellWidth: 28 } },
      margin: { left: 10, right: 10 },
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    // ── Evolução Diária ───────────────────────────────────────────────────────
    if (d.evolucao && d.evolucao.length > 0) {
      if (y + 50 > ph - 16) { doc.addPage(); addPageHeader('Evolucao Diaria'); y = 20; }
      y = sectionHead('EVOLUCAO DIARIA DE CHAMADOS', y, GREEN, LGREEN);

      const evoRows = d.evolucao.map(e => {
        const tot = e.abertos + e.emAndamento + e.encerrados;
        return [e.data, String(e.abertos), String(e.emAndamento), String(e.encerrados), String(tot)];
      });
      autoTable(doc, {
        startY: y,
        head: [['Data', 'Abertos', 'Em Andamento', 'Encerrados', 'Total do Dia']],
        body: evoRows,
        theme: 'striped',
        headStyles:           { fillColor: GREEN, textColor: WHITE, fontStyle: 'bold', fontSize: 8.5, halign: 'center', cellPadding: 3.5 },
        bodyStyles:           { fontSize: 8, cellPadding: 3, textColor: DGRAY },
        alternateRowStyles:   { fillColor: LGREEN },
        columnStyles: {
          0: { halign: 'left',   cellWidth: 32 },
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center', fontStyle: 'bold' },
        },
        didDrawCell: (data: any) => {
          if (data.section !== 'body') return;
          const cx  = data.cell.x + data.cell.width / 2;
          const cy  = data.cell.y + data.cell.height / 2 + 1.5;
          const val = parseInt(String(data.cell.raw), 10);
          if (isNaN(val) || val === 0) return;
          // Abertos → âmbar
          if (data.column.index === 1 && val > 0) {
            data.doc.setTextColor(...AMBER);
            data.doc.setFont('helvetica', 'bold');
            data.doc.setFontSize(8);
            data.doc.text(String(val), cx, cy, { align: 'center' });
            data.doc.setTextColor(0,0,0); data.doc.setFont('helvetica','normal');
          }
          // Encerrados → verde
          if (data.column.index === 3 && val > 0) {
            data.doc.setTextColor(...GREEN);
            data.doc.setFont('helvetica', 'bold');
            data.doc.setFontSize(8);
            data.doc.text(String(val), cx, cy, { align: 'center' });
            data.doc.setTextColor(0,0,0); data.doc.setFont('helvetica','normal');
          }
        },
        margin: { left: 10, right: 10 },
      });
    }

    addPageFooter();
    doc.save(`HelpDesk_BI_${this.today()}.pdf`);
  }

  // ── Helpers ────────────────────────────────────────────────
  private today(): string { return this.toISODate(new Date()); }
  private defaultInicio(): string {
    const d = new Date(); d.setDate(d.getDate() - 30); return this.toISODate(d);
  }
  private toISODate(d: Date): string { return d.toISOString().split('T')[0]; }

  get categoriaEntries(): { key: string; value: number }[] {
    if (!this.dashboard) return [];
    return Object.entries(this.dashboard.porCategoria).map(([key, value]) => ({ key, value }));
  }

  get prioridadeEntries(): { key: string; value: number }[] {
    if (!this.dashboard) return [];
    return Object.entries(this.dashboard.porPrioridade).map(([key, value]) => ({ key, value }));
  }
}



