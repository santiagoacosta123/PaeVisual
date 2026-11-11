import { InstitucionAsignada } from '../core/auth/auth.service';

export function listaSedesDePagina(respuesta: unknown): any[] {
  if (Array.isArray(respuesta)) return respuesta;
  if (!respuesta || typeof respuesta !== 'object') return [];

  const pagina = respuesta as { results?: unknown; data?: unknown };
  if (Array.isArray(pagina.results)) return pagina.results;
  return Array.isArray(pagina.data) ? pagina.data : [];
}

export function urlSiguientePaginaSedes(respuesta: unknown, apiUrl: string): string | null {
  if (!respuesta || typeof respuesta !== 'object' || Array.isArray(respuesta)) return null;
  const siguiente = (respuesta as { next?: unknown }).next;
  if (typeof siguiente !== 'string' || !siguiente.trim()) return null;

  const url = new URL(siguiente, apiUrl);
  if (url.origin !== new URL(apiUrl).origin) {
    throw new Error('La paginación de sedes devolvió una URL fuera del servidor de la API.');
  }
  return url.toString();
}

export function idInstitucionDeSede(sede: any): number | null {
  const relacion = sede?.id_institucion ?? sede?.institucion;
  if (relacion == null) return null;

  const id = typeof relacion === 'object'
    ? relacion.id_institucion ?? relacion.id ?? relacion.pk
    : relacion;
  const idNumerico = Number(id);
  return Number.isFinite(idNumerico) ? idNumerico : null;
}

export function sedesDeInstitucion(sedes: any[], idInstitucion: number): any[] {
  return sedes.filter((sede) =>
    Number(idInstitucionDeSede(sede)) === Number(idInstitucion)
  );
}

export function normalizarInstitucionSupervisor(
  item: any,
  respaldo: InstitucionAsignada | undefined,
  sedesCargadas: boolean,
  todasLasSedes: any[],
): InstitucionAsignada {
  const idInstitucion = Number(item.id_institucion ?? item.id ?? respaldo?.id_institucion);
  return {
    id_institucion: idInstitucion,
    nombre_institucion: leerTexto(item, ['nombre_institucion', 'nombre'], respaldo?.nombre_institucion) ?? '',
    nit: leerTexto(item, ['nit', 'codigo_identificacion', 'codigo_institucion', 'codigo'], respaldo?.nit),
    sedes: sedesCargadas
      ? sedesDeInstitucion(todasLasSedes, idInstitucion)
      : leerSedes(item, respaldo?.sedes),
    representante_legal: leerTexto(item, ['representante_legal'], respaldo?.representante_legal),
    telefono: leerTexto(item, ['telefono'], respaldo?.telefono),
    correo_contacto: leerTexto(item, ['correo_contacto'], respaldo?.correo_contacto),
    estado: leerTexto(item, ['estado'], respaldo?.estado),
    administrador_asignado: leerAdministrador(item, respaldo?.administrador_asignado),
  };
}

function leerTexto(item: any, campos: string[], respaldo?: string): string | undefined {
  let campoDisponible = false;
  for (const campo of campos) {
    if (!Object.prototype.hasOwnProperty.call(item, campo)) continue;
    campoDisponible = true;
    const valor = item[campo];
    if (valor == null) continue;
    const texto = String(valor).trim();
    if (texto) return texto;
  }
  return campoDisponible ? undefined : respaldo;
}

function leerSedes(item: any, respaldo?: any[]): any[] {
  if (!Object.prototype.hasOwnProperty.call(item, 'sedes')) return respaldo ?? [];
  return Array.isArray(item.sedes) ? item.sedes : [];
}

function leerAdministrador(item: any, respaldo?: any): any {
  if (Object.prototype.hasOwnProperty.call(item, 'administrador_asignado')) {
    return item.administrador_asignado;
  }
  for (const campo of ['administrador', 'nombre_administrador', 'administrador_nombre']) {
    if (Object.prototype.hasOwnProperty.call(item, campo)) return item[campo];
  }
  return respaldo;
}
