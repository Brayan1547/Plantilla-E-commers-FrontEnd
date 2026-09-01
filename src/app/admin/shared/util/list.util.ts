import type { SortState } from '../ui/data-table/data-table';

/**
 * Operaciones de listado en CLIENTE (búsqueda, filtros, orden, paginación).
 *
 * Necesario porque los endpoints de listado del backend devuelven el arreglo
 * COMPLETO sin `page`/`limit`/`sort`/`q`. La paginación server-side es PENDING
 * BACKEND. Se centraliza aquí para no duplicar la lógica en cada módulo.
 */

export interface ListQuery<T> {
  search: string;
  searchFields: (keyof T)[];
  /** Predicados de filtro; cada uno debe devolver true para conservar la fila. */
  filters: ((row: T) => boolean)[];
  sort: SortState | null;
  /** Extractor de valor para ordenar por una clave (fallback: row[key]). */
  sortAccessor?: (row: T, key: string) => unknown;
  page: number;
  pageSize: number;
}

export interface ListResult<T> {
  rows: T[];
  /** Total tras búsqueda+filtros (antes de paginar). */
  total: number;
  /** Página corregida si quedó fuera de rango. */
  page: number;
}

function norm(v: unknown): string {
  const decomposed = String(v ?? '').toLowerCase().normalize('NFD');
  // Elimina marcas diacríticas combinantes (U+0300–U+036F) por code point,
  // sin literales unicode en el fuente.
  let out = '';
  for (const ch of decomposed) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x0300 || cp > 0x036f) out += ch;
  }
  return out;
}

export function processList<T extends object>(
  source: readonly T[],
  q: ListQuery<T>,
): ListResult<T> {
  let rows = [...source];
  const get = (row: T, key: PropertyKey): unknown => (row as Record<PropertyKey, unknown>)[key];

  const term = norm(q.search).trim();
  if (term) {
    rows = rows.filter((row) => q.searchFields.some((f) => norm(get(row, f)).includes(term)));
  }

  for (const predicate of q.filters) {
    rows = rows.filter(predicate);
  }

  const total = rows.length;

  if (q.sort) {
    const { key, dir } = q.sort;
    const factor = dir === 'asc' ? 1 : -1;
    const accessor = q.sortAccessor ?? ((row: T, k: string) => get(row, k));
    rows.sort((a, b) => {
      const va = accessor(a, key);
      const vb = accessor(b, key);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor;
      if (typeof va === 'boolean' && typeof vb === 'boolean') {
        return (Number(va) - Number(vb)) * factor;
      }
      return norm(va).localeCompare(norm(vb)) * factor;
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / q.pageSize));
  const page = Math.min(Math.max(1, q.page), totalPages);
  const start = (page - 1) * q.pageSize;

  return { rows: rows.slice(start, start + q.pageSize), total, page };
}
