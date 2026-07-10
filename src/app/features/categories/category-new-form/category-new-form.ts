
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpCategory } from '../../../core/services/http-category';


@Component({
  selector: 'app-category-new-form',
  imports: [ReactiveFormsModule],
  templateUrl: './category-new-form.html',
  styleUrl: './category-new-form.css',
})
export class CategoryNewForm {
  formData: FormGroup;
  private httpCategory = inject(HttpCategory);

  constructor() {
    //Define la estructura equivalente del formulario en HTML
    this.formData = new FormGroup({
      name: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
      slug: new FormControl('', Validators.required),
      description: new FormControl('', [Validators.maxLength(50)])
    });
  }

  onSubmit() {

    console.group('Estados del campo del formulario');
    console.log('valid (name)', this.formData.get('name')?.valid);
    console.groupEnd;

    //Verificar si el formulario es valido
    if (this.formData.valid) {
      //Muestro los valores
      console.log(this.formData.value);
      this.httpCategory.createCategory(this.formData.value).subscribe({
        next: (res) => {
          console.log(res);
          this.formData.reset()   //Para Limpiar el formulario
        },
        error: (error) => {
          console.error(error);
        },
        complete: () => {
          console.log('complete execute');

        }
      });
    }
    else {
      console.log(' formulario no valido')
    }
  }

}
