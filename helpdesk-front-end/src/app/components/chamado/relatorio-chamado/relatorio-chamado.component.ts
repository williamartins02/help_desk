import { GenericDialogComponent } from './../../molecules/generic-dialog/generic-dialog.component';
import { GenericDialog } from './../../../models/dialog/generic-dialog/generic-dialog';
import { Report } from './../../../models/report';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { RelatorioService } from './../../../services/relatorio.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ToastrService } from 'ngx-toastr';

import { Component, Inject, OnDestroy, OnInit } from '@angular/core';

@Component({
  selector: 'app-relatorio-chamado',
  templateUrl: './relatorio-chamado.component.html',
  styleUrls: ['./relatorio-chamado.component.css']
})
export class RelatorioChamadoComponent implements OnInit, OnDestroy {


  private genericDialog: GenericDialog;
  private matDialogRef: MatDialogRef<GenericDialogComponent>;
  isLoading = false;
  pdfSrc: SafeResourceUrl | null = null;
  generatedBlobUrl: string | null = null;
  today: string = new Date().toLocaleDateString('pt-BR');

  constructor(
    private relatorioService: RelatorioService,
    private sanitizer: DomSanitizer,
    private toast: ToastrService,
    public dialogRef: MatDialogRef<RelatorioChamadoComponent>,
    public dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: Report,
  ) { 
    this.genericDialog = new GenericDialog(dialog);
  }

  ngOnInit(): void {
    this.imprimiRelatorio();
    //this.matDialogRef = this.genericDialog.loadingMessage("Carregando relatorio...");
  }

  ngOnDestroy(): void {
    if (this.generatedBlobUrl) {
      URL.revokeObjectURL(this.generatedBlobUrl);
      this.generatedBlobUrl = null;
    }
  }

  imprimiRelatorio(): void {
    this.isLoading = true;
    this.relatorioService.downloadPdfRelatorioParam(this.data).subscribe({
      next: (response) => {
        const value = (response || '').trim();

        if (!value) {
          this.toast.error('Relatório vazio ou inválido.', 'ERROR');
          this.isLoading = false;
          return;
        }

        if (value.startsWith('http') || value.startsWith('data:application/pdf') || value.startsWith('blob:')) {
          this.pdfSrc = this.sanitizer.bypassSecurityTrustResourceUrl(value);
          this.generatedBlobUrl = value; // permite o botão de download funcionar para URLs diretas
        } else {
          try {
            const base64Payload = value.includes(',') ? value.split(',')[1] : value;
            const byteCharacters = atob(base64Payload);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });

            if (this.generatedBlobUrl) {
              URL.revokeObjectURL(this.generatedBlobUrl);
            }
            this.generatedBlobUrl = URL.createObjectURL(blob);
            this.pdfSrc = this.sanitizer.bypassSecurityTrustResourceUrl(this.generatedBlobUrl);
          } catch {
            this.toast.error('Formato de retorno do relatório inválido.', 'ERROR');
            this.isLoading = false;
            return;
          }
        }

        this.isLoading = false;
      },
      error: () => {
        this.toast.error('Não foi possível gerar o relatório.', 'ERROR');
        this.isLoading = false;
      }
    });
  }
  //imprimeReport(): void{
    //this.relatortioService.downloadPdfRelatorio();
  //}

  downloadPdf(): void {
    if (!this.generatedBlobUrl) { return; }
    const start = this.data.dataInicio.replace(/\//g, '-');
    const end   = this.data.dataFim.replace(/\//g, '-');
    const filename = `relatorio-chamados_${start}_${end}.pdf`;

    // Para URLs http externas, busca o conteúdo e força o download via blob
    if (this.generatedBlobUrl.startsWith('http')) {
      fetch(this.generatedBlobUrl)
        .then(res => res.blob())
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(blobUrl);
        })
        .catch(() => this.toast.error('Não foi possível baixar o relatório.', 'Erro'));
      return;
    }

    const a = document.createElement('a');
    a.href = this.generatedBlobUrl;
    a.download = filename;
    a.click();
  }

  onNoClick(): void {
    this.dialogRef.close();
  }
}
