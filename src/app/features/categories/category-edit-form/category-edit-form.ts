import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpCategory } from '../../../core/services/http-category';

@Component({
  selector: 'app-category-edit-form',
  imports: [ReactiveFormsModule],
  templateUrl: './category-edit-form.html',
  styleUrl: './category-edit-form.css',
})
export default class CategoryEditForm implements OnInit {
  selecteId!:  any;   //Evita que typeScript me obligue a definir el valor del atributo
  formData!: FormGroup;

  private activateRoute = inject(ActivatedRoute);
  private httpCategory = inject(HttpCategory);

   constructor() {
    //Define la estructura equivalente del formulario en HTML
    this.formData = new FormGroup({
      name: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
      slug: new FormControl('', Validators.required),
      description: new FormControl('', [Validators.maxLength(50)])
    });
  }
  
  ngOnInit(){
    //Obtener el ID que se encuentra en la URL(solamente cuando el formulario de editar es un componente de pagina)
    this.selecteId = this.activateRoute.snapshot.paramMap.get('id')!;

        //Invocar al servicio que actualiza
    this.httpCategory.getCategoryById( this.selecteId ).subscribe({
      next: (data: any) => {
        console.log(data.data.name);

        const {data: {name, slug, description } } = data;
        //Llenar los campos del formulario con los datos obtenidos por el ID de URL
        this.formData.patchValue({
          name ,
          slug ,
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

  }
}