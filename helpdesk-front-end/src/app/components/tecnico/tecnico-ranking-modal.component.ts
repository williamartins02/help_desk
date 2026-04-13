import { Component, Input } from '@angular/core';
import { TecnicoRankingDTO } from '../../models/tecnico-ranking.dto';


@Component({
  selector: 'app-tecnico-ranking-modal',
  templateUrl: './tecnico-ranking-modal.component.html',
  styleUrls: ['./tecnico-ranking-modal.component.css']
})
export class TecnicoRankingModalComponent {
  @Input() ranking: TecnicoRankingDTO[] = [];
  @Input() show = false;
  @Input() close: () => void = () => {};

  // Marcos e ícones para a linha do tempo
  timelineMilestones = [
    { icon: 'schedule', label: 'Início do Mês' },
    { icon: 'build', label: 'Melhorias em Processos' },
    { icon: 'settings', label: 'Nova Ferramenta Adicionada' },
    { icon: 'emoji_events', label: 'Fim do Mês' }
  ];

  // Técnico selecionado para exibir evolução
  selectedIndex: number = 0;

  // Retorna a evolução do técnico selecionado
  get selectedEvolucao() {
    return this.ranking && this.ranking.length > this.selectedIndex ? this.ranking[this.selectedIndex].evolucao : [];
  }

  // Retorna o valor de chamados resolvidos para cada marco, se existir
  getEvolucaoChamados(idx: number): number | null {
    const evo = this.selectedEvolucao[idx];
    return evo ? evo.chamadosResolvidos : null;
  }

  getEvolucaoPeriodo(idx: number): string | null {
    const evo = this.selectedEvolucao[idx];
    return evo ? evo.periodo : null;
  }

  getEvolucaoAvaliacao(idx: number): number | null {
    const evo = this.selectedEvolucao[idx];
    return evo ? evo.avaliacaoMedia : null;
  }

  getMedal(index: number): string {
    switch (index) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return '';
    }
  }

  // Seleciona técnico do top 3 para exibir evolução
  selectTecnico(idx: number) {
    this.selectedIndex = idx;
  }
}
