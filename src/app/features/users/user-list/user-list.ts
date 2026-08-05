import { Component, inject } from '@angular/core';
import { AsyncPipe, JsonPipe } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

import { HttpUsers } from '../../../core/services/http-users';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [AsyncPipe, JsonPipe],
  templateUrl: './user-list.html',
  styleUrl: './user-list.css',
})
export default class UserList {
  users: any = {} ;


  public userList$ = new BehaviorSubject<any[]>([]);

  private httpUsers = inject(HttpUsers);
  private router = inject(Router);

  // ===========================
  // Variables del Modal
  // ===========================

  showDeleteModal = false;

  selectedUser: any = null;

  deleting = false;

  // ===========================

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {

    this.httpUsers.getUsers().subscribe({

      next: (data) => {

        console.log(data);

        this.userList$.next(data.data);

      },

      error: (err) => {

        console.error(err);

      }

    });

  }

  nuevoUsuario(): void {

    this.router.navigate(['/user-new']);

  }

  editarUsuario(id: string): void {

    this.router.navigate(['/user-edit', id]);

  }

  // ===========================
  // Abrir Modal
  // ===========================

  openDeleteModal(user: any): void {

    this.selectedUser = user;

    this.showDeleteModal = true;

  }

  // ===========================
  // Cerrar Modal
  // ===========================

  closeDeleteModal(): void {

    this.showDeleteModal = false;

    this.selectedUser = null;

  }

  // ===========================
  // Confirmar eliminación
  // ===========================

  confirmDelete(): void {

    if (!this.selectedUser) return;

    this.deleting = true;

    this.httpUsers.deleteUser(this.selectedUser._id).subscribe({

      next: () => {

        this.loadUsers();

        this.closeDeleteModal();

      },

      error: (err) => {

        console.error(err);

        alert('No fue posible eliminar el usuario.');

      },

      complete: () => {

        this.deleting = false;

      }

    });

  }

}