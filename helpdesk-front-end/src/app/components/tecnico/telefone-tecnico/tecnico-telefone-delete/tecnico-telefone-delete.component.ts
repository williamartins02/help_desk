import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { Telefone } from 'src/app/models/telefone';
import { TelefoneService } from 'src/app/services/telefone.service';

@Component({
  selector: 'app-tecnico-telefone-delete',
  templateUrl: './tecnico-telefone-delete.component.html',
  styleUrls: ['./tecnico-telefone-delete.component.css']
})
export class TecnicoTelefoneDeleteComponent implements OnInit {
  telefone: Telefone = {
    id: '',
    numero:       '',
    tecnico:      '',
    tipoTelefone: '',
    nomeTecnico:  '',
  }

  isLoadingData = true;
  isDeleting = false;
  errorMessage = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { id: number },
    public dialogRef: MatDialogRef<TecnicoTelefoneDeleteComponent>,
    private service: TelefoneService,
    private toast: ToastrService,
  ) {}

  ngOnInit(): void {
    this.findById();
  }

  public closeModal(confirm?: boolean): void{
    this.dialogRef.close(confirm);
  }

  findById(): void {
    this.errorMessage = '';
    this.isLoadingData = true;

    this.service.findByTelefoneId(this.data.id).subscribe({
      next: (resposta) => {
        this.telefone = resposta;
      },
      error: () => {
        this.errorMessage = 'Nao foi possivel carregar os dados do telefone.';
        this.toast.error('Nao foi possivel carregar os dados do telefone.', 'Telefone');
      },
      complete: () => {
        this.isLoadingData = false;
      }
    });
  }

  delete(): void {
    if (this.isDeleting) {
      return;
    }

    this.errorMessage = '';
    this.isDeleting = true;

    this.service.delete(this.data.id).subscribe({
      next: () => {
        this.toast.success('Deletado com sucesso', 'Telefone');
        this.closeModal(true);
      },
      error: (err) => {
        if (err?.error?.errors) {
          err.error.errors.forEach((element) => {
          this.toast.error(element.message);
          });
        }
        const fallbackMessage = err?.error?.message || 'Erro ao deletar telefone.';
        this.errorMessage = fallbackMessage;
        this.toast.error(fallbackMessage, 'Telefone');
      },
      complete: () => {
        this.isDeleting = false;
      }
    });
  }

}
