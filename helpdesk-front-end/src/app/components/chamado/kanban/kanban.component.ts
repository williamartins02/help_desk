import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Subscription } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { ChamadoService } from 'src/app/services/chamado.service';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { AgendaWsService } from 'src/app/services/agenda-ws.service';
import { Chamado } from 'src/app/models/chamado';
import { ChamadoUpdateComponent } from '../chamado-update/chamado-update.component';
import { ChamadoReadComponent } from '../chamado-read/chamado-read.component';
import { ChamadoCreateComponent } from '../chamado-create/chamado-create.component';

@Component({
  selector: 'app-kanban',
  templateUrl: './kanban.component.html',
  styleUrls: ['./kanban.component.css']
})
export class KanbanComponent implements OnInit, OnDestroy {

  usuarioLogado: any;

  colAberto: Chamado[]      = [];
  colAndamento: Chamado[]   = [];
  colEncerrado: Chamado[]   = [];

  isLoading = false;
  lastUpdated: Date = new Date();

  /** IDs de chamados recém-criados ou redistribuídos — exibe badge NEW e coloca no topo */
  newChamadoIds = new Set<number>();
  /** Timers para auto-expirar cada badge após 5 minutos */
  private newBadgeTimers = new Map<number, any>();

  private refreshSub!: Subscription;
  private wsSub!: Subscription;
  private slaTimerInterval: any;

  slaCountdowns: { [id: string]: string } = {};

  get lastUpdatedLabel(): string {
    const diff = Math.floor((Date.now() - this.lastUpdated.getTime()) / 1000);
    if (diff < 60) return `Atualizado há ${diff}s`;
    if (diff < 3600) return `Atualizado há ${Math.floor(diff / 60)}min`;
    return `Atualizado há ${Math.floor(diff / 3600)}h`;
  }

  constructor(
    private chamadoService: ChamadoService,
    private authService: AuthenticationService,
    private agendaWs: AgendaWsService,
    private toast: ToastrService,
    private dialog: MatDialog,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    // Decode logged user
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = this.authService.jwtService.decodeToken(token);
      this.usuarioLogado = {
        id: decoded.id,
        tipo: decoded.tipo,
        email: decoded.sub,
        perfis: decoded.authorities || []
      };
    }

    this.loadChamados();

    // Subscribe to refresh$ (triggered after any create/update in ChamadoService)
    this.refreshSub = this.chamadoService.refresh$.subscribe(() => {
      this.loadChamados();
    });

