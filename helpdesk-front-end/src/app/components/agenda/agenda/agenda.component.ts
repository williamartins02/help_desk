import { Component, OnInit, OnDestroy } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { Tarefa, PRIORIDADE_LABELS, PRIORIDADE_COLORS, STATUS_TAREFA_LABELS } from '../../../models/tarefa';
import { TarefaService } from '../../../services/tarefa.service';
import { TecnicoService } from '../../../services/tecnico.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { Tecnico } from '../../../models/tecnico';
import { TarefaFormDialogComponent, TarefaDialogData } from '../tarefa-form-dialog/tarefa-form-dialog.component';
import { AgendaWsService } from '../../../services/agenda-ws.service';
import { JwtHelperService } from '@auth0/angular-jwt';

/**
 * Componente principal da Agenda de Tarefas.
 *
 * Comportamento por perfil:
 *  - TÉCNICO  → vê e interage apenas com as próprias tarefas.
 *  - ADMIN    → painel de gestão com filtro por técnico, visão geral
 *               e visão individual. Ações de Iniciar/Concluir ficam
 *               disponíveis para facilitar a gestão operacional.
 */
@Component({
  selector: 'app-agenda',
  templateUrl: './agenda.component.html',
  styleUrls: ['./agenda.component.css']
})
export class AgendaComponent implements OnInit, OnDestroy {

  // ── Estado geral ──────────────────────────────────────────────────────────

  dataSelecionada: string = this.hoje();
  tarefas: Tarefa[]       = [];
  carregando              = false;

  // ── Perfil do usuário logado ──────────────────────────────────────────────

  /** ID do usuário autenticado extraído do JWT */
  tecnicoId!: number;
  /** true quando o perfil é ADMIN ou ADMIN_TECNICO */
  isAdmin    = false;
  /** Nome do usuário logado (exibido no subtítulo quando perfil é TÉCNICO) */
  nomeUsuario = '';

  // ── Painel Admin: filtro de técnicos ─────────────────────────────────────

  /** Lista de todos os técnicos carregada para o select do Admin */
  tecnicos: Tecnico[] = [];
  /**
   * ID do técnico selecionado no filtro Admin.
   * null = visão geral (todos os técnicos).
   */
  tecnicoFiltroId: number | null = null;

  // ── Filtros adicionais ────────────────────────────────────────────────────

  /** Texto de busca livre (título ou nº do chamado) */
  filtroBusca = '';
  /** Prioridade selecionada: null = todas */
  filtroPrioridade: number | null = null;

  readonly opcoesItemsPorPagina = [5, 10, 20];

  // ── Paginação por aba ─────────────────────────────────────────────────────

  pageSize           = 5;   // alinhado com opcoesItemsPorPagina[0]
  pageIndexPendentes = 0;
  pageIndexExecucao  = 0;
  pageIndexConcluidas = 0;

  // ── JWT / WebSocket ───────────────────────────────────────────────────────

  private jwtHelper  = new JwtHelperService();
  private wsSub!: Subscription;
  /** Escuta atualizações no cadastro de técnicos (ativar/inativar) */
  private tecnicoSub!: Subscription;

  // ── Expostos para o template ──────────────────────────────────────────────

  readonly prioridadeLabels = PRIORIDADE_LABELS;
  readonly prioridadeColors = PRIORIDADE_COLORS;
  readonly statusLabels     = STATUS_TAREFA_LABELS;

  readonly opcoesPrioridade = [
    { valor: 0, label: 'Baixa' },
    { valor: 1, label: 'Média' },
    { valor: 2, label: 'Alta'  },
  ];

  constructor(
    private tarefaService: TarefaService,
    private tecnicoService: TecnicoService,
    private authService: AuthenticationService,
    private dialog: MatDialog,
    private toastr: ToastrService,
    private agendaWs: AgendaWsService
  ) {}

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.lerPerfil();

