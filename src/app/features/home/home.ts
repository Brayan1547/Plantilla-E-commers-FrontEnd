import { Component, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpProduct } from '../../core/services/http-product';
import { HttpCart } from '../../core/services/http-cart';

import { UiModal } from '../../core/services/ui-modal'; // nuevo: para pedir login si no hay sesión
import { HttpAuth } from '../../core/services/http-auth'; // nuevo: saber si hay usuario logueado

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {

  // (0) Siempre inyectar la dependencia
  private httpProduct = inject(HttpProduct);
  private httpCart = inject(HttpCart); //  para agregar productos al carrito
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID)); // true solo en navegador, false en SSR

  private uiModal = inject(UiModal); 
  private httpAuth = inject(HttpAuth); 


  // ahora guardamos el arreglo COMPLETO de productos
  products: any[] = [];

  // solo se muestran los primeros "shownCount" de "products"
  displayedProducts: any[] = [];

  //clave para guardar el progreso en el navegador (localStorage)
  private readonly STORAGE_KEY = 'dusck_shown_count';


  ngOnInit() {
    this.onLoadData();
  }

  onLoadData(){
    this.httpProduct.getProduct().subscribe({
      next: (data) => {
        // Solo productos activos (isActive: true)
        this.products = data.data.filter((p: any) => p.isActive);
        this.updateDisplayedProducts();
      },
      error: (err) => console.error(err),
      complete: () => console.log('productos cargados ')
      });
  }

    // Lee el progreso guardado en localStorage y arma displayedProducts.
  // Si es primera vez, muestra solo 1.
  private updateDisplayedProducts() {
    const saved = this.isBrowser ? localStorage.getItem(this.STORAGE_KEY) : null; // guard SSR
    const shownCount = saved ? Number(saved) : 1;
    this.displayedProducts = this.products.slice(0, shownCount);
  }

  // Avanza al siguiente producto y guarda el progreso en localStorage
  onNextProduct() {
    const currentCount = this.displayedProducts.length;

    if (currentCount >= this.products.length) {
      console.log('No hay más productos por ahora');
      return;
    }

  const newCount = currentCount + 1; // aumenta cuántos productos se muestran
    if (this.isBrowser) localStorage.setItem(this.STORAGE_KEY, String(newCount)); // guarda progreso, solo en navegador
    this.displayedProducts = this.products.slice(0, newCount); // refresca la lista visible
  }

  onWishlist(event: Event, productId: string) {
    event.preventDefault();  // evita que el clic en el corazón dispare el routerLink de la card
    event.stopPropagation();

    console.log('Agregado a favoritos:', productId);
    // Aquí luego conectas tu servicio real, ej:
    // this.wishlistService.toggle(productId).subscribe(...)
  }

  // Agrega 1 unidad del producto al carrito al hacer click en "Comprar" de la card
  onAddToCart(event: Event, productId: string) {
    event.preventDefault();   // evita que el clic dispare el routerLink de la card
    event.stopPropagation();

      if (!this.httpAuth.user) {
      this.uiModal.open('login'); // nuevo: pide iniciar sesión antes de comprar
      return;
    }

    this.httpCart.updateCart(productId, 1).subscribe({
      next: () => console.log('Producto agregado al carrito'),
      error: (err) => console.error('Error al agregar al carrito', err)
    });
  }


  // IMPORTANTE: images ahora es un arreglo [{url, isMain}] (tu nuevo schema).
  // Esta función busca la que tiene isMain: true; si ninguna la tiene, usa la primera.
  getMainImage(images: { url:string; isMain: boolean } [] ): string {
    if (!images || images.length === 0) return''; 
    const main = images.find(img => img.isMain);
    return main ? main.url : images[0].url;
  }

  // Dice si el producto ya tiene al menos 1 imagen cargada
  hasImages(images: { url: string; isMain: boolean }[]): boolean {
    return !!images && images.length > 0;
  }

}