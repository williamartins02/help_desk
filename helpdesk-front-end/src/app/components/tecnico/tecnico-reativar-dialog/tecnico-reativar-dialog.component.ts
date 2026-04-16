import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Tecnico } from '../../../models/tecnico';

export interface TecnicoReativarDialogData {
  tecnico: Tecnico;
}

@Component({
  selector: 'app-tecnico-reativar-dialog',
  templateUrl: './tecnico-reativar-dialog.component.html',
  styleUrls: ['./tecnico-reativar-dialog.component.css']
})
export class TecnicoReativarDialogComponent {
  get tecnico(): Tecnico { return this.data.tecnico; }

  constructor(
    public dialogRef: MatDialogRef<TecnicoReativarDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TecnicoReativarDialogData
  ) {}

  confirm(): void { this.dialogRef.close(true); }
  cancel(): void  { this.dialogRef.close(false); }
}

