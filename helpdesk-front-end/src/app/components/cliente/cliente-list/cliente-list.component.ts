import { ClienteService } from './../../../services/cliente.service';

import { GenericDialog } from './../../../models/dialog/generic-dialog/generic-dialog';
import { Cliente } from './../../../models/cliente';

import { Router, ActivatedRoute } from '@angular/router';
import { ClienteUpdateComponent } from '../cliente-update/cliente-update.component';
import { ClienteDeleteComponent } from '../cliente-delete/cliente-delete.component';
import { Subscription, throwError } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild, Inject } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ClienteCreateComponent } from '../cliente-create/cliente-create.component';
import { MatSort } from '@angular/material/sort';

@Component({
  selector: 'app-cliente-list',
  templateUrl: './cliente-list.component.html',
  styleUrls: ['./cliente-list.component.css']
})
export class ClienteListComponent implements OnInit, AfterViewInit, OnDestroy {

  /*Scrooll da tabela */
  items = Array.from({ length: 100000 }).map((_, i) => `Item #${i}`);
  //refresh
  refreshTable: Subscription;
  isLoading = false;
  lastRefreshed: Date | null = null;
  searchTerm = '';

  cliente: Cliente = {
    id: '',
    nome: '',
    cpf: '',
    email: '',
    senha: '',
    perfis: [],
    dataCriacao: '',
  };

  CLIENTE_DATA: Cliente[] = [];
  //injetando o ID para abrir no modal
  @Inject(MAT_DIALOG_DATA) public data: { id: Number };
  //informaçoes da tabela (COLUNNAS)
  displayedColumns: string[] = ['id', 'nome', 'cpf', 'email', 'acoes'];
  dataSource = new MatTableDataSource<Cliente>(this.CLIENTE_DATA);
  /*Paninação da tabela cliente*/
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private genericDialog: GenericDialog;
  highlightId: string | null = null;
  isNew: boolean = false;
  hideNewBadge = false;

  constructor(
      public  dialogRef: MatDialogRef<ClienteListComponent>,
      private service:   ClienteService,
      private toast:     ToastrService,
      public  dialog:    MatDialog,
      private router:    Router,
      private route:     ActivatedRoute,
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
    // Garante que o filtro dinâmico funcione sempre para nome, CPF e e-mail
    this.dataSource.filterPredicate = (cliente: Cliente, filter: string) => {
      const normalizedFilter = filter.trim().toLowerCase();
      return [cliente.id, cliente.nome, cliente.cpf, cliente.email]
        .some((value) => `${value ?? ''}`.toLowerCase().includes(normalizedFilter));
    };
  }

  ngOnDestroy(): void {
    this.refreshTable?.unsubscribe();
  }

  // ── Computed getters ──────────────────────────────────────
  get totalClientes(): number {
    return this.CLIENTE_DATA.length;
  }

  get hasActiveFilter(): boolean {
    return this.searchTerm.length > 0;
  }

  get filteredCount(): number {
    return this.hasActiveFilter ? this.dataSource.filteredData.length : this.totalClientes;
  }

  get hasNoResults(): boolean {
    return !this.isLoading && this.filteredCount === 0;
  }

  get lastRefreshedLabel(): string {
    if (!this.lastRefreshed) return '';
    return this.lastRefreshed.toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  // ── Data ──────────────────────────────────────────────────
  private configureDataSource(data: Cliente[]): void {
    this.dataSource = new MatTableDataSource<Cliente>(data);
    this.dataSource.filterPredicate = (cliente: Cliente, filter: string) => {
      const normalizedFilter = filter.trim().toLowerCase();
      return [cliente.id, cliente.nome, cliente.cpf, cliente.email]
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

  refresh(): void {
    this.refreshTable = this.service.refresh$.subscribe(() => {
      this.findAll();
    }, (error) => {
      this.toast.error('Ao carregar a lista', 'ERROR');
      return throwError(error);
    });
  }

  manualRefresh(): void {
    this.findAll();
  }

  findById(): void {
    this.service.findById(this.data.id).subscribe((resposta) => {
      resposta.perfis = [];
      this.cliente = resposta;
    });
  }

  /*METODO Criando um service para lista uma LIST TECNICO*/
  findAll(): void {
    this.isLoading = true;
    this.service.findAll().subscribe((resposta) => {
      this.CLIENTE_DATA = resposta;
      this.configureDataSource(this.CLIENTE_DATA);
      this.isLoading = false;
      this.lastRefreshed = new Date();
    }, (error) => {
      this.isLoading = false;
      this.toast.error('Na listagem dos clientes, procurar suporte', 'ERROR');
      return throwError(error);
    });
  }

  delete(id: number): void {
    const dialogRef = this.dialog.open(ClienteDeleteComponent, {
      width: '540px',
      maxWidth: '98vw',
      panelClass: 'custom-dialog-container',
      data: { id },
    });

    dialogRef.afterClosed().subscribe((deleted: boolean) => {
      if (deleted) {
        this.router.navigate(['/clientes']);
      }
    });
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  /*Metodo para filtrar*/
  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.searchTerm = filterValue;
    this.dataSource.filter = filterValue;
    this.dataSource.paginator?.firstPage();
  }

  clearFilter(input: HTMLInputElement): void {
    input.value = '';
    this.searchTerm = '';
    this.dataSource.filter = '';
    this.dataSource.paginator?.firstPage();
  }

  /*MODAL para EDIATR/CRIAR/DELETAR do cliente-update/cliente-create/cliente-delete */
  openCreate(): void {
    this.dialog.open(ClienteCreateComponent, {
      width: '560px',
      maxHeight: '90vh',
      panelClass: 'custom-dialog-container',
    });
  }

  openEdit(id: Number): void {
    this.dialog.open(ClienteUpdateComponent, {
      width: '560px',
      maxHeight: '90vh',
      panelClass: 'custom-dialog-container',
      data: { id },
    });
  }

  isHighlightedNew(id: any): boolean {
    return String(id) === String(this.highlightId) && this.isNew && !this.hideNewBadge;
  }
}