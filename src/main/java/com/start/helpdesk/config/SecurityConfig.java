package com.start.helpdesk.config;

import java.util.Arrays;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
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
import com.start.helpdesk.security.JWTUtil;

@EnableWebSecurity
public class SecurityConfig extends WebSecurityConfigurerAdapter {

	/* Liberando o acesso banco H2 */
	private static final String[] PUBLIC_MATCHERS = { "/h2-console/**" };

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

		/*Registrando filtro de AUTENTIFICAÇÂO*/
		http.addFilter(new JWTAuthenticationFilter(authenticationManager(), jwtUtil));

		/* permitindo o acesso H2 */
		http.authorizeRequests().antMatchers(PUBLIC_MATCHERS).permitAll().anyRequest().authenticated();

		/*
		 * Como no caso a política de sessão é stateless (sem estado), não teria essa
		 * preocupação sobre ataques maliciosos
		 */
		http.cors().and().csrf().disable();/* DESABILITANDO proteção ataque "csrf" */

		http.sessionManagement()
				.sessionCreationPolicy(SessionCreationPolicy.STATELESS);/*Assegunrando que n sera criado uma sessão
																		 * para manter o crsf desabilitado*/																
	}

	/*Sobrecarga para informa sobre autentificação */
	@Override
	protected void configure(AuthenticationManagerBuilder auth) throws Exception {
		auth.userDetailsService(userDetailsService).passwordEncoder(bCryptPasswordEncoder());
	}

	/* Recebendo liberação para os endPOint */
	@Bean // executar assim que startar proj
	CorsConfigurationSource corsConfigurationSource() {
		CorsConfiguration configuration = new CorsConfiguration().applyPermitDefaultValues();/* LIBERANDO os metodo */
		configuration.setAllowedMethods(Arrays.asList("POST", "GET", "PUT", "DELETE", "OPTIONS"));
		final UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", configuration);
		return source;
	}

	/* Criando CODIFICAÇÃO senha grava no banco */
	@Bean
	public BCryptPasswordEncoder bCryptPasswordEncoder() {
		return new BCryptPasswordEncoder();
	}

}
