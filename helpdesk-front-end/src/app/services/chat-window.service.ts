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
    const idx  = wins.findIndex(w => w.email === email);
    if (idx !== -1 && wins[idx].minimized) {
      const newWindows = wins.map((w, i) =>
        i === idx ? { ...w, naoLidas: w.naoLidas + 1 } : w
      );
      this.windowsSubject.next(newWindows);
    }
  }

  /** Adiciona N não-lidas de uma vez (ex: mensagens acumuladas offline). */
  addBatchUnreadByEmail(email: string, qtd: number): void {
    const count = (this.unreadEmailSubject.value[email] ?? 0) + qtd;
    this._setEmailCount(email, count);
    const wins = this.windowsSubject.value;
    const idx  = wins.findIndex(w => w.email === email);
    if (idx !== -1 && wins[idx].minimized) {
      const newWindows = wins.map((w, i) =>
        i === idx ? { ...w, naoLidas: (w.naoLidas ?? 0) + qtd } : w
      );
      this.windowsSubject.next(newWindows);
    }
  }

  /** Zera as não-lidas de um remetente (conversa visualizada). */
  clearUnreadByEmail(email: string): void {
    if (!email) return;
    this._setEmailCount(email, 0);
    const wins = this.windowsSubject.value;
    const idx  = wins.findIndex(w => w.email === email);
    if (idx !== -1 && wins[idx].naoLidas > 0) {
      const newWindows = wins.map((w, i) => i === idx ? { ...w, naoLidas: 0 } : w);
      this.windowsSubject.next(newWindows);
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
    const windows = this.windowsSubject.value;
    const idx     = windows.findIndex(w => w.userId === user.id.toString());
    if (idx !== -1) {
      if (!minimized) {
        // Abertura explícita pelo usuário: cria novo objeto (sem mutar) para CD detectar a mudança
        const newWindows = windows.map((w, i) =>
          i === idx ? { ...w, minimized: false, naoLidas: 0 } : w
        );
        this._setEmailCount(user.email, 0);
        this.windowsSubject.next(newWindows);
      }
      // Se minimized=true e a janela já existe: não faz nada
    } else {
      this.windowsSubject.next([...windows, {
        userId:     user.id.toString(),
        email:      user.email,
        nome:       user.nome,
        cor:        this._avatarCor(user.nome),
        minimized,
        // Quando minimizada, usa o contador já acumulado no email map
        // (ChatNotificationComponent pode ter chamado incrementUnreadByEmail antes de a janela existir)
        naoLidas:   minimized ? (this.unreadEmailSubject.value[user.email] ?? 0) : 0,
        fotoPerfil: user.fotoPerfil
      }]);
    }
  }

  /**
   * Maximiza (expande) a janela de conversa pelo e-mail — sem precisar do objeto IUsuario.
   * Útil quando a janela já foi criada (minimizada) pelo FloatingChatComponent.
   * Retorna true se a janela existia e foi expandida; false se não havia janela.
   * Cria novo objeto (imutável) para que o change detection detecte corretamente a transição.
   */
  maximizeByEmail(email: string): boolean {
    const windows = this.windowsSubject.value;
    const idx = windows.findIndex(w => w.email === email);
    if (idx === -1) return false;
    // Cria novo objeto em vez de mutar — garante que prevMap no FloatingChatComponent
    // capture o estado ANTERIOR (minimized: true) antes de emitir o novo estado.
    const newWindows = windows.map((w, i) =>
      i === idx ? { ...w, minimized: false, naoLidas: 0 } : w
    );
    this._setEmailCount(email, 0);
    this.windowsSubject.next(newWindows);
    return true;
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

  /** Minimiza / maximiza a janela — cria novo objeto para CD detectar a transição */
  toggleMinimize(userId: string): void {
    const windows = this.windowsSubject.value;
    const idx = windows.findIndex(win => win.userId === userId);
    if (idx === -1) return;
    const w = windows[idx];
    const newW: IChatWindow = { ...w, minimized: !w.minimized };
    if (!newW.minimized) {
      // Expandindo: zera não-lidas e sincroniza email map
      newW.naoLidas = 0;
      this._setEmailCount(w.email, 0);
    }
    const newWindows = windows.map((win, i) => i === idx ? newW : win);
    this.windowsSubject.next(newWindows);
  }

  /** Incrementa contador de não-lidas (somente quando minimizada). Sincroniza email map. */
  addUnread(userId: string): void {
    const windows = this.windowsSubject.value;
    const idx = windows.findIndex(win => win.userId === userId);
    if (idx !== -1 && windows[idx].minimized) {
      const newWindows = windows.map((w, i) => i === idx ? { ...w, naoLidas: w.naoLidas + 1 } : w);
      this.windowsSubject.next(newWindows);
      // Sincroniza email map
      const count = (this.unreadEmailSubject.value[windows[idx].email] ?? 0) + 1;
      this._setEmailCount(windows[idx].email, count);
    }
  }

  /**
   * Incrementa APENAS o badge visual da janela (naoLidas) SEM atualizar o email map (FAB).
   * Use quando o email map é gerenciado externamente (ex: ChatNotificationComponent).
   */
  addWindowBadgeOnly(userId: string): void {
    const windows = this.windowsSubject.value;
    const idx = windows.findIndex(win => win.userId === userId);
    if (idx !== -1 && windows[idx].minimized) {
      const newWindows = windows.map((w, i) => i === idx ? { ...w, naoLidas: w.naoLidas + 1 } : w);
      this.windowsSubject.next(newWindows);
    }
  }

  /** Zera contador de não-lidas da janela e sincroniza email map. */
  clearUnread(userId: string): void {
    const windows = this.windowsSubject.value;
    const idx = windows.findIndex(win => win.userId === userId);
    if (idx !== -1) {
      const newWindows = windows.map((w, i) => i === idx ? { ...w, naoLidas: 0 } : w);
      this.windowsSubject.next(newWindows);
      this._setEmailCount(windows[idx].email, 0);
    }
  }

  private _avatarCor(nome: string): string {
    if (!nome) return this.AVATAR_CORES[0];
    let h = 0;
    for (let i = 0; i < nome.length; i++) h += nome.charCodeAt(i);
    return this.AVATAR_CORES[h % this.AVATAR_CORES.length];
  }
}

