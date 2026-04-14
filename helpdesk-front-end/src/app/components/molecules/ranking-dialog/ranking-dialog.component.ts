import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Chamado } from '../../../models/chamado';
import { Tecnico } from '../../../models/tecnico';

export interface RankingDialogData {
  chamados: Chamado[];
  tecnicos: Tecnico[];
}

export interface TecnicoRanking {
  nome: string;
  totalAtendidos: number;
  totalAbertos: number;
  totalEmAndamento: number;
  taxaResolucao: number;
  chamados: Chamado[];
}

export interface TimelineEvento {
  icone: string;
  cor: string;
  titulo: string;
  descricao: string;
  data: string;
}

@Component({
  selector: 'app-ranking-dialog',
  templateUrl: './ranking-dialog.component.html',
  styleUrls: ['./ranking-dialog.component.css']
})
export class RankingDialogComponent implements OnInit {

  ranking: TecnicoRanking[] = [];
  tecnicoSelecionado: TecnicoRanking | null = null;
  chamadoSelecionado: Chamado | null = null;
  timelineEventos: TimelineEvento[] = [];

  tabIndex = 0;

  statusLabels: { [key: string]: string } = {
    '0': 'Aberto',
    '1': 'Em Andamento',
    '2': 'Encerrado'
  };

  prioridadeLabels: { [key: string]: string } = {
    '0': 'Baixa',
    '1': 'Média',
    '2': 'Alta',
    '3': 'Crítica'
  };

  classificacaoLabels: { [key: string]: string } = {
    '0': 'SOFTWARE',
    '1': 'HARDWARE',
    '2': 'REDE'
  };

  constructor(
    public dialogRef: MatDialogRef<RankingDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RankingDialogData
  ) {}

  ngOnInit(): void {
    this.buildRanking();
  }

  private buildRanking(): void {
    const map = new Map<string, TecnicoRanking>();

    // Agrupa chamados por nomeTecnico
    for (const c of this.data.chamados) {
      const nome = (c.nomeTecnico || 'Sem técnico').trim();
      if (!map.has(nome)) {
        map.set(nome, {
          nome,
          totalAtendidos:   0,
          totalAbertos:     0,
          totalEmAndamento: 0,
          taxaResolucao:    0,
          chamados:         []
        });
      }
      const entry = map.get(nome)!;
      entry.chamados.push(c);
      if (c.status == '2') entry.totalAtendidos++;
      else if (c.status == '0') entry.totalAbertos++;
      else if (c.status == '1') entry.totalEmAndamento++;
    }

    // Ordena por total atendidos desc
    this.ranking = Array.from(map.values())
      .sort((a, b) => b.totalAtendidos - a.totalAtendidos);

    // Calcula taxa de resolução
    for (const r of this.ranking) {
      const total = r.chamados.length;
      r.taxaResolucao = total > 0 ? Math.round(r.totalAtendidos / total * 100) : 0;
    }
  }

  get maxAtendidos(): number {
    return this.ranking.length > 0 ? this.ranking[0].totalAtendidos : 1;
  }

  getMedalIcon(index: number): string {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return '';
  }

  getMedalClass(index: number): string {
    if (index === 0) return 'medal-gold';
    if (index === 1) return 'medal-silver';
    if (index === 2) return 'medal-bronze';
    return '';
  }

  selecionarTecnico(tecnico: TecnicoRanking, tab: number = 1): void {
    this.tecnicoSelecionado = tecnico;
    this.chamadoSelecionado = null;
    this.timelineEventos = [];
    this.tabIndex = tab;
  }

  selecionarChamado(chamado: Chamado): void {
    this.chamadoSelecionado = chamado;
    this.buildTimeline(chamado);
    this.tabIndex = 2;
  }

  private buildTimeline(c: Chamado): void {
    const eventos: TimelineEvento[] = [];

    // Abertura
    if (c.dataAbertura) {
      eventos.push({
        icone:     'add_circle',
        cor:       '#1976d2',
        titulo:    'Chamado Aberto',
        descricao: `Aberto por ${c.nomeCliente || 'cliente'}`,
        data:      c.dataAbertura
      });
    }

    // Técnico atribuído
    if (c.nomeTecnico) {
      eventos.push({
        icone:     'engineering',
        cor:       '#7b1fa2',
        titulo:    'Técnico Atribuído',
        descricao: `Responsável: ${c.nomeTecnico}`,
        data:      c.dataAbertura || ''
      });
    }

    // Em andamento
    if (c.status == '1' || c.status == '2') {
      eventos.push({
        icone:     'autorenew',
        cor:       '#f57c00',
        titulo:    'Em Andamento',
        descricao: `Prioridade: ${this.prioridadeLabels[c.prioridade] || c.prioridade}`,
        data:      c.dataAbertura || ''
      });
    }

    // Encerramento
    if (c.status == '2' && c.dataFechamento) {
      eventos.push({
        icone:     'check_circle',
        cor:       '#43a047',
        titulo:    'Chamado Encerrado',
        descricao: `Resolvido com sucesso`,
        data:      c.dataFechamento
      });
    }

    this.timelineEventos = eventos;
  }

  getStatusColor(status: string): string {
    if (status == '0') return '#1976d2';
    if (status == '1') return '#f57c00';
    return '#43a047';
  }

  getStatusIcon(status: string): string {
    if (status == '0') return 'add_circle_outline';
    if (status == '1') return 'autorenew';
    return 'check_circle_outline';
  }

  getPrioridadeColor(prioridade: string): string {
    if (prioridade == '3') return '#e53935';
    if (prioridade == '2') return '#fb8c00';
    if (prioridade == '1') return '#fdd835';
    return '#66bb6a';
  }

  onClose(): void {
    this.dialogRef.close();
  }
}

