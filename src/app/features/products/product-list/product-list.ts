import { Component, inject } from '@angular/core';
import { RouterLink } from "@angular/router";
import { HttpProduct } from '../../../core/services/http-product';
import { error } from 'console';
import { BehaviorSubject } from 'rxjs';
import { AsyncPipe, JsonPipe } from '@angular/common';

//IMportamos la libreria de iconos de HugeIcons
import { HugeiconsIconComponent } from '@hugeicons/angular'
import { BadgeXIcon, Notification03Icon } from '@hugeicons/core-free-icons'

@Component({
  selector: 'app-product-list',
  imports: [RouterLink, AsyncPipe, JsonPipe, HugeiconsIconComponent],
  templateUrl: './product-list.html',
  styleUrl: './product-list.css',
})
export default class ProductList {
  productList$ = new BehaviorSubject<any>([]);

  //Define el atributo publico que desplegara el icono 
   notificationIcon = Notification03Icon ;
   BadgeXIcon = BadgeXIcon;

  // (0) Siempre inyectar la dependencia
  private httpProduct = inject(HttpProduct);

  //Hook: Reconoce cuando se inicializa el componente
  ngOnInit() {
    //Obtener el listado de productos usando el servicio 
    this.httpProduct.getProduct().subscribe({
      next: ( data ) =>{
        console.log( data.data );
        this.productList$.next( data.data );    //Guarda los datos dentro de un observable creado por el behaviorSubject para desplegar los datos en el FrontEND del componente (HTML)
      },
      error: (err) => {
        console.error( err );
      },
      complete: () => {
        console.log ( 'Listar Productos' )
      }
    });
  }

}
