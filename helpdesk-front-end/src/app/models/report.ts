export interface Report {
    dataInicio:   string;
    dataFim:      string;
    /** ID do técnico para filtrar. null = todos os técnicos. */
    tecnicoId?:   number | null;
    /** Nome do técnico selecionado (apenas para exibição no diálogo de visualização). */
    tecnicoNome?: string | null;
  }
  