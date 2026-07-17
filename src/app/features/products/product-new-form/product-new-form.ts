import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ɵInternalFormsSharedModule, ReactiveFormsModule } from '@angular/forms';
import { HttpCategory } from '../../../core/services/http-category';
import { BehaviorSubject } from 'rxjs';
import { AsyncPipe, JsonPipe } from '@angular/common';

@Component({
  selector: 'app-product-new-form',
  imports: [ɵInternalFormsSharedModule, ReactiveFormsModule, AsyncPipe, JsonPipe],
  templateUrl: './product-new-form.html',
  styleUrl: './product-new-form.css',
})
export default class ProductNewForm {
  categoryList$ = new BehaviorSubject<any>([]);
  private httpCategory = inject( HttpCategory );    //Injectamos una dependencia 
  formData!: FormGroup;

  constructor(){
    this.formData = new FormGroup({
      name: new FormControl(),
      slug: new FormControl(),
      description: new FormControl(),
      price: new FormControl(),
      stock: new FormControl(),
      images:new FormControl(),
      category: new FormControl()
    });
  }

  //Hook del ciclo de vida del componente donde podemos detectar caundo este se esta inicializando, con intencion de programar acciones en este punto
  ngOnInit() {
    //Haga la consulta a la API, trayendo todas las categorias registradas en la DD
    this.httpCategory.getCategory().subscribe({
      next: (data) => {
        console.log( data );
        this.categoryList$.next ( data.data );    //Asigna el listado de categorias al obserable que desplegara los datos en el FrontEnd del componente
      },
      error: (err ) => {
        console.log( err );
      },
      complete: () => {
        console.log( 'Obtiene todas las categorias registradas en la API' );
      }
    });
  }

  onSubmit() {
    console.log(this.formData.value);   //Muestra todos los valores del formulario
  }
}
