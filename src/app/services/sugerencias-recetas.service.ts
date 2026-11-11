import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface IngredienteSugerido {
  id_ingrediente: number;
  nombre: string;
  cantidad_por_nino: string;
  cantidad_total: string;
  unidad: string;
  cantidad_disponible: string | null;
  alcanza: boolean;
  unidad_compatible: boolean;
}

export interface SugerenciaReceta {
  id_menu: number;
  id_plato: number;
  nombre_plato: string;
  ninos_presentes: number;
  ingredientes: IngredienteSugerido[];
  es_sugerencia: true;
}

@Injectable({ providedIn: 'root' })
export class SugerenciasRecetasService {
  private readonly apiUrl = `${environment.apiUrl}/ia/sugerencias-recetas/`;

  constructor(private http: HttpClient) {}

  sugerir(idMenu: number, idPlato: number): Observable<SugerenciaReceta> {
    return this.http.post<SugerenciaReceta>(this.apiUrl, {
      id_menu: idMenu,
      id_plato: idPlato,
    });
  }
}
