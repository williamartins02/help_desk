import { Component, OnInit, OnDestroy, NgZone, HostListener, ElementRef, ViewChild } from '@angular/core';
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
import { BiDashboard, BiFiltro, ChamadoResumo } from '../../../../models/bi-dashboard';
import { Tecnico } from '../../../../models/tecnico';
import { API_CONFIG } from '../../../../config/api.config';

/** Estrutura de tendência calculada para um KPI */
export interface KpiTrend {
  pct:       number | null;   // percentual de variação (null = sem dado anterior)
  direction: 'up' | 'down' | 'flat';
  icon:      string;           // nome do mat-icon
  color:     string;           // cor CSS do badge
}

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
  /** Nome do usuário logado — usado no rodapé do PDF */
  nomeUsuarioLogado = 'HelpDesk';

  // ── ViewChild – canvases dos gráficos ─────────────────────
  @ViewChild('barTecCanvas')        barTecCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('doughnutStatusCanvas') doughnutStatusCanvas!: ElementRef<HTMLCanvasElement>;

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
  previousDashboard: BiDashboard | null = null;
  /** Mapa de tendências calculadas para cada KPI após carga dos dados */
  kpiTrends: Record<string, KpiTrend> = {};

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
            if (info.nome) this.nomeUsuarioLogado = info.nome;

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
    const filtroAtual: BiFiltro = {
      dataInicio:  this.filtroInicio,
      dataFim:     this.filtroFim,
      tecnicoId:   this.filtroTecnico,
      status:      this.filtroStatus,
      prioridade:  this.filtroPrioridade
    };
    this.biService.getDashboard(filtroAtual).subscribe({
      next: data => {
        this.dashboard = data;
        this.isLoading = false;
        this.ultimaAtualizacao = new Date();
        this.buildCharts(data);

        // ── Busca período anterior para cálculo de tendência ──────────────────
        const prevFiltro = this.buildPreviousPeriodFiltro();
        this.biService.getDashboard(prevFiltro).subscribe({
          next:  prev  => { this.previousDashboard = prev;  this.computeAllTrends(data, prev); },
          error: ()    => { this.previousDashboard = null;  this.kpiTrends = {}; }
        });
      },
      error: () => { this.isLoading = false; }
    });
  }

  /** Monta o BiFiltro correspondente ao período imediatamente anterior (mesma duração). */
  private buildPreviousPeriodFiltro(): BiFiltro {
    const start = new Date(this.filtroInicio);
    const end   = new Date(this.filtroFim);
    const days  = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const prevEnd   = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - days + 1);
    return {
      dataInicio: this.toISODate(prevStart),
      dataFim:    this.toISODate(prevEnd),
      tecnicoId:  this.filtroTecnico,
      status:     this.filtroStatus,
      prioridade: this.filtroPrioridade
    };
  }

  /**
   * Calcula a tendência de um valor numérico em relação ao período anterior.
   * @param lowerIsBetter true para KPIs onde menor = melhor (abertos, tmr, etc.)
   */
  private computeTrend(current: number, previous: number, lowerIsBetter: boolean): KpiTrend {
    if (previous === 0 && current === 0) {
      return { pct: 0, direction: 'flat', icon: 'trending_flat', color: 'rgba(255,255,255,.65)' };
    }
    if (previous === 0) {
      // Sem referência anterior — exibe neutro
      return { pct: null, direction: 'flat', icon: 'trending_flat', color: 'rgba(255,255,255,.65)' };
    }
    const diff = current - previous;
    if (diff === 0) {
      return { pct: 0, direction: 'flat', icon: 'trending_flat', color: 'rgba(255,255,255,.65)' };
    }
    const pct       = Math.round(Math.abs(diff / previous) * 100);
    const direction = diff > 0 ? 'up' : 'down';
    const isGood    = lowerIsBetter ? diff < 0 : diff > 0;
    const color     = isGood ? '#86efac' : '#fca5a5';  // verde claro / vermelho claro
    const icon      = direction === 'up' ? 'trending_up' : 'trending_down';
    return { pct, direction, icon, color };
  }

  /** Calcula todas as tendências e armazena em kpiTrends. */
  private computeAllTrends(curr: BiDashboard, prev: BiDashboard): void {
    this.kpiTrends = {
      total:     this.computeTrend(curr.totalChamados,            prev.totalChamados,            false),
      abertos:   this.computeTrend(curr.totalAbertos,             prev.totalAbertos,             true),
      andamento: this.computeTrend(curr.totalAndamento,           prev.totalAndamento,           true),
      encerrados:this.computeTrend(curr.totalEncerrados,          prev.totalEncerrados,          false),
      criticos:  this.computeTrend(curr.totalCriticos,            prev.totalCriticos,            true),
      tmr:       this.computeTrend(curr.tempoMedioResolucaoMins,  prev.tempoMedioResolucaoMins,  true),
      sla:       this.computeTrend(curr.slaPercent,               prev.slaPercent,               false),
    };
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

  // ── Export CSV ──────────────────────────────────────────────
  exportarCSV(): void {
    if (!this.dashboard) return;
    const d = this.dashboard;
    const S = ';';
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

    const lines: string[] = [];

    // Cabeçalho da tabela
    lines.push([q('ID'), q('Título'), q('Técnico'), q('Status'), q('Cliente'), q('Prioridade'), q('SLA')].join(S));

    // Linhas de dados
    const chamados: ChamadoResumo[] = d.chamados || [];
    chamados.forEach(c => {
      lines.push([
        q(c.id),
        q(c.titulo),
        q(c.tecnico),
        q(c.status),
        q(c.cliente),
        q(c.prioridade),
        q(c.statusSla === 'NO_PRAZO' ? 'NO PRAZO' : c.statusSla === 'ATRASADO' ? 'ATRASADO' : '-')
      ].join(S));
    });

    const bom  = '\uFEFF';
    const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `relatorio_chamados_${this.today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Export PDF ──────────────────────────────────────────────
  exportarPDF(): void {
    if (!this.dashboard) return;
    const d   = this.dashboard;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw  = doc.internal.pageSize.getWidth();
    const ph  = doc.internal.pageSize.getHeight();
    const now = new Date().toLocaleString('pt-BR');

    // ── Paleta ────────────────────────────────────────────────
    const NAVY  : [number,number,number] = [13,  44,  84];
    const BLUE  : [number,number,number] = [25, 118, 210];
    const LBLUE : [number,number,number] = [227,242, 253];
    const GREEN : [number,number,number] = [46, 125,  50];
    const LGREEN: [number,number,number] = [232,245, 233];
    const AMBER : [number,number,number] = [230,119,   0];
    const LAMBER: [number,number,number] = [255,243, 224];
    const RED   : [number,number,number] = [198, 40,  40];
    const LRED  : [number,number,number] = [255,235, 238];
    const LGRAY : [number,number,number] = [245,247, 250];
    const MGRAY : [number,number,number] = [158,158, 158];
    const DGRAY : [number,number,number] = [55,  55,  55];
    const WHITE : [number,number,number] = [255,255, 255];

    let pageNum = 1;

    // ── Rodapé ────────────────────────────────────────────────
    const addFooter = () => {
      doc.setFillColor(...NAVY);
      doc.rect(0, ph - 10, pw, 10, 'F');
      doc.setFillColor(...BLUE);
      doc.rect(0, ph - 10, pw, 1.5, 'F');
      doc.setFontSize(6.5);
      doc.setTextColor(...WHITE);
      doc.setFont('helvetica', 'normal');
      doc.text(`Exportado por ${this.nomeUsuarioLogado}   |   helpdesk.com`, 12, ph - 3.5);
      doc.setFillColor(...WHITE);
      doc.roundedRect(pw - 40, ph - 8.5, 28, 6.5, 1, 1, 'F');
      doc.setFontSize(6);
      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'bold');
      doc.text('HelpDesk', pw - 26, ph - 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(...MGRAY);
      doc.text(`Página ${pageNum}`, pw / 2, ph - 3.5, { align: 'center' });
    };

    // ── Cabeçalho de página (pós-capa) ────────────────────────
    const addHeader = (title: string) => {
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, pw, 14, 'F');
      doc.setFillColor(...BLUE);
      doc.rect(0, 14, pw, 1.5, 'F');
      // mini logo
      doc.setFillColor(...BLUE);
      doc.roundedRect(8, 2.5, 10, 9, 1, 1, 'F');
      doc.setTextColor(...WHITE);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.text('HD', 13, 8, { align: 'center' });
      // título
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`HELP DESK  —  ${title}`, 22, 9.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...MGRAY);
      doc.text(`Página ${pageNum}`, pw - 10, 9.5, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    };

    // ═══════════════════════════════════════════════
    // PÁGINA 1 – RELATÓRIO PRINCIPAL
    // ═══════════════════════════════════════════════

    // ── Cabeçalho azul ────────────────────────────
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pw, 18, 'F');
    doc.setFillColor(...BLUE);
    doc.rect(0, 18, pw, 2, 'F');

    // Logo box
    doc.setFillColor(...BLUE);
    doc.roundedRect(10, 3, 18, 13, 2, 2, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Help', 19, 9, { align: 'center' });
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 220, 255);
    doc.text('DESK', 19, 13.5, { align: 'center' });

    // Título cabeçalho
    doc.setTextColor(...WHITE);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('HelpDesk  RELATÓRIO', 32, 10);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 220, 255);
    doc.text('Dashboard de Business Intelligence', 32, 15);

    // Info do usuário (canto direito)
    doc.setFontSize(6.5);
    doc.setTextColor(...WHITE);
    doc.text(this.nomeUsuarioLogado, pw - 10, 9, { align: 'right' });
    doc.setTextColor(...MGRAY);
    doc.setFontSize(6);
    doc.text('helpdesk.com', pw - 10, 14, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    // ── Título do relatório ───────────────────────
    let y = 26;
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DGRAY);
    doc.text('Relatório de Atendimento', 12, y);
    y += 5;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MGRAY);
    doc.text('Resumo dos chamados do suporte no período selecionado.', 12, y);

    // Chip período (canto direito)
    const periodoTxt = `Período: ${this.filtroInicio} → ${this.filtroFim}`;
    doc.setFillColor(...LBLUE);
    doc.roundedRect(pw - 75, 24, 63, 9, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...BLUE);
    doc.setFont('helvetica', 'bold');
    doc.text(periodoTxt, pw - 44, 29.5, { align: 'center' });
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MGRAY);
    doc.text(`Gerado em: ${now}`, pw - 10, 35.5, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    y = 42;

    // ── KPI Cards (3 cards) ───────────────────────
    const numTecnicos     = d.tecnicosRanking.length || 1;
    const chamPorAtend    = (d.totalChamados / numTecnicos).toFixed(1);
    const taxaResolucaoPct = d.totalChamados > 0
      ? ((d.totalEncerrados / d.totalChamados) * 100).toFixed(0) + '% do total'
      : '—';

    const kpiCards = [
      { icon: '⏱', label: 'Tempo Médio de Resolvido', value: this.formatarTempo(d.tempoMedioResolucaoMins), sub: 'Recém resolvidos', color: BLUE, bg: LBLUE },
      { icon: '✓', label: 'Chamados Resolvidos no Prazo', value: String(d.totalEncerrados), sub: taxaResolucaoPct, color: GREEN, bg: LGREEN },
      { icon: '👤', label: 'Chamados por Atendente', value: chamPorAtend, sub: 'chamados / técnico', color: AMBER, bg: LAMBER },
    ];

    const cardW = (pw - 24 - 2 * 4) / 3;
    const cardH = 26;
    kpiCards.forEach((k, i) => {
      const bx = 12 + i * (cardW + 4);
      const by = y;
      doc.setFillColor(...k.bg);
      doc.roundedRect(bx, by, cardW, cardH, 2.5, 2.5, 'F');
      doc.setFillColor(...k.color);
      doc.rect(bx, by, cardW, 3, 'F');
      doc.roundedRect(bx, by, cardW, 3, 2.5, 2.5, 'F');
      // valor
      doc.setTextColor(...k.color);
      doc.setFontSize(k.value.length > 6 ? 9 : 13);
      doc.setFont('helvetica', 'bold');
      doc.text(k.value, bx + cardW / 2, by + 14, { align: 'center' });
      // label
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DGRAY);
      doc.text(k.label, bx + cardW / 2, by + 19.5, { align: 'center' });
      // sub
      doc.setFontSize(5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MGRAY);
      doc.text(k.sub, bx + cardW / 2, by + 23.5, { align: 'center' });
    });
    y += cardH + 6;

    // ── Gráficos (captura de canvas) ──────────────
    const chartY   = y;
    const barW     = (pw - 24) * 0.58;
    const dnutW    = (pw - 24) * 0.38;
    const chartH   = 58;
    const barX     = 12;
    const dnutX    = 12 + barW + 4;

    // Fundo dos cards de gráfico
    doc.setFillColor(...LGRAY);
    doc.roundedRect(barX,  chartY, barW,  chartH, 2, 2, 'F');
    doc.setFillColor(...LGRAY);
    doc.roundedRect(dnutX, chartY, dnutW, chartH, 2, 2, 'F');

    // Títulos dos gráficos
    doc.setFillColor(...BLUE);
    doc.roundedRect(barX,  chartY, barW,  8, 2, 2, 'F');
    doc.rect(barX, chartY + 4, barW, 4, 'F');
    doc.setFillColor(...GREEN);
    doc.roundedRect(dnutX, chartY, dnutW, 8, 2, 2, 'F');
    doc.rect(dnutX, chartY + 4, dnutW, 4, 'F');

    doc.setTextColor(...WHITE);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('Produtividade dos Técnicos', barX + barW / 2, chartY + 5.5, { align: 'center' });
    doc.text('Chamados por Status',         dnutX + dnutW / 2, chartY + 5.5, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // Inserção das imagens dos gráficos
    try {
      if (this.barTecCanvas?.nativeElement) {
        const barImg = this.barTecCanvas.nativeElement.toDataURL('image/png');
        doc.addImage(barImg, 'PNG', barX + 2, chartY + 9, barW - 4, chartH - 11);
      } else {
        doc.setFontSize(7); doc.setTextColor(...MGRAY);
        doc.text('(gráfico não disponível)', barX + barW / 2, chartY + chartH / 2 + 5, { align: 'center' });
      }
    } catch (_) {}

    try {
      if (this.doughnutStatusCanvas?.nativeElement) {
        const dnutImg = this.doughnutStatusCanvas.nativeElement.toDataURL('image/png');
        doc.addImage(dnutImg, 'PNG', dnutX + 2, chartY + 9, dnutW - 4, chartH - 11);
      } else {
        doc.setFontSize(7); doc.setTextColor(...MGRAY);
        doc.text('(gráfico não disponível)', dnutX + dnutW / 2, chartY + chartH / 2 + 5, { align: 'center' });
      }
    } catch (_) {}

    doc.setTextColor(0, 0, 0);
    y += chartH + 6;

    // ── Lista de Chamados ─────────────────────────
    // Cabeçalho da seção
    doc.setFillColor(...NAVY);
    doc.roundedRect(12, y, pw - 24, 8, 1.5, 1.5, 'F');
    doc.rect(12, y + 4, pw - 24, 4, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Lista de Chamados', 18, y + 5.5);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 220, 255);
    const totalCh = (d.chamados || []).length;
    doc.text(`Total de ${totalCh} chamado(s) no período selecionado`, pw - 14, y + 5.5, { align: 'right' });
    y += 10;

    // Tabela de chamados via autoTable
    const chamados: ChamadoResumo[] = (d.chamados || []).slice(0, 50);
    const tableRows = chamados.map(c => [
      String(c.id),
      c.titulo.length > 30 ? c.titulo.substring(0, 28) + '…' : c.titulo,
      c.tecnico,
      c.status,
      c.prioridade,
      c.tempoResolucao,
      c.statusSla === 'NO_PRAZO' ? 'NO PRAZO' : c.statusSla === 'ATRASADO' ? 'ATRASADO' : '-',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['ID', 'Título', 'Técnico', 'Status', 'Prioridade', 'Tempo', 'SLA']],
      body: tableRows.length > 0 ? tableRows : [['—', 'Nenhum chamado no período', '—', '—', '—', '—', '—']],
      theme: 'grid',
      headStyles: {
        fillColor: NAVY, textColor: WHITE, fontStyle: 'bold',
        fontSize: 7, halign: 'center', cellPadding: 2.5,
      },
      bodyStyles: { fontSize: 6.5, cellPadding: 2, textColor: DGRAY },
      alternateRowStyles: { fillColor: LGRAY },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { cellWidth: 48 },
        2: { cellWidth: 30 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'center', cellWidth: 18 },
        6: { halign: 'center', cellWidth: 18 },
      },
      didDrawCell: (data: any) => {
        if (data.section !== 'body') return;
        const raw = String(data.cell.raw ?? '');
        const cx  = data.cell.x + data.cell.width / 2;
        const cy  = data.cell.y + data.cell.height / 2 + 1.5;

        // Status – ponto colorido
        if (data.column.index === 3) {
          const sc: [number,number,number] = raw === 'ENCERRADO' ? GREEN : raw === 'ANDAMENTO' ? BLUE : AMBER;
          const tw = (data.doc.getStringUnitWidth(raw) * 6.5) / data.doc.internal.scaleFactor;
          data.doc.setFillColor(...sc);
          data.doc.circle(cx - tw / 2 - 1.5, cy - 0.8, 1.2, 'F');
          data.doc.setTextColor(...sc);
          data.doc.setFontSize(6.5);
          data.doc.setFont('helvetica', 'bold');
          data.doc.text(raw, cx + 0.5, cy, { align: 'center' });
          data.doc.setTextColor(0, 0, 0);
          data.doc.setFont('helvetica', 'normal');
        }

        // Prioridade – badge colorido
        if (data.column.index === 4) {
          const pc: [number,number,number] = raw === 'CRITICA' ? RED : raw === 'ALTA' ? AMBER : raw === 'MEDIA' ? BLUE : GREEN;
          const pb: [number,number,number] = raw === 'CRITICA' ? LRED : raw === 'ALTA' ? LAMBER : raw === 'MEDIA' ? LBLUE : LGREEN;
          const tw2 = (data.doc.getStringUnitWidth(raw) * 6.5) / data.doc.internal.scaleFactor;
          data.doc.setFillColor(...pb);
          data.doc.roundedRect(cx - tw2 / 2 - 2, cy - 3, tw2 + 4, 5, 1, 1, 'F');
          data.doc.setTextColor(...pc);
          data.doc.setFontSize(6.5);
          data.doc.setFont('helvetica', 'bold');
          data.doc.text(raw, cx, cy + 0.5, { align: 'center' });
          data.doc.setTextColor(0, 0, 0);
          data.doc.setFont('helvetica', 'normal');
        }

        // SLA – badge colorido
        if (data.column.index === 6) {
          const sc2: [number,number,number] = raw === 'NO PRAZO' ? GREEN : raw === 'ATRASADO' ? RED : MGRAY;
          const sb2: [number,number,number] = raw === 'NO PRAZO' ? LGREEN : raw === 'ATRASADO' ? LRED : LGRAY;
          if (raw !== '-') {
            const tw3 = (data.doc.getStringUnitWidth(raw) * 6.5) / data.doc.internal.scaleFactor;
            data.doc.setFillColor(...sb2);
            data.doc.roundedRect(cx - tw3 / 2 - 2, cy - 3, tw3 + 4, 5, 1, 1, 'F');
            data.doc.setTextColor(...sc2);
            data.doc.setFontSize(6.5);
            data.doc.setFont('helvetica', 'bold');
            data.doc.text(raw, cx, cy + 0.5, { align: 'center' });
            data.doc.setTextColor(0, 0, 0);
            data.doc.setFont('helvetica', 'normal');
          }
        }
      },
      margin: { left: 12, right: 12 },
      didDrawPage: (data: any) => {
        if (data.pageNumber > 1) {
          pageNum++;
          addHeader('Lista de Chamados');
        }
        addFooter();
      },
    });

    // Rodapé da primeira página
    addFooter();

    // ── Páginas extras: KPIs + Ranking ────────────
    doc.addPage();
    pageNum++;
    addHeader('Indicadores e Ranking');
    y = 20;

    // Indicadores em tabela
    const slaCor  = d.slaPercent >= 90 ? 'Excelente' : d.slaPercent >= 70 ? 'Aceitável' : 'Crítico';
    autoTable(doc, {
      startY: y,
      head: [['Indicador', 'Valor', 'Detalhe']],
      body: [
        ['Total de Chamados',   String(d.totalChamados),                  'no período'],
        ['Abertos',            String(d.totalAbertos),                    'aguardando atendimento'],
        ['Em Andamento',       String(d.totalAndamento),                  'em execução'],
        ['Encerrados',         String(d.totalEncerrados),                 'resolvidos'],
        ['Críticos Abertos',   String(d.totalCriticos),                   'prioridade crítica'],
        ['Tempo Médio (TMR)',   this.formatarTempo(d.tempoMedioResolucaoMins), 'de resolução'],
        ['SLA Cumprido',       d.slaPercent.toFixed(1) + '%',            slaCor],
        ['Chamados/Atendente', chamPorAtend,                               `${numTecnicos} técnico(s) ativos`],
      ],
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8, halign: 'center', cellPadding: 3 },
      bodyStyles: { fontSize: 8, cellPadding: 3, textColor: DGRAY },
      alternateRowStyles: { fillColor: LGRAY },
      columnStyles: { 1: { halign: 'center', fontStyle: 'bold', cellWidth: 35 }, 2: { cellWidth: 60 } },
      margin: { left: 12, right: 12 },
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    // Ranking de Técnicos
    const rankRows = d.tecnicosRanking.map(t => [
      t.posicao === 1 ? '1o Lugar' : t.posicao === 2 ? '2o Lugar' : t.posicao === 3 ? '3o Lugar' : `${t.posicao}o`,
      t.nome,
      String(t.totalResolvidos),
      this.formatarTempo(t.tempoMedioResolucaoMins),
      `${t.slaPercent.toFixed(1)}%`,
      t.slaPercent >= 90 ? 'Excelente' : t.slaPercent >= 70 ? 'Aceitável' : 'Crítico',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Posição', 'Técnico', 'Resolvidos', 'Tempo Médio', 'SLA (%)', 'Avaliação']],
      body: rankRows.length > 0 ? rankRows : [['—', 'Nenhum técnico', '—', '—', '—', '—']],
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8, halign: 'center', cellPadding: 3.5 },
      bodyStyles: { fontSize: 8, cellPadding: 3, textColor: DGRAY },
      alternateRowStyles: { fillColor: LBLUE },
      columnStyles: {
        0: { halign: 'center', cellWidth: 22 },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'center', cellWidth: 28 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'center', cellWidth: 26 },
      },
      didDrawCell: (data: any) => {
        if (data.section !== 'body') return;
        const cx  = data.cell.x + data.cell.width / 2;
        const cy  = data.cell.y + data.cell.height / 2 + 1.5;
        const raw = String(data.cell.raw ?? '');
        if (data.column.index === 4) {
          const v = parseFloat(raw);
          if (!isNaN(v)) {
            const c: [number,number,number] = v >= 90 ? GREEN : v >= 70 ? AMBER : RED;
            data.doc.setTextColor(...c);
            data.doc.setFontSize(8.5);
            data.doc.setFont('helvetica', 'bold');
            data.doc.text(raw, cx, cy, { align: 'center' });
            data.doc.setTextColor(0,0,0);
            data.doc.setFont('helvetica', 'normal');
          }
        }
        if (data.column.index === 5) {
          const bc: [number,number,number] = raw === 'Excelente' ? GREEN : raw === 'Aceitável' ? AMBER : RED;
          const bb: [number,number,number] = raw === 'Excelente' ? LGREEN : raw === 'Aceitável' ? LAMBER : LRED;
          const tw = (data.doc.getStringUnitWidth(raw) * 8) / data.doc.internal.scaleFactor;
          data.doc.setFillColor(...bb);
          data.doc.roundedRect(cx - tw / 2 - 2.5, cy - 3.5, tw + 5, 5.5, 1, 1, 'F');
          data.doc.setTextColor(...bc);
          data.doc.setFontSize(7.5);
          data.doc.setFont('helvetica', 'bold');
          data.doc.text(raw, cx, cy + 0.5, { align: 'center' });
          data.doc.setTextColor(0,0,0);
          data.doc.setFont('helvetica', 'normal');
        }
      },
      margin: { left: 12, right: 12 },
    });

    addFooter();
    doc.save(`HelpDesk_Relatorio_${this.today()}.pdf`);
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


