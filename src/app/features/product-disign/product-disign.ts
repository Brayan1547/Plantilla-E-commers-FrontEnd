import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-product-disign',
  imports: [CommonModule],
  templateUrl: './product-disign.html',
  styleUrl: './product-disign.css',
})
export default class ProductDisign {

  // ===========================
  // Imagen seleccionada
  // ===========================
  selectedImage: string | null = null;

  private touchStartX = 0;
  private touchStartY = 0;

  private readonly swipeThreshold = 15;

  // ===========================
  // Tallas
  // ===========================
  sizes = ['XS', 'S', 'M', 'L', 'XL', '2XL'];

  selectedSize = 'S';

  selectSize(size: string): void {
    this.selectedSize = size;
  }

  // ===========================
// Cantidad
// ===========================
quantity = 1;

increaseQuantity(): void {
  this.quantity++;
}

decreaseQuantity(): void {
  if (this.quantity > 1) {
    this.quantity--;
  }
}

  // ===========================
  // GalerÃ­a
  // ===========================
  openImage(image: string): void {
    this.selectedImage = image;
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
  }

  onTouchEnd(event: TouchEvent, image: string): void {

    const touch = event.changedTouches[0];

    const deltaX = Math.abs(touch.clientX - this.touchStartX);
    const deltaY = Math.abs(touch.clientY - this.touchStartY);

    if (
      deltaX < this.swipeThreshold &&
      deltaY < this.swipeThreshold
    ) {
      this.openImage(image);
    }
  }

  closeImage(): void {
    this.selectedImage = null;
  }

}