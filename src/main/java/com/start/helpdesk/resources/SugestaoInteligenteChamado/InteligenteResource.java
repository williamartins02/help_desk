package com.start.helpdesk.resources.SugestaoInteligenteChamado;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.start.helpdesk.domain.dtos.sugestaoInteligenteChamado.ChamadoSemelhantDTO;
import com.start.helpdesk.domain.dtos.sugestaoInteligenteChamado.SugestaoClassificacaoDTO;
import com.start.helpdesk.domain.dtos.sugestaoInteligenteChamado.SugestaoRequestDTO;
import com.start.helpdesk.domain.dtos.sugestaoInteligenteChamado.SugestaoTecnicoDTO;
import com.start.helpdesk.services.sugestaoInteligenteChamado.InteligenteService;

/**
 * Endpoints da camada de inteligência da Central de Chamados.
 * <p>
 * Todos os endpoints são somente-leitura (POST apenas para receber o payload
 * de forma segura) e NÃO alteram nenhum dado — retornam apenas sugestões.
 * </p>
 *
 * <pre>
 *   POST /inteligente/sugerir-tecnico         → SugestaoTecnicoDTO
 *   POST /inteligente/sugerir-classificacao   → SugestaoClassificacaoDTO
 *   POST /inteligente/chamados-semelhantes    → List&lt;ChamadoSemelhantDTO&gt;
 * </pre>
 */
@RestController
@RequestMapping("/inteligente")
public class InteligenteResource {

    @Autowired
    private InteligenteService service;

    /**
     * Sugere o técnico mais adequado com base no histórico de chamados similares.
     * Retorna 204 No Content quando não há dados históricos suficientes.
     */
    @PostMapping("/sugerir-tecnico")
    public ResponseEntity<SugestaoTecnicoDTO> sugerirTecnico(@RequestBody SugestaoRequestDTO req) {
        SugestaoTecnicoDTO sugestao = service.sugerirTecnico(req);
        return sugestao != null
                ? ResponseEntity.ok(sugestao)
                : ResponseEntity.noContent().build();
    }

    /**
     * Sugere a categoria/classificação mais provável com base nas palavras-chave
     * do título e observações preenchidas pelo usuário.
     * Retorna 204 No Content quando não há dados históricos suficientes.
     */
    @PostMapping("/sugerir-classificacao")
    public ResponseEntity<SugestaoClassificacaoDTO> sugerirClassificacao(@RequestBody SugestaoRequestDTO req) {
        SugestaoClassificacaoDTO sugestao = service.sugerirClassificacao(req);
        return sugestao != null
                ? ResponseEntity.ok(sugestao)
                : ResponseEntity.noContent().build();
    }

    /**
     * Retorna até 5 chamados encerrados semelhantes ao que está sendo criado,
     * para auxiliar o técnico na resolução mais rápida.
     */
    @PostMapping("/chamados-semelhantes")
    public ResponseEntity<List<ChamadoSemelhantDTO>> chamadosSemelhantes(@RequestBody SugestaoRequestDTO req) {
        List<ChamadoSemelhantDTO> lista = service.buscarSemelhantes(req);
        return ResponseEntity.ok(lista);
    }
}

