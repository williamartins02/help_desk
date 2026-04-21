package com.start.helpdesk.resources.exceptions;

import javax.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import com.start.helpdesk.services.exception.DataIntegrityViolationException;
import com.start.helpdesk.services.exception.ObjectnotFoundException;
import com.start.helpdesk.services.exception.UnauthorizedException;


/*tratamento de Exceções personalizada..*/

@ControllerAdvice
public class ResourceExceptionHandler {
	
		/*Exceção para objeto "ID" não encontrado  "ObjectnotFoundException"*/
	
		@ExceptionHandler(ObjectnotFoundException.class)
		public ResponseEntity<StandarError> objectnotFoundException(ObjectnotFoundException ex, 
				HttpServletRequest request){
			
			StandarError error = new StandarError(System.currentTimeMillis(), HttpStatus.NOT_FOUND.value(), 
					"object Not Foud", ex.getMessage(), request.getRequestURI());
			
			return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
			
		}
	
		/*Exceção para CPF não encontrado  "DataIntegrityViolationException"*/
		
		@ExceptionHandler(DataIntegrityViolationException.class)
		public ResponseEntity<StandarError> dataIntegrityViolationException(DataIntegrityViolationException ex, 
				HttpServletRequest request){
			
			StandarError error = new StandarError(System.currentTimeMillis(), HttpStatus.BAD_REQUEST.value(), 
					"Violação de dados", ex.getMessage(), request.getRequestURI());
			
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);	
		}
		
			/*Exceção para tratar campo obrigatorio "Nome, CPF, E-mail e senha"*/
		
		@ExceptionHandler(MethodArgumentNotValidException.class)
		public ResponseEntity<StandarError> validationErrors(MethodArgumentNotValidException ex,
				HttpServletRequest request){

			ValidationError errors = new ValidationError(System.currentTimeMillis(), HttpStatus.BAD_REQUEST.value(),
					"Validation error", "Erro na validação dos campos", request.getRequestURI());
			for(FieldError err : ex.getBindingResult().getFieldErrors()) {
				errors.addError(err.getField(), err.getDefaultMessage());
			}
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errors);
		}

		/** Exceção para acesso não autorizado (perfil insuficiente / token inválido) */
		@ExceptionHandler(UnauthorizedException.class)
		public ResponseEntity<StandarError> unauthorizedException(UnauthorizedException ex,
				HttpServletRequest request) {

			StandarError error = new StandarError(System.currentTimeMillis(), HttpStatus.FORBIDDEN.value(),
					"Acesso negado", ex.getMessage(), request.getRequestURI());
			return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error);
		}

}
