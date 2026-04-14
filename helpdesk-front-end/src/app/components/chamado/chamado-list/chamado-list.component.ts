import { GenericDialogComponent } from './../../molecules/generic-dialog/generic-dialog.component';
import { GenericDialog } from './../../../models/dialog/generic-dialog/generic-dialog';
import { FormControl, FormGroup } from '@angular/forms';
import { ReportParamComponent } from './../report-param/report-param.component';
import { ChartData, ChartOptions, ChartType } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

import { ToastrService } from 'ngx-toastr';
import { Subscription, throwError } from 'rxjs';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { ChamadoCreateComponent } from "./../chamado-create/chamado-create.component";
import { MatTableDataSource } from "@angular/material/table";
import { MatPaginator } from "@angular/material/paginator";
import { MatSort } from "@angular/material/sort";
import { Chamado } from "./../../../models/chamado";
import { Component, Inject, OnInit, OnDestroy, AfterViewInit, ViewChild, HostListener } from "@angular/core";
import { AuthenticationService } from 'src/app/services/authentication.service';
import { ActivatedRoute } from "@angular/router";
import { ChamadoService } from "src/app/services/chamado.service";
import { ChamadoUpdateComponent } from '../chamado-update/chamado-update.component';
import { ChamadoReadComponent } from '../chamado-read/chamado-read.component';

@Component({
  selector: "app-chamado-list",
  templateUrl: "./chamado-list.component.html",
  styleUrls: ["./chamado-list.component.css"],
})
export class ChamadoListComponent implements OnInit, AfterViewInit, OnDestroy {

  CHAMADO_DATA: Chamado[] = [];
  FILTERED_DATA: Chamado[] = [];
  refreshTable: Subscription;
  isLoading = false;

  selectedStatus: string = '';
  selectedPrioridade: string = '';
  searchValue: string = '';

  formGroup: FormGroup;

  // ── Gráfico donut ─────────────────────────────────────────────────────────
  doughnutChartType: ChartType = 'doughnut';
  doughnutChartPlugins = [ChartDataLabels];

  doughnutChartData: ChartData<'doughnut'> = {
    labels: ['Abertos', 'Em Andamento', 'Encerrados', 'Críticos'],
    datasets: [{
      data: [0, 0, 0, 0],
      backgroundColor: ['#1976d2', '#f57c00', '#66bb6a', '#f44336'],
      hoverBackgroundColor: ['#1565c0', '#e65100', '#57a05a', '#e53935'],
      borderWidth: 4,
      borderColor: '#ffffff',
      hoverBorderColor: '#ffffff'
    }]
  };

  doughnutChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${ctx.parsed}`
        }
      },
      datalabels: {
        color: '#ffffff',
        font: { weight: 'bold', size: 15 },
        formatter: (value: number) => value > 0 ? value : '',
        anchor: 'center',
        align: 'center',
        textShadowBlur: 4,
        textShadowColor: 'rgba(0,0,0,0.35)'
      }
    } as any
  };

  displayedColumns: string[] = ['id', 'titulo', 'classificacao', 'cliente', 'tecnico', 'dataAbertura', 'prioridade', 'status', 'acoes'];
  dataSource = new MatTableDataSource<Chamado>(this.CHAMADO_DATA);

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  @Inject(MAT_DIALOG_DATA) public data: { id: Number, string: Text };

  private genericDialog: GenericDialog;
  private matDialogRef: MatDialogRef<GenericDialogComponent>;

  usuarioLogado: any;

  highlightId: string | null = null;
  isNew: boolean = false;
  hideNewBadge = false;

  /* ── Chamado row tooltip ──────────────────────────────── */
  hoveredChamado: Chamado | null = null;
  tooltipX = 0;
  tooltipY = 0;

  constructor(
      public dialog: MatDialog,
      private service: ChamadoService,
      private toast: ToastrService,
      public dialogRef: MatDialogRef<ChamadoListComponent>,
      private route: ActivatedRoute,
      private authService: AuthenticationService
  ) {
    this.genericDialog = new GenericDialog(dialog);
  }

  ngOnInit(): void {
    // Lê query params para aplicar filtros vindos de navegação externa (ex: alerta de críticos)
    this.route.queryParamMap.subscribe(params => {
      this.highlightId = params.get('highlightId');
      this.isNew = params.get('new') === 'true';
      if (this.isNew) {
        this.hideNewBadge = false;
        setTimeout(() => this.hideNewBadge = true, 300000); // 5 minutos
      }
      if (params.get('prioridade')) {
        this.selectedPrioridade = params.get('prioridade')!;
      }
      if (params.get('search')) {
        this.searchValue = params.get('search')!;
      }
    });

    // Recupera usuário logado do token
    const token = localStorage.getItem('token');
    if (token) {
      const jwtHelper = this.authService.jwtService;
      const decoded = jwtHelper.decodeToken(token);
      this.usuarioLogado = {
        id: decoded.id,
        tipo: decoded.tipo,
        email: decoded.sub,
        perfis: decoded.authorities || []
      };
    }

    if (this.usuarioLogado && this.usuarioLogado.tipo === 'TECNICO') {
      this.findAllByTecnico();
    } else {
      this.findAll();
    }
    this.refresh();
  }

  findAllByTecnico(): void {
    this.service.findMyChamados().subscribe((resposta) => {
      this.CHAMADO_DATA = resposta;
      this.applyAllFilters();
      this.updateDoughnutChart();
    }, (error) => {
      this.toast.error('Erro ao listar chamados do técnico', 'ERROR');
      return throwError(error.error.error);
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  // ── Contadores por status para o hero panel ──────────────────────────────
  get totalAbertos(): number {
    return this.CHAMADO_DATA.filter(c => c.status == "0").length;
  }
  get totalEmAndamento(): number {
    return this.CHAMADO_DATA.filter(c => c.status == "1").length;
  }
  get totalEncerrados(): number {
    return this.CHAMADO_DATA.filter(c => c.status == "2").length;
  }

  // ── Contadores de urgência (apenas chamados ainda não encerrados) ──────────
  get totalAltaPrioridade(): number {
    return this.CHAMADO_DATA.filter(c => c.prioridade == "2" && c.status != "2").length;
  }
  get totalCriticaPrioridade(): number {
    return this.CHAMADO_DATA.filter(c => c.prioridade == "3" && c.status != "2").length;
  }

  // ── Contagem por prioridade — apenas chamados NÃO encerrados ──────────────
  get totalPrioridadeBaixa(): number {
    return this.CHAMADO_DATA.filter(c => c.prioridade == "0" && c.status != "2").length;
  }
  get totalPrioridadeMedia(): number {
    return this.CHAMADO_DATA.filter(c => c.prioridade == "1" && c.status != "2").length;
  }
  get totalPrioridadeAlta(): number {
    return this.CHAMADO_DATA.filter(c => c.prioridade == "2" && c.status != "2").length;
  }
  get totalPrioridadeCritica(): number {
    return this.CHAMADO_DATA.filter(c => c.prioridade == "3" && c.status != "2").length;
  }
  get hasUrgentItems(): boolean {
    return this.totalAltaPrioridade > 0 || this.totalCriticaPrioridade > 0;
  }
  get resolucaoPercent(): number {
    if (this.CHAMADO_DATA.length === 0) return 0;
    return Math.round(this.totalEncerrados / this.CHAMADO_DATA.length * 100);
  }
  get totalPendentes(): number {
    return this.totalAbertos + this.totalEmAndamento;
  }

  get hasActiveFilters() {
    return this.selectedStatus !== '' || this.selectedPrioridade !== '' || this.searchValue.trim() !== '';
  }

  // ── Carregamento de dados ─────────────────────────────────────────────────
  findAll(): void {
    this.service.findAll().subscribe((resposta) => {
      this.CHAMADO_DATA = resposta;
      this.applyAllFilters();
      this.updateDoughnutChart();
    }, (error) => {
      this.toast.error('Na listagem de chamado, procurar suporte', 'ERROR');
      return throwError(error.error.error);
    });
  }

  updateDoughnutChart(): void {
    this.doughnutChartData = {
      labels: ['Abertos', 'Em Andamento', 'Encerrados', 'Críticos'],
      datasets: [{
        data: [
          this.totalAbertos,
          this.totalEmAndamento,
          this.totalEncerrados,
          this.totalCriticaPrioridade
        ],
        backgroundColor: ['#1976d2', '#f57c00', '#66bb6a', '#f44336'],
        hoverBackgroundColor: ['#1565c0', '#e65100', '#57a05a', '#e53935'],
        borderWidth: 4,
        borderColor: '#ffffff',
        hoverBorderColor: '#ffffff'
      }]
    };
  }

  ngOnDestroy(): void {
    this.refreshTable.unsubscribe();
  }

  refresh(): void {
    this.refreshTable = this.service.refresh$.subscribe(() => {
      this.isLoading = true;
      if (this.usuarioLogado && this.usuarioLogado.tipo === 'TECNICO') {
        this.findAllByTecnico();
      } else {
        this.findAll();
      }
      setTimeout(() => { this.isLoading = false; }, 900);
    }, (error) => {
      this.toast.error('Ao carregar a lista', 'ERROR');
      return throwError(error);
    });
  }

  // ── Filtros combinados (status + prioridade + texto) ──────────────────────
  applyAllFilters(): void {
    let filtered = [...this.CHAMADO_DATA];
    if (this.selectedStatus !== '') {
      filtered = filtered.filter(c => c.status == this.selectedStatus);
    }
    if (this.selectedPrioridade !== '') {
      filtered = filtered.filter(c => c.prioridade == this.selectedPrioridade);
    }
    this.dataSource = new MatTableDataSource<Chamado>(filtered);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    if (this.searchValue) {
      this.dataSource.filter = this.searchValue.trim().toLowerCase();
    }
    // Sempre volta para a primeira página ao recarregar/filtrar dados
    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.searchValue = filterValue;
    this.applyAllFilters();
  }

  onStatusFilterChange(status: string): void {
    this.selectedStatus = status;
    this.applyAllFilters();
  }

  onPriorityFilterChange(prioridade: string): void {
    this.selectedPrioridade = prioridade;
    this.applyAllFilters();
  }

  clearFilters(): void {
    this.selectedStatus = '';
    this.selectedPrioridade = '';
    this.searchValue = '';
    this.applyAllFilters();
  }

  /** Mantido para compatibilidade – usa o novo filtro combinado */
  orderByStatus(status: any): void {
    this.selectedStatus = String(status);
    this.applyAllFilters();
  }

  // ── Dialogs ───────────────────────────────────────────────────────────────
  openCreate(): void {
    this.dialog.open(ChamadoCreateComponent, { width: "720px" })
        .afterClosed().subscribe(() => {});
  }

  reportParame(): void {
    this.dialog.open(ReportParamComponent, { width: "520px" })
        .afterClosed().subscribe(() => {});
  }

  openEdit(id: Number): void {
    this.dialog.open(ChamadoUpdateComponent, {
      width: "720px", maxHeight: "90vh",
      panelClass: "custom-dialog-container", data: { id }
    }).afterClosed().subscribe(() => {});
  }

  openRed(id: Number): void {
    this.dialog.open(ChamadoReadComponent, {
      width: "720px", maxHeight: "90vh",
      panelClass: "custom-dialog-container", data: { id }
    }).afterClosed().subscribe(() => {});
  }

  onNoClick(): void { this.dialogRef.close(); }

  // ── Labels de retorno ─────────────────────────────────────────────────────
  returnStatus(status: any): string {
    if (status == "0") return "ABERTO";
    if (status == "1") return "EM ANDAMENTO";
    return "ENCERRADO";
  }

  returnPrioridade(prioridade: any): string {
    if (prioridade == "0") return "BAIXA";
    if (prioridade == "1") return "MÉDIA";
    if (prioridade == "2") return "ALTA";
    return "CRÍTICA";
  }

  returnClassificacao(classificacao: any): string {
    if (classificacao == "0") return "HARDWARE";
    if (classificacao == "1") return "SOFTWARE";
    if (classificacao == "2") return "REDES";
    return "BANCO";
  }

  // ── Cores ─────────────────────────────────────────────────────────────────
  /** CORRIGIDO: BAIXA=verde, MÉDIA=laranja, ALTA=vermelho, CRÍTICA=roxo */
  getColorBackground(prioridade: any): string {
    if (prioridade == "0") return "#4caf50";  // BAIXA  → verde
    if (prioridade == "1") return "#ff9800";  // MÉDIA  → laranja
    if (prioridade == "2") return "#f44336";  // ALTA   → vermelho
    return "#7b1fa2";                          // CRÍTICA → roxo
  }

  /** ABERTO=azul, EM ANDAMENTO=âmbar, ENCERRADO=cinza */
  getColor(status: any): string {
    if (status == "0") return "#1976d2";  // ABERTO       → azul
    if (status == "1") return "#f57c00";  // EM ANDAMENTO → âmbar
    return "#9e9e9e";                      // ENCERRADO    → cinza
  }

  getClassificacaoColor(classificacao: any): string {
    if (classificacao == "0") return "#5c6bc0";  // HARDWARE → índigo
    if (classificacao == "1") return "#00897b";  // SOFTWARE → verde-azulado
    if (classificacao == "2") return "#039be5";  // REDES    → azul
    return "#8d6e63";                            // BANCO    → marrom
  }

  onEditChamado(chamado: Chamado) {
    if (chamado.status == '2') {
      this.toast.info(
          'Este chamado está encerrado. Para novo atendimento, crie um novo chamado.',
          'Chamado Encerrado',
          {
            timeOut: 5000,
            positionClass: 'toast-top-center',
            closeButton: true,
          }
      );
      return;
    }
    this.openEdit(chamado.id);
  }

  // ── Alteração rápida de status pela listagem ──────────────────────────────
  onInlineStatusChange(chamado: Chamado, newStatus: string): void {
    const previousStatus = chamado.status;
    chamado.status = newStatus;
    this.service.update(chamado).subscribe(() => {
      if (newStatus === '2') {
        this.toast.success(
            'Chamado encerrado! E-mail enviado com sucesso.',
            `Chamado #${chamado.id}`
        );
      } else {
        this.toast.success(
            `Status alterado para ${this.returnStatus(newStatus)}`,
            `Chamado #${chamado.id}`
        );
      }
      // findAll() já é chamado automaticamente via refresh$ do service
    }, (error) => {
      chamado.status = previousStatus;
      this.toast.error('Erro ao atualizar o status do chamado', 'ERROR');
      return throwError(error);
    });
  }

  isHighlightedNew(id: any): boolean {
    return String(id) === String(this.highlightId) && this.isNew && !this.hideNewBadge;
  }

  /* ── Chamado tooltip (click no título) ───────────────────── */

  /** Fecha ao clicar em qualquer lugar fora do título */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.hoveredChamado = null;
  }

  /** Toggle ao clicar no título: abre se fechado, fecha se já aberto */
  toggleChamadoTooltip(event: MouseEvent, chamado: Chamado): void {
    event.stopPropagation(); // impede que o document:click feche imediatamente

    if (this.hoveredChamado?.id === chamado.id) {
      this.hoveredChamado = null;
      return;
    }

    this.hoveredChamado = chamado;
    const cardWidth  = 280;
    const cardHeight = 270;
    const offsetY    = 10;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    // Posiciona abaixo do título; se não couber, coloca acima
    const belowY = rect.bottom + offsetY;
    this.tooltipY = belowY + cardHeight > window.innerHeight
      ? Math.max(8, rect.top - cardHeight - offsetY)
      : belowY;
    // Alinha à esquerda; corrige se ultrapassar borda direita
    this.tooltipX = Math.min(rect.left, window.innerWidth - cardWidth - 8);
  }
}