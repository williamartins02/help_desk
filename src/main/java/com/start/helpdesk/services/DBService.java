package com.start.helpdesk.services;


import java.util.Arrays;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.domain.Cliente;
import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.Telefone;
import com.start.helpdesk.domain.enums.Classificacao;
import com.start.helpdesk.domain.enums.Perfil;
import com.start.helpdesk.domain.enums.Prioridade;
import com.start.helpdesk.domain.enums.Status;
import com.start.helpdesk.domain.enums.TipoTelefone;
import com.start.helpdesk.repositories.ChamadoRepository;
import com.start.helpdesk.repositories.ClienteRepository;
import com.start.helpdesk.repositories.PessoaRepository;
import com.start.helpdesk.repositories.TelefoneRepository;



@Service
public class DBService {

	@Autowired // Injeção de dependencia
	private PessoaRepository pessoaRepository;
	@Autowired
	private ClienteRepository clienteRepository;
	@Autowired
	private ChamadoRepository chamadoRepository;
	@Autowired
	private TelefoneRepository telefoneRepository;
	@Autowired
	private BCryptPasswordEncoder bCryptPasswordEncoder;

	public void instanciaDB() {
		
		
		
		Tecnico  tec1 = new Tecnico(null, "William Fernandes Marquês", "412.468.591-22","will100@will100", bCryptPasswordEncoder.encode("123456"));
		tec1.addPerfil(Perfil.ADMIN);
		Telefone tel1 = new Telefone(null, "+55 (63)3674 7657" , TipoTelefone.CASA,     tec1);
		Telefone tel2 = new Telefone(null, "+55 (63)9 8259 1115", TipoTelefone.CELULAR,  tec1);
		Telefone tel3 = new Telefone(null, "+55 (63)9 4156 4399",  TipoTelefone.EMPRESA, tec1);
		
		Tecnico  tec2 = new Tecnico(null, "Isabelly Camila da Mata", "383.239.996-86","iisabellycamiladamata@gruposimoes.com.br",bCryptPasswordEncoder.encode( "EPsYWn32pD"));
		Telefone tel4 = new Telefone(null, "+55 (51)2567 9280",  TipoTelefone.CASA,    tec2);
		Telefone tel5 = new Telefone(null, "+55 (51)9 8559-0386" , TipoTelefone.CELULAR, tec2);
		Telefone tel6 = new Telefone(null, "+55 (51)9 6754-0987", TipoTelefone.EMPRESA, tec2);
		
		
		Tecnico tec3 = new Tecnico(null, "Henrique Yuri Márcio Silveira", "809.659.299-81","henriqueyurimarciosilveira@gruposimoescom.br", bCryptPasswordEncoder.encode("UIYGEsULUZ"));
		Telefone tel7 = new Telefone(null, "+55 (69)3767 0461",  TipoTelefone.CASA,    tec3);
		Telefone tel8 = new Telefone(null, "+55 (69)9 9216 5360", TipoTelefone.CELULAR, tec3);
		Telefone tel9 = new Telefone(null, "+55 (69)9 5216 4678", TipoTelefone.EMPRESA, tec3);
		
		
		Cliente cli1 = new Cliente(null, "Amanda Malu Luciana Rocha", "094.167.932-21", "amandamalulucianarocha-97@hidracom.com.br",bCryptPasswordEncoder.encode("wslsIEJge7"));
		Cliente cli2 = new Cliente(null, "Nair Nina Fogaça", "837.106.538-86", "nairninafogaca__nairninafogaca@eccofibra.com.br",bCryptPasswordEncoder.encode("DegWwgwEF7"));
		Cliente cli3 = new Cliente(null, "Stefany Gabriela Marina Oliveira", "491.837.982-69", "stefanygabrielamarinaoliveira@salera.com.br",bCryptPasswordEncoder.encode("BSUBKhRAId"));
		

		Chamado c1 = new Chamado(null, Prioridade.MEDIA, Status.ANDAMENTO, Classificacao.HARDWARE,  "Teclado quebrado", "Teclado multimídia da Dell - KB216", tec1,cli1);
		Chamado c2 = new Chamado(null, Prioridade.ALTA,  Status.ENCERRADO, Classificacao.HARDWARE,  "Mouse parou de funcionar.", "Mouse sem fio Óptico Wireless Mobile 1850 preto MFT U7Z-00008 Microsoft CX 1 UN", tec2,cli2);
		Chamado c3 = new Chamado(null, Prioridade.BAIXA, Status.ABERTO   , Classificacao.HARDWARE,  "Entrada HDMI parou de funcionar.", "Monitor Philips 18.5 Pol. LED HD Widescreen HDMI", tec1,cli3);
		Chamado c4 = new Chamado(null, Prioridade.BAIXA, Status.ABERTO   , Classificacao.REDES,     "Parou de funcionar algumas porta.", "Roteador dlink wifi AC1200 TR069 wan gigabit DIR841", tec1,cli3);
		

		pessoaRepository.saveAll(Arrays.asList(tec1, tec2, tec3));
		clienteRepository.saveAll(Arrays.asList(cli1,cli2,cli3));
		chamadoRepository.saveAll(Arrays.asList(c1,c2,c3,c4));
		telefoneRepository.saveAll(Arrays.asList(tel1, tel2, tel3, tel4, tel5, tel6, tel7, tel8, tel9));
		
	}

}
