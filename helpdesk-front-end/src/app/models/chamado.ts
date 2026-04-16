export interface Chamado{
    id?:                 any;
    dataAbertura?:       string;
    dataFechamento?:     string;
    prazoSla?:           string;
    statusSla?:          string;
    prioridade:          string;
    status:              string;
    classificacao:       string;
    titulo:              string;
    observacoes:         string;
    tecnico:             any;
    cliente:             any,
    nomeCliente:         string;
    nomeTecnico:         string;
}