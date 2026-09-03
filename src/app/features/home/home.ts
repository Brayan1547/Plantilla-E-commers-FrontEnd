import { Component, inject } from '@angular/core';
import { CommonModule,  } from '@angular/common';
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

  private uiModal = inject(UiModal); 
  httpAuth = inject(HttpAuth); // público: el html necesita leer el rol directo


  // ahora guardamos el arreglo COMPLETO de productos
  products: any[] = [];

  // solo se muestran los primeros "shownCount" de "products"
  displayedProducts: any[] = [];



  ngOnInit() {
    this.onLoadData();
  }

  onLoadData(){
    this.httpProduct.getProduct().subscribe({
      next: (data) => {
        // Product Domain: GET /api/product publico YA filtra en el BACKEND a
        // status:PUBLISHED + isActive:true (Regla §24 — el backend es la
        // barrera real). Este filtro queda como defensa adicional, no como
        // el unico mecanismo de visibilidad.
        this.products = data.data.filter((p: any) => p.isActive);
        this.updateDisplayedProducts();
      },
      error: (err) => console.error(err),
      complete: () => console.log('productos cargados ')
      });
  }

    // Muestra todos los productos activos de una vez, sin límite inicial
  private updateDisplayedProducts() {
    this.displayedProducts = this.products;
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

    // true solo si el usuario logueado puede administrar productos (mismos roles que el backend)
  get canManageProducts(): boolean {
    const role = this.httpAuth.user?.role;
    return role === 'administrador' || role === 'shop_manager';
  }
  
}