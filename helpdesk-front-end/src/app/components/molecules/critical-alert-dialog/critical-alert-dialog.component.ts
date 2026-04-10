import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface CriticalAlertData {
  count: number;
  userName: string;
  oldestOpenedAt: number; // timestamp da data de abertura do chamado mais antigo
}

@Component({
  selector: 'app-critical-alert-dialog',
  templateUrl: './critical-alert-dialog.component.html',
  styleUrls: ['./critical-alert-dialog.component.css']
})
export class CriticalAlertDialogComponent implements OnInit, OnDestroy {
  count: number;
  userName: string;
  oldestTimeText = '';
  dontShowAgain = false;

  private timerInterval: any;
  private oldestOpenedAt: number;

  constructor(
    public dialogRef: MatDialogRef<CriticalAlertDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CriticalAlertData
  ) {
    this.count = data.count;
    this.userName = data.userName;
    this.oldestOpenedAt = data.oldestOpenedAt || 0;
  }

  ngOnInit(): void {
    this.updateTimeText();
    // Atualiza o tempo relativo a cada 30 segundos
    this.timerInterval = setInterval(() => this.updateTimeText(), 30000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  private updateTimeText(): void {
    if (!this.oldestOpenedAt) {
      this.oldestTimeText = 'alguns instantes';
      return;
    }
    const diffMs = Date.now() - this.oldestOpenedAt;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1)    { this.oldestTimeText = 'menos de 1 minuto'; return; }
    if (diffMin === 1)  { this.oldestTimeText = '1 minuto'; return; }
    if (diffMin < 60)   { this.oldestTimeText = `${diffMin} minutos`; return; }

    const h = Math.floor(diffMin / 60);
    if (h === 1)  { this.oldestTimeText = '1 hora'; return; }
    if (h < 24)   { this.oldestTimeText = `${h} horas`; return; }

    const d = Math.floor(h / 24);
    if (d === 1)  { this.oldestTimeText = '1 dia'; return; }
    if (d < 30)   { this.oldestTimeText = `${d} dias`; return; }

    const mo = Math.floor(d / 30);
    if (mo === 1) { this.oldestTimeText = '1 mês'; return; }
    this.oldestTimeText = `${mo} meses`;
  }

  onClose() {
    this.dialogRef.close({ dontShowAgain: this.dontShowAgain });
  }

  onViewCritical() {
    this.dialogRef.close({ action: 'view', dontShowAgain: this.dontShowAgain });
  }
}
