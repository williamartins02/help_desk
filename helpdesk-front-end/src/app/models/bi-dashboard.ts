export interface TecnicoMetrica {
  id: number;
  nome: string;
  totalResolvidos: number;
  tempoMedioResolucaoMins: number;
  slaPercent: number;
  posicao: number;
}
export interface EvolucaoDia {
  data: string;
  abertos: number;
  encerrados: number;
  emAndamento: number;
}
export interface BiDashboard {
  totalChamados: number;
  totalEncerrados: number;
  totalAbertos: number;
  totalAndamento: number;
  totalCriticos: number;
  tempoMedioResolucaoMins: number;
  slaPercent: number;
  porCategoria: { [key: string]: number };
  porStatus: { [key: string]: number };
  porPrioridade: { [key: string]: number };
  tecnicosRanking: TecnicoMetrica[];
  evolucao: EvolucaoDia[];
  alertasGargalo: string[];
}
export interface BiFiltro {
  dataInicio?: string;
  dataFim?: string;
  tecnicoId?: number | null;
  status?: number | null;
  prioridade?: number | null;
}
