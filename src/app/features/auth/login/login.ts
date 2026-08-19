import { Component, EventEmitter, inject, Output,  } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpAuth } from '../../../core/services/http-auth';


@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export default class Login {
  httpAuth = inject(HttpAuth)
  formData!: FormGroup;


  @Output() loginSuccess = new EventEmitter<void>();   // Avisa  (auth-modal) que el login fue exitoso, para que se cierre el modal
  @Output() switchToRegister = new EventEmitter<void>();    // Avisa que el usuario quiere cambiar a la pestaña de registro

  constructor() {
    this.formData = new FormGroup({
      email: new FormControl('', [Validators.required]),
      password: new FormControl('', [Validators.required])
    });
  }

  onSubmit() {
    if (this.formData.valid) {
      console.log(this.formData.value)

      this.httpAuth.loginUser(this.formData.value).subscribe({
        next: ( res ) => {
          console.log( res )

          this.formData.reset();
          this.loginSuccess.emit(); // Dispara el evento loginSuccess solo cuando el login respondió bien
        },
        error: ( err ) => {
          console.error( err );
        },
        complete: () => {
          console.log( 'Execute complete');
        }
      })
    } else {
      console.log('Formulario invalido')
    }
  }

  get email() { return this.formData.get('email'); }    // Getter para acceder al control 'email' desde el HTML y mostrar sus errores
  get password() { return this.formData.get('password'); }  // Getter para acceder al control 'password' desde el HTML y mostrar sus errores

}
