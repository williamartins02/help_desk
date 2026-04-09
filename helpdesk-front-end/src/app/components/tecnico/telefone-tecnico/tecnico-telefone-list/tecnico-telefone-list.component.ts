import { throwError, Subscription } from 'rxjs';
import { Tecnico } from './../../../../models/tecnico';
import { ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { MatPaginator } from '@angular/material/paginator';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { Telefone } from './../../../../models/telefone';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { TelefoneService } from 'src/app/services/telefone.service';
import { TecnicoTelefoneCreateComponent } from '../tecnico-telefone-create/tecnico-telefone-create.component';
import { TecnicoTelefoneDeleteComponent } from '../tecnico-telefone-delete/tecnico-telefone-delete.component';
import { TecnicoTelefoneUpdateComponent } from '../tecnico-telefone-update/tecnico-telefone-update.component';

@Component({
  selector: 'app-tecnico-telefone-list',
  templateUrl: './tecnico-telefone-list.component.html',
  styleUrls: ['./tecnico-telefone-list.component.css']
})
export class TecnicoTelefoneListComponent implements OnInit, OnDestroy {

  refreshTable: Subscription;
  isLoading = false;
  searchTerm = '';
  telefone: Telefone = {
    id:           '',
    numero:       '',
    tecnico:      '',
    tipoTelefone: '',
    nomeTecnico:  '',
  }
  tecnicos: Tecnico[] = [];
  TELEFONE_DATA: Telefone[] = [];
  displayedColumns: string[] = ['id', 'tipoTelefone', 'numero', 'tecnico', 'acoes'];
  dataSource = new MatTableDataSource<Telefone>(this.TELEFONE_DATA);
  /*Paninação da tabela tecnico*/
  @ViewChild(MatPaginator) paginator: MatPaginator;

  constructor(
    public dialogRef: MatDialogRef<TecnicoTelefoneListComponent>,
    private service: TelefoneService,
    private toast: ToastrService,
    public dialog: MatDialog,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.findByTecnicoId();
    this.refresh();
  }

  get filteredCount(): number {
    return this.dataSource.filteredData?.length ?? this.TELEFONE_DATA.length;
  }

  get hasActiveFilter(): boolean {
    return this.searchTerm.trim().length > 0;
  }

  get hasNoResults(): boolean {
    return !this.isLoading && this.filteredCount === 0;
  }

    /*METODO Criando um service para lista uma LIST TECNICO-TELEFONE*/
  findByTecnicoId() {
    const id = this.route.snapshot.paramMap.get('id');
    this.isLoading = true;

    this.service.findById(id).subscribe({
      next: (resposta) => {
        this.TELEFONE_DATA = resposta;
        this.dataSource = new MatTableDataSource<Telefone>(resposta);
        this.dataSource.paginator = this.paginator;
        this.dataSource.filter = this.searchTerm.trim().toLowerCase();
      },
      error: () => {
        this.toast.error('Ao carregar a lista', 'ERROR');
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }
  /*Destruindo uma sessão */
  ngOnDestroy(): void {
    this.refreshTable?.unsubscribe();
  }
  /*Dando refresh na LIST ao ADICIONAR/EDITAR um usúario, passando um LOADING */
  refresh() {
    this.refreshTable = this.service.refresh$.subscribe(() => {
      this.findByTecnicoId();
    }, (error) => {
      this.toast.error('Ao carregar a lista', 'ERROR')
      return throwError(error);
    })
  }

  manualRefresh(): void {
    this.findByTecnicoId();
  }

  returnTipoTel(status: any): string {
    if (status == '0') {
      return 'CASA';
    } else if (status == '1') {
      return 'EMPRESA';
    }
    return 'CELULAR';
  }

  /*Metodo para filtrar*/
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
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
    this.dialog.open(TecnicoTelefoneCreateComponent, {
      width: '600px',
      data: { id: this.route.snapshot.paramMap.get('id') }
    });
  }

  openEdit(id: Number): void {
    this.dialog.open(TecnicoTelefoneUpdateComponent, {
      width: '600px',
      data: { id }
    });
  }

  openDelete(id: Number): void {
    this.dialog.open(TecnicoTelefoneDeleteComponent, {
      width: '520px',
      maxWidth: '95vw',
      data: { id }
    });
  }

  getColor(status: any): string {
    if (status == '0') return '#5c6bc0';   // CASA   — indigo
    if (status == '1') return '#ef6c00';   // EMPRESA — orange
    return '#2e7d32';                       // CELULAR — green
  }

}
