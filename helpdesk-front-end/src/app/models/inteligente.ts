export interface SugestaoRequest {
  titulo?: string;
  observacoes?: string;
  classificacao?: number | null;
}

export interface SugestaoTecnico {
  tecnicoId: number;
  nomeTecnico: string;
  totalChamadosSemelhantes: number;
  tempoMedioResolucao: string;
}

export interface SugestaoClassificacao {
  classificacaoCodigo: number;
  classificacaoNome: string;
  totalOcorrencias: number;
}

export interface ChamadoSemelhant {
  id: number;
  titulo: string;
  nomeTecnico: string;
  tempoResolucao: string;
  status: string;
  classificacao: string;
}

