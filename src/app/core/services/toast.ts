import { Service, signal } from '@angular/core';

export interface ToastMessage {
  text: string;
  type: 'success' | 'error';
}

@Service()
export class Toast {

  // El mensaje actual visible; null significa que no hay ningún toast en pantalla
  message = signal<ToastMessage | null>(null);

  private timeoutId: any;

  // Muestra un mensaje por "duration" milisegundos y luego se oculta solo
  show(text: string, type: 'success' | 'error' = 'success', duration = 4000) {
    clearTimeout(this.timeoutId); // si ya había un toast mostrándose, cancela su cierre pendiente
    this.message.set({ text, type });

    this.timeoutId = setTimeout(() => {
      this.message.set(null);
    }, duration);
  }
}