import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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
    return this.http.post<Tarefa>(this.baseUrl, tarefa);
  }

  /**
   * Atualiza todos os campos de uma tarefa.
   *
   * @param id     ID da tarefa
   * @param tarefa novos dados
   */
  update(id: number, tarefa: Tarefa): Observable<Tarefa> {
    return this.http.put<Tarefa>(`${this.baseUrl}/${id}`, tarefa);
  }

  /**
   * Altera apenas o status de uma tarefa.
   *
   * @param id     ID da tarefa
   * @param status código numérico do novo status
   */
  alterarStatus(id: number, status: number): Observable<Tarefa> {
    return this.http.patch<Tarefa>(`${this.baseUrl}/${id}/status`, { status });
  }

  /**
   * Remove uma tarefa.
   *
   * @param id ID da tarefa a excluir
   */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}

