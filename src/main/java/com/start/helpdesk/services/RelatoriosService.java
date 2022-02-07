package com.start.helpdesk.services;

import java.io.File;
import java.io.Serializable;
import java.sql.Connection;
import java.util.Map;

import javax.servlet.ServletContext;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import net.sf.jasperreports.engine.JasperExportManager;
import net.sf.jasperreports.engine.JasperFillManager;
import net.sf.jasperreports.engine.JasperPrint;




/*Service para gerador de relatorios em forma de Bytes.*/
@Service
public class RelatoriosService implements Serializable {
	private static final long serialVersionUID = 1L;
	
	@Autowired
	private JdbcTemplate jdbcTemplate;
	
	public byte[] gerarRelatorio (String nomeRelatorio, Map<String,Object> params, ServletContext servletContext) throws Exception {
		
		/*Obter a conexão com o banco de dados*/
		Connection connection = jdbcTemplate.getDataSource().getConnection();
		
		/*Carregar o caminho do arquivo Jasper*/
		String caminhoJasper = servletContext.getRealPath("relatorios")
				+ File.separator + nomeRelatorio + ".jasper";
		
		/*Gerar o relatorio com os dados e conexão*/
		JasperPrint print = JasperFillManager.fillReport(caminhoJasper, params, connection);
		
		/*Exporta para byte o PDF para fazer o Download*/
		byte [] retorno = JasperExportManager.exportReportToPdf(print);
		
		connection.close();
		
		return retorno ;
		
	}

}
