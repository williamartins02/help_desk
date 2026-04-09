import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IUsuario } from '../models/usuario';
import { API_CONFIG } from '../config/api.config';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  constructor(private http: HttpClient) {}

  findAll(): Observable<IUsuario[]> {
    return this.http.get<IUsuario[]>(`${API_CONFIG.baseUrl}/user/all`);
  }
}

