import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import { EntregasService, Entrega } from '../features/entregas/services/entregas.service';
import { AsistenciaDiariaService } from './asistencia-diaria.service';
import { SiraeService } from '../features/contratos/services/contratos_pae.service';

export interface GramajeNivel {
  preescolar: number;
  primaria13: number;
  primaria45: number;
  secundaria: number;
  media: number;
}

export interface FilaNoPerecedero {
  id: number;
  alimento: string;
  gramajes: GramajeNivel;
  unidad: string;
  cantidadEntregar: number;
  cantidadRecibida: number;
  observaciones?: string;
}

export interface EntregaPerecedero {
  aEntregar: number;
  recibida: number;
}

export interface FilaPerecedero {
  id: number;
  alimento: string;
  gramajes: GramajeNivel;
  unidad: string;
  entregas: [EntregaPerecedero, EntregaPerecedero, EntregaPerecedero, EntregaPerecedero];
  totalEntregado: number;
  totalRecibido: number;
  observaciones?: string;
}

export interface FilaAseo {
  id: number;
  item: string;
  unidad: string;
  cantidadEntregar: number;
  cantidadRecibida: number;
  observaciones?: string;
}

export interface CuposNivel {
  preescolar: number;
  primaria13: number;
  primaria45: number;
  secundaria: number;
  media: number;
  totalCupos: number;
  racionesTotales: number;
}

export interface FirmasPlanilla {
  manipuladoraNombre: string;
  manipuladoraCedula: string;
  rectorNombre: string;
  rectorCedula: string;
  rectorTelefono: string;
  rectorCargo: string;
  operadorNombre: string;
  operadorCedula: string;
  operadorTelefono: string;
  operadorCargo: string;
}

export interface PlanillaRemisionData {
  municipio: string;
  periodo: string;
  fechaInicio: string;
  fechaTerminacion: string;
  contratoNumero: string;
  operador: string;
  institucionEducativa: string;
  sede: string;
  codigoDane: string;
  modalidad: string;
  tipo: string;
  diasAtender: number;
  cupos: CuposNivel;
  ciclosMenus: string;
  noPerecederos: FilaNoPerecedero[];
  perecederos: FilaPerecedero[];
  aseo: FilaAseo[];
  firmas: FirmasPlanilla;
}

export interface DiaSalida {
  diaSemana: 'L' | 'M' | 'M' | 'J' | 'V';
  diaNumero: number;
  fecha: string;
  cantidad: number;
}

export interface SemanaSalida {
  semanaNumero: number;
  dias: DiaSalida[];
}

export interface FilaKardex {
  id: number;
  alimento: string;
  fechaEntrada: string;
  menu: string;
  cantidadEntrada: number;
  unidad: string;
  semanas: [SemanaSalida, SemanaSalida, SemanaSalida, SemanaSalida];
  totalSalidas: number;
  saldoMes: number;
}

export interface PlanillaKardexData {
  municipio: string;
  institucionEducativa: string;
  sede: string;
  periodo: string;
  fechaInicio: string;
  fechaTerminacion: string;
  filas: FilaKardex[];
  firmas: FirmasPlanilla;
}

export interface ItemMinutaPatron {
  grupo: 'NO PERECEDEROS' | 'CÁRNICOS Y PROTEÍNAS' | 'VERDURAS Y TUBÉRCULOS' | 'FRUTAS' | 'LÁCTEOS Y HUEVOS' | 'ASEO';
  alimento: string;
  unidad: string;
  gramajes: GramajeNivel;
  calculoMesGramos: number;
}

@Injectable({
  providedIn: 'root'
})
export class PlanillasPaeService {

