import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Subscription } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { ChamadoService } from 'src/app/services/chamado.service';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { AgendaWsService } from 'src/app/services/agenda-ws.service';
import { TecnicoService } from 'src/app/services/tecnico.service';
import { Chamado } from 'src/app/models/chamado';
import { Tecnico } from 'src/app/models/tecnico';
import { ChamadoUpdateComponent } from '../chamado-update/chamado-update.component';
import { ChamadoReadComponent } from '../chamado-read/chamado-read.component';
import { ChamadoCreateComponent } from '../chamado-create/chamado-create.component';

@Component({
  selector: 'app-kanban',
  templateUrl: './kanban.component.html',
  styleUrls: ['./kanban.component.css']
})
export class KanbanComponent implements OnInit, OnDestroy {

  // ── Perfil do usuário logado (resolvido via server authorities) ───────────
  /** true → ROLE_ADMIN: vê dropdown de técnico + todos os chamados            */
  isAdmin   = false;
  /** true → ROLE_TECNICO sem ROLE_ADMIN: vê só busca + apenas próprios chamados */
  isTecnico = false;
  /** ID do usuário logado — usado para filtrar chamados do técnico             */
  usuarioId: number | null = null;

  colAberto: Chamado[]    = [];
  colAndamento: Chamado[] = [];
  colEncerrado: Chamado[] = [];

  // ── Filter state ──────────────────────────────────────────────────────────
  tecnicos: Tecnico[]              = [];
  selectedTecnicoId: number | null = null;
  searchQuery                      = '';

  // ── Computed getters para as colunas filtradas ───────────────────────────
  get filteredAberto(): Chamado[]    { return this.applySearch(this.colAberto); }
  get filteredAndamento(): Chamado[] { return this.applySearch(this.colAndamento); }
  get filteredEncerrado(): Chamado[] { return this.applySearch(this.colEncerrado); }

  get totalFiltered(): number {
    return this.filteredAberto.length + this.filteredAndamento.length + this.filteredEncerrado.length;
  }

  isLoading  = false;
  profileReady = false;   // true após resolver o perfil do usuário
  lastUpdated: Date = new Date();

  /** IDs de chamados recém-criados/redistribuídos — badge NEW */
  newChamadoIds = new Set<number>();
  private newBadgeTimers = new Map<number, any>();

  private refreshSub!: Subscription;
  private wsSub!: Subscription;
  private slaTimerInterval: any;

  slaCountdowns: { [id: string]: string } = {};

  get lastUpdatedLabel(): string {
    const diff = Math.floor((Date.now() - this.lastUpdated.getTime()) / 1000);
    if (diff < 60)   return `Atualizado há ${diff}s`;
    if (diff < 3600) return `Atualizado há ${Math.floor(diff / 60)}min`;
    return `Atualizado há ${Math.floor(diff / 3600)}h`;
  }

  constructor(
    private chamadoService: ChamadoService,
    private authService: AuthenticationService,
    private agendaWs: AgendaWsService,
    private tecnicoService: TecnicoService,
    private toast: ToastrService,
    private dialog: MatDialog,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    // ── 1. Resolver perfil via server (mesma abordagem do report-param) ───
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = this.authService.jwtService.decodeToken(token);
      const email: string = decoded?.sub ?? '';

      if (email) {
        this.authService.getUserInfo(email).subscribe({
          next: (info: any) => {
            this.usuarioId = info.id ?? null;

            const authorities: string[] = (info.authorities || [])
              .map((a: any) => typeof a === 'string' ? a : (a?.authority ?? ''));

            // 👑 Admin (com ou sem ROLE_TECNICO) → filtro por técnico
            this.isAdmin   = authorities.includes('ROLE_ADMIN');
            // 🧑‍💻 Técnico puro (sem ROLE_ADMIN) → apenas busca + próprios chamados
            this.isTecnico = authorities.includes('ROLE_TECNICO') && !this.isAdmin;

            this.profileReady = true;

            // Admin: carrega lista de técnicos para o dropdown de filtro
            if (this.isAdmin) {
              this.tecnicoService.findAllAtivos().subscribe(
                ts => { this.tecnicos = ts; },
                ()  => {}
              );
            }

            this.loadChamados();
          },
          error: () => {
            // Fallback: tenta carregar mesmo sem resolver perfil
            this.profileReady = true;
            this.loadChamados();
          }
        });
      }
    }

    // ── 2. Subscrever refresh$ (criação/atualização em outros componentes) ─
    this.refreshSub = this.chamadoService.refresh$.subscribe(() => {
      this.loadChamados();
    });

