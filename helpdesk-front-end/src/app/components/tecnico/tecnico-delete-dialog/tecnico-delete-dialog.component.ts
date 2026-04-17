import { Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { Tecnico } from '../../../models/tecnico';
import { ChamadoPendenteInfo, ReatribuicaoRequest, TecnicoService } from '../../../services/tecnico.service';

export interface ChamadoResumo {
  id: number;
  titulo: string;
}

export interface TransferenciaHistorico {
  nomeDestino: string;
  idDestino: number;
  qtdChamados: number;
  chamadoIds: number[];
  chamados: ChamadoResumo[];
  dataHora: Date;
  lote: number;
}

/** Registro salvo na perspectiva do técnico que RECEBEU chamados */
export interface RecebimentoRecord {
  nomeOrigem: string;
  idOrigem: number;
  qtdChamados: number;
  chamadoIds: number[];
  chamados: ChamadoResumo[];
  dataHora: Date;
  lote: number;
}

export interface TecnicoDeleteDialogData {
  tecnico: Tecnico;
  todosTecnicos: Tecnico[];
  /** Se 'transferencia', o modal age somente como painel de redistribuição, sem inativar */
  modoApenas?: 'transferencia';
}

/** Fases da dialog */
type DialogFase = 'transferencia' | 'confirmacao-inativacao' | 'sem-pendentes';

@Component({
  selector: 'app-tecnico-delete-dialog',
  templateUrl: './tecnico-delete-dialog.component.html',
  styleUrls: ['./tecnico-delete-dialog.component.css']
})
export class TecnicoDeleteDialogComponent implements OnInit {

  @ViewChild('chamadosList') chamadosListRef?: ElementRef<HTMLElement>;

  isLoading = true;
  isSubmitting = false;
  isTransferring = false;
  transferSuccess = false;
  transferQtd = 0;

  /** Aba ativa: 'transferencia' | 'historico' | 'recebidos' */
  abaAtiva: 'transferencia' | 'historico' | 'recebidos' = 'transferencia';

  /** Histórico de transferências enviadas — persistido no localStorage */
  historico: TransferenciaHistorico[] = [];
  private loteAtual = 0;

  /** Registros de chamados recebidos por este técnico — persistido no localStorage */
  recebidos: RecebimentoRecord[] = [];

  // ── Chaves localStorage ──
  private get historicoKey(): string {
    return `transfer_historico_tecnico_${this.tecnico.id}`;
  }
  private recebidosKey(tecnicoId: number): string {
    return `transfer_recebidos_tecnico_${tecnicoId}`;
  }

  // ── Carrega / salva histórico enviado ──
  private carregarHistorico(): void {
    try {
      const raw = localStorage.getItem(this.historicoKey);
      if (raw) {
        const parsed: TransferenciaHistorico[] = JSON.parse(raw);
        this.historico = parsed.map(h => ({ ...h, dataHora: new Date(h.dataHora) }));
        this.loteAtual = this.historico.length > 0
          ? Math.max(...this.historico.map(h => h.lote)) : 0;
      }
    } catch { this.historico = []; }
  }

  private salvarHistorico(): void {
    try { localStorage.setItem(this.historicoKey, JSON.stringify(this.historico)); } catch {}
  }

  limparHistorico(): void {
    localStorage.removeItem(this.historicoKey);
    this.historico = [];
    this.loteAtual = 0;
  }

  // ── Carrega / salva registros recebidos ──
  private carregarRecebidos(): void {
    try {
      const raw = localStorage.getItem(this.recebidosKey(this.tecnico.id));
      if (raw) {
        const parsed: RecebimentoRecord[] = JSON.parse(raw);
        this.recebidos = parsed.map(r => ({ ...r, dataHora: new Date(r.dataHora) }));
      }
    } catch { this.recebidos = []; }
  }

  private salvarRecebidosDestino(destinoId: number, record: RecebimentoRecord): void {
    try {
      const key = this.recebidosKey(destinoId);
      const existing: RecebimentoRecord[] = JSON.parse(localStorage.getItem(key) || '[]');
      existing.unshift(record);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch {}
  }

  limparRecebidos(): void {
    localStorage.removeItem(this.recebidosKey(this.tecnico.id));
    this.recebidos = [];
  }

  /** Total de chamados recebidos por este técnico */
  get totalRecebidos(): number {
    return this.recebidos.reduce((sum, r) => sum + r.qtdChamados, 0);
  }

  /** Origens únicas que enviaram chamados para este técnico */
  get origensUnicas(): string[] {
    return [...new Set(this.recebidos.map(r => r.nomeOrigem))];
  }

  fase: DialogFase = 'transferencia';

  chamadosPendentes: ChamadoPendenteInfo[] = [];
  tecnicosAtivos: Tecnico[] = [];

  novoTecnicoId: number | null = null;
  selectedChamadosIds: Set<number> = new Set();

  /** Total de chamados quando o modal foi aberto (para barra de progresso absoluta) */
  totalInicial = 0;

  get tecnico(): Tecnico { return this.data.tecnico; }

  /** true quando o modal foi aberto apenas para redistribuição (sem inativar) */
  get modoTransferenciaApenas(): boolean { return this.data.modoApenas === 'transferencia'; }

  get hasPendentes(): boolean { return this.chamadosPendentes.length > 0; }

  get chamadosTransferidos(): number { return this.totalInicial - this.chamadosPendentes.length; }

  get progressoPct(): number {
    if (this.totalInicial === 0) return 100;
    return Math.round((this.chamadosTransferidos / this.totalInicial) * 100);
  }

  get allSelected(): boolean {
    return this.chamadosPendentes.length > 0 &&
      this.chamadosPendentes.every(c => this.selectedChamadosIds.has(c.id));
  }

  get someSelected(): boolean {
    return this.selectedChamadosIds.size > 0 && !this.allSelected;
  }

  get canTransfer(): boolean {
    return !!this.novoTecnicoId && this.selectedChamadosIds.size > 0 && !this.isSubmitting;
  }

  get nomeNovoTecnico(): string {
    if (!this.novoTecnicoId) return '';
    return this.tecnicosAtivos.find(t => t.id === this.novoTecnicoId)?.nome ?? '';
  }

  constructor(
    public dialogRef: MatDialogRef<TecnicoDeleteDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TecnicoDeleteDialogData,
    private tecnicoService: TecnicoService,
    private toast: ToastrService
  ) {}

  ngOnInit(): void {
    this.tecnicosAtivos = (this.data.todosTecnicos || []).filter(
      t => t.id !== this.tecnico.id && t.ativo !== false
    );
    this.carregarHistorico();
    this.carregarRecebidos();
    this.carregarPendentes(true);
  }

  private carregarPendentes(primeiro = false): void {
    this.isLoading = true;
    this.tecnicoService.getChamadosPendentes(this.tecnico.id).subscribe({
      next: (pendentes) => {
        this.chamadosPendentes = pendentes;
        this.currentPage = 0;
        if (primeiro) {
          this.totalInicial = pendentes.length;
          if (pendentes.length === 0) {
            this.fase = 'sem-pendentes';
          }
          // pré-seleciona todos
          pendentes.forEach(c => this.selectedChamadosIds.add(c.id));
        } else {
          // mantém apenas IDs ainda pendentes selecionados
          const idsRestantes = new Set(pendentes.map(c => c.id));
          this.selectedChamadosIds = new Set([...this.selectedChamadosIds].filter(id => idsRestantes.has(id)));
          // se zerou → em modo transfer-only apenas fecha; caso contrário vai para confirmação
          if (pendentes.length === 0) {
            this.fase = this.modoTransferenciaApenas ? 'sem-pendentes' : 'confirmacao-inativacao';
          }
        }
        this.isLoading = false;
      },
      error: () => {
        this.toast.error('Erro ao carregar chamados pendentes', 'Erro');
        this.isLoading = false;
      }
    });
  }

  toggleAll(checked: boolean): void {
    if (checked) this.chamadosPendentes.forEach(c => this.selectedChamadosIds.add(c.id));
    else this.selectedChamadosIds.clear();
  }

  toggleChamado(id: number, checked: boolean): void {
    if (checked) this.selectedChamadosIds.add(id);
    else this.selectedChamadosIds.delete(id);
  }

  isChamadoSelected(id: number): boolean { return this.selectedChamadosIds.has(id); }

  // ── Filtro por stat card ──
  filtroAtivo: 'todos' | 'CRITICA' | 'ALTA' | 'selecionados' = 'todos';

  get chamadosFiltrados(): ChamadoPendenteInfo[] {
    switch (this.filtroAtivo) {
      case 'CRITICA':     return this.chamadosPendentes.filter(c => c.prioridade?.toUpperCase() === 'CRITICA');
      case 'ALTA':        return this.chamadosPendentes.filter(c => c.prioridade?.toUpperCase() === 'ALTA');
      case 'selecionados': return this.chamadosPendentes.filter(c => this.selectedChamadosIds.has(c.id));
      default:            return this.chamadosPendentes;
    }
  }

  setFiltro(filtro: 'todos' | 'CRITICA' | 'ALTA' | 'selecionados'): void {
    this.filtroAtivo = this.filtroAtivo === filtro ? 'todos' : filtro;
    this.currentPage = 0;
    setTimeout(() => {
      this.chamadosListRef?.nativeElement?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── Paginação ──
  readonly PAGE_SIZE = 4;
  currentPage = 0;

  get totalPages(): number {
    return Math.ceil(this.chamadosFiltrados.length / this.PAGE_SIZE);
  }

  get chamadosPaginados(): ChamadoPendenteInfo[] {
    const start = this.currentPage * this.PAGE_SIZE;
    return this.chamadosFiltrados.slice(start, start + this.PAGE_SIZE);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages) return;
    this.currentPage = page;
    // scroll automático ao topo da lista
    setTimeout(() => {
      this.chamadosListRef?.nativeElement?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  prevPage(): void { this.goToPage(this.currentPage - 1); }
  nextPage(): void { this.goToPage(this.currentPage + 1); }

  countPorPrioridade(prioridade: string): number {
    return this.chamadosPendentes.filter(
      c => c.prioridade?.toUpperCase() === prioridade.toUpperCase()
    ).length;
  }

  getPriorityClass(p: string): string {
    switch (p?.toUpperCase()) {
      case 'CRITICA': return 'priority-critica';
      case 'ALTA':    return 'priority-alta';
      case 'MEDIA':   return 'priority-media';
      default:        return 'priority-baixa';
    }
  }

  getPriorityIcon(p: string): string {
    switch (p?.toUpperCase()) {
      case 'CRITICA': return 'warning';
      case 'ALTA':    return 'priority_high';
      case 'MEDIA':   return 'remove';
      default:        return 'arrow_downward';
    }
  }

  /** Transfere os chamados selecionados (sem inativar) */
  transferir(): void {
    if (!this.canTransfer) return;
    this.isSubmitting = true;
    this.isTransferring = true;
    this.transferSuccess = false;
    this.transferQtd = this.selectedChamadosIds.size;
    const nomeDest = this.nomeNovoTecnico;
    const destId = this.novoTecnicoId!;
    const idsTransferidos = Array.from(this.selectedChamadosIds);

    // Captura título de cada chamado selecionado
    const chamadosResumo: ChamadoResumo[] = idsTransferidos.map(id => {
      const c = this.chamadosPendentes.find(p => p.id === id);
      return { id, titulo: c?.titulo ?? `Chamado #${id}` };
    });

    const request: ReatribuicaoRequest = {
      novoTecnicoId: destId,
      chamadosIds: idsTransferidos
    };
    this.tecnicoService.reatribuirChamados(this.tecnico.id, request).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.transferSuccess = true;
        const agora = new Date();

        // Registra no histórico de ENVIADOS
        this.loteAtual++;
        this.historico.unshift({
          nomeDestino: nomeDest,
          idDestino: destId,
          qtdChamados: this.transferQtd,
          chamadoIds: idsTransferidos,
          chamados: chamadosResumo,
          dataHora: agora,
          lote: this.loteAtual
        });
        this.salvarHistorico();

        // Registra no localStorage do técnico DESTINO
        this.salvarRecebidosDestino(destId, {
          nomeOrigem: this.tecnico.nome,
          idOrigem: this.tecnico.id,
          qtdChamados: this.transferQtd,
          chamadoIds: idsTransferidos,
          chamados: chamadosResumo,
          dataHora: agora,
          lote: this.loteAtual
        });

        setTimeout(() => {
          this.isTransferring = false;
          this.transferSuccess = false;
          this.novoTecnicoId = null;
          this.toast.success(
            `${this.transferQtd} chamado${this.transferQtd > 1 ? 's' : ''} transferido${this.transferQtd > 1 ? 's' : ''} com sucesso`,
            'Transferência realizada'
          );
          this.carregarPendentes(false);
        }, 1600);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.isTransferring = false;
        this.transferSuccess = false;
        this.toast.error(err?.error?.error || 'Erro ao transferir chamados', 'Erro');
      }
    });
  }

  /** Confirma a inativação do técnico (chamado apenas quando fase === 'confirmacao-inativacao' ou 'sem-pendentes') */
  confirmarInativacao(): void {
    this.isSubmitting = true;
    this.tecnicoService.inativarTecnico(this.tecnico.id).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.limparHistorico(); // limpa histórico após inativação concluída
        this.dialogRef.close({ success: true });
      },
      error: (err) => {
        this.isSubmitting = false;
        this.toast.error(err?.error?.message || 'Erro ao inativar técnico', 'Erro');
      }
    });
  }

  cancel(): void { this.dialogRef.close(null); }
}
