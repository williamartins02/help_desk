import {
  Component, OnInit, OnDestroy, AfterViewChecked, ChangeDetectorRef
} from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { Subscription } from 'rxjs';
import { ChatService, IEscrevendo, ConexaoStatus }  from '../../../services/chat.service';
import { ChatWindowService, IChatWindow } from '../../../services/chat-window.service';
import { UsuarioService }    from '../../../services/usuario.service';
import { IMensagem }         from '../../../models/mensagem';
import { IUsuario }          from '../../../models/usuario';
import { ToastrService }     from 'ngx-toastr';

@Component({
  selector:    'app-floating-chat',
  templateUrl: './floating-chat.component.html',
  styleUrls:   ['./floating-chat.component.css'],
  animations: [
    trigger('windowEnter', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('220ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('160ms ease-in', style({ opacity: 0, transform: 'translateY(20px)' }))
      ])
    ])
  ]
})
export class FloatingChatComponent implements OnInit, OnDestroy, AfterViewChecked {

  windows:        IChatWindow[] = [];
  usuarios:       IUsuario[]    = [];
  usuariosOnline: string[]      = [];
  connected       = false;
  conexaoStatus: ConexaoStatus  = 'offline';

  // Texto digitado por janela: userId → string
  textos:    { [userId: string]: string }  = {};
  // Indicador de digitação por janela: userId → string
  escrevendo: { [userId: string]: string }  = {};
  // Scroll pendente por janela: userId → boolean
  private shouldScrolls: { [userId: string]: boolean } = {};
  // Timers para apagar indicador de digitação por janela
  private typingTimers:  { [userId: string]: any }     = {};
  // Timestamp do último evento "digitando" emitido por janela (throttle)
  private lastTypingEmit: { [userId: string]: number } = {};
  private readonly TYPING_THROTTLE_MS = 1500;

  private myEmail  = '';
  private myUserId = '';

  // ── Estado local de mensagens (apenas pin/favorito — o resto vai pro WS) ──
  private fwPinnedMsgs    = new Set<string>();
  private fwFavoritedMsgs = new Set<string>();

  /** Mensagens que chegaram antes de this.usuarios ser carregado — processadas após findAll() */
  private pendingMessages: IMensagem[] = [];

  // ── Reactions ─────────────────────────────────────────────────────────────
  readonly QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  /** Chave da mensagem com o picker de reação aberto por janela: userId_msgKey | null */
  fwReactionPickerMsg: string | null = null;

  // ── Context menu ─────────────────────────────────────────────────────
  fwCtxMenu: { msg: IMensagem; win: IChatWindow; x: number; y: number } | null = null;

  // ── Resposta por janela ───────────────────────────────────────────────
  fwResposta: { [userId: string]: IMensagem } = {};

  // ── Edição por janela ─────────────────────────────────────────────────
  fwEditando: { [userId: string]: IMensagem | null } = {};

  // ── Info panel ────────────────────────────────────────────────────────
  fwInfoMsg: IMensagem | null = null;

  private windowsSub:    Subscription;
  private connectionSub: Subscription;
  private onlineSub:     Subscription;
  private mensagemSub:   Subscription;
  private escrevendoSub: Subscription;
  private leituraSub:    Subscription;

  constructor(
    private chatService:       ChatService,
    private chatWindowService: ChatWindowService,
    private usuarioService:    UsuarioService,
    private toast:             ToastrService,
    private cdr:               ChangeDetectorRef
  ) {}

  /** E-mail público (usado no template) */
  get myEmailPublic(): string { return this.myEmail; }

