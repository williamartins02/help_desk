import { Credenciais } from './../models/credenciais';
import { API_CONFIG } from './../config/api.config';
import { HttpClient } from '@angular/common/http';


import { Injectable } from '@angular/core';
import { JwtHelperService } from '@auth0/angular-jwt';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {

  jwtService: JwtHelperService = new JwtHelperService();

  constructor(private http: HttpClient) { }
//autenticando LOGIN/SENHA para entrar no sistema, via ENDPOINT
authenticate(creds: Credenciais){
  
  return this.http.post(`${API_CONFIG.baseUrl}/login`, creds,{
    //pedindo para observar o TOKEN que vem tipo TEXTO, na respsota de login
    observe:      'response',
    responseType: 'text'
  });
}
/*Salvar dados mesmo com o fechamento do navegado*/
 successLogin(authToken: string){
   localStorage.setItem('token', authToken);
 }

 async getPermissions(email: string) {
    const encodedEmail = encodeURIComponent(email);
    const data = await this.http.get<{authorities: any}>(`${API_CONFIG.baseUrl}/user/${encodedEmail}`).toPromise();
    const permissions = this.parsePermissions(data.authorities);
    localStorage.setItem('permissions', JSON.stringify(permissions));
 }

 /** Retorna as informações completas do usuário pelo e-mail (inclui o campo 'nome') */
 getUserInfo(email: string) {
   const encodedEmail = encodeURIComponent(email);
   return this.http.get<any>(`${API_CONFIG.baseUrl}/user/${encodedEmail}`);
 }

 /**metodo para autenticar o TOKEN do usuario. */
 isAuthenticated(){
   let token = localStorage.getItem('token')
   if(token != null){//verificando se o token esta ativo ou expirado
     return !this.jwtService.isTokenExpired(token)
   }
   return false;
 }

 parsePermissions(authorities: any) {
    return authorities.map(data => data.authority);
 }

 /*Metodo para solicitar redefinição de senha */
 forgotPassword(email: string) {
   return this.http.post(`${API_CONFIG.baseUrl}/auth/forgot-password`, { email });
 }

 /*Metodo para redefinir a senha com o token recebido por e-mail */
 resetPassword(token: string, newPassword: string) {
   return this.http.post(`${API_CONFIG.baseUrl}/auth/reset-password`, { token, newPassword });
 }

  /*Metodo para limpar o (toke) */
  logout(){
    localStorage.clear();
    sessionStorage.removeItem('alertaChamadosCriticosExibido');
  }

}
