import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { API_CONFIG } from '../config/api.config';
import {
  SugestaoRequest,
  SugestaoTecnico,
  SugestaoClassificacao,
  ChamadoSemelhant
} from '../models/inteligente';

@Injectable({ providedIn: 'root' })
export class InteligenteService {

  private base = `${API_CONFIG.baseUrl}/inteligente`;

  constructor(private http: HttpClient) {}

  sugerirTecnico(req: SugestaoRequest): Observable<SugestaoTecnico | null> {
    return this.http
      .post<SugestaoTecnico>(`${this.base}/sugerir-tecnico`, req)
      .pipe(catchError(() => of(null)));
  }

  sugerirClassificacao(req: SugestaoRequest): Observable<SugestaoClassificacao | null> {
    return this.http
      .post<SugestaoClassificacao>(`${this.base}/sugerir-classificacao`, req)
      .pipe(catchError(() => of(null)));
  }

  chamadosSemelhantes(req: SugestaoRequest): Observable<ChamadoSemelhant[]> {
    return this.http
      .post<ChamadoSemelhant[]>(`${this.base}/chamados-semelhantes`, req)
      .pipe(catchError(() => of([])));
  }
}

