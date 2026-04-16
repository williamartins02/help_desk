package com.start.helpdesk.security;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Date;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;


import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.start.helpdesk.domain.dtos.CredenciaisDTO;


/*Filtro de AUTETICAÇÃO usando JWT*/
public class JWTAuthenticationFilter extends UsernamePasswordAuthenticationFilter {
	

	private AuthenticationManager authenticationManager;
	private JWTUtil jwtUtil;
	
	
	public JWTAuthenticationFilter(AuthenticationManager authenticationManager, JWTUtil jwtUtil) {
		super();
		this.authenticationManager = authenticationManager;
		this.jwtUtil = jwtUtil;
	}
	/*METODOS principais para tratar autenticações*/
	@Override
	public Authentication attemptAuthentication(HttpServletRequest request, HttpServletResponse response)
			throws AuthenticationException {
		try {
			CredenciaisDTO credenciaisDTO = new ObjectMapper().readValue(request.getInputStream(), CredenciaisDTO.class);
			UsernamePasswordAuthenticationToken authenticationToken = new UsernamePasswordAuthenticationToken(
					credenciaisDTO.getEmail(), credenciaisDTO.getSenha(), new ArrayList<>());
			Authentication authentication = authenticationManager.authenticate(authenticationToken);
			return authentication;
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
	}
	/*METODO para sucesso da AUTENTIFICAÇÂO/retornando o token para usuario*/
	@Override
	protected void successfulAuthentication(HttpServletRequest request, HttpServletResponse response, FilterChain chain,
			Authentication authResult) throws IOException, ServletException {
		String username = ((UserSS) authResult.getPrincipal()).getUsername();
		String token = jwtUtil.generationToken(username);
		response.setHeader("access-control-expose-headers", "Authorization");
		response.setHeader("Authorization", "Bearer " + token);
	}
	/*METODO para autenticação malSucedida ..*/
	@Override
	protected void unsuccessfulAuthentication(HttpServletRequest request, HttpServletResponse response,
			AuthenticationException failed) throws IOException, ServletException {
		boolean isInativo = failed instanceof DisabledException
				|| (failed.getCause() != null && failed.getCause() instanceof DisabledException);

		response.setStatus(isInativo ? 423 : 401);
		response.setContentType("application/json");
		response.setCharacterEncoding("UTF-8");
		response.getWriter().append(isInativo ? jsonInativo() : json());
	}

	private CharSequence json() {
		long date = new Date().getTime();
		return "{"
				+ "\"timestamp\": " + date + ", "
				+ "\"status\": 401, "
				+ "\"error\": \"Não autorizado\", "
				+ "\"message\": \"Email ou senha inválidos\", "
				+ "\"path\": \"/login\"}";
	}

	private CharSequence jsonInativo() {
		long date = new Date().getTime();
		return "{"
				+ "\"timestamp\": " + date + ", "
				+ "\"status\": 423, "
				+ "\"error\": \"Conta Inativa\", "
				+ "\"message\": \"Seu usuário está inativo. Entre em contato com o administrador para reativação.\", "
				+ "\"path\": \"/login\"}";
	}

}
