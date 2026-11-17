/** Formateo compartido para las tablas del panel. */

const DATE_FMT = new Intl.DateTimeFormat('es-CO', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});

const DATETIME_FMT = new Intl.DateTimeFormat('es-CO', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : DATE_FMT.format(d);
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : DATETIME_FMT.format(d);
}

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function formatCurrencyCOP(value: number): string {
  return Number.isFinite(value) ? COP.format(value) : '—';
}

/** Slug sugerido a partir de un texto (mismo patrón que exige el backend). */
export function slugify(text: string): string {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .split('')
    .filter((ch) => {
      const cp = ch.codePointAt(0)!;
      return cp < 0x0300 || cp > 0x036f;
    })
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}


/** 'AAAA-MM-DD' -> fecha legible, sin desfase por zona horaria. */
export function formatDateOnly(value?: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '—';
  const [y, m, d] = value.split('-').map(Number);
  return DATE_FMT.format(new Date(y, m - 1, d));
}