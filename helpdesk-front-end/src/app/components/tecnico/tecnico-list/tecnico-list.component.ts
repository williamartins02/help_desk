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

  TECNICO_DATA: Tecnico[] = [];
  displayedColumns: string[] = ['id', 'nome', 'cpf', 'email', 'acoes'];
  dataSource = new MatTableDataSource<Tecnico>(this.TECNICO_DATA);
  /*Paninação da tabela tecnico*/
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private genericDialog: GenericDialog;

  highlightId: string | null = null;
  isNew: boolean = false;
  hideNewBadge = false;

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

  get hasActiveFilter(): boolean {
    return this.searchTerm.length > 0;
  }

  get filteredCount(): number {
    return this.hasActiveFilter ? this.dataSource.filteredData.length : this.totalTecnicos;
  }

  get hasNoResults(): boolean {
    return !this.isLoading && this.filteredCount === 0;
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
    this.dataSource = new MatTableDataSource<Tecnico>(data);
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

  delete(id: number): void {
    const tecnicoSelecionado = this.TECNICO_DATA.find((tecnico) => tecnico.id == id);
    const deleteDialogRef = this.genericDialog.deleteWarningMessage();
    deleteDialogRef.afterClosed().subscribe(deleteConfirmation => {
      if(!deleteConfirmation) {
        return;
      }
      const matDialogRef = this.genericDialog.loadingMessage("Deletando Técnico...");
      this.service.delete(id).subscribe(() => {
        setTimeout(() => {
          matDialogRef.close();
          this.toast.success('Deletado com sucesso', 'Técnico ' + (tecnicoSelecionado?.nome ?? 'selecionado'));
          this.router.navigate(['/tecnicos']);
        },1000)
      }, (err) => {
        matDialogRef.close();
        if (err.error.errors)
          err.error.errors.forEach((element) => {
            this.toast.error(element.message);
          });
        this.toast.error(err.error.message)
      })
    })
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
    this.dataSource.filter = '';
    this.dataSource.paginator?.firstPage();
  }

  /*MODAL para EDIATR/CRIAR/DELETAR do tecnico-update/tecnico-create/tecnico-delete */
  openCreate(): void {
    this.dialog.open(TecnicoCreateComponent, {
      width: '600px'
    });
  }

  openEdit(id: Number): void {
    this.dialog.open(TecnicoUpdateComponent, {
      width: '600px',
      data: { id }//Pegando ID tecnico para editar..
    });
  }
}