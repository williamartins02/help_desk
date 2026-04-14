import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Chamado } from '../../../models/chamado';
import { Tecnico } from '../../../models/tecnico';
import { ChamadoService } from '../../../services/chamado.service';

export interface RankingDialogData {
  chamados: Chamado[];
  tecnicos: Tecnico[];
}

export interface TecnicoRanking {
  nome: string;
  fotoPerfil?: string;
  totalAtendidos: number;
  totalAbertos: number;
  totalEmAndamento: number;
  taxaResolucao: number;
  chamados: Chamado[];
  /** undefined = initial (sem indicador); null = novo técnico; 0 = mesma pos; +N = subiu; -N = caiu */
  posicaoChange?: number | null;
}

export interface TimelineEvento {
  icone: string;
  cor: string;
  titulo: string;
  descricao: string;
  data: string;
}

/** Intervalo de polling em milissegundos */
const POLL_MS = 10_000;

/**
 * Baseline PERMANENTE — salvo uma única vez (na 1ª abertura do sistema).
 * NUNCA é sobrescrito automaticamente. As setas são sempre calculadas em relação a ele.
 */
const BASELINE_KEY = 'helpdesk_ranking_baseline';

/**
 * Snapshot das posições mais recentes — atualizado a cada poll.
 * Usado apenas para detecção de mudança de liderança consecutiva.
 */
const CURRENT_KEY = 'helpdesk_ranking_current';

@Component({
  selector: 'app-ranking-dialog',
  templateUrl: './ranking-dialog.component.html',
  styleUrls: ['./ranking-dialog.component.css']
})
export class RankingDialogComponent implements OnInit, OnDestroy {

  ranking: TecnicoRanking[] = [];
  tecnicoSelecionado: TecnicoRanking | null = null;
  chamadoSelecionado: Chamado | null = null;
  timelineEventos: TimelineEvento[] = [];
  searchTerm = '';

  tabIndex = 0;

  /** Cópia local dos chamados — atualizada a cada poll */
  private chamadosAtuais: Chamado[] = [];

  /**
   * Baseline FIXO por sessão — carregado do localStorage ao abrir o dialog.
   * Todos os deltas são calculados sempre em relação a este snapshot.
   * Nunca é atualizado durante a sessão; só muda na próxima abertura.
   */
  private posicaoInicial = new Map<string, number>();

  /**
   * Snapshot do último poll — atualizado a cada ciclo.
   * Usado exclusivamente para detectar mudança de liderança entre dois polls consecutivos.
   */
  private posicaoAnterior = new Map<string, number>();

  /** Data/hora da última atualização bem-sucedida */
  ultimaAtualizacao: Date | null = null;

  /** Verdadeiro enquanto o poll está em andamento */
  isUpdating = false;

  /** Controla o banner de mudança de liderança */
  showLeaderChange = false;
  novoLider: string | null = null;

  private pollInterval: any;

  statusLabels: { [key: string]: string } = {
    '0': 'Aberto',
    '1': 'Em Andamento',
    '2': 'Encerrado'
  };

  prioridadeLabels: { [key: string]: string } = {
    '0': 'Baixa',
    '1': 'Média',
    '2': 'Alta',
    '3': 'Crítica'
  };

  classificacaoLabels: { [key: string]: string } = {
    '0': 'SOFTWARE',
    '1': 'HARDWARE',
    '2': 'REDE'
  };

  constructor(
    public dialogRef: MatDialogRef<RankingDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RankingDialogData,
    private chamadoService: ChamadoService
  ) {}

