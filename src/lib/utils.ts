import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Campaña activa en base a la fecha actual. 20/5 → 19/5 */
export function getCampanaActual(): { nombre: string; anio: number } {
  const hoy = new Date();
  const mes = hoy.getMonth() + 1; // 1-12
  const dia = hoy.getDate();
  const anio = hoy.getFullYear();
  const inicio = mes > 5 || (mes === 5 && dia >= 20);
  const anioInicio = inicio ? anio : anio - 1;
  return { nombre: `${anioInicio}/${anioInicio + 1}`, anio: anioInicio };
}

export function getCampanaFromAnio(anio: number) {
  return {
    nombre: `${anio}/${anio + 1}`,
    fecha_inicio: `${anio}-05-20`,
    fecha_fin: `${anio + 1}-05-19`,
  };
}

export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
