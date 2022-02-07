package com.start.helpdesk.domain.dtos;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

@Setter @Getter
@EqualsAndHashCode

public class CredenciaisDTO {
	
	private String email;
	private String senha;
	
}
