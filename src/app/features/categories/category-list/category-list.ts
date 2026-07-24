import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { AsyncPipe, JsonPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { BehaviorSubject, Subscription } from 'rxjs';

import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import Swal from 'sweetalert2';
import { faCoffee, faPenToSquare } from '@fortawesome/free-solid-svg-icons';

import { HttpCategory } from '../../../core/services/http-category';


@Component({
  selector: 'app-category-list',
  imports: [AsyncPipe, JsonPipe, RouterLink, FontAwesomeModule],
  templateUrl: './category-list.html',
  styleUrl: './category-list.css',
})
export default class CategoryList {
  //atributos de iconos con fontawesomw
  faCoffee = faCoffee;
  faPenToSquare = faPenToSquare ;

  //Atributos de la logica del componente
  subscribeCategory!: Subscription;
  public categoryList$ = new BehaviorSubject<any>([]);

  private httpcategory = inject(HttpCategory);
  private router = inject(Router)

  // Hook: Saber cuando se inicializa el componente
  ngOnInit() {
    this.loadcategory();
  }

  ngOnDestroy() {
    //Verifica si existe una subscripcion activa y la desuscribe
    if (this.subscribeCategory) {
      this.subscribeCategory.unsubscribe();
    }
  }

  private loadcategory() {
    //Realizar la peticion de los datos en la API para que sean obtenidos antes que el componente cargue (visualmente)
    //Guarda la subscripcion al observable para tener control sobre ella
    this.subscribeCategory = this.httpcategory.getCategory().subscribe({
      next: (data) => {
        console.log(data);
        //Asignar la lista de categorias al observable
        this.categoryList$.next(data.data);   //Solo la lista de las categorias
      },
      error: (err) => {
        console.error(err);
      },
      complete: () => {
        console.log('Listar todas las categorias');
      }
    });
  }

  onEdit(id: string) {
    console.log(' Edit', id);
    //redirecciona
    this.router.navigate(['/category-edit', id]);
  }
  onDelete(id: string) {
    // 2. Implementar la ventana Modal de SweetAlert2
    Swal.fire({
      title: "¿Estás seguro?",
      text: "¿Deseas eliminar esta categoría?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, ¡bórralo!",
      cancelButtonText: "Cancelar"
    }).then((result) => {
      // 3. Validar si el usuario confirmó la acción
      if (result.isConfirmed) {
        // Ejecutar el servicio de eliminación dentro del bloque de confirmación
        this.httpcategory.deleteCategoryById(id).subscribe({
          next: (data) => {
            console.log(data);

            // Mostrar la alerta de éxito opcional
            Swal.fire({
              title: "¡Eliminado!",
              text: "La categoría ha sido eliminada con éxito.",
              icon: "success"
            });

            this.loadcategory();
          },
          error: (err) => {
            console.error(err);
          },
          complete: () => {
            console.log('Peticion al API para eliminar el usuairio ')
          }
        });
      }
    });

  }
}