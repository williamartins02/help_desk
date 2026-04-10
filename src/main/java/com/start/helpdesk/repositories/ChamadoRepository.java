package com.start.helpdesk.repositories;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.start.helpdesk.domain.Chamado;

@Repository
public interface ChamadoRepository extends JpaRepository<Chamado, Integer> {

    List<Chamado> findByClienteId(Integer clienteId);
    List<Chamado> findByTecnicoId(Integer tecnicoId);
}
