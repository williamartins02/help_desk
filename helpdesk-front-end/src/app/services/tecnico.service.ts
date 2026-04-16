import { Injectable } from '@angular/core';
import { Tecnico } from './../models/tecnico';
import { Observable, Subject, tap } from 'rxjs';

import { HttpClient } from '@angular/common/http';
import { API_CONFIG } from '../config/api.config';

export interface ChamadoPendenteInfo {
  id: number;
  titulo: string;
  nomeCliente: string;
  prioridade: string;
  status: string;
  dataAbertura: string;
}

export interface ReatribuicaoRequest {
  novoTecnicoId: number;
  chamadosIds: number[];
}

@Injectable({
  providedIn: 'root'
})
export class TecnicoService {

  private _refresh$ = new Subject<void>();

  constructor(private http: HttpClient) { }

  get refresh$() {
    return this._refresh$;
  }

  findById(id: any): Observable<Tecnico> {
    return this.http.get<Tecnico>(`${API_CONFIG.baseUrl}/tecnicos/${id}`)
  }

  findAll(): Observable<Tecnico[]> {
    return this.http.get<Tecnico[]>(`${API_CONFIG.baseUrl}/tecnicos`);
  }

  /** Retorna apenas técnicos ativos (para seleção em chamados, reatribuição etc.) */
  findAllAtivos(): Observable<Tecnico[]> {
    return this.http.get<Tecnico[]>(`${API_CONFIG.baseUrl}/tecnicos/ativos`);
  }

  create(tecnicos: Tecnico): Observable<Tecnico> {
    return this.http.post<Tecnico>(`${API_CONFIG.baseUrl}/tecnicos`, tecnicos)
      .pipe(tap(() => this._refresh$.next()));
  }

  update(tecnicos: Tecnico): Observable<Tecnico> {
    return this.http.put<Tecnico>(`${API_CONFIG.baseUrl}/tecnicos/${tecnicos.id}`, tecnicos)
      .pipe(tap(() => this._refresh$.next()));
  }

  delete(id: any): Observable<Tecnico> {
    return this.http.delete<Tecnico>(`${API_CONFIG.baseUrl}/tecnicos/${id}`)
      .pipe(tap(() => this._refresh$.next()));
  }

  /** Retorna chamados pendentes (ABERTO/ANDAMENTO) de um técnico */
  getChamadosPendentes(id: number): Observable<ChamadoPendenteInfo[]> {
    return this.http.get<ChamadoPendenteInfo[]>(`${API_CONFIG.baseUrl}/tecnicos/${id}/chamados-pendentes`);
  }

  /** Reatribui chamados selecionados sem inativar o técnico */
  reatribuirChamados(id: number, request: ReatribuicaoRequest): Observable<void> {
    return this.http.post<void>(`${API_CONFIG.baseUrl}/tecnicos/${id}/reatribuir-chamados`, request)
      .pipe(tap(() => this._refresh$.next()));
  }

  /** Reatribui chamados pendentes e inativa o técnico */
  reatribuirEInativar(id: number, request: ReatribuicaoRequest): Observable<void> {
    return this.http.post<void>(`${API_CONFIG.baseUrl}/tecnicos/${id}/reatribuir-e-inativar`, request)
      .pipe(tap(() => this._refresh$.next()));
  }

  /** Inativa o técnico sem reatribuição (sem chamados pendentes) */
  inativarTecnico(id: number): Observable<void> {
    return this.http.post<void>(`${API_CONFIG.baseUrl}/tecnicos/${id}/inativar`, {})
      .pipe(tap(() => this._refresh$.next()));
  }

  /** Reativa um técnico previamente inativado */
  reativarTecnico(id: number): Observable<void> {
    return this.http.post<void>(`${API_CONFIG.baseUrl}/tecnicos/${id}/reativar`, {})
      .pipe(tap(() => this._refresh$.next()));
  }
}