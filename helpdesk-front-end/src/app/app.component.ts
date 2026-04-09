import { Component, OnInit } from '@angular/core';
import { AuthenticationService } from './services/authentication.service';
import { ChatService } from './services/chat.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html'
})
export class AppComponent implements OnInit {
  constructor(
    private authService: AuthenticationService,
    private chatService: ChatService
  ) {}

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      const token = localStorage.getItem('token');
      const email = this.getEmailFromToken(token);
      if (email) {
        this.chatService.connect(email);
      }
    }
  }

  // Helper to decode JWT and extract email
  private getEmailFromToken(token: string | null): string | null {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || payload.email || null;
    } catch {
      return null;
    }
  }
}
