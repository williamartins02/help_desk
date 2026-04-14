import { IMensagem } from '../../../models/mensagem';
import { IConversa } from '../../../models/conversa';
import {
  Component, OnInit, OnDestroy, AfterViewChecked,
  ViewChild, ElementRef
} from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { ActivatedRoute } from '@angular/router';
import { UsuarioService } from '../../../services/usuario.service';
import { ChatService, ConexaoStatus } from '../../../services/chat.service';
import { IUsuario } from '../../../models/usuario';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
  animations: [
    trigger('messageFade', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        animate('220ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('chatEnter', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(16px)' }),
        animate('320ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('loginEnter', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.96)' }),
        animate('280ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ])
    ]),
    trigger('typingEnter', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(6px)' }),
        animate('180ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('140ms ease-in', style({ opacity: 0, transform: 'translateY(6px)' }))
      ])
    ])
  ]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {

  @ViewChild('messagesArea') private messagesArea: ElementRef;

  // ── estado ────────────────────────────────────────────────────────────────
  connected  = false;
  escrevendo = '';
  searchQuery = '';
  showEmojiPicker = false;
  usuariosOnline: string[] = [];
  private shouldScroll = false;
  private typingTimer: any   = null;   // timeout para apagar indicador
  private lastTypingEmit = 0;          // timestamp do último evento "digitando" emitido
  private readonly TYPING_THROTTLE_MS = 1500;

  // ── estado de conexão em 3 estados ───────────────────────────────────────
  conexaoStatus: ConexaoStatus = 'offline';
  /** true assim que a primeira conexão for estabelecida (jamais volta a false) */
  hasEverConnected = false;

  // ── auto-scroll inteligente ───────────────────────────────────────────────
  isAtBottom       = true;   // usuário está próximo do final da conversa?
  newMessagesCount = 0;      // mensagens recebidas enquanto scrollado para cima


  // ── conversas ─────────────────────────────────────────────────────────────
  conversaAtiva: IConversa | null = null;

  // ── mensagem em edição ────────────────────────────────────────────────────
  mensagem: IMensagem = {
    texto: '', type: '', username: '', color: '',
    timestamp: '', sala: 'geral', status: 'sent'
  };

  // ── emojis ────────────────────────────────────────────────────────────────
  emojis = [
    '😊','😂','❤️','👍','🙏','🎉','🔥','💯','✅','👋',
    '🤝','📋','💬','📞','🔔','⚠️','✨','💡','📌','😎',
    '🏆','🚀','💪','🔍','⏰','📅','🔧','🛠️','📊','🗑️'
  ];

  private readonly AVATAR_CORES = [
    '#1565c0','#00838f','#2e7d32','#6a1b9a',
    '#c62828','#f57f17','#37474f','#00695c'
  ];

  usuarios: IUsuario[] = [];
  private myUserId = '';
  private openUserIdParam: string | null = null;  // query param da bubble

  // Estado persistente por sala (não pode ficar em objetos IConversa transientes)
  private naoLidasMap   = new Map<string, number>();
  private fixadaMap     = new Map<string, boolean>();
  private silenciadaMap = new Map<string, boolean>();

  private connectionSub: Subscription;
  private onlineSub:     Subscription;
  private mensagemSub:   Subscription;
  private escrevendoSub: Subscription;

  // Controle de toasts de usuários online já exibidos
  private toastsOnlineExibidos = new Set<string>();

  // Flag para indicar se o chat está visível (pode ser controlada por input ou serviço global se necessário)
  isChatVisivel: boolean = true; // Ajuste conforme integração com chat flutuante/modal

  constructor(
    private usuarioService: UsuarioService,
    private chatService: ChatService,
    private toast: ToastrService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Set username from ChatService (set during login)
    this.mensagem.username = this.chatService.getUsername();

    // Captura query param da bubble (openUser=<id>)
    this.route.queryParams.subscribe(params => {
      if (params['openUser']) this.openUserIdParam = params['openUser'];
    });

    this.usuarioService.findAllForChat().subscribe(users => {
      this.usuarios = users;
      // Discover my own ID to build canonical P2P room IDs
      const me = users.find(u => u.email === this.mensagem.username);
      if (me) {
        this.myUserId = me.id.toString();
        // Pré-carrega histórico de conversas da sessão atual
        users.forEach(u => {
          if (u.id === me.id) return; // ignora si mesmo
          const sala = this.getConversaId(u.id.toString());
          // Não precisa mais de msgMap local
          this.chatService.getMessageHistory(sala);
        });
      }

      // Auto-abrir conversa indicada pela bubble
      if (this.openUserIdParam) {
        const target = users.find(u => u.id.toString() === this.openUserIdParam);
        if (target) {
          const convId = this.getConversaId(target.id.toString());
          // Não precisa mais de msgMap local
          const conv: IConversa = {
            id:             convId,
            nome:           target.nome,
            cor:            this.getAvatarCor(target.nome),
            online:         this.usuariosOnline.includes(target.email),
            ultimaMensagem: '',
            timestamp:      new Date().toISOString(),
            naoLidas:       0,
            fixada:         false,
            silenciada:     false
          };
          this.selecionarConversa(conv);
        }
        this.openUserIdParam = null;
      }
    });
    // Subscribe to ChatService connection state (3-state)
    this.connectionSub = this.chatService.getConexaoStatus().subscribe(status => {
      this.conexaoStatus = status;
      this.connected     = status === 'conectado';
      if (status === 'conectado') this.hasEverConnected = true;
    });
    // Subscribe to online users
    this.onlineSub = this.chatService.getUsuariosOnline().subscribe(onlineList => {
      // Notificação visual para novos online
      const novos = onlineList.filter(u => !this.usuariosOnline.includes(u));
      if (novos.length > 0) {
        novos.forEach(u => {
          if (!this.toastsOnlineExibidos.has(u)) {
            this.toast.info(`${u} está online!`, 'Usuário ativo', { timeOut: 3000 });
            this.toastsOnlineExibidos.add(u);
          }
        });
      }
      this.usuariosOnline = onlineList;
    });

    // Subscribe to individual incoming messages
    this.mensagemSub = this.chatService.getMensagem().subscribe(msg => {
      this._receberMensagem(msg);
    });

    // Subscribe to typing indicator — filtrado por sala ativa
    this.escrevendoSub = this.chatService.getEscrevendo().subscribe(payload => {
      // Ignora próprias digitações e eventos de outras salas
      if (payload.username === this.mensagem.username) return;
      if (payload.sala !== this.conversaAtiva?.id) return;

      this.escrevendo = 'digitando...';
      if (this.typingTimer) clearTimeout(this.typingTimer);
      this.typingTimer = setTimeout(() => { this.escrevendo = ''; }, 3000);
    });
    this._initConversas();  // inicializa msgMap vazio, sem definir conversaAtiva
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this._scrollToBottom();
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    if (this.connectionSub)  this.connectionSub.unsubscribe();
    if (this.onlineSub)      this.onlineSub.unsubscribe();
    if (this.mensagemSub)    this.mensagemSub.unsubscribe();
    if (this.escrevendoSub)  this.escrevendoSub.unsubscribe();
    if (this.typingTimer)    clearTimeout(this.typingTimer);
  }

  // ── conversas ─────────────────────────────────────────────────────────────
  private _initConversas(): void {
    // Inicializa apenas o estado, sem msgMap
    this.conversaAtiva = null;
  }

  // ── Recebimento ──────────────────────────────────────────────────────────
  private _receberMensagem(msg: IMensagem): void {
    const sala = msg.sala || 'geral';
    // Não armazena mais localmente, pois o ChatService já faz isso
    if (msg.type === 'MENSAGEM') {
      msg.status = this.mensagem.username === msg.username ? 'read' : 'delivered';
      // Notificação quando a mensagem é de outro usuário e não está na conversa ativa
      const conversaEstaAtiva = this.conversaAtiva?.id === sala && this.isChatVisivel;
      if (msg.username !== this.mensagem.username && !conversaEstaAtiva) {
        const sender = this.usuarios.find(u => u.email === msg.username);
        const nome   = sender?.nome || msg.username;
        this.toast.info(`Nova mensagem de <b>${nome}</b>`, '💬 Chat',
          { timeOut: 4000, enableHtml: true });
        // Incrementa contador persistente apenas se não silenciada
        if (!this.silenciadaMap.get(sala)) {
          this.naoLidasMap.set(sala, (this.naoLidasMap.get(sala) ?? 0) + 1);
        }
      }
    }
    // Não precisa mais de msgMap local
    if (this.conversaAtiva?.id === sala) {
      if (this.isAtBottom) {
        this.shouldScroll = true;
      } else if (msg.type === 'MENSAGEM') {
        this.newMessagesCount++;
      }
    }
  }

  get mensagensAtivas(): IMensagem[] {
    if (!this.conversaAtiva) return [];
    // Busca sempre do ChatService para garantir sincronização
    return this.chatService.getMessageHistory(this.conversaAtiva.id) || [];
  }

  // ── Envio ─────────────────────────────────────────────────────────────────
  enviarMensagem(): void {
    if (!this.mensagem.texto?.trim() || !this.connected) return;
    const msg: IMensagem = {
      ...this.mensagem,
      type:         'MENSAGEM',
      sala:         this.conversaAtiva?.id || 'geral',
      timestamp:    new Date().toISOString(),
      status:       'sent',
      destinatario: this.conversaAtiva?.email
    };
    this.chatService.publishMensagem(msg);
    this.mensagem.texto     = '';
    this.showEmojiPicker    = false;
    // Limpa indicador de digitação ao enviar
    this.escrevendo = '';
    if (this.typingTimer) { clearTimeout(this.typingTimer); this.typingTimer = null; }
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.enviarMensagem(); }
  }

  escreverEvento(): void {
    if (!this.connected || !this.conversaAtiva) return;
    const now = Date.now();
    if (now - this.lastTypingEmit < this.TYPING_THROTTLE_MS) return;
    this.lastTypingEmit = now;
    this.chatService.publishEscrevendo(this.mensagem.username, this.conversaAtiva.id);
  }

  // ── Conversas ─────────────────────────────────────────────────────────────
  selecionarConversa(conv: IConversa): void {
    this.conversaAtiva = conv;
    this.naoLidasMap.set(conv.id, 0);
    this.shouldScroll    = true;
    this.showEmojiPicker = false;
    // Limpa indicador da conversa anterior
    this.escrevendo = '';
    if (this.typingTimer) { clearTimeout(this.typingTimer); this.typingTimer = null; }
    // Marca todas as mensagens da conversa como lidas
    const msgs = this.chatService.getMessageHistory(conv.id) || [];
    msgs.filter(m => m.status !== 'read' && m.username !== this.mensagem.username && m.id)
      .forEach(m => this.chatService.marcarComoLida(m));
  }

  /** Mapeia um IUsuario → IConversa (reutilizável) */
  private _mapUserToConversa(u: IUsuario): IConversa {
    const convId = this.getConversaId(u.id.toString());
    // Não precisa mais de msgMap local
    return {
      id:             convId,
      nome:           u.nome,
      email:          u.email,
      cor:            this.getAvatarCor(u.nome),
      online:         this.usuariosOnline.includes(u.email),
      ultimaMensagem: (this.chatService.getMessageHistory(convId)?.slice(-1)[0]?.texto) || '',
      timestamp:      (this.chatService.getMessageHistory(convId)?.slice(-1)[0]?.timestamp) || '',
      naoLidas:       this.naoLidasMap.get(convId) ?? 0,
      fixada:         this.fixadaMap.get(convId) ?? false,
      silenciada:     this.silenciadaMap.get(convId) ?? false,
      lastSeen:       this.chatService.getLastSeen(u.email) || undefined,
      fotoPerfil:     u.fotoPerfil
    };
  }

  /**
   * Ordena: online primeiro (por nome), depois offline (ordem original de cadastro)
   */
  private _sortOnlineTopOfflineOriginal(users: IUsuario[]): IUsuario[] {
    const online = users.filter(u => this.usuariosOnline.includes(u.email));
    const offline = users.filter(u => !this.usuariosOnline.includes(u.email));
    // Online ordenados por nome
    online.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    // Offline mantém ordem original (já está em 'users')
    return [...online, ...offline];
  }

  /** Técnicos (filtrados pela busca, online topo, offline ordem original) */
  get tecnicosFiltrados(): IConversa[] {
    const q = this.searchQuery.toLowerCase();
    const filtered = this.usuarios
      .filter(u => u.tipo === 'TECNICO')
      .filter(u => u.email !== this.mensagem.username)
      .filter(u => !q || u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    return this._sortOnlineTopOfflineOriginal(filtered).map(u => this._mapUserToConversa(u));
  }

  /** Clientes (filtrados pela busca, online topo, offline ordem original) */
  get clientesFiltrados(): IConversa[] {
    const q = this.searchQuery.toLowerCase();
    const filtered = this.usuarios
      .filter(u => u.tipo === 'CLIENTE')
      .filter(u => u.email !== this.mensagem.username)
      .filter(u => !q || u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    return this._sortOnlineTopOfflineOriginal(filtered).map(u => this._mapUserToConversa(u));
  }

  /** Gera um ID de sala canônico e bidirecional entre dois usuários. */
  private getConversaId(otherId: string): string {
    if (!this.myUserId || !otherId) return otherId || 'geral';
    const a = parseInt(this.myUserId, 10);
    const b = parseInt(otherId, 10);
    return `dm_${Math.min(a, b)}_${Math.max(a, b)}`;
  }


  fixarConversa(conv: IConversa, e: Event): void {
    e.stopPropagation();
    this.fixadaMap.set(conv.id, !(this.fixadaMap.get(conv.id) ?? false));
  }

  silenciarConversa(conv: IConversa, e: Event): void {
    e.stopPropagation();
    this.silenciadaMap.set(conv.id, !(this.silenciadaMap.get(conv.id) ?? false));
  }


  // ── UI helpers ────────────────────────────────────────────────────────────
  isMeu(msg: IMensagem): boolean { return msg.username === this.mensagem.username; }

  /** Resolve email → nome real do usuário (fallback = email) */
  getNomeByEmail(email: string): string {
    if (!email) return '';
    const u = this.usuarios.find(u => u.email === email);
    return u?.nome || email;
  }

  /** Nome exibido do usuário logado */
  get meuNome(): string { return this.getNomeByEmail(this.mensagem.username); }

  /** Foto de perfil do usuário logado */
  get minhaFoto(): string | undefined {
    return this.usuarios.find(u => u.email === this.mensagem.username)?.fotoPerfil;
  }

  /** Foto de perfil de qualquer usuário pelo e-mail */
  getFotoByEmail(email: string): string | undefined {
    return this.usuarios.find(u => u.email === email)?.fotoPerfil;
  }

  getInitials(nome: string): string {
    if (!nome) return '?';
    const p = nome.trim().split(' ');
    return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : nome.substring(0, 2).toUpperCase();
  }

  getAvatarCor(nome: string): string {
    if (!nome) return this.AVATAR_CORES[0];
    let h = 0;
    for (let i = 0; i < nome.length; i++) h += nome.charCodeAt(i);
    return this.AVATAR_CORES[h % this.AVATAR_CORES.length];
  }

  formatTime(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  /** Formata "último horário visto" de forma legível */
  formatLastSeen(iso: string | undefined): string {
    if (!iso) return '';
    const d     = new Date(iso);
    const hoje  = new Date();
    const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
    const time  = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === hoje.toDateString())  return `hoje às ${time}`;
    if (d.toDateString() === ontem.toDateString()) return `ontem às ${time}`;
    return `${d.toLocaleDateString('pt-BR')} às ${time}`;
  }

  formatDateLabel(iso: string): string {
    if (!iso) return '';
    const d    = new Date(iso);
    const hoje = new Date();
    const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
    if (d.toDateString() === hoje.toDateString())  return 'Hoje';
    if (d.toDateString() === ontem.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR');
  }

  showDateSep(msgs: IMensagem[], i: number): boolean {
    if (i === 0) return true;
    return new Date(msgs[i].timestamp || '').toDateString() !==
           new Date(msgs[i - 1].timestamp || '').toDateString();
  }

  inserirEmoji(emoji: string): void { this.mensagem.texto = (this.mensagem.texto || '') + emoji; }
  toggleEmoji(): void { this.showEmojiPicker = !this.showEmojiPicker; }
  fecharEmoji(): void { if (this.showEmojiPicker) this.showEmojiPicker = false; }

  private _scrollToBottom(): void {
    try {
      const el = this.messagesArea?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  /** Chamado pelo evento (scroll) do container de mensagens */
  onMessagesScroll(): void {
    const el = this.messagesArea?.nativeElement;
    if (!el) return;
    const THRESHOLD = 80; // px de tolerância
    this.isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < THRESHOLD;
    if (this.isAtBottom) {
      this.newMessagesCount = 0;
    }
  }

  /** Clique no botão flutuante "Novas mensagens ↓" */
  scrollToLatest(): void {
    const el = this.messagesArea?.nativeElement;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      this.newMessagesCount = 0;
      this.isAtBottom       = true;
    }
  }
}
