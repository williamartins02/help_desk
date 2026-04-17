package com.start.helpdesk.repositories;

import com.start.helpdesk.domain.Tarefa;
import com.start.helpdesk.domain.enums.StatusTarefa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

/**
 * Repositório JPA para a entidade {@link Tarefa}.
 *
 * <p>Fornece consultas prontas para os casos de uso mais comuns da agenda:</p>
 * <ul>
 *   <li>Listar tarefas de um técnico por data</li>
 *   <li>Listar tarefas por status</li>
 *   <li>Listar tarefas vinculadas a um chamado</li>
 * </ul>
 */
@Repository
public interface TarefaRepository extends JpaRepository<Tarefa, Integer> {

    /**
     * Retorna todas as tarefas de um técnico em uma data específica,
     * ordenadas pelo horário de início.
     *
     * @param tecnicoId ID do técnico
     * @param data      data de execução das tarefas
     * @return lista ordenada por hora_inicio
     */
    @Query("SELECT t FROM Tarefa t WHERE t.tecnico.id = :tecnicoId AND t.data = :data ORDER BY t.horaInicio ASC NULLS LAST")
    List<Tarefa> findByTecnicoIdAndData(@Param("tecnicoId") Integer tecnicoId,
                                        @Param("data") LocalDate data);

    /**
     * Retorna todas as tarefas de um técnico, independente de data.
     *
     * @param tecnicoId ID do técnico
     * @return lista de tarefas do técnico
     */
    List<Tarefa> findByTecnicoId(Integer tecnicoId);

    /**
     * Retorna tarefas de um técnico filtradas por status.
     *
     * @param tecnicoId ID do técnico
     * @param status    status desejado (PENDENTE, EM_EXECUCAO, CONCLUIDO)
     * @return lista de tarefas com o status informado
     */
    List<Tarefa> findByTecnicoIdAndStatus(Integer tecnicoId, StatusTarefa status);

    /**
     * Retorna todas as tarefas vinculadas a um chamado específico.
     *
     * @param chamadoId ID do chamado
     * @return lista de tarefas do chamado
     */
    List<Tarefa> findByChamadoId(Integer chamadoId);

    /**
     * Retorna tarefas de um técnico em um intervalo de datas.
     * Útil para relatórios de produtividade.
     *
     * @param tecnicoId  ID do técnico
     * @param dataInicio data inicial do período
     * @param dataFim    data final do período
     * @return lista de tarefas no período
     */
    @Query("SELECT t FROM Tarefa t WHERE t.tecnico.id = :tecnicoId " +
           "AND t.data BETWEEN :dataInicio AND :dataFim ORDER BY t.data ASC, t.horaInicio ASC NULLS LAST")
    List<Tarefa> findByTecnicoIdAndDataBetween(@Param("tecnicoId") Integer tecnicoId,
                                               @Param("dataInicio") LocalDate dataInicio,
                                               @Param("dataFim") LocalDate dataFim);
}

