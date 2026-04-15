export interface IMensagem {
  texto:         string;
  username:      string;
  type:          string;
  color:         string;
  timestamp?:    string;
  status?:       'sent' | 'delivered' | 'read';
  sala?:         string;
  /** E-mail do destinatário para mensagens diretas (DM). Null em mensagens de canal. */
  destinatario?: string;
  id?:           string;
  /** Mensagem citada quando esta é uma resposta */
  replyTo?:      { id?: string; username: string; texto: string };

  // ── Campos para mensagens de ação (REACTION / DELETE_MSG / EDIT_MSG) ──
  /** Chave da mensagem alvo da ação */
  msgId?:        string;
  /** Emoji escolhido para REACTION (vazio = remover reação) */
  emoji?:        string;
  /** Novo texto para EDIT_MSG */
  novoTexto?:    string;

  // ── Estado persistido no objeto da mensagem (shared via msgStoreMap) ──
  /** Mensagem apagada (aplica-se a todos os usuários) */
  apagada?:      boolean;
  /** Mensagem foi editada */
  editada?:      boolean;
  /** Lista de reações: { emoji, username } */
  reactions?:    { emoji: string; username: string }[];
}
