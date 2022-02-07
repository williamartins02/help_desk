package com.start.helpdesk.repositories;



import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.stereotype.Repository;

import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.Telefone;

@Repository
public interface TelefoneRepository extends JpaRepository<Telefone, Integer> {
	
	
	List<Telefone> findByTecnico(Tecnico tecnico);

}
