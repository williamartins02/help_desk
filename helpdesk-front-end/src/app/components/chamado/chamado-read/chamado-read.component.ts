import { Component, OnInit, Inject } from "@angular/core";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { ActivatedRoute } from "@angular/router";
import { Chamado } from "./../../../models/chamado";
import { throwError } from "rxjs";
import { ToastrService } from "ngx-toastr";
import { ChamadoService } from "src/app/services/chamado.service";

@Component({
  selector: "app-chamado-read",
  templateUrl: "./chamado-read.component.html",
  styleUrls: ["./chamado-read.component.css"],
})
export class ChamadoReadComponent implements OnInit {
  chamado: Chamado = {
    prioridade: '',
    status: '',
    classificacao: '',
    titulo: '',
    observacoes: '',
    tecnico: '',
    cliente: '',
    nomeCliente: '',
    nomeTecnico: '',
  };

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { id: Number },

    private chamadoService: ChamadoService,
    private toast: ToastrService,
    private route: ActivatedRoute,

    public dialogRef: MatDialogRef<ChamadoReadComponent>
  ) {}

  ngOnInit(): void {
    this.routeIdUrl();
    this.findById();
  }

  routeIdUrl(): void {
    this.chamado.id = this.route.snapshot.paramMap.get("id"); //passando id para o editar via url
  }

  findById(): void {
    this.chamadoService.findById(this.data.id).subscribe(
      (resposta) => {
        this.chamado = resposta;
      },
      (error) => {
        this.toast.error("Erro ao carregar detalhes do chamado", "ERRO");
        return throwError(error);
      }
    );
  }

  /**Retornando status como string*/
  retornaStatus(status: any): string {
    const statusMap: { [key: string]: string } = {
      '0': 'ABERTO',
      '1': 'EM ANDAMENTO',
      '2': 'ENCERRADO',
    };
    return statusMap[status] || 'DESCONHECIDO';
  }

  retornaPrioridade(prioridade: any): string {
    const prioridadeMap: { [key: string]: string } = {
      '0': 'BAIXA',
      '1': 'MÉDIA',
      '2': 'ALTA',
      '3': 'CRÍTICA',
    };
    return prioridadeMap[prioridade] || 'DESCONHECIDO';
  }

  retornaClassificacao(classificacao: any): string {
    const classificacaoMap: { [key: string]: string } = {
      '0': 'HARDWARE',
      '1': 'SOFTWARE',
      '2': 'REDES',
      '3': 'BANCO DE DADOS',
    };
    return classificacaoMap[classificacao] || 'DESCONHECIDO';
  }

  
  onNoClick(): void {
    this.dialogRef.close();
  }
}
