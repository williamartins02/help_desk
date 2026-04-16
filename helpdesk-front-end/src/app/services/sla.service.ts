import { Injectable, OnDestroy } from '@angular/core';
import { Client, StompSubscription } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import { Subject } from 'rxjs';
import { API_CONFIG } from '../config/api.config';

export interface SlaAlert {
  chamadoId: number;
  titulo: string;
  statusSla: 'ALERTA' | 'ATRASADO';
  prioridade: string;
  nomeTecnico: string;
  tempoRestante: string;
}

@Injectable({ providedIn: 'root' })
export class SlaService implements OnDestroy {
  private client: Client;
  private subscription: StompSubscription | null = null;
  alert$ = new Subject<SlaAlert>();

  connect(): void {
    if (this.client && this.client.active) return;

    this.client = new Client({
      webSocketFactory: () => new SockJS(`${API_CONFIG.baseUrl}/chat-websocket`),
      reconnectDelay: 10000,
    });

    this.client.onConnect = () => {
      this.subscription = this.client.subscribe('/sla/alertas', (message) => {
        try {
          const alert: SlaAlert = JSON.parse(message.body);
          this.alert$.next(alert);
        } catch (e) {}
      });
    };

    this.client.activate();
  }

  disconnect(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    if (this.client) {
      this.client.deactivate();
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}

