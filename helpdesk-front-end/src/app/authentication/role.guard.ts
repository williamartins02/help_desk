import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot
} from '@angular/router';
import { ToastrService } from 'ngx-toastr';

/**
 * Guard que verifica se o usuário autenticado possui o perfil
 * necessário para acessar uma determinada rota.
 *
 * Uso no roteamento:
 * ```
 * {
 *   path: 'tecnicos',
 *   component: TecnicoListComponent,
 *   canActivate: [AuthGuard, RoleGuard],
 *   data: { roles: ['ROLE_ADMIN'] }
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  constructor(
    private router: Router,
    private toast: ToastrService
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const requiredRoles: string[] = route.data['roles'];

    // Se a rota não exige perfil específico, libera o acesso
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const permissionsRaw = localStorage.getItem('permissions');
    const permissions: string[] = permissionsRaw ? JSON.parse(permissionsRaw) : [];

    const hasRole = requiredRoles.some(role => permissions.includes(role));

    if (hasRole) {
      return true;
    }

    this.toast.error('Você não tem permissão para acessar esta página.', 'Acesso negado');
    this.router.navigate(['/home']);
    return false;
  }
}