  // Listado oficial extraído fielmente de los formatos de la Alcaldía de Popayán PAE
  private readonly NO_PERECEDEROS_BASE: Array<{ alimento: string; gramajes: GramajeNivel; unidad: string; baseMes: number }> = [
    { alimento: 'ACEITE', gramajes: { preescolar: 27, primaria13: 38, primaria45: 49, secundaria: 63, media: 77 }, unidad: 'ml', baseMes: 59 },
    { alimento: 'PANELA', gramajes: { preescolar: 40, primaria13: 40, primaria45: 50, secundaria: 60, media: 70 }, unidad: 'g', baseMes: 34 },
    { alimento: 'ARROZ', gramajes: { preescolar: 67, primaria13: 127, primaria45: 158, secundaria: 213, media: 247 }, unidad: 'g', baseMes: 278 },
    { alimento: 'HARINA DE TRIGO', gramajes: { preescolar: 42, primaria13: 42, primaria45: 54, secundaria: 81, media: 95 }, unidad: 'g', baseMes: 24 },
    { alimento: 'PASTA', gramajes: { preescolar: 32, primaria13: 40, primaria45: 50, secundaria: 60, media: 70 }, unidad: 'g', baseMes: 21 },
    { alimento: 'CABELLO DE ÁNGEL', gramajes: { preescolar: 5, primaria13: 5, primaria45: 7, secundaria: 10, media: 10 }, unidad: 'g', baseMes: 12 },
    { alimento: 'AZÚCAR', gramajes: { preescolar: 17, primaria13: 19, primaria45: 19, secundaria: 25, media: 25 }, unidad: 'g', baseMes: 30 },
    { alimento: 'AVENA EN HOJUELAS', gramajes: { preescolar: 22, primaria13: 12, primaria45: 15, secundaria: 15, media: 20 }, unidad: 'g', baseMes: 24 },
    { alimento: 'SAL', gramajes: { preescolar: 10, primaria13: 20, primaria45: 12, secundaria: 15, media: 20 }, unidad: 'g', baseMes: 11 },
    { alimento: 'MANTEQUILLA', gramajes: { preescolar: 3, primaria13: 4, primaria45: 6, secundaria: 6, media: 6 }, unidad: 'g', baseMes: 7 },
    { alimento: 'HARINA DE MAÍZ AMARILLO', gramajes: { preescolar: 40, primaria13: 40, primaria45: 50, secundaria: 60, media: 65 }, unidad: 'g', baseMes: 21 },
    { alimento: 'POLVO DE HORNEAR', gramajes: { preescolar: 0.5, primaria13: 0.5, primaria45: 0.5, secundaria: 0.5, media: 0.5 }, unidad: 'g', baseMes: 227 },
    { alimento: 'MAYONESA', gramajes: { preescolar: 0.5, primaria13: 0.5, primaria45: 0.5, secundaria: 0.5, media: 0.5 }, unidad: 'g', baseMes: 114 },
    { alimento: 'BOLI QUESILLO / BOCADILLO', gramajes: { preescolar: 30, primaria13: 30, primaria45: 30, secundaria: 30, media: 30 }, unidad: 'UND', baseMes: 227 },
    { alimento: 'GALLETAS DULCES KRAKER', gramajes: { preescolar: 50, primaria13: 50, primaria45: 50, secundaria: 60, media: 60 }, unidad: 'UND', baseMes: 33 },
    { alimento: 'GALLETA SODA', gramajes: { preescolar: 50, primaria13: 50, primaria45: 50, secundaria: 50, media: 50 }, unidad: 'UND', baseMes: 227 },
    { alimento: 'AREQUIPE', gramajes: { preescolar: 0.5, primaria13: 0.5, primaria45: 0.5, secundaria: 0.5, media: 0.5 }, unidad: 'UND', baseMes: 7 },
    { alimento: 'CHOCOLATE EN AZÚCAR', gramajes: { preescolar: 15, primaria13: 15, primaria45: 18, secundaria: 20, media: 20 }, unidad: 'g', baseMes: 23 },
    { alimento: 'LENTEJA', gramajes: { preescolar: 26, primaria13: 25, primaria45: 20, secundaria: 45, media: 53 }, unidad: 'g', baseMes: 40 },
    { alimento: 'FRÍJOL', gramajes: { preescolar: 16, primaria13: 25, primaria45: 30, secundaria: 45, media: 53 }, unidad: 'g', baseMes: 27 },
    { alimento: 'YOGUR', gramajes: { preescolar: 175, primaria13: 175, primaria45: 175, secundaria: 175, media: 175 }, unidad: 'ml', baseMes: 227 },
    { alimento: 'LECHE LICUADA / LÍQUIDA', gramajes: { preescolar: 100, primaria13: 100, primaria45: 100, secundaria: 100, media: 100 }, unidad: 'ml', baseMes: 393 }
  ];

