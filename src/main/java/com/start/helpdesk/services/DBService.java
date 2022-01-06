package com.start.helpdesk.services;

import java.util.Arrays;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.domain.Cliente;
import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.enums.Perfil;
import com.start.helpdesk.domain.enums.Prioridade;
import com.start.helpdesk.domain.enums.Status;
import com.start.helpdesk.repositories.ChamadoRepository;
import com.start.helpdesk.repositories.ClienteRepository;
import com.start.helpdesk.repositories.TecnicoRepository;

@Service
public class DBService {

	@Autowired // Injeção de dependencia
	private TecnicoRepository tecnicoRepository;
	@Autowired
	private ClienteRepository clienteRepository;
	@Autowired
	private ChamadoRepository chamadoRepository;

	public void instanciaDB() {
		Tecnico tec1 = new Tecnico(null, "Renan Paulo Arthur Melo", "412.468.591-22","renanpauloarthurmelo@granvale.com", "FgY9AMzs");
		tec1.addPerfil(Perfil.ADMIN);

		Cliente cli1 = new Cliente(null, "Catarina Cláudia Gomes", "265.063.931-81", "catarinaclaudiagomes@bol.com","DIJRxpWdAQ");

		Chamado c1 = new Chamado(null, Prioridade.MEDIA, Status.ANDAMENTO, "Chamado 01", "Primeiro chamado", tec1,cli1);

		tecnicoRepository.saveAll(Arrays.asList(tec1));
		clienteRepository.saveAll(Arrays.asList(cli1));
		chamadoRepository.saveAll(Arrays.asList(c1));
	}

}
