import { Component, HostListener, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { HttpAuth } from '../../../core/services/http-auth';

import { AuthModal } from '../auth-modal/auth-modal';

import { filter } from 'rxjs/operators';

import { HttpCart } from '../../../core/services/http-cart'; // nuevo: servicio del carrito
import { CartDrawer } from '../cart-drawer/cart-drawer'; // nuevo: panel del carrito

import { UiModal } from '../../../core/services/ui-modal'; // nuevo: estado compartido del modal

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, CommonModule, RouterLinkActive, AuthModal, CartDrawer],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnDestroy {
  currentMessageIndex = 0;
  animate = true;
  private intervalId: any;

  httpAuth = inject( HttpAuth );
  httpCart = inject( HttpCart ); // acceso al carrito (cart, cartCount)
    uiModal = inject(UiModal); // para abrir/cerrar el modal desde cualquier lado

  messages = [
    "Nueva Colección Disponible - DUSCK",
    "Envío estándar gratuito > $75"
  ];

  constructor(private cdr: ChangeDetectorRef, private router: Router) {
    // 2
    this.isHomePage = this.checkIsHome(this.router.url);
this.updateScrolled();

this.router.events.pipe(
  filter(e => e instanceof NavigationEnd)
).subscribe((e: any) => {
  this.isHomePage = this.checkIsHome(e.urlAfterRedirects);
  this.updateScrolled();
});

  // si ya hay sesión activa, trae el carrito para que el badge no empiece en 0 sin razón
    if (this.httpAuth.user) {
      this.httpCart.getMyCart().subscribe();
    }

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
// 3
  private checkIsHome(url: string): boolean {
  return url === '/' || url === '/home';
}
// 4
private updateScrolled() {
  if (typeof window === 'undefined') {
    // esto corre en el servidor (SSR), ahí no existe "window"
    this.scrolled = !this.isHomePage;
  } else {
    this.scrolled = !this.isHomePage || window.scrollY > 80;
  }
  // le avisa al body si debe reservar espacio para el header fijo (fuera del home)
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('has-fixed-header', !this.isHomePage);
  }
  
}

  ngOnDestroy() {
    clearInterval(this.intervalId);
  }

  logout() {
    this.httpAuth.logoutUser();
    this.accountMenuOpen = false;   //cierra el desplegable al salir
  }
  // 1
  isHomePage = true;

  accountMenuOpen = false;   // controla el desplegable de cuenta


  // controla el panel lateral de navegación (drawer) que reemplaza al mega-menú
  drawerOpen = false;

  // controla el panel lateral del carrito (distinto al drawer del menú)
  cartDrawerOpen = false;

  // true cuando el usuario ya bajó lo suficiente: header pasa de transparente a blanco
  scrolled = false;

  @HostListener('window:scroll')
  onWindowScroll() {
    // ajusta este número según la altura de tu hero (ej: si el hero mide 600px, pon un valor cercano)
    // this.scrolled = window.scrollY > 80;
    this.updateScrolled();
  }

  toggleDrawer() {
    this.drawerOpen = !this.drawerOpen;
    // si el drawer se abre, cerramos el dropdown de cuenta para que no queden dos abiertos
    if (this.drawerOpen) {
      this.accountMenuOpen = false;
    }
  }

  closeDrawer() {
    this.drawerOpen = false;
  }

   // abre el panel del carrito si hay sesión, si no pide iniciar sesión primero
  onCartIconClick() {
    if (!this.httpAuth.user) {
      this.openAuthModal('login');
    } else {
      this.cartDrawerOpen = true;
    }
  }

  closeCartDrawer() {
    this.cartDrawerOpen = false;
  }

  openAuthModal(tab: 'login' | 'register') {
    this.uiModal.open(tab);
  }

  closeAuthModal() {
    this.uiModal.close();
  }


    // getters: permiten que el html siga usando "authModalOpen" y "authModalTab" sin cambios
  get authModalOpen(): boolean {
    return this.uiModal.authModalOpen();
  }

  get authModalTab(): 'login' | 'register' {
    return this.uiModal.authModalTab();
  }
  

  onAccountIconClick() {
    if (!this.httpAuth.user) {
      this.openAuthModal('login');
    }else {
      this.accountMenuOpen = !this.accountMenuOpen;   //abre/cierra el desplegable
    }
  }

   // ← método nuevo completo: cierra el desplegable si haces click fuera de él
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.account-wrapper')) {
      this.accountMenuOpen = false;
    }
  }
}