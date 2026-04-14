package com.start.helpdesk.services;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import javax.validation.Valid;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;


import com.start.helpdesk.domain.Pessoa;
import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.dtos.TecnicoDTO;
import com.start.helpdesk.domain.dtos.TecnicoRankingDTO;
import com.start.helpdesk.repositories.ChamadoRepository;
import com.start.helpdesk.repositories.PessoaRepository;
import com.start.helpdesk.repositories.TecnicoRepository;
import com.start.helpdesk.services.exception.DataIntegrityViolationException;
import com.start.helpdesk.services.exception.ObjectnotFoundException;


@Service
public class TecnicoService {

	@Autowired
	private TecnicoRepository tecnicoRepository;
	@Autowired
	private PessoaRepository pessoaRepository;
	@Autowired
	private BCryptPasswordEncoder bCryptPasswordEncoder;
	@Autowired
	private ChamadoRepository chamadoRepository;
	@Autowired
	private AvatarGeneratorService avatarGeneratorService;

	/*METODO -> Buscando ID do tecnico no banco*/
	public Tecnico findById(Integer id) {
		Optional<Tecnico> tecnicoObj = tecnicoRepository.findById(id);
		return tecnicoObj.orElseThrow(() -> new ObjectnotFoundException("Objeto não econtrado! Id: " + id));
	}
	

	/*METODO -> Listando uma (LIST) de tecnico findAll*/
	public List<Tecnico> findAll() {
		return tecnicoRepository.findAll();
	}

	/*METODO -> Criando um tecnico NOVO (CREATE)*/
	public Tecnico create(TecnicoDTO objectDTO) {
		objectDTO.setId(null);/*Assegurando que o ID vai vir nulo,*/
		objectDTO.setSenha(bCryptPasswordEncoder.encode(objectDTO.getSenha()));/*setando senha com criptografica*/
		/* Gera avatar automático caso nenhuma foto seja enviada */
		if (objectDTO.getFotoPerfil() == null || objectDTO.getFotoPerfil().isBlank()) {
			objectDTO.setFotoPerfil(avatarGeneratorService.generateAvatarBase64(objectDTO.getNome()));
		}
		validationCpfEmail(objectDTO);
	    Tecnico newObject = new Tecnico(objectDTO);
		return tecnicoRepository.save(newObject);
	}
	
	/*METODO -> validação para UPDATE*/
	public Tecnico update(Integer id, @Valid TecnicoDTO objectDTO) {
		objectDTO.setId(id);
		Tecnico existingObject = findById(id);
		   /*Verificando se usuario editou uma nova  senha ou não.*/
		   if(!objectDTO.getSenha().equals(existingObject.getSenha())) {//se senha for diferente da senha salva, criar uma criptografia nova.
			   objectDTO.setSenha(bCryptPasswordEncoder.encode(objectDTO.getSenha()));
		   }
		/*
		 * Regras de foto no UPDATE:
		 *  - null ou vazio → não foi alterada → preserva a foto existente
		 *  - "data:..."    → nova foto enviada → usa diretamente
		 */
		if (objectDTO.getFotoPerfil() == null || objectDTO.getFotoPerfil().isBlank()) {
			objectDTO.setFotoPerfil(existingObject.getFotoPerfil());
		}
		validationCpfEmail(objectDTO);
		Tecnico updatedObject = new Tecnico(objectDTO);
		// Preserva a data de criação original — não deve ser alterada em atualizações
		updatedObject.setDataCriacao(existingObject.getDataCriacao());
		updatedObject.setDataHoraCriacao(existingObject.getDataHoraCriacao());
		return tecnicoRepository.save(updatedObject);
	}
	
	/*METODO -> (DELETE)*/
    public void delete(Integer id) {
    	Tecnico object = findById(id);
		if(object.getChamados().size() > 0){
			throw new DataIntegrityViolationException("Técnico possui ordens de serviço e não pode ser deletado!");
		}
		tecnicoRepository.deleteById(id);
	}

	/*METODO -> Fazendo comparação atraves do ID, se já existe CPF/E-mal já cadastrado*/
	private void validationCpfEmail(TecnicoDTO objectDTO) {
		Optional<Pessoa> object = pessoaRepository.findByCpf(objectDTO.getCpf());
			if(object.isPresent() && object.get().getId() != objectDTO.getId()) {
				throw new DataIntegrityViolationException("CPF já cadastrado no sistema!");
			}
		object = pessoaRepository.findByEmail(objectDTO.getEmail());
			if(object.isPresent() && object.get().getId() != objectDTO.getId()) {
			    throw new DataIntegrityViolationException("E-mail já cadatrado no sistema!");
		    }
	}

	public Tecnico findByEmail(String email) {
	    Optional<Tecnico> tecnico = tecnicoRepository.findByEmail(email);
	    return tecnico.orElseThrow(() -> new ObjectnotFoundException("Técnico não encontrado para o e-mail: " + email));
	}

	/**
	 * Retorna o ranking dos técnicos do mês atual, ordenado por desempenho.
	 */
	public List<TecnicoRankingDTO> getRankingTecnicosMes() {
        LocalDate now = LocalDate.now();
        int mes = now.getMonthValue();
        int ano = now.getYear();
        List<Tecnico> tecnicos = tecnicoRepository.findRankingTecnicosByChamadosResolvidos(mes, ano);
        List<TecnicoRankingDTO> ranking = new ArrayList<>();
        for (Tecnico t : tecnicos) {
            // Conta chamados resolvidos no mês
            long resolvidosMes = t.getChamados().stream()
                .filter(c -> c.getStatus() != null && c.getStatus().getCodigo() == 2 && c.getDataFechamento() != null &&
                    c.getDataFechamento().getMonthValue() == mes && c.getDataFechamento().getYear() == ano)
                .count();
            // Avaliação média fictícia (ajustar se houver campo real)
            double avaliacaoMedia = 0.0; // TODO: calcular se houver avaliações
            // Evolução dos últimos 6 meses
            List<TecnicoRankingDTO.EvolucaoDTO> evolucao = new ArrayList<>();
            for (int i = 5; i >= 0; i--) {
                YearMonth ym = YearMonth.now().minusMonths(i);
                int m = ym.getMonthValue();
                int y = ym.getYear();
                long resolvidos = t.getChamados().stream()
                    .filter(c -> c.getStatus() != null && c.getStatus().getCodigo() == 2 && c.getDataFechamento() != null &&
                        c.getDataFechamento().getMonthValue() == m && c.getDataFechamento().getYear() == y)
                    .count();
                evolucao.add(new TecnicoRankingDTO.EvolucaoDTO(ym.toString(), (int)resolvidos, 0.0));
            }
            ranking.add(new TecnicoRankingDTO(
                t.getId(),
                t.getNome(),
                t.getEmail(),
                (int)resolvidosMes,
                avaliacaoMedia,
                evolucao
            ));
        }
        return ranking;
    }

}
