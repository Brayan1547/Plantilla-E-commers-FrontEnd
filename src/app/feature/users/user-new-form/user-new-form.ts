import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { email } from '@angular/forms/signals';

@Component({
  selector: 'app-user-new-form',
  imports: [ReactiveFormsModule],
  templateUrl: './user-new-form.html',
  styleUrl: './user-new-form.css',
})
export class UserNewForm {
  formData: FormGroup;
  
  constructor() {
    this.formData = new FormGroup({
      name: new FormControl(),
      nickname: new FormControl(),
      email: new FormControl(),
      password: new FormControl(),
      role: new FormControl(),
      status: new FormControl(),
      avatar: new FormControl()
    })
  }

  onSubmint() {
    console.log(this.formData.value);
  }

}
