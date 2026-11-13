import { ComponentePlatoReceta } from './banco-datos';

export const CATALOGO_PREPARACIONES_PAE: Record<string, ComponentePlatoReceta> = {
  'arroz blanco': {
    id_temporal: 'comp_arroz_blanco',
    tipo_componente: 'Cereal acompañante',
    nombre_componente: 'Arroz blanco',
    ingredientes: [
      { id_ingrediente: 3, nombre_ingrediente: 'Arroz', unidad: 'kg', observacion: 'Grano entero seleccionado' },
      { id_ingrediente: 25, nombre_ingrediente: 'Aceite vegetal', unidad: 'ml', observacion: 'Para sofrito' },
      { id_ingrediente: 50, nombre_ingrediente: 'Ajo', unidad: 'kg', observacion: 'Macerado o picado' },
      { id_ingrediente: 32, nombre_ingrediente: 'Sal', unidad: 'kg', observacion: 'Según minuta' },
      { id_ingrediente: 84, nombre_ingrediente: 'Agua potable', unidad: 'L', observacion: 'Proporción 2:1 respecto al arroz' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Sofreír el ajo macerado en aceite vegetal caliente a fuego medio hasta dorar suavemente.' },
      { numero_paso: 2, descripcion_paso: 'Verter el agua potable en proporción 2 a 1 respecto al arroz y disolver la sal.' },
      { numero_paso: 3, descripcion_paso: 'Al romper en hervor vivo, incorporar el arroz blanco previamente seleccionado.' },
      { numero_paso: 4, descripcion_paso: 'Cocinar a fuego medio destapado hasta que el agua evapore y se observen hoyuelos.' },
      { numero_paso: 5, descripcion_paso: 'Bajar el fuego al mínimo, tapar y cocinar por 18 a 20 minutos hasta que el grano quede suave y suelto.' }
    ]
  },

  'arroz con fideos': {
    id_temporal: 'comp_arroz_fideos',
    tipo_componente: 'Cereal acompañante',
    nombre_componente: 'Arroz con fideos',
    ingredientes: [
      { id_ingrediente: 3, nombre_ingrediente: 'Arroz', unidad: 'kg', observacion: 'Grano entero' },
      { id_ingrediente: 28, nombre_ingrediente: 'Pasta', unidad: 'kg', observacion: 'Fideos dorados' },
      { id_ingrediente: 25, nombre_ingrediente: 'Aceite vegetal', unidad: 'ml', observacion: 'Para dorar fideos' },
      { id_ingrediente: 50, nombre_ingrediente: 'Ajo', unidad: 'kg', observacion: 'Macerado' },
      { id_ingrediente: 32, nombre_ingrediente: 'Sal', unidad: 'kg', observacion: 'Al gusto' },
      { id_ingrediente: 84, nombre_ingrediente: 'Agua potable', unidad: 'L', observacion: 'Doble de líquido' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Dorar los fideos en un caldero con aceite vegetal a fuego medio hasta lograr un color parejo.' },
      { numero_paso: 2, descripcion_paso: 'Añadir el ajo, el agua potable y la sal disolviendo bien.' },
      { numero_paso: 3, descripcion_paso: 'Al romper hervor, adicionar el arroz revolviendo con cuidado.' },
      { numero_paso: 4, descripcion_paso: 'Dejar secar a fuego medio hasta que el líquido se absorba al ras del arroz.' },
      { numero_paso: 5, descripcion_paso: 'Tapar, reducir a fuego mínimo y cocinar durante 20 minutos hasta que ambos ingredientes estén tiernos.' }
    ]
  },

  'pasta': {
    id_temporal: 'comp_pasta',
    tipo_componente: 'Cereal acompañante',
    nombre_componente: 'Pasta',
    ingredientes: [
      { id_ingrediente: 28, nombre_ingrediente: 'Pasta', unidad: 'kg', observacion: 'Pasta de sémola' },
      { id_ingrediente: 25, nombre_ingrediente: 'Aceite vegetal', unidad: 'ml', observacion: 'Para escurrir' },
      { id_ingrediente: 32, nombre_ingrediente: 'Sal', unidad: 'kg', observacion: 'Para cocción' },
      { id_ingrediente: 84, nombre_ingrediente: 'Agua potable', unidad: 'L', observacion: 'Abundante agua' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Hervir abundante agua potable en olla amplia con sal y un chorrito de aceite vegetal.' },
      { numero_paso: 2, descripcion_paso: 'Agregar la pasta al romper hervor y remover periódicamente.' },
      { numero_paso: 3, descripcion_paso: 'Cocinar durante 8 a 10 minutos a fuego alto hasta lograr punto al dente.' },
      { numero_paso: 4, descripcion_paso: 'Escurrir de inmediato y rociar un hilo de aceite para mantenerla suelta.' }
    ]
  },

  'arepa de maíz': {
    id_temporal: 'comp_arepa_maiz',
    tipo_componente: 'Cereal acompañante',
    nombre_componente: 'Arepa de maíz',
    ingredientes: [
      { id_ingrediente: 34, nombre_ingrediente: 'Harina de maíz', unidad: 'kg', observacion: 'Precocida' },
      { id_ingrediente: 33, nombre_ingrediente: 'Mantequilla', unidad: 'kg', observacion: 'Para suavizar' },
      { id_ingrediente: 32, nombre_ingrediente: 'Sal', unidad: 'kg', observacion: 'Al gusto' },
      { id_ingrediente: 84, nombre_ingrediente: 'Agua potable', unidad: 'L', observacion: 'Tibia para amasar' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Mezclar agua potable tibia con sal y mantequilla derretida.' },
      { numero_paso: 2, descripcion_paso: 'Incorporar la harina de maíz gradualmente, amasando hasta lograr consistencia homogénea y sin grietas.' },
      { numero_paso: 3, descripcion_paso: 'Dejar reposar la masa durante 5 minutos para hidratación adecuada.' },
      { numero_paso: 4, descripcion_paso: 'Dividir en porciones iguales y redondear en discos según el gramaje establecido.' },
      { numero_paso: 5, descripcion_paso: 'Asar en plancha caliente por 4 a 5 minutos por lado hasta dorar.' }
    ]
  },

  'hojaldras': {
    id_temporal: 'comp_hojaldras',
    tipo_componente: 'Cereal acompañante',
    nombre_componente: 'Hojaldras',
    ingredientes: [
      { id_ingrediente: 27, nombre_ingrediente: 'Harina de trigo', unidad: 'kg', observacion: 'Cernida' },
      { id_ingrediente: 35, nombre_ingrediente: 'Polvo de hornear', unidad: 'kg', observacion: 'Leudante' },
      { id_ingrediente: 30, nombre_ingrediente: 'Azúcar', unidad: 'kg', observacion: 'Pizca' },
      { id_ingrediente: 25, nombre_ingrediente: 'Aceite vegetal', unidad: 'ml', observacion: 'Para freír' },
      { id_ingrediente: 32, nombre_ingrediente: 'Sal', unidad: 'kg', observacion: 'Pizca' },
      { id_ingrediente: 84, nombre_ingrediente: 'Agua potable', unidad: 'L', observacion: 'Para amasar' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Cernir harina de trigo con polvo de hornear, sal y un toque de azúcar.' },
      { numero_paso: 2, descripcion_paso: 'Agregar agua potable tibia y amasar hasta obtener una masa elástica y manejable.' },
      { numero_paso: 3, descripcion_paso: 'Estirar con rodillo sobre superficie limpia enharinada hasta lograr espesor delgado.' },
      { numero_paso: 4, descripcion_paso: 'Cortar en porciones rectangulares individuales.' },
      { numero_paso: 5, descripcion_paso: 'Freír en aceite vegetal caliente hasta que inflen y tomen tono dorado; escurrir bien.' }
    ]
  },

  'torta pastel': {
    id_temporal: 'comp_torta_pastel',
    tipo_componente: 'Cereal acompañante',
    nombre_componente: 'Torta pastel',
    ingredientes: [
      { id_ingrediente: 27, nombre_ingrediente: 'Harina de trigo', unidad: 'kg', observacion: 'Repostería' },
      { id_ingrediente: 8, nombre_ingrediente: 'Huevos', unidad: 'u', observacion: 'Frescos' },
      { id_ingrediente: 30, nombre_ingrediente: 'Azúcar', unidad: 'kg', observacion: 'Endulzante' },
      { id_ingrediente: 33, nombre_ingrediente: 'Mantequilla', unidad: 'kg', observacion: 'Grasa batido' },
      { id_ingrediente: 35, nombre_ingrediente: 'Polvo de hornear', unidad: 'kg', observacion: 'Crecimiento' },
      { id_ingrediente: 1, nombre_ingrediente: 'Leche líquida', unidad: 'L', observacion: 'Para hidratar masa' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Batir mantequilla con azúcar hasta punto de crema blanquecina.' },
      { numero_paso: 2, descripcion_paso: 'Añadir los huevos uno a uno batiendo continuamente.' },
      { numero_paso: 3, descripcion_paso: 'Alternar la harina de trigo cernida con el polvo de hornear y la leche líquida.' },
      { numero_paso: 4, descripcion_paso: 'Verter en molde engrasado y hornear a 175°C por 35 a 40 minutos.' },
      { numero_paso: 5, descripcion_paso: 'Enfriar y porcionar con cuchillo desinfectado según el gramaje PAE.' }
    ]
  },

  'galleta': {
    id_temporal: 'comp_galleta',
    tipo_componente: 'Alimento proteico',
    nombre_componente: 'Galleta',
    ingredientes: [
      { id_ingrediente: 20, nombre_ingrediente: 'Galleta', unidad: 'kg', observacion: 'Galleta dulce tradicional fortificada' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Revisar integridad del empaque y fecha de vencimiento.' },
      { numero_paso: 2, descripcion_paso: 'Servir en ración individual higienizada como complemento nutricional.' }
    ]
  },

  'huevos pericos': {
    id_temporal: 'comp_huevos_pericos',
    tipo_componente: 'Alimento proteico',
    nombre_componente: 'Huevos pericos',
    ingredientes: [
      { id_ingrediente: 8, nombre_ingrediente: 'Huevos', unidad: 'u', observacion: 'Clase A limpios' },
      { id_ingrediente: 4, nombre_ingrediente: 'Tomate', unidad: 'u', observacion: 'Picado finamente' },
      { id_ingrediente: 49, nombre_ingrediente: 'Cebolla', unidad: 'kg', observacion: 'Picada finamente' },
      { id_ingrediente: 25, nombre_ingrediente: 'Aceite vegetal', unidad: 'ml', observacion: 'Para guiso' },
      { id_ingrediente: 32, nombre_ingrediente: 'Sal', unidad: 'kg', observacion: 'Al gusto' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Lavar y picar el tomate y la cebolla en cubos pequeños.' },
      { numero_paso: 2, descripcion_paso: 'Sofreír en sartén con aceite vegetal y sal hasta formar un guiso tierno.' },
      { numero_paso: 3, descripcion_paso: 'Cascar los huevos en recipiente aparte para verificar frescura y batir ligeramente.' },
      { numero_paso: 4, descripcion_paso: 'Verter sobre el guiso caliente revolviendo constantemente a fuego medio-bajo.' },
      { numero_paso: 5, descripcion_paso: 'Cocinar hasta cuajado total (mínimo 74°C) garantizando inocuidad.' }
    ]
  },

  'huevos revueltos': {
    id_temporal: 'comp_huevos_revueltos',
    tipo_componente: 'Alimento proteico',
    nombre_componente: 'Huevos revueltos',
    ingredientes: [
      { id_ingrediente: 8, nombre_ingrediente: 'Huevos', unidad: 'u', observacion: 'Clase A' },
      { id_ingrediente: 25, nombre_ingrediente: 'Aceite vegetal', unidad: 'ml', observacion: 'Para cocción' },
      { id_ingrediente: 32, nombre_ingrediente: 'Sal', unidad: 'kg', observacion: 'Al gusto' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Cascar los huevos en recipiente higienizado y batir con la sal.' },
      { numero_paso: 2, descripcion_paso: 'Calentar aceite vegetal en sartén antiadherente a fuego medio.' },
      { numero_paso: 3, descripcion_paso: 'Verter la mezcla de huevos y remover con espátula suavemente.' },
      { numero_paso: 4, descripcion_paso: 'Cocinar hasta que la textura esté firme y totalmente cocida.' }
    ]
  },

  'torta de huevo': {
    id_temporal: 'comp_torta_huevo',
    tipo_componente: 'Alimento proteico',
    nombre_componente: 'Torta de huevo',
    ingredientes: [
      { id_ingrediente: 8, nombre_ingrediente: 'Huevos', unidad: 'u', observacion: 'Clase A' },
      { id_ingrediente: 4, nombre_ingrediente: 'Tomate', unidad: 'u', observacion: 'Picado' },
      { id_ingrediente: 49, nombre_ingrediente: 'Cebolla', unidad: 'kg', observacion: 'Picada' },
      { id_ingrediente: 25, nombre_ingrediente: 'Aceite vegetal', unidad: 'ml', observacion: 'Para sartén' },
      { id_ingrediente: 32, nombre_ingrediente: 'Sal', unidad: 'kg', observacion: 'Al gusto' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Sofreír tomate y cebolla picados con sal en sartén con aceite vegetal.' },
      { numero_paso: 2, descripcion_paso: 'Batir enérgicamente los huevos e incorporar al sofrito caliente.' },
      { numero_paso: 3, descripcion_paso: 'Distribuir uniformemente en la sartén, tapar y cocer a fuego lento por 6 minutos.' },
      { numero_paso: 4, descripcion_paso: 'Voltear con ayuda de una tapa o plato y dorar el reverso hasta cocción completa.' },
      { numero_paso: 5, descripcion_paso: 'Porcionar en triángulos o cuadros iguales para el servicio.' }
    ]
  },

  'pollo en salsa blanca': {
    id_temporal: 'comp_pollo_salsa_blanca',
    tipo_componente: 'Alimento proteico',
    nombre_componente: 'Pollo en salsa blanca',
    ingredientes: [
      { id_ingrediente: 45, nombre_ingrediente: 'Pollo', unidad: 'kg', observacion: 'Pechuga o pernil limpio' },
      { id_ingrediente: 1, nombre_ingrediente: 'Leche líquida', unidad: 'L', observacion: 'Base de salsa' },
      { id_ingrediente: 27, nombre_ingrediente: 'Harina de trigo', unidad: 'kg', observacion: 'Para espesar salsa' },
      { id_ingrediente: 33, nombre_ingrediente: 'Mantequilla', unidad: 'kg', observacion: 'Para roux' },
      { id_ingrediente: 50, nombre_ingrediente: 'Ajo', unidad: 'kg', observacion: 'Macerado' },
      { id_ingrediente: 49, nombre_ingrediente: 'Cebolla', unidad: 'kg', observacion: 'Finamente picada' },
      { id_ingrediente: 32, nombre_ingrediente: 'Sal', unidad: 'kg', observacion: 'Al gusto' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Cocinar el pollo en agua potable con ajo, cebolla y sal hasta que esté tierno.' },
      { numero_paso: 2, descripcion_paso: 'Retirar, desmechar o cortar en cubos del gramaje estipulado conservando el caldo.' },
      { numero_paso: 3, descripcion_paso: 'Derretir mantequilla en caldero, agregar harina de trigo y cocinar 2 minutos formando el roux.' },
      { numero_paso: 4, descripcion_paso: 'Verter la leche líquida tibia poco a poco batiendo enérgicamente para evitar grumos hasta espesar.' },
      { numero_paso: 5, descripcion_paso: 'Integrar el pollo cocido a la salsa blanca, ajustar de sal y mantener caliente a más de 65°C.' }
    ]
  },

  'pollo guisado': {
    id_temporal: 'comp_pollo_guisado',
    tipo_componente: 'Alimento proteico',
    nombre_componente: 'Pollo guisado',
    ingredientes: [
      { id_ingrediente: 45, nombre_ingrediente: 'Pollo', unidad: 'kg', observacion: 'Presas limpias' },
      { id_ingrediente: 4, nombre_ingrediente: 'Tomate', unidad: 'u', observacion: 'Maduro picado' },
      { id_ingrediente: 49, nombre_ingrediente: 'Cebolla', unidad: 'kg', observacion: 'Picada' },
      { id_ingrediente: 50, nombre_ingrediente: 'Ajo', unidad: 'kg', observacion: 'Macerado' },
      { id_ingrediente: 61, nombre_ingrediente: 'Pimentón', unidad: 'kg', observacion: 'Picado' },
      { id_ingrediente: 24, nombre_ingrediente: 'Papa', unidad: 'kg', observacion: 'En cubos' },
      { id_ingrediente: 25, nombre_ingrediente: 'Aceite vegetal', unidad: 'ml', observacion: 'Para sofrito' },
      { id_ingrediente: 32, nombre_ingrediente: 'Sal', unidad: 'kg', observacion: 'Al gusto' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Sazonar las porciones de pollo con ajo macerado y sal.' },
      { numero_paso: 2, descripcion_paso: 'Sofreír tomate, cebolla y pimentón en aceite vegetal caliente hasta formar guiso concentrado.' },
      { numero_paso: 3, descripcion_paso: 'Sellar el pollo en el guiso durante 5 minutos para fijar sabores.' },
      { numero_paso: 4, descripcion_paso: 'Incorporar la papa en cubos y agua potable hasta cubrir la mitad de las presas.' },
      { numero_paso: 5, descripcion_paso: 'Tapar y guisar a fuego medio durante 30 a 35 minutos hasta que el pollo esté tierno y la salsa espese.' }
    ]
  },

  'carne de res guisada': {
    id_temporal: 'comp_carne_guisada',
    tipo_componente: 'Alimento proteico',
    nombre_componente: 'Carne de res guisada',
    ingredientes: [
      { id_ingrediente: 2, nombre_ingrediente: 'Carne de res', unidad: 'kg', observacion: 'Corte magro en trozos' },
      { id_ingrediente: 4, nombre_ingrediente: 'Tomate', unidad: 'u', observacion: 'Picado' },
      { id_ingrediente: 49, nombre_ingrediente: 'Cebolla', unidad: 'kg', observacion: 'Picada' },
      { id_ingrediente: 50, nombre_ingrediente: 'Ajo', unidad: 'kg', observacion: 'Macerado' },
      { id_ingrediente: 61, nombre_ingrediente: 'Pimentón', unidad: 'kg', observacion: 'Picado' },
      { id_ingrediente: 25, nombre_ingrediente: 'Aceite vegetal', unidad: 'ml', observacion: 'Para sofrito' },
      { id_ingrediente: 32, nombre_ingrediente: 'Sal', unidad: 'kg', observacion: 'Al gusto' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Cortar la carne de res en porciones uniformes y adobar con ajo macerado y sal.' },
      { numero_paso: 2, descripcion_paso: 'Elaborar un sofrito con tomate, cebolla y pimentón en aceite caliente.' },
      { numero_paso: 3, descripcion_paso: 'Sellar la carne a fuego alto en caldero u olla de presión dorando todas las caras.' },
      { numero_paso: 4, descripcion_paso: 'Añadir el sofrito, agua potable suficiente y tapar.' },
      { numero_paso: 5, descripcion_paso: 'Cocinar a presión durante 35 a 40 minutos hasta lograr terneza suave y salsa consistente.' }
    ]
  },

  'lentejas con papa guisada': {
    id_temporal: 'comp_lentejas_papa',
    tipo_componente: 'Alimento proteico',
    nombre_componente: 'Lentejas con papa guisada',
    ingredientes: [
      { id_ingrediente: 40, nombre_ingrediente: 'Lentejas', unidad: 'kg', observacion: 'Seleccionadas' },
      { id_ingrediente: 24, nombre_ingrediente: 'Papa', unidad: 'kg', observacion: 'En cubos medianos' },
      { id_ingrediente: 4, nombre_ingrediente: 'Tomate', unidad: 'u', observacion: 'Picado' },
      { id_ingrediente: 49, nombre_ingrediente: 'Cebolla', unidad: 'kg', observacion: 'Picada' },
      { id_ingrediente: 50, nombre_ingrediente: 'Ajo', unidad: 'kg', observacion: 'Macerado' },
      { id_ingrediente: 25, nombre_ingrediente: 'Aceite vegetal', unidad: 'ml', observacion: 'Para sofrito' },
      { id_ingrediente: 32, nombre_ingrediente: 'Sal', unidad: 'kg', observacion: 'Al gusto' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Seleccionar, lavar y remojar las lentejas en agua potable durante 30 minutos.' },
      { numero_paso: 2, descripcion_paso: 'Cocinar las lentejas en agua limpia con ajo a fuego medio hasta que ablanden.' },
      { numero_paso: 3, descripcion_paso: 'Preparar en sartén aparte un guiso con tomate, cebolla, aceite vegetal y sal.' },
      { numero_paso: 4, descripcion_paso: 'Agregar la papa en cubos y el guiso a la olla con las lentejas.' },
      { numero_paso: 5, descripcion_paso: 'Cocinar a fuego bajo durante 20 minutos hasta que la papa esté tierna y el caldo espese.' }
    ]
  },

  'frijoles guisados con papa': {
    id_temporal: 'comp_frijoles_papa',
    tipo_componente: 'Alimento proteico',
    nombre_componente: 'Frijoles guisados con papa',
    ingredientes: [
      { id_ingrediente: 12, nombre_ingrediente: 'Frijoles', unidad: 'kg', observacion: 'Grano seco seleccionado' },
      { id_ingrediente: 24, nombre_ingrediente: 'Papa', unidad: 'kg', observacion: 'En cubos' },
      { id_ingrediente: 4, nombre_ingrediente: 'Tomate', unidad: 'u', observacion: 'Picado' },
      { id_ingrediente: 49, nombre_ingrediente: 'Cebolla', unidad: 'kg', observacion: 'Picada' },
      { id_ingrediente: 50, nombre_ingrediente: 'Ajo', unidad: 'kg', observacion: 'Macerado' },
      { id_ingrediente: 25, nombre_ingrediente: 'Aceite vegetal', unidad: 'ml', observacion: 'Para guiso' },
      { id_ingrediente: 32, nombre_ingrediente: 'Sal', unidad: 'kg', observacion: 'Al gusto' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Remojar los frijoles en agua potable desde la noche anterior (mínimo 8 horas).' },
      { numero_paso: 2, descripcion_paso: 'Desechar el agua de remojo y cocinar en agua potable fresca a presión por 45 minutos.' },
      { numero_paso: 3, descripcion_paso: 'Preparar un sofrito abundante de tomate, cebolla, ajo, aceite y sal.' },
      { numero_paso: 4, descripcion_paso: 'Añadir la papa en cubos y el sofrito a los frijoles cocidos.' },
      { numero_paso: 5, descripcion_paso: 'Hervir destapado a fuego medio durante 20 minutos revolviendo hasta lograr caldo espeso.' }
    ]
  },

  'arroz con carne de cerdo y verduras': {
    id_temporal: 'comp_arroz_cerdo_verduras',
    tipo_componente: 'Alimento proteico',
    nombre_componente: 'Arroz con carne de cerdo y verduras',
    ingredientes: [
      { id_ingrediente: 44, nombre_ingrediente: 'Carne de cerdo', unidad: 'kg', observacion: 'Corte magro en cubos' },
      { id_ingrediente: 3, nombre_ingrediente: 'Arroz', unidad: 'kg', observacion: 'Grano entero' },
      { id_ingrediente: 52, nombre_ingrediente: 'Zanahoria', unidad: 'kg', observacion: 'En cubos pequeños' },
      { id_ingrediente: 61, nombre_ingrediente: 'Pimentón', unidad: 'kg', observacion: 'Picado' },
      { id_ingrediente: 50, nombre_ingrediente: 'Ajo', unidad: 'kg', observacion: 'Macerado' },
      { id_ingrediente: 25, nombre_ingrediente: 'Aceite vegetal', unidad: 'ml', observacion: 'Para sofrito' },
      { id_ingrediente: 32, nombre_ingrediente: 'Sal', unidad: 'kg', observacion: 'Al gusto' },
      { id_ingrediente: 84, nombre_ingrediente: 'Agua potable', unidad: 'L', observacion: 'Doble de líquido' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Cortar la carne de cerdo en cubos pequeños y dorar en caldero amplio con aceite vegetal.' },
      { numero_paso: 2, descripcion_paso: 'Añadir ajo, zanahoria y pimentón salteando durante 5 minutos.' },
      { numero_paso: 3, descripcion_paso: 'Incorporar el arroz mezclando para impregnar los sabores del cerdo y verduras.' },
      { numero_paso: 4, descripcion_paso: 'Verter el agua potable caliente y la sal disolviendo bien.' },
      { numero_paso: 5, descripcion_paso: 'Secar a fuego medio, tapar y dejar a fuego lento durante 20 minutos hasta que el grano esté suave.' }
    ]
  },

  'refresco de avena': {
    id_temporal: 'comp_refresco_avena',
    tipo_componente: 'Bebida con leche',
    nombre_componente: 'Refresco de avena',
    ingredientes: [
      { id_ingrediente: 31, nombre_ingrediente: 'Avena', unidad: 'kg', observacion: 'Hojuelas' },
      { id_ingrediente: 1, nombre_ingrediente: 'Leche líquida', unidad: 'L', observacion: 'Base láctea' },
      { id_ingrediente: 30, nombre_ingrediente: 'Azúcar', unidad: 'kg', observacion: 'Endulzante' },
      { id_ingrediente: 83, nombre_ingrediente: 'Canela', unidad: 'gr', observacion: 'Aromatizante' },
      { id_ingrediente: 84, nombre_ingrediente: 'Agua potable', unidad: 'L', observacion: 'Para cocción de avena' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Cocinar la avena en agua potable con canela durante 10 minutos hasta que espese.' },
      { numero_paso: 2, descripcion_paso: 'Retirar del fuego y dejar enfriar a temperatura ambiente.' },
      { numero_paso: 3, descripcion_paso: 'Licuar la avena cocida incorporando la leche líquida y el azúcar.' },
      { numero_paso: 4, descripcion_paso: 'Colar y servir refrigerado a temperatura menor a 10°C.' }
    ]
  },

  'chocolate en leche': {
    id_temporal: 'comp_chocolate_leche',
    tipo_componente: 'Bebida con leche',
    nombre_componente: 'Chocolate en leche',
    ingredientes: [
      { id_ingrediente: 1, nombre_ingrediente: 'Leche líquida', unidad: 'L', observacion: 'Base láctea' },
      { id_ingrediente: 39, nombre_ingrediente: 'Chocolate', unidad: 'kg', observacion: 'Pastilla tradicional' },
      { id_ingrediente: 30, nombre_ingrediente: 'Azúcar', unidad: 'kg', observacion: 'Al gusto' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Calentar la leche líquida en chocolatera a fuego medio.' },
      { numero_paso: 2, descripcion_paso: 'Agregar las pastillas de chocolate y el azúcar al comenzar a entibiar.' },
      { numero_paso: 3, descripcion_paso: 'Dejar que el chocolate se disuelva y batir con molinillo al hervir para espumar.' },
      { numero_paso: 4, descripcion_paso: 'Servir caliente en vasos limpios de servicio.' }
    ]
  },

  'bebida dulce en leche': {
    id_temporal: 'comp_bebida_dulce_leche',
    tipo_componente: 'Bebida con leche',
    nombre_componente: 'Bebida dulce en leche',
    ingredientes: [
      { id_ingrediente: 1, nombre_ingrediente: 'Leche líquida', unidad: 'L', observacion: 'Base láctea' },
      { id_ingrediente: 30, nombre_ingrediente: 'Azúcar', unidad: 'kg', observacion: 'Endulzante único' },
      { id_ingrediente: 84, nombre_ingrediente: 'Agua potable', unidad: 'L', observacion: 'Base líquida' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Calentar el agua potable disolviendo el azúcar completamente.' },
      { numero_paso: 2, descripcion_paso: 'Incorporar la leche líquida al romper hervor suave.' },
      { numero_paso: 3, descripcion_paso: 'Dejar cocer a fuego medio durante 3 minutos integrando bien.' },
      { numero_paso: 4, descripcion_paso: 'Servir caliente garantizando la temperatura higiénica del servicio.' }
    ]
  },

  'jugo de fruta en leche': {
    id_temporal: 'comp_jugo_fruta_leche',
    tipo_componente: 'Bebida con leche',
    nombre_componente: 'Jugo de fruta en leche',
    ingredientes: [
      { id_ingrediente: 65, nombre_ingrediente: 'Mango', unidad: 'kg', observacion: 'Fruta fresca seleccionada' },
      { id_ingrediente: 1, nombre_ingrediente: 'Leche líquida', unidad: 'L', observacion: 'Base láctea' },
      { id_ingrediente: 30, nombre_ingrediente: 'Azúcar', unidad: 'kg', observacion: 'Endulzante' },
      { id_ingrediente: 84, nombre_ingrediente: 'Agua potable', unidad: 'L', observacion: 'Para licuar' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Lavar, desinfectar y pelar la fruta fresca.' },
      { numero_paso: 2, descripcion_paso: 'Licuar la pulpa con agua potable, leche líquida y el azúcar.' },
      { numero_paso: 3, descripcion_paso: 'Colar inmediatamente en colador de acero inoxidable.' },
      { numero_paso: 4, descripcion_paso: 'Mantener en refrigeración hasta el momento exacto del servicio.' }
    ]
  },

  'colada de quinua': {
    id_temporal: 'comp_colada_quinua',
    tipo_componente: 'Bebida con leche',
    nombre_componente: 'Colada de quinua',
    ingredientes: [
      { id_ingrediente: 80, nombre_ingrediente: 'Quinua', unidad: 'kg', observacion: 'Lavada y seleccionada' },
      { id_ingrediente: 1, nombre_ingrediente: 'Leche líquida', unidad: 'L', observacion: 'Base láctea' },
      { id_ingrediente: 30, nombre_ingrediente: 'Azúcar', unidad: 'kg', observacion: 'Endulzante' },
      { id_ingrediente: 83, nombre_ingrediente: 'Canela', unidad: 'gr', observacion: 'Aromatizante' },
      { id_ingrediente: 84, nombre_ingrediente: 'Agua potable', unidad: 'L', observacion: 'Para cocción' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Lavar la quinua frotando bajo chorro de agua potable para retirar la saponina.' },
      { numero_paso: 2, descripcion_paso: 'Cocinar en agua potable con canela por 20 minutos hasta que el grano reviente.' },
      { numero_paso: 3, descripcion_paso: 'Licuar la preparación agregando la leche líquida y el azúcar.' },
      { numero_paso: 4, descripcion_paso: 'Hervir nuevamente durante 5 minutos a fuego medio revolviendo hasta espesar suavemente.' }
    ]
  },

  'leche líquida': {
    id_temporal: 'comp_leche_liquida',
    tipo_componente: 'Bebida con leche',
    nombre_componente: 'Leche líquida',
    ingredientes: [
      { id_ingrediente: 1, nombre_ingrediente: 'Leche líquida', unidad: 'L', observacion: 'Empaque higiénico' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Inspeccionar integridad del envase y fecha de vencimiento.' },
      { numero_paso: 2, descripcion_paso: 'Servir en vaso higienizado a temperatura adecuada.' }
    ]
  },

  'yogurt': {
    id_temporal: 'comp_yogurt',
    tipo_componente: 'Bebida con leche',
    nombre_componente: 'Yogurt',
    ingredientes: [
      { id_ingrediente: 43, nombre_ingrediente: 'Yogurt', unidad: 'ml', observacion: 'Lácteo fermentado' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Mantener en cadena de frío entre 2°C y 4°C hasta su entrega.' },
      { numero_paso: 2, descripcion_paso: 'Servir en porción individual según gramaje oficial PAE.' }
    ]
  },

  'arroz con leche y canela': {
    id_temporal: 'comp_arroz_leche',
    tipo_componente: 'Bebida con leche',
    nombre_componente: 'Arroz con leche y canela',
    ingredientes: [
      { id_ingrediente: 3, nombre_ingrediente: 'Arroz', unidad: 'kg', observacion: 'Grano seleccionado' },
      { id_ingrediente: 1, nombre_ingrediente: 'Leche líquida', unidad: 'L', observacion: 'Base láctea' },
      { id_ingrediente: 30, nombre_ingrediente: 'Azúcar', unidad: 'kg', observacion: 'Endulzante' },
      { id_ingrediente: 83, nombre_ingrediente: 'Canela', unidad: 'gr', observacion: 'Aromatizante' },
      { id_ingrediente: 84, nombre_ingrediente: 'Agua potable', unidad: 'L', observacion: 'Para precocinar arroz' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Cocinar el arroz en agua potable con canela a fuego medio hasta que esté muy tierno y el agua casi consumida.' },
      { numero_paso: 2, descripcion_paso: 'Verter la leche líquida caliente y el azúcar revolviendo constantemente con cuchara de madera.' },
      { numero_paso: 3, descripcion_paso: 'Cocinar a fuego lento durante 15 minutos hasta lograr textura cremosa.' },
      { numero_paso: 4, descripcion_paso: 'Dejar reposar y servir tibio o frío espolvoreado ligeramente con canela.' }
    ]
  },

  'banano': {
    id_temporal: 'comp_fruta_banano',
    tipo_componente: 'Fruta',
    nombre_componente: 'Banano',
    ingredientes: [
      { id_ingrediente: 71, nombre_ingrediente: 'Banano', unidad: 'kg', observacion: 'Fresco en sazón' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Lavar la cáscara bajo chorro de agua potable.' },
      { numero_paso: 2, descripcion_paso: 'Servir entero e íntegro a cada estudiante.' }
    ]
  },

  'papaya': {
    id_temporal: 'comp_fruta_papaya',
    tipo_componente: 'Fruta',
    nombre_componente: 'Papaya',
    ingredientes: [
      { id_ingrediente: 68, nombre_ingrediente: 'Papaya', unidad: 'kg', observacion: 'Fresca en sazón' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Lavar y desinfectar la superficie de la fruta.' },
      { numero_paso: 2, descripcion_paso: 'Pelar, retirar semillas y cortar en porciones uniformes.' }
    ]
  },

  'mango': {
    id_temporal: 'comp_fruta_mango',
    tipo_componente: 'Fruta',
    nombre_componente: 'Mango',
    ingredientes: [
      { id_ingrediente: 65, nombre_ingrediente: 'Mango', unidad: 'kg', observacion: 'Fresco' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Lavar con abundante agua potable y desinfectar.' },
      { numero_paso: 2, descripcion_paso: 'Pelar y porcionar en tajadas según el gramaje establecido.' }
    ]
  },

  'manzana': {
    id_temporal: 'comp_fruta_manzana',
    tipo_componente: 'Fruta',
    nombre_componente: 'Manzana',
    ingredientes: [
      { id_ingrediente: 70, nombre_ingrediente: 'Manzana', unidad: 'kg', observacion: 'Entera sana' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Lavar y desinfectar por inmersión durante 5 minutos en solución desinfectante.' },
      { numero_paso: 2, descripcion_paso: 'Enjuagar con agua potable y servir entera al momento del servicio.' }
    ]
  },

  'agua potable': {
    id_temporal: 'comp_agua_potable',
    tipo_componente: 'Agua',
    nombre_componente: 'Agua potable',
    ingredientes: [
      { id_ingrediente: 84, nombre_ingrediente: 'Agua potable', unidad: 'L', observacion: 'Apta para consumo humano' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Verificar filtros y dispensadores higienizados diariamente.' },
      { numero_paso: 2, descripcion_paso: 'Servir en vaso de servicio a libre demanda para la hidratación estudiantil.' }
    ]
  },

  'maní salado': {
    id_temporal: 'comp_mani_salado',
    tipo_componente: 'Cereal acompañante',
    nombre_componente: 'Maní salado',
    ingredientes: [
      { id_ingrediente: 81, nombre_ingrediente: 'Maní salado', unidad: 'kg', observacion: 'Empaque hermético' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Verificar integridad del empaque individual o a granel.' },
      { numero_paso: 2, descripcion_paso: 'Porcionar y entregar según el gramaje de la minuta.' }
    ]
  },

  'galleta tipo crackers': {
    id_temporal: 'comp_galleta_crackers',
    tipo_componente: 'Cereal acompañante',
    nombre_componente: 'Galleta tipo crackers',
    ingredientes: [
      { id_ingrediente: 82, nombre_ingrediente: 'Galleta tipo crackers', unidad: 'kg', observacion: 'Fortificada' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Inspeccionar integridad del empaque y frescura.' },
      { numero_paso: 2, descripcion_paso: 'Servir como acompañamiento del menú.' }
    ]
  },

  'pollo en julianas con verduras': {
    id_temporal: 'comp_pollo_julianas',
    tipo_componente: 'Alimento proteico',
    nombre_componente: 'Pollo en julianas con verduras',
    ingredientes: [
      { id_ingrediente: 45, nombre_ingrediente: 'Pollo', unidad: 'kg', observacion: 'Pechuga limpia en julianas' },
      { id_ingrediente: 52, nombre_ingrediente: 'Zanahoria', unidad: 'kg', observacion: 'En julianas' },
      { id_ingrediente: 61, nombre_ingrediente: 'Pimentón', unidad: 'kg', observacion: 'En tiras' },
      { id_ingrediente: 49, nombre_ingrediente: 'Cebolla', unidad: 'kg', observacion: 'En julianas' },
      { id_ingrediente: 25, nombre_ingrediente: 'Aceite vegetal', unidad: 'ml', observacion: 'Para saltear' },
      { id_ingrediente: 32, nombre_ingrediente: 'Sal', unidad: 'kg', observacion: 'Al gusto' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Cortar el pollo en julianas y sazonar con ajo macerado y sal.' },
      { numero_paso: 2, descripcion_paso: 'Saltear en caldero con aceite vegetal caliente hasta sellar y cocer.' },
      { numero_paso: 3, descripcion_paso: 'Incorporar la zanahoria, cebolla y pimentón en julianas.' },
      { numero_paso: 4, descripcion_paso: 'Saltear a fuego vivo durante 5 minutos conservando las verduras crujientes.' }
    ]
  },

  'papas en casco': {
    id_temporal: 'comp_papas_casco',
    tipo_componente: 'Cereal acompañante',
    nombre_componente: 'Papas en casco',
    ingredientes: [
      { id_ingrediente: 24, nombre_ingrediente: 'Papa', unidad: 'kg', observacion: 'Lavada y desinfectada' },
      { id_ingrediente: 25, nombre_ingrediente: 'Aceite vegetal', unidad: 'ml', observacion: 'Para asar' },
      { id_ingrediente: 32, nombre_ingrediente: 'Sal', unidad: 'kg', observacion: 'Al gusto' }
    ],
    pasos: [
      { numero_paso: 1, descripcion_paso: 'Lavar muy bien las papas bajo chorro de agua potable.' },
      { numero_paso: 2, descripcion_paso: 'Cortar las papas longitudinalmente en forma de cascos uniformes.' },
      { numero_paso: 3, descripcion_paso: 'Precocinar en agua hirviendo con sal durante 7 minutos y escurrir.' },
      { numero_paso: 4, descripcion_paso: 'Impregnar con aceite vegetal y asar u hornear a 180°C hasta que estén doradas.' }
    ]
  }
};
