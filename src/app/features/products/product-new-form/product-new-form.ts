import { Component } from '@angular/core';
import { FormControl, FormGroup, ɵInternalFormsSharedModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-product-new-form',
  imports: [ɵInternalFormsSharedModule, ReactiveFormsModule],
  templateUrl: './product-new-form.html',
  styleUrl: './product-new-form.css',
})
export default class ProductNewForm {
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

  onSubmit() {
    console.log(this.formData.value);   //Muestra todos los valores del formulario
  }
}
