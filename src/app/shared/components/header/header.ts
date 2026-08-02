import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { httpAuth } from '../../../core/services/http-auth';

import { AuthModal } from '../auth-modal/auth-modal';


@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, CommonModule, RouterLinkActive, AuthModal],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnDestroy {
  activeMenu: string | null = null;
  currentMessageIndex = 0;
  animate = true;
  private intervalId: any;

  httpAuth = inject( httpAuth )

  messages = [
    "Nueva Colección Disponible - Quiet Luxury",
    "Envío estándar gratuito > $75"
  ];

  constructor(private cdr: ChangeDetectorRef) {
    this.intervalId = setInterval(() => {
      this.animate = false;
      this.cdr.detectChanges(); 
      setTimeout(() => {
        this.currentMessageIndex = (this.currentMessageIndex + 1) % this.messages.length;
        this.animate = true;
        this.cdr.detectChanges();
      }, 500);
    }, 3000);
  }

  toggleMenu(menu: string) {
    this.activeMenu = this.activeMenu === menu ? null : menu;
  }

  ngOnDestroy() {
    clearInterval(this.intervalId);
  }

  logout() {
    this.httpAuth.logoutUser();
  }


   authModalOpen = false;
  authModalTab: 'login' | 'register' = 'login';

  openAuthModal(tab: 'login' | 'register') {
    this.authModalTab = tab;
    this.authModalOpen = true;
  }

  closeAuthModal() {
    this.authModalOpen = false;
  }

  onAccountIconClick() {
    if (!this.httpAuth.user) {
      this.openAuthModal('login');
    }
  }
}