  ngOnInit(): void {
    this.myEmail = this.chatService.getUsername();

    // Estado de conexão (3 estados)
    this.connectionSub = this.chatService.getConexaoStatus().subscribe(status => {
      this.conexaoStatus = status;
      this.connected     = status === 'conectado';
    });

    // Usuários online
    this.onlineSub = this.chatService.getUsuariosOnline().subscribe(list => {
      this.usuariosOnline = list;
    });

    // Janelas abertas — detecta novas janelas e agenda scroll p/ a última mensagem
    this.windowsSub = this.chatWindowService.windows$.subscribe(wins => {
      const prevIds = new Set(this.windows.map(w => w.userId));
      this.windows = wins;
      // Quando uma janela NÃO-minimizada é adicionada, rola até a última mensagem
      wins.forEach(w => {
        if (!prevIds.has(w.userId) && !w.minimized) {
          this.shouldScrolls[w.userId] = true;
        }
      });
    });

    // Carrega usuários → pré-popula histórico e resolve o myUserId
    this.usuarioService.findAll().subscribe(users => {
      this.usuarios = users;
      const me = users.find(u => u.email === this.myEmail);
      if (me) {
        this.myUserId = me.id.toString();
      }
      // Processa mensagens que chegaram antes da lista de usuários ser carregada
      if (this.pendingMessages.length > 0) {
        const pending = [...this.pendingMessages];
        this.pendingMessages = [];
        pending.forEach(msg => this._processMessage(msg));
      }
    });

    // Assina mensagens IMEDIATAMENTE (não aguarda findAll) para não perder
    // notificações que cheguem antes da lista de usuários ser carregada.
    this._subscribeToMessages();

    // Indicador de digitação — filtrado por sala
    this.escrevendoSub = this.chatService.getEscrevendo().subscribe((payload: IEscrevendo) => {
      if (payload.username === this.myEmail) return;
      const user = this.usuarios.find(u => u.email === payload.username);
      if (!user) return;
      const uid   = user.id.toString();
      const sala  = this.getConversaId(uid);
      if (payload.sala !== sala) return;   // ignorar se não é desta janela

      this.escrevendo[uid] = 'digitando...';
      if (this.typingTimers[uid]) clearTimeout(this.typingTimers[uid]);
      this.typingTimers[uid] = setTimeout(() => { this.escrevendo[uid] = ''; }, 3000);
    });

    // Assina eventos de leitura para remover notificações e atualizar status
    this.leituraSub = this.chatService.getLeitura().subscribe(leitura => {
      if (!leitura.id) return;
      // Remove badge de não lida se a janela estiver aberta
      const win = this.windows.find(w => w.email === leitura.destinatario);
      if (win) this.chatWindowService.clearUnread(win.userId);
    });
  }

  /** Assina mensagens imediatamente, sem depender do carregamento de usuários */
  private _subscribeToMessages(): void {
    this.mensagemSub = this.chatService.getMensagem().subscribe(msg => {
      // Mensagens de ação (REACTION/DELETE_MSG/EDIT_MSG): ChatService já aplicou a mutação.
      // Força CD para garantir que a UI do floating chat seja atualizada imediatamente.
      if (msg.type === 'REACTION' || msg.type === 'DELETE_MSG' || msg.type === 'EDIT_MSG') {
        // Só atualiza a janela que tem a conversa aberta
        if (msg.sala && this.windows.some(w => this.getConversaId(w.userId) === msg.sala)) {
          this.cdr.detectChanges();
        }
        return;
      }

      if (msg.type !== 'MENSAGEM') return;

      // Descarta mensagens DM que não pertencem a este usuário (guarda dupla)
      if (msg.destinatario && msg.destinatario !== this.myEmail && msg.username !== this.myEmail) return;

      this._processMessage(msg);
    });
  }

