import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { Tarefa } from '../../../models/tarefa';
import { TarefaService } from '../../../services/tarefa.service';

/** Dados recebidos ao abrir o dialog */
export interface TarefaDialogData {
  tarefa?: Tarefa;        // quando edição
  tecnicoId: number;      // ID do técnico logado
}

/**
 * Dialog reutilizável para CRIAR ou EDITAR uma Tarefa.
 *
 * Uso:
 * - Abrir sem `tarefa` → modo criação
 * - Abrir com `tarefa` → modo edição (campos pré-preenchidos)
 */
@Component({
  selector: 'app-tarefa-form-dialog',
  templateUrl: './tarefa-form-dialog.component.html',
  styleUrls: ['./tarefa-form-dialog.component.css']
})
export class TarefaFormDialogComponent implements OnInit {

  form!: FormGroup;
  isEdicao = false;
  salvando = false;

  /** Opções de prioridade disponíveis no select */
  prioridades = [
    { codigo: 0, label: 'Baixa' },
    { codigo: 1, label: 'Média' },
    { codigo: 2, label: 'Alta' },
    { codigo: 3, label: 'Crítica' },
  ];

  constructor(
    private fb: FormBuilder,
    private tarefaService: TarefaService,
    private toastr: ToastrService,
    private dialogRef: MatDialogRef<TarefaFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TarefaDialogData
  ) {}

  ngOnInit(): void {
    this.isEdicao = !!this.data.tarefa;
    this.buildForm();
  }

  /** Constrói o FormGroup com validadores */
  private buildForm(): void {
    const t = this.data.tarefa;
    this.form = this.fb.group({
      titulo:     [t?.titulo     || '',       [Validators.required, Validators.maxLength(150)]],
      descricao:  [t?.descricao  || '',       []],
      data:       [t?.data       || '',       [Validators.required]],
      horaInicio: [t?.horaInicio || '',       []],
      horaFim:    [t?.horaFim    || '',       []],
      prioridade: [t?.prioridade ?? 1,        [Validators.required]],
      chamado:    [t?.chamado    || null,     []],
    });
  }

  /** Envia o formulário para criação ou edição */
  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.salvando = true;

    const payload: Tarefa = {
      ...this.form.value,
      status:   this.data.tarefa?.status ?? 0,  // novo = PENDENTE
      tecnico:  this.data.tecnicoId,
    };

    const operacao$ = this.isEdicao
      ? this.tarefaService.update(this.data.tarefa!.id!, payload)
      : this.tarefaService.create(payload);

    operacao$.subscribe({
      next: (tarefaSalva) => {
        const msg = this.isEdicao ? 'Tarefa atualizada!' : 'Tarefa criada com sucesso!';
        this.toastr.success(msg);
        this.dialogRef.close(tarefaSalva);
      },
      error: () => {
        this.toastr.error('Erro ao salvar tarefa. Tente novamente.');
        this.salvando = false;
      }
    });
  }

  /** Fecha sem salvar */
  cancelar(): void {
    this.dialogRef.close();
  }
}

