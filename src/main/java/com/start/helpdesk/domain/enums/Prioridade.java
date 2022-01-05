package com.start.helpdesk.domain.enums;

//Numerador "enum" para perfils

public enum Prioridade {

	BAIXA(0, "BAIXA"), MEDIA(1, "MEDIA"), ALTA(2, "ALTA");
	
	private Integer codigo;
	private String descricao;
	
	private Prioridade(Integer codigo, String descricao) {
		
		this.codigo = codigo;
		this.descricao = descricao;
	}
	
	public Integer getCodigo() {
		return codigo;
	}
	public String getDescricao() {
		return descricao;
	}
	
	//se o codigo digitado for igual a nulo, retorna nulo
	public static Prioridade toEnum(Integer cod) {
		if(cod == null) {
			return null;
		}
		// laço para comparar o codigo digitado, se for o cod certo retorna o cod
		for(Prioridade p : Prioridade.values()) {
			if(cod.equals(p.getCodigo())) {
				return p;  
				
			}
		}
		throw new IllegalArgumentException("Prioridade inválida");
	}
}
