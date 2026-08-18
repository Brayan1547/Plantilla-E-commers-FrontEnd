import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, signal, Service } from '@angular/core';
import { tap } from 'rxjs';
import { httpAuth } from './http-auth';
import { environment } from '../../../environments/environment';

@Service()
export class HttpCart {

    private http = inject(HttpClient);
    private authHttp = inject(httpAuth);
    private BASE_URL = `${environment.apiUrl}/cart`; // ej: http://localhost:3000/api/cart

    // Estado reactivo del carrito, visible desde cualquier componente (header, drawer, etc.)
    // signal() se actualiza sola y refresca la UI donde se use, sin necesidad de suscripciones manuales.
    cart = signal<any>({ items: [] });

    // Cuenta total de unidades en el carrito, para el badge del header
    cartCount = signal<number>(0);

    // Arma el header con el token, igual que en http-product.ts
    private getHeader(): HttpHeaders {
        const token = this.authHttp.token;
        return new HttpHeaders({
            'x-token': token || '',
            'content-type': 'application/json'
        });
    }

    // Suma las cantidades de todos los items para actualizar el badge
    private recalculateCount(cartData: any) {
        const total = (cartData?.items || []).reduce(
            (sum: number, item: any) => sum + item.quantity,
            0
        );
        this.cartCount.set(total);
    }

    // Trae el carrito del usuario logueado (el backend lo crea si no existe)
    getMyCart() {
        return this.http.get<any>(this.BASE_URL, { headers: this.getHeader() }).pipe(
            tap((res) => {
                this.cart.set(res.cart);          // guarda el carrito completo en el signal
                this.recalculateCount(res.cart);  // actualiza el contador del badge
            })
        );
    }

    // Suma o resta cantidad de un producto (quantity puede ser negativo para restar)
    updateCart(productId: string, quantity: number) {
        const body = { productId, quantity };
        return this.http.patch<any>(this.BASE_URL, body, { headers: this.getHeader() }).pipe(
            tap((res) => {
                this.cart.set(res.data);
                this.recalculateCount(res.data);
            })
        );
    }

    // Elimina un producto del carrito por completo, sin importar la cantidad
    removeItem(productId: string) {
        return this.http.delete<any>(`${this.BASE_URL}/items/${productId}`, { headers: this.getHeader() }).pipe(
            tap((res) => {
                this.cart.set(res.data);
                this.recalculateCount(res.data);
            })
        );
    }

    // Vacía el carrito completo (ej. después de un checkout exitoso)
    clearCart() {
        return this.http.delete<any>(this.BASE_URL, { headers: this.getHeader() }).pipe(
            tap(() => {
                this.cart.set({ items: [] });
                this.cartCount.set(0);
            })
        );
    }
}