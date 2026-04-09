export interface IMensagem {
  texto:        string;
  username:     string;
  type:         string;
  color:        string;
  timestamp?:   string;
  status?:      'sent' | 'delivered' | 'read';
  sala?:        string;
  /** E-mail do destinatário para mensagens diretas (DM). Null em mensagens de canal. */
  destinatario?: string;
  id?: string;
}
