package com.start.helpdesk.domain;


import lombok.Getter;
import lombok.Setter;


public class UserReport {

@Setter @Getter private String  dataInicio;
@Setter @Getter private String  dataFim;
/** ID do técnico para filtrar o relatório. Null = todos os técnicos. */
@Setter @Getter private Integer tecnicoId;

}
