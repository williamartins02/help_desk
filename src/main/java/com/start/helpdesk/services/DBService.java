
package com.start.helpdesk.services;

import java.util.Arrays;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.domain.Cliente;
import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.Telefone;
import com.start.helpdesk.domain.enums.Classificacao;
import com.start.helpdesk.domain.enums.Perfil;
import com.start.helpdesk.domain.enums.Prioridade;
import com.start.helpdesk.domain.enums.Status;
import com.start.helpdesk.domain.enums.TipoTelefone;
import com.start.helpdesk.repositories.ChamadoRepository;
import com.start.helpdesk.repositories.ClienteRepository;
import com.start.helpdesk.repositories.PessoaRepository;
import com.start.helpdesk.repositories.TelefoneRepository;

@Service
public class DBService {

    @Autowired
    private PessoaRepository pessoaRepository;
    @Autowired
    private ClienteRepository clienteRepository;
    @Autowired
    private ChamadoRepository chamadoRepository;
    @Autowired
    private TelefoneRepository telefoneRepository;
    @Autowired
    private BCryptPasswordEncoder bCryptPasswordEncoder;

    /**
     * Cria um Chamado já com prazoSla calculado pela prioridade
     */
    private Chamado novoChamado(Prioridade prioridade, Status status, Classificacao classificacao,
                                String titulo, String obs, Tecnico tec, Cliente cli) {
        Chamado c = new Chamado(null, prioridade, status, classificacao, titulo, obs, tec, cli);
        c.setPrazoSla(ChamadoService.calcularPrazoSla(prioridade, c.getDataAbertura()));
        return c;
    }

