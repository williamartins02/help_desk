package com.start.helpdesk.eventsChamadoEncerrado;

import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.services.EncerrarChamadoEmail.ChamadoEmailService;
import com.start.helpdesk.services.ChamadoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
public class ChamadoEncerradoListener {
    @Autowired
    private ChamadoService chamadoService;
    @Autowired
    private ChamadoEmailService chamadoEmailService;

    @Async
    @EventListener
    public void handleChamadoEncerrado(ChamadoEncerradoEvent event) {
        Chamado chamado = chamadoService.findById(event.getChamadoId());
        chamadoEmailService.sendChamadoEncerradoEmail(chamado);
    }
}
