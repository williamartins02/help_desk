import { Injectable, NgZone } from '@angular/core';
import { Client } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import { Subject, Observable } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

/**
 * Payload recebido via WebSocket quando uma Tarefa ou Chamado é atualizado.
 * Espelha o `AgendaEventoDTO` do backend.
 */
export interface AgendaEvento {
  /** "TAREFA_ATUALIZADA" | "CHAMADO_ATUALIZADO" | "CHAMADO_CRIADO" | "CHAMADO_REDISTRIBUIDO" */
  tipo: string;
  /** ID da entidade afetada */
  entityId: number;
  /** Novo status (código numérico) */
  novoStatus: number;
  /** ID do técnico responsável (destino em redistribuições) */
  tecnicoId: number;
  /** Mensagem descritiva */
  mensagem: string;
  /** ID do técnico de origem — preenchido apenas em CHAMADO_REDISTRIBUIDO */
  tecnicoOrigemId?: number;
}

/**
 * Serviço dedicado à sincronização em tempo real entre
 * Agenda de Tarefas e Central de Chamados via WebSocket STOMP.
 *
 * Sincronização bidirecional completa:
 * ```
 * Chamado ABERTO(0)     ↔  Tarefa PENDENTE(0)
 * Chamado ANDAMENTO(1)  ↔  Tarefa EM_EXECUCAO(1)
 * Chamado ENCERRADO(2)  ↔  Tarefa CONCLUIDO(2)
 * ```
 *
 * Fluxo Agenda → Central:
 * - Técnico clica "Iniciar"  → Tarefa EM_EXECUCAO  → Chamado ANDAMENTO  → ChamadoList recarrega ✅
 * - Técnico clica "Concluir" → Tarefa CONCLUIDO    → Chamado ENCERRADO  → ChamadoList recarrega ✅
 *
 * Fluxo Central → Agenda:
 * - Atendente muda para Em Andamento → Tarefa EM_EXECUCAO → Agenda recarrega ✅
 * - Atendente muda para Encerrado    → Tarefa CONCLUIDO   → Agenda recarrega ✅
 */
@Injectable({ providedIn: 'root' })
export class AgendaWsService {

  private client!: Client;
  private conectado = false;

  private _tarefaAtualizada  = new Subject<AgendaEvento>();
  private _chamadoAtualizado = new Subject<AgendaEvento>();

  /**
   * Emite quando uma Tarefa foi atualizada pelo backend.
   * Debounce de 300 ms para agrupar eventos rápidos e evitar recargas duplicadas.
   */
  readonly tarefaAtualizada$: Observable<AgendaEvento> =
    this._tarefaAtualizada.asObservable().pipe(debounceTime(300));

  /**
   * Emite quando um Chamado foi atualizado pelo backend.
   * Debounce de 300 ms para agrupar eventos rápidos e evitar recargas duplicadas.
   */
  readonly chamadoAtualizado$: Observable<AgendaEvento> =
    this._chamadoAtualizado.asObservable().pipe(debounceTime(300));

  constructor(private zone: NgZone) {}

  /**
   * Conecta ao broker STOMP e assina os dois tópicos da agenda.
   * Idempotente — ignora chamadas repetidas enquanto já conectado.
   */
  connect(): void {
    if (this.conectado) return;

    this.client = new Client();
    this.client.webSocketFactory = () =>
      new SockJS('http://localhost:8080/chat-websocket');

    this.client.onConnect = () => {
      this.zone.run(() => {
        this.conectado = true;

        // ── /agenda/tarefa-atualizada ─────────────────────────────────────
        // Disparado pelo backend quando o status de uma Tarefa muda.
        // A Central de Chamados assina este tópico e recarrega a lista.
        this.client.subscribe('/agenda/tarefa-atualizada', frame => {
          this.zone.run(() => {
            try {
              this._tarefaAtualizada.next(JSON.parse(frame.body));
            } catch { /* payload inesperado — ignorar */ }
          });
        });

        // ── /agenda/chamado-atualizado ────────────────────────────────────
        // Disparado pelo backend quando o status de um Chamado muda.
        // A Agenda assina este tópico e recarrega as tarefas do dia.
        this.client.subscribe('/agenda/chamado-atualizado', frame => {
          this.zone.run(() => {
            try {
              this._chamadoAtualizado.next(JSON.parse(frame.body));
            } catch { /* payload inesperado — ignorar */ }
          });
        });
      });
    };

    this.client.onDisconnect    = () => this.zone.run(() => { this.conectado = false; });
    this.client.onWebSocketClose = () => this.zone.run(() => { this.conectado = false; });

    this.client.activate();
  }

  /**
   * Desconecta do broker STOMP.
   * Deve ser chamado no `ngOnDestroy` dos componentes que utilizam este serviço.
   */
  disconnect(): void {
    if (this.client && this.conectado) {
      this.client.deactivate();
      this.conectado = false;
    }
  }
}
