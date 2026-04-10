import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Component, Inject } from '@angular/core';

interface GenericDialogData {
    title?: string;
    content?: string;
    type?: string;
    icon?: string;
    loading?: boolean;
    btnOK?: boolean;
}

@Component({
    selector: 'app-generic-dialog',
    templateUrl: './generic-dialog.component.html',
    styleUrls: ['./generic-dialog.component.css']
})
export class GenericDialogComponent {
    public readonly titleId = 'generic-dialog-title';
    public readonly contentId = 'generic-dialog-content';
    public title: string;
    public content: string;
    public type: string;
    public icon: string | null;
    public loading: boolean;
    public btnOK: boolean;

    constructor(@Inject(MAT_DIALOG_DATA) private data: GenericDialogData) {
        this.title = data?.title ?? '';
        this.content = data?.content ?? '';
        this.type = this.normalizeType(data?.type);
        this.icon = data?.icon ?? null;
        this.loading = !!data?.loading;
        this.btnOK = !!data?.btnOK;
    }

    private normalizeType(type?: string): string {
        return (type ?? 'default').toLowerCase().replace(/[^a-z0-9-_]/g, '') || 'default';
    }
}
