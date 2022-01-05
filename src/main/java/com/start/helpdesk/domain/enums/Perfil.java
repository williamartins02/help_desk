package com.start.helpdesk.domain.enums;

//Numerador "enum" para perfils

public enum Perfil {

	ADMIN(0, "ROLE_ADMIN"), CLIENTE(1, "ROLE_CLIENTE"), TECNICO(2, "ROLE_TECNICO");
	
	private Integer codigo;
	private String descricao;
	
	private Perfil(Integer codigo, String descricao) {
		
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
	public static Perfil toEnum(Integer cod) {
		if(cod == null) {
			return null;
		}
		// laço para comparar o codigo digitado, se for o cod certo retorna o cod
		for(Perfil p : Perfil.values()) {
			if(cod.equals(p.getCodigo())) {
				return p;  
				
			}
		}
		throw new IllegalArgumentException("Perfil inválido");
	}
}
