/**
 * Representa uma Tarefa na Agenda do técnico.
 *
 * Espelha o TarefaDTO retornado pela API backend.
 */
export interface Tarefa {
  id?: number;
  titulo: string;
  descricao?: string;

  /** Data no formato dd/MM/yyyy */
  data: string;

  /** Hora de início no formato HH:mm */
  horaInicio?: string;

  /** Hora de término no formato HH:mm */
  horaFim?: string;

  /**
   * Código numérico do status.
   * 0 = PENDENTE | 1 = EM_EXECUCAO | 2 = CONCLUIDO
   */
  status: number;

  /**
   * Código numérico da prioridade.
   * 0 = BAIXA | 1 = MEDIA | 2 = ALTA | 3 = CRITICA
   */
  prioridade: number;

  /** ID do técnico responsável */
  tecnico: number;

  /** ID do chamado vinculado (opcional) */
  chamado?: number;

  // ── Campos de leitura (populados pelo backend) ──────────────────────────
  nomeTecnico?: string;
  tituloChamado?: string;
  nomeCliente?: string;
  dataCriacao?: string;
}

/** Rótulos para os status de tarefas */
export const STATUS_TAREFA_LABELS: Record<number, string> = {
  0: 'Pendente',
  1: 'Em Execução',
  2: 'Concluído',
};

/** Rótulos para as prioridades */
export const PRIORIDADE_LABELS: Record<number, string> = {
  0: 'Baixa',
  1: 'Média',
  2: 'Alta',
  3: 'Crítica',
};

/** Cores CSS associadas a cada prioridade (para chips) */
export const PRIORIDADE_COLORS: Record<number, string> = {
  0: '#4caf50',
  1: '#ff9800',
  2: '#f44336',
  3: '#9c27b0',
};

