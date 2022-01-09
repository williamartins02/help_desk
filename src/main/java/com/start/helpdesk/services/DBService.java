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
		Tecnico tec1 = new Tecnico(null, "Renan Paulo Arthur Melo", "412.468.591-22","renanpauloarthurmelo@gruposimoes.com", "FgY9AMzs");
		tec1.addPerfil(Perfil.ADMIN);
		
		Tecnico tec2 = new Tecnico(null, "Isabelly Camila da Mata", "383.239.996-86","iisabellycamiladamata@gruposimoes.com.br", "EPsYWn32pD");
		tec1.addPerfil(Perfil.ADMIN);
		
		Tecnico tec3 = new Tecnico(null, "Henrique Yuri Márcio Silveira", "809.659.299-81","henriqueyurimarciosilveira@gruposimoescom.br", "UIYGEsULUZ");
		tec1.addPerfil(Perfil.ADMIN);
		
		Tecnico tec4 = new Tecnico(null, "Mariana Sarah Rocha", "923.194.501-73","marianasarahrocha__21@gruposimoescom.br", "FuEx6RAdg9");
		tec1.addPerfil(Perfil.ADMIN);

		Cliente cli1 = new Cliente(null, "Amanda Malu Luciana Rocha", "094.167.932-21", "amandamalulucianarocha-97@hidracom.com.br","wslsIEJge7");
		Cliente cli2 = new Cliente(null, "Nair Nina Fogaça", "837.106.538-86", "nairninafogaca__nairninafogaca@eccofibra.com.br","DegWwgwEF7");
		Cliente cli3 = new Cliente(null, "Stefany Gabriela Marina Oliveira", "491.837.982-69", "stefanygabrielamarinaoliveira@salera.com.br","BSUBKhRAId");
		Cliente cli4 = new Cliente(null, "Catarina Cláudia Gomes", "987.836.122-54", "catarinaclaudiagomes@bol.com","DIJRxpWdAQ");

		Chamado c1 = new Chamado(null, Prioridade.MEDIA, Status.ANDAMENTO, "Chamado 01", "Primeiro chamado", tec1,cli1);
		Chamado c2 = new Chamado(null, Prioridade.ALTA,  Status.ANDAMENTO, "Chamado 04", "Primeiro chamado", tec2,cli2);
		Chamado c3 = new Chamado(null, Prioridade.BAIXA, Status.ABERTO   , "Chamado 05", "Primeiro chamado", tec1,cli3);
		Chamado c4 = new Chamado(null, Prioridade.MEDIA, Status.ENCERRADO, "Chamado 06", "Primeiro chamado", tec4,cli4);

		tecnicoRepository.saveAll(Arrays.asList(tec1, tec2, tec3, tec4));
		clienteRepository.saveAll(Arrays.asList(cli1,cli2,cli3,cli4));
		chamadoRepository.saveAll(Arrays.asList(c1,c2,c3,c4));
	}

}
