import { createReducer, on } from '@ngrx/store';
import { login, logout } from './action';

export interface AuthState {
  username: string;
  nombre: string;
  token: string;
  rol: string;
  id_usuario: number;
  institucion: string;
  mensaje: string;
  autenticado: boolean;
}

function esTokenExpirado(token: string): boolean {
  if (!token) return true;
  const partes = token.split('.');
  if (partes.length !== 3) return false;
  try {
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (typeof payload.exp === 'number') {
      const ahoraSegundos = Math.floor(Date.now() / 1000);
      return payload.exp <= ahoraSegundos;
    }
    return false;
  } catch {
    return false;
  }
}

function obtenerEstadoInicial(): AuthState {
  try {
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('access_token') || localStorage.getItem('token') || '';
      const usuarioRaw = localStorage.getItem('usuario');
      if (token && usuarioRaw && !esTokenExpirado(token)) {
        const usuario = JSON.parse(usuarioRaw);
        return {
          username: usuario.correo || '',
          nombre: `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || usuario.correo || '',
          token,
          rol: usuario.rol || '',
          id_usuario: usuario.id_usuario || 0,
          institucion: usuario.institucion_nombre || usuario.institucion || '',
          mensaje: '',
          autenticado: true,
        };
      }
    }
  } catch {
    // En caso de SSR o error de parsing, fallback a estado vacío
  }
  return {
    username: '',
    nombre: '',
    token: '',
    rol: '',
    id_usuario: 0,
    institucion: '',
    mensaje: '',
    autenticado: false,
  };
}

export const inicializarEstados: AuthState = obtenerEstadoInicial();

export const authReduce = createReducer(
  inicializarEstados,
  on(login, (state: AuthState, datos: any): AuthState => ({
    ...state,
    username: datos.username,
    nombre: datos.nombre || datos.username,
    token: datos.token,
    rol: datos.rol,
    id_usuario: datos.id_usuario || 0,
    institucion: datos.institucion || '',
    mensaje: datos.mensaje || '',
    autenticado: true,
  })),
  on(logout, (): AuthState => ({
    username: '',
    nombre: '',
    token: '',
    rol: '',
    id_usuario: 0,
    institucion: '',
    mensaje: '',
    autenticado: false,
  }))
);