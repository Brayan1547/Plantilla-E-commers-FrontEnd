import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { email, maxLength, validate } from '@angular/forms/signals';
import { HttpRoles } from '../../../core/services/http-roles';
import { BehaviorSubject } from 'rxjs';
import { AsyncPipe, JsonPipe } from '@angular/common';

@Component({
  selector: 'app-user-new-form',
  imports: [ReactiveFormsModule, AsyncPipe, JsonPipe],
  templateUrl: './user-new-form.html',
  styleUrl: './user-new-form.css',
})
export class UserNewForm {
  private httpRoles = inject( HttpRoles );

  roleList$ =new BehaviorSubject([]);

  formData: FormGroup;
  
  constructor() {
    this.formData = new FormGroup({
      name: new FormControl('',[Validators.required,Validators.minLength(2),Validators.maxLength(50)]),
      nickname: new FormControl('',[Validators.required,Validators.minLength(3),Validators.maxLength(20)]),
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [Validators.required]),
      role: new FormControl('subscriber',[Validators.required]),
      status: new FormControl( true ),
      avatar: new FormControl('')
    })
  }

  onSubmint() {

    console.group('Estados del campo email');
    console.log('valid', this.formData.get('name')?.valid);
    console.log('valid', this.formData.get('email')?.valid);
    console.groupEnd();

    if(this.formData.valid){
      console.log(this.formData.value);
    }

    else {
      console.log("Formulario invalido")
    }
  }

  ngOnInit () {
    this.httpRoles.getRoles().subscribe({
      next: (roles) => {
        console.log ( roles );
        this.roleList$.next (roles.data);
      },
      error: ( err ) => {
        console.error( err );
      },
      complete: () => {
        console.log("Complemente siempre el ejecutor")
      }
    });
  }

}
