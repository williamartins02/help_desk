import { Router, NavigationEnd } from '@angular/router';
import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { filter } from 'rxjs/operators';
import { ChatService } from '../../services/chat.service';
import { MatDrawer } from '@angular/material/sidenav';
import { AuthenticationService } from '../../services/authentication.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.css']
})
export class NavComponent implements OnInit, AfterViewInit {
  @ViewChild('drawer') drawer!: MatDrawer;
  isMenuOpen = false;
  isDashboardOpen = false;

  constructor(
    private router: Router,
    private authService: AuthenticationService,
    private chatService: ChatService,
    private toast: ToastrService,) { }

  //Metodo que inicia
  ngOnInit(): void {
    // Abre o submenu Dashboard se a rota ativa for bi-dashboard
    this.isDashboardOpen = this.router.url.includes('bi-dashboard');

    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        if (e.urlAfterRedirects?.includes('bi-dashboard')) {
          this.isDashboardOpen = true;
        }
      });
  }

  ngAfterViewInit() {
    if (this.drawer) {
      this.drawer.openedChange.subscribe((opened: boolean) => {
        this.isMenuOpen = opened;
      });
    }
  }

  /*Metodo para DESLOGAR e limpar o TOKEN do usuario do locaStorage */
  logout(){
    this.router.navigate(['login'])
    this.authService.logout();
    this.chatService.disconnect();
    this.toast.info('logout realizado com sucesso', 'Logout', {timeOut: 4000})
  }
}
