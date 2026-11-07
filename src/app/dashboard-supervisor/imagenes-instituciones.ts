/**
 * Fotos de las tarjetas de instituciones.
 *
 * Los archivos están en la carpeta public/ de Angular, que se sirve desde la raíz
 * del sitio: public/institucion-1.png  ->  "/institucion-1.png"
 *
 * Se usan en orden (la 1.ª institución usa la foto 1, la 2.ª la foto 2, etc.).
 * Si hay más instituciones que fotos, se repiten desde la primera
 * (lo hace imagenDe() en dashboard-supervisor.ts).
 */
export const IMAGENES_INSTITUCION: string[] = [
  '/institucion-1.png',
  '/institucion-2.png',
  '/institucion-3.png',
  '/institucion-4.png',
  '/institucion-5.png',
];
