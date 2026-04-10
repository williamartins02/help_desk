package com.start.helpdesk.eventsChamadoEncerrado;

import org.springframework.context.ApplicationEvent;

public class ChamadoEncerradoEvent extends ApplicationEvent {
    private final Integer chamadoId;

    public ChamadoEncerradoEvent(Object source, Integer chamadoId) {
        super(source);
        this.chamadoId = chamadoId;
    }

    public Integer getChamadoId() {
        return chamadoId;
    }
}
