package com.start.helpdesk.security;


import java.util.Date;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

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
	
}
