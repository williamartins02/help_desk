import { Component, OnInit, OnDestroy, ViewChildren, QueryList } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ChamadoService } from '../../../../services/chamado.service';
import { TecnicoService } from '../../../../services/tecnico.service';
import { Chamado } from '../../../../models/chamado';
import { Tecnico } from '../../../../models/tecnico';

export interface DashboardInsight {
  icon: string;
  color: string;
  bgColor: string;
  texto: string;
  urgente: boolean;
  action?: string;
  actionLabel?: string;
}

export interface TecnicoStats {
  nome: string;
  iniciais: string;
  avatarColor: string;
  tecnicoId: number;
  abertos: number;
  andamento: number;
  total: number;
  sobrecarregado: boolean;
  pctSobreCarga: number;
}

export interface KpiCard {
  label: string;
  value: number;
  icon: string;
  colorClass: string;
  queryParam: any;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
}

@Component({
  selector: 'app-dynamic-chart',
  templateUrl: './line-chart.component.html',
  styleUrls: ['./line-chart.component.scss']
})
export class LineChartComponent implements OnInit, OnDestroy {
  @ViewChildren(BaseChartDirective) charts: QueryList<BaseChartDirective>;

  chamados: Chamado[] = [];
  tecnicos: Tecnico[] = [];
  isLoading = true;
  isRefreshing = false;
  ultimaAtualizacao: Date | null = null;
  now = new Date();

  // Period filter
  periodo: 'hoje' | '7' | '30' | 'custom' = '30';
  customStart = new FormControl('');
  customEnd   = new FormControl('');
  showCustom  = false;

  kpiCards: KpiCard[] = [];

  private AVATAR_COLORS = [
    '#1976d2','#7b1fa2','#0097a7','#388e3c','#f57c00','#c62828','#5c6bc0','#00838f'
  ];

  private reloadInterval: any;
  private refreshSub: Subscription;

  // ── 1. STATUS doughnut ────────────────────────────────────
  statusChartType: ChartType = 'doughnut';
  statusChartData: ChartData<'doughnut'> = {
    labels: ['Abertos', 'Em Andamento', 'Encerrados'],
    datasets: [{ data: [0, 0, 0], backgroundColor: ['#2196f3', '#ff9800', '#4caf50'],
      borderColor: ['#fff','#fff','#fff'], borderWidth: 3, hoverOffset: 12 }]
  };
  statusChartOptions: any = {
    responsive: true, maintainAspectRatio: false, cutout: '72%',
    animation: { animateRotate: true, animateScale: true, duration: 800 },
    plugins: {
      legend: { display: true, position: 'bottom',
        labels: { boxWidth: 12, padding: 20, color: '#546e7a', usePointStyle: true, font: { size: 12, family: "'Inter', sans-serif" } } },
      tooltip: { backgroundColor: '#1a237e', titleColor: '#fff', bodyColor: '#e8eaf6', padding: 12, cornerRadius: 8,
        callbacks: { label: (ctx: any) => `  ${ctx.label}: ${ctx.raw} chamados` } }
    },
    onClick: (_e: any, elements: any[]) => this.onStatusChartClick(elements)
  };

