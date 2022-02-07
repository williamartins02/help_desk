package com.start.helpdesk.resources;


import java.text.SimpleDateFormat;
import java.util.HashMap;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;

import org.apache.tomcat.util.codec.binary.Base64;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.start.helpdesk.domain.UserReport;
import com.start.helpdesk.services.RelatoriosService;

@RestController
@RequestMapping(value = "/relatorios")
public class RelatorioResource {

	
	@Autowired
	private RelatoriosService relatoriosService;

	/*ENDPOINT para retornar um relatorio*/
	@GetMapping(value="/{relatorio}", produces = "application/text")
      public ResponseEntity<String> downloadRelatorio(HttpServletRequest request) throws Exception{
    	  byte[] pdf = relatoriosService.gerarRelatorio("relatorio-chamado", new HashMap<>(), request.getServletContext());
    	  
    	  String base64Pdf = "data:application/pdf;base64," + Base64.encodeBase64String(pdf);
    	  
    	  return new ResponseEntity<String>(base64Pdf, HttpStatus.OK);
	}
	
	/*ENDPOINT para retornar um relatorio ao Digitar parametros.*/
	@PostMapping(value="/{relatorio}", produces = "application/text")
    public ResponseEntity<String> downloadRelatorioParam(HttpServletRequest request, @RequestBody UserReport userReport) throws Exception{
		
		SimpleDateFormat dateFormat = new SimpleDateFormat("dd/MM/yyyy");
		SimpleDateFormat dateFormatParam = new SimpleDateFormat("yyy-MM-dd");
		
		String dataInicio = dateFormatParam.format(dateFormat.parse(userReport.getDataInicio()));
		String dataFim =    dateFormatParam.format(dateFormat.parse(userReport.getDataFim()));
		
		Map<String, Object> params = new HashMap<String, Object>();
		params.put("DATA_INICIO", dataInicio);
		params.put("DATA_FIM", dataFim);
		
	  	byte[] pdf = relatoriosService.gerarRelatorio("relatorio-chamado", params, request.getServletContext());
	  	  
	  	String base64Pdf = "data:application/pdf;base64," + Base64.encodeBase64String(pdf);
	  	  
	  	return new ResponseEntity<String>(base64Pdf, HttpStatus.OK);
	}		
}
