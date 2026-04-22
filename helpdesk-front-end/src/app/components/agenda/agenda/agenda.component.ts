import { Component, OnInit, OnDestroy } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { Subscription, forkJoin, interval } from 'rxjs';
import { Tarefa, PRIORIDADE_LABELS, PRIORIDADE_COLORS, STATUS_TAREFA_LABELS } from '../../../models/tarefa';
import { TarefaService } from '../../../services/tarefa.service';
import { TecnicoService } from '../../../services/tecnico.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { Tecnico } from '../../../models/tecnico';
import { TarefaFormDialogComponent, TarefaDialogData } from '../tarefa-form-dialog/tarefa-form-dialog.component';
import { AgendaWsService } from '../../../services/agenda-ws.service';
import { JwtHelperService } from '@auth0/angular-jwt';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { DeleteDialogComponent } from '../../molecules/delete/delete-dialog/delete-dialog.component';

export interface SemanaDia { data: string; label: string; tarefas: Tarefa[]; }

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

  // ── Perfil ────────────────────────────────────────────────────────────────
  tecnicoId!: number;
  isAdmin    = false;
  nomeUsuario = '';

  // ── Painel Admin ──────────────────────────────────────────────────────────
  tecnicos: Tecnico[] = [];
  tecnicoFiltroId: number | null = null;

  // ── Filtros ───────────────────────────────────────────────────────────────
  filtroBusca = '';
  filtroPrioridade: number | null = null;

  readonly opcoesItemsPorPagina = [5, 10, 20];

  // ── Paginação ─────────────────────────────────────────────────────────────
  pageSize            = 5;
  pageIndexPendentes  = 0;
  pageIndexExecucao   = 0;
  pageIndexConcluidas = 0;

  // ── Modo de visualização ──────────────────────────────────────────────────
  /** 'dia' | 'semana' | 'kanban' */
  viewMode: 'dia' | 'semana' | 'kanban' = 'dia';

  // ── Kanban (arrays mutáveis para cdkDropList) ─────────────────────────────
  kanbanPendentes:  Tarefa[] = [];
  kanbanExecucao:   Tarefa[] = [];
  kanbanConcluidas: Tarefa[] = [];

  // ── Visão semanal ─────────────────────────────────────────────────────────
  semanaDias: SemanaDia[] = [];
  carregandoSemana = false;

  // ── Timer e notificações ──────────────────────────────────────────────────
  /** Incrementado a cada minuto → força re-avaliação de tempoDecorrido() */
  tickerSegundos = 0;
  private timerSub!: Subscription;
  private notificacoesDadas = new Set<number>();

  // ── Subscrições ───────────────────────────────────────────────────────────
  private jwtHelper  = new JwtHelperService();
  private wsSub!: Subscription;
  private tecnicoSub!: Subscription;

  // ── Constantes expostas ao template ──────────────────────────────────────
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

    // Timer: atualiza contador de minutos (para tempoDecorrido) + notificações
    this.timerSub = interval(60000).subscribe(() => {
      this.tickerSegundos++;
      this.verificarNotificacoes();
    });
  }

  ngOnDestroy(): void {
    if (this.wsSub)      this.wsSub.unsubscribe();
    if (this.tecnicoSub) this.tecnicoSub.unsubscribe();
    if (this.timerSub)   this.timerSub.unsubscribe();
    this.agendaWs.disconnect();
  }

  // ── Dados filtrados ───────────────────────────────────────────────────────

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

  // ── Paginação ─────────────────────────────────────────────────────────────

  get pendentesPaginadas():  Tarefa[] { return this.paginar(this.pendentes,  this.pageIndexPendentes);  }
  get emExecucaoPaginadas(): Tarefa[] { return this.paginar(this.emExecucao, this.pageIndexExecucao);   }
  get concluidasPaginadas(): Tarefa[] { return this.paginar(this.concluidas, this.pageIndexConcluidas); }

  private paginar(lista: Tarefa[], pageIndex: number): Tarefa[] {
    const start = pageIndex * this.pageSize;
    return lista.slice(start, start + this.pageSize);
  }

  onPagePendentes(e: PageEvent):  void { this.pageSize = e.pageSize; this.pageIndexPendentes  = e.pageIndex; }
  onPageExecucao(e: PageEvent):   void { this.pageSize = e.pageSize; this.pageIndexExecucao   = e.pageIndex; }
  onPageConcluidas(e: PageEvent): void { this.pageSize = e.pageSize; this.pageIndexConcluidas = e.pageIndex; }

  resetarPaginas(): void {
    this.pageIndexPendentes  = 0;
    this.pageIndexExecucao   = 0;
    this.pageIndexConcluidas = 0;
  }

  // ── KPI Progress bars (dinâmicas) ─────────────────────────────────────────

  kpiPercent(valor: number): string {
    const total = this.tarefas.length;
    if (total === 0) return '0%';
    return Math.round((valor / total) * 100) + '%';
  }

  // ── Modo de visualização ──────────────────────────────────────────────────

  trocarModo(modo: 'dia' | 'semana' | 'kanban'): void {
    this.viewMode = modo;
    if (modo === 'semana') this.carregarSemana();
    else if (modo === 'kanban') this.syncKanban();
  }

  // ── Visão Semanal ─────────────────────────────────────────────────────────

  private getSemanaAtual(): string[] {
    const [d, m, y] = this.dataSelecionada.split('/').map(Number);
    const date = new Date(y, m - 1, d);
    const dow  = date.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(date);
    monday.setDate(date.getDate() + mondayOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return this.formatarData(d);
    });
  }

  private labelDia(data: string): string {
    const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const [d, m, y] = data.split('/').map(Number);
    return labels[new Date(y, m - 1, d).getDay()];
  }

  carregarSemana(): void {
    const dias = this.getSemanaAtual();
    this.carregandoSemana = true;

    const obs = dias.map(data => {
      let tecnicoParam: number | undefined;
      if (this.tecnicoFiltroId !== null) tecnicoParam = this.tecnicoFiltroId;
      else if (!this.isAdmin)            tecnicoParam = this.tecnicoId;
      return this.tarefaService.findAll(data, tecnicoParam);
    });

    forkJoin(obs).subscribe({
      next: (resultados) => {
        this.semanaDias = dias.map((data, i) => ({
          data,
          label: this.labelDia(data),
          tarefas: resultados[i]
        }));
        this.carregandoSemana = false;
      },
      error: () => {
        this.toastr.error('Erro ao carregar semana.');
        this.carregandoSemana = false;
      }
    });
  }

  irParaDiaDaSemana(data: string): void {
    this.dataSelecionada = data;
    this.viewMode = 'dia';
    this.carregarTarefas();
  }

  // ── Kanban Drag & Drop ────────────────────────────────────────────────────

  syncKanban(): void {
    this.kanbanPendentes  = [...this.tarefasFiltradas.filter(t => t.status === 0)];
    this.kanbanExecucao   = [...this.tarefasFiltradas.filter(t => t.status === 1)];
    this.kanbanConcluidas = [...this.tarefasFiltradas.filter(t => t.status === 2)];
  }

  onDropKanban(event: CdkDragDrop<Tarefa[]>, novoStatus: number): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }

    const tarefa = event.previousContainer.data[event.previousIndex];
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    this.tarefaService.alterarStatus(tarefa.id!, novoStatus).subscribe({
      next: () => {
        const local = this.tarefas.find(t => t.id === tarefa.id);
        if (local) local.status = novoStatus;
        const msg = novoStatus === 2 ? 'Tarefa concluída! 🎉'
                  : novoStatus === 1 ? 'Tarefa iniciada!'
                  : 'Tarefa reaberta.';
        this.toastr.success(msg);
      },
      error: () => {
        this.toastr.error('Erro ao mover tarefa.');
        this.syncKanban(); // Reverte
      }
    });
  }

  // ── Funções de enriquecimento de card ─────────────────────────────────────

  /** Retorna "Xh Ymin" de duração se ambas as horas estão preenchidas */
  duracaoTarefa(t: Tarefa): string {
    if (!t.horaInicio || !t.horaFim) return '';
    const toMin = (h: string) => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm; };
    const diff = toMin(t.horaFim) - toMin(t.horaInicio);
    if (diff <= 0) return '';
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? `${h}h${m > 0 ? ' ' + m + 'min' : ''}` : `${m}min`;
  }

  /**
   * Retorna "Xh Ymin decorrido" para tarefas em execução HOJE.
   * Depende de `tickerSegundos` para re-avaliação a cada minuto.
   */
  tempoDecorrido(t: Tarefa): string {
    if (!this.tickerSegundos && this.tickerSegundos !== 0) return '';
    if (t.status !== 1 || !t.horaInicio || t.data !== this.hoje()) return '';
    const toMin = (h: string) => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm; };
    const agora  = new Date();
    const agoraMin = agora.getHours() * 60 + agora.getMinutes();
    const diff = agoraMin - toMin(t.horaInicio);
    if (diff <= 0) return '';
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  }

  /** Verdadeiro quando a tarefa tem conflito de horário com outra do mesmo dia */
  temConflito(t: Tarefa): boolean {
    if (!t.horaInicio) return false;
    const toMin = (h: string) => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm; };
    const tIni = toMin(t.horaInicio);
    const tFim = t.horaFim ? toMin(t.horaFim) : tIni + 60;
    return this.tarefas.some(other => {
      if (other.id === t.id || !other.horaInicio) return false;
      const oIni = toMin(other.horaInicio);
      const oFim = other.horaFim ? toMin(other.horaFim) : oIni + 60;
      return tIni < oFim && tFim > oIni;
    });
  }

  // ── Notificações de tarefas próximas ──────────────────────────────────────

  private verificarNotificacoes(): void {
    if (this.dataSelecionada !== this.hoje()) return;
    const toMin   = (h: string) => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm; };
    const agora   = new Date();
    const agMin   = agora.getHours() * 60 + agora.getMinutes();

    this.pendentes.forEach(t => {
      if (!t.horaInicio || !t.id) return;
      if (this.notificacoesDadas.has(t.id)) return;
      const diff = toMin(t.horaInicio) - agMin;
      if (diff >= 0 && diff <= 15) {
        this.notificacoesDadas.add(t.id);
        this.toastr.warning(
          `"${t.titulo}" começa às ${t.horaInicio}`,
          '⏰ Tarefa em breve!',
          { timeOut: 6000, positionClass: 'toast-bottom-right' }
        );
      }
    });
  }

  // ── Ações de status ───────────────────────────────────────────────────────

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

  reabrirTarefa(tarefa: Tarefa): void {
    this.tarefaService.alterarStatus(tarefa.id!, 0).subscribe({
      next: () => { this.toastr.info('Tarefa reaberta.'); this.carregarTarefas(); },
      error: () => this.toastr.error('Erro ao reabrir tarefa.')
    });
  }

  // ── Confirm dialog para exclusão ──────────────────────────────────────────

  confirmarExclusao(tarefa: Tarefa): void {
    const ref = this.dialog.open(DeleteDialogComponent, { width: '420px' });
    ref.afterClosed().subscribe(confirmado => {
      if (!confirmado) return;
      this.tarefaService.delete(tarefa.id!).subscribe({
        next: () => { this.toastr.warning('Tarefa excluída.'); this.carregarTarefas(); },
        error: () => this.toastr.error('Erro ao excluir tarefa.')
      });
    });
  }

  // ── Exportação ────────────────────────────────────────────────────────────

  exportarCSV(): void {
    const header = ['ID', 'Título', 'Descrição', 'Data', 'Hora Início', 'Hora Fim',
                    'Prioridade', 'Status', 'Técnico', 'Chamado'];
    const rows = this.tarefasFiltradas.map(t => [
      t.id ?? '',
      `"${(t.titulo || '').replace(/"/g, '""')}"`,
      `"${(t.descricao || '').replace(/"/g, '""')}"`,
      t.data,
      t.horaInicio || '',
      t.horaFim    || '',
      this.labelPrioridade(t.prioridade),
      this.statusLabels[t.status] || '',
      t.nomeTecnico || '',
      t.chamado     || '',
    ]);
    const csv  = [header.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `agenda_${this.dataSelecionada.replace(/\//g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    this.toastr.success('CSV gerado com sucesso!');
  }

  imprimirAgenda(): void { window.print(); }

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

  get nomeTecnicoFiltro(): string {
    if (this.tecnicoFiltroId === null) return 'Todos os técnicos';
    const tec = this.tecnicos.find(t => t.id === this.tecnicoFiltroId);
    return tec ? tec.nome : '—';
  }

  get filtrosAtivos(): boolean {
    return this.filtroBusca.trim() !== '' || this.filtroPrioridade !== null;
  }

  nomeTecnicoDaTarefa(tarefa: any): string {
    if (tarefa.nomeTecnico) return tarefa.nomeTecnico;
    const tec = this.tecnicos.find(t => t.id === tarefa.tecnico);
    return tec ? tec.nome : '';
  }

  // ── Conversão de data para input[type=date] ───────────────────────────────

  toInputDate(ddMMyyyy: string): string {
    if (!ddMMyyyy || !ddMMyyyy.includes('/')) return '';
    const [d, m, y] = ddMMyyyy.split('/');
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  fromInputDate(yyyyMMdd: string): string {
    if (!yyyyMMdd || !yyyyMMdd.includes('-')) return this.dataSelecionada;
    const [y, m, d] = yyyyMMdd.split('-');
    return `${d}/${m}/${y}`;
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
    if (!novaData) return;
    this.dataSelecionada = novaData;
    this.carregarTarefas();
  }

  // ── Filtros ───────────────────────────────────────────────────────────────

  selecionarTecnico(id: number | null): void {
    this.tecnicoFiltroId = id;
    this.resetarPaginas();
    this.carregarTarefas();
  }

  limparTodosFiltros(): void {
    this.filtroBusca = '';
    this.filtroPrioridade = null;
    this.tecnicoFiltroId  = null;
    this.resetarPaginas();
    this.carregarTarefas();
  }

  onFiltroChange(): void {
    this.resetarPaginas();
    if (this.viewMode === 'kanban') this.syncKanban();
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  novaTarefa(): void {
    const idParaCriacao = (this.isAdmin && this.tecnicoFiltroId)
      ? this.tecnicoFiltroId
      : this.tecnicoId;

    const ref = this.dialog.open(TarefaFormDialogComponent, {
      data: {
        tecnicoId:    idParaCriacao,
        dataPadrao:   this.dataSelecionada,
        tarefasDoDia: this.tarefas,
        isAdmin:      this.isAdmin,
      } as TarefaDialogData,
      width: '620px', maxWidth: '98vw', maxHeight: '92vh',
      panelClass: 'dialog-no-padding', disableClose: true, autoFocus: false
    });
    ref.afterClosed().subscribe(r => { if (r) this.carregarTarefas(); });
  }

  editarTarefa(tarefa: Tarefa): void {
    const ref = this.dialog.open(TarefaFormDialogComponent, {
      data: {
        tarefa,
        tecnicoId:    tarefa.tecnico,
        tarefasDoDia: this.tarefas,
        isAdmin:      this.isAdmin,
      } as TarefaDialogData,
      width: '620px', maxWidth: '98vw', maxHeight: '92vh',
      panelClass: 'dialog-no-padding', disableClose: true, autoFocus: false
    });
    ref.afterClosed().subscribe(r => { if (r) this.carregarTarefas(); });
  }

  // ── Carregamento de dados ─────────────────────────────────────────────────

  private carregarTecnicosAtivos(): void {
    this.tecnicoService.findAllAtivos().subscribe({
      next: (lista) => { this.tecnicos = lista; },
      error: () => this.toastr.error('Erro ao carregar técnicos.')
    });
  }

  private carregarTarefas(): void {
    this.carregando = true;
    let tecnicoParam: number | undefined;
    if      (this.tecnicoFiltroId !== null) tecnicoParam = this.tecnicoFiltroId;
    else if (!this.isAdmin)                  tecnicoParam = this.tecnicoId;

    this.tarefaService.findAll(this.dataSelecionada, tecnicoParam).subscribe({
      next: (lista) => {
        this.tarefas = lista;
        this.carregando = false;
        this.syncKanban();
        this.verificarNotificacoes();
        if (this.viewMode === 'semana') this.carregarSemana();
      },
      error: () => { this.toastr.error('Erro ao carregar tarefas.'); this.carregando = false; }
    });
  }

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

        const authorities: string[] = (info.authorities || [])
          .map((a: any) => typeof a === 'string' ? a : (a?.authority ?? ''));
        this.isAdmin = authorities.includes('ROLE_ADMIN');

        if (this.isAdmin) {
          this.carregarTecnicosAtivos();
          this.tecnicoSub = this.tecnicoService.refresh$.subscribe(() => {
            this.carregarTecnicosAtivos();
            if (this.tecnicoFiltroId !== null) {
              const ainda = this.tecnicos.find(t => t.id === this.tecnicoFiltroId);
              if (!ainda) this.limparTodosFiltros();
            }
          });
        }

        this.carregarTarefas();
      },
      error: () => this.carregarTarefas()
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
