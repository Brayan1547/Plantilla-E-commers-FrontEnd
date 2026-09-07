import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpAuth } from '../../../core/services/http-auth';


@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrls: ['./register.css', '../auth-forms.css'],
  // standalone (ruta /register): el host es la página centrada.
  // embebido (AuthModal): sin clase -> el modal aporta el layout.
  host: { '[class.auth-page]': '!embedded' },
})
export default class Register {
  private httpAut = inject(HttpAuth)
  formData! : FormGroup;

  /** Solo presentacional. `true` cuando Register se renderiza dentro de AuthModal. */
  @Input() embedded = false;

   @Output() switchToLogin = new EventEmitter<void>();
  @Output() registerSuccess = new EventEmitter<void>(); //avisa al modal que ya puede cerrarse


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
      next: () => {
         //inicia sesión automática con las mismas credenciales, y loginUser() ya redirige según el rol
        const { email, password } = this.formData.value;
        this.httpAut.loginUser({ email, password }).subscribe({
          next: () => this.registerSuccess.emit() // avisa al modal que cierre, si estaba abierto como modal
        });

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

