import { listarDe, puedeVer } from "../api.js";
import { cargarReferencias, etiqueta } from "./crud.js";
import { $, esc, badge, mostrarModal, formatearFecha, formatearDinero } from "../ui.js";

function tabla(columnas, filas, vacio) {
  if (!filas.length) return `<p class="muted">${esc(vacio)}</p>`;
  return `
    <div class="table-wrap">
      <table class="tabla-chica">
        <thead><tr>${columnas.map(c => `<th>${esc(c[0])}</th>`).join("")}</tr></thead>
        <tbody>
          ${filas.map(f => `<tr>${columnas.map(c => `<td>${c[1](f)}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function dato(titulo, valor) {
  return `<div class="dato"><small>${esc(titulo)}</small><strong>${esc(valor || "—")}</strong></div>`;
}

export async function abrirFicha(t) {
  const modal = mostrarModal(`Ficha de ${t.nombres} ${t.apellidos}`, `<div class="empty">Cargando ficha...</div>`, "modal-lg");
  const id = t.id_trabajador;
  const verSueldos = puedeVer("liquidacion");

  const vacia = () => [];
  const [contratos, asistencias, movimientos, saldos, liquidaciones] = await Promise.all([
    listarDe("contrato", "id_trabajador", id, "fecha_inicio", true).catch(vacia),
    listarDe("asistencia_diaria", "id_trabajador", id, "fecha", true).catch(vacia),
    listarDe("movimiento_vacaciones", "id_trabajador", id, "fecha_movimiento", true).catch(vacia),
    listarDe("saldo_vacaciones", "id_trabajador", id).catch(vacia),
    verSueldos ? listarDe("liquidacion", "id_trabajador", id, "periodo", true).catch(vacia) : []
  ]);
  await cargarReferencias(["departamento", "cargo"]);

  const saldo = saldos[0];
  const ultimas = asistencias.slice(0, 10);
  const horasMes = asistencias
    .filter(a => String(a.fecha).slice(0, 7) === new Date().toISOString().slice(0, 7))
    .reduce((s, a) => s + Number(a.horas_trabajadas || 0), 0);

  modal.querySelector(".empty").outerHTML = `
    <div class="ficha">
      <section>
        <h3><i class="ti ti-user"></i> Datos personales ${badge(t.estado_laboral)}</h3>
        <div class="datos-grid">
          ${dato("RUT", t.rut)}
          ${dato("Correo", t.correo_personal)}
          ${dato("Teléfono", t.telefono)}
          ${dato("Nacimiento", formatearFecha(t.fecha_nacimiento))}
          ${dato("Ingreso", formatearFecha(t.fecha_ingreso))}
          ${dato("Salida", formatearFecha(t.fecha_salida))}
          ${dato("Dirección", [t.direccion, t.comuna, t.region].filter(Boolean).join(", "))}
        </div>
      </section>

      <section>
        <h3><i class="ti ti-file-text"></i> Contratos</h3>
        ${tabla([
          ["N°", c => c.id_contrato],
          ["Departamento", c => esc(etiqueta("departamento", c.id_departamento))],
          ["Cargo", c => esc(etiqueta("cargo", c.id_cargo))],
          ["Tipo", c => esc(c.tipo_contrato || "—")],
          ["Sueldo", c => esc(formatearDinero(c.sueldo_base))],
          ["Inicio", c => esc(formatearFecha(c.fecha_inicio))],
          ["Estado", c => badge(c.estado_contrato)]
        ], contratos, "Sin contratos.")}
      </section>

      <section>
        <h3><i class="ti ti-beach"></i> Vacaciones</h3>
        <div class="datos-grid">
          ${dato("Días disponibles", saldo ? String(saldo.dias_disponibles) : "Sin saldo")}
          ${dato("Días tomados", saldo ? String(saldo.dias_tomados) : "—")}
        </div>
        ${tabla([
          ["Fecha", m => esc(formatearFecha(m.fecha_movimiento))],
          ["Tipo", m => badge(m.tipo_movimiento)],
          ["Días", m => esc(m.dias)],
          ["Descripción", m => esc(m.descripcion || "—")]
        ], movimientos, "Sin movimientos de vacaciones.")}
      </section>

      <section>
        <h3><i class="ti ti-calendar-check"></i> Últimas asistencias <small class="muted">· ${horasMes} horas este mes</small></h3>
        ${tabla([
          ["Fecha", a => esc(formatearFecha(a.fecha))],
          ["Entrada", a => esc(String(a.hora_entrada || "—").slice(0, 5))],
          ["Salida", a => esc(String(a.hora_salida || "—").slice(0, 5))],
          ["Horas", a => esc(a.horas_trabajadas ?? "—")],
          ["Estado", a => badge(a.estado)]
        ], ultimas, "Sin registros de asistencia.")}
      </section>

      ${verSueldos ? `
      <section>
        <h3><i class="ti ti-receipt"></i> Liquidaciones</h3>
        ${tabla([
          ["Periodo", l => esc(l.periodo)],
          ["Fecha de pago", l => esc(formatearFecha(l.fecha_pago))],
          ["Sueldo base", l => esc(formatearDinero(l.sueldo_base))],
          ["Líquido", l => esc(formatearDinero(l.sueldo_liquido))]
        ], liquidaciones, "Sin liquidaciones.")}
      </section>` : ""}

      <div class="modal-actions no-print">
        <button type="button" class="btn btn-light" data-cerrar>Cerrar</button>
        <button type="button" class="btn btn-secondary" id="btnImprimirFicha"><i class="ti ti-printer"></i> Imprimir</button>
      </div>
    </div>`;

  $("#btnImprimirFicha", modal).addEventListener("click", () => window.print());
}
