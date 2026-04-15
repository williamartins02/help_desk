import {IMensagem} from '../../../models/mensagem';
import {IConversa} from '../../../models/conversa';
import {Component, OnInit, OnDestroy, AfterViewChecked, ViewChild, ElementRef, ChangeDetectorRef} from '@angular/core';
import {trigger, transition, style, animate} from '@angular/animations';
import {ActivatedRoute} from '@angular/router';
import {UsuarioService} from '../../../services/usuario.service';
import {ChatService, ConexaoStatus} from '../../../services/chat.service';
import {ChatWindowService} from '../../../services/chat-window.service';
import {IUsuario} from '../../../models/usuario';
import {ToastrService} from 'ngx-toastr';
import {Subscription} from 'rxjs';

@Component({
    selector: 'app-chat',
    templateUrl: './chat.component.html',
    styleUrls: ['./chat.component.css'],
    animations: [
        trigger('messageFade', [
            transition(':enter', [
                style({opacity: 0, transform: 'translateY(8px)'}),
                animate('220ms ease-out', style({opacity: 1, transform: 'translateY(0)'}))
            ])
        ]),
        trigger('chatEnter', [
            transition(':enter', [
                style({opacity: 0, transform: 'translateY(16px)'}),
                animate('320ms ease-out', style({opacity: 1, transform: 'translateY(0)'}))
            ])
        ]),
        trigger('loginEnter', [
            transition(':enter', [
                style({opacity: 0, transform: 'scale(0.96)'}),
                animate('280ms ease-out', style({opacity: 1, transform: 'scale(1)'}))
            ])
        ]),
        trigger('typingEnter', [
            transition(':enter', [
                style({opacity: 0, transform: 'translateY(6px)'}),
                animate('180ms ease-out', style({opacity: 1, transform: 'translateY(0)'}))
            ]),
            transition(':leave', [
                animate('140ms ease-in', style({opacity: 0, transform: 'translateY(6px)'}))
            ])
        ]),
        trigger('barEnter', [
            transition(':enter', [
                style({opacity: 0, transform: 'translateY(6px)'}),
                animate('160ms ease-out', style({opacity: 1, transform: 'translateY(0)'}))
            ]),
            transition(':leave', [
                animate('120ms ease-in', style({opacity: 0, transform: 'translateY(6px)'}))
            ])
        ]),
        trigger('panelEnter', [
            transition(':enter', [
                style({opacity: 0, transform: 'scale(0.92)'}),
                animate('180ms ease-out', style({opacity: 1, transform: 'scale(1)'}))
            ]),
            transition(':leave', [
                animate('130ms ease-in', style({opacity: 0, transform: 'scale(0.92)'}))
            ])
        ])
    ]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {

    @ViewChild('messagesArea') private messagesArea: ElementRef;

    // ── estado ────────────────────────────────────────────────────────────────
    connected = false;
    escrevendo = '';
    searchQuery = '';
    showEmojiPicker = false;
    usuariosOnline: string[] = [];
    private shouldScroll = false;
    private typingTimer: any = null;
    private lastTypingEmit = 0;
    private readonly TYPING_THROTTLE_MS = 1500;

    /** Menu de contexto (clique com botão direito ou botão flutuante) */
    ctxMenu: { msg: IMensagem; x: number; y: number } | null = null;

    // ── Resposta (reply) ──────────────────────────────────────────────────────
    msgResposta: IMensagem | null = null;

    // ── Edição de mensagem ────────────────────────────────────────────────────
    msgEditando: IMensagem | null = null;
    private textoOriginalEdicao = '';

    // ── Encaminhar ────────────────────────────────────────────────────────────
    showEncaminhar = false;
    encaminhandoMsg: IMensagem | null = null;
    fwdSearchQuery = '';

    // ── Painel de informações ─────────────────────────────────────────────────
    infoMsg: IMensagem | null = null;

    // ── Estado local de mensagens (sem persistência) ──────────────────────────
    private pinnedMsgs = new Set<string>();
    private favoritedMsgs = new Set<string>();

    // ── TrackBy functions ─────────────────────────────────────────────────
    // Chave estável: NÃO inclui texto — evita que edições destruam/recriem o elemento DOM
    trackByMsg = (_i: number, m: IMensagem): string =>
        m.id || ((m.timestamp ?? '') + m.username);
    trackByConv = (_i: number, c: IConversa): string => c.id;
    trackByEmoji = (_i: number, e: string): string => e;
    trackByUser = (_i: number, u: IUsuario): string => u.id.toString();
    trackByReaction = (_i: number, r: { emoji: string }): string => r.emoji;

    // ── Emoji reactions ────────────────────────────────────────────────────
    readonly QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
    /** Chave da mensagem com o picker aberto (null = fechado) */
    reactionPickerMsg: string | null = null;

    /**
     * Chave de sessionStorage que controla se as notificações de "usuário online"
     * já foram exibidas nesta sessão de login — uma vez por login, não por navegação.
     */
    private readonly SESSKEY_ONLINE_NOTIF = 'hd_chatOnlineNotifMostrado';
    private primeiraEmissaoOnline = true;

    // ── estado de conexão em 3 estados ───────────────────────────────────────
    conexaoStatus: ConexaoStatus = 'offline';
    hasEverConnected = false;

    // ── auto-scroll inteligente ───────────────────────────────────────────────
    isAtBottom = true;
    newMessagesCount = 0;

    // ── conversas ─────────────────────────────────────────────────────────────
    conversaAtiva: IConversa | null = null;

    // ── mensagem em edição ────────────────────────────────────────────────────
    mensagem: IMensagem = {
        texto: '', type: '', username: '', color: '',
        timestamp: '', sala: 'geral', status: 'sent'
    };

    // ── emojis ────────────────────────────────────────────────────────────────
    emojis = [
        '😊', '😂', '❤️', '👍', '🙏', '🎉', '🔥', '💯', '✅', '👋',
        '🤝', '📋', '💬', '📞', '🔔', '⚠️', '✨', '💡', '📌', '😎',
        '🏆', '🚀', '💪', '🔍', '⏰', '📅', '🔧', '🛠️', '📊', '🗑️'
    ];

    private readonly AVATAR_CORES = [
        '#1565c0', '#00838f', '#2e7d32', '#6a1b9a',
        '#c62828', '#f57f17', '#37474f', '#00695c'
    ];

    usuarios: IUsuario[] = [];
    private myUserId = '';
    private openUserIdParam: string | null = null;

    private naoLidasMap = new Map<string, number>();
    private fixadaMap = new Map<string, boolean>();
    private silenciadaMap = new Map<string, boolean>();

    private connectionSub: Subscription;
    private onlineSub: Subscription;
    private mensagemSub: Subscription;
    private escrevendoSub: Subscription;

    private toastsOnlineExibidos = new Set<string>();
    isChatVisivel: boolean = true;

    constructor(
        private usuarioService: UsuarioService,
        private chatService: ChatService,
        private chatWindowService: ChatWindowService,
        private toast: ToastrService,
        private route: ActivatedRoute,
        private cdr: ChangeDetectorRef
    ) {
    }

    ngOnInit(): void {
        // Set username from ChatService (set during login)
        this.mensagem.username = this.chatService.getUsername();

        // Captura query param da bubble (openUser=<id>)
        this.route.queryParams.subscribe(params => {
            if (params['openUser']) this.openUserIdParam = params['openUser'];
        });

        this.usuarioService.findAllForChat().subscribe(users => {
            this.usuarios = users;
            // Discover my own ID to build canonical P2P room IDs
            const me = users.find(u => u.email === this.mensagem.username);
            if (me) {
                this.myUserId = me.id.toString();
                // Pré-carrega histórico de conversas da sessão atual
                users.forEach(u => {
                    if (u.id === me.id) return; // ignora si mesmo
                    const sala = this.getConversaId(u.id.toString());
                    // Não precisa mais de msgMap local
                    this.chatService.getMessageHistory(sala);
                });
            }

            // Auto-abrir conversa indicada pela bubble
            if (this.openUserIdParam) {
                const target = users.find(u => u.id.toString() === this.openUserIdParam);
                if (target) {
                    const convId = this.getConversaId(target.id.toString());
                    // Não precisa mais de msgMap local
                    const conv: IConversa = {
                        id: convId,
                        nome: target.nome,
                        cor: this.getAvatarCor(target.nome),
                        online: this.usuariosOnline.includes(target.email),
                        ultimaMensagem: '',
                        timestamp: new Date().toISOString(),
                        naoLidas: 0,
                        fixada: false,
                        silenciada: false
                    };
                    this.selecionarConversa(conv);
                }
                this.openUserIdParam = null;
            }
        });
        // Subscribe to ChatService connection state (3-state)
        this.connectionSub = this.chatService.getConexaoStatus().subscribe(status => {
            this.conexaoStatus = status;
            this.connected = status === 'conectado';
            if (status === 'conectado') this.hasEverConnected = true;
        });
        // Subscribe to online users
        this.onlineSub = this.chatService.getUsuariosOnline().subscribe(onlineList => {
            const novos = onlineList.filter(u => !this.usuariosOnline.includes(u));

            if (this.primeiraEmissaoOnline) {
                // ── Carga inicial (ou retorno à tela): BehaviorSubject emite o valor atual ──
                // Mostra notificações somente se ainda não foram exibidas nesta sessão de login.
                if (novos.length > 0 && !sessionStorage.getItem(this.SESSKEY_ONLINE_NOTIF)) {
                    novos.forEach(u => {
                        this.toast.info(`${u} está online!`, 'Usuário ativo', {timeOut: 3000});
                        this.toastsOnlineExibidos.add(u);
                    });
                    sessionStorage.setItem(this.SESSKEY_ONLINE_NOTIF, '1');
                } else {
                    // Sessão já notificada → preenche o set silenciosamente para não duplicar
                    novos.forEach(u => this.toastsOnlineExibidos.add(u));
                }
                this.primeiraEmissaoOnline = false;
            } else {
                // ── Emissões subsequentes: mudanças em tempo real ──
                // Sempre notifica quando alguém entra online, independente da sessão.
                novos.forEach(u => {
                    if (!this.toastsOnlineExibidos.has(u)) {
                        this.toast.info(`${u} está online!`, 'Usuário ativo', {timeOut: 3000});
                        this.toastsOnlineExibidos.add(u);
                    }
                });
            }

            this.usuariosOnline = onlineList;
        });

        // Subscribe to individual incoming messages
        this.mensagemSub = this.chatService.getMensagem().subscribe(msg => {
            this._receberMensagem(msg);
        });

        // Subscribe to typing indicator — filtrado por sala ativa
        this.escrevendoSub = this.chatService.getEscrevendo().subscribe(payload => {
            // Ignora próprias digitações e eventos de outras salas
            if (payload.username === this.mensagem.username) return;
            if (payload.sala !== this.conversaAtiva?.id) return;

            this.escrevendo = 'digitando...';
            if (this.typingTimer) clearTimeout(this.typingTimer);
            this.typingTimer = setTimeout(() => {
                this.escrevendo = '';
            }, 3000);
        });
        this._initConversas();  // inicializa msgMap vazio, sem definir conversaAtiva
    }

    ngAfterViewChecked(): void {
        if (this.shouldScroll) {
            this._scrollToBottom();
            this.shouldScroll = false;
        }
    }

    ngOnDestroy(): void {
        if (this.connectionSub) this.connectionSub.unsubscribe();
        if (this.onlineSub) this.onlineSub.unsubscribe();
        if (this.mensagemSub) this.mensagemSub.unsubscribe();
        if (this.escrevendoSub) this.escrevendoSub.unsubscribe();
        if (this.typingTimer) clearTimeout(this.typingTimer);
        // Limpa conversa ativa para que o bubble volte a contar corretamente
        this.chatWindowService.setActiveChatEmail(null);
    }

    // ── conversas ─────────────────────────────────────────────────────────────
    private _initConversas(): void {
        // Inicializa apenas o estado, sem msgMap
        this.conversaAtiva = null;
    }

    // ── Recebimento ──────────────────────────────────────────────────────────
    private _receberMensagem(msg: IMensagem): void {
        // Mensagens de ação (REACTION, DELETE_MSG, EDIT_MSG) já foram tratadas
        // pelo ChatService (mutação in-place). Força CD para garantir atualização imediata.
        if (msg.type === 'REACTION' || msg.type === 'DELETE_MSG' || msg.type === 'EDIT_MSG') {
            this.cdr.detectChanges();
            return;
        }

        const sala = msg.sala || 'geral';
        // Não armazena mais localmente, pois o ChatService já faz isso
        if (msg.type === 'MENSAGEM') {
            msg.status = this.mensagem.username === msg.username ? 'read' : 'delivered';
            // Notificação quando a mensagem é de outro usuário e não está na conversa ativa
            const conversaEstaAtiva = this.conversaAtiva?.id === sala && this.isChatVisivel;
            if (msg.username !== this.mensagem.username && !conversaEstaAtiva) {
                // Só notifica se a mensagem for endereçada a este usuário (DM) ou for de canal (sem destinatário)
                const isParaMim = !msg.destinatario || msg.destinatario === this.mensagem.username;
                if (isParaMim) {
                    const sender = this.usuarios.find(u => u.email === msg.username);
                    const nome = sender?.nome || msg.username;
                    this.toast.info(`Nova mensagem de <b>${nome}</b>`, '💬 Chat',
                        {timeOut: 4000, enableHtml: true});
                    // Incrementa contador persistente apenas se não silenciada
                    if (!this.silenciadaMap.get(sala)) {
                        this.naoLidasMap.set(sala, (this.naoLidasMap.get(sala) ?? 0) + 1);
                    }
                }
            }
        }
        // Não precisa mais de msgMap local
        if (this.conversaAtiva?.id === sala) {
            if (this.isAtBottom) {
                this.shouldScroll = true;
            } else if (msg.type === 'MENSAGEM') {
                this.newMessagesCount++;
            }
        }
    }

    get mensagensAtivas(): IMensagem[] {
        if (!this.conversaAtiva) return [];
        // Busca sempre do ChatService para garantir sincronização
        return this.chatService.getMessageHistory(this.conversaAtiva.id) || [];
    }

    // ── Envio ─────────────────────────────────────────────────────────────────
    enviarMensagem(): void {
        // Se estiver editando, salva a edição
        if (this.msgEditando) {
            this.salvarEdicao();
            return;
        }

        if (!this.mensagem.texto?.trim() || !this.connected) return;
        const msg: IMensagem = {
            ...this.mensagem,
            type: 'MENSAGEM',
            sala: this.conversaAtiva?.id || 'geral',
            timestamp: new Date().toISOString(),
            status: 'sent',
            destinatario: this.conversaAtiva?.email,
            replyTo: this.msgResposta ? {
                id: this.msgResposta.id,
                username: this.msgResposta.username,
                texto: this.getTexto(this.msgResposta)
            } : undefined
        };
        this.chatService.publishMensagem(msg);
        this.mensagem.texto = '';
        this.showEmojiPicker = false;
        this.msgResposta = null;
        this.escrevendo = '';
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
            this.typingTimer = null;
        }
    }

    onKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.enviarMensagem();
        }
        if (e.key === 'Escape') {
            if (this.reactionPickerMsg) {
                this.closeReactionPicker();
                return;
            }
            if (this.msgEditando) {
                this.cancelarEdicao();
                return;
            }
            if (this.msgResposta) {
                this.cancelarResposta();
                return;
            }
            if (this.showEncaminhar) {
                this.cancelarEncaminhar();
                return;
            }
            if (this.infoMsg) {
                this.fecharInfo();
                return;
            }
        }
    }

    escreverEvento(): void {
        if (!this.connected || !this.conversaAtiva) return;
        const now = Date.now();
        if (now - this.lastTypingEmit < this.TYPING_THROTTLE_MS) return;
        this.lastTypingEmit = now;
        this.chatService.publishEscrevendo(this.mensagem.username, this.conversaAtiva.id);
    }

    // ── Conversas ─────────────────────────────────────────────────────────────
    selecionarConversa(conv: IConversa): void {
        this.conversaAtiva = conv;
        this.naoLidasMap.set(conv.id, 0);
        this.shouldScroll = true;
        this.showEmojiPicker = false;
        this.escrevendo = '';
        // Zera não-lidas no serviço centralizado → sincroniza badge do bubble e janelas flutuantes
        if (conv.email) {
            this.chatWindowService.setActiveChatEmail(conv.email);
        }
        // Fecha painéis ao trocar de conversa
        this.fecharCtxMenu();
        this.fecharInfo();
        this.cancelarResposta();
        this.cancelarEdicao();
        this.cancelarEncaminhar();
        this.closeReactionPicker();
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
            this.typingTimer = null;
        }
        // Marca todas as mensagens da conversa como lidas
        const msgs = this.chatService.getMessageHistory(conv.id) || [];
        msgs.filter(m => m.status !== 'read' && m.username !== this.mensagem.username && m.id)
            .forEach(m => this.chatService.marcarComoLida(m));
    }

    /** Mapeia um IUsuario → IConversa (reutilizável) */
    private _mapUserToConversa(u: IUsuario): IConversa {
        const convId = this.getConversaId(u.id.toString());
        // Não precisa mais de msgMap local
        return {
            id: convId,
            nome: u.nome,
            email: u.email,
            cor: this.getAvatarCor(u.nome),
            online: this.usuariosOnline.includes(u.email),
            ultimaMensagem: (this.chatService.getMessageHistory(convId)?.slice(-1)[0]?.texto) || '',
            timestamp: (this.chatService.getMessageHistory(convId)?.slice(-1)[0]?.timestamp) || '',
            naoLidas: this.naoLidasMap.get(convId) ?? 0,
            fixada: this.fixadaMap.get(convId) ?? false,
            silenciada: this.silenciadaMap.get(convId) ?? false,
            lastSeen: this.chatService.getLastSeen(u.email) || undefined,
            fotoPerfil: u.fotoPerfil
        };
    }

    /**
     * Ordena: online primeiro (por nome), depois offline (ordem original de cadastro)
     */
    private _sortOnlineTopOfflineOriginal(users: IUsuario[]): IUsuario[] {
        const online = users.filter(u => this.usuariosOnline.includes(u.email));
        const offline = users.filter(u => !this.usuariosOnline.includes(u.email));
        // Online ordenados por nome
        online.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        // Offline mantém ordem original (já está em 'users')
        return [...online, ...offline];
    }

    /** Técnicos (filtrados pela busca, online topo, offline ordem original) */
    get tecnicosFiltrados(): IConversa[] {
        const q = this.searchQuery.toLowerCase();
        const filtered = this.usuarios
            .filter(u => u.tipo === 'TECNICO')
            .filter(u => u.email !== this.mensagem.username)
            .filter(u => !q || u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
        return this._sortOnlineTopOfflineOriginal(filtered).map(u => this._mapUserToConversa(u));
    }

    /** Clientes (filtrados pela busca, online topo, offline ordem original) */
    get clientesFiltrados(): IConversa[] {
        const q = this.searchQuery.toLowerCase();
        const filtered = this.usuarios
            .filter(u => u.tipo === 'CLIENTE')
            .filter(u => u.email !== this.mensagem.username)
            .filter(u => !q || u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
        return this._sortOnlineTopOfflineOriginal(filtered).map(u => this._mapUserToConversa(u));
    }

    /** Gera um ID de sala canônico e bidirecional entre dois usuários. */
    private getConversaId(otherId: string): string {
        if (!this.myUserId || !otherId) return otherId || 'geral';
        const a = parseInt(this.myUserId, 10);
        const b = parseInt(otherId, 10);
        return `dm_${Math.min(a, b)}_${Math.max(a, b)}`;
    }


    fixarConversa(conv: IConversa, e: Event): void {
        e.stopPropagation();
        this.fixadaMap.set(conv.id, !(this.fixadaMap.get(conv.id) ?? false));
    }

    silenciarConversa(conv: IConversa, e: Event): void {
        e.stopPropagation();
        this.silenciadaMap.set(conv.id, !(this.silenciadaMap.get(conv.id) ?? false));
    }

    // ── Estado local das mensagens ────────────────────────────────────────────

    /** Chave estável para identificar a mensagem localmente — NÃO inclui texto
     *  para que EDIT_MSG enviado ao destinatário aponte para a mensagem original,
     *  mesmo quando a mutação optimista já alterou o texto local. */
    getMsgKey(msg: IMensagem): string {
        return msg.id || ((msg.timestamp ?? '') + msg.username);
    }

    isApagada(msg: IMensagem): boolean {
        return msg.apagada === true;
    }

    isEditada(msg: IMensagem): boolean {
        return msg.editada === true;
    }

    isFixada(msg: IMensagem): boolean {
        return this.pinnedMsgs.has(this.getMsgKey(msg));
    }

    isFavorita(msg: IMensagem): boolean {
        return this.favoritedMsgs.has(this.getMsgKey(msg));
    }

    /** Retorna o texto atual (já é o texto atualizado no objeto) */
    getTexto(msg: IMensagem): string {
        return msg.texto ?? '';
    }

    // ── Reactions ─────────────────────────────────────────────────────────

    toggleReactionPicker(e: MouseEvent, msg: IMensagem): void {
        e.stopPropagation();
        const key = this.getMsgKey(msg);
        this.reactionPickerMsg = this.reactionPickerMsg === key ? null : key;
        this.ctxMenu = null;
    }

    closeReactionPicker(): void {
        this.reactionPickerMsg = null;
    }

    isReactionPickerOpen(msg: IMensagem): boolean {
        return this.reactionPickerMsg === this.getMsgKey(msg);
    }

    addReaction(msg: IMensagem, emoji: string): void {
        const me = this.mensagem.username;
        // Verifica se é toggle (já tinha a mesma reação)
        const jaReagiu = msg.reactions?.some(r => r.username === me && r.emoji === emoji) ?? false;
        // Atualização optimista local (o objeto é a mesma referência do msgStoreMap)
        if (!msg.reactions) msg.reactions = [];
        msg.reactions = msg.reactions.filter(r => r.username !== me); // remove anterior
        if (!jaReagiu) msg.reactions.push({emoji, username: me});   // adiciona se não era toggle-off
        this.cdr.detectChanges();
        this.reactionPickerMsg = null;

        // Publica via WebSocket para o outro usuário
        if (this.connected && this.conversaAtiva) {
            const reactionMsg: IMensagem = {
                texto: '', type: 'REACTION',
                username: me, color: this.mensagem.color,
                timestamp: new Date().toISOString(),
                sala: this.conversaAtiva.id, status: 'sent',
                destinatario: this.conversaAtiva.email,
                msgId: this.getMsgKey(msg),
                emoji: jaReagiu ? '' : emoji   // vazio = remover reação
            };
            this.chatService.publishMensagem(reactionMsg);
        }
    }

    hasMyReaction(msg: IMensagem, emoji: string): boolean {
        return msg.reactions?.some(r => r.username === this.mensagem.username && r.emoji === emoji) ?? false;
    }

    getReactions(msg: IMensagem): { emoji: string; count: number; mine: boolean }[] {
        if (!msg.reactions || msg.reactions.length === 0) return [];
        const me = this.mensagem.username;
        const emojiMap = new Map<string, { count: number; mine: boolean }>();
        msg.reactions.forEach(r => {
            const ex = emojiMap.get(r.emoji) || {count: 0, mine: false};
            emojiMap.set(r.emoji, {count: ex.count + 1, mine: ex.mine || r.username === me});
        });
        return Array.from(emojiMap.entries()).map(([emoji, v]) => ({emoji, ...v}));
    }

    hasReactions(msg: IMensagem): boolean {
        return (msg.reactions?.length ?? 0) > 0;
    }

    // ── Context menu ──────────────────────────────────────────────────────
    onMsgContextMenu(e: MouseEvent, msg: IMensagem): void {
        e.preventDefault();
        if (msg.type !== 'MENSAGEM') return;
        this.reactionPickerMsg = null;
        const MENU_W = 215;
        const MENU_H = 400;
        const x = Math.min(e.clientX + 4, window.innerWidth - MENU_W - 8);
        const y = Math.min(e.clientY + 4, window.innerHeight - MENU_H - 8);
        this.ctxMenu = {msg, x, y};
    }

    onBubbleMenuClick(e: MouseEvent, msg: IMensagem): void {
        e.preventDefault();
        e.stopPropagation();
        if (this.ctxMenu?.msg === msg) {
            this.fecharCtxMenu();
            return;
        }
        this.onMsgContextMenu(e, msg);
    }

    fecharCtxMenu(): void {
        this.ctxMenu = null;
    }

    // ── Ações do menu ─────────────────────────────────────────────────────────

    /** Copia o texto da mensagem para a área de transferência */
    async copiarMensagem(): Promise<void> {
        if (!this.ctxMenu) return;
        const texto = this.getTexto(this.ctxMenu.msg);
        this.fecharCtxMenu();
        try {
            await navigator.clipboard.writeText(texto);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = texto;
            ta.style.cssText = 'position:fixed;opacity:0;top:-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        this.toast.success('Mensagem copiada!', '', {timeOut: 1500});
    }

    /** Configura a mensagem para resposta */
    responder(): void {
        if (!this.ctxMenu) return;
        this.msgResposta = this.ctxMenu.msg;
        this.msgEditando = null;
        this.fecharCtxMenu();
        setTimeout(() => (document.querySelector('.msg-input') as HTMLElement)?.focus(), 80);
    }

    cancelarResposta(): void {
        this.msgResposta = null;
    }

    /** Entra no modo de edição */
    entrarModoEdicao(): void {
        if (!this.ctxMenu) return;
        const msg = this.ctxMenu.msg;
        this.msgEditando = msg;
        this.textoOriginalEdicao = this.getTexto(msg);
        this.mensagem.texto = this.getTexto(msg);
        this.msgResposta = null;
        this.fecharCtxMenu();
        setTimeout(() => (document.querySelector('.msg-input') as HTMLElement)?.focus(), 80);
    }

    cancelarEdicao(): void {
        this.msgEditando = null;
        this.mensagem.texto = '';
        this.textoOriginalEdicao = '';
    }

    salvarEdicao(): void {
        if (!this.msgEditando) return;
        const novoTexto = this.mensagem.texto?.trim();
        if (!novoTexto) {
            this.cancelarEdicao();
            return;
        }
        const msgAlvo = this.msgEditando;
        // ── Calcula a chave ANTES da mutação optimista para que o destinatário
        //    consiga identificar a mensagem original pelo mesmo msgId.
        const msgKey = this.getMsgKey(msgAlvo);
        // Atualização optimista: muta o objeto (mesma referência do msgStoreMap)
        msgAlvo.texto = novoTexto;
        msgAlvo.editada = true;
        this.cdr.detectChanges();
        // Publica para o outro usuário via WebSocket
        if (this.connected && this.conversaAtiva) {
            const editMsg: IMensagem = {
                texto: '', type: 'EDIT_MSG',
                username: this.mensagem.username, color: this.mensagem.color,
                timestamp: new Date().toISOString(),
                sala: this.conversaAtiva.id, status: 'sent',
                destinatario: this.conversaAtiva.email,
                msgId: msgKey,
                novoTexto
            };
            this.chatService.publishMensagem(editMsg);
        }
        this.msgEditando = null;
        this.mensagem.texto = '';
        this.textoOriginalEdicao = '';
        this.toast.success('Mensagem editada!', '', {timeOut: 1500});
    }

    /** Marca a mensagem como apagada e notifica o outro usuário via WebSocket */
    apagarMensagem(): void {
        if (!this.ctxMenu) return;
        const msg = this.ctxMenu.msg;
        // Atualização optimista: muta o objeto (mesma referência do msgStoreMap)
        msg.apagada = true;
        this.cdr.detectChanges();
        this.fecharCtxMenu();
        this.toast.info('Mensagem apagada.', '', {timeOut: 2000});
        // Publica para o outro usuário via WebSocket
        if (this.connected && this.conversaAtiva) {
            const deleteMsg: IMensagem = {
                texto: '', type: 'DELETE_MSG',
                username: this.mensagem.username, color: this.mensagem.color,
                timestamp: new Date().toISOString(),
                sala: this.conversaAtiva.id, status: 'sent',
                destinatario: this.conversaAtiva.email,
                msgId: this.getMsgKey(msg)
            };
            this.chatService.publishMensagem(deleteMsg);
        }
    }

    /** Alterna o estado de fixado */
    toggleFixarMensagem(): void {
        if (!this.ctxMenu) return;
        const key = this.getMsgKey(this.ctxMenu.msg);
        if (this.pinnedMsgs.has(key)) {
            this.pinnedMsgs.delete(key);
            this.toast.info('Mensagem desafixada.', '', {timeOut: 1500});
        } else {
            this.pinnedMsgs.add(key);
            this.toast.info('Mensagem fixada!', '', {timeOut: 1500});
        }
        this.fecharCtxMenu();
    }

    /** Alterna o estado de favorito */
    toggleFavoritarMensagem(): void {
        if (!this.ctxMenu) return;
        const key = this.getMsgKey(this.ctxMenu.msg);
        if (this.favoritedMsgs.has(key)) {
            this.favoritedMsgs.delete(key);
            this.toast.info('Removida dos favoritos.', '', {timeOut: 1500});
        } else {
            this.favoritedMsgs.add(key);
            this.toast.success('Adicionada aos favoritos!', '', {timeOut: 1500});
        }
        this.fecharCtxMenu();
    }

    /** Abre o painel de encaminhamento */
    encaminhar(): void {
        if (!this.ctxMenu) return;
        this.encaminhandoMsg = this.ctxMenu.msg;
        this.showEncaminhar = true;
        this.fwdSearchQuery = '';
        this.fecharCtxMenu();
    }

    cancelarEncaminhar(): void {
        this.showEncaminhar = false;
        this.encaminhandoMsg = null;
        this.fwdSearchQuery = '';
    }

    /** Envia a mensagem encaminhada para o usuário selecionado */
    encaminharPara(user: IUsuario): void {
        if (!this.encaminhandoMsg || !this.connected) return;
        const b = parseInt(user.id.toString(), 10);
        const a = parseInt(this.myUserId, 10);
        const sala = `dm_${Math.min(a, b)}_${Math.max(a, b)}`;
        const msg: IMensagem = {
            texto: this.getTexto(this.encaminhandoMsg),
            type: 'MENSAGEM',
            username: this.mensagem.username,
            color: this.mensagem.color,
            timestamp: new Date().toISOString(),
            status: 'sent',
            sala,
            destinatario: user.email
        };
        this.chatService.publishMensagem(msg);
        this.toast.success(`Mensagem encaminhada para ${user.nome}!`, '', {timeOut: 2000});
        this.cancelarEncaminhar();
    }

    /** Lista de usuários para encaminhar (exclui si mesmo) */
    get usuariosFiltradosFwd(): IUsuario[] {
        const q = this.fwdSearchQuery.toLowerCase();
        return this.usuarios
            .filter(u => u.email !== this.mensagem.username)
            .filter(u => !q || u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }

    /** Abre painel de informações da mensagem */
    mostrarInfoMsg(): void {
        if (!this.ctxMenu) return;
        this.infoMsg = this.ctxMenu.msg;
        this.fecharCtxMenu();
    }

    fecharInfo(): void {
        this.infoMsg = null;
    }

    // ── Helpers de status ─────────────────────────────────────────────────────
    getStatusIcon(status: string | undefined): string {
        switch (status) {
            case 'sent':
                return 'done';
            case 'delivered':
                return 'done_all';
            case 'read':
                return 'done_all';
            default:
                return 'schedule';
        }
    }

    getStatusLabel(status: string | undefined): string {
        switch (status) {
            case 'sent':
                return 'Enviada ✓';
            case 'delivered':
                return 'Entregue ✓✓';
            case 'read':
                return 'Lida ✓✓';
            default:
                return 'Pendente...';
        }
    }

    formatFullDate(iso: string | undefined): string {
        if (!iso) return 'Desconhecido';
        return new Date(iso).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    }

    // ── UI helpers ────────────────────────────────────────────────────────────
    isMeu(msg: IMensagem): boolean {
        return msg.username === this.mensagem.username;
    }

    getNomeByEmail(email: string): string {
        if (!email) return '';
        const u = this.usuarios.find(u => u.email === email);
        return u?.nome || email;
    }

    get meuNome(): string {
        return this.getNomeByEmail(this.mensagem.username);
    }

    get minhaFoto(): string | undefined {
        return this.usuarios.find(u => u.email === this.mensagem.username)?.fotoPerfil;
    }

    getFotoByEmail(email: string): string | undefined {
        return this.usuarios.find(u => u.email === email)?.fotoPerfil;
    }

    getInitials(nome: string): string {
        if (!nome) return '?';
        const p = nome.trim().split(' ');
        return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : nome.substring(0, 2).toUpperCase();
    }

    getAvatarCor(nome: string): string {
        if (!nome) return this.AVATAR_CORES[0];
        let h = 0;
        for (let i = 0; i < nome.length; i++) h += nome.charCodeAt(i);
        return this.AVATAR_CORES[h % this.AVATAR_CORES.length];
    }

    formatTime(iso: string): string {
        if (!iso) return '';
        return new Date(iso).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
    }

    formatLastSeen(iso: string | undefined): string {
        if (!iso) return '';
        const d = new Date(iso);
        const hoje = new Date();
        const ontem = new Date(hoje);
        ontem.setDate(ontem.getDate() - 1);
        const time = d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
        if (d.toDateString() === hoje.toDateString()) return `hoje às ${time}`;
        if (d.toDateString() === ontem.toDateString()) return `ontem às ${time}`;
        return `${d.toLocaleDateString('pt-BR')} às ${time}`;
    }

    formatDateLabel(iso: string): string {
        if (!iso) return '';
        const d = new Date(iso);
        const hoje = new Date();
        const ontem = new Date(hoje);
        ontem.setDate(ontem.getDate() - 1);
        if (d.toDateString() === hoje.toDateString()) return 'Hoje';
        if (d.toDateString() === ontem.toDateString()) return 'Ontem';
        return d.toLocaleDateString('pt-BR');
    }

    showDateSep(msgs: IMensagem[], i: number): boolean {
        if (i === 0) return true;
        return new Date(msgs[i].timestamp || '').toDateString() !==
            new Date(msgs[i - 1].timestamp || '').toDateString();
    }

    inserirEmoji(emoji: string): void {
        this.mensagem.texto = (this.mensagem.texto || '') + emoji;
    }

    toggleEmoji(): void {
        this.showEmojiPicker = !this.showEmojiPicker;
    }

    fecharEmoji(): void {
        if (this.showEmojiPicker) this.showEmojiPicker = false;
    }


    private _scrollToBottom(): void {
        try {
            const el = this.messagesArea?.nativeElement;
            if (el) el.scrollTop = el.scrollHeight;
        } catch {
        }
    }

    /** Chamado pelo evento (scroll) do container de mensagens */
    onMessagesScroll(): void {
        const el = this.messagesArea?.nativeElement;
        if (!el) return;
        const THRESHOLD = 80; // px de tolerância
        this.isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < THRESHOLD;
        if (this.isAtBottom) {
            this.newMessagesCount = 0;
        }
    }

    /** Clique no botão flutuante "Novas mensagens ↓" */
    scrollToLatest(): void {
        const el = this.messagesArea?.nativeElement;
        if (el) {
            el.scrollTo({top: el.scrollHeight, behavior: 'smooth'});
            this.newMessagesCount = 0;
            this.isAtBottom = true;
        }
    }
}
