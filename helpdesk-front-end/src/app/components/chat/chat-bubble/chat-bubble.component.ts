import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';
import { ChatService, ConexaoStatus }       from '../../../services/chat.service';
import { ChatWindowService } from '../../../services/chat-window.service';
import { UsuarioService }    from '../../../services/usuario.service';
import { IUsuario }          from '../../../models/usuario';

@Component({
  selector: 'app-chat-bubble',
  templateUrl: './chat-bubble.component.html',
  styleUrls: ['./chat-bubble.component.css'],
  animations: [
    trigger('slideUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(18px) scale(0.96)' }),
        animate('240ms ease-out', style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('190ms ease-in', style({ opacity: 0, transform: 'translateY(18px) scale(0.96)' }))
      ])
    ]),
    trigger('notifEnter', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('220ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('160ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ])
  ]
})
export class ChatBubbleComponent implements OnInit, OnDestroy {

  expanded       = false;
  connected      = false;
  conexaoStatus: ConexaoStatus = 'offline';
  naoLidas       = 0;          // badge no FAB (quando fechado)
  mostrarBubble  = true;
  searchQuery    = '';

  usuarios: IUsuario[]     = [];
  usuariosOnline: string[] = [];

  /** E-mail do usuário logado (filtrado da lista) */
  myEmail  = '';
  private myUserId = '';

  /** Mapa email → não-lidas (sincronizado com ChatWindowService) */
  unreadByEmail: Record<string, number> = {};

  /** Notificação in-panel exibida enquanto o painel está aberto */
  notificacaoAtiva: { nome: string; texto: string } | null = null;
  private notifTimer: any = null;

  private isOnChatPage   = false;
  private connectionSub: Subscription;
  private onlineSub:     Subscription;
  private notifSub:      Subscription;
  private msgSub:        Subscription;
  private unreadSub:     Subscription;
  private routerSub:     Subscription;

