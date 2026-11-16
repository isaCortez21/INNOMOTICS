import { listar, puedeVer, esAdministrador } from "../api.js";
import { nombreTabla, nombreAccion } from "../modulos.js";
import { $, esc, badge, hoy, formatearFecha, formatearDinero } from "../ui.js";

function barra(texto, valor, maximo, azul = false) {
  const ancho = maximo ? Math.max(4, valor / maximo * 100) : 4;
  return `
    <div class="bar-row">
      <span>${esc(texto)}</span>
      <span class="bar-track"><span class="bar-fill ${azul ? "navy" : ""}" style="width:${ancho}%"></span></span>
      <strong>${valor}</strong>
    </div>`;
}

function indicador(icono, titulo, valor, detalle = "") {
  return `
    <div class="card stat">
      <span class="stat-icon"><i class="ti ${icono}"></i></span>
      <div>
        <small>${esc(titulo)}</small>
        <strong>${esc(valor)}</strong>
        ${detalle ? `<small>${esc(detalle)}</small>` : ""}
      </div>
    </div>`;
}

export async function montarDashboard() {
  const panel = $("#dashboardPanel");
  panel.innerHTML = `<div class="card empty">Cargando indicadores...</div>`;

  const verSueldos = puedeVer("liquidacion");
  const verAuditoria = esAdministrador();
  const vacia = () => [];

  const [trabajadores, contratos, departamentos, liquidaciones, auditoria, usuarios, asistencias, vacaciones] = await Promise.all([
    listar("trabajador", "id_trabajador,nombres,apellidos,estado_laboral").catch(vacia),
    listar("contrato", "id_contrato,id_trabajador,id_departamento,tipo_contrato,sueldo_base,estado_contrato,fecha_termino").catch(vacia),
    listar("departamento", "id_departamento,nombre").catch(vacia),
    verSueldos ? listar("liquidacion", "id_liquidacion,periodo,sueldo_liquido").catch(vacia) : [],
    verAuditoria ? listar("auditoria", "*", "fecha_registro", true).catch(vacia) : [],
    verAuditoria ? listar("usuario", "id_usuario,nombre_usuario,correo").catch(vacia) : [],
    listar("asistencia_diaria", "id_asistencia,fecha,estado").catch(vacia),
    listar("movimiento_vacaciones", "id_movimiento,id_trabajador,fecha_movimiento,tipo_movimiento,dias", "fecha_movimiento").catch(vacia)
  ]);

  const contar = (lista, campo, valor) => lista.filter(x => x[campo] === valor).length;
  const activos = contar(trabajadores, "estado_laboral", "Activo");
  const vigentes = contratos.filter(c => c.estado_contrato === "Vigente");

  const ultimoPeriodo = liquidaciones.map(l => l.periodo).filter(Boolean).sort().pop();
  const liqPeriodo = liquidaciones.filter(l => l.periodo === ultimoPeriodo);
  const totalLiquido = liqPeriodo.reduce((suma, l) => suma + Number(l.sueldo_liquido || 0), 0);

  const asistenciaHoy = asistencias.filter(a => a.fecha === hoy());
  const ausentesHoy = asistenciaHoy.filter(a => a.estado === "Ausente" || a.estado === "Atraso").length;

  const nombreTrabajador = id => {
    const t = trabajadores.find(x => x.id_trabajador === id);
    return t ? `${t.nombres} ${t.apellidos}` : `N° ${id}`;
  };
  const nombreUsuario = id => {
    const u = usuarios.find(x => x.id_usuario === id);
    return u ? u.nombre_usuario || u.correo : "Desconocido";
  };

  const estados = ["Activo", "Inactivo", "Desvinculado"].map(e => [e, contar(trabajadores, "estado_laboral", e)]);
  const maxEstados = Math.max(...estados.map(e => e[1]), 1);

  const porDepto = departamentos
    .map(d => [d.nombre, vigentes.filter(c => c.id_departamento === d.id_departamento).length])
    .filter(d => d[1] > 0)
    .sort((a, b) => b[1] - a[1]);
  const maxDepto = Math.max(...porDepto.map(d => d[1]), 1);

  const proximasVacaciones = vacaciones
    .filter(v => v.tipo_movimiento === "Solicitud" && v.fecha_movimiento >= hoy())
    .slice(0, 6);

  const limite = new Date();
  limite.setDate(limite.getDate() + 60);
  const fechaLimite = limite.toISOString().slice(0, 10);
  const porVencer = vigentes
    .filter(c => c.fecha_termino && c.fecha_termino >= hoy() && c.fecha_termino <= fechaLimite)
    .sort((a, b) => a.fecha_termino.localeCompare(b.fecha_termino));

  panel.innerHTML = `
    <div class="stats-grid">
      ${indicador("ti-users", "Trabajadores activos", activos, `de ${trabajadores.length} registrados`)}
      ${indicador("ti-file-text", "Contratos vigentes", vigentes.length, `de ${contratos.length} contratos`)}
      ${indicador("ti-calendar-check", "Asistencia de hoy", asistenciaHoy.length, `${ausentesHoy} ausencias o atrasos`)}
      ${verSueldos
        ? indicador("ti-receipt", "Líquido último periodo", formatearDinero(totalLiquido), ultimoPeriodo ? `${liqPeriodo.length} liquidaciones de ${ultimoPeriodo}` : "sin liquidaciones")
        : indicador("ti-alarm", "Contratos por vencer", porVencer.length, "próximos 60 días")}
    </div>

    <div class="dashboard-grid">
      <article class="card">
        <h2><i class="ti ti-chart-bar"></i> Estado de los trabajadores</h2>
        <div class="bars">${estados.map(e => barra(e[0], e[1], maxEstados)).join("")}</div>
      </article>

      <article class="card">
        <h2><i class="ti ti-building"></i> Trabajadores por departamento</h2>
        <div class="bars">
          ${porDepto.length ? porDepto.map(d => barra(d[0], d[1], maxDepto, true)).join("") : `<p class="muted">Sin contratos vigentes.</p>`}
        </div>
      </article>

      <article class="card">
        <h2><i class="ti ti-alarm"></i> Contratos por vencer (60 días)</h2>
        ${porVencer.length ? `
          <ul class="simple-list">
            ${porVencer.map(c => `
              <li>
                <span>${esc(nombreTrabajador(c.id_trabajador))} <small class="muted">· ${esc(c.tipo_contrato || "")}</small></span>
                <strong>${formatearFecha(c.fecha_termino)}</strong>
              </li>`).join("")}
          </ul>` : `<p class="muted">No hay contratos por vencer.</p>`}
      </article>

      ${verAuditoria ? `
      <article class="card">
        <h2><i class="ti ti-history"></i> Últimos movimientos</h2>
        ${auditoria.length ? `
          <ul class="simple-list">
            ${auditoria.slice(0, 6).map(a => `
              <li>
                <span>${badge(nombreAccion(a.accion))} ${esc(nombreTabla(a.tabla_afectada))}
                  <small class="muted">· ${esc(nombreUsuario(a.id_usuario))}</small></span>
                <small class="muted">${formatearFecha(a.fecha_registro)}</small>
              </li>`).join("")}
          </ul>` : `<p class="muted">Aún no hay movimientos registrados.</p>`}
      </article>` : `
      <article class="card">
        <h2><i class="ti ti-beach"></i> Próximas vacaciones</h2>
        ${proximasVacaciones.length ? `
          <ul class="simple-list">
            ${proximasVacaciones.map(v => `
              <li>
                <span>${esc(nombreTrabajador(v.id_trabajador))} <small class="muted">· ${esc(v.dias)} días</small></span>
                <strong>${formatearFecha(v.fecha_movimiento)}</strong>
              </li>`).join("")}
          </ul>` : `<p class="muted">No hay vacaciones programadas.</p>`}
      </article>`}
    </div>`;
}