    // ── 3. WebSocket — sincronização em tempo real ─────────────────────────
    this.agendaWs.connect();
    this.wsSub = this.agendaWs.chamadoAtualizado$.subscribe(evento => {
      this.zone.run(() => {
        if (evento.tipo === 'CHAMADO_CRIADO') {
          this.markAsNew(evento.entityId);
          this.loadChamados();
          this.toast.success(
            `Chamado #${evento.entityId} adicionado à coluna "A Fazer"`,
            '✅ Novo chamado',
            { timeOut: 2500, positionClass: 'toast-bottom-right' }
          );
        } else if (evento.tipo === 'CHAMADO_REDISTRIBUIDO') {
          const meuId = this.usuarioId;
          if (meuId && String(meuId) === String(evento.tecnicoId)) {
            this.markAsNew(evento.entityId);
          }
          this.loadChamados();
          if (meuId && String(meuId) === String(evento.tecnicoOrigemId)) {
            this.toast.warning(
              `Chamado #${evento.entityId} foi redistribuído para outro técnico`,
              '🔄 Chamado removido',
              { timeOut: 3500, positionClass: 'toast-bottom-right' }
            );
          } else if (meuId && String(meuId) === String(evento.tecnicoId)) {
            this.toast.info(
              `Chamado #${evento.entityId} foi atribuído a você`,
              '📥 Novo chamado recebido',
              { timeOut: 3500, positionClass: 'toast-bottom-right' }
            );
          } else {
            this.toast.info(
              `Chamado #${evento.entityId} redistribuído entre técnicos`,
              '🔄 Redistribuição',
              { timeOut: 2500, positionClass: 'toast-bottom-right' }
            );
          }
        } else {
          this.loadChamados();
          const labels: Record<number, string> = { 0: 'A Fazer', 1: 'Em Andamento', 2: 'Finalizado' };
          this.toast.info(
            `Chamado #${evento.entityId} → ${labels[evento.novoStatus] ?? ''}`,
            '🔄 Central sincronizada',
            { timeOut: 2500, positionClass: 'toast-bottom-right' }
          );
        }
      });
    });

