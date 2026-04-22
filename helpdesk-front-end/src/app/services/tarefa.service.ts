import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { API_CONFIG } from '../config/api.config';
import { Tarefa } from '../models/tarefa';

/**
 * Serviço Angular responsável pela comunicação com a API de Tarefas.
 *
 * Fornece métodos para todas as operações CRUD + alteração de status.
 */
@Injectable({
  providedIn: 'root'
})
export class TarefaService {

  /** URL base do recurso de tarefas */
  private readonly baseUrl = `${API_CONFIG.baseUrl}/tarefas`;

  /**
   * Emite sempre que uma tarefa é criada, atualizada, tem status alterado ou é excluída.
   * Permite que outros componentes (ex: Calendário da Equipe) se inscrevam e recarreguem.
   */
  private _refresh$ = new Subject<void>();
  get refresh$() { return this._refresh$.asObservable(); }

  constructor(private http: HttpClient) {}

  // ── Consultas ────────────────────────────────────────────────────────────

  /**
   * Retorna o detalhe de uma tarefa pelo ID.
   *
   * @param id identificador da tarefa
   */
  findById(id: number): Observable<Tarefa> {
    return this.http.get<Tarefa>(`${this.baseUrl}/${id}`);
  }

  /**
   * Lista tarefas com filtros opcionais.
   *
   * @param data      filtro de data (dd/MM/yyyy) — opcional
   * @param tecnicoId filtro por técnico — usado apenas por ADMIN
   */
  findAll(data?: string, tecnicoId?: number): Observable<Tarefa[]> {
    let params = new HttpParams();
    if (data)      params = params.set('data', data);
    if (tecnicoId) params = params.set('tecnicoId', tecnicoId.toString());
    return this.http.get<Tarefa[]>(this.baseUrl, { params });
  }

  // ── Operações de escrita ─────────────────────────────────────────────────

  /**
   * Cria uma nova tarefa.
   *
   * @param tarefa dados da tarefa a criar
   */
  create(tarefa: Tarefa): Observable<Tarefa> {
    return this.http.post<Tarefa>(this.baseUrl, tarefa).pipe(tap(() => this._refresh$.next()));
  }

  update(id: number, tarefa: Tarefa): Observable<Tarefa> {
    return this.http.put<Tarefa>(`${this.baseUrl}/${id}`, tarefa).pipe(tap(() => this._refresh$.next()));
  }

  alterarStatus(id: number, status: number): Observable<Tarefa> {
    return this.http.patch<Tarefa>(`${this.baseUrl}/${id}/status`, { status }).pipe(tap(() => this._refresh$.next()));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(tap(() => this._refresh$.next()));
  }
}

