import { Service, signal } from '@angular/core';

@Service()
export class UiModal {

  // Estado del modal de auth, visible/controlable desde cualquier componente
  authModalOpen = signal(false);
  authModalTab = signal<'login' | 'register'>('login');

  open(tab: 'login' | 'register' = 'login') {
    this.authModalTab.set(tab);
    this.authModalOpen.set(true);
  }

  close() {
    this.authModalOpen.set(false);
  }
}