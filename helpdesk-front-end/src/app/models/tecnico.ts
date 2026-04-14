export interface Tecnico {
    id?:         any;
    nome:     string;
    cpf:      string;
    email:    string;
    senha:    string;
    perfis: number[];
    dataCriacao: any;
    dataHoraCriacao?: string;
    fotoPerfil?: string;
}

export interface IPessoa {
    id?:         any;
    nome:     string;
    cpf:      string;
    email:    string;
    senha:    string;
}