    // WebSocket: sincroniza quando Chamado é atualizado na Central
    this.agendaWs.connect();
    this.wsSub = this.agendaWs.chamadoAtualizado$.subscribe(evento => {
      this.carregarTarefas();
      const statusLabel: Record<number, string> = { 0: 'Aberto', 1: 'Em Andamento', 2: 'Encerrado' };
      this.toastr.info(
        `Chamado #${evento.entityId} → ${statusLabel[evento.novoStatus] ?? ''}`,
        '🔄 Agenda sincronizada',
        { timeOut: 3000, positionClass: 'toast-bottom-right' }
      );
    });
  }

  ngOnDestroy(): void {
    if (this.wsSub)      this.wsSub.unsubscribe();
    if (this.tecnicoSub) this.tecnicoSub.unsubscribe();
    this.agendaWs.disconnect();
  }

  // ── Dados filtrados ───────────────────────────────────────────────────────

  /** Aplica busca livre (título/chamado) + filtro de prioridade */
  get tarefasFiltradas(): Tarefa[] {
    const busca = this.filtroBusca.trim().toLowerCase();
    return this.tarefas.filter(t => {
      const passaBusca = !busca || (
        t.titulo?.toLowerCase().includes(busca) ||
        String(t.chamado ?? '').includes(busca)
      );
      const passaPrioridade = this.filtroPrioridade === null || t.prioridade === this.filtroPrioridade;
      return passaBusca && passaPrioridade;
    });
  }

  get pendentes():  Tarefa[] { return this.tarefasFiltradas.filter(t => t.status === 0); }
  get emExecucao(): Tarefa[] { return this.tarefasFiltradas.filter(t => t.status === 1); }
  get concluidas(): Tarefa[] { return this.tarefasFiltradas.filter(t => t.status === 2); }

  // ── Dados paginados ───────────────────────────────────────────────────────

  get pendentesPaginadas():   Tarefa[] { return this.paginar(this.pendentes,  this.pageIndexPendentes);  }
  get emExecucaoPaginadas():  Tarefa[] { return this.paginar(this.emExecucao, this.pageIndexExecucao);   }
  get concluidasPaginadas():  Tarefa[] { return this.paginar(this.concluidas, this.pageIndexConcluidas); }

  private paginar(lista: Tarefa[], pageIndex: number): Tarefa[] {
    const start = pageIndex * this.pageSize;
    return lista.slice(start, start + this.pageSize);
  }

  onPagePendentes(e: PageEvent):   void { this.pageSize = e.pageSize; this.pageIndexPendentes  = e.pageIndex; }
  onPageExecucao(e: PageEvent):    void { this.pageSize = e.pageSize; this.pageIndexExecucao   = e.pageIndex; }
  onPageConcluidas(e: PageEvent):  void { this.pageSize = e.pageSize; this.pageIndexConcluidas = e.pageIndex; }

  /** Reseta índices de página quando filtros mudam */
  resetarPaginas(): void {
    this.pageIndexPendentes  = 0;
    this.pageIndexExecucao   = 0;
    this.pageIndexConcluidas = 0;
  }

  // ── Getters auxiliares ───────────────────────────────────────────────────

  /** Nome do técnico selecionado no filtro (Admin) */
  get nomeTecnicoFiltro(): string {
    if (this.tecnicoFiltroId === null) return 'Todos os técnicos';
    const tec = this.tecnicos.find(t => t.id === this.tecnicoFiltroId);
    return tec ? tec.nome : '—';
  }

  get filtrosAtivos(): boolean {
    return this.filtroBusca.trim() !== '' || this.filtroPrioridade !== null;
  }

  /** Retorna o nome do técnico de uma tarefa */
  nomeTecnicoDaTarefa(tarefa: any): string {
    if (tarefa.nomeTecnico) return tarefa.nomeTecnico;
    const tec = this.tecnicos.find(t => t.id === tarefa.tecnico);
    return tec ? tec.nome : '';
  }

  // ── Navegação de datas ────────────────────────────────────────────────────

  irParaHoje(): void {
    this.dataSelecionada = this.hoje();
    this.carregarTarefas();
  }

  proximoDia(): void {
    this.dataSelecionada = this.deslocarData(this.dataSelecionada, 1);
    this.carregarTarefas();
  }

  diaAnterior(): void {
    this.dataSelecionada = this.deslocarData(this.dataSelecionada, -1);
    this.carregarTarefas();
  }

  onDataChange(novaData: string): void {
    this.dataSelecionada = novaData;
    this.carregarTarefas();
  }

  // ── Filtro de técnico (Admin) ─────────────────────────────────────────────

  selecionarTecnico(id: number | null): void {
    this.tecnicoFiltroId = id;
    this.resetarPaginas();
    this.carregarTarefas();
  }

  limparTodosFiltros(): void {
    this.filtroBusca = '';
    this.filtroPrioridade = null;
    this.tecnicoFiltroId = null;
    this.resetarPaginas();
    this.carregarTarefas();
  }

  onFiltroChange(): void { this.resetarPaginas(); }

  // ── CRUD de tarefas ───────────────────────────────────────────────────────

  novaTarefa(): void {
    // Admin criando tarefa: usa o técnico do filtro (se selecionado) ou o próprio ID
    const idParaCriacao = (this.isAdmin && this.tecnicoFiltroId)
      ? this.tecnicoFiltroId
      : this.tecnicoId;

    const ref = this.dialog.open(TarefaFormDialogComponent, {
      data: {
        tecnicoId:    idParaCriacao,
        dataPadrao:   this.dataSelecionada,   // pré-preenche a data selecionada na agenda
        tarefasDoDia: this.tarefas,           // usado para detectar conflitos de horário
        isAdmin:      this.isAdmin,           // carrega todos os chamados quando admin
      } as TarefaDialogData,
      width: '620px', maxWidth: '98vw',
      panelClass: 'dialog-no-padding', disableClose: true
    });
    ref.afterClosed().subscribe(r => { if (r) this.carregarTarefas(); });
  }

  editarTarefa(tarefa: Tarefa): void {
    const ref = this.dialog.open(TarefaFormDialogComponent, {
      data: {
        tarefa,
        tecnicoId:    tarefa.tecnico,
        tarefasDoDia: this.tarefas,   // mantém detecção de conflitos na edição
        isAdmin:      this.isAdmin,
      } as TarefaDialogData,
      width: '620px', maxWidth: '98vw',
      panelClass: 'dialog-no-padding', disableClose: true
    });
    ref.afterClosed().subscribe(r => { if (r) this.carregarTarefas(); });
  }

  iniciarTarefa(tarefa: Tarefa): void {
    this.tarefaService.alterarStatus(tarefa.id!, 1).subscribe({
      next: () => { this.toastr.info('Tarefa iniciada!'); this.carregarTarefas(); },
      error: () => this.toastr.error('Erro ao iniciar tarefa.')
    });
  }

  concluirTarefa(tarefa: Tarefa): void {
    this.tarefaService.alterarStatus(tarefa.id!, 2).subscribe({
      next: () => { this.toastr.success('Tarefa concluída! 🎉'); this.carregarTarefas(); },
      error: () => this.toastr.error('Erro ao concluir tarefa.')
    });
  }

  excluirTarefa(tarefa: Tarefa): void {
    if (!confirm(`Excluir a tarefa "${tarefa.titulo}"?`)) return;
    this.tarefaService.delete(tarefa.id!).subscribe({
      next: () => { this.toastr.warning('Tarefa excluída.'); this.carregarTarefas(); },
      error: () => this.toastr.error('Erro ao excluir tarefa.')
    });
  }

  // ── Auxiliares de template ────────────────────────────────────────────────

  corPrioridade(codigo: number): string  { return this.prioridadeColors[codigo] ?? '#757575'; }
  labelPrioridade(codigo: number): string { return this.prioridadeLabels[codigo] ?? '—'; }

  dataFormatada(): string {
    const hoje   = this.hoje();
    const ontem  = this.deslocarData(hoje, -1);
    const amanha = this.deslocarData(hoje, 1);
    if (this.dataSelecionada === hoje)   return `📅 Hoje — ${this.dataSelecionada}`;
    if (this.dataSelecionada === ontem)  return `📅 Ontem — ${this.dataSelecionada}`;
    if (this.dataSelecionada === amanha) return `📅 Amanhã — ${this.dataSelecionada}`;
    return `📅 ${this.dataSelecionada}`;
  }

  // ── Carregamento de dados ─────────────────────────────────────────────────

  /** Recarrega lista de técnicos ativos (chamado no init e ao detectar mudança via refresh$) */
  private carregarTecnicosAtivos(): void {
    this.tecnicoService.findAllAtivos().subscribe({
      next: (lista) => { this.tecnicos = lista; },
      error: () => this.toastr.error('Erro ao carregar técnicos.')
    });
  }

  private carregarTarefas(): void {
    this.carregando = true;

    let tecnicoParam: number | undefined;

    if (this.tecnicoFiltroId !== null) {
      // Técnico selecionado no filtro → sempre respeita a seleção
      tecnicoParam = this.tecnicoFiltroId;
    } else if (!this.isAdmin) {
      // Não-admin sem seleção → exibe apenas as próprias tarefas
      tecnicoParam = this.tecnicoId;
    }
    // Admin sem seleção → undefined → backend retorna todos

    this.tarefaService.findAll(this.dataSelecionada, tecnicoParam).subscribe({
      next: (lista) => { this.tarefas = lista; this.carregando = false; },
      error: () => { this.toastr.error('Erro ao carregar tarefas.'); this.carregando = false; }
    });
  }

  /** Lê perfil, ID e nome via API — mesmo padrão do report-param */
  private lerPerfil(): void {
    const token = localStorage.getItem('token');
    if (!token) { this.carregarTarefas(); return; }

    const decoded = this.jwtHelper.decodeToken(token);
    const email: string = decoded?.sub ?? '';
    if (!email) { this.carregarTarefas(); return; }

    this.authService.getUserInfo(email).subscribe({
      next: (info: any) => {
        this.tecnicoId   = info.id   ?? 0;
        this.nomeUsuario = info.nome ?? '';

        // Extrai authorities no mesmo formato que report-param
        const authorities: string[] = (info.authorities || [])
          .map((a: any) => typeof a === 'string' ? a : (a?.authority ?? ''));

        // isAdmin = tem ROLE_ADMIN (inclui usuários ADMIN+TECNICO)
        // Técnico puro = tem ROLE_TECNICO mas NÃO tem ROLE_ADMIN
        this.isAdmin = authorities.includes('ROLE_ADMIN');

        // Admin carrega apenas técnicos ATIVOS para o select de filtro
        // (técnicos inativados na tela de Equipe Técnica não aparecem aqui)
        if (this.isAdmin) {
          this.carregarTecnicosAtivos();

          // Atualiza a lista automaticamente quando um técnico é ativado ou inativado
          this.tecnicoSub = this.tecnicoService.refresh$.subscribe(() => {
            this.carregarTecnicosAtivos();
            // Se o técnico selecionado foi inativado, limpa o filtro
            if (this.tecnicoFiltroId !== null) {
              const ainda = this.tecnicos.find(t => t.id === this.tecnicoFiltroId);
              if (!ainda) { this.limparTodosFiltros(); }
            }
          });
        }

        this.carregarTarefas();
      },
      error: () => {
        // Fallback: sem perfil detectado, carrega as próprias tarefas
        this.carregarTarefas();
      }
    });
  }

  private hoje(): string { return this.formatarData(new Date()); }

  private deslocarData(dataStr: string, dias: number): string {
    const [d, m, y] = dataStr.split('/').map(Number);
    const data = new Date(y, m - 1, d);
    data.setDate(data.getDate() + dias);
    return this.formatarData(data);
  }

  private formatarData(date: Date): string {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  }
}