  /**
   * Processa uma mensagem recebida: abre janela minimizada com badge se necessário.
   * Também é chamado ao fazer replay das mensagens pendentes (buffering).
   */
  private _processMessage(msg: IMensagem): void {
    const sala = msg.sala || '';
    // Busca janela por sala canônica (quando myUserId disponível) ou por e-mail do remetente
    let win = this.myUserId
      ? this.windows.find(w => this.getConversaId(w.userId) === sala)
      : this.windows.find(w => w.email === msg.username || w.email === msg.destinatario);

    // ── Se não há janela aberta para esta conversa e a mensagem vem de outra
    // pessoa, abre automaticamente uma janela minimizada (badge de não-lida).
    if (!win && msg.username !== this.myEmail) {
      const sender = this.usuarios.find(u => u.email === msg.username);
      if (sender) {
        // Abre minimizada — windowsSub atualiza this.windows de forma síncrona
        this.chatWindowService.open(sender, true);
        win = this.myUserId
          ? this.windows.find(w => this.getConversaId(w.userId) === sala)
          : this.windows.find(w => w.email === msg.username);
      } else if (this.usuarios.length === 0) {
        // Lista de usuários ainda não carregada — guarda para processar depois
        // (será reprocessada em ngOnInit após findAll() concluir)
        this.pendingMessages.push(msg);
        return;
      }
      // Se a lista já foi carregada mas o remetente não foi encontrado, descarta silenciosamente
    }

    if (!win) return;

    msg.status = msg.username === this.myEmail ? 'sent' : 'delivered';

    if (msg.username !== this.myEmail) {
      if (win.minimized) {
        // Janela minimizada: incrementa badge na janela e no FAB.
        // Será limpo automaticamente quando o usuário abrir a janela (toggleMinimize).
        this.chatWindowService.addUnread(win.userId);
      } else {
        // Janela aberta: a mensagem fica visível via auto-scroll — não incrementa badge.
        // Limpa qualquer badge residual (ex: de antes de a janela ser aberta) e
        // rola até a última mensagem. O toast via chat-bubble notifica o usuário.
        this.chatWindowService.clearUnreadByEmail(win.email);
        this.shouldScrolls[win.userId] = true;
      }
    } else if (!win.minimized) {
      // Própria mensagem (echo do servidor): apenas rola, sem badge
      this.shouldScrolls[win.userId] = true;
    }
  }

