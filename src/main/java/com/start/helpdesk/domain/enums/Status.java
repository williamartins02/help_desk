package com.start.helpdesk.domain.enums;

//Numerador "enum" para perfils

public enum Status {

	ABERTO(0, "ABERTO"), ANDAMENTO(1, "ANDAMENTO"), ENCERRADO(2, "ENCERRADO");
	
	private Integer codigo;
	private String descricao;
	
	private Status(Integer codigo, String descricao) {
		
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
	public static Status toEnum(Integer cod) {
		if(cod == null) {
			return null;
		}
		// laço para comparar o codigo digitado, se for o cod certo retorna o cod
		for(Status p : Status.values()) {
			if(cod.equals(p.getCodigo())) {
				return p;  
				
			}
		}
		throw new IllegalArgumentException("Status inválido");
	}
}
