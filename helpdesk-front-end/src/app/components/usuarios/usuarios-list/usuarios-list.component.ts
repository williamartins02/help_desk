import { IUsuario } from '../../../models/usuario';
import { UsuarioService } from '../../../services/usuario.service';
import { ToastrService } from 'ngx-toastr';
import {
  Component, OnInit, AfterViewInit, ViewChild
} from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { UsuarioDetalheDialogComponent } from '../usuario-detalhe-dialog/usuario-detalhe-dialog.component';
import { AuthenticationService } from '../../../services/authentication.service';

@Component({
  selector: 'app-usuarios-list',
  templateUrl: './usuarios-list.component.html',
  styleUrls: ['./usuarios-list.component.css']
})
export class UsuariosListComponent implements OnInit, AfterViewInit {

  USUARIO_DATA: IUsuario[] = [];
  isLoading    = true;
  searchValue  = '';
  selectedTipo = '';

  displayedColumns = ['avatar', 'nome', 'email', 'cpf', 'perfis', 'tipo', 'dataCriacao', 'acoes'];
  dataSource = new MatTableDataSource<IUsuario>([]);

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort)      sort:      MatSort;

  currentUserEmail: string = '';
  currentUserIsAdmin: boolean = false;

  constructor(
    private service: UsuarioService,
    private toast:   ToastrService,
    private dialog:  MatDialog,
    private auth:    AuthenticationService
  ) {}

  ngOnInit(): void {
    this.setupFilterPredicate();
    this.setCurrentUserInfo();
  }

  ngAfterViewInit(): void {
    // Paginator/sort may be null here if inside *ngIf="!isLoading".
    // They are connected after data loads via setTimeout in findAll().
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort      = this.sort;
  }

  setCurrentUserInfo(): void {
    // Recupera permissões e e-mail do usuário logado
    const permissions = JSON.parse(localStorage.getItem('permissions') || '[]');
    this.currentUserIsAdmin = permissions.includes('ROLE_ADMIN');
    // O e-mail pode estar no token ou em outro local, aqui tentamos obter do token JWT
    const token = localStorage.getItem('token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.currentUserEmail = payload.sub || '';
    }
    this.findAll();
  }

  // ── Dados ─────────────────────────────────────────────────────────────────
  findAll(): void {
    this.isLoading = true;
    this.service.findAll().subscribe(
      data => {
        // Aplica regra de negócio: ADMIN vê todos, TÉCNICO vê só a si mesmo
        if (this.currentUserIsAdmin) {
          this.USUARIO_DATA = data;
        } else {
          this.USUARIO_DATA = data.filter(u => u.email === this.currentUserEmail);
        }
        this.applyFilters();
        this.isLoading = false;
        // Paginator and sort live inside *ngIf="!isLoading".
        // After setting isLoading=false Angular renders them; we connect them
        // in the next macrotask so the DOM is already updated.
        setTimeout(() => {
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort      = this.sort;
        });
      },
      () => {
        this.toast.error('Erro ao carregar usuários', 'ERROR');
        this.isLoading = false;
      }
    );
  }

  // ── FilterPredicate ───────────────────────────────────────────────────────
  /**
   * Configures the custom filterPredicate on the shared dataSource instance.
   * Called once during initialisation so it is never lost across filter cycles.
   *
   * Fixes applied:
   *  1. Null-safety – nome/email can be null in the database.
   *  2. Accent normalisation – "joao" now matches "João".
   *  3. CPF guard – the digit-only comparison is skipped when the search term
   *     contains no digits, preventing the empty-string-includes-any-string
   *     bug that made ALL rows match every non-numeric search term.
   */
  private setupFilterPredicate(): void {
    this.dataSource.filterPredicate = (data: IUsuario, f: string) => {
      // Normalise: lowercase + strip diacritics (accents)
      const normalize = (s: string): string =>
        (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const term       = normalize(f);
      const cpfDigits  = (data.cpf ?? '').replace(/\D/g, '');
      const termDigits = f.replace(/\D/g, '');

      return normalize(data.nome).includes(term)                       // by name
          || normalize(data.email).includes(term)                      // by e-mail
          || (termDigits.length > 0 && cpfDigits.includes(termDigits)); // by CPF (digits only)
    };
  }

  // ── Filtros ───────────────────────────────────────────────────────────────
  applyFilters(): void {
    // 1. Apply tipo filter in memory.
    let filtered = [...this.USUARIO_DATA];
    if (this.selectedTipo) {
      filtered = filtered.filter(u => u.tipo === this.selectedTipo);
    }

    // 2. Update the shared dataSource data (avoids losing paginator/sort references).
    this.dataSource.data = filtered;

    // 3. Apply text filter via filterPredicate (set once in setupFilterPredicate).
    this.dataSource.filter = this.searchValue.trim().toLowerCase();
  }

  applySearch(event: Event): void {
    this.searchValue = (event.target as HTMLInputElement).value;
    this.applyFilters();
  }

  onTipoChange(tipo: string): void {
    this.selectedTipo = tipo;
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchValue  = '';
    this.selectedTipo = '';
    this.applyFilters();
  }

  // ── Modal de detalhes ─────────────────────────────────────────────────────
  openDetalhes(usuario: IUsuario, event?: Event): void {
    event?.stopPropagation();
    this.dialog.open(UsuarioDetalheDialogComponent, {
      data:      { usuario },
      width:     '700px',
      maxWidth:  '96vw',
      maxHeight: '90vh',
      panelClass: 'usuario-detalhe-panel',
      autoFocus: false
    });
  }

  // ── Contadores ────────────────────────────────────────────────────────────
  get totalAdmin():   number { return this.USUARIO_DATA.filter(u => u.perfis?.includes('ROLE_ADMIN')).length; }
  get totalTecnico(): number { return this.USUARIO_DATA.filter(u => u.tipo === 'TECNICO').length; }
  get totalCliente(): number { return this.USUARIO_DATA.filter(u => u.tipo === 'CLIENTE').length; }
  get hasFilters():   boolean { return this.selectedTipo !== '' || this.searchValue.trim() !== ''; }

  /** Usuários cadastrados no mês/ano corrente */
  get cadastrosNoMes(): number {
    const now = new Date();
    return this.USUARIO_DATA.filter(u => {
      if (!u.dataCriacao) return false;
      const d = new Date(u.dataCriacao);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  getInitials(nome: string): string {
    if (!nome) return '?';
    const p = nome.trim().split(' ');
    return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : nome.substring(0, 2).toUpperCase();
  }

  getAvatarColor(u: IUsuario): string {
    if (u.perfis?.includes('ROLE_ADMIN')) return '#6a1b9a';
    return u.tipo === 'TECNICO' ? '#1565c0' : '#00695c';
  }

  getTipoLabel(tipo: string):  string { return tipo === 'TECNICO' ? 'Técnico' : 'Cliente'; }
  getTipoBg(tipo: string):     string { return tipo === 'TECNICO' ? '#1565c010' : '#00695c10'; }
  getTipoColor(tipo: string):  string { return tipo === 'TECNICO' ? '#1565c0'   : '#00695c'; }

  getPerfilLabel(p: string): string {
    return { ROLE_ADMIN: 'Admin', ROLE_TECNICO: 'Técnico', ROLE_CLIENTE: 'Cliente' }[p] || p;
  }

  getPerfilBg(p: string):    string {
    return ({ ROLE_ADMIN: '#6a1b9a', ROLE_TECNICO: '#1565c0', ROLE_CLIENTE: '#00695c' }[p] || '#607d8b') + '15';
  }

  getPerfilColor(p: string): string {
    return { ROLE_ADMIN: '#6a1b9a', ROLE_TECNICO: '#1565c0', ROLE_CLIENTE: '#00695c' }[p] || '#607d8b';
  }

  maskCpf(cpf: string): string {
    if (!cpf) return '—';
    return cpf.replace(/^(\d{3})\.(\d{3})\.(\d{3})-(\d{2})$/, '***.$2.$3-**');
  }

  formatDate(d: string): string {
    if (!d) return '—';
    // Se já estiver no formato dd/MM/yyyy, retorna direto
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
    // Se vier no formato yyyy-MM-dd, converte para dd/MM/yyyy
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}`;
    }
    // Se vier no formato ISO (yyyy-MM-ddTHH:mm:ss), pega só a data
    if (/^\d{4}-\d{2}-\d{2}T/.test(d)) {
      const [date] = d.split('T');
      const [y, m, day] = date.split('-');
      return `${day}/${m}/${y}`;
    }
    return d;
  }
}

