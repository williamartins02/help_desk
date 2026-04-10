package com.start.helpdesk.eventsChamadoEncerrado.events;

import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.services.EncerrarChamadoEmail.ChamadoEmailService;
import com.start.helpdesk.services.ChamadoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class ChamadoEncerradoConsumer {
    @Autowired
    private ChamadoService chamadoService;
    @Autowired
    private ChamadoEmailService chamadoEmailService;

    // Método de processamento de chamado encerrado pode ser chamado manualmente ou por outro mecanismo
    public void processChamadoEncerrado(Integer chamadoId) {
        Chamado chamado = chamadoService.findById(chamadoId);
        chamadoEmailService.sendChamadoEncerradoEmail(chamado);
    }
}
