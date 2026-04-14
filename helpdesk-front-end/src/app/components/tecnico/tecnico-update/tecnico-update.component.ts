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
    fotoPerfil: undefined,
  }

  /** Preview da imagem (data URL): mostra a foto atual ou a recém-selecionada */
  previewUrl: string | null = null;

  /** Foto original carregada do servidor — usada para desfazer alterações locais */
  private originalFoto: string | null = null;

  /** Indica se o usuário trocou a foto nesta sessão (vs a foto original do servidor) */
  fotoAlterada = false;

  /** Máximo de 3 MB para upload de foto */
  private readonly MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;

  /*Validação usando o FormControl*/
  nome:  FormControl = new FormControl(null, Validators.minLength(3));
  cpf:   FormControl = new FormControl(null, Validators.required);
  email: FormControl = new FormControl(null, Validators.email);
  senha: FormControl = new FormControl(null, Validators.minLength(3))

  private genericDialog: GenericDialog;
  private matDialogRef: MatDialogRef<GenericDialogComponent>;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: {id: Number},
    public  dialogRef: MatDialogRef<TecnicoUpdateComponent>,
    private service:   TecnicoService,
    private toast:     ToastrService,
    private router:    Router,
    private route:     ActivatedRoute,
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
      this.nome.setValue(resposta.nome);
      this.cpf.setValue(resposta.cpf);
      this.email.setValue(resposta.email);
      this.senha.setValue(resposta.senha);
      // Guarda a foto original para permitir desfazer
      this.originalFoto  = resposta.fotoPerfil || null;
      this.previewUrl    = this.originalFoto;
      this.fotoAlterada  = false;
    })
  }

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
      this.previewUrl   = result;
      this.tecnico.fotoPerfil = result;
      this.fotoAlterada = true;
    };
    reader.readAsDataURL(file);
  }

  /** Cancela a troca de foto e volta para a foto original do servidor */
  cancelarAlteracaoFoto(): void {
    this.previewUrl = this.originalFoto;
    this.tecnico.fotoPerfil = this.originalFoto ?? undefined;
    this.fotoAlterada = false;
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

  checkPerfil(perfil: number, checked: boolean): void {
    if (checked && !this.tecnico.perfis.includes(perfil)) {
      this.tecnico.perfis.push(perfil);
    } else if (!checked) {
      const idx = this.tecnico.perfis.indexOf(perfil);
      if (idx > -1) {
        this.tecnico.perfis.splice(idx, 1);
      }
    }
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  validaCampos(): boolean {
    return this.nome.valid && this.cpf.valid && this.email.valid && this.senha.valid;
  }
}
