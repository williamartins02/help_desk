package com.start.helpdesk.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import com.start.helpdesk.domain.Cliente;


public interface ClienteRepository extends JpaRepository<Cliente, Integer> {

}
