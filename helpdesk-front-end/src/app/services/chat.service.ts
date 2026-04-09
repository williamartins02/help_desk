import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Client } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { IMensagem } from '../models/mensagem';
import { API_CONFIG } from '../config/api.config';

export interface INotificacao {
  remetente: string;
  texto:     string;
  /** Definido quando a notificação agrupa N mensagens pendentes (offline delivery). */
  qtd?:      number;
}

/** Payload do evento "está digitando", com escopo de sala. */
export interface IEscrevendo {
  username: string;
  sala:     string;
}

/** Estado da conexão WebSocket/STOMP em tempo real. */
export type ConexaoStatus = 'conectado' | 'reconectando' | 'offline';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private client: Client;
  private usuariosOnlineSubject  = new BehaviorSubject<string[]>([]);
  private mensagemSubject        = new Subject<IMensagem>();
  private escrevendoSubject      = new Subject<IEscrevendo>();
  private conectadoSubject       = new BehaviorSubject<boolean>(false);
  private notificacaoSubject     = new Subject<INotificacao>();
  private leituraSubject         = new Subject<IMensagem>();

  /** Estado de conexão em três estados: conectado | reconectando | offline */
  private conexaoStatusSubject   = new BehaviorSubject<ConexaoStatus>('offline');
  /** Flag que distingue desconexão manual de falha de rede */
  private manuallyDisconnected   = false;

  /** email → ISO timestamp do último momento online */
  private lastSeenMap  = new Map<string, string>();
  /** sala (dm_X_Y) → últimas N mensagens da sessão */
  private msgStoreMap  = new Map<string, IMensagem[]>();
  private readonly MSG_MAX_PER_SALA = 100;

  private username: string = '';
  private conectado = false;

  constructor(private zone: NgZone, private http: HttpClient) {}

  connect(username: string) {
    if (this.conectado) return;
    this.username = username;
    this.manuallyDisconnected = false;
    this.conexaoStatusSubject.next('reconectando');

    this.client = new Client();
    this.client.webSocketFactory = () => new SockJS('http://localhost:8080/chat-websocket');
    this.client.onConnect = () => {
      this.zone.run(() => {
        this.conectado = true;
        this.conectadoSubject.next(true);
        this.conexaoStatusSubject.next('conectado');

        // ── Mensagens e presença ─────────────────────────────────────────
        this.client.subscribe('/chat/message', e => {
          this.zone.run(() => {
            const msg: IMensagem = JSON.parse(e.body);
            if (msg.type === 'NEW_USER') {
              const online = this.usuariosOnlineSubject.value;
              if (!online.includes(msg.username)) {
                this.usuariosOnlineSubject.next([...online, msg.username]);
              }
              this.mensagemSubject.next(msg);
            } else if (msg.type === 'USER_LEFT') {
              const online = this.usuariosOnlineSubject.value.filter(u => u !== msg.username);
              this.usuariosOnlineSubject.next(online);
              this.lastSeenMap.set(msg.username, new Date().toISOString());
            } else if (msg.type === 'MENSAGEM') {
              const sala = msg.sala || 'geral';
              if (!this.msgStoreMap.has(sala)) this.msgStoreMap.set(sala, []);
              const storedMsgs = this.msgStoreMap.get(sala)!;
              storedMsgs.push(msg);
              if (storedMsgs.length > this.MSG_MAX_PER_SALA) {
                storedMsgs.splice(0, storedMsgs.length - this.MSG_MAX_PER_SALA);
              }
              this.mensagemSubject.next(msg);
              if (msg.username !== this.username) {
                this.notificacaoSubject.next({ remetente: msg.username, texto: msg.texto });
              }
            }
          });
        });

        // ── Indicador de digitação ───────────────────────────────────────
        this.client.subscribe('/chat/escrevendo', e => {
          this.zone.run(() => {
            try {
              const payload: IEscrevendo = JSON.parse(e.body);
              this.escrevendoSubject.next(payload);
            } catch { /* corpo inesperado — ignorar */ }
          });
        });

        // ── Presença em tempo real ──────────────────────────────────────────
        this.client.subscribe('/chat/online', e => {
          this.zone.run(() => {
            try {
              const lista: string[] = JSON.parse(e.body);
              this.usuariosOnlineSubject.next(lista);
            } catch {
              // fallback: se vier como Set, converte
              const arr = Array.isArray(e.body) ? e.body : Array.from(JSON.parse(e.body));
              this.usuariosOnlineSubject.next(arr.map(String));
            }
          });
        });

        // ── Leitura de mensagens ───────────────────────────────────────────
        this.client.subscribe('/chat/read', e => {
          this.zone.run(() => {
            try {
              const leitura: IMensagem = JSON.parse(e.body);
              this.leituraSubject.next(leitura);
            } catch {}
          });
        });

        // Anuncia entrada do usuário
        const newUserMsg: IMensagem = {
          texto: '', type: 'NEW_USER', username: this.username,
          color: '', timestamp: new Date().toISOString(), sala: 'geral', status: 'sent'
        };
        this.client.publish({ destination: '/app/message', body: JSON.stringify(newUserMsg) });

        // Solicita lista de usuários online ao conectar
        this.client.publish({ destination: '/app/online', body: '' });

        // Busca mensagens recebidas enquanto estava offline
        this._buscarMensagensPendentes();
      });
    };
    this.client.onDisconnect = () => {
      this.zone.run(() => {
        this.conectado = false;
        this.conectadoSubject.next(false);
        this.usuariosOnlineSubject.next([]);
        if (!this.manuallyDisconnected) {
          this.conexaoStatusSubject.next('reconectando');
        } else {
          this.conexaoStatusSubject.next('offline');
        }
      });
    };

    // WebSocket fechado inesperadamente → tentativa de reconexão automática
    this.client.onWebSocketClose = () => {
      this.zone.run(() => {
        if (!this.manuallyDisconnected) {
          this.conexaoStatusSubject.next('reconectando');
        } else {
          this.conexaoStatusSubject.next('offline');
        }
      });
    };

    // Erro de protocolo STOMP → aguarda próxima tentativa de reconexão
    this.client.onStompError = (_frame) => {
      this.zone.run(() => {
        if (!this.manuallyDisconnected) {
          this.conexaoStatusSubject.next('reconectando');
        }
      });
    };

    this.client.activate();
  }

  disconnect() {
    if (this.client && this.conectado) {
      this.manuallyDisconnected = true;
      this.conexaoStatusSubject.next('offline');
      if (this.username) {
        this.lastSeenMap.set(this.username, new Date().toISOString());
        // Notifica outros usuários antes de desconectar
        const leftMsg: IMensagem = {
          texto: '', type: 'USER_LEFT', username: this.username,
          color: '', timestamp: new Date().toISOString(), sala: 'geral', status: 'sent'
        };
        this.client.publish({ destination: '/app/message', body: JSON.stringify(leftMsg) });
      }
      this.client.deactivate();
    }
  }

  publishMensagem(msg: IMensagem) {
    if (this.client && this.conectado) {
      this.client.publish({ destination: '/app/message', body: JSON.stringify(msg) });
    }
  }

  publishEscrevendo(username: string, sala: string) {
    if (this.client && this.conectado) {
      this.client.publish({
        destination: '/app/escrevendo',
        body: JSON.stringify({ username, sala } as IEscrevendo)
      });
    }
  }

  marcarComoLida(msg: IMensagem) {
    if (this.client && this.conectado && msg.id) {
      this.client.publish({ destination: '/app/read', body: JSON.stringify({ id: msg.id, username: this.username, destinatario: msg.username }) });
    }
  }

  getUsername(): string { return this.username; }

  getUsuariosOnline(): Observable<string[]>      { return this.usuariosOnlineSubject.asObservable(); }
  getMensagem():       Observable<IMensagem>      { return this.mensagemSubject.asObservable(); }
  getEscrevendo():     Observable<IEscrevendo>    { return this.escrevendoSubject.asObservable(); }
  isConectado():       Observable<boolean>        { return this.conectadoSubject.asObservable(); }
  getNotificacao():    Observable<INotificacao>   { return this.notificacaoSubject.asObservable(); }
  getLeitura():        Observable<IMensagem>       { return this.leituraSubject.asObservable(); }
  /** Observable com o estado de conexão em três estados: conectado | reconectando | offline */
  getConexaoStatus():  Observable<ConexaoStatus>  { return this.conexaoStatusSubject.asObservable(); }

  /** Retorna o último horário online de um usuário (email) */
  getLastSeen(email: string): string | null {
    return this.lastSeenMap.get(email) || null;
  }

  /** Retorna o histórico de mensagens de uma sala (cópia) */
  getMessageHistory(sala: string): IMensagem[] {
    return [...(this.msgStoreMap.get(sala) || [])];
  }

  /** Busca mensagens enviadas ao usuário enquanto estava offline e as injeta no histórico. */
  private _buscarMensagensPendentes(): void {
    this.http.get<IMensagem[]>(`${API_CONFIG.baseUrl}/api/chat/pendentes`).subscribe({
      next: (mensagens) => {
        this.zone.run(() => {
          if (!mensagens || mensagens.length === 0) return;

          // Agrupa por remetente para exibir uma notificação por sender
          const porRemetente = new Map<string, { msgs: IMensagem[]; ultimoTexto: string }>();

          mensagens.forEach(msg => {
            const sala = msg.sala || 'geral';
            if (!this.msgStoreMap.has(sala)) this.msgStoreMap.set(sala, []);
            const stored = this.msgStoreMap.get(sala)!;
            stored.push(msg);
            if (stored.length > this.MSG_MAX_PER_SALA) {
              stored.splice(0, stored.length - this.MSG_MAX_PER_SALA);
            }
            const rem = msg.username;
            if (!porRemetente.has(rem)) {
              porRemetente.set(rem, { msgs: [], ultimoTexto: msg.texto });
            }
            porRemetente.get(rem)!.msgs.push(msg);
            porRemetente.get(rem)!.ultimoTexto = msg.texto;
          });

          // Uma notificação por remetente, com contagem
          porRemetente.forEach((info, remetente) => {
            this.notificacaoSubject.next({
              remetente,
              texto: info.ultimoTexto,
              qtd:   info.msgs.length
            });
          });
        });
      },
      error: (err) => console.warn('[ChatService] Mensagens pendentes indisponíveis:', err)
    });
  }
}
