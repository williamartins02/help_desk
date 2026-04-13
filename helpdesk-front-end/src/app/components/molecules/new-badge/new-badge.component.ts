import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-new-badge',
  template: `
    <span *ngIf="show" class="new-badge" [ngStyle]="{ 'display': 'inline-flex', 'margin-left': marginLeft }">NEW</span>
  `,
  styleUrls: ['./new-badge.component.css']
})
export class NewBadgeComponent {
  @Input() show: boolean = false;
  @Input() marginLeft: string = '0.5em';
}

