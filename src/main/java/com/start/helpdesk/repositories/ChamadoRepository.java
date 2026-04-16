package com.start.helpdesk.repositories;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.domain.enums.Status;

@Repository
public interface ChamadoRepository extends JpaRepository<Chamado, Integer> {

    List<Chamado> findByClienteId(Integer clienteId);
    List<Chamado> findByTecnicoId(Integer tecnicoId);

    /** Chamados de um técnico que ainda não estão encerrados (ABERTO ou ANDAMENTO). */
    @Query("SELECT c FROM Chamado c WHERE c.tecnico.id = :tecnicoId AND c.status <> :statusEncerrado")
    List<Chamado> findPendentesByTecnicoId(@Param("tecnicoId") Integer tecnicoId,
                                            @Param("statusEncerrado") Status statusEncerrado);
}
