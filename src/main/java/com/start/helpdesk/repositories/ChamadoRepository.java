package com.start.helpdesk.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import com.start.helpdesk.domain.Chamado;

public interface ChamadoRepository extends JpaRepository<Chamado, Integer> {

}
