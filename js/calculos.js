import { listar, listarDe, actualizarSinAuditoria, crearSinAuditoria } from "./api.js";

export function calcularSaldo(movimientos) {
  let abonos = 0;
  let tomados = 0;
  movimientos.forEach(m => {
    const dias = Number(m.dias) || 0;
    if (m.tipo_movimiento === "Solicitud") tomados += dias;
    else abonos += dias;
  });
  return { dias_disponibles: abonos - tomados, dias_tomados: tomados };
}

export async function recalcularSaldo(idTrabajador) {
  if (!idTrabajador) return;
  const movimientos = await listarDe("movimiento_vacaciones", "id_trabajador", idTrabajador);
  const saldo = calcularSaldo(movimientos);
  const existente = await listarDe("saldo_vacaciones", "id_trabajador", idTrabajador);
  if (existente.length) {
    await actualizarSinAuditoria("saldo_vacaciones", "id_saldo", existente[0].id_saldo, saldo);
  } else {
    await crearSinAuditoria("saldo_vacaciones", { id_trabajador: idTrabajador, ...saldo });
  }
}

export async function recalcularTodosLosSaldos() {
  const trabajadores = await listar("trabajador", "id_trabajador");
  for (const t of trabajadores) {
    await recalcularSaldo(t.id_trabajador);
  }
  return trabajadores.length;
}

export async function recalcularLiquidacion(idLiquidacion) {
  if (!idLiquidacion) return;
  const detalles = await listarDe("detalle_liquidacion", "id_liquidacion", idLiquidacion);
  const conceptos = await listar("concepto_remuneracion", "id_concepto,tipo_concepto");
  let haberes = 0;
  let descuentos = 0;
  detalles.forEach(d => {
    const concepto = conceptos.find(c => c.id_concepto === d.id_concepto);
    if (concepto?.tipo_concepto === "Descuento") descuentos += Number(d.monto) || 0;
    else haberes += Number(d.monto) || 0;
  });
  if (!detalles.length) return;
  await actualizarSinAuditoria("liquidacion", "id_liquidacion", idLiquidacion, {
    sueldo_liquido: haberes - descuentos
  });
}
