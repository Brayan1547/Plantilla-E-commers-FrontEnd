import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpAuth } from '../../../core/services/http-auth';


@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export default class Login {
  httpAuth = inject(httpAuth)
  formData!: FormGroup;

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
}