  ngOnInit(): void {
    this.chamadosAtuais = [...this.data.chamados];
    this.buildRanking();

    // Remove key legado de versões anteriores (evita conflito)
    try { localStorage.removeItem('helpdesk_ranking_positions'); } catch {}

    // Carrega o baseline permanente (nunca é sobrescrito)
    const baseline = this.lerStorage(BASELINE_KEY);

    if (baseline.size > 0) {
      // Baseline existente → compara posições atuais com ele → setas aparecem imediatamente
      this.posicaoInicial = baseline;
      this.calcularDeltas();
    } else {
      // PRIMEIRA VEZ no sistema → salva o baseline permanente e exibe "estável" para todos
      this.ranking.forEach((r, i) => this.posicaoInicial.set(r.nome, i));
      this.salvarStorage(BASELINE_KEY, this.posicaoInicial); // ← salvo UMA VEZ, nunca mais
      this.ranking.forEach(r => r.posicaoChange = 0);
    }

    // Inicializa snapshot "anterior" para detecção de mudança de liderança
    this.posicaoAnterior.clear();
    this.ranking.forEach((r, i) => this.posicaoAnterior.set(r.nome, i));

    // Persiste posições ATUAIS separadamente (não toca no baseline)
    this.salvarStorage(CURRENT_KEY, this.posicaoAnterior);

    this.ultimaAtualizacao = new Date();
    this.pollInterval = setInterval(() => this.refreshRanking(), POLL_MS);
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  // ── Polling ───────────────────────────────────────────────

  private refreshRanking(): void {
    this.isUpdating = true;
    const oldLeader = this.ranking.length > 0 ? this.ranking[0].nome : null;

    this.chamadoService.findAll().subscribe({
      next: (chamados) => {
        this.chamadosAtuais = chamados;
        this.buildRanking();

        // Calcula deltas SEMPRE contra o baseline permanente (acumula, nunca reseta)
        this.calcularDeltas();

        // Atualiza snapshot anterior (para detecção de liderança)
        this.posicaoAnterior.clear();
        this.ranking.forEach((r, i) => this.posicaoAnterior.set(r.nome, i));

        // Persiste posições atuais separadamente — baseline NUNCA é tocado
        this.salvarStorage(CURRENT_KEY, this.posicaoAnterior);

        // Detecta mudança de liderança
        const newLeader = this.ranking.length > 0 ? this.ranking[0].nome : null;
        if (oldLeader && newLeader && oldLeader !== newLeader) {
          this.novoLider = newLeader;
          this.showLeaderChange = true;
          setTimeout(() => { this.showLeaderChange = false; }, 7000);
        }

        this.ultimaAtualizacao = new Date();
        this.isUpdating = false;
      },
      error: () => { this.isUpdating = false; }
    });
  }

  /**
   * Calcula posicaoChange comparando posição ATUAL de cada técnico
   * com o BASELINE PERMANENTE (posicaoInicial).
   * Os deltas acumulam ao longo do tempo e nunca são resetados.
   */
  private calcularDeltas(): void {
    this.ranking.forEach((r, newIdx) => {
      const oldIdx = this.posicaoInicial.get(r.nome);
      if (oldIdx === undefined) {
        r.posicaoChange = null;             // Técnico novo (não existia no baseline)
      } else {
        r.posicaoChange = oldIdx - newIdx;  // +N = subiu, -N = caiu, 0 = estável
      }
    });
  }

  /** Salva um Map<nome, posição> no localStorage com a chave informada. */
  private salvarStorage(key: string, mapa: Map<string, number>): void {
    try {
      const obj: Record<string, number> = {};
      mapa.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem(key, JSON.stringify(obj));
    } catch { /* ignora erros de quota/privado */ }
  }

  /** Lê um Map<nome, posição> do localStorage. Retorna Map vazio se não houver dados. */
  private lerStorage(key: string): Map<string, number> {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return new Map();
      const obj = JSON.parse(raw) as Record<string, number>;
      return new Map(Object.entries(obj).map(([k, v]) => [k, Number(v)]));
    } catch {
      return new Map();
    }
  }

  // ── Computed KPIs ─────────────────────────────────────────

  get totalChamadosGeral(): number {
    return this.chamadosAtuais.length;
  }

  get totalResolvidosGeral(): number {
    return this.ranking.reduce((acc, r) => acc + r.totalAtendidos, 0);
  }

  get taxaGeralResolucao(): number {
    const total = this.ranking.reduce((acc, r) => acc + r.chamados.length, 0);
    return total > 0 ? Math.round(this.totalResolvidosGeral / total * 100) : 0;
  }

  get melhorTaxa(): number {
    if (!this.ranking.length) return 0;
    return Math.max(...this.ranking.map(r => r.taxaResolucao));
  }

  get filteredRanking(): TecnicoRanking[] {
    if (!this.searchTerm.trim()) return this.ranking;
    const term = this.searchTerm.trim().toLowerCase();
    return this.ranking.filter(r => r.nome.toLowerCase().includes(term));
  }

  get maxAtendidos(): number {
    return this.ranking.length > 0 ? this.ranking[0].totalAtendidos : 1;
  }

  /** Retorna a posição original (índice no ranking completo) de um item filtrado. */
  getOriginalIndex(item: TecnicoRanking): number {
    return this.ranking.indexOf(item);
  }

  // ── Ranking build ─────────────────────────────────────────

