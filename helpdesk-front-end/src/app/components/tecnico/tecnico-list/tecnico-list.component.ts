import { GenericDialog } from '../../../models/dialog/generic-dialog/generic-dialog';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription, throwError } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { TecnicoService } from '../../../services/tecnico.service';
import { Tecnico } from '../../../models/tecnico';
import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { TecnicoCreateComponent } from '../tecnico-create/tecnico-create.component';
import { TecnicoUpdateComponent } from '../tecnico-update/tecnico-update.component';
import { TecnicoDeleteDialogComponent } from '../tecnico-delete-dialog/tecnico-delete-dialog.component';
import { TecnicoReativarDialogComponent } from '../tecnico-reativar-dialog/tecnico-reativar-dialog.component';
import { MatSort } from '@angular/material/sort';

@Component({
  selector: 'app-tecnico-list',
  templateUrl: './tecnico-list.component.html',
  styleUrls: ['./tecnico-list.component.css']
})

export class TecnicoListComponent implements OnInit, OnDestroy, AfterViewInit {
  refreshTable?: Subscription;

  isLoading = false;
  searchTerm = '';
  roleFilter: number[] = [];
  /** ID do técnico cujos chamados pendentes estão sendo verificados (pré-check de inativação) */
  checkingId: number | null = null;

  TECNICO_DATA: Tecnico[] = [];
  displayedColumns: string[] = ['foto', 'id', 'nome', 'cpf', 'email', 'perfis', 'acoes'];
  dataSource = new MatTableDataSource<Tecnico>(this.TECNICO_DATA);
  /*Paninação da tabela tecnico*/
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private genericDialog: GenericDialog;

  highlightId: string | null = null;
  isNew: boolean = false;
  hideNewBadge = false;

  /* ── Avatar tooltip ──────────────────────────── */
  hoveredTecnico: Tecnico | null = null;
  tooltipX = 0;
  tooltipY = 0;

