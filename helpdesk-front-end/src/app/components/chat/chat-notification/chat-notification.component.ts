import {
  Component, OnInit, OnDestroy, ChangeDetectorRef
} from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { Subscription } from 'rxjs';
import { ChatService }       from '../../../services/chat.service';
import { ChatWindowService } from '../../../services/chat-window.service';
import { UsuarioService }    from '../../../services/usuario.service';
import { IUsuario }          from '../../../models/usuario';

/** Notificação individual por remetente */
interface IChatNotif {
  id:      string;    // email do remetente (chave única)
  email:   string;
  nome:    string;
  user?:   IUsuario;  // objeto completo quando disponível (para abrir a janela)
  avatar?: string;
  unread:  number;
  preview: string;    // prévia da última mensagem
  online:  boolean;
  timerId: any;
}

@Component({
  selector:    'app-chat-notification',
  templateUrl: './chat-notification.component.html',
  styleUrls:   ['./chat-notification.component.css'],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(24px) scale(0.96)' }),
        animate('230ms ease-out', style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('180ms ease-in', style({ opacity: 0, transform: 'translateY(24px) scale(0.96)' }))
      ])
    ])
  ]
})
export class ChatNotificationComponent implements OnInit, OnDestroy {

  /** Lista de notificações visíveis (uma por remetente) */
  notifications: IChatNotif[] = [];

  private myEmail     = '';
  private usuarios:   IUsuario[] = [];
  private onlineList: string[]   = [];

  /** Duração da notificação antes do auto-dismiss (ms) */
  private readonly DISMISS_MS = 8000;

  private msgSub:     Subscription;
  private onlineSub:  Subscription;
  private windowsSub: Subscription;

  constructor(
    private chatService:       ChatService,
    private chatWindowService: ChatWindowService,
    private usuarioService:    UsuarioService,
    private cdr:               ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.myEmail = this.chatService.getUsername();

    // Carrega lista de usuários para obter nomes, fotos e objetos IUsuario.
    // Usa findAllForChat() que é acessível a TODOS os perfis (admin, técnico, cliente).
    this.usuarioService.findAllForChat().subscribe(users => {
      this.usuarios = users;
      // Preenche user? nas notificações que chegaram antes do findAllForChat()
      this.notifications.forEach(n => {
        if (!n.user) {
          const u = users.find(u => u.email === n.email);
          if (u) { n.nome = u.nome; n.avatar = u.fotoPerfil; n.user = u; }
        }
      });
    });

    // Monitora usuários online para atualizar o indicador de status
    this.onlineSub = this.chatService.getUsuariosOnline().subscribe(list => {
      this.onlineList = list;
      this.notifications.forEach(n => { n.online = list.includes(n.email); });
      this.cdr.detectChanges();
    });

    // Auto-dismiss quando o usuário abre a janela de conversa diretamente
    // (ex: clicando no bubble/floating-chat sem passar pelo modal de notificação)
    this.windowsSub = this.chatWindowService.windows$.subscribe(wins => {
      const removidos: string[] = [];
      this.notifications.forEach(notif => {
        const win = wins.find(w => w.email === notif.email);
        if (win && !win.minimized) {
          // Janela aberta → usuário está vendo o chat → descarta o modal
          clearTimeout(notif.timerId);
          removidos.push(notif.id);
        }
      });
      if (removidos.length > 0) {
        this.notifications = this.notifications.filter(n => !removidos.includes(n.id));
        this.cdr.detectChanges();
      }
    });

    // Escuta mensagens em tempo-real — lógica completamente independente
    this.msgSub = this.chatService.getMensagem().subscribe(msg => {
      if (msg.type !== 'MENSAGEM')                                return;
      if (msg.username === this.myEmail)                          return;
      if (msg.destinatario && msg.destinatario !== this.myEmail)  return;

      this._exibirNotificacao(msg.username, msg.texto || '');
    });
  }