  private readonly PERECEDEROS_BASE: Array<{ alimento: string; gramajes: GramajeNivel; unidad: string; baseSemanal: number[] }> = [
    { alimento: 'CARNE CERDO', gramajes: { preescolar: 40, primaria13: 40, primaria45: 50, secundaria: 70, media: 80 }, unidad: 'g', baseSemanal: [0, 0, 10830, 0] },
    { alimento: 'CARNE DE POLLO PECHUGA CON PIEL', gramajes: { preescolar: 70, primaria13: 70, primaria45: 75, secundaria: 90, media: 90 }, unidad: 'g', baseSemanal: [16945, 0, 16945, 16945] },
    { alimento: 'CARNE DE RES', gramajes: { preescolar: 50, primaria13: 50, primaria45: 60, secundaria: 80, media: 80 }, unidad: 'g', baseSemanal: [0, 13100, 0, 0] },
    { alimento: 'HUEVOS', gramajes: { preescolar: 55, primaria13: 55, primaria45: 55, secundaria: 55, media: 55 }, unidad: 'UND', baseSemanal: [454, 269.4, 227, 227] },
    { alimento: 'PAPA (ACOMPAÑANTE)', gramajes: { preescolar: 80, primaria13: 100, primaria45: 150, secundaria: 200, media: 250 }, unidad: 'g', baseSemanal: [4.9, 4.9, 4.9, 34.1] },
    { alimento: 'HABICHUELA', gramajes: { preescolar: 10.5, primaria13: 12, primaria45: 12, secundaria: 20, media: 25 }, unidad: 'g', baseSemanal: [0, 0, 3.0, 1.5] },
    { alimento: 'VERDURA (CEBOLLA CABEZONA ACOMPAÑANTE)', gramajes: { preescolar: 12.6, primaria13: 14.4, primaria45: 16.2, secundaria: 24.2, media: 29.2 }, unidad: 'g', baseSemanal: [2.74, 1.3, 3.2, 4.0] },
    { alimento: 'AJO CRUDO', gramajes: { preescolar: 0.2, primaria13: 0.2, primaria45: 0.2, secundaria: 0.2, media: 0.2 }, unidad: 'g', baseSemanal: [0, 45.4, 90.8, 0] },
    { alimento: 'VERDURA (CEBOLLA JUNCA)', gramajes: { preescolar: 3, primaria13: 3, primaria45: 6, secundaria: 6, media: 6 }, unidad: 'g', baseSemanal: [0.99, 0, 0, 1.0] },
    { alimento: 'VERDURA (TOMATE ACOMPAÑANTE)', gramajes: { preescolar: 10, primaria13: 11, primaria45: 12, secundaria: 20, media: 20 }, unidad: 'g', baseSemanal: [2.85, 1.5, 2.9, 5.7] },
    { alimento: 'VERDURA (ZANAHORIA ACOMPAÑANTE)', gramajes: { preescolar: 11, primaria13: 12, primaria45: 12, secundaria: 20, media: 25 }, unidad: 'g', baseSemanal: [0, 0, 1.5, 1.5] },
    { alimento: 'FRUTA (MANGO)', gramajes: { preescolar: 220, primaria13: 220, primaria45: 240, secundaria: 240, media: 240 }, unidad: 'g', baseSemanal: [0, 27.2, 27.2, 0] },
    { alimento: 'FRUTA (GUAYABA MADURA)', gramajes: { preescolar: 80, primaria13: 80, primaria45: 80, secundaria: 100, media: 133 }, unidad: 'g', baseSemanal: [18.88, 0, 0, 0] },
    { alimento: 'FRUTA (TOMATE DE ÁRBOL)', gramajes: { preescolar: 75, primaria13: 75, primaria45: 75, secundaria: 75, media: 75 }, unidad: 'g', baseSemanal: [17.03, 0, 0, 0] },
    { alimento: 'FRUTA (MANDARINA)', gramajes: { preescolar: 134, primaria13: 134, primaria45: 134, secundaria: 166, media: 166 }, unidad: 'UND', baseSemanal: [0, 0, 227, 0] },
    { alimento: 'FRUTA (PAPAYA)', gramajes: { preescolar: 115, primaria13: 157, primaria45: 157, secundaria: 165, media: 200 }, unidad: 'g', baseSemanal: [0, 35.6, 0, 35.6] },
    { alimento: 'FRUTA (NARANJA)', gramajes: { preescolar: 134, primaria13: 134, primaria45: 134, secundaria: 166, media: 166 }, unidad: 'UND', baseSemanal: [0, 227, 0, 0] },
    { alimento: 'FRUTA (MANZANA)', gramajes: { preescolar: 129, primaria13: 129, primaria45: 129, secundaria: 153, media: 165 }, unidad: 'UND', baseSemanal: [0, 0, 227, 0] },
    { alimento: 'FRUTA (BANANO)', gramajes: { preescolar: 100, primaria13: 157, primaria45: 157, secundaria: 185, media: 200 }, unidad: 'UND', baseSemanal: [35.22, 0, 0, 0] }
  ];

