import { Component, EventEmitter, inject, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpAuth } from '../../../core/services/http-auth';


@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export default class Register {
  private httpAut = inject(httpAuth)
  formData! : FormGroup;

   @Output() switchToLogin = new EventEmitter<void>();


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
    // console.log('Registrarse', this.formData.value);
    this.httpAut.registerUser(this.formData.value).subscribe({
      next: ( res ) => {
         console.log('Usuario registrado:', res);
      },
      error: ( err ) => {
        console.error('Error al registrar:', err);
      },
      complete: () => {
        console.log('Petición de registro finalizada');
      }
    })


    
  }

  get name() { return this.formData.get('name'); }
  get nickname() { return this.formData.get('nickname'); }
  get email() { return this.formData.get('email'); }
  get password() { return this.formData.get('password'); }

  }

