import { GenericDialogComponent } from './../../molecules/generic-dialog/generic-dialog.component';
import { GenericDialog } from './../../../models/dialog/generic-dialog/generic-dialog';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Chamado } from './../../../models/chamado';

import { throwError, Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { ToastrService } from "ngx-toastr";
import { ChamadoService } from "src/app/services/chamado.service";
import { TecnicoService } from "./../../../services/tecnico.service";
import { ClienteService } from "./../../../services/cliente.service";
import { InteligenteService } from "./../../../services/inteligente.service";
import { Tecnico } from "./../../../models/tecnico";
import { Cliente } from "./../../../models/cliente";
import {
  SugestaoTecnico,
  SugestaoClassificacao,
  ChamadoSemelhant,
  SugestaoRequest
} from "./../../../models/inteligente";
import { Component, OnInit, OnDestroy } from "@angular/core";
import { FormControl, Validators } from "@angular/forms";
import { JwtHelperService } from "@auth0/angular-jwt";

@Component({
  selector: "app-chamado-create",
  templateUrl: "./chamado-create.component.html",
  styleUrls: ["./chamado-create.component.css"],
})
export class ChamadoCreateComponent implements OnInit, OnDestroy {
  private genericDialog: GenericDialog;
  private matDialogRef: MatDialogRef<GenericDialogComponent>;
  private jwtHelper = new JwtHelperService();

  // ── Inteligência ─────────────────────────────────────────────────────────
  sugestaoTecnico:        SugestaoTecnico | null = null;
  sugestaoClassificacao:  SugestaoClassificacao | null = null;
  chamadosSemelhantes:    ChamadoSemelhant[] = [];
  carregandoSugestoes     = false;
  paineAberto             = false;

  private inputSubject$ = new Subject<void>();
  private inputSub: any;
  // ─────────────────────────────────────────────────────────────────────────

  isAdmin = false;
  tecnicoLogadoNome = '';

  chamado: Chamado = {
    prioridade:  '',
    status:      '',
    classificacao:'',
    titulo:      '',
    observacoes: '',
    tecnico:     '',
    cliente:     '',
    nomeCliente: '',
    nomeTecnico: '',
  }
  clientes: Cliente[] = [];
  tecnicos: Tecnico[] = [];


  prioridade:     FormControl = new FormControl(null, [Validators.required]);
  status:         FormControl = new FormControl(null, [Validators.required]);
  classificacao:  FormControl = new FormControl(null, [Validators.required]);
  titulo:         FormControl = new FormControl(null, [Validators.required]);
  observacoes:    FormControl = new FormControl(null, [Validators.required]);
  tecnico:        FormControl = new FormControl(null, [Validators.required]);
  cliente:        FormControl = new FormControl(null, [Validators.required]);

  constructor(
    private  chamadoService: ChamadoService,
    private  clienteService: ClienteService,
    private  tecnicoService: TecnicoService,
    private  inteligenteService: InteligenteService,
    private  toast: ToastrService,
    private router: Router,
    public  dialogRef: MatDialogRef<ChamadoCreateComponent>,
    public dialog: MatDialog
   
  ) {
    this.genericDialog = new GenericDialog(dialog);
  }

  ngOnInit(): void {
    this.detectarPerfil();
    this.findaAllClientes();
    this.findAllTecnico();
    this.iniciarListenerInteligencia();
  }

  ngOnDestroy(): void {
    if (this.inputSub) this.inputSub.unsubscribe();
  }

  private detectarPerfil(): void {
    const permissions: string[] = JSON.parse(localStorage.getItem('permissions') || '[]');
    this.isAdmin = permissions.includes('ROLE_ADMIN');
  }

  private preencherTecnicoLogado(): void {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const decoded = this.jwtHelper.decodeToken(token);
      const email: string = decoded?.sub || decoded?.email || '';
      if (!email) return;
      const match = this.tecnicos.find(t => t.email?.toLowerCase() === email.toLowerCase());
      if (match) {
        this.chamado.tecnico  = match.id;
        this.tecnicoLogadoNome = match.nome;
        this.tecnico.setValue(match.id);
        this.tecnico.disable();
      }
    } catch { /* token inválido — deixa campo em branco */ }
  }

  create(): void{
    this.onNoClick();
    const matDialogRef = this.genericDialog.loadingMessage("Salvando Chamado...");
    this.chamadoService.create(this.chamado).subscribe((novoChamado) => {
      setTimeout(() => {
        matDialogRef.close();
        this.toast.success("Chamado criando com sucesso", "Novo chamado");
        // Redireciona para a lista de chamados com os parâmetros highlightId e new=true
        this.router.navigate(['chamados'], {
          queryParams: {
            highlightId: novoChamado?.id,
            new: 'true'
          }
        });
      }, 1000);
    }, (error) => {
      this.toast.error("Ao adicionar um chamado", "ERROR");
      return throwError(error.error.error);
    });
  }

  findaAllClientes(): void {
    this.clienteService.findAll().subscribe((resposta) => {
        this.clientes = resposta;
      },(error) => {
        this.toast.error("Ao carregar a lista técnico", "ERROR");
        return throwError(error.error.error);
      });
  }

  findAllTecnico(): void {
    this.tecnicoService.findAllAtivos().subscribe(
      (resposta) => {
        this.tecnicos = resposta;
        if (!this.isAdmin) {
          this.preencherTecnicoLogado();
        }
      },(error) => {
        this.toast.error("Ao carregar a lista técnico", "ERROR");
        return throwError(error.error.error);
      }
    );
  }

  // ── Inteligência ─────────────────────────────────────────────────────────

  /** Inicia debounce que dispara consultas de inteligência ao digitar. */
  private iniciarListenerInteligencia(): void {
    this.inputSub = this.inputSubject$.pipe(
      debounceTime(800)
    ).subscribe(() => this.consultarInteligencia());
  }

  /** Chamado pelos eventos (input) do título e observações no template. */
  onInputChange(): void {
    // Assistente Inteligente é exclusivo para perfil Admin
    if (!this.isAdmin) return;

    const temConteudo = (this.chamado.titulo?.length ?? 0) >= 3
                     || (this.chamado.observacoes?.length ?? 0) >= 3;
    if (temConteudo) {
      this.inputSubject$.next();
    }
  }

  private consultarInteligencia(): void {
    const req: SugestaoRequest = {
      titulo:        this.chamado.titulo || '',
      observacoes:   this.chamado.observacoes || '',
      classificacao: this.chamado.classificacao !== '' ? Number(this.chamado.classificacao) : null
    };

    this.carregandoSugestoes = true;
    this.paineAberto = true;

    // Dispara as 3 consultas em paralelo
    this.inteligenteService.sugerirTecnico(req).subscribe(s => {
      this.sugestaoTecnico = s;
    });
    this.inteligenteService.sugerirClassificacao(req).subscribe(s => {
      this.sugestaoClassificacao = s;
    });
    this.inteligenteService.chamadosSemelhantes(req).subscribe(list => {
      this.chamadosSemelhantes = list;
      this.carregandoSugestoes = false;
    });
  }

  /** Aplica a sugestão de técnico no formulário (somente para admins). */
  aplicarSugestaoTecnico(): void {
    if (!this.sugestaoTecnico || !this.isAdmin) return;
    // mat-option usa value="{{ tec.id }}" (string interpolada) → obrigatório converter para string
    const idStr = String(this.sugestaoTecnico.tecnicoId);
    this.chamado.tecnico = idStr;
    this.tecnico.setValue(idStr);
    this.toast.info(`Técnico ${this.sugestaoTecnico.nomeTecnico} selecionado`, 'Sugestão aplicada');
  }

  /** Aplica a sugestão de classificação no formulário. */
  aplicarSugestaoClassificacao(): void {
    if (!this.sugestaoClassificacao) return;
    // mat-option usa value="0", "1", "2"… (string) → converter para garantir correspondência
    const codigoStr = String(this.sugestaoClassificacao.classificacaoCodigo);
    this.chamado.classificacao = codigoStr;
    this.classificacao.setValue(codigoStr);
    this.toast.info(`Classificação ${this.sugestaoClassificacao.classificacaoNome} selecionada`, 'Sugestão aplicada');
  }

  togglePainel(): void {
    this.paineAberto = !this.paineAberto;
  }

  // ─────────────────────────────────────────────────────────────────────────

  validaCampos(): boolean {
    // Quando ROLE_TECNICO o FormControl fica disabled (válido automaticamente)
    // e chamado.tecnico já foi preenchido; para ROLE_ADMIN verificamos o valor manualmente.
    const tecnicoOk = !this.isAdmin
      ? !!this.chamado.tecnico
      : !!this.tecnico.value;
    return (
      this.prioridade.valid &&
      this.classificacao.valid &&
      this.status.valid &&
      this.titulo.valid &&
      this.observacoes.valid &&
      tecnicoOk &&
      this.cliente.valid
    );
  }

  onNoClick(): void {
    this.dialogRef.close();
  }
}
