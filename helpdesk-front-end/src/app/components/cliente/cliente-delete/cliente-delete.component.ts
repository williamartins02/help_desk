import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { Cliente } from 'src/app/models/cliente';
import { ClienteService } from 'src/app/services/cliente.service';

@Component({
  selector: 'app-cliente-delete',
  templateUrl: './cliente-delete.component.html',
  styleUrls: ['./cliente-delete.component.css']
})
export class ClienteDeleteComponent implements OnInit {

  cliente: Cliente = {
    id: '',
    nome: '',
    cpf: '',
    email: '',
    senha: '',
    perfis: [],
    dataCriacao: '',
  };

  isLoadingData = true;
  isDeleting    = false;
  errorMessage  = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { id: number },
    public  dialogRef: MatDialogRef<ClienteDeleteComponent>,
    private service:   ClienteService,
    private toast:     ToastrService,
  ) {}

  ngOnInit(): void {
    this.findById();
  }

  closeModal(confirm?: boolean): void {
    this.dialogRef.close(confirm);
  }

  findById(): void {
    this.errorMessage  = '';
    this.isLoadingData = true;

    this.service.findById(this.data.id).subscribe({
      next: (resposta) => {
        this.cliente = resposta;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar os dados do cliente.';
        this.toast.error('Não foi possível carregar os dados do cliente.', 'Cliente');
      },
      complete: () => {
        this.isLoadingData = false;
      }
    });
  }

  delete(): void {
    if (this.isDeleting) return;

    this.errorMessage = '';
    this.isDeleting   = true;

    this.service.delete(this.data.id).subscribe({
      next: () => {
        this.toast.success('Deletado com sucesso', 'Cliente ' + this.cliente.nome);
        this.closeModal(true);
      },
      error: (err) => {
        if (err?.error?.errors) {
          err.error.errors.forEach((element) => {
            this.toast.error(element.message);
          });
        }
        const fallback = err?.error?.message || 'Erro ao deletar o cliente.';
        this.errorMessage = fallback;
        this.toast.error(fallback, 'Cliente');
        this.isDeleting = false;
      }
    });
  }
}

