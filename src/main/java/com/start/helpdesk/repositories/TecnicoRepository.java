package com.start.helpdesk.repositories;



import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;

import com.start.helpdesk.domain.Tecnico;

@Repository
public interface TecnicoRepository extends JpaRepository<Tecnico, Integer> {
	
	Optional<Tecnico> findByEmail(String email);

	/**
	 * Retorna os técnicos ordenados pela quantidade de chamados encerrados no mês atual.
	 */
	@Query("SELECT t FROM Tecnico t LEFT JOIN t.chamados c ON c.status = 2 AND FUNCTION('MONTH', c.dataFechamento) = :mes AND FUNCTION('YEAR', c.dataFechamento) = :ano GROUP BY t.id ORDER BY COUNT(c.id) DESC")
	List<Tecnico> findRankingTecnicosByChamadosResolvidos(@Param("mes") int mes, @Param("ano") int ano);

}