  private readonly ASEO_BASE: Array<{ item: string; unidad: string; baseMes: number }> = [
    { item: 'Esponja plástica', unidad: 'Und', baseMes: 8 },
    { item: 'Jabón industrial (pH neutro)', unidad: '1000 CC', baseMes: 12 },
    { item: 'Esponja abrasiva (alambre)', unidad: 'Und', baseMes: 10 },
    { item: 'Papel higiénico', unidad: 'Und', baseMes: 4 },
    { item: 'Jabón líquido para manos', unidad: '250 CC', baseMes: 4 },
    { item: 'Desinfectante bucidí', unidad: '1000 CC', baseMes: 8 },
    { item: 'Bolsas plásticas biodegradables para residuos', unidad: 'Und', baseMes: 32 }
  ];

  private readonly KARDEX_ALIMENTOS_BASE: Array<{ alimento: string; unidad: string; entrada: number; menu: string }> = [
    { alimento: 'VINAGRE', unidad: 'ml', entrada: 393, menu: 'Menú 1' },
    { alimento: 'LECHE LÍQUIDA', unidad: 'ml', entrada: 7100, menu: 'Menú 1' },
    { alimento: 'CARNE RES MAGRA', unidad: 'g', entrada: 11020, menu: 'Menú 2' },
    { alimento: 'CARNE DE CERDO', unidad: 'g', entrada: 51720, menu: 'Menú 3' },
    { alimento: 'CARNE DE POLLO, PECHUGA', unidad: 'g', entrada: 1198.3, menu: 'Menú 4' },
    { alimento: 'HUEVOS', unidad: 'UND', entrada: 454, menu: 'Menú 1' },
    { alimento: 'ORÉGANO', unidad: 'g', entrada: 49.9, menu: 'Condimento' },
    { alimento: 'PAPA CRIOLLA', unidad: 'g', entrada: 11.4, menu: 'Acompañante' },
    { alimento: 'PAPA (ACOMPAÑANTE)', unidad: 'g', entrada: 136.8, menu: 'Acompañante' },
    { alimento: 'VERDURA (CEBOLLA CABEZONA)', unidad: 'g', entrada: 4.5, menu: 'Verdura' },
    { alimento: 'AJO CRUDO', unidad: 'g', entrada: 2.0, menu: 'Condimento' },
    { alimento: 'ESPINACA', unidad: 'g', entrada: 13.6, menu: 'Verdura' },
    { alimento: 'VERDURA (APIO)', unidad: 'g', entrada: 3.0, menu: 'Verdura' },
    { alimento: 'HABICHUELA', unidad: 'g', entrada: 55.4, menu: 'Verdura' },
    { alimento: 'LECHUGA COMÚN', unidad: 'g', entrada: 15.0, menu: 'Verdura' },
    { alimento: 'MAÍZ TIERNO', unidad: 'g', entrada: 20.0, menu: 'Verdura' },
    { alimento: 'CILANTRO', unidad: 'g', entrada: 6.0, menu: 'Condimento' },
    { alimento: 'REPOLLO BLANCO', unidad: 'g', entrada: 18.0, menu: 'Verdura' },
    { alimento: 'VERDURA (CEBOLLA JUNCA)', unidad: 'g', entrada: 8.5, menu: 'Verdura' },
    { alimento: 'PLÁTANO HARTÓN', unidad: 'g', entrada: 40.0, menu: 'Acompañante' },
    { alimento: 'VERDURA (TOMATE ACOMPAÑANTE)', unidad: 'g', entrada: 25.0, menu: 'Verdura' },
    { alimento: 'VERDURA (ZANAHORIA ACOMPAÑANTE)', unidad: 'g', entrada: 30.0, menu: 'Verdura' },
    { alimento: 'PIMENTÓN VERDE', unidad: 'g', entrada: 12.0, menu: 'Verdura' },
    { alimento: 'PIMENTÓN ROJO', unidad: 'g', entrada: 12.0, menu: 'Verdura' },
    { alimento: 'AGUACATE', unidad: 'g', entrada: 35.0, menu: 'Acompañante' },
    { alimento: 'PEPINO', unidad: 'g', entrada: 14.0, menu: 'Verdura' },
    { alimento: 'GUASCAS CRUDAS', unidad: 'g', entrada: 4.0, menu: 'Condimento' },
    { alimento: 'FRUTA (MANGO)', unidad: 'g', entrada: 60.0, menu: 'Fruta' },
    { alimento: 'FRUTA (LULO)', unidad: 'g', entrada: 45.0, menu: 'Fruta' }
  ];

