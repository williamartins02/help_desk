import { Router } from '@angular/router';
import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
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

  constructor(
    private router: Router,
    private authService: AuthenticationService,
    private chatService: ChatService,
    private toast: ToastrService,) { }

  //Metodo que inicia
  ngOnInit(): void {
    // Removido redirecionamento automático para 'home'.
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
