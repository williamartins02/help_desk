import { AuthenticationService } from './../../services/authentication.service';
import { Credenciais } from './../../models/credenciais';
import { Component, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
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
  isLoading = false;
  inativoError = false;

  email = new FormControl(null, Validators.email);
  senha = new FormControl(null, Validators.minLength(4));

  constructor(
    private toast: ToastrService,
    private service: AuthenticationService,
    private chatService: ChatService,
    private router: Router) { }

  ngOnInit(): void { }

  login() {
    if (!this.validaCampos()) return;
    this.isLoading = true;
    this.inativoError = false;

    this.service.authenticate(this.creds).subscribe({
      next: async (resposta) => {
        this.service.successLogin(resposta.headers.get('Authorization').substring(7));
        await this.service.getPermissions(this.creds.email);
        this.chatService.connect(this.creds.email);
        this.router.navigate(['']);
        this.toast.success('Logado com sucesso!', 'Usuário(a) ' + this.creds.email);
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
        if (error.status === 423) {
          this.inativoError = true;
          this.toast.error(
            'Seu usuário está inativo. Entre em contato com o administrador para reativação.',
            'Acesso bloqueado',
            { timeOut: 10000, progressBar: true }
          );
        } else {
          this.inativoError = false;
          this.toast.error('Usuário e/ou senha inválidos', 'Erro de autenticação');
        }
      }
    });
  }

  validaCampos(): boolean {
    return this.email.valid && this.senha.valid;
  }
}
