import { Component, inject } from '@angular/core';
import { Router, RouterLink } from "@angular/router";
import { HttpProduct } from '../../../core/services/http-product';

import { BehaviorSubject } from 'rxjs';
import { AsyncPipe, JsonPipe } from '@angular/common';

//IMportamos la libreria de iconos de HugeIcons
import { HugeiconsIconComponent } from '@hugeicons/angular'
import { BadgeXIcon, Notification03Icon, CheckmarkBadge03Icon } from '@hugeicons/core-free-icons'

import { ToggleOffIcon, ToggleOnIcon } from '@hugeicons/core-free-icons';


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
   CheckmarkBadge03Icon = CheckmarkBadge03Icon

   ToggleOffIcon = ToggleOffIcon;
   ToggleOnIcon = ToggleOnIcon;


  // (0) Siempre inyectar la dependencia
  private httpProduct = inject(HttpProduct);
  private router = inject( Router)

  //Hook: Reconoce cuando se inicializa el componente
  ngOnInit() {
    this.onLoadData();
  }

  onLoadData() {
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

  onEdit(id: string) {
    console.log( 'Editar', id);
    this.router.navigateByUrl (`/dashboard/product-edit/${id}`)   //Redireccion Enviando el ID por la ruta
  }

  onDelete(id: string) {
    console.log( 'Eliminar' , id);
    this.httpProduct.deleteProduct( id ).subscribe({
      next: ( res ) => {
        console.log( res);
        this.onLoadData();
      },
      error: ( err ) => {
        console.error( err );
      },
      complete: () => {
        console.log( 'Execute Complete' );
      }
    });
  }

}
