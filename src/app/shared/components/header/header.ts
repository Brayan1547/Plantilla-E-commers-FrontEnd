import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, CommonModule, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnDestroy {
  activeMenu: string | null = null;
  currentMessageIndex = 0;
  animate = true;
  private intervalId: any;

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
}