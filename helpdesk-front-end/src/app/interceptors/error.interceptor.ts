import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HTTP_INTERCEPTORS,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

/**
 * Interceptor global de erros HTTP.
 * Trata respostas de erro de forma centralizada, sem alterar
 * o comportamento das requisições bem-sucedidas.
 *
 * - 401 Unauthorized → redireciona para o login
 * - 403 Forbidden    → exibe mensagem de acesso negado
 * - 404 Not Found    → exibe mensagem de recurso não encontrado
 * - 500+             → exibe mensagem genérica de erro no servidor
 */
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {

  constructor(
    private router: Router,
    private toast: ToastrService
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          localStorage.clear();
          this.router.navigate(['/login']);
          this.toast.warning('Sessão expirada. Faça login novamente.', 'Atenção');
        } else if (error.status === 403) {
          this.toast.error('Você não tem permissão para realizar esta ação.', 'Acesso negado');
        } else if (error.status === 404) {
          this.toast.warning('O recurso solicitado não foi encontrado.', 'Não encontrado');
        } else if (error.status >= 500) {
          this.toast.error('Erro interno no servidor. Tente novamente em instantes.', 'Erro');
        }
        return throwError(() => error);
      })
    );
  }
}

export const ErrorInterceptorProvider = [
  {
    provide: HTTP_INTERCEPTORS,
    useClass: ErrorInterceptor,
    multi: true
  }
];

