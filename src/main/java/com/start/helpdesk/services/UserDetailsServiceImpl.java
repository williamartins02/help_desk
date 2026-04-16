package com.start.helpdesk.services;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.start.helpdesk.domain.Pessoa;
import com.start.helpdesk.repositories.PessoaRepository;
import com.start.helpdesk.security.UserSS;


/*CLASSES UserDetailsServiceImpl carregar detalhes sobre o usuário durante a autenticação*/
@Service
public class UserDetailsServiceImpl implements UserDetailsService {

	@Autowired
	private PessoaRepository pessoaRepository;
	
	@Override
	public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
		Optional<Pessoa> user = pessoaRepository.findByEmail(email);
		if (user.isPresent()) {
			Pessoa pessoa = user.get();
			// Retorna o UserSS com o flag ativo — o Spring Security lança DisabledException
			// automaticamente quando isEnabled() retorna false, antes de verificar a senha.
			return new UserSS(pessoa.getId(), pessoa.getEmail(), pessoa.getSenha(),
					pessoa.getPerfis(), pessoa.isAtivo());
		}
		throw new UsernameNotFoundException(email);
	}
}