    // ── 4. Contador SLA a cada segundo ────────────────────────────────────
    this.slaTimerInterval = setInterval(() => {
      const all = [...this.colAberto, ...this.colAndamento, ...this.colEncerrado];
      all.forEach(c => {
        if (c.prazoSla) this.slaCountdowns[c.id] = this.computeSlaCountdown(c.prazoSla, c);
      });
    }, 1000);
  }

  // ── Carregamento de chamados por perfil ─────────────────────────────────
  loadChamados(): void {
    this.isLoading = true;

    let obs;
    if (this.isTecnico) {
      // 🧑‍💻 Técnico puro: somente os próprios chamados
      obs = this.chamadoService.findMyChamados();
    } else if (this.selectedTecnicoId) {
      // 👑 Admin com técnico selecionado no filtro
      obs = this.chamadoService.findByTecnico(this.selectedTecnicoId);
    } else {
      // 👑 Admin sem filtro: todos os chamados
      obs = this.chamadoService.findAll();
    }

    obs.subscribe(
      (chamados: Chamado[]) => {
        this.lastUpdated  = new Date();
        this.colAberto    = this.sortNewFirst(chamados.filter(c => String(c.status) === '0'));
        this.colAndamento = this.sortNewFirst(chamados.filter(c => String(c.status) === '1'));
        this.colEncerrado = this.sortNewFirst(chamados.filter(c => String(c.status) === '2'));
        this.initSlaCountdowns(chamados);
        this.isLoading = false;
      },
      () => {
        this.toast.error('Erro ao carregar chamados', 'Kanban');
        this.isLoading = false;
      }
    );
  }

  private sortNewFirst(list: Chamado[]): Chamado[] {
    if (this.newChamadoIds.size === 0) return list;
    const news = list.filter(c =>  this.newChamadoIds.has(Number(c.id)));
    const rest  = list.filter(c => !this.newChamadoIds.has(Number(c.id)));
    return [...news, ...rest];
  }

  private markAsNew(chamadoId: number): void {
    this.newChamadoIds.add(chamadoId);
    if (this.newBadgeTimers.has(chamadoId)) clearTimeout(this.newBadgeTimers.get(chamadoId));
    const timer = setTimeout(() => {
      this.newChamadoIds.delete(chamadoId);
      this.newBadgeTimers.delete(chamadoId);
    }, 300_000);
    this.newBadgeTimers.set(chamadoId, timer);
  }

  private initSlaCountdowns(chamados: Chamado[]): void {
    chamados.forEach(c => {
      if (c.prazoSla) this.slaCountdowns[c.id] = this.computeSlaCountdown(c.prazoSla, c);
    });
  }

  // ── Drag & Drop ─────────────────────────────────────────────────────────
  onDrop(event: CdkDragDrop<Chamado[]>, newStatus: string): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }

    const chamado: Chamado = event.previousContainer.data[event.previousIndex];

    // Somente Admin pode mover chamados encerrados
    if (String(chamado.status) === '2' && !this.isAdmin) {
      this.toast.warning('Chamados encerrados não podem ser movidos.', 'Kanban');
      return;
    }

    // Técnico puro: pode mover apenas seus próprios chamados
    if (this.isTecnico && String(chamado.tecnico) !== String(this.usuarioId)) {
      this.toast.warning('Você só pode mover seus próprios chamados.', 'Permissão negada');
      return;
    }

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    const previousStatus      = chamado.status;
    const previousFechamento  = chamado.dataFechamento;
    const previousStatusSla   = chamado.statusSla;

    chamado.status = newStatus;

    // Ao finalizar: registra dataFechamento agora e recalcula statusSla
    if (newStatus === '2' && !chamado.dataFechamento) {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      chamado.dataFechamento = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} - ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }

    // Recalcula statusSla com base no prazo vs dataFechamento real
    if (newStatus === '2') {
      chamado.statusSla = this.computeSlaStatus(chamado);
    }

    this.chamadoService.update(chamado).subscribe(
      () => {
        const labels: Record<string, string> = { '0': 'Aberto', '1': 'Em Andamento', '2': 'Encerrado' };
        this.toast.success(
          `Chamado #${chamado.id} movido para ${labels[newStatus]}`,
          '✅ Status atualizado',
          { timeOut: 3000, positionClass: 'toast-bottom-right' }
        );
      },
      () => {
        // Rollback completo em caso de erro
        chamado.status        = previousStatus;
        chamado.dataFechamento = previousFechamento;
        chamado.statusSla     = previousStatusSla;
        transferArrayItem(
          event.container.data,
          event.previousContainer.data,
          event.currentIndex,
          event.previousIndex
        );
        this.toast.error('Erro ao mover chamado. Tente novamente.', 'Kanban');
      }
    );
  }

  // ── Dialogs ─────────────────────────────────────────────────────────────
  openCreate(): void {
    this.dialog.open(ChamadoCreateComponent, { width: '720px' })
      .afterClosed().subscribe(() => this.loadChamados());
  }

  openEdit(chamado: Chamado): void {
    if (String(chamado.status) === '2') {
      this.toast.info('Este chamado está encerrado. Crie um novo para novo atendimento.', 'Encerrado', { timeOut: 4000 });
      return;
    }
    this.dialog.open(ChamadoUpdateComponent, {
      width: '720px', maxHeight: '90vh', minHeight: '580px',
      panelClass: 'custom-dialog-container', data: { id: chamado.id }
    });
  }

  openRead(chamado: Chamado): void {
    this.dialog.open(ChamadoReadComponent, {
      width: '720px', maxHeight: '90vh',
      panelClass: 'custom-dialog-container', data: { id: chamado.id }
    });
  }

  manualRefresh(): void { this.loadChamados(); }

  // ── Filtros ──────────────────────────────────────────────────────────────
  onTecnicoFilterChange(): void { this.loadChamados(); }

  clearTecnicoFilter(): void {
    this.selectedTecnicoId = null;
    this.loadChamados();
  }

  clearSearch(): void { this.searchQuery = ''; }

  getTecnicoNome(id: number | null): string {
    if (!id) return '';
    const t = this.tecnicos.find(t => String(t.id) === String(id));
    return t ? t.nome : String(id);
  }

  /**
   * Aplica busca textual sobre qualquer coluna.
   * — Admin: busca dentro dos chamados já filtrados pelo dropdown de técnico.
   * — Técnico: busca dentro dos próprios chamados.
   */
  private applySearch(list: Chamado[]): Chamado[] {
    if (!this.searchQuery.trim()) return list;
    const q = this.searchQuery.toLowerCase().trim();
    return list.filter(c =>
      String(c.id).includes(q) ||
      (c.titulo      || '').toLowerCase().includes(q) ||
      (c.nomeCliente || '').toLowerCase().includes(q)
    );
  }

  // ── Helpers de label ────────────────────────────────────────────────────
  returnPrioridade(p: any): string {
    if (p == '0') return 'BAIXA';
    if (p == '1') return 'MÉDIA';
    if (p == '2') return 'ALTA';
    return 'CRÍTICA';
  }

  getPrioridadeColor(p: any): string {
    if (p == '0') return '#4caf50';
    if (p == '1') return '#ff9800';
    if (p == '2') return '#f44336';
    return '#7b1fa2';
  }

  getPrioridadeIcon(p: any): string {
    if (p == '0') return 'arrow_downward';
    if (p == '1') return 'remove';
    if (p == '2') return 'arrow_upward';
    return 'priority_high';
  }

  // ── Helpers de SLA ──────────────────────────────────────────────────────
  computeSlaCountdown(prazoSla: string, chamado?: Chamado): string {
    if (!prazoSla) return '--:--:--';
    const prazo = this.parseDatetime(prazoSla);
    if (!prazo) return '--:--:--';
    if (chamado && String(chamado.status) === '2' && chamado.dataFechamento) {
      const fechamento = this.parseDatetime(chamado.dataFechamento);
      if (fechamento) return this.formatCountdown(prazo.getTime() - fechamento.getTime());
    }
    return this.formatCountdown(prazo.getTime() - Date.now());
  }

  private formatCountdown(ms: number): string {
    const sign = ms < 0 ? '-' : '';
    const abs  = Math.abs(ms);
    const hh   = Math.floor(abs / 3600000);
    const mm   = Math.floor((abs % 3600000) / 60000);
    const ss   = Math.floor((abs % 60000) / 1000);
    return `${sign}${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  }

  computeSlaStatus(chamado: Chamado): string {
    if (!chamado.prazoSla) return 'N/A';
    const prazo = this.parseDatetime(chamado.prazoSla);
    if (!prazo) return 'N/A';
    if (String(chamado.status) === '2') {
      if (chamado.dataFechamento) {
        const fechamento = this.parseDatetime(chamado.dataFechamento);
        if (fechamento) return fechamento.getTime() <= prazo.getTime() ? 'ENCERRADO_NO_PRAZO' : 'ENCERRADO_ATRASADO';
      }
      return 'ENCERRADO_NO_PRAZO';
    }
    const now      = Date.now();
    if (now > prazo.getTime()) return 'ATRASADO';
    const abertura = chamado.dataAbertura ? this.parseDatetime(chamado.dataAbertura) : null;
    if (abertura) {
      const total     = prazo.getTime() - abertura.getTime();
      const remaining = prazo.getTime() - now;
      if (total > 0 && remaining < total / 2) return 'ALERTA';
    }
    return 'DENTRO_PRAZO';
  }

  getSlaIcon(chamado: Chamado): string {
    const s = chamado.statusSla || this.computeSlaStatus(chamado);
    if (s === 'ATRASADO')          return 'timer_off';
    if (s === 'ALERTA')            return 'timer';
    if (s === 'ENCERRADO_NO_PRAZO') return 'verified';
    if (s === 'ENCERRADO_ATRASADO') return 'running_with_errors';
    return 'schedule';
  }

  getSlaLabel(chamado: Chamado): string {
    const s = chamado.statusSla || this.computeSlaStatus(chamado);
    if (s === 'ATRASADO')          return 'ATRASADO';
    if (s === 'ALERTA')            return 'ALERTA';
    if (s === 'ENCERRADO_NO_PRAZO') return 'NO PRAZO';
    if (s === 'ENCERRADO_ATRASADO') return 'ATRASADO';
    if (s === 'N/A')               return 'SEM SLA';
    return 'NO PRAZO';
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  getRelativeTime(dateStr: string): string {
    if (!dateStr) return '—';
    const d = this.parseDatetime(dateStr);
    if (!d) return dateStr;
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'agora';
    if (mins < 60) return `há ${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `há ${hrs}h`;
    return `há ${Math.floor(hrs / 24)}d`;
  }

  private parseDatetime(str: string): Date | null {
    if (!str) return null;
    const m = str.match(/(\d{2})\/(\d{2})\/(\d{4}) - (\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
  }

  ngOnDestroy(): void {
    if (this.refreshSub) this.refreshSub.unsubscribe();
    if (this.wsSub)      this.wsSub.unsubscribe();
    if (this.slaTimerInterval) clearInterval(this.slaTimerInterval);
    this.newBadgeTimers.forEach(t => clearTimeout(t));
    this.newBadgeTimers.clear();
  }
}

