package com.start.helpdesk.domain.enums;

public enum TipoTelefone {
	
		CASA(0, "CASA"), EMPRESA(1, "EMPRESA"), CELULAR(2, "CELULAR");
		
		private Integer codigo;
		private String descricao;

		private TipoTelefone(Integer codigo, String descricao) {
			
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
		public static TipoTelefone toEnum(Integer cod) {
			if(cod == null) {
				return null;
			}
			// laço para comparar o codigo digitado, se for o cod certo retorna o cod
			for(TipoTelefone tp : TipoTelefone.values()) {
				if(cod.equals(tp.getCodigo())) {
					return tp;  
					
				}
			}
			throw new IllegalArgumentException("Perfil inválido");
		}
	
}

