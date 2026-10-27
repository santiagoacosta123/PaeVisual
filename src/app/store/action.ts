import { createAction, props } from '@ngrx/store';

export const login = createAction(
  '[Auth] Login',
  props<{
    username: string;
    token: string;
    rol: string;
    nombre?: string;
    password?: string;
    mensaje?: string;
    id_usuario?: number;
    institucion?: string;
  }>()
);

export const logout = createAction('[Auth] Logout');

