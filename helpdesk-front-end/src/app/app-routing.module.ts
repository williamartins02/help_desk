
import { AuthGuard } from './authentication/auth.guard';
import { RoleGuard } from './authentication/role.guard';
import { LoginComponent } from './components/login/login.component';
import { ForgotPasswordComponent } from './components/login/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/login/reset-password/reset-password.component';
import { TecnicoListComponent } from './components/tecnico/tecnico-list/tecnico-list.component';
import { HomeComponent } from './components/home/home.component';
import { NavComponent } from './components/nav/nav.component';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClienteListComponent } from './components/cliente/cliente-list/cliente-list.component';
import { ChamadoListComponent } from './components/chamado/chamado-list/chamado-list.component';
import { TecnicoTelefoneListComponent } from './components/tecnico/telefone-tecnico/tecnico-telefone-list/tecnico-telefone-list.component';
import { LineChartComponent } from './components/chamado/chart/line-chart/line-chart.component';
import { ChatComponent } from './components/chat/chat/chat.component';
import { UsuariosListComponent } from './components/usuarios/usuarios-list/usuarios-list.component';
import {RelatorioChamadoComponent} from "./components/chamado/relatorio-chamado/relatorio-chamado.component";
import {AgendaComponent} from "./components/agenda/agenda/agenda.component";
import { AgendaCalendarioComponent } from './components/agenda/agenda-calendario/agenda-calendario.component';
import { KanbanComponent } from './components/chamado/kanban/kanban.component';
import { BiDashboardComponent } from './components/chamado/chart/bi-dashboard/bi-dashboard.component';

//Fica toda roda do projeto para ser renderizado.
const routes: Routes = [
  
  //Rota para LOGIN/entrar no sistema.
  {path: 'login', component: LoginComponent},

  //Rota para redefinição de senha.
  {path: 'esqueceu-senha', component: ForgotPasswordComponent},

  //Rota para nova senha via token do e-mail.
  {path: 'redefinir-senha', component: ResetPasswordComponent},

  //Rota NAVEGADOR com filhos HOME/TECNICOS
  {
    path: '', component: NavComponent, canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', component: HomeComponent },
      { path: 'tecnicos', component: TecnicoListComponent, canActivate: [RoleGuard], data: { roles: ['ROLE_ADMIN'] } },
      { path: 'tecnicos/telefones/:id', component: TecnicoTelefoneListComponent, canActivate: [RoleGuard], data: { roles: ['ROLE_ADMIN'] } },
      { path: 'clientes', component: ClienteListComponent, canActivate: [RoleGuard], data: { roles: ['ROLE_ADMIN'] } },
      { path: 'chamados', component: ChamadoListComponent },
      { path: 'chart', component: LineChartComponent },
      { path: 'chamados/relatorios', component: RelatorioChamadoComponent, canActivate: [RoleGuard], data: { roles: ['ROLE_ADMIN'] } },
      { path: 'chat', component: ChatComponent },
      { path: 'usuarios', component: UsuariosListComponent, canActivate: [RoleGuard], data: { roles: ['ROLE_ADMIN'] } },
      { path: 'agenda', component: AgendaComponent },
      { path: 'agenda-calendario', component: AgendaCalendarioComponent },
      { path: 'kanban', component: KanbanComponent },
      { path: 'bi-dashboard', component: BiDashboardComponent, canActivate: [RoleGuard], data: { roles: ['ROLE_ADMIN'] } },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
