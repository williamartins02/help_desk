import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { IUsuario } from '../models/usuario';

export interface IChatWindow {
  userId:     string;
  email:      string;
  nome:       string;
  cor:        string;
  minimized:  boolean;
  naoLidas:   number;
  fotoPerfil?: string;  // Base64 data URL
}

@Injectable({ providedIn: 'root' })
export class ChatWindowService {

  private windowsSubject = new BehaviorSubject<IChatWindow[]>([]);
  windows$ = this.windowsSubject.asObservable();

  // ── Fonte única de verdade: não-lidas por e-mail de remetente ─────────────
  private unreadEmailSubject = new BehaviorSubject<Record<string, number>>({});
  /** Observable: email → quantidade de mensagens não lidas */
  unreadByEmail$ = this.unreadEmailSubject.asObservable();

  /** E-mail da conversa ativa no chat principal (evita contar enquanto visualiza) */
  private activeChatEmail: string | null = null;

  private readonly AVATAR_CORES = [
    '#1565c0', '#00838f', '#2e7d32', '#6a1b9a',
    '#c62828', '#f57f17', '#37474f', '#00695c'
  ];

  // ── Helpers internos ───────────────────────────────────────────────────────

  private _setEmailCount(email: string, count: number): void {
    const cur = { ...this.unreadEmailSubject.value };
    if (count <= 0) { delete cur[email]; }
    else            { cur[email] = count; }
    this.unreadEmailSubject.next(cur);
  }

  // ── API pública: contagem por e-mail ───────────────────────────────────────

  /** Incrementa 1 não-lida para o e-mail do remetente e sincroniza a janela. */
  incrementUnreadByEmail(email: string): void {
    const count = (this.unreadEmailSubject.value[email] ?? 0) + 1;
    this._setEmailCount(email, count);
    const wins = this.windowsSubject.value;
    const win  = wins.find(w => w.email === email);
    if (win && win.minimized) {
      win.naoLidas++;
      this.windowsSubject.next([...wins]);
    }
  }

  /** Adiciona N não-lidas de uma vez (ex: mensagens acumuladas offline). */
  addBatchUnreadByEmail(email: string, qtd: number): void {
    const count = (this.unreadEmailSubject.value[email] ?? 0) + qtd;
    this._setEmailCount(email, count);
    const wins = this.windowsSubject.value;
    const win  = wins.find(w => w.email === email);
    if (win && win.minimized) {
      win.naoLidas = (win.naoLidas ?? 0) + qtd;
      this.windowsSubject.next([...wins]);
    }
  }

  /** Zera as não-lidas de um remetente (conversa visualizada). */
  clearUnreadByEmail(email: string): void {
    if (!email) return;
    this._setEmailCount(email, 0);
    const wins = this.windowsSubject.value;
    const win  = wins.find(w => w.email === email);
    if (win && win.naoLidas > 0) {
      win.naoLidas = 0;
      this.windowsSubject.next([...wins]);
    }
  }

  /** Retorna a contagem atual de não-lidas para um e-mail. */
  getUnreadByEmail(email: string): number {
    return this.unreadEmailSubject.value[email] ?? 0;
  }

  /**
   * Retorna true se o usuário está ativamente visualizando esta conversa:
   * – janela flutuante aberta (não minimizada), OU
   * – chat principal com essa conversa selecionada.
   */
  isBeingViewed(email: string): boolean {
    if (this.activeChatEmail === email) return true;
    return this.windowsSubject.value.some(w => w.email === email && !w.minimized);
  }

  /**
   * Retorna true SOMENTE se o chat principal está com esta conversa selecionada.
   * Usado para suprimir toasts de notificação: janelas flutuantes abertas NÃO
   * suprimem o toast, pois o usuário pode não estar olhando para elas.
   */
  isMainChatActive(email: string): boolean {
    return this.activeChatEmail === email;
  }

  /**
   * Sinaliza qual e-mail está sendo visualizado no chat principal.
   * Limpa automaticamente as não-lidas quando a conversa é selecionada.
   * Passe null ao fechar/destruir o chat principal.
   */
  setActiveChatEmail(email: string | null): void {
    this.activeChatEmail = email;
    if (email) { this.clearUnreadByEmail(email); }
  }

  // ── Gestão de janelas ──────────────────────────────────────────────────────

  /**
   * Abre (ou traz ao foco) uma janela de DM para o usuário.
   * @param minimized  Se `true`, abre minimizada (para notificação silenciosa).
   *                   Não afeta janelas já abertas.
   */
  open(user: IUsuario, minimized = false): void {
    const windows  = this.windowsSubject.value;
    const existing = windows.find(w => w.userId === user.id.toString());
    if (existing) {
      if (!minimized) {
        // Abertura explícita pelo usuário: maximiza e zera não-lidas
        existing.minimized = false;
        existing.naoLidas  = 0;
        this._setEmailCount(existing.email, 0);
        this.windowsSubject.next([...windows]);
      }
    } else {
      this.windowsSubject.next([...windows, {
        userId:     user.id.toString(),
        email:      user.email,
        nome:       user.nome,
        cor:        this._avatarCor(user.nome),
        minimized,
        naoLidas:   0,
        fotoPerfil: user.fotoPerfil
      }]);
    }
  }

  /** Abre janela buscando o usuário pelo e-mail */
  openByEmail(email: string, users: IUsuario[]): void {
    const user = users.find(u => u.email === email);
    if (user) this.open(user);
  }

  /** Fecha a janela do usuário */
  close(userId: string): void {
    this.windowsSubject.next(
      this.windowsSubject.value.filter(w => w.userId !== userId)
    );
  }

  /** Minimiza / maximiza a janela */
  toggleMinimize(userId: string): void {
    const windows = this.windowsSubject.value;
    const w = windows.find(win => win.userId === userId);
    if (w) {
      w.minimized = !w.minimized;
      if (!w.minimized) {
        // Expandindo: zera não-lidas e sincroniza email map
        w.naoLidas = 0;
        this._setEmailCount(w.email, 0);
      }
      this.windowsSubject.next([...windows]);
    }
  }

  /** Incrementa contador de não-lidas (somente quando minimizada). Sincroniza email map. */
  addUnread(userId: string): void {
    const windows = this.windowsSubject.value;
    const w = windows.find(win => win.userId === userId);
    if (w && w.minimized) {
      w.naoLidas++;
      this.windowsSubject.next([...windows]);
      // Sincroniza email map
      const count = (this.unreadEmailSubject.value[w.email] ?? 0) + 1;
      this._setEmailCount(w.email, count);
    }
  }

  /** Zera contador de não-lidas da janela e sincroniza email map. */
  clearUnread(userId: string): void {
    const windows = this.windowsSubject.value;
    const w = windows.find(win => win.userId === userId);
    if (w) {
      w.naoLidas = 0;
      this.windowsSubject.next([...windows]);
      this._setEmailCount(w.email, 0);
    }
  }

  private _avatarCor(nome: string): string {
    if (!nome) return this.AVATAR_CORES[0];
    let h = 0;
    for (let i = 0; i < nome.length; i++) h += nome.charCodeAt(i);
    return this.AVATAR_CORES[h % this.AVATAR_CORES.length];
  }
}

