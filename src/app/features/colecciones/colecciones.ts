import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * COLECCIONES — sección pública de lanzamientos especiales de DUSCK.
 *
 * Concepto de negocio (definido por producto): ediciones especiales, temporales
 * y de unidades limitadas, con lanzamientos aproximadamente trimestrales.
 *
 * LIMITACIÓN BACKEND (R2.1 §14): el backend actual NO tiene un dominio de
 * colecciones. No existe `Collection`, `collectionId`, `releaseDate`,
 * `limitedUnits`, `unitsSold` ni estado de lanzamiento. Por eso esta página
 * NO lista "colecciones" ni muestra cifras de unidades, fechas o countdowns:
 * comunica el concepto y la estructura pública, sin inventar datos. Cuando
 * exista el dominio backend, aquí se conectará el listado real.
 */
@Component({
  selector: 'app-colecciones',
  imports: [RouterLink],
  templateUrl: './colecciones.html',
  styleUrl: './colecciones.css',
})
export default class Colecciones {}
