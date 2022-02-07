package com.start.helpdesk.services;

import java.util.List;
import java.util.Optional;

import javax.validation.Valid;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import com.start.helpdesk.domain.Cliente;
import com.start.helpdesk.domain.Pessoa;
import com.start.helpdesk.domain.dtos.ClienteDTO;
import com.start.helpdesk.repositories.ClienteRepository;
import com.start.helpdesk.repositories.PessoaRepository;
import com.start.helpdesk.services.exception.DataIntegrityViolationException;
import com.start.helpdesk.services.exception.ObjectnotFoundException;

@Service
public class ClienteService {
	
	@Autowired
	private ClienteRepository clienteRepository;
	@Autowired
	private PessoaRepository pessoaRepository;
	@Autowired
	private BCryptPasswordEncoder bCryptPasswordEncoder;
	
	public Cliente findById(Integer id) {
		Optional<Cliente> clienteObj = clienteRepository.findById(id);
		return clienteObj.orElseThrow(() -> new ObjectnotFoundException("Objeto não econtrado! id: " + id));
	}
	
	public List<Cliente> findAll(){
		return clienteRepository.findAll();
	}
	
	public Cliente create(ClienteDTO objClienteDTO) {
		objClienteDTO.setId(null);
		objClienteDTO.setSenha(bCryptPasswordEncoder.encode(objClienteDTO.getSenha()));
		validationCpfEmail(objClienteDTO);
		Cliente newObject = new Cliente(objClienteDTO);
		return clienteRepository.save(newObject);
	}
	
	public Cliente update(Integer id, @Valid ClienteDTO objClienteDTO) {
		objClienteDTO.setId(id);
		Cliente objCliente = findById(id);
			if(!objClienteDTO.getSenha().equals(objCliente.getSenha())) {
				objClienteDTO.setSenha(bCryptPasswordEncoder.encode(objClienteDTO.getSenha()));
			}
		validationCpfEmail(objClienteDTO);
		objCliente = new Cliente(objClienteDTO);
		return clienteRepository.save(objCliente);
	}
	
	public void delete(Integer id) {
		Cliente objCliente = findById(id);
		if(objCliente.getChamados().size() > 0) {
			throw new DataIntegrityViolationException("Cliente possui ordens de serviço e não pode ser deletado");
		}
		clienteRepository.deleteById(id);
	}
	
	private void validationCpfEmail(ClienteDTO objClienteDTO) {
		Optional<Pessoa> objectPessoa = pessoaRepository.findByCpf(objClienteDTO.getCpf());
			if(objectPessoa.isPresent() && objectPessoa.get().getId() != objClienteDTO.getId()) {
				throw new DataIntegrityViolationException("CPF já cadastrado no sistema!");
			}
		
		objectPessoa = pessoaRepository.findByEmail(objClienteDTO.getEmail());
		    if(objectPessoa.isPresent() && objectPessoa.get().getId() != objClienteDTO.getId()) {
		    	throw new DataIntegrityViolationException("E-mail já cadastrado no sistema!");
		    	
		    }
			
	}
}
