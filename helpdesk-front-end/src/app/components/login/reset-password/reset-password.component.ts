import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthenticationService } from '../../../services/authentication.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit {

  token: string = '';
  loading = false;
  concluido = false;
  hideNova = true;
  hideConfirmar = true;

  form = new FormGroup({
    novaSenha:      new FormControl('', [Validators.required, Validators.minLength(6)]),
    confirmarSenha: new FormControl('', [Validators.required])
  }, { validators: this.senhasIguais });

  constructor(
      private route: ActivatedRoute,
      private router: Router,
      private service: AuthenticationService,
      private toast: ToastrService
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.toast.error('Link inválido ou expirado.', 'Erro');
      this.router.navigate(['/login']);
    }
  }

  senhasIguais(group: AbstractControl): ValidationErrors | null {
    const nova      = group.get('novaSenha')?.value;
    const confirmar = group.get('confirmarSenha')?.value;
    return nova === confirmar ? null : { senhasDiferentes: true };
  }

  redefinir(): void {
    if (this.form.invalid) return;
    this.loading = true;
    const novaSenha = this.form.get('novaSenha')!.value;

    this.service.resetPassword(this.token, novaSenha).subscribe({
      next: () => {
        this.loading = false;
        this.concluido = true;
        this.toast.success('Senha redefinida com sucesso!', 'Sucesso');
      },
      error: () => {
        this.loading = false;
        this.toast.error('Token inválido ou expirado. Solicite um novo link.', 'Erro');
      }
    });
  }

  irParaLogin(): void {
    this.router.navigate(['/login']);
  }

  getForcaClass(): string {
    const senha = this.form.get('novaSenha')?.value ?? '';
    if (senha.length >= 10 && /[A-Z]/.test(senha) && /[0-9]/.test(senha)) return 'forte';
    if (senha.length >= 6) return 'media';
    return 'fraca';
  }

  getForcaTexto(): string {
    const c = this.getForcaClass();
    if (c === 'forte') return 'Forte';
    if (c === 'media') return 'Média';
    return 'Fraca';
  }
}
