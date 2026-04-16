package com.start.helpdesk.domain.dtos;
import java.io.Serializable;
import java.util.List;
import javax.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
@Getter
@Setter
public class ReatribuicaoRequestDTO implements Serializable {
    private static final long serialVersionUID = 1L;
    @NotNull(message = "O tecnico de destino e obrigatorio")
    private Integer novoTecnicoId;
    private List<Integer> chamadosIds;
}
