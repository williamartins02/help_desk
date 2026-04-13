import { GenericDialogComponent } from './../../molecules/generic-dialog/generic-dialog.component';
import { GenericDialog } from './../../../models/dialog/generic-dialog/generic-dialog';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { Tecnico } from '../../../models/tecnico';
import { TecnicoService } from '../../../services/tecnico.service';
import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-tecnico-update',
  templateUrl: './tecnico-update.component.html',
  styleUrls: ['./tecnico-update.component.css']
})
export class TecnicoUpdateComponent implements OnInit {

  hide = true;

  tecnico: Tecnico = {
    id: '',
    nome: '',
    cpf: '',
    email: '',
    senha: '',
    perfis: [],
    dataCriacao: '',
  }

  /*Validação usando o FormControl*/
  nome:  FormControl = new FormControl(null, Validators.minLength(3));
  cpf:   FormControl = new FormControl(null, Validators.required);
  email: FormControl = new FormControl(null, Validators.email);
  senha: FormControl = new FormControl(null, Validators.minLength(3))

  private genericDialog: GenericDialog;
  private matDialogRef: MatDialogRef<GenericDialogComponent>;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: {id: Number},//pegando o id do tecnico para dentro do modal.
    public  dialogRef: MatDialogRef<TecnicoUpdateComponent>,//dando referencia do componente que eu quero abrir o modal
    private service:   TecnicoService,
    private toast:     ToastrService,
    private router:    Router,
    private route:     ActivatedRoute, //permite de um GET em parametros pela url para pegar paramentros 
    public  dialog:    MatDialog
  ) { 
    this.genericDialog = new GenericDialog(dialog);
  }

  ngOnInit(): void {
    this.findById();
  }

  findById(): void {
    this.service.findById(this.data.id).subscribe((resposta) => {
      this.tecnico = resposta;
      // Sincronizar FormControls com os dados carregados
      this.nome.setValue(resposta.nome);
      this.cpf.setValue(resposta.cpf);
      this.email.setValue(resposta.email);
      this.senha.setValue(resposta.senha);
    })
  }
  
  update(): void {
    this.onNoClick();
    const matDialogRef = this.genericDialog.loadingMessage("Atualizando técnico...");
    this.service.update(this.tecnico).subscribe(() => {
      setTimeout(() => {
        matDialogRef.close();
        this.toast.success('Atualizado com sucesso', 'Técnico(a) ' + this.tecnico.nome);
        this.router.navigate(['/tecnicos'], { queryParams: { highlightId: this.tecnico.id } });
      },1000)
    },(err) => {
      matDialogRef.close();
      if (err.error?.errors) {
        err.error.errors.forEach((element) => {
          this.toast.error(element.message);
        });
      } else if (err.error?.message) {
        this.toast.error(err.error.message);
      } else {
        this.toast.error('Erro ao atualizar técnico. Tente novamente.');
      }
    })
  }

  checkPerfil(perfil: any): void {
    if (this.tecnico.perfis.includes(perfil)) {
      this.tecnico.perfis.splice(this.tecnico.perfis.indexOf(perfil), 1);
    } else {
      this.tecnico.perfis.push(perfil);
    }
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  validaCampos(): boolean {
    return this.nome.valid && this.cpf.valid && this.email.valid && this.senha.valid;
  }
}
