import { Component, OnInit, OnDestroy, Inject } from "@angular/core";
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
export class ChamadoReadComponent implements OnInit, OnDestroy {
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

  slaStatus: string = '';
  slaLabel: string = '';
  slaIcon: string = 'schedule';
  slaCountdown: string = '--:--:--';

  private slaInterval: any;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { id: number },
    private chamadoService: ChamadoService,
    private toast: ToastrService,
    private route: ActivatedRoute,
    public dialogRef: MatDialogRef<ChamadoReadComponent>
  ) {}

  ngOnInit(): void {
    this.routeIdUrl();
    this.findById();
  }

  ngOnDestroy(): void {
    if (this.slaInterval) clearInterval(this.slaInterval);
  }

  routeIdUrl(): void {
    this.chamado.id = this.route.snapshot.paramMap.get("id");
  }

  findById(): void {
    this.chamadoService.findById(this.data.id).subscribe(
      (resposta) => {
        this.chamado = resposta;
        this.refreshSla();
        // Update countdown every second
        this.slaInterval = setInterval(() => this.refreshSla(), 1000);
      },
      (error) => {
        this.toast.error("Erro ao carregar detalhes do chamado", "ERRO");
        return throwError(error);
      }
    );
  }

  private refreshSla(): void {
    if (!this.chamado.prazoSla) {
      this.slaStatus = 'N/A';
      this.slaLabel  = 'SEM SLA';
      this.slaIcon   = 'schedule';
      return;
    }

    const prazo = this.parseDatetime(this.chamado.prazoSla);
    if (!prazo) return;

    // ── ENCERRADO: freeze countdown at closure time ──────────────
    if (String(this.chamado.status) === '2') {
      if (this.chamado.dataFechamento) {
        const fechamento = this.parseDatetime(this.chamado.dataFechamento);
        if (fechamento) {
          const diffMs = prazo.getTime() - fechamento.getTime();
          this.slaCountdown = this.formatCountdown(diffMs);
          if (diffMs >= 0) {
            this.slaStatus = 'ENCERRADO_NO_PRAZO';
            this.slaIcon   = 'verified';
            this.slaLabel  = 'RESOLVIDO NO PRAZO';
          } else {
            this.slaStatus = 'ENCERRADO_ATRASADO';
            this.slaIcon   = 'running_with_errors';
            this.slaLabel  = 'RESOLVIDO COM ATRASO';
          }
          // Stop interval — chamado is closed, counter must freeze
          if (this.slaInterval) {
            clearInterval(this.slaInterval);
            this.slaInterval = null;
          }
          return;
        }
      }
      this.slaStatus = 'ENCERRADO_NO_PRAZO';
      this.slaIcon   = 'verified';
      this.slaLabel  = 'ENCERRADO';
      if (this.slaInterval) {
        clearInterval(this.slaInterval);
        this.slaInterval = null;
      }
      return;
    }

    // ── ABERTO / ANDAMENTO: live countdown ───────────────────────
    const abertura = this.chamado.dataAbertura ? this.parseDatetime(this.chamado.dataAbertura) : null;
    const now = Date.now();
    if (now > prazo.getTime()) {
      this.slaStatus = 'ATRASADO';
      this.slaIcon   = 'timer_off';
      this.slaLabel  = 'ATRASADO';
    } else {
      const total = abertura ? prazo.getTime() - abertura.getTime() : 0;
      const remaining = prazo.getTime() - now;
      if (total > 0 && remaining < total / 2) {
        this.slaStatus = 'ALERTA';
        this.slaIcon   = 'timer';
        this.slaLabel  = 'ATENÇÃO';
      } else {
        this.slaStatus = 'DENTRO_PRAZO';
        this.slaIcon   = 'schedule';
        this.slaLabel  = 'NO PRAZO';
      }
    }
    this.slaCountdown = this.formatCountdown(prazo.getTime() - now);
  }

  private formatCountdown(diffMs: number): string {
    const sign = diffMs < 0 ? '-' : '';
    const abs = Math.abs(diffMs);
    const hh = Math.floor(abs / 3600000);
    const mm = Math.floor((abs % 3600000) / 60000);
    const ss = Math.floor((abs % 60000) / 1000);
    return `${sign}${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  }

  private parseDatetime(str: string): Date | null {
    if (!str) return null;
    const m = str.match(/(\d{2})\/(\d{2})\/(\d{4}) - (\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
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

