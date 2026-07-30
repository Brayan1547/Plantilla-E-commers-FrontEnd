import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export default class Register {
  formData! : FormGroup;

  constructor(){
    this.formData = new FormGroup({
      name: new FormControl('', [
        Validators.required, 
        //Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/),
        Validators.minLength(2),
        Validators.maxLength(50)
      ]),
      nickname: new FormControl('', [
        Validators.required, 
        //Validators.pattern(/^[a-zA-Z0-9]+$/),
        Validators.minLength(3),
        Validators.maxLength(20)
      ]),
      email: new FormControl('', [
        Validators.required,
        //Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
      ]),
      password: new FormControl('', [Validators.required])
    });
    }
    onSubmit() {
    console.log('Registrarse', this.formData.value);
  }

  }

