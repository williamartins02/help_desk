import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {

  userEmail: string = 'Usuário';
  currentTime: Date = new Date();

  private timerSub!: Subscription;
  private jwtHelper = new JwtHelperService();

  constructor(public themeService: ThemeService) { }

  ngOnInit(): void {
    this.loadUserInfo();
    this.timerSub = interval(1000).subscribe(() => {
      this.currentTime = new Date();
    });
  }

  ngOnDestroy(): void {
    if (this.timerSub) {
      this.timerSub.unsubscribe();
    }
  }

  private loadUserInfo(): void {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = this.jwtHelper.decodeToken(token);
        this.userEmail = decoded?.sub || decoded?.email || 'Usuário';
      } catch {
        this.userEmail = 'Usuário';
      }
    }
  }

  getUserInitial(): string {
    return this.userEmail ? this.userEmail.charAt(0).toUpperCase() : 'U';
  }
}
