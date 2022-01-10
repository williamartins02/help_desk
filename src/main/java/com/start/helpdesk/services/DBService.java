package com.start.helpdesk.services;


import java.util.Arrays;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.domain.Cliente;
import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.enums.Perfil;
import com.start.helpdesk.domain.enums.Prioridade;
import com.start.helpdesk.domain.enums.Status;
import com.start.helpdesk.repositories.ChamadoRepository;
import com.start.helpdesk.repositories.ClienteRepository;
import com.start.helpdesk.repositories.PessoaRepository;
import com.start.helpdesk.repositories.TecnicoRepository;

@Service
public class DBService {

	@Autowired // Injeção de dependencia
	private PessoaRepository pessoaRepository;
	@Autowired
	private ClienteRepository clienteRepository;
	@Autowired
	private ChamadoRepository chamadoRepository;
	@Autowired
	private BCryptPasswordEncoder bCryptPasswordEncoder;

	public void instanciaDB() {
		Tecnico tec1 = new Tecnico(null, "Renan Paulo Arthur Melo", "412.468.591-22","renanpauloarthurmelo@gruposimoes.com", bCryptPasswordEncoder.encode("FgY9AMzs"));
		tec1.addPerfil(Perfil.ADMIN);
		Tecnico tec2 = new Tecnico(null, "Isabelly Camila da Mata", "383.239.996-86","iisabellycamiladamata@gruposimoes.com.br", "EPsYWn32pD");
		Tecnico tec3 = new Tecnico(null, "Henrique Yuri Márcio Silveira", "809.659.299-81","henriqueyurimarciosilveira@gruposimoescom.br", bCryptPasswordEncoder.encode("UIYGEsULUZ"));
		Tecnico tec4 = new Tecnico(null, "Mariana Sarah Rocha", "923.194.501-73","marianasarahrocha__21@gruposimoescom.br", bCryptPasswordEncoder.encode("FuEx6RAdg9"));
		Tecnico tec5 = new Tecnico(null, "Richard Stallman", "903.347.070-56", "stallman@mail.com", bCryptPasswordEncoder.encode("123"));
		Tecnico tec6 = new Tecnico(null, "Claude Elwood Shannon", "271.068.470-54", "shannon@mail.com", bCryptPasswordEncoder.encode("123"));
		Tecnico tec7 = new Tecnico(null, "Tim Berners-Lee", "162.720.120-39", "lee@mail.com", bCryptPasswordEncoder.encode("123"));
		Tecnico tec8 = new Tecnico(null, "Linus Torvalds", "778.556.170-27", "linus@mail.com", bCryptPasswordEncoder.encode("123"));
		

		Cliente cli1 = new Cliente(null, "Amanda Malu Luciana Rocha", "094.167.932-21", "amandamalulucianarocha-97@hidracom.com.br",bCryptPasswordEncoder.encode("wslsIEJge7"));
		Cliente cli2 = new Cliente(null, "Nair Nina Fogaça", "837.106.538-86", "nairninafogaca__nairninafogaca@eccofibra.com.br",bCryptPasswordEncoder.encode("DegWwgwEF7"));
		Cliente cli3 = new Cliente(null, "Stefany Gabriela Marina Oliveira", "491.837.982-69", "stefanygabrielamarinaoliveira@salera.com.br",bCryptPasswordEncoder.encode("BSUBKhRAId"));
		Cliente cli4 = new Cliente(null, "Catarina Cláudia Gomes", "987.836.122-54", "catarinaclaudiagomes@bol.com",bCryptPasswordEncoder.encode("DIJRxpWdAQ"));
		Cliente cli5 = new Cliente(null, "Albert Einstein", "111.661.890-74", "einstein@mail.com", bCryptPasswordEncoder.encode("123"));
		Cliente cli6 = new Cliente(null, "Marie Curie", "322.429.140-06", "curie@mail.com", bCryptPasswordEncoder.encode("123"));
		Cliente cli7 = new Cliente(null, "Charles Darwin", "792.043.830-62", "darwin@mail.com", bCryptPasswordEncoder.encode("123"));
		Cliente cli8 = new Cliente(null, "Stephen Hawking", "177.409.680-30", "hawking@mail.com", bCryptPasswordEncoder.encode("123"));
		Cliente cli9 = new Cliente(null, "Max Planck", "081.399.300-83", "planck@mail.com", bCryptPasswordEncoder.encode("123"));

		Chamado c1 = new Chamado(null, Prioridade.MEDIA, Status.ANDAMENTO, "Chamado 01", "Primeiro chamado", tec1,cli1);
		Chamado c2 = new Chamado(null, Prioridade.ALTA,  Status.ANDAMENTO, "Chamado 04", "Primeiro chamado", tec2,cli2);
		Chamado c3 = new Chamado(null, Prioridade.BAIXA, Status.ABERTO   , "Chamado 05", "Primeiro chamado", tec1,cli3);
		Chamado c4 = new Chamado(null, Prioridade.MEDIA, Status.ENCERRADO, "Chamado 06", "Primeiro chamado", tec4,cli4);
		Chamado c5 = new Chamado(null, Prioridade.MEDIA, Status.ANDAMENTO, "Chamado 07", "Teste chamado 1", tec1, cli1);
		Chamado c6 = new Chamado(null, Prioridade.ALTA, Status.ABERTO, "Chamado 08", "Teste chamado 2", tec1, cli8);
		Chamado c7 = new Chamado(null, Prioridade.BAIXA, Status.ENCERRADO, "Chamado 09", "Teste chamado 3", tec2, cli9);
		Chamado c8 = new Chamado(null, Prioridade.ALTA, Status.ABERTO, "Chamado 10", "Teste chamado 4", tec3, cli1);
		Chamado c9 = new Chamado(null, Prioridade.MEDIA, Status.ANDAMENTO, "Chamado 11", "Teste chamado 5", tec2, cli4);
		Chamado c10 = new Chamado(null, Prioridade.BAIXA, Status.ENCERRADO, "Chamado 12", "Teste chamado 6", tec1, cli5);

		pessoaRepository.saveAll(Arrays.asList(tec1, tec2, tec3, tec4,tec5,tec6,tec7,tec8));
		clienteRepository.saveAll(Arrays.asList(cli1,cli2,cli3,cli4, cli5, cli6, cli7, cli8, cli9));
		chamadoRepository.saveAll(Arrays.asList(c1,c2,c3,c4,c5,c6,c7,c8,c9,c10));
	}

}
