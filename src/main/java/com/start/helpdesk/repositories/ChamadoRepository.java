package com.start.helpdesk.repositories;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.domain.enums.Classificacao;
import com.start.helpdesk.domain.enums.Classificacao;
import com.start.helpdesk.domain.enums.Status;

@Repository
public interface ChamadoRepository extends JpaRepository<Chamado, Integer> {

    List<Chamado> findByClienteId(Integer clienteId);
    List<Chamado> findByTecnicoId(Integer tecnicoId);

    /** Todos os chamados com determinado status (usado pelo módulo de inteligência). */
    List<Chamado> findByStatus(Status status);

    /** Chamados encerrados de uma determinada classificação (usado pelo módulo de inteligência). */
    List<Chamado> findByClassificacaoAndStatus(Classificacao classificacao, Status status);

    /**
     * Chamados com determinado status cujo título OU observações contenham a palavra-chave
     * (case-insensitive). Usado para busca de similares e sugestão de classificação.
     */
    @Query("SELECT c FROM Chamado c WHERE c.status = :status " +
           "AND (LOWER(c.titulo) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR LOWER(c.observacoes) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    List<Chamado> findByStatusAndKeyword(@Param("status") Status status,
                                         @Param("keyword") String keyword);

    /** Versão paginada de findAll — usada pelo endpoint /chamados/page */
    @org.springframework.lang.NonNull
    Page<Chamado> findAll(@org.springframework.lang.NonNull Pageable pageable);

    /** Versão paginada por técnico */
    Page<Chamado> findByTecnicoId(Integer tecnicoId, Pageable pageable);

    /** Chamados de um técnico que ainda não estão encerrados (ABERTO ou ANDAMENTO). */
    @Query("SELECT c FROM Chamado c WHERE c.tecnico.id = :tecnicoId AND c.status <> :statusEncerrado")
    List<Chamado> findPendentesByTecnicoId(@Param("tecnicoId") Integer tecnicoId,
                                            @Param("statusEncerrado") Status statusEncerrado);

    /**
     * Busca chamados com filtros opcionais para o dashboard de BI.
     * Parâmetros null são ignorados (sem filtro para aquele campo).
     */
    @Query("SELECT c FROM Chamado c WHERE " +
           "c.dataAbertura >= :inicio AND c.dataAbertura <= :fim " +
           "AND (:tecnicoId IS NULL OR c.tecnico.id = :tecnicoId) " +
           "AND (:status   IS NULL OR c.status     = :status)    " +
           "AND (:prioridade IS NULL OR c.prioridade = :prioridade)")
    List<Chamado> findComFiltrosBi(
            @Param("inicio")     LocalDateTime inicio,
            @Param("fim")        LocalDateTime fim,
            @Param("tecnicoId")  Integer tecnicoId,
            @Param("status")     com.start.helpdesk.domain.enums.Status status,
            @Param("prioridade") com.start.helpdesk.domain.enums.Prioridade prioridade);
}
