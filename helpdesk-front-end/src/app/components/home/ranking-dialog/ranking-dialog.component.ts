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
const POLL_MS = 15_000;

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

  /** Mapa nome → posição anterior no ranking */
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
    this.savePositions();
    this.ultimaAtualizacao = new Date();

    // Inicia polling em tempo real
    this.pollInterval = setInterval(() => this.refreshRanking(), POLL_MS);
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  // ── Polling ───────────────────────────────────────────────

  private refreshRanking(): void {
    this.isUpdating = true;
    const oldLeader = this.ranking.length > 0 ? this.ranking[0].nome : null;
    const oldPositions = new Map(this.posicaoAnterior);

    this.chamadoService.findAll().subscribe({
      next: (chamados) => {
        this.chamadosAtuais = chamados;
        this.buildRanking();

        // Calcula deltas de posição
        this.ranking.forEach((r, newIdx) => {
          const oldIdx = oldPositions.get(r.nome);
          if (oldIdx === undefined) {
            r.posicaoChange = null;           // técnico novo
          } else {
            r.posicaoChange = oldIdx - newIdx; // positivo = subiu, negativo = desceu
          }
        });

        this.savePositions();

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

  private savePositions(): void {
    this.posicaoAnterior.clear();
    this.ranking.forEach((r, i) => this.posicaoAnterior.set(r.nome, i));
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

    for (const c of this.chamadosAtuais) {
      const nome = (c.nomeTecnico || 'Sem técnico').trim();
      if (!map.has(nome)) {
        map.set(nome, {
          nome,
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
