import { GenericDialogComponent } from './../../molecules/generic-dialog/generic-dialog.component';

import { GenericDialog } from "./../../../models/dialog/generic-dialog/generic-dialog";
import { MatDialogRef, MatDialog } from "@angular/material/dialog";
import { ToastrService } from "ngx-toastr";
import { Tecnico } from "./../../../models/tecnico";
import { TecnicoService } from "./../../../services/tecnico.service";
import { Component, OnInit } from "@angular/core";
import { FormControl, Validators } from "@angular/forms";
import { Router } from "@angular/router";

@Component({
  selector: "app-tecnico-create",
  templateUrl: "./tecnico-create.component.html",
  styleUrls: ["./tecnico-create.component.css"],
})
export class TecnicoCreateComponent implements OnInit {

  hide = true; //esconder e aparecer senha

  tecnico: Tecnico = {
    id:    "",
    nome:  "",
    cpf:   "",
    email: "",
    senha: "",
    perfis: [2],  // Técnico pré-selecionado por padrão
    dataCriacao: "",
    fotoPerfil: undefined,
  };

  /** Preview da imagem selecionada pelo usuário (data URL) */
  previewUrl: string | null = null;

  /** Máximo de 3 MB para upload de foto */
  private readonly MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;

  /*Validação usando o FormControl*/
  nome:   FormControl = new FormControl(null, Validators.minLength(3));
  cpf:    FormControl = new FormControl(null, Validators.required);
  email:  FormControl = new FormControl(null, Validators.email);
  senha:  FormControl = new FormControl(null, Validators.minLength(3));
  
  private genericDialog: GenericDialog;
  private matDialogRef: MatDialogRef<GenericDialogComponent>;

  constructor(
    private service: TecnicoService,
    private toast: ToastrService,
    private router: Router,
    public  dialogRef: MatDialogRef<TecnicoCreateComponent>,
    public  dialog: MatDialog
  ) {
    this.genericDialog = new GenericDialog(dialog);
  }

  ngOnInit(): void {}

  /** Lida com a seleção de arquivo de imagem e converte para Base64 */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    if (file.size > this.MAX_FILE_SIZE_BYTES) {
      this.toast.warning('A imagem deve ter no máximo 3 MB.', 'Arquivo muito grande');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      this.previewUrl = result;
      this.tecnico.fotoPerfil = result;
    };
    reader.readAsDataURL(file);
  }

  /** Remove a foto selecionada (o backend gerará o avatar automático) */
  removePhoto(): void {
    this.previewUrl = null;
    this.tecnico.fotoPerfil = undefined;
  }

  /*Metodo para criar um Tecnico*/
  public create(): void{
    this.onNoClick();
    const matDialogRef = this.genericDialog.loadingMessage("Salvando técnico...");
    this.service.create(this.tecnico).subscribe((created) => {
        setTimeout(() => {
          matDialogRef.close();
          this.router.navigate(["/tecnicos"], { queryParams: { highlightId: created.id, new: true } });
          this.toast.success("Cadastrado(a) com sucesso","Técnico(a) " + this.tecnico.nome);
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
          this.toast.error('Erro ao cadastrar técnico. Tente novamente.');
        }
      })
  }

  /*Adicionando um perfil com CheckBox — usa o estado checked do evento para evitar duplo disparo */
  addPerfil(perfil: number, checked: boolean): void {
    if (checked && !this.tecnico.perfis.includes(perfil)) {
      this.tecnico.perfis.push(perfil);
    } else if (!checked) {
      const idx = this.tecnico.perfis.indexOf(perfil);
      if (idx > -1) {
        this.tecnico.perfis.splice(idx, 1);
      }
    }
  }

  /* validando o retorno dos campos.*/
  validaCampos(): boolean {
    return (
      this.nome.valid && this.cpf.valid && this.email.valid && this.senha.valid
    );
  }

  onNoClick(): void {
    this.dialogRef.close();
  }
}
