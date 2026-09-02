import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { HttpCategory } from '../../../core/services/http-category';

/**
 * Índice PÚBLICO de categorías del storefront (ruta `/category-list`, SSR).
 *
 * R2.1 — FASE 5: esta vista es de SOLO LECTURA. Se retiró toda la UI
 * administrativa (crear / editar / eliminar) y su navegación al panel legacy
 * (retirado en R2.2). La administración de categorías vive exclusivamente en
 * `/admin/categories`.
 *
 * Datos: `GET /api/category` (público, sin auth). Solo categorías activas.
 * Cada categoría enlaza a `/basicos?categoria=<slug>` (catálogo público).
 */
@Component({
  selector: 'app-category-list',
  imports: [CommonModule, RouterLink],
  templateUrl: './category-list.html',
  styleUrl: './category-list.css',
})
export default class CategoryList {
  private httpCategory = inject(HttpCategory);

  protected readonly categories = signal<any[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  ngOnInit(): void {
    this.httpCategory.getCategory().subscribe({
      next: (res) => {
        this.categories.set((res?.data ?? []).filter((c: any) => c.isActive));
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
