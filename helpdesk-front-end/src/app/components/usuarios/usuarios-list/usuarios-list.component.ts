import { IUsuario } from '../../../models/usuario';
import { UsuarioService } from '../../../services/usuario.service';
import { ToastrService } from 'ngx-toastr';
import {
  Component, OnInit, AfterViewInit, ViewChild
} from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';

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

  displayedColumns = ['avatar', 'nome', 'email', 'cpf', 'perfis', 'tipo', 'dataCriacao'];
  dataSource = new MatTableDataSource<IUsuario>([]);

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort)      sort:      MatSort;

  constructor(
    private service: UsuarioService,
    private toast:   ToastrService
  ) {}

  ngOnInit(): void { this.findAll(); }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort      = this.sort;
  }

  // ── Dados ─────────────────────────────────────────────────────────────────
  findAll(): void {
    this.isLoading = true;
    this.service.findAll().subscribe(
      data => {
        this.USUARIO_DATA = data;
        this.applyFilters();
        this.isLoading = false;
      },
      () => {
        this.toast.error('Erro ao carregar usuários', 'ERROR');
        this.isLoading = false;
      }
    );
  }

  // ── Filtros ───────────────────────────────────────────────────────────────
  applyFilters(): void {
    let filtered = [...this.USUARIO_DATA];
    if (this.selectedTipo) {
      filtered = filtered.filter(u => u.tipo === this.selectedTipo);
    }
    this.dataSource = new MatTableDataSource<IUsuario>(filtered);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort      = this.sort;
    this.dataSource.filterPredicate = (data, f) => {
      const s = f.toLowerCase();
      return data.nome.toLowerCase().includes(s) ||
             data.email.toLowerCase().includes(s) ||
             (data.cpf || '').replace(/\D/g, '').includes(s.replace(/\D/g, ''));
    };
    if (this.searchValue.trim()) {
      this.dataSource.filter = this.searchValue.trim().toLowerCase();
    }
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

  // ── Contadores ────────────────────────────────────────────────────────────
  get totalAdmin():   number { return this.USUARIO_DATA.filter(u => u.perfis?.includes('ROLE_ADMIN')).length; }
  get totalTecnico(): number { return this.USUARIO_DATA.filter(u => u.tipo === 'TECNICO').length; }
  get totalCliente(): number { return this.USUARIO_DATA.filter(u => u.tipo === 'CLIENTE').length; }
  get hasFilters():   boolean { return this.selectedTipo !== '' || this.searchValue.trim() !== ''; }

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
    return d; // já vem formatado pelo @JsonFormat do backend
  }
}

