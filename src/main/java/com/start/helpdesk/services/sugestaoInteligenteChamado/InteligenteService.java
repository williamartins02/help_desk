package com.start.helpdesk.services.sugestaoInteligenteChamado;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.dtos.sugestaoInteligenteChamado.ChamadoSemelhantDTO;
import com.start.helpdesk.domain.dtos.sugestaoInteligenteChamado.SugestaoClassificacaoDTO;
import com.start.helpdesk.domain.dtos.sugestaoInteligenteChamado.SugestaoRequestDTO;
import com.start.helpdesk.domain.dtos.sugestaoInteligenteChamado.SugestaoTecnicoDTO;
import com.start.helpdesk.domain.enums.Classificacao;
import com.start.helpdesk.domain.enums.Status;
import com.start.helpdesk.repositories.ChamadoRepository;

/**
 * Camada de inteligência da Central de Chamados.
 * <p>
 * Todas as sugestões são baseadas exclusivamente em dados históricos reais;
 * nenhuma sugestão altera automaticamente os dados — a confirmação sempre
 * fica a cargo do usuário.
 * </p>
 */
@Service
public class InteligenteService {

    /** Palavras muito curtas ou sem significado semântico que devem ser ignoradas. */
    private static final java.util.Set<String> STOP_WORDS = new java.util.HashSet<>(Arrays.asList(
            "que", "com", "para", "nao", "não", "uma", "uns", "umas", "por",
            "seu", "sua", "seus", "suas", "este", "esta", "isso", "esse",
            "essa", "como", "mais", "mas", "quando", "onde", "quem"
    ));

