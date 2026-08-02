import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import Login from '../../../features/auth/login/login';
import Register from '../../../features/auth/register/register';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [Login, Register],
  templateUrl: './auth-modal.html',
  styleUrl: './auth-modal.css',
})
export class AuthModal {
  @Output() closed = new EventEmitter<void>();

  activeTab: 'login' | 'register' = 'login';

  @Input()
  set initialTab(tab: 'login' | 'register') {
    this.activeTab = tab;
  }

  setTab(tab: 'login' | 'register') {
    this.activeTab = tab;
  }

  close() {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.close();
  }
}