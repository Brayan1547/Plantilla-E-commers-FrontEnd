import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpCategory } from '../../../core/services/http-category';

import Swal from 'sweetalert2';

@Component({
  selector: 'app-category-edit-form',
  imports: [ReactiveFormsModule],
  templateUrl: './category-edit-form.html',
  styleUrl: './category-edit-form.css',
})
export default class CategoryEditForm {
  selecteId!: any;   //Evita que typeScript me obligue a definir el valor del atributo
  formData!: FormGroup;

  private activateRoute = inject(ActivatedRoute);
  private httpCategory = inject(HttpCategory);

  private router = inject(Router)

  constructor() {
    //Define la estructura equivalente del formulario en HTML
    this.formData = new FormGroup({
      name: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
      slug: new FormControl('', Validators.required),
      description: new FormControl('', [Validators.maxLength(50)])
    });
  }

  ngOnInit() {
    //Obtener el ID que se encuentra en la URL(solamente cuando el formulario de editar es un componente de pagina)
    this.selecteId = this.activateRoute.snapshot.paramMap.get('id')!;

    //Invocar al servicio que actualiza
    this.httpCategory.getCategoryById(this.selecteId).subscribe({
      next: (data: any) => {
        console.log(data.data.name);

        const { data: { name, slug, description } } = data;
        //Llenar los campos del formulario con los datos obtenidos por el ID de URL
        this.formData.patchValue({
          name,
          slug,
          description
        })
      },
      error: (err) => {
        console.error(err);
      },
      complete: () => {
        console.log('realiza la peticion para actualizar el usuario por ID')
      }
    });
  }

  onSubmit() {

    //Validas que el formulario (y sus campos) sean validos
    if (this.formData.valid) {
      console.log(this.formData.value);

      //Implementacion de la ventana Modal de sweetAlert2
      Swal.fire({
        title: "¿Estás seguro?",
        text: "¿Deseas guardar los cambios realizados en esta categoría?",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Sí, actualizar",
        cancelButtonText: "Cancelar"
      }).then((result) => {
        if (result.isConfirmed){ 
            Swal.fire({
              title: "¡Actualizado!",
              text: "La categoría se ha actualizado con éxito.",
              icon: "success"
            });

          this.httpCategory.updateCategotyById(this.selecteId, this.formData.value).subscribe({
            next: (data) => {
              console.log(data);
              this.router.navigateByUrl( '/dashboard/product-list')
            },
            error: (err) => {
              console.error(err)
            },
            complete: () => {
              console.log('actualiza la categoria')
            }
          })
      }
      });

      //Ejecutar el servicio que me permite actalizar los datos que se encuentran registrados en el formulario
      
    }
    else {
      console.log('formulario invalido')
    }
  }

  // Getters
  get name() {
    return this.formData.get('name')
  }

  get slug() {
    return this.formData.get('slug')
  }

  get description() {
    return this.formData.get('description')
  }
}