    // Subscribe to WebSocket events (chamado criado ou atualizado em qualquer tela)
    this.agendaWs.connect();
    this.wsSub = this.agendaWs.chamadoAtualizado$.subscribe(evento => {
      this.zone.run(() => {
        if (evento.tipo === 'CHAMADO_CRIADO') {
          // Marca como novo ANTES de recarregar — assim loadChamados já o posiciona no topo
          this.markAsNew(evento.entityId);
          this.loadChamados();
          this.toast.success(
            `Chamado #${evento.entityId} adicionado à coluna "A Fazer"`,
            '✅ Novo chamado',
            { timeOut: 2500, positionClass: 'toast-bottom-right' }
          );
        } else if (evento.tipo === 'CHAMADO_REDISTRIBUIDO') {
          // Marca o chamado redistribuído como novo para o técnico de destino
          const meuId = this.usuarioLogado?.id;
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

    // SLA countdown timer
    this.slaTimerInterval = setInterval(() => {
      const allChamados = [...this.colAberto, ...this.colAndamento, ...this.colEncerrado];
      allChamados.forEach(c => {
        if (c.prazoSla) {
          this.slaCountdowns[c.id] = this.computeSlaCountdown(c.prazoSla, c);
        }
      });
    }, 1000);
  }

  loadChamados(): void {
    this.isLoading = true;
    const obs = this.usuarioLogado?.tipo === 'TECNICO'
      ? this.chamadoService.findMyChamados()
      : this.chamadoService.findAll();

    obs.subscribe(
      (chamados: Chamado[]) => {
        this.lastUpdated = new Date();

        // Separar por status e colocar os "new" no topo de cada coluna
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

  /** Move os chamados marcados como "new" para o topo da lista, mantendo a ordem dos demais */
  private sortNewFirst(list: Chamado[]): Chamado[] {
    if (this.newChamadoIds.size === 0) return list;
    const news  = list.filter(c => this.newChamadoIds.has(Number(c.id)));
    const rest  = list.filter(c => !this.newChamadoIds.has(Number(c.id)));
    return [...news, ...rest];
  }

  /** Registra um chamado como "novo", agenda auto-expiração do badge em 5 minutos */
  private markAsNew(chamadoId: number): void {
    this.newChamadoIds.add(chamadoId);
    // Cancela timer anterior caso o mesmo ID apareça novamente
    if (this.newBadgeTimers.has(chamadoId)) {
      clearTimeout(this.newBadgeTimers.get(chamadoId));
    }
    const timer = setTimeout(() => {
      this.newChamadoIds.delete(chamadoId);
      this.newBadgeTimers.delete(chamadoId);
    }, 300_000); // 5 minutos
    this.newBadgeTimers.set(chamadoId, timer);
  }

  private initSlaCountdowns(chamados: Chamado[]): void {
    chamados.forEach(c => {
      if (c.prazoSla) {
        this.slaCountdowns[c.id] = this.computeSlaCountdown(c.prazoSla, c);
      }
    });
  }

  onDrop(event: CdkDragDrop<Chamado[]>, newStatus: string): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }

    const chamado: Chamado = event.previousContainer.data[event.previousIndex];

    // Block moving encerrado (2) chamados unless admin
    if (String(chamado.status) === '2' && this.usuarioLogado?.tipo !== 'ADMIN') {
      this.toast.warning('Chamados encerrados não podem ser movidos.', 'Kanban');
      return;
    }

    // Permission: TECNICO can only move their own chamados
    if (this.usuarioLogado?.tipo === 'TECNICO' && chamado.tecnico !== this.usuarioLogado.id) {
      this.toast.warning('Você só pode mover seus próprios chamados.', 'Permissão negada');
      return;
    }

    // Optimistic UI update
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    const previousStatus = chamado.status;
    chamado.status = newStatus;

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
        // Rollback on error
        chamado.status = previousStatus;
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

  openCreate(): void {
    this.dialog.open(ChamadoCreateComponent, { width: '720px' })
      .afterClosed().subscribe(() => {
        // Após criar via dialog, recarregue imediatamente.
        // O ID exato chegará via WS (CHAMADO_CRIADO) que já chama markAsNew + loadChamados.
        // Aqui apenas forçamos reload caso o WS esteja lento.
        this.loadChamados();
      });
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

  manualRefresh(): void {
    this.loadChamados();
  }

  // ── Label helpers ─────────────────────────────────────────────────────────
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

  // ── SLA helpers ───────────────────────────────────────────────────────────
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
    const abs = Math.abs(ms);
    const hh = Math.floor(abs / 3600000);
    const mm = Math.floor((abs % 3600000) / 60000);
    const ss = Math.floor((abs % 60000) / 1000);
    return `${sign}${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
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
    const now = Date.now();
    if (now > prazo.getTime()) return 'ATRASADO';
    const abertura = chamado.dataAbertura ? this.parseDatetime(chamado.dataAbertura) : null;
    if (abertura) {
      const total = prazo.getTime() - abertura.getTime();
      const remaining = prazo.getTime() - now;
      if (total > 0 && remaining < total / 2) return 'ALERTA';
    }
    return 'DENTRO_PRAZO';
  }

  getSlaColor(chamado: Chamado): string {
    const s = chamado.statusSla || this.computeSlaStatus(chamado);
    if (s === 'ATRASADO' || s === 'ENCERRADO_ATRASADO') return '#f44336';
    if (s === 'ALERTA') return '#ff9800';
    if (s === 'ENCERRADO_NO_PRAZO') return '#43a047';
    return '#4caf50';
  }

  getSlaIcon(chamado: Chamado): string {
    const s = chamado.statusSla || this.computeSlaStatus(chamado);
    if (s === 'ATRASADO') return 'timer_off';
    if (s === 'ALERTA') return 'timer';
    if (s === 'ENCERRADO_NO_PRAZO') return 'verified';
    if (s === 'ENCERRADO_ATRASADO') return 'running_with_errors';
    return 'schedule';
  }

  getSlaLabel(chamado: Chamado): string {
    const s = chamado.statusSla || this.computeSlaStatus(chamado);
    if (s === 'ATRASADO') return 'ATRASADO';
    if (s === 'ALERTA') return 'ALERTA';
    if (s === 'ENCERRADO_NO_PRAZO') return 'NO PRAZO';
    if (s === 'ENCERRADO_ATRASADO') return 'ATRASADO';
    if (s === 'N/A') return 'SEM SLA';
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
    if (mins < 1) return 'agora';
    if (mins < 60) return `há ${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `há ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `há ${days}d`;
  }

  private parseDatetime(str: string): Date | null {
    if (!str) return null;
    const m = str.match(/(\d{2})\/(\d{2})\/(\d{4}) - (\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
  }

  ngOnDestroy(): void {
    if (this.refreshSub) this.refreshSub.unsubscribe();
    if (this.wsSub) this.wsSub.unsubscribe();
    if (this.slaTimerInterval) clearInterval(this.slaTimerInterval);
    // Limpa todos os timers de badge NEW
    this.newBadgeTimers.forEach(t => clearTimeout(t));
    this.newBadgeTimers.clear();
    // Note: agendaWs is a singleton — do NOT call disconnect() here
    // to avoid breaking other components that share the same connection.
  }
}