  // ── 2. PRIORIDADE bar ─────────────────────────────────────
  prioridadeChartType: ChartType = 'bar';
  prioridadeChartData: ChartData<'bar'> = {
    labels: ['Baixa', 'Média', 'Alta', 'Crítica'],
    datasets: [{ data: [0, 0, 0, 0],
      backgroundColor: ['rgba(76,175,80,0.85)','rgba(255,193,7,0.85)','rgba(255,87,34,0.85)','rgba(183,28,28,0.9)'],
      borderColor:     ['#4caf50','#ffc107','#ff5722','#b71c1c'],
      borderWidth: 2, borderRadius: 8, borderSkipped: false } as any]
  };
  prioridadeChartOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 700 } as any,
    scales: {
      x: { grid: { display: false }, ticks: { color: '#78909c', font: { weight: '600' } as any } },
      y: { min: 0, grid: { color: 'rgba(0,0,0,0.04)', lineWidth: 1 }, ticks: { color: '#78909c', stepSize: 1 } }
    },
    plugins: { legend: { display: false },
      tooltip: { backgroundColor: '#1a237e', titleColor: '#fff', bodyColor: '#e8eaf6', padding: 12, cornerRadius: 8,
        callbacks: { label: (ctx: any) => `  ${ctx.raw} chamados ativos` } } },
    onClick: (_e: any, elements: any[]) => this.onPrioridadeChartClick(elements)
  };

  // ── 3. SLA doughnut ───────────────────────────────────────
  slaChartType: ChartType = 'doughnut';
  slaChartData: ChartData<'doughnut'> = {
    labels: ['Dentro do Prazo', 'Em Alerta', 'Atrasado'],
    datasets: [{ data: [0, 0, 0],
      backgroundColor: ['#4caf50','#ffc107','#f44336'],
      borderColor: ['#fff','#fff','#fff'], borderWidth: 3, hoverOffset: 12 }]
  };
  slaChartOptions: any = {
    responsive: true, maintainAspectRatio: false, cutout: '72%',
    animation: { animateRotate: true, animateScale: true, duration: 800 },
    plugins: {
      legend: { display: true, position: 'bottom',
        labels: { boxWidth: 12, padding: 20, color: '#546e7a', usePointStyle: true, font: { size: 12 } } },
      tooltip: { backgroundColor: '#1a237e', titleColor: '#fff', bodyColor: '#e8eaf6', padding: 12, cornerRadius: 8,
        callbacks: { label: (ctx: any) => `  ${ctx.label}: ${ctx.raw}` } }
    },
    onClick: (_e: any, elements: any[]) => this.onSlaChartClick(elements)
  };

  // ── 4. RANKING técnicos horizontal bar ───────────────────
  tecnicoChartType: ChartType = 'bar';
  tecnicoChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  tecnicoChartOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false, indexAxis: 'y' as const,
    animation: { duration: 700 } as any,
    scales: {
      x: { min: 0, stacked: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#78909c', stepSize: 1 } },
      y: { stacked: true, grid: { display: false }, ticks: { color: '#37474f', font: { weight: '500' } as any } }
    },
    plugins: { legend: { display: true, position: 'bottom',
        labels: { boxWidth: 12, padding: 20, color: '#546e7a', usePointStyle: true, font: { size: 12 } } },
      tooltip: { backgroundColor: '#1a237e', titleColor: '#fff', bodyColor: '#e8eaf6', padding: 12, cornerRadius: 8, mode: 'index' as any } },
    onClick: (_e: any, elements: any[]) => this.onTecnicoChartClick(elements)
  };

  // ── 5. EVOLUÇÃO linha ─────────────────────────────────────
  evolucaoChartType: ChartType = 'line';
  evolucaoChartData: ChartData<'line'> = { labels: [], datasets: [] };
  evolucaoChartOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index' as any, intersect: false },
    animation: { duration: 800 } as any,
    scales: {
      x: { grid: { display: false }, ticks: { color: '#78909c', maxRotation: 0, font: { size: 11 } } },
      y: { min: 0, grid: { color: 'rgba(0,0,0,0.04)', lineWidth: 1 }, ticks: { color: '#78909c', stepSize: 1 } }
    },
    plugins: {
      legend: { display: true, position: 'bottom',
        labels: { boxWidth: 12, padding: 20, color: '#546e7a', usePointStyle: true, font: { size: 12 } } },
      tooltip: { backgroundColor: '#1a237e', titleColor: '#fff', bodyColor: '#e8eaf6', padding: 12, cornerRadius: 8 }
    },
    elements: { line: { tension: 0.4, borderWidth: 2.5 }, point: { radius: 4, hoverRadius: 7, borderWidth: 2 } }
  };

  tecnicoStats: TecnicoStats[] = [];
  insights: DashboardInsight[] = [];

  // computed stats
  get totalAtivos(): number { return this.filteredChamados().filter(c => c.status != '2').length; }
  get resolucaoPercent(): number {
    const fc = this.filteredChamados();
    return fc.length ? Math.round(fc.filter(c => c.status == '2').length / fc.length * 100) : 0;
  }
  get slaOkPercent(): number {
    const ativos = this.filteredChamados().filter(c => c.status != '2');
    if (!ativos.length) return 100;
    return Math.round(ativos.filter(c => c.statusSla === 'DENTRO_PRAZO').length / ativos.length * 100);
  }

  constructor(
    private chamadoService: ChamadoService,
    private tecnicoService: TecnicoService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDados(true);
    this.reloadInterval = setInterval(() => this.loadDados(false), 30000);
    this.refreshSub = this.chamadoService.refresh$.subscribe(() => this.loadDados(false));
  }

  ngOnDestroy(): void {
    clearInterval(this.reloadInterval);
    this.refreshSub?.unsubscribe();
  }

  loadDados(showSpinner: boolean): void {
    if (showSpinner) this.isLoading = true;
    else this.isRefreshing = true;
    forkJoin({
      chamados: this.chamadoService.findAll().pipe(catchError(() => of([]))),
      tecnicos: this.tecnicoService.findAll().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ chamados, tecnicos }) => {
        this.chamados = chamados;
        this.tecnicos = tecnicos;
        this.isLoading = false;
        this.isRefreshing = false;
        this.ultimaAtualizacao = new Date();
        this.now = new Date();
        this.buildAll();
      },
      error: () => { this.isLoading = false; this.isRefreshing = false; }
    });
  }

  setPeriodo(p: 'hoje' | '7' | '30' | 'custom'): void {
    this.periodo = p;
    this.showCustom = p === 'custom';
    if (p !== 'custom') this.buildAll();
  }

  applyCustom(): void {
    if (this.customStart.value && this.customEnd.value) this.buildAll();
  }

  filteredChamados(): Chamado[] {
    if (this.periodo === 'custom') {
      const s = this.customStart.value ? new Date(this.customStart.value) : null;
      const e = this.customEnd.value ? new Date(this.customEnd.value) : null;
      if (!s || !e) return this.chamados;
      e.setHours(23, 59, 59);
      return this.chamados.filter(c => { const d = this.parseDate(c.dataAbertura); return d && d >= s && d <= e; });
    }
    const now = new Date();
    if (this.periodo === 'hoje') {
      const today = this.toYMD(now);
      return this.chamados.filter(c => this.toYMD(this.parseDate(c.dataAbertura)) === today);
    }
    const dias = this.periodo === '7' ? 7 : 30;
    const cutoff = new Date(now); cutoff.setDate(now.getDate() - dias);
    return this.chamados.filter(c => { const d = this.parseDate(c.dataAbertura); return d && d >= cutoff; });
  }

  private buildAll(): void {
    const fc = this.filteredChamados();
    this.buildKpiCards(fc);
    this.buildStatusChart(fc);
    this.buildPrioridadeChart(fc);
    this.buildSlaChart(fc);
    this.buildTecnicoChart(fc);
    this.buildEvolucaoChart(fc);
    this.buildTecnicoStats(fc);
    this.buildInsights(fc);
    setTimeout(() => this.charts?.forEach(c => c.update()), 80);
  }

  private buildKpiCards(fc: Chamado[]): void {
    const abertos   = fc.filter(c => c.status == '0').length;
    const andamento = fc.filter(c => c.status == '1').length;
    const encerrados= fc.filter(c => c.status == '2').length;
    const atrasados = fc.filter(c => c.statusSla === 'ATRASADO' && c.status != '2').length;
    this.kpiCards = [
      { label: 'Chamados Abertos',  value: abertos,    icon: 'assignment',   colorClass: 'blue',   queryParam: { status: '0' }, trend: 'neutral', trendLabel: 'na fila' },
      { label: 'Em Andamento',      value: andamento,  icon: 'autorenew',    colorClass: 'orange', queryParam: { status: '1' }, trend: 'neutral', trendLabel: 'em execução' },
      { label: 'Encerrados',        value: encerrados, icon: 'check_circle', colorClass: 'green',  queryParam: { status: '2' }, trend: encerrados > 0 ? 'up' : 'neutral', trendLabel: `${this.resolucaoPercent}% do total` },
      { label: 'SLA Atrasado',      value: atrasados,  icon: atrasados > 0 ? 'alarm_off' : 'alarm_on', colorClass: atrasados > 0 ? 'red' : 'green', queryParam: { sla: 'ATRASADO' }, trend: atrasados > 0 ? 'down' : 'up', trendLabel: atrasados > 0 ? 'atenção necessária' : 'dentro do prazo' },
    ];
  }

  private buildStatusChart(fc: Chamado[]): void {
    this.statusChartData = {
      labels: ['Abertos', 'Em Andamento', 'Encerrados'],
      datasets: [{
        data: [fc.filter(c => c.status == '0').length, fc.filter(c => c.status == '1').length, fc.filter(c => c.status == '2').length],
        backgroundColor: ['#2196f3','#ff9800','#4caf50'],
        borderColor: ['#fff','#fff','#fff'], borderWidth: 3, hoverOffset: 12
      } as any]
    };
  }

  private buildPrioridadeChart(fc: Chamado[]): void {
    const ativos = fc.filter(c => c.status != '2');
    this.prioridadeChartData = {
      labels: ['Baixa', 'Média', 'Alta', 'Crítica'],
      datasets: [{
        data: [ativos.filter(c => c.prioridade == '0').length, ativos.filter(c => c.prioridade == '1').length,
               ativos.filter(c => c.prioridade == '2').length, ativos.filter(c => c.prioridade == '3').length],
        backgroundColor: ['rgba(76,175,80,0.85)','rgba(255,193,7,0.85)','rgba(255,87,34,0.85)','rgba(183,28,28,0.9)'],
        borderColor: ['#4caf50','#ffc107','#ff5722','#b71c1c'],
        borderWidth: 2, borderRadius: 8, borderSkipped: false
      } as any]
    };
  }

  private buildSlaChart(fc: Chamado[]): void {
    const ativos = fc.filter(c => c.status != '2');
    this.slaChartData = {
      labels: ['Dentro do Prazo', 'Em Alerta', 'Atrasado'],
      datasets: [{
        data: [ativos.filter(c => c.statusSla === 'DENTRO_PRAZO').length,
               ativos.filter(c => c.statusSla === 'ALERTA').length,
               ativos.filter(c => c.statusSla === 'ATRASADO').length],
        backgroundColor: ['#4caf50','#ffc107','#f44336'],
        borderColor: ['#fff','#fff','#fff'], borderWidth: 3, hoverOffset: 12
      } as any]
    };
  }

  private buildTecnicoChart(fc: Chamado[]): void {
    const ativos = fc.filter(c => c.status != '2');
    const map = new Map<string, { abertos: number; andamento: number }>();
    ativos.forEach(c => {
      const nome = c.nomeTecnico || 'N/A';
      if (!map.has(nome)) map.set(nome, { abertos: 0, andamento: 0 });
      const e = map.get(nome)!;
      if (c.status == '0') e.abertos++; else e.andamento++;
    });
    const sorted = Array.from(map.entries())
      .map(([nome, v]) => ({ nome, ...v, total: v.abertos + v.andamento }))
      .sort((a, b) => b.total - a.total).slice(0, 8);
    this.tecnicoChartData = {
      labels: sorted.map(t => t.nome),
      datasets: [
        { data: sorted.map(t => t.abertos),   label: 'Abertos',      backgroundColor: 'rgba(33,150,243,0.8)', borderColor: '#2196f3', borderWidth: 1.5, borderRadius: 4 } as any,
        { data: sorted.map(t => t.andamento), label: 'Em Andamento', backgroundColor: 'rgba(255,152,0,0.8)',  borderColor: '#ff9800', borderWidth: 1.5, borderRadius: 4 } as any
      ]
    };
  }

  private buildEvolucaoChart(fc: Chamado[]): void {
    const dias = this.periodo === 'hoje' ? 1 : this.periodo === '7' ? 7 : 30;
    const labels: string[] = [], abertos: number[] = [], andamento: number[] = [], encerrados: number[] = [];
    const now = new Date();
    for (let i = dias - 1; i >= 0; i--) {
      const day = new Date(now); day.setDate(now.getDate() - i);
      const key = this.toYMD(day);
      labels.push(day.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }));
      const slice = fc.filter(c => this.toYMD(this.parseDate(c.dataAbertura)) === key);
      abertos.push(slice.filter(c => c.status == '0').length);
      andamento.push(slice.filter(c => c.status == '1').length);
      encerrados.push(slice.filter(c => c.status == '2').length);
    }
    this.evolucaoChartData = {
      labels,
      datasets: [
        { data: abertos,    label: 'Abertos',      borderColor: '#2196f3', backgroundColor: 'rgba(33,150,243,0.08)',   fill: true, pointBackgroundColor: '#2196f3', pointBorderColor: '#fff' } as any,
        { data: andamento,  label: 'Em Andamento', borderColor: '#ff9800', backgroundColor: 'rgba(255,152,0,0.08)',    fill: true, pointBackgroundColor: '#ff9800', pointBorderColor: '#fff' } as any,
        { data: encerrados, label: 'Encerrados',   borderColor: '#4caf50', backgroundColor: 'rgba(76,175,80,0.08)',   fill: true, pointBackgroundColor: '#4caf50', pointBorderColor: '#fff' } as any
      ]
    };
  }

  private buildTecnicoStats(fc: Chamado[]): void {
    const ativos = fc.filter(c => c.status != '2');
    const map = new Map<string, TecnicoStats>();
    const avgTotal = ativos.length / (this.tecnicos.length || 1);
    ativos.forEach(c => {
      const nome = c.nomeTecnico || 'N/A';
      const id = typeof c.tecnico === 'number' ? c.tecnico : (c.tecnico?.id ?? 0);
      if (!map.has(nome)) {
        const idx = map.size % this.AVATAR_COLORS.length;
        map.set(nome, { nome, iniciais: this.getIniciais(nome), avatarColor: this.AVATAR_COLORS[idx],
          tecnicoId: id, abertos: 0, andamento: 0, total: 0, sobrecarregado: false, pctSobreCarga: 0 });
      }
      const e = map.get(nome)!;
      if (c.status == '0') e.abertos++; else e.andamento++;
      e.total++;
    });
    map.forEach(e => {
      e.sobrecarregado = e.total > avgTotal * 1.5 && e.total >= 3;
      e.pctSobreCarga = avgTotal > 0 ? Math.min(100, Math.round(e.total / avgTotal * 100)) : 0;
    });
    this.tecnicoStats = Array.from(map.values()).sort((a, b) => b.total - a.total);
  }

  private buildInsights(fc: Chamado[]): void {
    const list: DashboardInsight[] = [];
    const atrasados = fc.filter(c => c.statusSla === 'ATRASADO' && c.status != '2');
    const emAlerta  = fc.filter(c => c.statusSla === 'ALERTA'   && c.status != '2');
    const criticos  = fc.filter(c => c.prioridade == '3'        && c.status != '2');
    const pct = fc.length ? Math.round(fc.filter(c => c.status == '2').length / fc.length * 100) : 0;

    if (atrasados.length > 0)
      list.push({ icon: 'alarm_off', color: '#c62828', bgColor: '#ffebee', texto: `${atrasados.length} chamado(s) com SLA vencido`, urgente: true, action: 'ATRASADO', actionLabel: 'Resolver agora' });
    if (emAlerta.length > 0)
      list.push({ icon: 'timer', color: '#e65100', bgColor: '#fff3e0', texto: `${emAlerta.length} chamado(s) próximos de vencer`, urgente: false, action: 'ALERTA', actionLabel: 'Ver chamados' });
    if (criticos.length > 0)
      list.push({ icon: 'local_fire_department', color: '#b71c1c', bgColor: '#fce4ec', texto: `${criticos.length} chamado(s) com prioridade crítica`, urgente: true, actionLabel: 'Atender' });
    this.tecnicoStats.filter(t => t.sobrecarregado).forEach(t => {
      list.push({ icon: 'warning_amber', color: '#e65100', bgColor: '#fff3e0', texto: `${t.nome} sobrecarregado — ${t.total} chamados ativos`, urgente: false, actionLabel: 'Redistribuir' });
    });
    const livres = this.tecnicos.filter(tec => !this.tecnicoStats.find(s => s.nome === tec.nome));
    if (livres.length > 0)
      list.push({ icon: 'person_check', color: '#2e7d32', bgColor: '#e8f5e9', texto: `${livres.length} técnico(s) disponível(is) para novos chamados`, urgente: false });
    if (pct >= 80)
      list.push({ icon: 'trending_up', color: '#1565c0', bgColor: '#e3f2fd', texto: `Taxa de resolução em ${pct}% — excelente desempenho`, urgente: false });
    if (list.length === 0)
      list.push({ icon: 'verified', color: '#2e7d32', bgColor: '#e8f5e9', texto: 'Tudo sob controle! Nenhum problema detectado no período.', urgente: false });
    this.insights = list;
  }

  // ── KPI getters ───────────────────────────────────────────
  get kpiAbertos(): number    { return this.filteredChamados().filter(c => c.status == '0').length; }
  get kpiAndamento(): number  { return this.filteredChamados().filter(c => c.status == '1').length; }
  get kpiEncerrados(): number { return this.filteredChamados().filter(c => c.status == '2').length; }
  get kpiAtrasados(): number  { return this.filteredChamados().filter(c => c.statusSla === 'ATRASADO' && c.status != '2').length; }

  // ── Chart click handlers ──────────────────────────────────
  onStatusChartClick(elements: any[]): void {
    if (!elements.length) return;
    this.router.navigate(['/chamados'], { queryParams: { status: String(elements[0].index) } });
  }
  onPrioridadeChartClick(elements: any[]): void {
    if (!elements.length) return;
    this.router.navigate(['/chamados'], { queryParams: { prioridade: String(elements[0].index) } });
  }
  onSlaChartClick(elements: any[]): void {
    if (!elements.length) return;
    const map = ['DENTRO_PRAZO', 'ALERTA', 'ATRASADO'];
    this.router.navigate(['/chamados'], { queryParams: { sla: map[elements[0].index] } });
  }
  onTecnicoChartClick(elements: any[]): void {
    if (!elements.length) return;
    const nome = (this.tecnicoChartData.labels as string[])[elements[0].index];
    this.router.navigate(['/chamados'], { queryParams: { search: nome } });
  }

  navegarInsight(ins: DashboardInsight): void {
    if (ins.action) this.router.navigate(['/chamados'], { queryParams: { sla: ins.action } });
    else this.router.navigate(['/chamados']);
  }
  navegarChamados(queryParams: any = {}): void { this.router.navigate(['/chamados'], { queryParams }); }
  navegarNovoChamado(): void { this.router.navigate(['/chamados']); }

  private getIniciais(nome: string): string {
    const parts = nome.trim().split(' ').filter(p => p.length > 0);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length >= 3) {
      const d = parts[0].padStart(2, '0'), m = parts[1].padStart(2, '0'), rest = parts[2];
      const sepIdx = rest.indexOf(' - ');
      const y = sepIdx >= 0 ? rest.substring(0, sepIdx).trim() : rest.trim();
      const time = sepIdx >= 0 ? rest.substring(sepIdx + 3).trim() : null;
      const date = new Date(time ? `${y}-${m}-${d}T${time}:00` : `${y}-${m}-${d}T00:00:00`);
      return isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }

  private toYMD(d: Date | null): string { return d ? d.toISOString().split('T')[0] : ''; }
}