  private _exibirNotificacao(email: string, texto: string): void {
    // Não mostrar notificação se o usuário já está visualizando esta conversa
    // (janela flutuante aberta ou chat principal com esta conversa ativa)
    if (this.chatWindowService.isBeingViewed(email)) {
      this.chatWindowService.clearUnreadByEmail(email);
      return;
    }

    const user      = this.usuarios.find(u => u.email === email);
    const existente = this.notifications.find(n => n.id === email);

    if (existente) {
      // Atualiza notificação já visível: incrementa contador e reinicia timer
      existente.unread++;
      existente.preview = texto;
      if (user && !existente.user) { existente.user = user; existente.nome = user.nome; existente.avatar = user.fotoPerfil; }
      clearTimeout(existente.timerId);
      existente.timerId = this._iniciarTimer(email);
    } else {
      // Cria nova notificação
      const notif: IChatNotif = {
        id:      email,
        email,
        nome:    user?.nome || email,
        user,
        avatar:  user?.fotoPerfil,
        unread:  1,
        preview: texto,
        online:  this.onlineList.includes(email),
        timerId: null
      };
      notif.timerId = this._iniciarTimer(email);
      this.notifications.push(notif);
    }

    // Incrementa o badge do FAB (ícone de bolha) — fonte única para o contador do ícone
    this.chatWindowService.incrementUnreadByEmail(email);
    this.cdr.detectChanges();
  }

  private _iniciarTimer(email: string): any {
    return setTimeout(() => this.fechar(email), this.DISMISS_MS);
  }

  /**
   * Abre a janela de conversa flutuante e fecha o modal de notificação.
   * Também zera o contador (badge do FAB e badge da janela).
   */
  abrir(notif: IChatNotif): void {
    // 1. Caminho mais comum: FloatingChatComponent já criou a janela minimizada
    //    quando a mensagem chegou → basta maximizá-la pelo e-mail (não precisa do IUsuario).
    if (this.chatWindowService.maximizeByEmail(notif.email)) {
        // windowsSub já remove a notificação via auto-dismiss, mas garante remoção
      this.fechar(notif.id);
      return;
    }

    // 2. Janela ainda não existe → criá-la aberta com o objeto IUsuario
    const user = notif.user || this.usuarios.find(u => u.email === notif.email);
    if (user) {
      this.chatWindowService.open(user);           // abre expandida (minimized=false)
      this.chatWindowService.clearUnreadByEmail(notif.email);
      this.fechar(notif.id);
      return;
    }

    // 3. Race condition: lista de usuários ainda não carregada → recarrega e tenta novamente.
    // Usa findAllForChat() que é acessível a TODOS os perfis.
    this.usuarioService.findAllForChat().subscribe(users => {
      this.usuarios = users;
      this.notifications.forEach(n => {
        if (!n.user) {
          const u = users.find(u => u.email === n.email);
          if (u) { n.nome = u.nome; n.avatar = u.fotoPerfil; n.user = u; }
        }
      });
      // Tenta maximizar novamente (FloatingChat pode ter criado a janela nesse interim)
      if (!this.chatWindowService.maximizeByEmail(notif.email)) {
        const u = users.find(u => u.email === notif.email);
        if (u) this.chatWindowService.open(u);     // abre expandida
      }
      this.chatWindowService.clearUnreadByEmail(notif.email);
      this.fechar(notif.id);
      this.cdr.detectChanges();
    });
  }

  /**
   * Fecha/descarta o modal de notificação sem abrir o chat.
   * O badge do FAB permanece até o usuário ler as mensagens.
   */
  fechar(id: string): void {
    const idx = this.notifications.findIndex(n => n.id === id);
    if (idx === -1) return;
    clearTimeout(this.notifications[idx].timerId);
    this.notifications.splice(idx, 1);
    this.cdr.detectChanges();
  }

  trackById(_: number, n: IChatNotif): string { return n.id; }

  // ── Helpers de UI ─────────────────────────────────────────────────────────

  getInitials(nome: string): string {
    if (!nome) return '?';
    const p = nome.trim().split(' ');
    return p.length >= 2
      ? (p[0][0] + p[1][0]).toUpperCase()
      : nome.substring(0, 2).toUpperCase();
  }

  getAvatarColor(nome: string): string {
    const cores = ['#1565c0', '#00838f', '#2e7d32', '#6a1b9a', '#c62828', '#f57f17'];
    if (!nome) return cores[0];
    let h = 0;
    for (let i = 0; i < nome.length; i++) h += nome.charCodeAt(i);
    return cores[h % cores.length];
  }

  truncar(texto: string, max = 34): string {
    return texto.length > max ? texto.substring(0, max) + '…' : texto;
  }

  ngOnDestroy(): void {
    this.msgSub?.unsubscribe();
    this.onlineSub?.unsubscribe();
    this.windowsSub?.unsubscribe();
    this.notifications.forEach(n => clearTimeout(n.timerId));
  }
}

