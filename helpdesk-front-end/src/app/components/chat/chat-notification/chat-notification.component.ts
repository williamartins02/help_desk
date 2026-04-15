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
  id:       string;   // email do remetente (chave única)
  email:    string;
  nome:     string;
  avatar?:  string;
  unread:   number;
  preview:  string;   // prévia da última mensagem
  online:   boolean;
  timerId:  any;
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

  private myEmail    = '';
  private usuarios:  IUsuario[] = [];
  private onlineList: string[]  = [];

  /** Duração da notificação antes do auto-dismiss (ms) */
  private readonly DISMISS_MS = 8000;

  private msgSub:    Subscription;
  private onlineSub: Subscription;

  constructor(
    private chatService:       ChatService,
    private chatWindowService: ChatWindowService,
    private usuarioService:    UsuarioService,
    private cdr:               ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.myEmail = this.chatService.getUsername();

    // Carrega lista de usuários para obter nomes e fotos
    this.usuarioService.findAll().subscribe(users => {
      this.usuarios = users;
    });

    // Monitora usuários online para atualizar o indicador
    this.onlineSub = this.chatService.getUsuariosOnline().subscribe(list => {
      this.onlineList = list;
      this.notifications.forEach(n => { n.online = list.includes(n.email); });
      this.cdr.detectChanges();
    });

    // Escuta mensagens em tempo-real — lógica completamente independente
    this.msgSub = this.chatService.getMensagem().subscribe(msg => {
      if (msg.type !== 'MENSAGEM')                           return;
      if (msg.username === this.myEmail)                     return; // própria mensagem
      if (msg.destinatario && msg.destinatario !== this.myEmail) return; // DM não é para mim

      this._exibirNotificacao(msg.username, msg.texto || '');
    });
  }

  private _exibirNotificacao(email: string, texto: string): void {
    const existente = this.notifications.find(n => n.id === email);

    if (existente) {
      // Atualiza notificação já visível: incrementa contador e reinicia timer
      existente.unread++;
      existente.preview = texto;
      clearTimeout(existente.timerId);
      existente.timerId = this._iniciarTimer(email);
    } else {
      // Cria nova notificação
      const user = this.usuarios.find(u => u.email === email);
      const notif: IChatNotif = {
        id:      email,
        email,
        nome:    user?.nome || email,
        avatar:  user?.fotoPerfil,
        unread:  1,
        preview: texto,
        online:  this.onlineList.includes(email),
        timerId: null
      };
      notif.timerId = this._iniciarTimer(email);
      this.notifications.push(notif);
    }
    this.cdr.detectChanges();
  }

  private _iniciarTimer(email: string): any {
    return setTimeout(() => this.fechar(email), this.DISMISS_MS);
  }

  /** Abre a janela de conversa e fecha a notificação */
  abrir(notif: IChatNotif): void {
    const user = this.usuarios.find(u => u.email === notif.email);
    if (user) {
      this.chatWindowService.open(user);
    }
    this.fechar(notif.id);
  }

  /** Fecha/descarta a notificação */
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
    this.notifications.forEach(n => clearTimeout(n.timerId));
  }
}

