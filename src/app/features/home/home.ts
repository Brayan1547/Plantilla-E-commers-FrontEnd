import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {

  onWishlist(event: Event, productId: number) {
    event.preventDefault();  // evita que el clic en el corazón dispare el routerLink de la card
    event.stopPropagation();

    console.log('Agregado a favoritos:', productId);
    // Aquí luego conectas tu servicio real, ej:
    // this.wishlistService.toggle(productId).subscribe(...)
  }

}