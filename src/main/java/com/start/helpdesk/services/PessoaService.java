package com.start.helpdesk.services;

import com.start.helpdesk.domain.Pessoa;
import com.start.helpdesk.repositories.PessoaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class PessoaService {
    @Autowired
    private PessoaRepository pessoaRepository;

    public Pessoa findByEmail(String email) {
        Optional<Pessoa> pessoa = pessoaRepository.findByEmail(email);
        return pessoa.orElse(null);
    }
}

