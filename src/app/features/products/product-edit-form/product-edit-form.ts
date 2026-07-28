import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject } from 'rxjs';
import { HttpCategory } from '../../../core/services/http-category';
import { AsyncPipe, JsonPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpProduct } from '../../../core/services/http-product';

@Component({
  selector: 'app-product-edit-form',
  imports: [ReactiveFormsModule , AsyncPipe, JsonPipe],
  templateUrl: './product-edit-form.html',
  styleUrl: './product-edit-form.css',
})
export default class ProductEditForm {

  selecteId!: string | null;   //Atributo donde vamos almacenar el ID del documento que vamos a editar 
  formData!: FormGroup;
  categoryList$ = new BehaviorSubject<any>([])
  private httpCategory = inject(HttpCategory)
  private activateRoute = inject(ActivatedRoute)
  private httpProduct = inject(HttpProduct)
  private router = inject(Router)

  constructor() {
    this.formData = new FormGroup({
      name: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]),
      slug: new FormControl('', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]),
      description: new FormControl('', [Validators.maxLength(500)]),
      price: new FormControl(0, [Validators.required, Validators.min(0)]),
      stock: new FormControl(0, [Validators.required, Validators.min(0)]),
      images: new FormControl(),
      category: new FormControl('', [Validators.required])
    });
  }

  
  //Hook del ciclo de vida del componente donde podemos detectar caundo este se esta inicializando, con intencion de programar acciones en este punto
  ngOnInit() {
    //Ontener el ID de la ruta y lo guardamos en el atributo de clase
    this.selecteId = this.activateRoute.snapshot.paramMap.get( 'id' );
    // console.log( this.selecteId )

    //Consulatr si el documento existe y lo traemos por su ID
    this.httpProduct.getProductById( this.selecteId ).subscribe({
      next: ( data ) => {
        console.log( data.data );

        const {name, slug, description, price, stock, images, category} = data.data

        //Actualizar los valores de los campos del formulario
        this.formData.patchValue({
          name,
          slug,
          description,
          price,
          stock,
          images,
          category
        });
      },
      error: ( err ) => {
        console.error( err )
      },
      complete: () => {
        console.log( 'Execute complete' )
      }
    })

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
    //Validar si el formulario es valido 
    if (this.formData.valid) {
      console.log( this.formData.value );

      //Enviamos los datos al servicio para que los envie ala API y actulice el documento
      this.httpProduct.updateProductById( this.selecteId, this.formData.value).subscribe({
        next: ( data ) => {
          console.log( data );
          this.router.navigateByUrl( '/product-list')

        },
        error: ( err ) => {
          console.log( err );
        },
        complete:() => {
          console.log( 'Execute complete')
        }
      })

    } else {
      console.log('El formulario no es valido');
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