  private buildRanking(): void {
    const map = new Map<string, TecnicoRanking>();

    // Mapa nome normalizado → fotoPerfil para lookup eficiente
    const fotoMap = new Map<string, string>();
    for (const t of (this.data.tecnicos || [])) {
      if (t.nome && t.fotoPerfil) {
        fotoMap.set(t.nome.trim().toLowerCase(), t.fotoPerfil);
      }
    }

    for (const c of this.chamadosAtuais) {
      const nome = (c.nomeTecnico || 'Sem técnico').trim();
      if (!map.has(nome)) {
        const fotoPerfil = fotoMap.get(nome.toLowerCase());
        map.set(nome, {
          nome,
          fotoPerfil,
          totalAtendidos:   0,
          totalAbertos:     0,
          totalEmAndamento: 0,
          taxaResolucao:    0,
          chamados:         []
        });
      }
      const entry = map.get(nome)!;
      entry.chamados.push(c);
      if (c.status == '2') entry.totalAtendidos++;
      else if (c.status == '0') entry.totalAbertos++;
      else if (c.status == '1') entry.totalEmAndamento++;
    }

    this.ranking = Array.from(map.values())
      .sort((a, b) => b.totalAtendidos - a.totalAtendidos);

    for (const r of this.ranking) {
      const total = r.chamados.length;
      r.taxaResolucao = total > 0 ? Math.round(r.totalAtendidos / total * 100) : 0;
    }
  }

  // ── Helpers ───────────────────────────────────────────────

  /** Largura da barra em % relativa ao líder (0–100). */
  getBarPercent(item: TecnicoRanking): number {
    return this.maxAtendidos > 0
      ? Math.round(item.totalAtendidos / this.maxAtendidos * 100)
      : 0;
  }

  /** Gradiente dinâmico conforme a taxa de resolução. */
  getBarGradient(taxa: number): string {
    if (taxa >= 70) return 'linear-gradient(90deg, #2e7d32, #66bb6a)';
    if (taxa >= 40) return 'linear-gradient(90deg, #e65100, #ffa726)';
    return 'linear-gradient(90deg, #b71c1c, #ef5350)';
  }

  /** Cor sólida equivalente ao gradiente (para texto externo à barra). */
  getBarSolidColor(taxa: number): string {
    if (taxa >= 70) return '#2e7d32';
    if (taxa >= 40) return '#e65100';
    return '#b71c1c';
  }

  getMedalIcon(index: number): string {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return '';
  }

  getMedalClass(index: number): string {
    if (index === 0) return 'medal-gold';
    if (index === 1) return 'medal-silver';
    if (index === 2) return 'medal-bronze';
    return '';
  }

  getPerformanceLevel(taxa: number): string {
    if (taxa >= 70) return 'high';
    if (taxa >= 40) return 'medium';
    return 'low';
  }

  getDeltaAbs(change: number): number {
    return Math.abs(change);
  }

  selecionarTecnico(tecnico: TecnicoRanking, tab: number = 1): void {
    this.tecnicoSelecionado = tecnico;
    this.chamadoSelecionado = null;
    this.timelineEventos = [];
    this.tabIndex = tab;
  }

  selecionarChamado(chamado: Chamado): void {
    this.chamadoSelecionado = chamado;
    this.buildTimeline(chamado);
    this.tabIndex = 2;
  }

  private buildTimeline(c: Chamado): void {
    const eventos: TimelineEvento[] = [];

    if (c.dataAbertura) {
      eventos.push({
        icone:     'add_circle',
        cor:       '#1976d2',
        titulo:    'Chamado Aberto',
        descricao: `Aberto por ${c.nomeCliente || 'cliente'}`,
        data:      c.dataAbertura
      });
    }

    if (c.nomeTecnico) {
      eventos.push({
        icone:     'engineering',
        cor:       '#7b1fa2',
        titulo:    'Técnico Atribuído',
        descricao: `Responsável: ${c.nomeTecnico}`,
        data:      c.dataAbertura || ''
      });
    }

    if (c.status == '1' || c.status == '2') {
      eventos.push({
        icone:     'autorenew',
        cor:       '#f57c00',
        titulo:    'Em Andamento',
        descricao: `Prioridade: ${this.prioridadeLabels[c.prioridade] || c.prioridade}`,
        data:      c.dataAbertura || ''
      });
    }

    if (c.status == '2' && c.dataFechamento) {
      eventos.push({
        icone:     'check_circle',
        cor:       '#43a047',
        titulo:    'Chamado Encerrado',
        descricao: `Resolvido com sucesso`,
        data:      c.dataFechamento
      });
    }

    this.timelineEventos = eventos;
  }

  getStatusColor(status: string): string {
    if (status == '0') return '#1976d2';
    if (status == '1') return '#f57c00';
    return '#43a047';
  }

  getStatusIcon(status: string): string {
    if (status == '0') return 'add_circle_outline';
    if (status == '1') return 'autorenew';
    return 'check_circle_outline';
  }

  getPrioridadeColor(prioridade: string): string {
    if (prioridade == '3') return '#e53935';
    if (prioridade == '2') return '#fb8c00';
    if (prioridade == '1') return '#fdd835';
    return '#66bb6a';
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
