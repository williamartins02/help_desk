import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { IUsuario } from '../../../models/usuario';
import { Chamado } from '../../../models/chamado';
import { ChamadoService } from '../../../services/chamado.service';
import { ChamadoDetalheDialogComponent } from '../../chamado/chamado-detalhe-dialog/chamado-detalhe-dialog.component';

export interface UsuarioDetalheData {
  usuario: IUsuario;
}

@Component({
  selector: 'app-usuario-detalhe-dialog',
  templateUrl: './usuario-detalhe-dialog.component.html',
  styleUrls: ['./usuario-detalhe-dialog.component.css']
})
export class UsuarioDetalheDialogComponent implements OnInit {

  usuario: IUsuario;
  chamados: Chamado[] = [];
  loadingChamados = true;
  cpfVisible = false;
  activeTab = 0;
  /** null = sem filtro | 0 = Aberto | 1 = Andamento | 2 = Encerrado */
  statusFilter: number | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: UsuarioDetalheData,
    public dialogRef: MatDialogRef<UsuarioDetalheDialogComponent>,
    private chamadoService: ChamadoService,
    private dialog: MatDialog
  ) {
    this.usuario = data.usuario;
  }

  ngOnInit(): void {
    this.carregarChamados();
  }

  carregarChamados(): void {
    this.loadingChamados = true;
    const obs = this.usuario.tipo === 'CLIENTE'
      ? this.chamadoService.findByCliente(this.usuario.id)
      : this.chamadoService.findByTecnico(this.usuario.id);

    obs.subscribe({
      next: (data) => {
        this.chamados = data;
        this.loadingChamados = false;
      },
      error: () => {
        this.loadingChamados = false;
      }
    });
  }

  // ── Contadores ─────────────────────────────────────────────────────────────
  get totalChamados():      number { return this.chamados.length; }
  get chamadosAbertos():    number { return this.chamados.filter(c => Number(c.status) === 0).length; }
  get chamadosAndamento():  number { return this.chamados.filter(c => Number(c.status) === 1).length; }
  get chamadosEncerrados(): number { return this.chamados.filter(c => Number(c.status) === 2).length; }

  // ── Navegação pelas stats do header ───────────────────────────────────────
  /**
   * Clique nos cards de status do header:
   *  - Troca para a aba "Chamados" (índice 1)
   *  - Aplica filtro de status (null = todos)
   */
  abrirChamadosPorStatus(status: number | null): void {
    this.statusFilter = status;
    this.activeTab = 1;
  }

  clearStatusFilter(): void {
    this.statusFilter = null;
  }

  get statusFilterLabel(): string {
    if (this.statusFilter === null) return '';
    return (['Abertos', 'Em Andamento', 'Encerrados'] as any)[this.statusFilter] ?? '';
  }

  get statusFilterColor(): string {
    if (this.statusFilter === null) return '#607d8b';
    return (['#d32f2f', '#f57c00', '#2e7d32'] as any)[this.statusFilter] ?? '#607d8b';
  }

  // ── Grupos para visão do CLIENTE (respeita statusFilter) ─────────────────
  /** Abertos (0) + Em Andamento (1) filtrados */
  get chamadosEmAtendimento(): Chamado[] {
    let base = this.chamados.filter(c => Number(c.status) === 0 || Number(c.status) === 1);
    if (this.statusFilter !== null && this.statusFilter !== 2) {
      base = base.filter(c => Number(c.status) === this.statusFilter);
    } else if (this.statusFilter === 2) {
      return []; // mostrar apenas encerrados: esconder esta seção
    }
    return base.sort((a, b) => Number(b.prioridade) - Number(a.prioridade));
  }

  /** Já encerrados (2), filtrados */
  get chamadosResolvidos(): Chamado[] {
    const base = this.chamados.filter(c => Number(c.status) === 2);
    if (this.statusFilter !== null && this.statusFilter !== 2) {
      return []; // mostrar apenas abertos/andamento: esconder esta seção
    }
    return base;
  }

  /** Lista para visão TÉCNICO, respeitando statusFilter */
  get chamadosTecnicoFiltrados(): Chamado[] {
    if (this.statusFilter === null) return this.chamados;
    return this.chamados.filter(c => Number(c.status) === this.statusFilter);
  }

  /** Iniciais do nome do técnico para o mini-avatar */
  getTecnicoInitials(nome: string): string {
    if (!nome) return '?';
    const p = nome.trim().split(' ');
    return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : nome.substring(0, 2).toUpperCase();
  }

  // ── Timeline de atividade ──────────────────────────────────────────────────
  get activityTimeline(): any[] {
    const events: any[] = [];

    events.push({
      icon: 'person_add',
      color: '#1565c0',
      label: 'Conta criada no sistema',
      date: this.formatDate(this.usuario.dataCriacao),
      sub: `Tipo: ${this.usuario.tipo === 'TECNICO' ? 'Técnico de Suporte' : 'Cliente'}`
    });

    [...this.chamados]
      .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))
      .slice(0, 12)
      .forEach(c => {
        events.push({
          icon: this.getStatusIcon(c.status),
          color: this.getStatusColor(c.status),
          label: `Chamado #${c.id} — ${c.titulo}`,
          date: this.formatDate(String(c.dataAbertura ?? '')),
          sub: `Status: ${this.getStatusLabel(c.status)} • Prioridade: ${this.getPrioridadeLabel(c.prioridade)}`
        });
        if (Number(c.status) === 2 && c.dataFechamento) {
          events.push({
            icon: 'check_circle',
            color: '#2e7d32',
            label: `Chamado #${c.id} encerrado`,
            date: this.formatDate(String(c.dataFechamento ?? '')),
            sub: c.titulo
          });
        }
      });

    return events;
  }

  // ── Helpers de UI ──────────────────────────────────────────────────────────
  getInitials(nome: string): string {
    if (!nome) return '?';
    const p = nome.trim().split(' ');
    return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : nome.substring(0, 2).toUpperCase();
  }

  getAvatarGradient(u: IUsuario): string {
    if (u.perfis?.includes('ROLE_ADMIN')) return 'linear-gradient(135deg,#6a1b9a,#9c27b0)';
    return u.tipo === 'TECNICO'
      ? 'linear-gradient(135deg,#1565c0,#0288d1)'
      : 'linear-gradient(135deg,#00695c,#26a69a)';
  }

  getHeaderGradient(u: IUsuario): string {
    if (u.perfis?.includes('ROLE_ADMIN')) return 'linear-gradient(135deg,#4a0072 0%,#7b1fa2 100%)';
    return u.tipo === 'TECNICO'
      ? 'linear-gradient(135deg,#0d47a1 0%,#0288d1 100%)'
      : 'linear-gradient(135deg,#004d40 0%,#00897b 100%)';
  }

  getPerfilLabel(p: string): string {
    return ({ ROLE_ADMIN: 'Admin', ROLE_TECNICO: 'Técnico', ROLE_CLIENTE: 'Cliente' } as any)[p] || p;
  }

  getPerfilColor(p: string): string {
    return ({ ROLE_ADMIN: '#6a1b9a', ROLE_TECNICO: '#1565c0', ROLE_CLIENTE: '#00695c' } as any)[p] || '#607d8b';
  }

  getPerfilBg(p: string): string {
    const base = ({ ROLE_ADMIN: '#6a1b9a', ROLE_TECNICO: '#1565c0', ROLE_CLIENTE: '#00695c' } as any)[p] || '#607d8b';
    return base + '25';
  }

  maskCpf(cpf: string): string {
    if (!cpf) return '—';
    return cpf.replace(/^(\d{3})\.(\d{3})\.(\d{3})-(\d{2})$/, '***.$2.$3-**');
  }

  formatDate(d: string): string {
    if (!d) return '—';
    if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return d;
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}`;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(d)) {
      const [datePart, timePart] = d.split('T');
      const [y, m, day] = datePart.split('-');
      return `${day}/${m}/${y} ${(timePart || '').substring(0, 5)}`.trim();
    }
    return d;
  }

  // Status
  getStatusLabel(s: any): string {
    return (['Aberto', 'Em Andamento', 'Encerrado'] as any)[Number(s)] ?? String(s);
  }
  getStatusColor(s: any): string {
    return (['#d32f2f', '#f57c00', '#2e7d32'] as any)[Number(s)] ?? '#607d8b';
  }
  getStatusBg(s: any): string {
    return (['#ffebee', '#fff3e0', '#e8f5e9'] as any)[Number(s)] ?? '#f5f5f5';
  }
  getStatusIcon(s: any): string {
    return (['radio_button_unchecked', 'autorenew', 'check_circle'] as any)[Number(s)] ?? 'help';
  }

  // Prioridade
  getPrioridadeLabel(p: any): string {
    return (['Baixa', 'Média', 'Alta', 'Crítica'] as any)[Number(p)] ?? String(p);
  }
  getPrioridadeColor(p: any): string {
    return (['#2e7d32', '#f57c00', '#d32f2f', '#6a1b9a'] as any)[Number(p)] ?? '#607d8b';
  }
  getPrioridadeBg(p: any): string {
    return (['#e8f5e9', '#fff3e0', '#ffebee', '#f3e5f5'] as any)[Number(p)] ?? '#f5f5f5';
  }

  copyToClipboard(text: string): void {
    if (text) navigator.clipboard.writeText(text).catch(() => {});
  }

  openChamadoDetalhe(chamado: Chamado, event: Event): void {
    event.stopPropagation();
    this.dialog.open(ChamadoDetalheDialogComponent, {
      data:      { chamado },
      width:     '780px',
      maxWidth:  '96vw',
      panelClass: 'chamado-detalhe-panel',
      autoFocus: false
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}

