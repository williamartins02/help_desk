import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const DARK_MODE_KEY = 'helpdesk-dark-mode';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _darkMode = new BehaviorSubject<boolean>(false);
  readonly darkMode$ = this._darkMode.asObservable();

  constructor() {
    const saved = localStorage.getItem(DARK_MODE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved !== null ? saved === 'true' : prefersDark;
    this.setDarkMode(isDark);
  }

  get isDarkMode(): boolean {
    return this._darkMode.value;
  }

  toggle(): void {
    this.setDarkMode(!this._darkMode.value);
  }

  private setDarkMode(dark: boolean): void {
    this._darkMode.next(dark);
    localStorage.setItem(DARK_MODE_KEY, String(dark));
    if (dark) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }
}

