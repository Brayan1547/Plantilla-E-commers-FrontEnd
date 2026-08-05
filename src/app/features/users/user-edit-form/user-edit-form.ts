import { Component, inject } from '@angular/core';
import { AsyncPipe, JsonPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ActivatedRoute, Router } from '@angular/router';

import { BehaviorSubject } from 'rxjs';

import { HttpRoles } from '../../../core/services/http-roles';
import { HttpUsers } from '../../../core/services/http-users';


@Component({
  selector: 'app-user-edit-form',
  standalone: true,
  imports: [ReactiveFormsModule, AsyncPipe, JsonPipe],
  templateUrl: './user-edit-form.html',
  styleUrl: './user-edit-form.css',
})
export default class UserEditForm {
  private httpRoles = inject(HttpRoles);
  private httpUsers = inject(HttpUsers);

  private activateRoute = inject(ActivatedRoute);
  private router = inject(Router);

  formData!: FormGroup;

  roleList$ = new BehaviorSubject<any[]>([]);

  userId!: any;

  loading = false;

  constructor() {
    this.formData = new FormGroup({
      name: new FormControl('', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50),
      ]),

      nickname: new FormControl('', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(20),
      ]),

      email: new FormControl('', [Validators.required, Validators.email]),

      password: new FormControl(''),

      role: new FormControl('subscriber', [Validators.required]),

      status: new FormControl(true),

      avatar: new FormControl(''),
    });
  }

  ngOnInit(): void {
  this.cargarRoles();

  this.activateRoute.paramMap.subscribe(params => {
    this.userId = params.get('id');

    console.log('ID:', this.userId);

    if (this.userId) {
      this.obtenerUsuario();
    }
  });
}

  cargarRoles(): void {
    this.httpRoles.getRoles().subscribe({
      next: (roles: any) => {
        this.roleList$.next(roles.data);
      },

      error: (err) => {
        console.error(err);
      },
    });
  }

  obtenerUsuario(): void {
    this.loading = true;

    this.httpUsers.getUserById(this.userId).subscribe({
      next: (response: any) => {
        console.log(response);

        const user = response.data;

        this.formData.patchValue({

          name: user.name,

          nickname: user.nickname,

          email: user.email,

          role: user.role,

          status: user.status,

          avatar: user.avatar

        });
      },

      error: (err) => {
        console.error(err);
      },

      complete: () => {
        this.loading = false;
      },
    });
  }

  guardarCambios(): void {
    if (this.formData.invalid) {
      this.formData.markAllAsTouched();

      return;
    }

    const user = {
      ...this.formData.value,
    };

    // Si la contraseña quedó vacía,
    // no la enviamos al backend.
    if (!user.password) {
      delete user.password;
    }

    this.loading = true;

    this.httpUsers
      .updateUser(
        this.userId,

        user,
      )
      .subscribe({
        next: () => {
          alert('Usuario actualizado correctamente.');

          this.router.navigate(['/user/list']);
        },

        error: (err) => {
          console.error(err);

          alert('Error al actualizar el usuario.');
        },

        complete: () => {
          this.loading = false;
        },
      });
  }

  cancelar(): void {
    this.router.navigate(['/user/list']);
  }
}


