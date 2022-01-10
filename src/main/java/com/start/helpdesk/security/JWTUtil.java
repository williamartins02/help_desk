package com.start.helpdesk.security;


import java.util.Date;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;

/*Chave da AUTENTICAÇÃO que vai gerar o TOKEN*/
@Service
public class JWTUtil {
	
	@Value("${jwt.expiration}")
	private Long expiration;
	@Value("${jwt.secret}")
	private String secret;

	/*METODO para gerar o TOKE, data de expiração, a senha com segurança e email*/
	public String generationToken(String email) {
		return Jwts.builder()
				.setSubject(email)
				.setExpiration(new Date(System.currentTimeMillis() + expiration))
				.signWith(SignatureAlgorithm.HS512, secret.getBytes())
				.compact();
		
	}

	/*METODO para reividinca se o token é valido sim/não*/
	public boolean tokenValido(String token) {
		Claims claims = getClaims(token);
		if(claims != null) {
			String username = claims.getSubject();//pegando o login
			Date expirationDate = claims.getExpiration();//tempo de expiração
			Date now = new Date(System.currentTimeMillis());//pegando tempo atual
			
			  if(username != null && expirationDate != null && now.before(expirationDate)) {
				  return true;  
			  }
		}
		return false;
	}

	/*Analisando reivindicações do (TOKEN) "jwt"*/
	private Claims getClaims(String token) {
		  try {
			return Jwts.parser().setSigningKey(secret.getBytes()).parseClaimsJws(token).getBody();
		} catch (Exception e) {
			return null;
		}
	}

	/*Analizando e reividicando se o LOGIN é valido*/
	public String getUsername(String token) {
		Claims claims = getClaims(token);
		if(claims != null) {
			return claims.getSubject();
		}
		return null;
	}
	
}