    public void instanciaDB() {

        Tecnico tec1 = new Tecnico(null, "William Marquês Ferreira", "412.468.591-22", "admin@admin.com", bCryptPasswordEncoder.encode("94607403xX@"));
        tec1.addPerfil(Perfil.ADMIN);
        tec1.addPerfil(Perfil.TECNICO);
        Telefone tel1 = new Telefone(null, "+55 (63)3674 7657", TipoTelefone.CASA, tec1);
        Telefone tel2 = new Telefone(null, "+55 (63)9 8259 1115", TipoTelefone.CELULAR, tec1);
        Telefone tel3 = new Telefone(null, "+55 (63)9 4156 4399", TipoTelefone.EMPRESA, tec1);

        Tecnico tec2 = new Tecnico(null, "Zulema Martins da silva Souza", "383.239.996-86", "zulemaMartinsSouza@hotmail.com", bCryptPasswordEncoder.encode("94607403xX@"));
        Telefone tel4 = new Telefone(null, "+55 (51)2567 9280", TipoTelefone.CASA, tec2);
        Telefone tel5 = new Telefone(null, "+55 (51)9 8559-0386", TipoTelefone.CELULAR, tec2);
        Telefone tel6 = new Telefone(null, "+55 (51)9 6754-0987", TipoTelefone.EMPRESA, tec2);

        Tecnico tec3 = new Tecnico(null, "Berlim Martins de Souza", "809.659.299-81", "berlimMartinsSouza@hotmail.com", bCryptPasswordEncoder.encode("94607403xX@"));
        Telefone tel7 = new Telefone(null, "+55 (69)3767 0461", TipoTelefone.CASA, tec3);
        Telefone tel8 = new Telefone(null, "+55 (69)9 9216 5360", TipoTelefone.CELULAR, tec3);
        Telefone tel9 = new Telefone(null, "+55 (69)9 5216 4678", TipoTelefone.EMPRESA, tec3);

        Cliente cli1 = new Cliente(null, "Silmara Martins", "094.167.932-21", "silmara_martins02", bCryptPasswordEncoder.encode("94607403xX@"));
        Cliente cli2 = new Cliente(null, "Maria julia Martins", "837.106.538-86", "mariaJuliaMartins2026@hotmail.com", bCryptPasswordEncoder.encode("94607403xX@"));
        Cliente cli3 = new Cliente(null, "Jhonas Jefferson", "491.837.982-69", "jjMartins@hotmail.com", bCryptPasswordEncoder.encode("94607403xX@"));

        Chamado c1 = novoChamado(Prioridade.MEDIA, Status.ANDAMENTO, Classificacao.HARDWARE, "Teclado quebrado", "Teclado Dell KB216 com teclas não responsivas (Enter e espaço). Equipamento em uso crítico no setor administrativo.", tec1, cli1);
        Chamado c2 = novoChamado(Prioridade.ALTA, Status.ENCERRADO, Classificacao.HARDWARE, "Mouse parou de funcionar", "Mouse Microsoft Wireless Mobile 1850 não responde. Testado em outras portas USB sem sucesso. Substituído por novo dispositivo.", tec2, cli2);
        Chamado c3 = novoChamado(Prioridade.BAIXA, Status.ABERTO, Classificacao.HARDWARE, "Entrada HDMI com falha", "Monitor Philips 18.5 não reconhece entrada HDMI. Testado com outro cabo e outro equipamento, possível defeito na porta.", tec1, cli3);
        Chamado c4 = novoChamado(Prioridade.BAIXA, Status.ABERTO, Classificacao.REDES, "Portas de rede inoperantes", "Roteador D-Link DIR-841 apresenta falha em algumas portas LAN. Dispositivos conectados não recebem IP.", tec1, cli3);
        Chamado c5 = novoChamado(Prioridade.ALTA, Status.ANDAMENTO, Classificacao.SOFTWARE, "Sistema não abre", "Erro ao iniciar o sistema ERP após atualização", tec2, cli1);
        Chamado c6 = novoChamado(Prioridade.MEDIA, Status.ABERTO, Classificacao.SOFTWARE, "Erro ao imprimir", "Impressora não responde aos comandos do Windows", tec1, cli2);
        Chamado c7 = novoChamado(Prioridade.ALTA, Status.ANDAMENTO, Classificacao.REDES, "Internet instável", "Quedas frequentes na conexão Wi-Fi no setor financeiro", tec2, cli3);
        Chamado c8 = novoChamado(Prioridade.BAIXA, Status.ENCERRADO, Classificacao.HARDWARE, "Troca de monitor", "Monitor antigo substituído por novo modelo Samsung 24 polegadas", tec1, cli1);
        Chamado c9 = novoChamado(Prioridade.MEDIA, Status.ABERTO, Classificacao.SOFTWARE, "Atualização pendente", "Sistema operacional precisa de atualização de segurança", tec2, cli2);
        Chamado c10 = novoChamado(Prioridade.ALTA, Status.ANDAMENTO, Classificacao.HARDWARE, "Notebook não liga", "Equipamento não apresenta sinal de energia ao pressionar botão power", tec1, cli3);
        Chamado c11 = novoChamado(Prioridade.BAIXA, Status.ABERTO, Classificacao.REDES, "Configuração de rede", "Novo computador precisa ser configurado na rede interna", tec2, cli1);
        Chamado c12 = novoChamado(Prioridade.MEDIA, Status.ENCERRADO, Classificacao.SOFTWARE, "Instalação de antivírus", "Antivírus corporativo instalado e configurado com sucesso", tec1, cli2);
        Chamado c13 = novoChamado(Prioridade.ALTA, Status.ABERTO, Classificacao.SOFTWARE, "Erro ao acessar sistema financeiro", "Usuário recebe erro de permissão ao acessar módulo financeiro", tec3, cli1);
        Chamado c14 = novoChamado(Prioridade.MEDIA, Status.ANDAMENTO, Classificacao.HARDWARE, "Tecla presa no notebook", "Teclado apresenta falha na tecla Enter", tec1, cli2);
        Chamado c15 = novoChamado(Prioridade.BAIXA, Status.ENCERRADO, Classificacao.REDES, "Liberação de acesso Wi-Fi", "Acesso liberado para visitante na rede corporativa", tec2, cli3);
        Chamado c16 = novoChamado(Prioridade.ALTA, Status.ANDAMENTO, Classificacao.SOFTWARE, "Sistema lento", "Sistema ERP com lentidão ao carregar relatórios", tec3, cli2);
        Chamado c17 = novoChamado(Prioridade.MEDIA, Status.ABERTO, Classificacao.HARDWARE, "HD com ruído", "Possível falha no disco rígido, emitindo barulho incomum", tec1, cli3);
        Chamado c18 = novoChamado(Prioridade.ALTA, Status.ANDAMENTO, Classificacao.REDES, "Sem acesso à internet", "Setor comercial sem acesso à internet desde manhã", tec2, cli1);
        Chamado c19 = novoChamado(Prioridade.BAIXA, Status.ENCERRADO, Classificacao.SOFTWARE, "Instalação de pacote Office", "Pacote Office instalado e ativado com sucesso", tec3, cli3);
        Chamado c20 = novoChamado(Prioridade.MEDIA, Status.ABERTO, Classificacao.HARDWARE, "Problema na fonte", "Computador desliga sozinho após alguns minutos de uso", tec1, cli1);

        pessoaRepository.saveAll(Arrays.asList(tec1, tec2, tec3));
        clienteRepository.saveAll(Arrays.asList(cli1, cli2, cli3));
        chamadoRepository.saveAll(Arrays.asList(
                c1, c2, c3, c4, c5, c6, c7, c8, c9, c10,
                c11, c12, c13, c14, c15, c16, c17, c18, c19, c20
        ));
        telefoneRepository.saveAll(Arrays.asList(tel1, tel2, tel3, tel4, tel5, tel6, tel7, tel8, tel9));
    }
}