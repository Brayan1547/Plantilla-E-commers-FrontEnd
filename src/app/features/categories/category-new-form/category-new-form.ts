import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-category-new-form',
  imports: [ReactiveFormsModule],
  templateUrl: './category-new-form.html',
  styleUrl: './category-new-form.css',
})
export class CategoryNewForm {
  formData:FormGroup

  constructor(){
    //Define la estructura equivalente del formulario en HTML
    this.formData = new FormGroup({
      name: new FormControl(),
      slug: new FormControl(),
      description: new FormControl()
    });
  }
  
  onSubmit() {
    //Muestro los valores
    console.log(this.formData.value);
  }

}
