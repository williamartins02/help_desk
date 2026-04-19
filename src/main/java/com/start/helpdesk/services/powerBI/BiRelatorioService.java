package com.start.helpdesk.services.powerBI;
import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.domain.dtos.powerBI.BiDashboardDTO;
import com.start.helpdesk.domain.dtos.powerBI.ChamadoResumoDTO;
import com.start.helpdesk.domain.dtos.powerBI.EvolucaoDiaDTO;
import com.start.helpdesk.domain.dtos.powerBI.TecnicoMetricaDTO;
import com.start.helpdesk.domain.enums.Classificacao;
import com.start.helpdesk.domain.enums.Prioridade;
import com.start.helpdesk.domain.enums.Status;
import com.start.helpdesk.repositories.ChamadoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;
@Service
public class BiRelatorioService {
    @Autowired
    private ChamadoRepository chamadoRepository;
    private static final DateTimeFormatter FMT_DIA = DateTimeFormatter.ofPattern("dd/MM");
    public BiDashboardDTO calcular(LocalDateTime inicio, LocalDateTime fim, Integer tecnicoId, Status status, Prioridade prioridade) {
        List<Chamado> chamados = chamadoRepository.findComFiltrosBi(inicio, fim, tecnicoId, status, prioridade);
        BiDashboardDTO dto = new BiDashboardDTO();
        dto.setTotalChamados(chamados.size());
        dto.setTotalAbertos(chamados.stream().filter(c -> c.getStatus() == Status.ABERTO).count());
        dto.setTotalAndamento(chamados.stream().filter(c -> c.getStatus() == Status.ANDAMENTO).count());
        dto.setTotalEncerrados(chamados.stream().filter(c -> c.getStatus() == Status.ENCERRADO).count());
        dto.setTotalCriticos(chamados.stream().filter(c -> c.getPrioridade() == Prioridade.CRITICA && c.getStatus() != Status.ENCERRADO).count());
        List<Chamado> encerrados = chamados.stream().filter(c -> c.getStatus() == Status.ENCERRADO && c.getDataAbertura() != null && c.getDataFechamento() != null).collect(Collectors.toList());
        if (!encerrados.isEmpty()) {
            double mediaMins = encerrados.stream().mapToLong(c -> ChronoUnit.MINUTES.between(c.getDataAbertura(), c.getDataFechamento())).average().orElse(0);
            dto.setTempoMedioResolucaoMins(Math.round(mediaMins * 10.0) / 10.0);
            long dp = encerrados.stream().filter(c -> c.getPrazoSla() != null && !c.getDataFechamento().isAfter(c.getPrazoSla())).count();
            dto.setSlaPercent(Math.round(dp * 1000.0 / encerrados.size()) / 10.0);
        }
        Map<String, Long> porCategoria = new LinkedHashMap<>();
        for (Classificacao cl : Classificacao.values()) { porCategoria.put(cl.getDescricao(), chamados.stream().filter(c -> c.getClassificacao() == cl).count()); }
        dto.setPorCategoria(porCategoria);
        Map<String, Long> porStatus = new LinkedHashMap<>();
        porStatus.put("ABERTO", dto.getTotalAbertos()); porStatus.put("ANDAMENTO", dto.getTotalAndamento()); porStatus.put("ENCERRADO", dto.getTotalEncerrados());
        dto.setPorStatus(porStatus);
        Map<String, Long> porPrioridade = new LinkedHashMap<>();
        for (Prioridade p : Prioridade.values()) { porPrioridade.put(p.getDescricao(), chamados.stream().filter(c -> c.getPrioridade() == p).count()); }
        dto.setPorPrioridade(porPrioridade);
        Map<Integer, List<Chamado>> porTecnico = chamados.stream().filter(c -> c.getTecnico() != null).collect(Collectors.groupingBy(c -> c.getTecnico().getId()));
        List<TecnicoMetricaDTO> ranking = new ArrayList<>();
        porTecnico.forEach((tId, lista) -> {
            String nome = lista.get(0).getTecnico().getNome();
            List<Chamado> res = lista.stream().filter(c -> c.getStatus() == Status.ENCERRADO && c.getDataAbertura() != null && c.getDataFechamento() != null).collect(Collectors.toList());
            double tmrMins = res.isEmpty() ? 0 : res.stream().mapToLong(c -> ChronoUnit.MINUTES.between(c.getDataAbertura(), c.getDataFechamento())).average().orElse(0);
            long dpp = res.stream().filter(c -> c.getPrazoSla() != null && !c.getDataFechamento().isAfter(c.getPrazoSla())).count();
            double slaPct = res.isEmpty() ? 0 : Math.round(dpp * 1000.0 / res.size()) / 10.0;
            ranking.add(new TecnicoMetricaDTO(tId, nome, res.size(), Math.round(tmrMins * 10.0) / 10.0, slaPct));
        });
        ranking.sort(Comparator.comparingInt(TecnicoMetricaDTO::getTotalResolvidos).reversed());
        for (int i = 0; i < ranking.size(); i++) { ranking.get(i).setPosicao(i + 1); }
        dto.setTecnicosRanking(ranking);
        List<EvolucaoDiaDTO> evolucao = new ArrayList<>();
        LocalDate diaAtual = inicio.toLocalDate(); LocalDate diaFim = fim.toLocalDate();
        while (!diaAtual.isAfter(diaFim)) {
            final LocalDate dia = diaAtual;
            long ab = chamados.stream().filter(c -> c.getDataAbertura() != null && c.getDataAbertura().toLocalDate().equals(dia) && c.getStatus() == Status.ABERTO).count();
            long en = chamados.stream().filter(c -> c.getDataAbertura() != null && c.getDataAbertura().toLocalDate().equals(dia) && c.getStatus() == Status.ENCERRADO).count();
            long an = chamados.stream().filter(c -> c.getDataAbertura() != null && c.getDataAbertura().toLocalDate().equals(dia) && c.getStatus() == Status.ANDAMENTO).count();
            evolucao.add(new EvolucaoDiaDTO(dia.format(FMT_DIA), ab, en, an));
            diaAtual = diaAtual.plusDays(1);
        }
        dto.setEvolucao(evolucao);
        List<String> alertas = new ArrayList<>();
        if (dto.getTotalAbertos() >= 10) alertas.add("Alto volume em ABERTO: " + dto.getTotalAbertos() + " chamados parados");
        if (dto.getTotalAndamento() >= 15) alertas.add("Alto volume em ANDAMENTO: " + dto.getTotalAndamento() + " chamados");
        if (dto.getTotalCriticos() > 0) alertas.add("CRITICO: " + dto.getTotalCriticos() + " chamado(s) sem resolucao");
        if (dto.getSlaPercent() > 0 && dto.getSlaPercent() < 70) alertas.add("SLA abaixo de 70%: " + dto.getSlaPercent() + "%");
        dto.setAlertasGargalo(alertas);

        // ── Lista de chamados individuais ─────────────────────────────────────────
        List<ChamadoResumoDTO> chamadosResumo = new ArrayList<>();
        for (Chamado c : chamados) {
            String tecNome  = c.getTecnico()  != null ? c.getTecnico().getNome()  : "-";
            String cliNome  = c.getCliente()  != null ? c.getCliente().getNome()  : "-";
            String statusStr = c.getStatus()   != null ? c.getStatus().getDescricao()   : "-";
            String prioStr   = c.getPrioridade() != null ? c.getPrioridade().getDescricao() : "-";

            // tempo de resolucao
            String tempo = "-";
            if (c.getStatus() == Status.ENCERRADO && c.getDataAbertura() != null && c.getDataFechamento() != null) {
                long mins = ChronoUnit.MINUTES.between(c.getDataAbertura(), c.getDataFechamento());
                if (mins < 60) tempo = mins + " min";
                else { long h = mins / 60; long m = mins % 60; tempo = h + "h" + (m > 0 ? " " + m + "min" : ""); }
            }

            // status SLA
            String statusSla = "-";
            if (c.getPrazoSla() != null) {
                LocalDateTime ref = (c.getStatus() == Status.ENCERRADO && c.getDataFechamento() != null)
                        ? c.getDataFechamento() : LocalDateTime.now();
                statusSla = !ref.isAfter(c.getPrazoSla()) ? "NO_PRAZO" : "ATRASADO";
            }

            chamadosResumo.add(new ChamadoResumoDTO(c.getId(), c.getTitulo(), tecNome, cliNome,
                    statusStr, prioStr, tempo, statusSla));
        }
        dto.setChamados(chamadosResumo);

        return dto;
    }
}
