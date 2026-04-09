import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';

/**
 * Add the template content to the DOM unless the condition is true.
 */
@Directive({ selector: '[appShowForRoles]'})
export class ShowForRolesDirective {

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef) { }

  @Input() set appShowForRoles(showForRoles: Array<string>) {
    const hideFor = showForRoles || [];
    if(hideFor.length > 0){
      this.roleChecker(hideFor);
      return;
    }
    this.viewContainer.createEmbeddedView(this.templateRef)
  }

  roleChecker(showFor: Array<string>) {
    // Current user roles
    const permissions = localStorage.getItem('permissions');
    let userRoles: Array<string> = [];

    try {
      const parsed = JSON.parse(permissions);
      userRoles = Array.isArray(parsed) ? parsed : [];
    } catch {
      userRoles = [];
    }

    if (userRoles.length === 0) {
      this.viewContainer.clear();
      return;
    }

    const idx = userRoles.findIndex(role => showFor.indexOf(role) !== -1);
    if (idx !== -1) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      return;
    }
    this.viewContainer.clear();
  }
}

