import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { IUsuario } from '../models/usuario';

export interface IChatWindow {
  userId:    string;
  email:     string;
  nome:      string;
  cor:       string;
  minimized: boolean;
  naoLidas:  number;
}

@Injectable({ providedIn: 'root' })
export class ChatWindowService {

  private windowsSubject = new BehaviorSubject<IChatWindow[]>([]);
  windows$ = this.windowsSubject.asObservable();

  private readonly AVATAR_CORES = [
    '#1565c0', '#00838f', '#2e7d32', '#6a1b9a',
    '#c62828', '#f57f17', '#37474f', '#00695c'
  ];

  /**
   * Abre (ou traz ao foco) uma janela de DM para o usuário.
   * @param minimized  Se `true`, abre minimizada (para notificação silenciosa).
   *                   Não afeta janelas já abertas.
   */
  open(user: IUsuario, minimized = false): void {
    const windows = this.windowsSubject.value;
    const existing = windows.find(w => w.userId === user.id.toString());
    if (existing) {
      if (!minimized) {
        // Abertura explícita pelo usuário: maximiza e zera não-lidas
        existing.minimized = false;
        existing.naoLidas  = 0;
        this.windowsSubject.next([...windows]);
      }
      // Se minimized=true e janela já existe, não altera — addUnread cuidará do badge
    } else {
      this.windowsSubject.next([...windows, {
        userId:    user.id.toString(),
        email:     user.email,
        nome:      user.nome,
        cor:       this._avatarCor(user.nome),
        minimized,
        naoLidas:  0
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
    const w = windows.find(w => w.userId === userId);
    if (w) {
      w.minimized = !w.minimized;
      if (!w.minimized) w.naoLidas = 0;
      this.windowsSubject.next([...windows]);
    }
  }

  /** Incrementa contador de não-lidas (somente quando minimizada) */
  addUnread(userId: string): void {
    const windows = this.windowsSubject.value;
    const w = windows.find(w => w.userId === userId);
    if (w && w.minimized) {
      w.naoLidas++;
      this.windowsSubject.next([...windows]);
    }
  }

  /** Zera contador de não-lidas da janela */
  clearUnread(userId: string): void {
    const windows = this.windowsSubject.value;
    const w = windows.find(w => w.userId === userId);
    if (w) {
      w.naoLidas = 0;
      this.windowsSubject.next([...windows]);
    }
  }

  private _avatarCor(nome: string): string {
    if (!nome) return this.AVATAR_CORES[0];
    let h = 0;
    for (let i = 0; i < nome.length; i++) h += nome.charCodeAt(i);
    return this.AVATAR_CORES[h % this.AVATAR_CORES.length];
  }
}

