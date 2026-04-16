package com.start.helpdesk.services;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import javax.validation.Valid;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.domain.Pessoa;
import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.dtos.ChamadoPendenteInfoDTO;
import com.start.helpdesk.domain.dtos.ReatribuicaoRequestDTO;
import com.start.helpdesk.domain.dtos.TecnicoDTO;
import com.start.helpdesk.domain.dtos.TecnicoRankingDTO;
import com.start.helpdesk.domain.enums.Status;
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

    public Tecnico findById(Integer id) {
        Optional<Tecnico> tecnicoObj = tecnicoRepository.findById(id);
        return tecnicoObj.orElseThrow(() -> new ObjectnotFoundException("Objeto nao econtrado! Id: " + id));
    }

    public List<Tecnico> findAll() {
        return tecnicoRepository.findAll();
    }

    public List<Tecnico> findAllAtivos() {
        return tecnicoRepository.findAll().stream()
                .filter(Tecnico::isAtivo)
                .collect(Collectors.toList());
    }

    public Tecnico create(TecnicoDTO objectDTO) {
        objectDTO.setId(null);
        objectDTO.setSenha(bCryptPasswordEncoder.encode(objectDTO.getSenha()));
        if (objectDTO.getFotoPerfil() == null || objectDTO.getFotoPerfil().isBlank()) {
            objectDTO.setFotoPerfil(avatarGeneratorService.generateAvatarBase64(objectDTO.getNome()));
        }
        validationCpfEmail(objectDTO);
        Tecnico newObject = new Tecnico(objectDTO);
        return tecnicoRepository.save(newObject);
    }

    public Tecnico update(Integer id, @Valid TecnicoDTO objectDTO) {
        objectDTO.setId(id);
        Tecnico existingObject = findById(id);
        if (!objectDTO.getSenha().equals(existingObject.getSenha())) {
            objectDTO.setSenha(bCryptPasswordEncoder.encode(objectDTO.getSenha()));
        }
        if (objectDTO.getFotoPerfil() == null || objectDTO.getFotoPerfil().isBlank()) {
            objectDTO.setFotoPerfil(existingObject.getFotoPerfil());
        }
        validationCpfEmail(objectDTO);
        Tecnico updatedObject = new Tecnico(objectDTO);
        updatedObject.setDataCriacao(existingObject.getDataCriacao());
        updatedObject.setDataHoraCriacao(existingObject.getDataHoraCriacao());
        return tecnicoRepository.save(updatedObject);
    }

    public void delete(Integer id) {
        Tecnico object = findById(id);
        if (!object.getChamados().isEmpty()) {
            throw new DataIntegrityViolationException("Tecnico possui ordens de servico e nao pode ser deletado!");
        }
        tecnicoRepository.deleteById(id);
    }

    public List<ChamadoPendenteInfoDTO> getChamadosPendentes(Integer tecnicoId) {
        findById(tecnicoId);
        List<Chamado> pendentes = chamadoRepository.findPendentesByTecnicoId(tecnicoId, Status.ENCERRADO);
        return pendentes.stream().map(ChamadoPendenteInfoDTO::new).collect(Collectors.toList());
    }

    @Transactional
    public void reatribuirChamados(Integer tecnicoId, @Valid ReatribuicaoRequestDTO request) {
        Tecnico tecnicoDestino = findById(request.getNovoTecnicoId());
        if (!tecnicoDestino.isAtivo()) {
            throw new DataIntegrityViolationException("O tecnico de destino esta inativo e nao pode receber chamados.");
        }
        if (tecnicoId.equals(request.getNovoTecnicoId())) {
            throw new DataIntegrityViolationException("O tecnico de destino deve ser diferente do tecnico a ser inativado.");
        }
        if (request.getChamadosIds() != null && !request.getChamadosIds().isEmpty()) {
            List<Chamado> pendentes = chamadoRepository.findPendentesByTecnicoId(tecnicoId, Status.ENCERRADO);
            for (Chamado chamado : pendentes) {
                if (request.getChamadosIds().contains(chamado.getId())) {
                    chamado.setTecnico(tecnicoDestino);
                    chamadoRepository.save(chamado);
                }
            }
        }
    }

    @Transactional
    public void reatribuirEInativar(Integer tecnicoId, @Valid ReatribuicaoRequestDTO request) {
        Tecnico tecnicoOrigem = findById(tecnicoId);
        Tecnico tecnicoDestino = findById(request.getNovoTecnicoId());
        if (!tecnicoDestino.isAtivo()) {
            throw new DataIntegrityViolationException("O tecnico de destino esta inativo e nao pode receber chamados.");
        }
        if (tecnicoId.equals(request.getNovoTecnicoId())) {
            throw new DataIntegrityViolationException("O tecnico de destino deve ser diferente do tecnico a ser inativado.");
        }
        if (request.getChamadosIds() != null && !request.getChamadosIds().isEmpty()) {
            List<Chamado> pendentes = chamadoRepository.findPendentesByTecnicoId(tecnicoId, Status.ENCERRADO);
            for (Chamado chamado : pendentes) {
                if (request.getChamadosIds().contains(chamado.getId())) {
                    chamado.setTecnico(tecnicoDestino);
                    chamadoRepository.save(chamado);
                }
            }
        }
        tecnicoOrigem.setAtivo(false);
        tecnicoRepository.save(tecnicoOrigem);
    }

    @Transactional
    public void inativarTecnico(Integer tecnicoId) {
        Tecnico tecnico = findById(tecnicoId);
        List<Chamado> pendentes = chamadoRepository.findPendentesByTecnicoId(tecnicoId, Status.ENCERRADO);
        if (!pendentes.isEmpty()) {
            throw new DataIntegrityViolationException("Tecnico possui chamados pendentes. Reatribua-os antes de inativar.");
        }
        tecnico.setAtivo(false);
        tecnicoRepository.save(tecnico);
    }

    @Transactional
    public void reativarTecnico(Integer tecnicoId) {
        Tecnico tecnico = findById(tecnicoId);
        tecnico.setAtivo(true);
        tecnicoRepository.save(tecnico);
    }

    private void validationCpfEmail(TecnicoDTO objectDTO) {
        Optional<Pessoa> object = pessoaRepository.findByCpf(objectDTO.getCpf());
        if (object.isPresent() && !object.get().getId().equals(objectDTO.getId())) {
            throw new DataIntegrityViolationException("CPF ja cadastrado no sistema!");
        }
        object = pessoaRepository.findByEmail(objectDTO.getEmail());
        if (object.isPresent() && !object.get().getId().equals(objectDTO.getId())) {
            throw new DataIntegrityViolationException("E-mail ja cadastrado no sistema!");
        }
    }

    public Tecnico findByEmail(String email) {
        Optional<Tecnico> tecnico = tecnicoRepository.findByEmail(email);
        return tecnico.orElseThrow(() -> new ObjectnotFoundException("Tecnico nao encontrado para o e-mail: " + email));
    }

    public List<TecnicoRankingDTO> getRankingTecnicosMes() {
        LocalDate now = LocalDate.now();
        int mes = now.getMonthValue();
        int ano = now.getYear();
        List<Tecnico> tecnicos = tecnicoRepository.findRankingTecnicosByChamadosResolvidos(mes, ano);
        List<TecnicoRankingDTO> ranking = new ArrayList<>();
        for (Tecnico t : tecnicos) {
            long resolvidosMes = t.getChamados().stream()
                .filter(c -> c.getStatus() != null && c.getStatus().getCodigo() == 2
                    && c.getDataFechamento() != null
                    && c.getDataFechamento().getMonthValue() == mes
                    && c.getDataFechamento().getYear() == ano)
                .count();
            double avaliacaoMedia = 0.0;
            List<TecnicoRankingDTO.EvolucaoDTO> evolucao = new ArrayList<>();
            for (int i = 5; i >= 0; i--) {
                YearMonth ym = YearMonth.now().minusMonths(i);
                int m = ym.getMonthValue();
                int y = ym.getYear();
                long resolvidos = t.getChamados().stream()
                    .filter(c -> c.getStatus() != null && c.getStatus().getCodigo() == 2
                        && c.getDataFechamento() != null
                        && c.getDataFechamento().getMonthValue() == m
                        && c.getDataFechamento().getYear() == y)
                    .count();
                evolucao.add(new TecnicoRankingDTO.EvolucaoDTO(ym.toString(), (int) resolvidos, 0.0));
            }
            ranking.add(new TecnicoRankingDTO(t.getId(), t.getNome(), t.getEmail(), (int) resolvidosMes, avaliacaoMedia, evolucao));
        }
        return ranking;
    }
}
