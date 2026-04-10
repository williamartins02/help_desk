import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Chamado } from '../../../models/chamado';

export interface ChamadoDetalheData { chamado: Chamado; }

@Component({
  selector: 'app-chamado-detalhe-dialog',
  templateUrl: './chamado-detalhe-dialog.component.html',
  styleUrls:  ['./chamado-detalhe-dialog.component.css']
})
export class ChamadoDetalheDialogComponent {

  chamado: Chamado;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ChamadoDetalheData,
    public dialogRef: MatDialogRef<ChamadoDetalheDialogComponent>
  ) {
    this.chamado = data.chamado;
  }

  // ── Estado ────────────────────────────────────────────────────────────────
  get isEncerrado():      boolean { return Number(this.chamado.status) === 2; }
  get isEmAndamento():    boolean { return Number(this.chamado.status) === 1; }
  get isAberto():         boolean { return Number(this.chamado.status) === 0; }
  get isCritico():        boolean { return Number(this.chamado.prioridade) === 3; }
  get isAltaPrioridade(): boolean { return Number(this.chamado.prioridade) >= 2; }

  // ── Status ────────────────────────────────────────────────────────────────
  getStatusLabel(): string {
    return (['Aberto', 'Em Andamento', 'Encerrado'] as any)[Number(this.chamado.status)] ?? '—';
  }
  getStatusColor(): string {
    return (['#d32f2f', '#f57c00', '#2e7d32'] as any)[Number(this.chamado.status)] ?? '#607d8b';
  }
  getStatusBg(): string {
    return (['#ffebee', '#fff3e0', '#e8f5e9'] as any)[Number(this.chamado.status)] ?? '#f5f5f5';
  }
  getStatusIcon(): string {
    return (['radio_button_unchecked', 'autorenew', 'check_circle'] as any)[Number(this.chamado.status)] ?? 'help';
  }

  // ── Prioridade ────────────────────────────────────────────────────────────
  getPrioridadeLabel(): string {
    return (['Baixa', 'Média', 'Alta', 'Crítica'] as any)[Number(this.chamado.prioridade)] ?? '—';
  }
  getPrioridadeColor(): string {
    return (['#2e7d32', '#f57c00', '#d32f2f', '#7b1fa2'] as any)[Number(this.chamado.prioridade)] ?? '#607d8b';
  }
  getPrioridadeBg(): string {
    return (['#e8f5e9', '#fff3e0', '#ffebee', '#f3e5f5'] as any)[Number(this.chamado.prioridade)] ?? '#f5f5f5';
  }
  getPrioridadeIcon(): string {
    return (['arrow_downward', 'remove', 'arrow_upward', 'warning'] as any)[Number(this.chamado.prioridade)] ?? 'flag';
  }

  // ── Classificação ─────────────────────────────────────────────────────────
  getClassificacaoLabel(): string {
    const m: {[k: string]: string} = { '0': 'Software', '1': 'Hardware', '2': 'Rede', '3': 'Outros' };
    return m[String(this.chamado.classificacao)] ?? String(this.chamado.classificacao);
  }
  getClassificacaoIcon(): string {
    const m: {[k: string]: string} = {
      '0': 'computer', '1': 'memory', '2': 'wifi', '3': 'help_outline'
    };
    return m[String(this.chamado.classificacao)] ?? 'category';
  }

  // ── Header gradient baseado em prioridade/status ──────────────────────────
  getHeaderGradient(): string {
    if (this.isCritico)    return 'linear-gradient(135deg, #4a148c 0%, #7b1fa2 100%)';
    if (Number(this.chamado.prioridade) === 2) return 'linear-gradient(135deg, #b71c1c 0%, #c62828 100%)';
    if (this.isEncerrado)  return 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)';
    if (this.isEmAndamento) return 'linear-gradient(135deg, #e65100 0%, #f57c00 100%)';
    return 'linear-gradient(135deg, #0d47a1 0%, #1565c0 100%)';
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  formatDate(d: any): string {
    if (!d) return '—';
    const s = String(d);
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, day] = s.split('-');
      return `${day}/${m}/${y}`;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
      const [datePart, timePart] = s.split('T');
      const [y, m, day] = datePart.split('-');
      return `${day}/${m}/${y} ${(timePart || '').substring(0, 5)}`.trim();
    }
    return s;
  }

  close(): void { this.dialogRef.close(); }
}

