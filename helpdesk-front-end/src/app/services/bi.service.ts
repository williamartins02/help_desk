import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../config/api.config';
import { BiDashboard } from '../models/bi-dashboard';
@Injectable({ providedIn: 'root' })
export class BiService {
  constructor(private http: HttpClient) {}
  getDashboard(params: {
    dataInicio?: string;
    dataFim?: string;
    tecnicoId?: number | null;
    status?: number | null;
    prioridade?: number | null;
  }): Observable<BiDashboard> {
    let p = new HttpParams();
    if (params.dataInicio) p = p.set('dataInicio', params.dataInicio);
    if (params.dataFim)    p = p.set('dataFim',    params.dataFim);
    if (params.tecnicoId  != null) p = p.set('tecnicoId',  params.tecnicoId.toString());
    if (params.status     != null) p = p.set('status',     params.status.toString());
    if (params.prioridade != null) p = p.set('prioridade', params.prioridade.toString());
    return this.http.get<BiDashboard>(`${API_CONFIG.baseUrl}/bi/dashboard`, { params: p });
  }
}
