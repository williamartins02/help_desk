package com.start.helpdesk.services.chatService;

import com.start.helpdesk.domain.chat.Mensagem;
import com.start.helpdesk.domain.chat.MensagemPendente;
import com.start.helpdesk.repositories.chatRepository.MensagemPendenteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class MensagemPendenteService {

    @Autowired
    private MensagemPendenteRepository repository;

    /**
     * Persiste uma mensagem para entrega futura ao destinatário offline.
     */
    @Transactional
    public void salvar(Mensagem mensagem, String destinatario) {
        MensagemPendente p = new MensagemPendente();
        p.setRemetente(mensagem.getUsername());
        p.setDestinatario(destinatario);
        p.setTexto(mensagem.getTexto());
        p.setSala(mensagem.getSala());
        p.setTimestamp(mensagem.getTimestamp());
        p.setColor(mensagem.getColor() != null ? mensagem.getColor() : "");
        repository.save(p);
    }

    /**
     * Busca todas as mensagens pendentes de um destinatário, marca como entregues
     * e retorna a lista no formato Mensagem (compatível com o frontend).
     */
    @Transactional
    public List<Mensagem> buscarEMarcarComoEntregues(String destinatario) {
        List<MensagemPendente> pendentes =
                repository.findByDestinatarioAndEntregueOrderByTimestampAsc(destinatario, false);

        // Marca como entregue
        pendentes.forEach(p -> p.setEntregue(true));
        repository.saveAll(pendentes);

        // Converte para Mensagem (POJO reutilizado pelo frontend)
        return pendentes.stream().map(p -> {
            Mensagem m = new Mensagem();
            m.setUsername(p.getRemetente());
            m.setDestinatario(p.getDestinatario());
            m.setTexto(p.getTexto());
            m.setSala(p.getSala());
            m.setTimestamp(p.getTimestamp());
            m.setColor(p.getColor());
            m.setType("MENSAGEM");
            m.setStatus("delivered");
            return m;
        }).collect(Collectors.toList());
    }
}

