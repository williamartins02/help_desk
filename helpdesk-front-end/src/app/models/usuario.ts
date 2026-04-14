export interface IUsuario {
  id:           number;
  nome:         string;
  cpf:          string;
  email:        string;
  perfis:       string[];   // ex: ['ROLE_ADMIN', 'ROLE_TECNICO']
  dataCriacao:  string;
  tipo:         'TECNICO' | 'CLIENTE';
  fotoPerfil?:  string;     // Base64 data URL — somente técnicos
}