  ngAfterViewChecked(): void {
    this.windows.forEach(w => {
      if (this.shouldScrolls[w.userId]) {
        this._scrollToBottom(w.userId);
        this.shouldScrolls[w.userId] = false;
        // Janela aberta + scroll automático = mensagem visível → garante limpeza do badge
        if (!w.minimized) {
          this.chatWindowService.clearUnreadByEmail(w.email);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.windowsSub?.unsubscribe();
    this.connectionSub?.unsubscribe();
    this.onlineSub?.unsubscribe();
    this.mensagemSub?.unsubscribe();
    this.escrevendoSub?.unsubscribe();
    this.leituraSub?.unsubscribe();
    // Limpa timers de digitação pendentes
    Object.values(this.typingTimers).forEach(t => clearTimeout(t));
    // Descarta mensagens bufferizadas
    this.pendingMessages = [];
  }

  // ── Janelas ───────────────────────────────────────────────────────────────
  toggle(win: IChatWindow): void {
    this.chatWindowService.toggleMinimize(win.userId);
    if (!win.minimized) {
      this.shouldScrolls[win.userId] = true;
    }
  }

  fechar(win: IChatWindow, e: Event): void {
    e.stopPropagation();
    this.chatWindowService.close(win.userId);
  }

  abrir(win: IChatWindow): void {
    this.chatWindowService.toggleMinimize(win.userId);
    if (!win.minimized) {
      this.shouldScrolls[win.userId] = true;
      // Marca todas as mensagens da conversa como lidas
      const sala = this.getConversaId(win.userId);
      const msgs = this.getMensagens(win);
      msgs.filter(m => m.status !== 'read' && m.username !== this.myEmail && m.id)
        .forEach(m => this.chatService.marcarComoLida(m));
    }
  }

  // ── Mensagens ─────────────────────────────────────────────────────────────
  getMensagens(win: IChatWindow): IMensagem[] {
    return this.chatService.getMessageHistory(this.getConversaId(win.userId)) || [];
  }

  enviar(win: IChatWindow): void {
    // Modo de edição
    if (this.fwEditando[win.userId]) { this._salvarFwEdicao(win); return; }

    const texto = this.textos[win.userId]?.trim();
    if (!texto || !this.connected) return;

    // Usuário está ativo na janela → limpa badge pendente deste remetente
    this.chatWindowService.clearUnreadByEmail(win.email);

    const msg: IMensagem = {
      texto,
      type:         'MENSAGEM',
      username:     this.myEmail,
      color:        '',
      timestamp:    new Date().toISOString(),
      sala:         this.getConversaId(win.userId),
      status:       'sent',
      destinatario: win.email,
      replyTo:      this.fwResposta[win.userId] ? {
        id:       this.fwResposta[win.userId].id,
        username: this.fwResposta[win.userId].username,
        texto:    this.getFwTexto(this.fwResposta[win.userId])
      } : undefined
    };
    this.chatService.publishMensagem(msg);
    this.textos[win.userId]     = '';
    this.escrevendo[win.userId] = '';
    delete this.fwResposta[win.userId];

    if (this.typingTimers[win.userId]) {
      clearTimeout(this.typingTimers[win.userId]);
      delete this.typingTimers[win.userId];
    }
  }

  onKey(e: KeyboardEvent, win: IChatWindow): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.enviar(win); }
    if (e.key === 'Escape') {
      if (this.fwEditando[win.userId]) { this.cancelarFwEdicao(win); return; }
      if (this.fwResposta[win.userId]) { this.cancelarFwResposta(win); }
    }
  }

  escrever(win: IChatWindow): void {
    if (!this.connected || !this.myUserId) return;
    // Usuário está digitando → está olhando para a janela → limpa badge
    this.chatWindowService.clearUnreadByEmail(win.email);
    const now = Date.now();
    if ((now - (this.lastTypingEmit[win.userId] || 0)) < this.TYPING_THROTTLE_MS) return;
    this.lastTypingEmit[win.userId] = now;
    this.chatService.publishEscrevendo(this.myEmail, this.getConversaId(win.userId));
  }

  // ── Estado local das mensagens ────────────────────────────────────────────
  /** Chave estável — NÃO inclui texto para que EDIT_MSG funcione após mutação optimista */
  private _fwKey(msg: IMensagem): string {
    return msg.id || ((msg.timestamp ?? '') + msg.username);
  }

  isFwApagada(msg: IMensagem): boolean  { return msg.apagada === true; }
  isFwEditada(msg: IMensagem): boolean  { return msg.editada === true; }
  isFwFixada(msg: IMensagem): boolean   { return this.fwPinnedMsgs.has(this._fwKey(msg)); }
  isFwFavorita(msg: IMensagem): boolean { return this.fwFavoritedMsgs.has(this._fwKey(msg)); }

  getFwTexto(msg: IMensagem): string {
    return msg.texto ?? '';
  }

  // ── Context menu ──────────────────────────────────────────────────────────
  onFwContextMenu(e: MouseEvent, msg: IMensagem, win: IChatWindow): void {
    e.preventDefault();
    if (msg.type !== 'MENSAGEM') return;
    const MENU_W = 190, MENU_H = 330;
    const x = Math.min(e.clientX + 4, window.innerWidth  - MENU_W - 8);
    const y = Math.min(e.clientY + 4, window.innerHeight - MENU_H - 8);
    this.fwCtxMenu = { msg, win, x, y };
  }

  onFwBubbleClick(e: MouseEvent, msg: IMensagem, win: IChatWindow): void {
    e.preventDefault();
    e.stopPropagation();
    if (this.fwCtxMenu?.msg === msg) { this.fecharCtxMenu(); return; }
    this.onFwContextMenu(e, msg, win);
  }

  fecharCtxMenu(): void { this.fwCtxMenu = null; }

  // ── Reactions ─────────────────────────────────────────────────────────────

  private _fwReactionKey(win: IChatWindow, msg: IMensagem): string {
    return `${win.userId}_${this._fwKey(msg)}`;
  }

  toggleFwReactionPicker(e: MouseEvent, msg: IMensagem, win: IChatWindow): void {
    e.stopPropagation();
    const key = this._fwReactionKey(win, msg);
    this.fwReactionPickerMsg = this.fwReactionPickerMsg === key ? null : key;
    this.fwCtxMenu = null;
  }

  closeFwReactionPicker(): void { this.fwReactionPickerMsg = null; }

  isFwReactionPickerOpen(msg: IMensagem, win: IChatWindow): boolean {
    return this.fwReactionPickerMsg === this._fwReactionKey(win, msg);
  }

  addFwReaction(msg: IMensagem, emoji: string, win: IChatWindow): void {
    const me = this.myEmail;
    const jaReagiu = msg.reactions?.some(r => r.username === me && r.emoji === emoji) ?? false;
    if (!msg.reactions) msg.reactions = [];
    msg.reactions = msg.reactions.filter(r => r.username !== me);
    if (!jaReagiu) msg.reactions.push({ emoji, username: me });
    this.cdr.detectChanges();
    this.fwReactionPickerMsg = null;

    if (this.connected) {
      const reactionMsg: IMensagem = {
        texto: '', type: 'REACTION',
        username: me, color: '',
        timestamp: new Date().toISOString(),
        sala: this.getConversaId(win.userId), status: 'sent',
        destinatario: win.email,
        msgId: this._fwKey(msg),
        emoji: jaReagiu ? '' : emoji
      };
      this.chatService.publishMensagem(reactionMsg);
    }
  }

  hasMyFwReaction(msg: IMensagem, emoji: string): boolean {
    return msg.reactions?.some(r => r.username === this.myEmail && r.emoji === emoji) ?? false;
  }

  getFwReactions(msg: IMensagem): { emoji: string; count: number; mine: boolean }[] {
    if (!msg.reactions || msg.reactions.length === 0) return [];
    const me = this.myEmail;
    const emojiMap = new Map<string, { count: number; mine: boolean }>();
    msg.reactions.forEach(r => {
      const ex = emojiMap.get(r.emoji) || { count: 0, mine: false };
      emojiMap.set(r.emoji, { count: ex.count + 1, mine: ex.mine || r.username === me });
    });
    return Array.from(emojiMap.entries()).map(([emoji, v]) => ({ emoji, ...v }));
  }

  hasFwReactions(msg: IMensagem): boolean { return (msg.reactions?.length ?? 0) > 0; }

  // ── Ações do menu ─────────────────────────────────────────────────────────
  fwMostrarInfo(): void {
    if (!this.fwCtxMenu) return;
    this.fwInfoMsg = this.fwCtxMenu.msg;
    this.fecharCtxMenu();
  }

  fwResponder(): void {
    if (!this.fwCtxMenu) return;
    const { msg, win } = this.fwCtxMenu;
    this.fwResposta[win.userId] = msg;
    this.fecharCtxMenu();
  }

  cancelarFwResposta(win: IChatWindow): void {
    delete this.fwResposta[win.userId];
  }

  async fwCopiar(): Promise<void> {
    if (!this.fwCtxMenu) return;
    const texto = this.getFwTexto(this.fwCtxMenu.msg);
    this.fecharCtxMenu();
    try { await navigator.clipboard.writeText(texto); } catch { /* ignore */ }
    this.toast.success('Mensagem copiada!', '', { timeOut: 1500 });
  }

  fwToggleFixar(): void {
    if (!this.fwCtxMenu) return;
    const key = this._fwKey(this.fwCtxMenu.msg);
    if (this.fwPinnedMsgs.has(key)) { this.fwPinnedMsgs.delete(key); this.toast.info('Desafixada.', '', { timeOut: 1200 }); }
    else { this.fwPinnedMsgs.add(key); this.toast.info('Fixada!', '', { timeOut: 1200 }); }
    this.fecharCtxMenu();
  }

  fwToggleFavoritar(): void {
    if (!this.fwCtxMenu) return;
    const key = this._fwKey(this.fwCtxMenu.msg);
    if (this.fwFavoritedMsgs.has(key)) { this.fwFavoritedMsgs.delete(key); this.toast.info('Removida dos favoritos.', '', { timeOut: 1200 }); }
    else { this.fwFavoritedMsgs.add(key); this.toast.success('Favorita!', '', { timeOut: 1200 }); }
    this.fecharCtxMenu();
  }

  fwEditar(): void {
    if (!this.fwCtxMenu) return;
    const { msg, win } = this.fwCtxMenu;
    this.fwEditando[win.userId] = msg;
    this.textos[win.userId] = this.getFwTexto(msg);
    this.fecharCtxMenu();
  }

  private _salvarFwEdicao(win: IChatWindow): void {
    const msg = this.fwEditando[win.userId];
    if (!msg) return;
    const novoTexto = this.textos[win.userId]?.trim();
    if (novoTexto) {
      // ── Calcula a chave ANTES da mutação optimista para que o destinatário
      //    consiga identificar a mensagem original pelo mesmo msgId.
      const msgKey = this._fwKey(msg);
      // Atualização optimista: muta o objeto (mesma referência do msgStoreMap)
      msg.texto   = novoTexto;
      msg.editada = true;
      this.cdr.detectChanges();
      // Publica para o outro usuário via WebSocket
      if (this.connected) {
        const editMsg: IMensagem = {
          texto: '', type: 'EDIT_MSG',
          username: this.myEmail, color: '',
          timestamp: new Date().toISOString(),
          sala: this.getConversaId(win.userId), status: 'sent',
          destinatario: win.email,
          msgId: msgKey, novoTexto
        };
        this.chatService.publishMensagem(editMsg);
      }
    }
    this.cancelarFwEdicao(win);
    this.toast.success('Mensagem editada!', '', { timeOut: 1500 });
  }

  cancelarFwEdicao(win: IChatWindow): void {
    this.fwEditando[win.userId] = null;
    this.textos[win.userId]     = '';
  }

  fwApagar(): void {
    if (!this.fwCtxMenu) return;
    const msg = this.fwCtxMenu.msg;
    const win = this.fwCtxMenu.win;   // salva antes de fechar o menu
    // Atualização optimista
    msg.apagada = true;
    this.cdr.detectChanges();
    this.fecharCtxMenu();
    this.toast.info('Mensagem apagada.', '', { timeOut: 1500 });
    // Publica para o outro usuário via WebSocket
    if (this.connected) {
      const deleteMsg: IMensagem = {
        texto: '', type: 'DELETE_MSG',
        username: this.myEmail, color: '',
        timestamp: new Date().toISOString(),
        sala: this.getConversaId(win.userId),
        status: 'sent',
        destinatario: win.email,
        msgId: this._fwKey(msg)
      };
      this.chatService.publishMensagem(deleteMsg);
    }
  }

  // ── Status helpers ────────────────────────────────────────────────────────
  fwGetStatusIcon(status: string | undefined): string {
    switch (status) {
      case 'sent':      return 'done';
      case 'delivered': return 'done_all';
      case 'read':      return 'done_all';
      default:          return 'schedule';
    }
  }

  fwGetStatusLabel(status: string | undefined): string {
    switch (status) {
      case 'sent':      return 'Enviada ✓';
      case 'delivered': return 'Entregue ✓✓';
      case 'read':      return 'Lida ✓✓';
      default:          return 'Pendente...';
    }
  }

  formatFullDate(iso: string | undefined): string {
    if (!iso) return 'Desconhecido';
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  getConversaId(userId: string): string {
    if (!this.myUserId || !userId) return `dm_${userId}`;
    const a = parseInt(this.myUserId, 10);
    const b = parseInt(userId, 10);
    return `dm_${Math.min(a, b)}_${Math.max(a, b)}`;
  }

  isOnline(email: string): boolean { return this.usuariosOnline.includes(email); }
  isMeu(msg: IMensagem): boolean   { return msg.username === this.myEmail; }

  getFotoDoContato(win: IChatWindow): string | undefined { return win.fotoPerfil; }

  get minhaFoto(): string | undefined {
    return this.usuarios.find(u => u.email === this.myEmail)?.fotoPerfil;
  }

  getInitials(nome: string): string {
    if (!nome) return '?';
    const p = nome.trim().split(' ');
    return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : nome.substring(0, 2).toUpperCase();
  }

  formatTime(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  getLastSeen(email: string): string | null { return this.chatService.getLastSeen(email); }

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

  /** Offset horizontal para cada janela (esquerda da bolha) */
  windowRight(index: number): number {
    return 92 + index * 308;
  }

  private _scrollToBottom(userId: string): void {
    try {
      const el = document.getElementById(`fw-msgs-${userId}`);
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }
}
