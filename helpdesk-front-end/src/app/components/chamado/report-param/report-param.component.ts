import { FormControl, Validators } from '@angular/forms';
import { Report }                  from './../../../models/report';
import { Tecnico }                 from './../../../models/tecnico';
import { RelatorioChamadoComponent } from './../relatorio-chamado/relatorio-chamado.component';
import { Component, OnInit }       from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AuthenticationService }   from '../../../services/authentication.service';
import { TecnicoService }          from '../../../services/tecnico.service';

@Component({
  selector:    'app-report-param',
  templateUrl: './report-param.component.html',
  styleUrls:   ['./report-param.component.css']
})
export class ReportParamComponent implements OnInit {

  private readonly datePattern = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;

  userReport: Report = { dataInicio: '', dataFim: '', tecnicoId: null };

  dataInicio = new FormControl('', [Validators.required, Validators.pattern(this.datePattern)]);
  dataFim    = new FormControl('', [Validators.required, Validators.pattern(this.datePattern)]);

  // ── Estado do usuário logado ─────────────────────────────────────────────
  loadingUserInfo = true;
  isAdmin         = false;   // tem ROLE_ADMIN
  isTecnicoOnly   = false;   // tem ROLE_TECNICO mas NÃO ROLE_ADMIN
  usuarioId:   number | null = null;
  usuarioNome: string | null = null;

  // ── Seletor de técnico (apenas Admin) ────────────────────────────────────
  tecnicos: Tecnico[]               = [];
  loadingTecnicos                   = false;
  tecnicoSelecionado: number | null = null;  // null = todos

  constructor(
    public  dialogRef:     MatDialogRef<ReportParamComponent>,
    public  dialog:        MatDialog,
    private authService:   AuthenticationService,
    private tecnicoService: TecnicoService,
  ) {}

  ngOnInit(): void {
    const token = localStorage.getItem('token');
    if (!token) { this.loadingUserInfo = false; return; }

    const decoded  = this.authService.jwtService.decodeToken(token);
    const email: string = decoded?.sub ?? '';
    if (!email) { this.loadingUserInfo = false; return; }

    this.authService.getUserInfo(email).subscribe({
      next: (info: any) => {
        this.usuarioId   = info.id   ?? null;
        this.usuarioNome = info.nome ?? null;

        const authorities: string[] = (info.authorities || [])
          .map((a: any) => typeof a === 'string' ? a : (a?.authority ?? ''));

        this.isAdmin       = authorities.includes('ROLE_ADMIN');
        this.isTecnicoOnly = authorities.includes('ROLE_TECNICO') && !this.isAdmin;

        if (this.isTecnicoOnly) {
          // Técnico puro → relatório filtrado automaticamente pelo próprio ID
          this.tecnicoSelecionado = this.usuarioId;
        } else if (this.isAdmin) {
          // Admin / Admin+Técnico → carrega lista para seleção
          this.carregarTecnicos();
        }

        this.loadingUserInfo = false;
      },
      error: () => { this.loadingUserInfo = false; }
    });
  }

  carregarTecnicos(): void {
    this.loadingTecnicos = true;
    this.tecnicoService.findAll().subscribe({
      next:  (list) => { this.tecnicos = list; this.loadingTecnicos = false; },
      error: ()     => { this.loadingTecnicos = false; }
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  private parseDate(value: string): Date | null {
    if (!value || !this.datePattern.test(value)) return null;
    const [d, m, y] = value.split('/');
    const parsed = new Date(+y, +m - 1, +d);
    if (parsed.getFullYear() !== +y || parsed.getMonth() !== +m - 1 || parsed.getDate() !== +d)
      return null;
    return parsed;
  }

  validaCampos(): boolean {
    if (!this.dataInicio.valid || !this.dataFim.valid) return false;
    const inicio = this.parseDate(String(this.dataInicio.value).trim());
    const fim    = this.parseDate(String(this.dataFim.value).trim());
    if (!inicio || !fim) return false;
    return inicio.getTime() <= fim.getTime();
  }

  // ── Ações ────────────────────────────────────────────────────────────────
  gerarRelatorio(): void {
    if (!this.validaCampos()) {
      this.dataInicio.markAsTouched();
      this.dataFim.markAsTouched();
      return;
    }

    const tecnicoId = this.isTecnicoOnly
      ? this.usuarioId
      : (this.tecnicoSelecionado ?? null);

    // Resolve o nome do técnico para exibição no diálogo de visualização
    let tecnicoNome: string | null = null;
    if (this.isTecnicoOnly) {
      tecnicoNome = this.usuarioNome;
    } else if (tecnicoId !== null) {
      tecnicoNome = this.tecnicos.find(t => t.id === tecnicoId)?.nome ?? null;
    }

    const data: Report = {
      dataInicio: String(this.dataInicio.value).trim(),
      dataFim:    String(this.dataFim.value).trim(),
      tecnicoId,
      tecnicoNome,
    };

    this.dialog.open(RelatorioChamadoComponent, { height: '90%', width: '90%', data });
    this.onNoClick();
  }

  onNoClick(): void { this.dialogRef.close(); }
}
