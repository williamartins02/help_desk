import { API_CONFIG } from "./../config/api.config";
import { Chamado } from "./../models/chamado";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, Subject, tap } from "rxjs";

/** Estrutura retornada pelo endpoint paginado (/chamados/page) */
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

@Injectable({
  providedIn: "root",
})
export class ChamadoService {
  private _refresh$ = new Subject<void>();
  
  constructor(private http: HttpClient) {}

  get refresh$() {
    return this._refresh$;
  }

  findById(id: number): Observable<Chamado> {
    return this.http.get<Chamado>(`${API_CONFIG.baseUrl}/chamados/${id}`);
  }

  findAll(): Observable<Chamado[]> {
    return this.http.get<Chamado[]>(`${API_CONFIG.baseUrl}/chamados`);
  }

  findByCliente(clienteId: number): Observable<Chamado[]> {
    return this.http.get<Chamado[]>(`${API_CONFIG.baseUrl}/chamados/cliente/${clienteId}`);
  }

  findByTecnico(tecnicoId: number): Observable<Chamado[]> {
    return this.http.get<Chamado[]>(`${API_CONFIG.baseUrl}/chamados/tecnico/${tecnicoId}`);
  }

  findMyChamados(): Observable<Chamado[]> {
    return this.http.get<Chamado[]>(`${API_CONFIG.baseUrl}/chamados/tecnico/me`);
  }

  create(chamados: Chamado): Observable<Chamado> {
    return this.http.post<Chamado>(`${API_CONFIG.baseUrl}/chamados`, chamados)
      .pipe(
        tap(() => {
          this._refresh$.next();
        })
      );
  }

  update(chamados: Chamado): Observable<Chamado> {
    return this.http.put<Chamado>(`${API_CONFIG.baseUrl}/chamados/${chamados.id}`, chamados)
      .pipe(
        tap(() => {
          this._refresh$.next();
        })
      );
  }

  /**
   * Endpoint paginado — recomendado para uso futuro em produção com grande volume.
   * Parâmetros: page (0-based), size, sort (ex: 'dataAbertura,desc')
   * Retorna PageResponse com metadados (totalElements, totalPages, etc.).
   */
  findAllPaginado(page: number = 0, size: number = 20, sort: string = 'dataAbertura,desc'): Observable<PageResponse<Chamado>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);
    return this.http.get<PageResponse<Chamado>>(`${API_CONFIG.baseUrl}/chamados/page`, { params });
  }
}
