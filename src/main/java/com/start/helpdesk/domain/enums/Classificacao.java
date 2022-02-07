package com.start.helpdesk.domain.enums;

import lombok.Getter;


@Getter
public enum Classificacao {
	
	HARDWARE(0, "HARDWARE"), SOFTWARE(1, "SOFTWARE"), REDES(2, "REDES"), BANCO(3, "BANCO");
	
	private Integer codigo;
	private String descricao;
	
	private Classificacao(Integer codigo, String descricao) {
		
		this.codigo = codigo;
		this.descricao = descricao;
		
	}
	
	public static Classificacao toEnum(Integer cod) {
		if(cod == null) {
			return null;
		}
		for(Classificacao cl: Classificacao.values()) {
			if(cod.equals(cl.getCodigo())) {
				return cl;
			}
		}
		throw new IllegalArgumentException("Perfil inválido");
	}

}
