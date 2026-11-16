export const SUPABASE_URL = "https://exykyiwoqhlbwavjxezh.supabase.co";
export const SUPABASE_KEY = "sb_publishable_Gv5XzxCOwBLr2ptqHsXmrw_f5c2p-Y5";

export const FILAS_POR_PAGINA = 15;

export const OPCIONES = {
  estadoGeneral: ["Activo", "Inactivo"],
  estadoUsuario: ["Activo", "Bloqueado", "Inactivo"],
  estadoLaboral: ["Activo", "Inactivo", "Desvinculado"],
  tipoContrato: ["Indefinido", "Plazo fijo", "Por obra o faena", "Honorarios"],
  estadoContrato: ["Vigente", "Suspendido", "Terminado"],
  tipoAnexo: [
    "Reajuste de sueldo",
    "Reajuste IPC",
    "Cambio de jornada",
    "Cambio de funciones",
    "Cambio de cargo",
    "Prórroga de plazo",
    "Otro"
  ],
  estadoAnexo: ["Vigente", "Pendiente", "Anulado"],
  estadoAsistencia: ["Presente", "Atraso", "Ausente", "Licencia", "Permiso"],
  tipoVacaciones: ["Solicitud", "Abono", "Ajuste"],
  tipoConcepto: ["Haber", "Descuento"],
  accionAuditoria: ["Crear", "Editar", "Desactivar", "Eliminar", "Inicio de sesión", "Cierre de sesión", "Cambio de contraseña"],
  regiones: [
    "Arica y Parinacota",
    "Tarapacá",
    "Antofagasta",
    "Atacama",
    "Coquimbo",
    "Valparaíso",
    "Metropolitana de Santiago",
    "O'Higgins",
    "Maule",
    "Ñuble",
    "Biobío",
    "La Araucanía",
    "Los Ríos",
    "Los Lagos",
    "Aysén",
    "Magallanes"
  ]
};

export const FERIADOS = [
  "2026-01-01", "2026-04-03", "2026-04-04", "2026-05-01", "2026-05-21",
  "2026-06-21", "2026-06-29", "2026-07-16", "2026-08-15", "2026-09-18",
  "2026-09-19", "2026-10-12", "2026-10-31", "2026-11-01", "2026-12-08",
  "2026-12-25"
];

export const NAVEGACION = [
  { grupo: "Principal", items: ["dashboard"] },
  { grupo: "Personas", items: ["trabajador", "departamento", "cargo"] },
  { grupo: "Contratos", items: ["contrato", "anexo_contrato"] },
  { grupo: "Asistencia y vacaciones", items: ["asistencia_diaria", "movimiento_vacaciones", "saldo_vacaciones"] },
  { grupo: "Remuneraciones", items: ["concepto_remuneracion", "liquidacion", "detalle_liquidacion"] },
  { grupo: "Configuración", items: ["usuario", "auditoria"] }
];

const PERSONAL = [
  "trabajador", "departamento", "cargo", "contrato", "anexo_contrato",
  "asistencia_diaria", "movimiento_vacaciones", "saldo_vacaciones"
];

const REMUNERACIONES = ["concepto_remuneracion", "liquidacion", "detalle_liquidacion"];

export const PERMISOS_POR_ROL = {
  "Administrador": { ver: "*", editar: "*" },
  "RRHH": { ver: [...PERSONAL, ...REMUNERACIONES], editar: [...PERSONAL, ...REMUNERACIONES] },
  "Lector": { ver: PERSONAL, editar: [] }
};
