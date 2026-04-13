export interface TecnicoRankingDTO {
  id: number;
  nome: string;
  email: string;
  chamadosResolvidosMes: number;
  avaliacaoMedia: number;
  evolucao: EvolucaoDTO[];
}

export interface EvolucaoDTO {
  periodo: string; // Ex: "2024-04"
  chamadosResolvidos: number;
  avaliacaoMedia: number;
}

