package com.start.helpdesk.config;

import java.io.IOException;
import java.util.Arrays;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.core.env.Environment;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.start.helpdesk.security.JWTAuthenticationFilter;
import com.start.helpdesk.security.JWTAuthorizationFilter;
import com.start.helpdesk.security.JWTUtil;

@EnableWebSecurity
@EnableGlobalMethodSecurity(prePostEnabled = true)// Liberando para usar segurity dentro dos edPoints (Autorização/auteticacção)
public class SecurityConfig extends WebSecurityConfigurerAdapter {

	/* Liberando o acesso banco H2 e endpoints públicos de autenticação */
	private static final String[] PUBLIC_MATCHERS = {
			"/h2-console/**",
			"/auth/forgot-password",
			"/auth/reset-password",
			"/chat-websocket/**"   // ← WebSocket / SockJS endpoint
	};

	@Autowired
	private Environment env; /* habilitando o H2 no perfil de test */

	@Autowired
	private JWTUtil jwtUtil;

	@Autowired
	private UserDetailsService userDetailsService;

	@Override
	protected void configure(HttpSecurity http) throws Exception {
		

		/* condição para liberar acesso as tabelas do H2 */
		if (Arrays.asList(env.getActiveProfiles()).contains("test")) {
			http.headers().frameOptions().disable();
		}
		
		/* permitindo o acesso H2 */
		http.authorizeRequests().antMatchers(PUBLIC_MATCHERS).permitAll().anyRequest().authenticated();
		
		/*Filtro de AUTENTICACAÇÂO token*/
		http.addFilter(new JWTAuthenticationFilter(authenticationManager(), jwtUtil));
		
		/*Filtro de AUTORIZAÇÂO token*/
		http.addFilter(new JWTAuthorizationFilter(authenticationManager(), jwtUtil, userDetailsService));
		/*
		 * Como no caso a política de sessão é stateless (sem estado), não teria essa
		 * preocupação sobre ataques maliciosos
		 * Proteção contra usuario q não estao validado por topken
		 */
		http.cors().and().csrf().disable();/* DESABILITANDO proteção ataque "csrf" */
		http.sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS);/*Assegunrando que n sera criado uma sessão
																		 * para manter o crsf desabilitado*/																
	}

	/*Sobrecarga para informa sobre autentificação */
	@Override
	protected void configure(AuthenticationManagerBuilder auth) throws Exception {
		auth.userDetailsService(userDetailsService).passwordEncoder(bCryptPasswordEncoder());
	}

	/**
	 * Filtro CORS dinâmico: aceita qualquer origem http://localhost:*
	 * Compatível com Spring 5.2 (Spring Boot 2.3) e allowCredentials=true
	 */
	@Bean
	public FilterRegistrationBean<Filter> dynamicCorsFilter() {
		FilterRegistrationBean<Filter> bean = new FilterRegistrationBean<>();
		bean.setFilter(new Filter() {
			@Override
			public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
					throws IOException, ServletException {
				HttpServletRequest  request  = (HttpServletRequest)  req;
				HttpServletResponse response = (HttpServletResponse) res;
				String origin = request.getHeader("Origin");
				if (origin != null && origin.matches("http://localhost(:\\d+)?")) {
					response.setHeader("Access-Control-Allow-Origin",      origin);
					response.setHeader("Access-Control-Allow-Credentials", "true");
					response.setHeader("Access-Control-Allow-Methods",     "GET,POST,PUT,DELETE,OPTIONS,PATCH");
					response.setHeader("Access-Control-Allow-Headers",     "Authorization,Content-Type,X-Requested-With,Accept,Origin,Access-Control-Request-Method,Access-Control-Request-Headers");
					response.setHeader("Access-Control-Expose-Headers",    "Authorization");
					response.setHeader("Access-Control-Max-Age",           "3600");
				}
				if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
					response.setStatus(HttpServletResponse.SC_OK);
					return;
				}
				chain.doFilter(req, res);
			}
		});
		bean.addUrlPatterns("/*");
		bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
		return bean;
	}

	@Bean
	CorsConfigurationSource corsConfigurationSource() {
		CorsConfiguration configuration = new CorsConfiguration();
		configuration.setAllowedOrigins(Arrays.asList("http://localhost:4200", "http://localhost:58486"));
		configuration.setAllowedMethods(Arrays.asList(
				"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
		configuration.setAllowedHeaders(Arrays.asList(
				"Authorization", "Content-Type", "X-Requested-With", "Accept",
				"Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"));
		configuration.setExposedHeaders(Arrays.asList(
				"Authorization", "Access-Control-Allow-Origin", "Access-Control-Allow-Credentials"));
		configuration.setAllowCredentials(true);
		configuration.setMaxAge(3600L);

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", configuration);
		return source;
	}

	/* Criando CODIFICAÇÃO senha grava no banco */
	@Bean
	public BCryptPasswordEncoder bCryptPasswordEncoder() {
		return new BCryptPasswordEncoder();
	}

}
