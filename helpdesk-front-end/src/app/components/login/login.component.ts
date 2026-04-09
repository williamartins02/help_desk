import { AuthenticationService } from './../../services/authentication.service';
import { Credenciais } from './../../models/credenciais';
import { Component, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { ChatService } from 'src/app/services/chat.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  creds: Credenciais = {
    email: '',
    senha: '',
  }

  hidePassword = true;

  email = new FormControl(null, Validators.email);
  senha = new FormControl(null, Validators.minLength(4));

  constructor(
    private toast: ToastrService,
    private service: AuthenticationService,
    private chatService: ChatService,
    private router: Router) { }

  ngOnInit(): void { }

  login() {
    this.service.authenticate(this.creds).subscribe(async (resposta) => {
      this.service.successLogin(resposta.headers.get('Authorization').substring(7));
      await this.service.getPermissions(this.creds.email);
      // Conectar chat automaticamente após login
      this.chatService.connect(this.creds.email);
      this.router.navigate([''])
      this.toast.success("Logado com sucesso!", 'Usuário(a)  ' + this.creds.email)
    }, (error) => {
      this.toast.error('Usuário e/ou senha inválidos', 'ERROR')
      return throwError(error);
    })
  }

  validaCampos(): boolean {
    return this.email.valid && this.senha.valid;
  }
}
