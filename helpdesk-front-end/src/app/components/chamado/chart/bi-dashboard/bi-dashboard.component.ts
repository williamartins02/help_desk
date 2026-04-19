import { Component, OnInit, OnDestroy, NgZone, HostListener } from '@angular/core';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { Client } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { BiService } from '../../../../services/bi.service';
import { TecnicoService } from '../../../../services/tecnico.service';
import { BiDashboard } from '../../../../models/bi-dashboard';
import { Tecnico } from '../../../../models/tecnico';
import { API_CONFIG } from '../../../../config/api.config';

@Component({
  selector: 'app-bi-dashboard',
  templateUrl: './bi-dashboard.component.html',
  styleUrls: ['./bi-dashboard.component.css']
})
export class BiDashboardComponent implements OnInit, OnDestroy {

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
    return this.filtroTecnico   !== null ||
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
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    this.tecnicoService.findAll().subscribe(t => this.tecnicos = t);
    this.carregarDados();
    this.conectarWebSocket();
  }

  ngOnDestroy(): void {
    this.desconectarWebSocket();
  }

  // ── Filtros ────────────────────────────────────────────────
  aplicarFiltros(): void { this.carregarDados(); }

  limparFiltros(): void {
    this.filtroInicio    = this.defaultInicio();
    this.filtroFim       = this.today();
    this.filtroTecnico   = null;
    this.filtroStatus    = null;
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
    const d    = this.dashboard;
    const sep  = ';';
    const now  = new Date().toLocaleString('pt-BR');
    const per  = `${this.filtroInicio} até ${this.filtroFim}`;

    const rows: string[] = [
      // ── Cabeçalho do relatório
      `"HELP DESK — Relatório de BI"`,
      `"Gerado em:${sep}${now}"`,
      `"Período analisado:${sep}${per}"`,
      `"Técnico filtrado:${sep}${this.filtroTecnico ?? 'Todos'}"`,
      '',
      // ── KPIs Gerais
      '"═══════════════════════════════════"',
      '"INDICADORES GERAIS"',
      '"═══════════════════════════════════"',
      `"Métrica${sep}Valor"`,
      `"Total de Chamados${sep}${d.totalChamados}"`,
      `"Abertos${sep}${d.totalAbertos}"`,
      `"Em Andamento${sep}${d.totalAndamento}"`,
      `"Encerrados${sep}${d.totalEncerrados}"`,
      `"Críticos Abertos${sep}${d.totalCriticos}"`,
      `"Tempo Médio de Resolução${sep}${this.formatarTempo(d.tempoMedioResolucaoMins)}"`,
      `"SLA Cumprido (%)${sep}${d.slaPercent.toFixed(1)}%"`,
      '',
      // ── Ranking de Técnicos
      '"═══════════════════════════════════"',
      '"RANKING DE TÉCNICOS"',
      '"═══════════════════════════════════"',
      `"#${sep}Técnico${sep}Chamados Resolvidos${sep}Tempo Médio${sep}SLA (%)"`,
      ...d.tecnicosRanking.map(t =>
        `"${t.posicao}${sep}${t.nome}${sep}${t.totalResolvidos}${sep}${this.formatarTempo(t.tempoMedioResolucaoMins)}${sep}${t.slaPercent.toFixed(1)}%"`
      ),
      '',
      // ── Por Categoria
      '"═══════════════════════════════════"',
      '"CHAMADOS POR CATEGORIA"',
      '"═══════════════════════════════════"',
      `"Categoria${sep}Quantidade"`,
      ...Object.entries(d.porCategoria).map(([k, v]) => `"${k}${sep}${v}"`),
      '',
      // ── Por Prioridade
      '"═══════════════════════════════════"',
      '"CHAMADOS POR PRIORIDADE"',
      '"═══════════════════════════════════"',
      `"Prioridade${sep}Quantidade"`,
      ...Object.entries(d.porPrioridade).map(([k, v]) => `"${k}${sep}${v}"`),
      '',
      // ── Evolução Diária
      '"═══════════════════════════════════"',
      '"EVOLUÇÃO DIÁRIA"',
      '"═══════════════════════════════════"',
      `"Data${sep}Abertos${sep}Em Andamento${sep}Encerrados"`,
      ...d.evolucao.map(e =>
        `"${e.data}${sep}${e.abertos}${sep}${e.emAndamento}${sep}${e.encerrados}"`
      ),
      '',
      '"Relatório gerado automaticamente pelo sistema Help Desk."',
    ];

    // BOM UTF-8 para abertura correta no Excel
    const bom  = '\uFEFF';
    const blob = new Blob([bom + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
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
    const pw  = doc.internal.pageSize.getWidth();   // 210
    const ph  = doc.internal.pageSize.getHeight();  // 297

    // ── Paleta
    const NAVY:  [number,number,number] = [15,  52, 96];
    const BLUE:  [number,number,number] = [25, 118,210];
    const GREEN: [number,number,number] = [46, 125, 50];
    const AMBER: [number,number,number] = [230,119,  0];
    const RED:   [number,number,number] = [198, 40, 40];
    const LGRAY: [number,number,number] = [245,247,250];
    const MGRAY: [number,number,number] = [189,193,198];
    const WHITE: [number,number,number] = [255,255,255];

    // ═══════════════════════════════ HELPER ════════════════════
    const addPageHeader = (pageNum: number) => {
      // faixa azul topo
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, pw, 18, 'F');
      doc.setTextColor(...WHITE);
      doc.setFontSize(8);
      doc.setFont('helvetica','bold');
      doc.text('HELP DESK — Dashboard de BI', 10, 11);
      doc.setFont('helvetica','normal');
      doc.text(`Página ${pageNum}`, pw - 10, 11, { align: 'right' });
      doc.setTextColor(0,0,0);
    };

    const addFooter = () => {
      const y = ph - 8;
      doc.setFillColor(...LGRAY);
      doc.rect(0, ph - 12, pw, 12, 'F');
      doc.setFontSize(7);
      doc.setTextColor(100,100,100);
      const now = new Date().toLocaleString('pt-BR');
      doc.text(`Gerado em: ${now}  |  Período: ${this.filtroInicio} → ${this.filtroFim}`, 10, y);
      doc.text('Help Desk © Sistema Interno', pw - 10, y, { align: 'right' });
      doc.setTextColor(0,0,0);
    };

    // ─── PÁGINA 1: Capa ─────────────────────────────────────────
    // Fundo degradê (simulado com retângulos)
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pw, ph, 'F');

    // Retângulo decorativo lateral
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, 8, ph, 'F');
    doc.setFillColor(255,255,255,0.05 as any);
    doc.rect(pw - 60, 0, 60, ph, 'F');

    // Ícone / badge
    doc.setFillColor(...BLUE);
    doc.roundedRect(pw/2 - 20, 60, 40, 40, 5, 5, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(22);
    doc.setFont('helvetica','bold');
    doc.text('HD', pw/2, 85, { align: 'center' });

    // Título
    doc.setFontSize(28);
    doc.setFont('helvetica','bold');
    doc.text('DASHBOARD DE BI', pw/2, 120, { align: 'center' });

    doc.setFontSize(13);
    doc.setFont('helvetica','normal');
    doc.setTextColor(...MGRAY);
    doc.text('Relatório Executivo — Análise de Chamados', pw/2, 132, { align: 'center' });

    // Linha divisória
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.5);
    doc.line(30, 140, pw - 30, 140);

    // Período
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    doc.text(`Período: ${this.filtroInicio}  →  ${this.filtroFim}`, pw/2, 152, { align: 'center' });

    // Data/hora
    doc.setFontSize(9);
    doc.setTextColor(...MGRAY);
    const nowStr = new Date().toLocaleString('pt-BR');
    doc.text(`Gerado em: ${nowStr}`, pw/2, 162, { align: 'center' });

    // KPIs sumários na capa (4 boxes)
    const kpis = [
      { label: 'Total',      value: String(d.totalChamados),              color: BLUE  },
      { label: 'Abertos',    value: String(d.totalAbertos),               color: AMBER },
      { label: 'Encerrados', value: String(d.totalEncerrados),            color: GREEN },
      { label: 'SLA',        value: `${d.slaPercent.toFixed(1)}%`,        color: d.slaPercent >= 70 ? GREEN : RED },
    ];
    const boxW = 35, boxH = 28, startX = (pw - (boxW * 4 + 12 * 3)) / 2, boxY = 190;
    kpis.forEach((kpi, i) => {
      const bx = startX + i * (boxW + 12);
      doc.setFillColor(...kpi.color);
      doc.roundedRect(bx, boxY, boxW, boxH, 3, 3, 'F');
      doc.setTextColor(...WHITE);
      doc.setFontSize(14);
      doc.setFont('helvetica','bold');
      doc.text(kpi.value, bx + boxW / 2, boxY + 13, { align: 'center' });
      doc.setFontSize(7);
      doc.setFont('helvetica','normal');
      doc.text(kpi.label, bx + boxW / 2, boxY + 21, { align: 'center' });
    });

    // Rodapé capa
    doc.setFontSize(8);
    doc.setTextColor(...MGRAY);
    doc.text('Documento confidencial — uso interno', pw/2, ph - 14, { align: 'center' });

    // ─── PÁGINA 2: KPIs Detalhados ──────────────────────────────
    doc.addPage();
    addPageHeader(2);

    let y = 26;

    // Seção título
    const drawSectionTitle = (title: string, yy: number): number => {
      doc.setFillColor(...BLUE);
      doc.rect(10, yy, pw - 20, 7, 'F');
      doc.setTextColor(...WHITE);
      doc.setFontSize(9);
      doc.setFont('helvetica','bold');
      doc.text(title, 14, yy + 5);
      doc.setTextColor(0,0,0);
      return yy + 10;
    };

    y = drawSectionTitle('INDICADORES GERAIS DE DESEMPENHO', y);

    // KPI cards
    const allKpis = [
      { label: 'Total de Chamados',     value: String(d.totalChamados),                 color: BLUE,  sub: 'no período' },
      { label: 'Abertos',               value: String(d.totalAbertos),                  color: AMBER, sub: 'aguardando' },
      { label: 'Em Andamento',          value: String(d.totalAndamento),                color: [245,124,0] as [number,number,number], sub: 'em execução' },
      { label: 'Encerrados',            value: String(d.totalEncerrados),               color: GREEN, sub: 'concluídos' },
      { label: 'Críticos Abertos',      value: String(d.totalCriticos),                 color: RED,   sub: 'urgente' },
      { label: 'Tempo Médio',           value: this.formatarTempo(d.tempoMedioResolucaoMins), color: [123,31,162] as [number,number,number], sub: 'resolução' },
      { label: 'SLA Cumprido',          value: `${d.slaPercent.toFixed(1)}%`,           color: d.slaPercent >= 70 ? GREEN : RED, sub: d.slaPercent >= 90 ? 'excelente' : d.slaPercent >= 70 ? 'aceitável' : 'crítico' },
    ];

    const cols = 4;
    const cw = (pw - 20) / cols;
    const ch = 22;
    allKpis.forEach((k, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = 10 + col * cw;
      const by = y + row * (ch + 4);
      doc.setFillColor(...LGRAY);
      doc.roundedRect(bx, by, cw - 2, ch, 2, 2, 'F');
      doc.setFillColor(...k.color);
      doc.rect(bx, by, 3, ch, 'F');
      doc.setTextColor(...k.color);
      doc.setFontSize(13);
      doc.setFont('helvetica','bold');
      doc.text(k.value, bx + cw / 2, by + 10, { align: 'center' });
      doc.setFontSize(7);
      doc.setFont('helvetica','bold');
      doc.setTextColor(60,60,60);
      doc.text(k.label, bx + cw / 2, by + 16, { align: 'center' });
      doc.setFontSize(6.5);
      doc.setFont('helvetica','normal');
      doc.setTextColor(140,140,140);
      doc.text(k.sub, bx + cw / 2, by + 20, { align: 'center' });
    });

    y += Math.ceil(allKpis.length / cols) * (ch + 4) + 10;

    // ── SLA progress bar
    y = drawSectionTitle('SLA — NÍVEL DE SERVIÇO', y);
    doc.setFillColor(220,220,220);
    doc.roundedRect(10, y, pw - 20, 8, 2, 2, 'F');
    const slaW = Math.max(((d.slaPercent / 100) * (pw - 20)), 4);
    const slaColor = d.slaPercent >= 90 ? GREEN : d.slaPercent >= 70 ? AMBER : RED;
    doc.setFillColor(...slaColor);
    doc.roundedRect(10, y, slaW, 8, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica','bold');
    if (slaW > 20) doc.text(`${d.slaPercent.toFixed(1)}%`, 10 + slaW / 2, y + 5.5, { align: 'center' });
    doc.setTextColor(0,0,0);
    y += 14;

    // ── Por Status
    y = drawSectionTitle('DISTRIBUIÇÃO POR STATUS', y);
    const statusEntries = Object.entries(d.porStatus);
    const maxS = Math.max(...statusEntries.map(([,v]) => v as number), 1);
    statusEntries.forEach(([label, val]) => {
      const pct = (val as number) / maxS;
      const bw  = Math.max(((pw - 70) * pct), 2);
      doc.setFontSize(8);
      doc.setTextColor(60,60,60);
      doc.text(label, 10, y + 4);
      doc.setFillColor(220,230,241);
      doc.roundedRect(55, y, pw - 65, 5.5, 1, 1, 'F');
      doc.setFillColor(...BLUE);
      doc.roundedRect(55, y, bw, 5.5, 1, 1, 'F');
      doc.setFontSize(7);
      doc.setTextColor(...BLUE);
      doc.text(String(val), pw - 8, y + 4, { align: 'right' });
      doc.setTextColor(0,0,0);
      y += 9;
    });
    y += 4;

    // ── Por Prioridade
    y = drawSectionTitle('DISTRIBUIÇÃO POR PRIORIDADE', y);
    const prioColors: Record<string, [number,number,number]> = {
      BAIXA:   [66,165,245],
      MEDIA:   [245,124,0],
      ALTA:    [239,83,80],
      CRITICA: [183,28,28],
    };
    const prioEntries = Object.entries(d.porPrioridade);
    const maxP = Math.max(...prioEntries.map(([,v]) => v as number), 1);
    prioEntries.forEach(([label, val]) => {
      const pct = (val as number) / maxP;
      const bw  = Math.max(((pw - 70) * pct), 2);
      const pc  = prioColors[label.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')] ?? BLUE;
      doc.setFontSize(8);
      doc.setTextColor(60,60,60);
      doc.text(label, 10, y + 4);
      doc.setFillColor(235,235,235);
      doc.roundedRect(55, y, pw - 65, 5.5, 1, 1, 'F');
      doc.setFillColor(...pc);
      doc.roundedRect(55, y, bw, 5.5, 1, 1, 'F');
      doc.setFontSize(7);
      doc.setTextColor(...pc);
      doc.text(String(val), pw - 8, y + 4, { align: 'right' });
      doc.setTextColor(0,0,0);
      y += 9;
    });

    addFooter();

    // ─── PÁGINA 3: Ranking de Técnicos ──────────────────────────
    doc.addPage();
    addPageHeader(3);
    y = 26;
    y = drawSectionTitle('RANKING DETALHADO DE TÉCNICOS', y);

    const rankRows = d.tecnicosRanking.map(t => [
      t.posicao === 1 ? '🥇 1º' : t.posicao === 2 ? '🥈 2º' : t.posicao === 3 ? '🥉 3º' : `#${t.posicao}`,
      t.nome,
      String(t.totalResolvidos),
      this.formatarTempo(t.tempoMedioResolucaoMins),
      `${t.slaPercent.toFixed(1)}%`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Pos.', 'Técnico', 'Resolvidos', 'Tempo Médio', 'SLA (%)']],
      body: rankRows.length > 0 ? rankRows : [['—', 'Nenhum técnico no período', '—', '—', '—']],
      theme: 'grid',
      headStyles: {
        fillColor: NAVY,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
      },
      bodyStyles: { fontSize: 8.5 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 18 },
        2: { halign: 'center', cellWidth: 25 },
        3: { halign: 'center', cellWidth: 28 },
        4: { halign: 'center', cellWidth: 22 },
      },
      alternateRowStyles: { fillColor: LGRAY },
      didDrawCell: (data: any) => {
        // Colorir célula SLA
        if (data.column.index === 4 && data.section === 'body') {
          const slaVal = parseFloat(String(data.cell.raw));
          if (!isNaN(slaVal)) {
            const c = slaVal >= 90 ? GREEN : slaVal >= 70 ? AMBER : RED;
            data.doc.setTextColor(...c);
            const x = data.cell.x + data.cell.width / 2;
            const midY = data.cell.y + data.cell.height / 2 + 1;
            data.doc.setFontSize(8.5);
            data.doc.setFont('helvetica','bold');
            data.doc.text(data.cell.raw, x, midY, { align: 'center' });
            data.doc.setTextColor(0,0,0);
            data.doc.setFont('helvetica','normal');
          }
        }
      },
      margin: { left: 10, right: 10 },
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    // ── Categorias
    if (y + 60 > ph - 20) { doc.addPage(); addPageHeader(4); y = 26; }
    y = drawSectionTitle('CHAMADOS POR CATEGORIA', y);

    const catRows = Object.entries(d.porCategoria).map(([k, v]) => [k, String(v)]);
    autoTable(doc, {
      startY: y,
      head: [['Categoria', 'Quantidade']],
      body: catRows.length > 0 ? catRows : [['Sem dados', '0']],
      theme: 'striped',
      headStyles: { fillColor: [123,31,162] as [number,number,number], textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      columnStyles: { 1: { halign: 'center', cellWidth: 30 } },
      margin: { left: 10, right: 10 },
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    // ── Evolução Diária
    if (d.evolucao && d.evolucao.length > 0) {
      if (y + 60 > ph - 20) { doc.addPage(); addPageHeader(4); y = 26; }
      y = drawSectionTitle('EVOLUÇÃO DIÁRIA DE CHAMADOS', y);

      const evoRows = d.evolucao.map(e => [e.data, String(e.abertos), String(e.emAndamento), String(e.encerrados)]);
      autoTable(doc, {
        startY: y,
        head: [['Data', 'Abertos', 'Em Andamento', 'Encerrados']],
        body: evoRows,
        theme: 'grid',
        headStyles: { fillColor: [0,137,123] as [number,number,number], textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8, halign: 'center' },
        margin: { left: 10, right: 10 },
      });
    }

    addFooter();

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



