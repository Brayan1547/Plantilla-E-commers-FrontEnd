import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { HttpCategory } from '../../../core/services/http-category';

import { BehaviorSubject, Subscription } from 'rxjs';
import { AsyncPipe, JsonPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';


@Component({
  selector: 'app-category-list',
  imports: [AsyncPipe, JsonPipe, RouterLink],
  templateUrl: './category-list.html',
  styleUrl: './category-list.css',
})
export default class CategoryList implements OnInit, OnDestroy {
  subscribeCategory!: Subscription;
  public categoryList$ = new BehaviorSubject<any>([]);

  private httpcategory = inject(HttpCategory);
  private router =inject(Router )

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
    // console.log('Delete', id);
    this.httpcategory.deleteCategoryById(id).subscribe({
      next: (data) => {
        console.log(data);
        this.loadcategory();
      },
      error: (err) => {
        console.error(err);
      },
      complete: () => {
        console.log('Peticion al API para eliminar el usuairio ')
      }
    })
  }
}