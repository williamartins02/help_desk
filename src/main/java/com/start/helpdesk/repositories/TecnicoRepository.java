package com.start.helpdesk.repositories;



import org.springframework.data.jpa.repository.JpaRepository;


import com.start.helpdesk.domain.Tecnico;

public interface TecnicoRepository extends JpaRepository<Tecnico, Integer> {

	
}