  constructor(
      private service:  TecnicoService,
      private toast:    ToastrService,
      private router:   Router,
      public dialog:    MatDialog,
      private route:    ActivatedRoute
  ) {
    this.genericDialog = new GenericDialog(dialog);
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.highlightId = params.get('highlightId');
      this.isNew = params.get('new') === 'true';
      if (this.isNew) {
        this.hideNewBadge = false;
        setTimeout(() => this.hideNewBadge = true, 300000); // 5 minutos
      }
    });
    this.findAll();
    this.refresh();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  /*Destruindo uma sessão */
  ngOnDestroy(): void {
    this.refreshTable?.unsubscribe();
  }

  get totalTecnicos(): number {
    return this.TECNICO_DATA.length;
  }

  get hasRoleFilter(): boolean {
    return this.roleFilter.length > 0;
  }

  get hasActiveFilter(): boolean {
    return this.searchTerm.length > 0 || this.hasRoleFilter;
  }

  get filteredCount(): number {
    return this.dataSource.filteredData.length;
  }

  get hasNoResults(): boolean {
    return !this.isLoading && this.filteredCount === 0;
  }

  /* ── KPIs da equipe ──────────────────────────────────────── */
  get countAtivos(): number {
    return this.TECNICO_DATA.filter(t => t.ativo !== false).length;
  }

  get countInativos(): number {
    return this.TECNICO_DATA.filter(t => t.ativo === false).length;
  }

  get ativosPct(): number {
    if (this.totalTecnicos === 0) return 0;
    return Math.round((this.countAtivos / this.totalTecnicos) * 100);
  }

  get inativosPct(): number {
    if (this.totalTecnicos === 0) return 0;
    return Math.round((this.countInativos / this.totalTecnicos) * 100);
  }

  get mesAtual(): string {
    return new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  get countNovosMes(): number {
    const now = new Date();
    return this.TECNICO_DATA.filter(t => {
      const dateStr = (t as any).dataHoraCriacao || t.dataCriacao;
      if (!dateStr) return false;
      try {
        const datePart = String(dateStr).split(' ')[0];
        const [day, month, year] = datePart.split('/').map(Number);
        if (!day || !month || !year) return false;
        const d = new Date(year, month - 1, day);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      } catch { return false; }
    }).length;
  }


  /*Dando refresh na LIST ao ADICIONAR/EDITAR um usúario, passando um LOADING */
  refresh(): void {
    this.refreshTable = this.service.refresh$.subscribe(() => {
      this.findAll();
    }, (error) => {
      this.toast.error('Ao carregar a lista', 'ERROR')
      return throwError(error);
    })
  }

  manualRefresh(): void {
    this.findAll();
  }

  private configureDataSource(data: Tecnico[]): void {
    this.TECNICO_DATA = data;

    // Apply role filter if active
    const effectiveData = this.roleFilter.length === 0
      ? data
      : data.filter(t => this.roleFilter.some(r => t.perfis.includes(r)));

    this.dataSource = new MatTableDataSource<Tecnico>(effectiveData);
    this.dataSource.filterPredicate = (tecnico: Tecnico, filter: string) => {
      const normalizedFilter = filter.trim().toLowerCase();
      return [tecnico.id, tecnico.nome, tecnico.cpf, tecnico.email]
          .some((value) => `${value ?? ''}`.toLowerCase().includes(normalizedFilter));
    };

    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }

    if (this.sort) {
      this.dataSource.sort = this.sort;
    }

    if (this.searchTerm) {
      this.dataSource.filter = this.searchTerm;
    }
  }

  /*METODO Criando um service para lista uma LIST TECNICO*/
  findAll(): void {
    this.isLoading = true;
    this.service.findAll().subscribe((resposta) => {
      this.TECNICO_DATA = resposta
      this.configureDataSource(this.TECNICO_DATA);
      this.isLoading = false;
    }, (error) => {
      this.isLoading = false;
      this.toast.error('Na listagem dos tecnicos, procurar suporte', 'ERROR')
      return throwError(error);
    })
  }

  /**
   * Verifica chamados pendentes ANTES de abrir o modal de inativação.
   * Se houver chamados em aberto/andamento, bloqueia a inativação com aviso.
   */
  inativarComValidacao(id: number): void {
    const tecnicoSelecionado = this.TECNICO_DATA.find(t => t.id == id);
    if (!tecnicoSelecionado) return;

    this.checkingId = id;
    this.service.getChamadosPendentes(id).subscribe({
      next: (pendentes) => {
        this.checkingId = null;
        if (pendentes.length > 0) {
          this.toast.warning(
            `<strong>${tecnicoSelecionado.nome}</strong> possui <strong>${pendentes.length}</strong> chamado(s) em aberto / andamento.<br>
             Transfira-os antes de inativar ou use o botão <strong>Redistribuir chamados</strong>.`,
            'Inativação bloqueada',
            { enableHtml: true, timeOut: 7000, progressBar: true }
          );
        } else {
          this.openDialogInativacao(tecnicoSelecionado);
        }
      },
      error: () => {
        this.checkingId = null;
        this.toast.error('Erro ao verificar chamados pendentes', 'Erro');
      }
    });
  }

  /** Abre o modal de confirmação de inativação (somente quando não há chamados pendentes). */
  private openDialogInativacao(tecnicoSelecionado: Tecnico): void {
    const dialogRef = this.dialog.open(TecnicoDeleteDialogComponent, {
      width: '720px',
      maxWidth: '96vw',
      disableClose: true,
      panelClass: 'no-padding-dialog',
      data: {
        tecnico: tecnicoSelecionado,
        todosTecnicos: this.TECNICO_DATA
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        this.toast.success('Técnico inativado com sucesso', tecnicoSelecionado.nome ?? 'Técnico');
        this.findAll();
      }
    });
  }

  /** Abre o modal de redistribuição de chamados diretamente (sem fluxo de inativação). */
  abrirTransferencia(id: number): void {
    const tecnicoSelecionado = this.TECNICO_DATA.find(t => t.id == id);
    if (!tecnicoSelecionado) return;

    const dialogRef = this.dialog.open(TecnicoDeleteDialogComponent, {
      width: '720px',
      maxWidth: '96vw',
      disableClose: true,
      panelClass: 'no-padding-dialog',
      data: {
        tecnico: tecnicoSelecionado,
        todosTecnicos: this.TECNICO_DATA,
        modoApenas: 'transferencia'
      }
    });

    dialogRef.afterClosed().subscribe(() => {
      // Atualiza a lista para refletir possíveis reatribuições
      this.findAll();
    });
  }

  /** @deprecated Use inativarComValidacao() — mantido para compatibilidade interna */
  delete(id: number): void {
    this.inativarComValidacao(id);
  }

  reativar(id: number): void {
    const tecnicoSelecionado = this.TECNICO_DATA.find((tecnico) => tecnico.id == id);
    if (!tecnicoSelecionado) return;

    const dialogRef = this.dialog.open(TecnicoReativarDialogComponent, {
      width: '500px',
      maxWidth: '96vw',
      disableClose: true,
      panelClass: 'dialog-no-padding',
      data: { tecnico: tecnicoSelecionado }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.service.reativarTecnico(tecnicoSelecionado.id).subscribe({
        next: () => {
          this.toast.success('Técnico reativado com sucesso', tecnicoSelecionado.nome ?? 'Técnico');
          this.findAll();
        },
        error: (err) => {
          this.toast.error(err?.error?.message || 'Erro ao reativar técnico', 'Erro');
        }
      });
    });
  }

  /*Metodo para filtrar*/
  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.searchTerm = filterValue;
    this.dataSource.filter = filterValue.trim().toLowerCase();
    this.dataSource.paginator?.firstPage();
  }

  clearFilter(input: HTMLInputElement): void {
    input.value = '';
    this.searchTerm = '';
    this.roleFilter = [];
    this.dataSource.data = this.TECNICO_DATA;
    this.dataSource.filter = '';
    this.dataSource.paginator?.firstPage();
  }

  /* ── Role filter ─────────────────────────────── */
  toggleRoleFilter(role: number): void {
    const idx = this.roleFilter.indexOf(role);
    if (idx > -1) {
      this.roleFilter.splice(idx, 1);
    } else {
      this.roleFilter.push(role);
    }
    this.applyAllFilters();
  }

  isRoleFilterActive(role: number): boolean {
    return this.roleFilter.includes(role);
  }

  private applyAllFilters(): void {
    const byRole = this.roleFilter.length === 0
      ? this.TECNICO_DATA
      : this.TECNICO_DATA.filter(t => this.roleFilter.some(r => t.perfis.includes(r)));
    this.dataSource.data = byRole;
    // text filter is auto re-applied by MatTableDataSource when .data changes
    this.dataSource.paginator?.firstPage();
  }

  /* ── Perfil helpers ──────────────────────────── */
  getPerfilLabel(perfil: number): string {
    const map: Record<number, string> = { 0: 'Admin', 1: 'Cliente', 2: 'Técnico' };
    return map[perfil] ?? '?';
  }

  getPerfilIcon(perfil: number): string {
    const map: Record<number, string> = { 0: 'admin_panel_settings', 1: 'person', 2: 'build' };
    return map[perfil] ?? 'help';
  }

  formatRegistrationDate(tecnico: Tecnico): string {
    const dateStr = (tecnico as any).dataHoraCriacao || tecnico.dataCriacao;
    if (!dateStr) return 'Técnico cadastrado';
    try {
      const datePart = String(dateStr).split(' ')[0];
      const [day, month, year] = datePart.split('/').map(Number);
      if (!day || !month || !year) return 'Técnico cadastrado';
      const d = new Date(year, month - 1, day);
      if (isNaN(d.getTime())) return 'Técnico cadastrado';
      return 'Desde ' + d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return 'Técnico cadastrado'; }
  }

  /** Retorna o nome sem a última palavra (para quebra de linha) */
  nomePrefix(nome: string): string {
    if (!nome) return '';
    const parts = nome.trim().split(' ');
    if (parts.length <= 1) return '';
    parts.pop();
    return parts.join(' ') + ' ';
  }

  /** Retorna apenas a última palavra do nome (fica no nowrap junto ao badge) */
  nomeLastWord(nome: string): string {
    if (!nome) return nome;
    const parts = nome.trim().split(' ');
    return parts[parts.length - 1];
  }

  /*MODAL para EDIATR/CRIAR/DELETAR do tecnico-update/tecnico-create/tecnico-delete */
  openCreate(): void {
    this.dialog.open(TecnicoCreateComponent, {
      width: '600px'
    });
  }

  openEdit(id: number): void {
    this.dialog.open(TecnicoUpdateComponent, {
      width: '600px',
      data: { id }//Pegando ID tecnico para editar..
    });
  }

  /* ── Atalhos do guia rápido ──────────────────────────────── */
  focusSearch(): void {
    const el = document.querySelector<HTMLInputElement>('.search-field input');
    if (el) {
      el.focus();
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  scrollToFilter(): void {
    const el = document.querySelector<HTMLElement>('.role-filter-bar');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      el.classList.add('filter-pulse');
      setTimeout(() => el.classList.remove('filter-pulse'), 1400);
    }
  }

  scrollToTable(): void {
    const el = document.querySelector<HTMLElement>('.table-wrapper');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /* ── Avatar tooltip ──────────────────────────── */
  showAvatarTooltip(event: MouseEvent, tecnico: Tecnico): void {
    this.hoveredTecnico = tecnico;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const cardWidth = 240;
    const offsetX = 12;
    // Try to the right; fall back to the left if it would overflow
    const rightX = rect.right + offsetX;
    this.tooltipX = rightX + cardWidth > window.innerWidth
      ? rect.left - cardWidth - offsetX
      : rightX;
    // Vertically align with the cell, clamped to viewport
    this.tooltipY = Math.max(8, Math.min(rect.top - 8, window.innerHeight - 160));
  }

  hideAvatarTooltip(): void {
    this.hoveredTecnico = null;
  }
}