  constructor(
    private entregasService: EntregasService,
    private asistenciaService: AsistenciaDiariaService,
    private siraeService: SiraeService
  ) {}

  /**
   * Genera los 20 días hábiles (4 semanas de lunes a viernes) a partir de una fecha base
   */
  generarDiasHabiles(fechaInicioStr: string): string[] {
    const fechas: string[] = [];
    const actual = new Date(fechaInicioStr + 'T00:00:00');
    if (isNaN(actual.getTime())) {
      actual.setTime(Date.now());
    }

    while (fechas.length < 20) {
      const diaSemana = actual.getDay(); // 0: Dom, 1: Lun, ... 5: Vie, 6: Sab
      if (diaSemana >= 1 && diaSemana <= 5) {
        fechas.push(this.formatFecha(actual));
      }
      actual.setDate(actual.getDate() + 1);
    }
    return fechas;
  }

  private formatFecha(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dia}`;
  }

  /**
   * Carga o construye la Planilla de Remisión completa
   */
  obtenerPlanillaRemision(params: {
    institucionId: number;
    institucionNombre: string;
    sedeId: number;
    sedeNombre: string;
    sedeIds?: number[];
    periodo: string;
    fechaInicio: string;
    fechaFin: string;
    cuposBase?: number;
  }): Observable<PlanillaRemisionData> {
    const cacheKey = `pae_remision_${params.institucionId}_${params.sedeId}_${params.periodo}_${params.fechaInicio}`;
    const guardada = localStorage.getItem(cacheKey);

    return forkJoin({
      entregas: this.entregasService.cargar(true).pipe(timeout(3000), catchError(() => of([]))),
      contratos: this.siraeService.getContratos().pipe(timeout(3000), catchError(() => of([])))
    }).pipe(
      map(({ entregas, contratos }: { entregas: any; contratos: any }) => {
        const listaContratos: any[] = Array.isArray(contratos) ? contratos : ((contratos && contratos.results) || []);
        const listaEntregas: any[] = Array.isArray(entregas) ? entregas : ((entregas && entregas.results) || []);
        if (guardada) {
          try {
            return JSON.parse(guardada) as PlanillaRemisionData;
          } catch (e) {
            console.warn('Error leyendo cache de remisión, regenerando...', e);
          }
        }

        // Buscar contrato de la sede
        const contratosInstitucion = listaContratos.filter((c: any) =>
          Number(c.id_institucion) === params.institucionId
        );
        const contratoSede = params.sedeId
          ? listaContratos.find((c: any) =>
            Number(c.id_sede) === params.sedeId && Number(c.id_institucion) === params.institucionId
          )
          : undefined;

        const cupoTotal = params.cuposBase
          || Number(contratoSede?.cupos)
          || contratosInstitucion.reduce((total: number, contrato: any) => total + (Number(contrato.cupos) || 0), 0)
          || 227;

        // Distribución estándar oficial observada en la planilla de muestra:
        // Preescolar (25), Primaria 1-3 y 4-5 (99), Secundaria (67), Media y Ciclo (36) => Total: 227
        const factor = cupoTotal / 227;
        const cupos: CuposNivel = {
          preescolar: Math.round(25 * factor),
          primaria13: Math.round(50 * factor),
          primaria45: Math.round(49 * factor),
          secundaria: Math.round(67 * factor),
          media: Math.round(36 * factor),
          totalCupos: cupoTotal,
          racionesTotales: cupoTotal * 20
        };

        // Filtro de entregas registradas por el operador/manipuladora para esta sede
        const sedesInstitucion = new Set([
          ...(params.sedeIds ?? []),
          ...contratosInstitucion.map((contrato: any) => Number(contrato.id_sede))
        ]);
        const entregasSede: any[] = listaEntregas.filter((e: any) => {
          const idSede = Number(e.idSede);
          const perteneceInstitucion = Number(e.idInstitucion) === params.institucionId
            || (Number.isFinite(idSede) && sedesInstitucion.has(idSede));
          const perteneceSedeSeleccionada = !params.sedeId || idSede === params.sedeId;
          const recepcionConfirmada = e.estado === 'RECIBIDA' || e.estado === 'CON_NOVEDAD';

          return perteneceInstitucion && perteneceSedeSeleccionada && recepcionConfirmada;
        });

        // Mapear NO PERECEDEROS
        const noPerecederos: FilaNoPerecedero[] = this.NO_PERECEDEROS_BASE.map((item, idx) => {
          const entregasProd = entregasSede.filter((e: any) =>
            e.ingrediente && e.ingrediente.toLowerCase().includes(item.alimento.toLowerCase().split(' ')[0])
          );
          const cantidadRecibidaAuto = entregasProd.reduce((sum: number, e: any) => sum + (Number(e.cantidadRecibida ?? e.cantidad) || 0), 0);
          const cantidadFinal = cantidadRecibidaAuto > 0 ? cantidadRecibidaAuto : item.baseMes;

          return {
            id: idx + 1,
            alimento: item.alimento,
            gramajes: { ...item.gramajes },
            unidad: item.unidad,
            cantidadEntregar: item.baseMes,
            cantidadRecibida: cantidadFinal
          };
        });

        // Mapear PERECEDEROS con 4 entregas
        const perecederos: FilaPerecedero[] = this.PERECEDEROS_BASE.map((item, idx) => {
          const entregasProd = entregasSede.filter((e: any) =>
            e.ingrediente && e.ingrediente.toLowerCase().includes(item.alimento.toLowerCase().split(' ')[0])
          );

          // Asignar entregas
          const e1 = item.baseSemanal[0] || 0;
          const e2 = item.baseSemanal[1] || 0;
          const e3 = item.baseSemanal[2] || 0;
          const e4 = item.baseSemanal[3] || 0;
          const totalEntregado = Math.round((e1 + e2 + e3 + e4) * 100) / 100;

          // Si hay entregas reales registradas, tomarlas
          const recibidaReal = entregasProd.reduce((sum: number, e: any) => sum + (Number(e.cantidadRecibida ?? e.cantidad) || 0), 0);
          const totalRecibido = recibidaReal > 0 ? recibidaReal : totalEntregado;

          return {
            id: idx + 1,
            alimento: item.alimento,
            gramajes: { ...item.gramajes },
            unidad: item.unidad,
            entregas: [
              { aEntregar: e1, recibida: e1 },
              { aEntregar: e2, recibida: e2 },
              { aEntregar: e3, recibida: e3 },
              { aEntregar: e4, recibida: e4 }
            ],
            totalEntregado,
            totalRecibido
          };
        });

        // Mapear ASEO
        const aseo: FilaAseo[] = this.ASEO_BASE.map((item, idx) => ({
          id: idx + 1,
          item: item.item,
          unidad: item.unidad,
          cantidadEntregar: item.baseMes,
          cantidadRecibida: item.baseMes
        }));

        const nuevaPlanilla: PlanillaRemisionData = {
          municipio: 'POPAYÁN',
          periodo: params.periodo || 'PRIMERA',
          fechaInicio: params.fechaInicio || '2025-01-27',
          fechaTerminacion: params.fechaFin || '2025-02-21',
          contratoNumero: contratoSede?.numero_contrato || '20241800039887',
          operador: contratoSede?.operador || 'ASOCIACIÓN DE PADRES DE FAMILIA DE LOS RESTAURANTES ESCOLARES DEL MUNICIPIO DE EL TAMBO',
          institucionEducativa: params.institucionNombre || 'INSTITUCIÓN EDUCATIVA COMERCIAL DEL NORTE',
          sede: params.sedeNombre || 'SEDE LA PAZ',
          codigoDane: contratoSede?.codigo_dane || '119001001483',
          modalidad: 'RACIÓN PREPARADA EN SITIO - RPS',
          tipo: 'COMPLEMENTO ALIMENTARIO ALMUERZO',
          diasAtender: 20,
          cupos,
          ciclosMenus: '1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20',
          noPerecederos,
          perecederos,
          aseo,
          firmas: {
            manipuladoraNombre: 'MARÍA YOLANDA SOLANO',
            manipuladoraCedula: '34.567.890 DE POPAYÁN',
            rectorNombre: 'ARY MEDARDO SÁNCHEZ ROSERO',
            rectorCedula: '10.305.118 DE POPAYÁN',
            rectorTelefono: '3225029321 - 3223864703',
            rectorCargo: 'RECTOR / DOCENTE ENCARGADO PAE',
            operadorNombre: 'ARY M. SÁNCHEZ R.',
            operadorCedula: '10.305.118 DE POPAYÁN',
            operadorTelefono: '3225029321',
            operadorCargo: 'REPRESENTANTE LEGAL CONTRATISTA O COORDINADOR'
          }
        };

        return nuevaPlanilla;
      })
    );
  }

  /**
   * Carga o construye la Planilla de Control Diario de Salidas / Kardex Mensual por Semanas (1 a 4)
   */
  obtenerPlanillaKardex(params: {
    institucionId: number;
    institucionNombre: string;
    sedeId: number;
    sedeNombre: string;
    periodo: string;
    fechaInicio: string;
    fechaFin: string;
  }): Observable<PlanillaKardexData> {
    const cacheKey = `pae_kardex_${params.institucionId}_${params.sedeId}_${params.periodo}_${params.fechaInicio}`;
    const guardada = localStorage.getItem(cacheKey);

    return forkJoin({
      asistencias: this.asistenciaService.getAsistencias().pipe(timeout(3000), catchError(() => of([]))),
      entregas: this.entregasService.cargar(true).pipe(timeout(3000), catchError(() => of([])))
    }).pipe(
      map(({ asistencias, entregas }: { asistencias: any; entregas: any }) => {
        const listaAsistencias: any[] = Array.isArray(asistencias) ? asistencias : ((asistencias && asistencias.results) || []);
        const listaEntregas: any[] = Array.isArray(entregas) ? entregas : ((entregas && entregas.results) || []);
        if (guardada) {
          try {
            return JSON.parse(guardada) as PlanillaKardexData;
          } catch (e) {
            console.warn('Error leyendo cache de kardex, regenerando...', e);
          }
        }

        const diasHabiles = this.generarDiasHabiles(params.fechaInicio || '2025-01-27');
        const diasSemanaNombres: Array<'L' | 'M' | 'M' | 'J' | 'V'> = ['L', 'M', 'M', 'J', 'V'];

        const filas: FilaKardex[] = this.KARDEX_ALIMENTOS_BASE.map((base, idx) => {
          // Crear las 4 semanas
          const semanas: [SemanaSalida, SemanaSalida, SemanaSalida, SemanaSalida] = [
            { semanaNumero: 1, dias: [] },
            { semanaNumero: 2, dias: [] },
            { semanaNumero: 3, dias: [] },
            { semanaNumero: 4, dias: [] }
          ];

          let totalSalidas = 0;

          // Repartir los 20 días
          for (let s = 0; s < 4; s++) {
            for (let d = 0; d < 5; d++) {
              const diaIdx = s * 5 + d;
              const fechaDia = diasHabiles[diaIdx] || '';
              // Verificar asistencia registrada de la manipuladora para este día
              const asistDia = listaAsistencias.find((a: any) => a.fecha === fechaDia);
              const ninos = asistDia ? asistDia.ninos_presentes : 227;

              // Distribución de consumo según alimento y días asignados
              let cantidadSalida = 0;
              // Salida por ración teórica según el gramaje promedio
              if (base.alimento.includes('CARNE') || base.alimento.includes('HUEVOS')) {
                // Se sirve en días específicos
                if (s % 2 === 0 && d === 1) {
                  cantidadSalida = Math.round((base.entrada / 4) * 10) / 10;
                } else if (s % 2 === 1 && d === 3) {
                  cantidadSalida = Math.round((base.entrada / 4) * 10) / 10;
                }
              } else if (base.alimento.includes('VERDURA') || base.alimento.includes('PAPA')) {
                // Se consume 2 o 3 veces por semana
                if (d === 0 || d === 2 || d === 4) {
                  cantidadSalida = Math.round((base.entrada / 12) * 10) / 10;
                }
              } else if (base.alimento.includes('LECHE') || base.alimento.includes('FRUTA')) {
                if (d === 1 || d === 3) {
                  cantidadSalida = Math.round((base.entrada / 8) * 10) / 10;
                }
              } else {
                // Condimentos y otros
                if (d === 2) {
                  cantidadSalida = Math.round((base.entrada / 4) * 10) / 10;
                }
              }

              totalSalidas += cantidadSalida;

              semanas[s].dias.push({
                diaSemana: diasSemanaNombres[d],
                diaNumero: diaIdx + 1,
                fecha: fechaDia,
                cantidad: cantidadSalida
              });
            }
          }

          totalSalidas = Math.round(totalSalidas * 10) / 10;
          const saldoMes = Math.max(0, Math.round((base.entrada - totalSalidas) * 10) / 10);

          return {
            id: idx + 1,
            alimento: base.alimento,
            fechaEntrada: diasHabiles[0],
            menu: base.menu,
            cantidadEntrada: base.entrada,
            unidad: base.unidad,
            semanas,
            totalSalidas,
            saldoMes
          };
        });

        const nuevaPlanilla: PlanillaKardexData = {
          municipio: 'POPAYÁN',
          institucionEducativa: params.institucionNombre || 'INSTITUCIÓN EDUCATIVA COMERCIAL DEL NORTE',
          sede: params.sedeNombre || 'SEDE LA PAZ',
          periodo: params.periodo || 'PRIMERA',
          fechaInicio: params.fechaInicio || '2025-01-27',
          fechaTerminacion: params.fechaFin || '2025-02-21',
          filas,
          firmas: {
            manipuladoraNombre: 'MARÍA YOLANDA SOLANO',
            manipuladoraCedula: '34.567.890',
            rectorNombre: 'ARY MEDARDO SÁNCHEZ ROSERO',
            rectorCedula: '10.305.118',
            rectorTelefono: '3225029321',
            rectorCargo: 'SUPERVISOR PAE / RECTOR',
            operadorNombre: 'ARY M. SÁNCHEZ R.',
            operadorCedula: '10.305.118',
            operadorTelefono: '3225029321',
            operadorCargo: 'COORDINADOR OPERATIVO'
          }
        };

        return nuevaPlanilla;
      })
    );
  }

  /**
   * Obtiene la Minuta Patrón clasificada por grupos de alimentos
   */
  obtenerMinutaPatron(cupos: CuposNivel, dias: number = 20): ItemMinutaPatron[] {
    const calcularGramosMes = (gramajes: GramajeNivel): number => {
      const gPorDia =
        (gramajes.preescolar * cupos.preescolar) +
        (gramajes.primaria13 * cupos.primaria13) +
        (gramajes.primaria45 * cupos.primaria45) +
        (gramajes.secundaria * cupos.secundaria) +
        (gramajes.media * cupos.media);
      return Math.round((gPorDia * dias) / 1000 * 10) / 10; // Kg mes
    };

    const items: ItemMinutaPatron[] = [];

    // No Perecederos
    this.NO_PERECEDEROS_BASE.forEach(np => {
      items.push({
        grupo: 'NO PERECEDEROS',
        alimento: np.alimento,
        unidad: np.unidad,
        gramajes: { ...np.gramajes },
        calculoMesGramos: calcularGramosMes(np.gramajes)
      });
    });

    // Perecederos
    this.PERECEDEROS_BASE.forEach(p => {
      let grupo: ItemMinutaPatron['grupo'] = 'CÁRNICOS Y PROTEÍNAS';
      if (p.alimento.includes('FRUTA')) grupo = 'FRUTAS';
      else if (p.alimento.includes('VERDURA') || p.alimento.includes('PAPA') || p.alimento.includes('AJO') || p.alimento.includes('HABICHUELA')) grupo = 'VERDURAS Y TUBÉRCULOS';
      else if (p.alimento.includes('HUEVOS')) grupo = 'LÁCTEOS Y HUEVOS';

      items.push({
        grupo,
        alimento: p.alimento,
        unidad: p.unidad,
        gramajes: { ...p.gramajes },
        calculoMesGramos: calcularGramosMes(p.gramajes)
      });
    });

    return items;
  }

  /**
   * Guarda cambios manuales en localStorage
   */
  guardarPlanillaRemision(clave: string, data: PlanillaRemisionData): void {
    localStorage.setItem(clave, JSON.stringify(data));
  }

  guardarPlanillaKardex(clave: string, data: PlanillaKardexData): void {
    localStorage.setItem(clave, JSON.stringify(data));
  }
}
