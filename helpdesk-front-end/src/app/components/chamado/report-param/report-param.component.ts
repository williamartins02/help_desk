import { FormControl, Validators } from '@angular/forms';
import { Report } from './../../../models/report';
import { RelatorioChamadoComponent } from './../relatorio-chamado/relatorio-chamado.component';
import { Component } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-report-param',
  templateUrl: './report-param.component.html',
  styleUrls: ['./report-param.component.css']
})
export class ReportParamComponent {

  private readonly datePattern = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;

  userReport: Report = {
    dataInicio:  '',
    dataFim:     '',
  }

  dataInicio: FormControl = new FormControl('', [Validators.required, Validators.pattern(this.datePattern)]);
  dataFim: FormControl = new FormControl('', [Validators.required, Validators.pattern(this.datePattern)]);

  constructor(
    public dialogRef: MatDialogRef<ReportParamComponent>,
    public dialog: MatDialog,
  ) { }

  private parseDate(value: string): Date | null {
    if (!value || !this.datePattern.test(value)) {
      return null;
    }

    const [dayString, monthString, yearString] = value.split('/');
    const day = Number(dayString);
    const month = Number(monthString);
    const year = Number(yearString);
    const parsed = new Date(year, month - 1, day);

    // Garante que 31/02, por exemplo, seja inválida.
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      return null;
    }

    return parsed;
  }

  gerarRelatorio(): void {
    if (!this.validaCampos()) {
      this.dataInicio.markAsTouched();
      this.dataFim.markAsTouched();
      return;
    }

    const data: Report = {
      dataInicio: String(this.dataInicio.value).trim(),
      dataFim: String(this.dataFim.value).trim(),
    };

    this.dialog.open(RelatorioChamadoComponent, {
      height: '90%',
      width: '90%',
      data,
    });

    this.onNoClick();
  }

    onNoClick(): void {
      this.dialogRef.close();
    }

  validaCampos(): boolean {
    if (!this.dataInicio.valid || !this.dataFim.valid) {
      return false;
    }

    const inicio = this.parseDate(String(this.dataInicio.value).trim());
    const fim = this.parseDate(String(this.dataFim.value).trim());

    if (!inicio || !fim) {
      return false;
    }

    return inicio.getTime() <= fim.getTime();
  }
  }




