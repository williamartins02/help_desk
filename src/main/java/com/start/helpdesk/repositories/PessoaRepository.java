package com.start.helpdesk.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import com.start.helpdesk.domain.Pessoa;

public interface PessoaRepository extends JpaRepository<Pessoa, Integer> {

}