    @Autowired
    private ChamadoRepository chamadoRepository;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Sugestão de técnico
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Analisa o histórico de chamados encerrados e sugere o técnico com mais
     * atendimentos similares (mesma classificação) e o melhor tempo médio.
     *
     * @return {@code null} quando não há histórico suficiente.
     */
    public SugestaoTecnicoDTO sugerirTecnico(SugestaoRequestDTO req) {
        List<Chamado> candidatos = obterCandidatos(req);
        if (candidatos.isEmpty()) return null;

        // Agrupa por técnico e filtra quem tem dataFechamento preenchida
        Map<Tecnico, List<Chamado>> porTecnico = candidatos.stream()
                .filter(c -> c.getTecnico() != null && c.getDataFechamento() != null)
                .collect(Collectors.groupingBy(Chamado::getTecnico));

        if (porTecnico.isEmpty()) return null;

        // Escolhe o técnico com maior número de chamados semelhantes resolvidos;
        // em caso de empate, prefere o de menor tempo médio.
        Map.Entry<Tecnico, List<Chamado>> melhor = porTecnico.entrySet().stream()
                .max(Comparator
                        .comparingInt((Map.Entry<Tecnico, List<Chamado>> e) -> e.getValue().size())
                        .thenComparing(e -> -calcularMediaMinutos(e.getValue())))
                .orElse(null);

        if (melhor == null) return null;

        long mediaMinutos = calcularMediaMinutos(melhor.getValue());

        SugestaoTecnicoDTO dto = new SugestaoTecnicoDTO();
        dto.setTecnicoId(melhor.getKey().getId());
        dto.setNomeTecnico(melhor.getKey().getNome());
        dto.setTotalChamadosSemelhantes(melhor.getValue().size());
        dto.setTempoMedioResolucao(formatarMinutos(mediaMinutos));
        return dto;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Sugestão de classificação
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Analisa palavras-chave do título/observações e sugere a classificação
     * mais frequente nos chamados encerrados que contêm termos semelhantes.
     *
     * @return {@code null} quando não há histórico suficiente.
     */
    public SugestaoClassificacaoDTO sugerirClassificacao(SugestaoRequestDTO req) {
        List<String> keywords = extrairKeywords(req.getTitulo(), req.getObservacoes());
        if (keywords.isEmpty()) return null;

        List<Chamado> matches = buscarPorKeywords(keywords, Status.ENCERRADO);
        if (matches.isEmpty()) return null;

        Map<Classificacao, Long> freqMap = matches.stream()
                .filter(c -> c.getClassificacao() != null)
                .collect(Collectors.groupingBy(Chamado::getClassificacao, Collectors.counting()));

        return freqMap.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(e -> {
                    SugestaoClassificacaoDTO dto = new SugestaoClassificacaoDTO();
                    dto.setClassificacaoCodigo(e.getKey().getCodigo());
                    dto.setClassificacaoNome(e.getKey().getDescricao());
                    dto.setTotalOcorrencias(e.getValue());
                    return dto;
                })
                .orElse(null);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Chamados semelhantes
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Retorna até 5 chamados encerrados semelhantes ao descritos no request,
     * priorizando correspondência por classificação e depois por palavras-chave.
     */
    public List<ChamadoSemelhantDTO> buscarSemelhantes(SugestaoRequestDTO req) {
        List<Chamado> resultados = new ArrayList<>();

        // Prioridade 1: mesma classificação
        if (req.getClassificacao() != null) {
            Classificacao cl = Classificacao.toEnum(req.getClassificacao());
            if (cl != null) {
                resultados.addAll(chamadoRepository.findByClassificacaoAndStatus(cl, Status.ENCERRADO));
            }
        }

        // Prioridade 2: palavras-chave no título/observações
        List<String> keywords = extrairKeywords(req.getTitulo(), req.getObservacoes());
        if (!keywords.isEmpty()) {
            resultados.addAll(buscarPorKeywords(keywords, Status.ENCERRADO));
        }

        // Deduplicar, ordenar pelos mais recentes e limitar a 5
        return resultados.stream()
                .distinct()
                .sorted(Comparator.comparing(Chamado::getDataFechamento,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(5)
                .map(this::toChamadoSemelhantDTO)
                .collect(Collectors.toList());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers privados
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Obtém chamados encerrados candidatos para análise.
     * Se houver classificação no request, filtra por ela; caso contrário,
     * usa keywords; como último recurso, retorna todos os encerrados.
     */
    private List<Chamado> obterCandidatos(SugestaoRequestDTO req) {
        if (req.getClassificacao() != null) {
            Classificacao cl = Classificacao.toEnum(req.getClassificacao());
            if (cl != null) {
                List<Chamado> porClasse = chamadoRepository.findByClassificacaoAndStatus(cl, Status.ENCERRADO);
                if (!porClasse.isEmpty()) return porClasse;
            }
        }
        // fallback: keywords
        List<String> keywords = extrairKeywords(req.getTitulo(), req.getObservacoes());
        if (!keywords.isEmpty()) {
            List<Chamado> porKw = buscarPorKeywords(keywords, Status.ENCERRADO);
            if (!porKw.isEmpty()) return porKw;
        }
        // último recurso: todos os encerrados
        return chamadoRepository.findByStatus(Status.ENCERRADO);
    }

    /**
     * Extrai palavras com significado semântico (> 3 letras, sem stop words),
     * deduplica e limita a 5 termos para não sobrecarregar a consulta.
     */
    private List<String> extrairKeywords(String titulo, String observacoes) {
        String texto = ((titulo != null ? titulo : "") + " " +
                (observacoes != null ? observacoes : ""))
                .toLowerCase()
                // Remove acentos de forma simples
                .replaceAll("[áàãâä]", "a").replaceAll("[éèêë]", "e")
                .replaceAll("[íìîï]", "i").replaceAll("[óòõôö]", "o")
                .replaceAll("[úùûü]", "u").replaceAll("[ç]", "c")
                .trim();

        if (texto.isBlank()) return List.of();

        return Arrays.stream(texto.split("[\\s\\p{Punct}]+"))
                .filter(w -> w.length() > 3 && !STOP_WORDS.contains(w))
                .distinct()
                .limit(5)
                .collect(Collectors.toList());
    }

    /** Busca chamados pelo status e qualquer uma das keywords fornecidas. */
    private List<Chamado> buscarPorKeywords(List<String> keywords, Status status) {
        return keywords.stream()
                .flatMap(kw -> chamadoRepository.findByStatusAndKeyword(status, kw).stream())
                .collect(Collectors.toList());
    }

    /** Calcula a média de minutos de resolução dos chamados fornecidos. */
    private long calcularMediaMinutos(List<Chamado> chamados) {
        return (long) chamados.stream()
                .filter(c -> c.getDataAbertura() != null && c.getDataFechamento() != null)
                .mapToLong(c -> Duration.between(c.getDataAbertura(), c.getDataFechamento()).toMinutes())
                .average()
                .orElse(0);
    }

    /** Formata minutos em string legível: "45 min" ou "2h 30min". */
    private String formatarMinutos(long minutos) {
        if (minutos <= 0) return "N/A";
        if (minutos < 60) return minutos + " min";
        long horas = minutos / 60;
        long resto = minutos % 60;
        return resto == 0 ? horas + "h" : horas + "h " + resto + "min";
    }

    /** Converte uma entidade Chamado para o DTO resumido de chamado semelhante. */
    private ChamadoSemelhantDTO toChamadoSemelhantDTO(Chamado c) {
        ChamadoSemelhantDTO dto = new ChamadoSemelhantDTO();
        dto.setId(c.getId());
        dto.setTitulo(c.getTitulo());
        dto.setNomeTecnico(c.getTecnico() != null ? c.getTecnico().getNome() : "—");
        dto.setStatus(c.getStatus() != null ? c.getStatus().name() : "—");
        dto.setClassificacao(c.getClassificacao() != null ? c.getClassificacao().getDescricao() : "—");
        if (c.getDataAbertura() != null && c.getDataFechamento() != null) {
            long min = Duration.between(c.getDataAbertura(), c.getDataFechamento()).toMinutes();
            dto.setTempoResolucao(formatarMinutos(min));
        } else {
            dto.setTempoResolucao("—");
        }
        return dto;
    }
}

