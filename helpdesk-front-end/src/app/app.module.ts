import { NewBadgeComponent } from './components/molecules/new-badge/new-badge.component';
import { GenericDialogComponent} from './components/molecules/generic-dialog/generic-dialog.component';
import { ForgotPasswordComponent } from './components/login/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/login/reset-password/reset-password.component';

 import { NavComponent }          from './components/nav/nav.component';
import { HomeComponent }          from './components/home/home.component';
import { HeaderComponent }        from './components/header/header.component';
import { LoginComponent }         from './components/login/login.component';

import { ChamadoListComponent }   from './components/chamado/chamado-list/chamado-list.component';
import { ChamadoCreateComponent } from './components/chamado/chamado-create/chamado-create.component';

import { TecnicoListComponent }   from './components/tecnico/tecnico-list/tecnico-list.component';
import { TecnicoCreateComponent } from './components/tecnico/tecnico-create/tecnico-create.component';


import { AuthInterceptorProvider } from './interceptors/auth.interceptor';
import { NgModule } from '@angular/core';
import { BrowserModule }           from '@angular/platform-browser';
import { CommonModule }            from '@angular/common';

import { AppRoutingModule }        from './app-routing.module';
import { AppComponent }            from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

//Para trabalhar com form reativos no angular 12
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

//para realizar requisiões HTTP
import { HttpClientModule } from "@angular/common/http";
import { ChatService } from './services/chat.service';

// Angular Material modules
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatRadioModule } from '@angular/material/radio';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSortModule } from '@angular/material/sort';



//component do projeto.
import { ToastrModule }                   from 'ngx-toastr';
import { NgxMaskModule }                  from 'ngx-mask';
import {TecnicoUpdateComponent }         from './components/tecnico/tecnico-update/tecnico-update.component';
import { TecnicoDeleteDialogComponent }  from './components/tecnico/tecnico-delete-dialog/tecnico-delete-dialog.component';
import { TecnicoReativarDialogComponent } from './components/tecnico/tecnico-reativar-dialog/tecnico-reativar-dialog.component';
import { TecnicoTelefoneListComponent }   from './components/tecnico/telefone-tecnico/tecnico-telefone-list/tecnico-telefone-list.component';
import { TecnicoTelefoneUpdateComponent } from './components/tecnico/telefone-tecnico/tecnico-telefone-update/tecnico-telefone-update.component';
import { TecnicoTelefoneCreateComponent } from './components/tecnico/telefone-tecnico/tecnico-telefone-create/tecnico-telefone-create.component';
import { TecnicoTelefoneDeleteComponent } from './components/tecnico/telefone-tecnico/tecnico-telefone-delete/tecnico-telefone-delete.component';
import { ChamadoUpdateComponent}         from './components/chamado/chamado-update/chamado-update.component';
import { ChamadoReadComponent }           from './components/chamado/chamado-read/chamado-read.component';
import { RelatorioChamadoComponent }      from './components/chamado/relatorio-chamado/relatorio-chamado.component';
import { ReportParamComponent }           from './components/chamado/report-param/report-param.component';
import { LineChartComponent }             from './components/chamado/chart/line-chart/line-chart.component';
import { NgChartsModule }                 from 'ng2-charts';
import { ChatComponent }                  from './components/chat/chat/chat.component';
import { ChatBubbleComponent }            from './components/chat/chat-bubble/chat-bubble.component';
import { FloatingChatComponent }          from './components/chat/floating-chat/floating-chat.component';
import { ChatNotificationComponent }      from './components/chat/chat-notification/chat-notification.component';
import { UsuariosListComponent }          from './components/usuarios/usuarios-list/usuarios-list.component';

import { UsuarioDetalheDialogComponent }   from './components/usuarios/usuario-detalhe-dialog/usuario-detalhe-dialog.component';
import { ChamadoDetalheDialogComponent }  from './components/chamado/chamado-detalhe-dialog/chamado-detalhe-dialog.component';
import { DeleteDialogComponent }          from './components/molecules/delete/delete-dialog/delete-dialog.component';
import { ClienteCreateComponent }         from './components/cliente/cliente-create/cliente-create.component';
import { ClienteListComponent }           from './components/cliente/cliente-list/cliente-list.component';
import { ClienteUpdateComponent }         from './components/cliente/cliente-update/cliente-update.component';
import { ClienteDeleteComponent }         from './components/cliente/cliente-delete/cliente-delete.component';
import { SharedModule } from './components/shared/shared.module';
import { CriticalAlertDialogComponent } from './components/molecules/critical-alert-dialog/critical-alert-dialog.component';
import { RankingDialogComponent } from './components/home/ranking-dialog/ranking-dialog.component';
import { MatDialogRef } from '@angular/material/dialog';
import {AgendaComponent} from "./components/agenda/agenda/agenda.component";
import {TarefaFormDialogComponent} from "./components/agenda/tarefa-form-dialog/tarefa-form-dialog.component";
import {AgendaWsService} from "./services/agenda-ws.service";


@NgModule({
  declarations: [
    AppComponent,
    NavComponent,
    HomeComponent,
    HeaderComponent,
    LoginComponent,

    TecnicoCreateComponent,
    TecnicoUpdateComponent,
    TecnicoDeleteDialogComponent,
    TecnicoReativarDialogComponent,
    TecnicoListComponent,
    ClienteCreateComponent,
    ClienteListComponent,
    ClienteUpdateComponent,
    ClienteDeleteComponent,

    ChamadoListComponent,
    ChamadoCreateComponent,
    ChamadoUpdateComponent,
    ChamadoReadComponent,

    TecnicoTelefoneListComponent,
    TecnicoTelefoneUpdateComponent,
    TecnicoTelefoneCreateComponent,
    TecnicoTelefoneDeleteComponent,

    RelatorioChamadoComponent,
    ReportParamComponent,

    GenericDialogComponent,
    ChamadoDetalheDialogComponent,
    CriticalAlertDialogComponent,
    RankingDialogComponent,

    LineChartComponent,

    ChatComponent,
    ChatBubbleComponent,
    FloatingChatComponent,
    ChatNotificationComponent,

    UsuariosListComponent,

      AgendaComponent,
    TarefaFormDialogComponent,

    UsuarioDetalheDialogComponent,

    ChamadoDetalheDialogComponent,

    DeleteDialogComponent,

    ForgotPasswordComponent,
    ResetPasswordComponent,
    NewBadgeComponent,


  ],
  imports: [
    BrowserModule,
    CommonModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    // Angular Material
    MatButtonModule,
    MatTableModule,
    MatFormFieldModule,
    MatPaginatorModule,
    MatSnackBarModule,
    MatCheckboxModule,
    MatToolbarModule,
    MatSidenavModule,
    MatSelectModule,
    MatMenuModule,
    MatRadioModule,
    MatInputModule,
    MatIconModule,
    MatListModule,
    MatCardModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    ScrollingModule,
    MatTabsModule,
    MatDatepickerModule,
    MatTooltipModule,
    MatSortModule,
    FormsModule,
    ReactiveFormsModule,
    NgChartsModule,
    SharedModule,
    // Configuração para Service ToastrModule
    ToastrModule.forRoot({ timeOut: 4000, closeButton: true, progressBar: true }),
    NgxMaskModule.forRoot({
      dropSpecialCharacters: false // Ao salvar, vai manter a mascara
    }),
    HttpClientModule,
  ],

  providers: [
    AuthInterceptorProvider,
    {
      provide: MatDialogRef,
      useValue: {}
    },
    ChatService,
    AgendaWsService,
  ],

  bootstrap: [AppComponent]
})
export class AppModule { }