  constructor(
    private chatService:       ChatService,
    private chatWindowService: ChatWindowService,
    private usuarioService:    UsuarioService,
    private router:            Router
  ) {
    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: NavigationEnd) => {
      this.isOnChatPage  = e.url.includes('/chat');
      this.mostrarBubble = !this.isOnChatPage;
    });
  }

  ngOnInit(): void {
    this.myEmail = this.chatService.getUsername();

    // ── Conexão ──────────────────────────────────────────────────────────
    this.connectionSub = this.chatService.getConexaoStatus().subscribe(status => {
      this.conexaoStatus = status;
      this.connected     = status === 'conectado';
      if (status === 'conectado' && this.usuarios.length === 0) {
        this._carregarUsuarios();
      }
    });

    // ── Usuários online ───────────────────────────────────────────────────
    this.onlineSub = this.chatService.getUsuariosOnline().subscribe(onlineList => {
      this.usuariosOnline = onlineList;
    });

    // ── Não-lidas centralizadas (fonte única de verdade no ChatWindowService) ──
    // O badge por remetente E o badge do FAB são derivados deste observable.
    // Qualquer abertura de janela / seleção de conversa zera o email no serviço
    // e, em cascata, recalcula o total do FAB automaticamente.
    this.unreadSub = this.chatWindowService.unreadByEmail$.subscribe(map => {
      this.unreadByEmail = map;
      // FAB badge = soma real de todas as não-lidas de todos os remetentes
      this.naoLidas = Object.values(map).reduce((sum, v) => sum + v, 0);
    });

    // ── Mensagens em tempo-real ───────────────────────────────────────────
    // Cuida de: badge do FAB e notificação in-panel.
    // O toast foi removido — substituído pelo ChatNotificationComponent.
    this.msgSub = this.chatService.getMensagem().subscribe(msg => {
      if (msg.type !== 'MENSAGEM') return;
      if (msg.username === this.myEmail) return;

      // Descarta mensagens DM que não são para este usuário (guarda dupla)
      if (msg.destinatario && msg.destinatario !== this.myEmail) return;

      // Suprime a notificação SOMENTE quando o chat principal está com esta conversa ativa.
      if (this.chatWindowService.isMainChatActive(msg.username)) return;

      const sender = this.usuarios.find(u => u.email === msg.username);
      const nome   = sender?.nome || msg.username;

      if (this.expanded) {
        // Painel aberto → notificação in-panel
        this.notificacaoAtiva = { nome, texto: msg.texto };
        if (this.notifTimer) clearTimeout(this.notifTimer);
        this.notifTimer = setTimeout(() => { this.notificacaoAtiva = null; }, 4000);
      }
      // Toast removido — ChatNotificationComponent exibe a notificação visual
    });

    // ── Mensagens offline (pendentes) ─────────────────────────────────────
    // getNotificacao() emite com `qtd` apenas para mensagens acumuladas offline
    this.notifSub = this.chatService.getNotificacao().subscribe(notif => {
      if (notif.qtd === undefined) return; // real-time já tratado em msgSub

      // Atualiza contagem por remetente no serviço centralizado
      // (o badge do FAB é recalculado automaticamente via unreadByEmail$)
      this.chatWindowService.addBatchUnreadByEmail(notif.remetente, notif.qtd);
    });

    this._carregarUsuarios();
  }

  private _carregarUsuarios(): void {
    this.usuarioService.findAllForChat().subscribe({
      next: users => {
        this.usuarios = users;
        const me = users.find(u => u.email === this.myEmail);
        if (me) this.myUserId = me.id.toString();
      },
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    this.connectionSub?.unsubscribe();
    this.onlineSub?.unsubscribe();
    this.notifSub?.unsubscribe();
    this.msgSub?.unsubscribe();
    this.unreadSub?.unsubscribe();
    this.routerSub?.unsubscribe();
    if (this.notifTimer) clearTimeout(this.notifTimer);
  }

  // ── Minimizar / Expandir ────────────────────────────────────────────────
  toggle(): void {
    this.expanded = !this.expanded;
    if (this.expanded) {
      // Não zeramos naoLidas — ele é derivado de unreadByEmail$ e reflete a realidade.
      // Só some quando as conversas forem realmente abertas/visualizadas.
      this.notificacaoAtiva = null;
    }
  }

  // ── Abrir janela flutuante de DM ───────────────────────────────────────
  abrirConversa(user: IUsuario): void {
    // open(user) sem minimized=true → maximiza e zera naoLidas + email unread
    this.chatWindowService.open(user);
    this.expanded = false;
  }

  // ── Getters de lista (filtrados e ordenados) ────────────────────────────
  private _sortByOnlineThenAlpha(users: IUsuario[]): IUsuario[] {
    return [...users].sort((a, b) => {
      const aOn = this.usuariosOnline.includes(a.email);
      const bOn = this.usuariosOnline.includes(b.email);
      if (aOn !== bOn) return aOn ? -1 : 1;
      // Com não-lidas sobem ao topo dentro do grupo online/offline
      const aUnread = (this.unreadByEmail[a.email] ?? 0) > 0 ? -1 : 0;
      const bUnread = (this.unreadByEmail[b.email] ?? 0) > 0 ? -1 : 0;
      if (aUnread !== bUnread) return aUnread - bUnread;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }

  get tecnicos(): IUsuario[] {
    const q = this.searchQuery.toLowerCase();
    const filtered = this.usuarios
      .filter(u => u.tipo === 'TECNICO')
      .filter(u => u.email !== this.myEmail)          // exclui o próprio usuário
      .filter(u => !q || u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    return this._sortByOnlineThenAlpha(filtered);
  }

  get clientes(): IUsuario[] {
    const q = this.searchQuery.toLowerCase();
    const filtered = this.usuarios
      .filter(u => u.tipo === 'CLIENTE')
      .filter(u => u.email !== this.myEmail)          // exclui o próprio usuário
      .filter(u => !q || u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    return this._sortByOnlineThenAlpha(filtered);
  }

  // ── Helpers de UI ────────────────────────────────────────────────────────

  /** Retorna o número de mensagens não lidas do usuário (sincronizado com o serviço) */
  getUnread(user: IUsuario): number {
    return this.unreadByEmail[user.email] ?? 0;
  }

  /** Prévia da última mensagem da conversa com o usuário */
  getLastMessage(user: IUsuario): string {
    if (!this.myUserId) return '';
    const a    = parseInt(this.myUserId, 10);
    const b    = user.id;
    const sala = `dm_${Math.min(a, b)}_${Math.max(a, b)}`;
    const hist = this.chatService.getMessageHistory(sala);
    if (!hist.length) return '';
    const texto = hist[hist.length - 1].texto || '';
    return texto.length > 34 ? texto.substring(0, 34) + '…' : texto;
  }

  isOnline(user: IUsuario): boolean {
    return this.usuariosOnline.includes(user.email);
  }

  getLastSeen(user: IUsuario): string | null {
    return this.chatService.getLastSeen(user.email);
  }

  formatLastSeen(iso: string | null): string {
    if (!iso) return '';
    const d     = new Date(iso);
    const hoje  = new Date();
    const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
    const time  = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === hoje.toDateString())  return `hoje às ${time}`;
    if (d.toDateString() === ontem.toDateString()) return `ontem às ${time}`;
    return `${d.toLocaleDateString('pt-BR')} às ${time}`;
  }

  getInitials(nome: string): string {
    if (!nome) return '?';
    const p = nome.trim().split(' ');
    return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : nome.substring(0, 2).toUpperCase();
  }

  getAvatarCor(nome: string): string {
    const cores = ['#1565c0', '#00838f', '#2e7d32', '#6a1b9a', '#c62828', '#f57f17'];
    if (!nome) return cores[0];
    let h = 0;
    for (let i = 0; i < nome.length; i++) h += nome.charCodeAt(i);
    return cores[h % cores.length];
  }
}
