import {
  Component, OnInit, OnDestroy, AfterViewChecked
} from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { Subscription } from 'rxjs';
import { ChatService, IEscrevendo, ConexaoStatus }  from '../../../services/chat.service';
import { ChatWindowService, IChatWindow } from '../../../services/chat-window.service';
import { UsuarioService }    from '../../../services/usuario.service';
import { IMensagem }         from '../../../models/mensagem';
import { IUsuario }          from '../../../models/usuario';

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
  escrevendo: { [userId: string]: string } = {};
  // Scroll pendente por janela: userId → boolean
  private shouldScrolls: { [userId: string]: boolean } = {};
  // Timers para apagar indicador de digitação por janela
  private typingTimers:  { [userId: string]: any }     = {};
  // Timestamp do último evento "digitando" emitido por janela (throttle)
  private lastTypingEmit: { [userId: string]: number } = {};
  private readonly TYPING_THROTTLE_MS = 1500;

  private myEmail  = '';
  private myUserId = '';

  private windowsSub:    Subscription;
  private connectionSub: Subscription;
  private onlineSub:     Subscription;
  private mensagemSub:   Subscription;
  private escrevendoSub: Subscription;
  private leituraSub: Subscription;

  constructor(
    private chatService:       ChatService,
    private chatWindowService: ChatWindowService,
    private usuarioService:    UsuarioService
  ) {}

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

    // Carrega usuários → depois assina mensagens e pré-popula histórico
    this.usuarioService.findAll().subscribe(users => {
      this.usuarios = users;
      const me = users.find(u => u.email === this.myEmail);
      if (me) {
        this.myUserId = me.id.toString();
        this._subscribeToMessages();
      }
    });

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

  /** Assina mensagens apenas depois de conhecer o próprio userId */
  private _subscribeToMessages(): void {
    this.mensagemSub = this.chatService.getMensagem().subscribe(msg => {
      if (msg.type !== 'MENSAGEM') return;
      const sala = msg.sala || '';
      let win = this.windows.find(w => this.getConversaId(w.userId) === sala);

      // ── Se não há janela aberta para esta conversa e a mensagem vem de outra
      // pessoa, abre automaticamente uma janela minimizada (badge de não-lida).
      if (!win && msg.username !== this.myEmail) {
        const sender = this.usuarios.find(u => u.email === msg.username);
        if (sender) {
          // Abre minimizada — windowsSub atualiza this.windows de forma síncrona
          this.chatWindowService.open(sender, true);
          win = this.windows.find(w => this.getConversaId(w.userId) === sala);
        }
      }

      if (!win) return;

      msg.status = msg.username === this.myEmail ? 'sent' : 'delivered';

      if (win.minimized && msg.username !== this.myEmail) {
        this.chatWindowService.addUnread(win.userId);
      }
      if (!win.minimized) {
        this.shouldScrolls[win.userId] = true;
      }
    });
  }

  ngAfterViewChecked(): void {
    this.windows.forEach(w => {
      if (this.shouldScrolls[w.userId]) {
        this._scrollToBottom(w.userId);
        this.shouldScrolls[w.userId] = false;
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
    const texto = this.textos[win.userId]?.trim();
    if (!texto || !this.connected) return;

    const msg: IMensagem = {
      texto,
      type:         'MENSAGEM',
      username:     this.myEmail,
      color:        '',
      timestamp:    new Date().toISOString(),
      sala:         this.getConversaId(win.userId),
      status:       'sent',
      destinatario: win.email
    };
    this.chatService.publishMensagem(msg);
    this.textos[win.userId] = '';
    // Limpa indicador de digitação ao enviar
    this.escrevendo[win.userId] = '';
    if (this.typingTimers[win.userId]) {
      clearTimeout(this.typingTimers[win.userId]);
      delete this.typingTimers[win.userId];
    }
  }

  onKey(e: KeyboardEvent, win: IChatWindow): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.enviar(win); }
  }

  escrever(win: IChatWindow): void {
    if (!this.connected || !this.myUserId) return;
    const now = Date.now();
    if ((now - (this.lastTypingEmit[win.userId] || 0)) < this.TYPING_THROTTLE_MS) return;
    this.lastTypingEmit[win.userId] = now;
    this.chatService.publishEscrevendo(this.myEmail, this.getConversaId(win.userId));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  getConversaId(userId: string): string {
    if (!this.myUserId || !userId) return `dm_${userId}`;
    const a = parseInt(this.myUserId, 10);
    const b = parseInt(userId, 10);
    return `dm_${Math.min(a, b)}_${Math.max(a, b)}`;
  }

  isOnline(email: string): boolean {
    return this.usuariosOnline.includes(email);
  }

  isMeu(msg: IMensagem): boolean { return msg.username === this.myEmail; }

  /** Foto de perfil do contato pela janela */
  getFotoDoContato(win: IChatWindow): string | undefined {
    return win.fotoPerfil;
  }

  /** Foto do próprio usuário logado */
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

  getLastSeen(email: string): string | null {
    return this.chatService.getLastSeen(email);
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
