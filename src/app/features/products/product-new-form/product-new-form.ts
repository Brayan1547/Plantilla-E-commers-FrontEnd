import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ɵInternalFormsSharedModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpCategory } from '../../../core/services/http-category';
import { BehaviorSubject } from 'rxjs';
import { AsyncPipe, JsonPipe } from '@angular/common';
import { HttpProduct } from '../../../core/services/http-product';
import { Router } from '@angular/router';


@Component({
  selector: 'app-product-new-form',
  imports: [ɵInternalFormsSharedModule, ReactiveFormsModule, AsyncPipe, JsonPipe],
  templateUrl: './product-new-form.html',
  styleUrl: './product-new-form.css',
})
export default class ProductNewForm {
  categoryList$ = new BehaviorSubject<any>([]);
  private httpCategory = inject( HttpCategory );    //Injectamos una dependencia  (para obtener el listad)
  private httpProduct = inject( HttpProduct );    //Injectamos una dependencia para registrar producto
  private router = inject( Router);
  formData!: FormGroup;

  constructor(){
    this.formData = new FormGroup({
      name: new FormControl( '', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]),
      slug: new FormControl('', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/ ) ]),
      description: new FormControl( '', [Validators.maxLength(500) ] ),
      price: new FormControl( 0, [Validators.required, Validators.min(0)]),
      stock: new FormControl( 0, [Validators.required, Validators.min(0)]),
      images:new FormControl(),
      category: new FormControl('', [Validators.required])
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
    //Verificando si el formulario es valido
    if (this.formData.valid) {
      console.log( this.formData.value)

      this.httpProduct.createProduct( this.formData.value).subscribe({
        next: ( data ) => {
          console.log ( data );
          this.formData.reset();    //limpiar el formulario
          this.router.navigateByUrl('/product-list')  //redirecciono 
        },
        error: (err) => {
          console.error( err );
        },
        complete: () =>{
          console.log('Registra un producto')
        }
      });
    } else {
      console.log('El formulario no es valido', this.formData.value) //muestra todos los valores del formulario

  
    }
  }

  //Getters
  get name() {
    return this.formData.get('name')
  }

  get slug() {
    return this.formData.get('slug')
  }

  get description() {
    return this.formData.get('description')
  }

  get price() {
    return this.formData.get('price')
  }

  get stock() {
    return this.formData.get('stock')
  }

  get category() {
    return this.formData.get('category')
  }
}

