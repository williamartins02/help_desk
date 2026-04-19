package com.start.helpdesk.resources.powerBI;
import com.start.helpdesk.domain.dtos.powerBI.BiDashboardDTO;
import com.start.helpdesk.domain.enums.Prioridade;
import com.start.helpdesk.domain.enums.Status;
import com.start.helpdesk.services.powerBI.BiRelatorioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
@RestController
@RequestMapping("/bi")
public class BiRelatorioResource {
    @Autowired
    private BiRelatorioService biRelatorioService;
    @GetMapping("/dashboard")
    public ResponseEntity<BiDashboardDTO> getDashboard(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            @RequestParam(required = false) Integer tecnicoId,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) Integer prioridade) {
        if (dataInicio == null) dataInicio = LocalDate.now().minusDays(30);
        if (dataFim    == null) dataFim    = LocalDate.now();
        LocalDateTime inicio = dataInicio.atStartOfDay();
        LocalDateTime fim    = dataFim.atTime(LocalTime.MAX);
        Status st = status != null ? Status.toEnum(status) : null;
        Prioridade pr = prioridade != null ? Prioridade.toEnum(prioridade) : null;
        return ResponseEntity.ok(biRelatorioService.calcular(inicio, fim, tecnicoId, st, pr));
    }
}
