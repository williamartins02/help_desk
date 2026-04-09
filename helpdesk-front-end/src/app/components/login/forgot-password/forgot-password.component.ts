import { Component } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthenticationService } from '../../../services/authentication.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent {

  email = new FormControl(null, [Validators.required, Validators.email]);
  loading = false;
  enviado = false;

  constructor(
    private service: AuthenticationService,
    private toast: ToastrService,
    private router: Router
  ) {}

  enviar() {
    if (this.email.invalid) return;
    this.loading = true;
    this.service.forgotPassword(this.email.value).subscribe({
      next: () => {
        this.loading = false;
        this.enviado = true;
        this.toast.success(
          'Se esse e-mail estiver cadastrado, você receberá as instruções em breve.',
          'E-mail enviado!'
        );
      },
      error: () => {
        this.loading = false;
        this.toast.error('Não foi possível processar a solicitação. Tente novamente.', 'Erro');
      }
    });
  }

  voltar() {
    this.router.navigate(['/login']);
  }
}

