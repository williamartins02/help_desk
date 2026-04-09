export interface IConversa {
  id:             string;
  nome:           string;
  email?:         string;   // e-mail do usuário destino (para mensagens DM)
  cor:            string;
  online:         boolean;
  ultimaMensagem: string;
  timestamp:      string;
  naoLidas:       number;
  fixada:         boolean;
  silenciada:     boolean;
  lastSeen?:      string;   // ISO timestamp: último horário online
}

