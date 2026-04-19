import { Component, Inject, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { Tarefa } from '../../../models/tarefa';
import { Chamado } from '../../../models/chamado';
import { TarefaService } from '../../../services/tarefa.service';
import { ChamadoService } from '../../../services/chamado.service';

/** Valida que horaFim, quando preenchida, é posterior a horaInicio */
function horaFimValidator(group: AbstractControl): ValidationErrors | null {
  const inicio = group.get('horaInicio')?.value as string;
  const fim    = group.get('horaFim')?.value as string;
  if (!inicio || !fim) return null;
  const toMin = (h: string) => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm; };
  return toMin(fim) <= toMin(inicio) ? { horaFimAnterior: true } : null;
}

/** Dados recebidos ao abrir o dialog */
export interface TarefaDialogData {
  tarefa?: Tarefa;           // quando edição
  tecnicoId: number;         // ID do técnico logado
  dataPadrao?: string;       // data selecionada na Agenda (pré-preenche o campo)
  tarefasDoDia?: Tarefa[];   // tarefas já existentes no dia (detecção de conflitos)
  isAdmin?: boolean;         // carrega todos os chamados quando true
}

/**
 * Dialog reutilizável para CRIAR ou EDITAR uma Tarefa.
 *
 * - Data pré-preenchida com o dia selecionado na Agenda.
 * - Campo Chamado com autocomplete: busca por nº, título ou cliente.
 * - Ao selecionar chamado: preenche título (se vazio) e prioridade automaticamente.
 * - Validação de horário: horaFim deve ser posterior a horaInicio.
 * - Alerta visual de conflito com outras tarefas no mesmo horário do dia.
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

  // ── Chamado autocomplete ──────────────────────────────────────────────────
  chamadosAbertos: Chamado[]   = [];
  chamadosFiltrados: Chamado[] = [];
  carregandoChamados           = false;

  // ── Conflitos de horário ──────────────────────────────────────────────────
  conflitos: string[] = [];

  /** Opções de prioridade disponíveis no select */
  prioridades = [
    { codigo: 0, label: 'Baixa'   },
    { codigo: 1, label: 'Média'   },
    { codigo: 2, label: 'Alta'    },
    { codigo: 3, label: 'Crítica' },
  ];

  /** Mapa de prioridade do Chamado (string do backend) → código numérico da Tarefa */
  private readonly prioridadeMap: Record<string, number> = {
    BAIXA: 0, MEDIA: 1, ALTA: 2, CRITICA: 3
  };

  constructor(
    private fb: FormBuilder,
    private tarefaService: TarefaService,
    private chamadoService: ChamadoService,
    private toastr: ToastrService,
    private dialogRef: MatDialogRef<TarefaFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TarefaDialogData
  ) {}

  ngOnInit(): void {
    this.isEdicao = !!this.data.tarefa;
    this.buildForm();
    this.carregarChamados();

    // Monitora mudanças nos campos de horário para detectar conflitos
    this.form.get('horaInicio')?.valueChanges.subscribe(() => this.verificarConflitos());
    this.form.get('horaFim')?.valueChanges.subscribe(()    => this.verificarConflitos());
  }

  // ── Construção do formulário ──────────────────────────────────────────────

  private buildForm(): void {
    const t = this.data.tarefa;

    // Usa a data da tarefa (edição) ou a data do dia selecionado na Agenda (criação)
    const dataInicial = t?.data || this.data.dataPadrao || '';

    this.form = this.fb.group({
      titulo:       [t?.titulo     || '',  [Validators.required, Validators.maxLength(150)]],
      descricao:    [t?.descricao  || '',  []],
      data:         [dataInicial,           [Validators.required]],
      horaInicio:   [t?.horaInicio || '',  []],
      horaFim:      [t?.horaFim    || '',  []],
      prioridade:   [t?.prioridade ?? 1,   [Validators.required]],
      chamado:      [t?.chamado    || null, []],
      // Campo de busca do autocomplete — NÃO enviado ao backend
      chamadoBusca: ['', []],
    }, { validators: horaFimValidator });
  }

  // ── Carregamento de chamados para o autocomplete ──────────────────────────

  private carregarChamados(): void {
    this.carregandoChamados = true;

    // Admin carrega todos; técnico carrega apenas os próprios
    const obs$ = this.data.isAdmin
      ? this.chamadoService.findAll()
      : this.chamadoService.findByTecnico(this.data.tecnicoId);

    obs$.subscribe({
      next: (chamados) => {
        // Exibe apenas chamados em aberto ou em andamento (não encerrados)
        this.chamadosAbertos  = chamados.filter(c => c.status !== 'ENCERRADO');
        this.chamadosFiltrados = [...this.chamadosAbertos];
        this.carregandoChamados = false;

        // Em modo edição: pré-preenche o campo de busca com o chamado vinculado
        const idVinculado = this.data.tarefa?.chamado;
        if (this.isEdicao && idVinculado) {
          const encontrado = this.chamadosAbertos.find(c => c.id === idVinculado);
          if (encontrado) {
            this.form.get('chamadoBusca')?.setValue(encontrado, { emitEvent: false });
          } else {
            // Chamado pode estar encerrado — mantém apenas o ID no campo oculto
            this.form.get('chamadoBusca')?.setValue(
              { id: idVinculado, titulo: '(chamado encerrado)' } as Chamado,
              { emitEvent: false }
            );
          }
        }
      },
      error: () => { this.carregandoChamados = false; }
    });
  }

  /** Filtra a lista de chamados conforme o texto digitado */
  filtrarChamados(busca: string): void {
    if (!busca || typeof busca !== 'string') {
      this.chamadosFiltrados = [...this.chamadosAbertos];
      return;
    }
    const b = busca.toLowerCase();
    this.chamadosFiltrados = this.chamadosAbertos.filter(c =>
      String(c.id).includes(b)                     ||
      c.titulo?.toLowerCase().includes(b)           ||
      c.nomeCliente?.toLowerCase().includes(b)
    );
  }

  /**
   * Formata o valor do autocomplete para exibição no campo de texto.
   * Chamado como arrow function para manter o contexto `this`.
   */
  displayChamado = (chamado: Chamado | null): string => {
    if (!chamado) return '';
    return `#${chamado.id} · ${chamado.titulo}`;
  };

  /** Disparado quando o usuário seleciona um chamado no autocomplete */
  onChamadoSelecionado(chamado: Chamado | null): void {
    // Atualiza o campo oculto com o ID real (enviado ao backend)
    this.form.get('chamado')?.setValue(chamado?.id ?? null);

    if (!chamado) return;

    // Auto-preenche título se ainda estiver vazio
    if (!this.form.get('titulo')?.value?.trim()) {
      this.form.get('titulo')?.setValue(`Atender: ${chamado.titulo}`);
    }

    // Sincroniza prioridade do chamado com a da tarefa
    const prio = this.prioridadeMap[chamado.prioridade];
    if (prio !== undefined) {
      this.form.get('prioridade')?.setValue(prio);
    }
  }

  /** Limpa o vínculo com chamado */
  limparChamado(): void {
    this.form.get('chamado')?.setValue(null);
    this.form.get('chamadoBusca')?.setValue('');
    this.chamadosFiltrados = [...this.chamadosAbertos];
  }

  // ── Getter de erro de horário ─────────────────────────────────────────────

  get erroHoraFim(): boolean {
    return !!this.form.errors?.['horaFimAnterior'] &&
           !!this.form.get('horaFim')?.value;
  }

  // ── Detecção de conflitos ─────────────────────────────────────────────────

  private verificarConflitos(): void {
    this.conflitos = [];
    const horaInicio = this.form.get('horaInicio')?.value as string;
    const horaFim    = this.form.get('horaFim')?.value    as string;
    const tarefasDoDia = this.data.tarefasDoDia || [];

    if (!horaInicio || tarefasDoDia.length === 0) return;

    const toMin = (h: string) => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm; };
    const novaInicio = toMin(horaInicio);
    const novaFim    = horaFim ? toMin(horaFim) : novaInicio + 60;

    tarefasDoDia.forEach(t => {
      // Ignora a própria tarefa no modo edição
      if (this.isEdicao && t.id === this.data.tarefa?.id) return;
      if (!t.horaInicio) return;

      const existInicio = toMin(t.horaInicio);
      const existFim    = t.horaFim ? toMin(t.horaFim) : existInicio + 60;

      if (novaInicio < existFim && novaFim > existInicio) {
        this.conflitos.push(t.titulo);
      }
    });
  }

  // ── Envio ─────────────────────────────────────────────────────────────────

  /** Envia o formulário para criação ou edição */
  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.salvando = true;

    // Extrai chamadoBusca (campo de display) — não enviado ao backend
    const { chamadoBusca, ...formValues } = this.form.value;

    const payload: Tarefa = {
      ...formValues,
      status:  this.data.tarefa?.status ?? 0,  // novo = PENDENTE
      tecnico: this.data.tecnicoId,
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

