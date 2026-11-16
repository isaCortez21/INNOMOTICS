import { listar, crear, actualizar, eliminar, puedeEditar } from "../api.js";
import { REFERENCIAS } from "../modulos.js";
import { FILAS_POR_PAGINA } from "../config.js";
import {
  $, $$, esc, normalizar, badge, mensaje, toast, mostrarModal, cerrarModal, confirmar,
  formatearFecha, formatearDinero, dibujarPaginador, exportarExcel
} from "../ui.js";
import { abrirFicha } from "./ficha.js";

const cache = {};
let montajeActual = 0;

export async function cargarReferencias(nombres) {
  const todas = new Set();
  nombres.forEach(n => {
    todas.add(n);
    (REFERENCIAS[n].depende || []).forEach(d => todas.add(d));
  });
  await Promise.all([...todas].map(async n => {
    const ref = REFERENCIAS[n];
    cache[n] = await listar(ref.tabla, ref.columnas, ref.orden).catch(() => []);
  }));
}

export function buscar(nombreRef, id) {
  const ref = REFERENCIAS[nombreRef];
  return (cache[nombreRef] || []).find(r => String(r[ref.pk]) === String(id));
}

export function etiqueta(nombreRef, id) {
  if (id === null || id === undefined || id === "") return "";
  const fila = buscar(nombreRef, id);
  return fila ? REFERENCIAS[nombreRef].etiqueta(fila, etiqueta) : `N° ${id}`;
}

export function texto(campo, valor) {
  if (valor === null || valor === undefined || valor === "") return "";
  if (campo.tipo === "fk") return etiqueta(campo.ref, valor);
  if (campo.tipo === "date") return formatearFecha(valor);
  if (campo.tipo === "money") return formatearDinero(valor);
  if (campo.tipo === "time") return String(valor).slice(0, 5);
  return String(valor);
}

function celda(campo, valor) {
  if (valor === null || valor === undefined || valor === "") return `<td>—</td>`;
  if (campo.badge) return `<td>${badge(valor)}</td>`;
  const numerico = ["money", "number"].includes(campo.tipo);
  return `<td class="${numerico ? "num" : ""}">${esc(texto(campo, valor))}</td>`;
}

function resumenFila(modulo, fila) {
  return modulo.campos
    .filter(c => c.tabla && !c.virtual)
    .slice(0, 3)
    .map(c => `${c.etiqueta}: ${texto(c, fila[c.nombre]) || "—"}`)
    .join(" | ");
}

function cambios(modulo, antes, despues) {
  return modulo.campos
    .filter(c => !c.virtual && texto(c, antes[c.nombre]) !== texto(c, despues[c.nombre]))
    .map(c => `${c.etiqueta}: ${texto(c, antes[c.nombre]) || "—"} → ${texto(c, despues[c.nombre]) || "—"}`)
    .join(" | ");
}

export async function montarCrud(modulo) {
  const miMontaje = ++montajeActual;
  const editable = puedeEditar(modulo.tabla) && !modulo.soloLectura;
  const conHerramienta = modulo.herramienta && puedeEditar(modulo.tabla);
  const conAcciones = editable || modulo.ficha;
  const panel = $("#crudPanel");
  panel.innerHTML = `<div class="card empty">Cargando ${esc(modulo.titulo.toLowerCase())}...</div>`;

  const colId = { nombre: modulo.pk, etiqueta: "N°", tipo: "number" };
  const columnas = [colId, ...modulo.campos.filter(c => c.tabla)];
  const camposFiltro = modulo.campos.filter(c => c.filtro);
  const camposBusqueda = [colId, ...modulo.campos.filter(c => !c.virtual)];

  let filas = [];
  let busqueda = "";
  const filtros = {};
  let pagina = 1;
  let orden = { campo: null, asc: true };

  try {
    const refs = [...new Set(modulo.campos.filter(c => c.tipo === "fk").map(c => c.ref))];
    await cargarReferencias(refs);
    filas = await listar(modulo.tabla, "*", modulo.orden, modulo.descendente);
  } catch (e) {
    if (miMontaje !== montajeActual) return;
    panel.innerHTML = `<div class="card empty"><i class="ti ti-alert-triangle"></i> ${esc(e.message)}</div>`;
    return;
  }
  if (miMontaje !== montajeActual) return;

  panel.innerHTML = `
    <div class="module-head">
      <div>
        <p class="muted">${esc(modulo.descripcion)}</p>
      </div>
      <div class="head-actions">
        ${conHerramienta ? `<button id="btnHerramienta" class="btn btn-secondary"><i class="ti ${modulo.herramienta.icono}"></i> ${esc(modulo.herramienta.texto)}</button>` : ""}
        ${editable ? `<button id="btnNuevo" class="btn btn-primary"><i class="ti ti-plus"></i> Nuevo registro</button>` : ""}
        ${!editable && !conHerramienta ? `<span class="badge">Solo lectura</span>` : ""}
      </div>
    </div>

    <div class="card toolbar">
      <div class="search-box">
        <i class="ti ti-search"></i>
        <input id="txtBuscar" type="search" placeholder="Buscar en ${esc(modulo.titulo.toLowerCase())}...">
      </div>
      ${camposFiltro.map(c => `
        <select data-filtro="${c.nombre}" title="${esc(c.etiqueta)}">
          <option value="">${esc(c.etiqueta)}: todos</option>
          ${opcionesFiltro(c)}
        </select>`).join("")}
      <span class="spacer"></span>
      <button id="btnExcel" class="btn btn-light"><i class="ti ti-file-spreadsheet"></i> Exportar Excel</button>
    </div>

    <div class="card table-card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              ${columnas.map(c => `<th data-orden="${c.nombre}">${esc(c.etiqueta)} <i class="ti ti-arrows-sort"></i></th>`).join("")}
              ${conAcciones ? `<th class="col-acciones">Acciones</th>` : ""}
            </tr>
          </thead>
          <tbody id="tbodyFilas"></tbody>
        </table>
      </div>
      <div class="table-footer">
        <span id="resumen"></span>
        <div id="paginador" class="pager"></div>
      </div>
    </div>`;

  function opcionesFiltro(campo) {
    let lista;
    if (campo.tipo === "select") {
      lista = campo.opciones.map(o => [o, o]);
    } else if (campo.tipo === "fk") {
      const pk = REFERENCIAS[campo.ref].pk;
      lista = (cache[campo.ref] || []).map(r => [r[pk], etiqueta(campo.ref, r[pk])]);
    } else {
      lista = [...new Set(filas.map(f => f[campo.nombre]).filter(Boolean))].sort().reverse().map(v => [v, texto(campo, v)]);
    }
    return lista.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("");
  }

  function filasVisibles() {
    const q = normalizar(busqueda);
    let lista = filas.filter(f => {
      for (const [campo, val] of Object.entries(filtros)) {
        if (val && String(f[campo]) !== val) return false;
      }
      if (!q) return true;
      return camposBusqueda.some(c => normalizar(texto(c, f[c.nombre])).includes(q));
    });

    if (orden.campo) {
      const campo = columnas.find(c => c.nombre === orden.campo);
      const numerico = ["number", "money"].includes(campo.tipo);
      lista = [...lista].sort((a, b) => {
        const va = a[campo.nombre];
        const vb = b[campo.nombre];
        let r;
        if (numerico) r = (Number(va) || 0) - (Number(vb) || 0);
        else if (["date", "month", "time"].includes(campo.tipo)) r = String(va || "").localeCompare(String(vb || ""));
        else r = normalizar(texto(campo, va)).localeCompare(normalizar(texto(campo, vb)));
        return orden.asc ? r : -r;
      });
    }
    return lista;
  }

  function botonesFila(f) {
    const id = esc(f[modulo.pk]);
    let html = "";
    if (modulo.ficha) {
      html += `<button class="btn btn-icon" data-ficha="${id}" title="Ver ficha"><i class="ti ti-id"></i></button>`;
    }
    if (editable) {
      html += `<button class="btn btn-icon" data-editar="${id}" title="Editar"><i class="ti ti-pencil"></i></button>`;
      if (modulo.desactivar) {
        const yaInactivo = f[modulo.desactivar.campo] === modulo.desactivar.valor;
        const oculto = modulo.ocultarDesactivar?.(f);
        if (!yaInactivo && !oculto) {
          html += `<button class="btn btn-icon btn-danger" data-desactivar="${id}" title="${esc(modulo.desactivar.texto || "Desactivar")}"><i class="ti ti-ban"></i></button>`;
        }
      } else {
        html += `<button class="btn btn-icon btn-danger" data-eliminar="${id}" title="Eliminar"><i class="ti ti-trash"></i></button>`;
      }
    }
    return `<td class="actions">${html}</td>`;
  }

  function dibujar() {
    const lista = filasVisibles();
    const totalPaginas = Math.max(1, Math.ceil(lista.length / FILAS_POR_PAGINA));
    if (pagina > totalPaginas) pagina = totalPaginas;
    const desde = (pagina - 1) * FILAS_POR_PAGINA;
    const pagActual = lista.slice(desde, desde + FILAS_POR_PAGINA);

    $("#tbodyFilas").innerHTML = pagActual.length
      ? pagActual.map(f => `
          <tr>
            ${columnas.map(c => celda(c, f[c.nombre])).join("")}
            ${conAcciones ? botonesFila(f) : ""}
          </tr>`).join("")
      : `<tr><td colspan="${columnas.length + (conAcciones ? 1 : 0)}" class="empty">No hay registros para mostrar.</td></tr>`;

    $("#resumen").textContent = `${lista.length} de ${filas.length} registros`;
    dibujarPaginador($("#paginador"), lista.length, pagina, FILAS_POR_PAGINA, p => { pagina = p; dibujar(); });

    $$("th[data-orden]", panel).forEach(th => {
      const icono = th.querySelector(".ti");
      icono.className = "ti " + (th.dataset.orden !== orden.campo ? "ti-arrows-sort" : orden.asc ? "ti-sort-ascending" : "ti-sort-descending");
    });
  }

  async function recargar() {
    try {
      filas = await listar(modulo.tabla, "*", modulo.orden, modulo.descendente);
      dibujar();
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function ejecutarDespues(nuevo, anterior) {
    if (!modulo.despuesDeGuardar) return;
    try {
      await modulo.despuesDeGuardar({ nuevo, anterior });
    } catch (e) {
      toast("Se guardó, pero no se pudo recalcular: " + e.message, true);
    }
  }

  $("#txtBuscar").addEventListener("input", e => { busqueda = e.target.value; pagina = 1; dibujar(); });

  $$("[data-filtro]", panel).forEach(sel => sel.addEventListener("change", () => {
    filtros[sel.dataset.filtro] = sel.value;
    pagina = 1;
    dibujar();
  }));

  $$("th[data-orden]", panel).forEach(th => th.addEventListener("click", () => {
    const campo = th.dataset.orden;
    orden = { campo, asc: orden.campo === campo ? !orden.asc : true };
    dibujar();
  }));

  if (editable) $("#btnNuevo").addEventListener("click", () => abrirFormulario());

  if (conHerramienta) {
    $("#btnHerramienta").addEventListener("click", async e => {
      const boton = e.currentTarget;
      boton.disabled = true;
      try {
        toast(await modulo.herramienta.accion());
        await recargar();
      } catch (err) {
        toast(err.message, true);
      } finally {
        boton.disabled = false;
      }
    });
  }

  $("#btnExcel").addEventListener("click", () => {
    const datos = filasVisibles().map(f => {
      const fila = {};
      columnas.forEach(c => { fila[c.etiqueta] = texto(c, f[c.nombre]); });
      return fila;
    });
    exportarExcel(modulo.tabla, datos);
  });

  $("#tbodyFilas").addEventListener("click", async e => {
    const boton = e.target.closest("[data-ficha], [data-editar], [data-desactivar], [data-eliminar]");
    if (!boton) return;
    const id = boton.dataset.ficha || boton.dataset.editar || boton.dataset.desactivar || boton.dataset.eliminar;
    const fila = filas.find(f => String(f[modulo.pk]) === id);

    if (boton.dataset.ficha) abrirFicha(fila);

    if (boton.dataset.editar) abrirFormulario(fila);

    if (boton.dataset.desactivar) {
      const { campo, valor, texto: textoBoton = "Desactivar" } = modulo.desactivar;
      const ok = await confirmar(`¿${textoBoton} el registro N° ${id}? Quedará como "${valor}" y se conserva el historial.`, textoBoton, "ti-ban");
      if (!ok) return;
      try {
        const detalle = `${resumenFila(modulo, fila)} | Estado: ${fila[campo] || "—"} → ${valor}`;
        await actualizar(modulo.tabla, modulo.pk, id, { [campo]: valor }, detalle, "Desactivar");
        toast(`Registro N° ${id}: ${valor.toLowerCase()}.`);
        await recargar();
      } catch (err) {
        toast(err.message, true);
      }
    }

    if (boton.dataset.eliminar) {
      const ok = await confirmar(`¿Eliminar el registro N° ${id}? Esta acción no se puede deshacer.`);
      if (!ok) return;
      try {
        await eliminar(modulo.tabla, modulo.pk, id, resumenFila(modulo, fila));
        await ejecutarDespues(null, fila);
        toast("Registro eliminado.");
        await recargar();
      } catch (err) {
        toast(err.message, true);
      }
    }
  });

  function abrirFormulario(fila = null) {
    const esEdicion = !!fila;
    const datosFila = fila || {};
    const camposForm = modulo.campos.filter(c => !(esEdicion && c.soloNuevo));

    const modal = mostrarModal(
      esEdicion ? `Editar ${modulo.titulo.toLowerCase()} N° ${datosFila[modulo.pk]}` : `Nuevo registro: ${modulo.titulo.toLowerCase()}`,
      `<form id="frmRegistro">
        <div class="form-grid">
          ${camposForm.map(c => htmlCampo(c, esEdicion ? datosFila[c.nombre] : valorInicial(c), esEdicion)).join("")}
        </div>
        <p id="frmMensaje" class="message"></p>
        <div class="modal-actions">
          <button type="button" class="btn btn-light" data-cerrar>Cancelar</button>
          <button type="submit" class="btn btn-primary"><i class="ti ti-device-floppy"></i> Guardar</button>
        </div>
      </form>`
    );

    const form = $("#frmRegistro", modal);
    const ctx = { filas, buscar, etiqueta, esEdicion, id: datosFila[modulo.pk], aviso: null };

    if (modulo.alCambiar) {
      form.addEventListener("input", e => modulo.alCambiar(form, e.target.name, ctx));
      modulo.alCambiar(form, null, ctx);
    }

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const boton = form.querySelector("[type=submit]");
      const datos = leerFormulario(form, esEdicion);
      boton.disabled = true;
      mensaje($("#frmMensaje", form), "Guardando...");

      try {
        if (modulo.antesDeGuardar) await modulo.antesDeGuardar(datos, form, ctx);

        let guardado;
        if (esEdicion) {
          const detalle = cambios(modulo, datosFila, datos) || "Sin cambios";
          guardado = await actualizar(modulo.tabla, modulo.pk, datosFila[modulo.pk], datos, detalle);
        } else {
          guardado = await crear(modulo.tabla, datos, modulo.pk, resumenFila(modulo, datos));
        }
        await ejecutarDespues(guardado, fila);

        cerrarModal();
        toast(ctx.aviso || (esEdicion ? "Cambios guardados." : "Registro creado."), !!ctx.aviso);
        await recargar();
      } catch (err) {
        mensaje($("#frmMensaje", form), err.message, true);
        boton.disabled = false;
      }
    });
  }

  function valorInicial(campo) {
    return typeof campo.porDefecto === "function" ? campo.porDefecto() : campo.porDefecto ?? "";
  }

  function leerFormulario(form, esEdicion) {
    const datos = {};
    modulo.campos.filter(c => !c.virtual && !(esEdicion && c.soloNuevo)).forEach(c => {
      const bruto = form.elements[c.nombre].value.trim();
      if (bruto === "") datos[c.nombre] = null;
      else if (["fk", "number", "money"].includes(c.tipo)) datos[c.nombre] = Number(bruto);
      else datos[c.nombre] = bruto;
    });
    return datos;
  }

  function htmlCampo(campo, valor, esEdicion) {
    const v = valor ?? "";
    const req = campo.requerido ? "required" : "";
    const bloqueado = esEdicion && campo.bloqueadoEnEdicion ? "readonly" : "";
    const titulo = `${esc(campo.etiqueta)}${campo.requerido ? " *" : ""}`;
    let control;

    if (campo.tipo === "select") {
      const opciones = [...campo.opciones];
      if (v !== "" && !opciones.includes(v)) opciones.push(v);
      control = `
        <select name="${campo.nombre}" ${req}>
          <option value="">Seleccione...</option>
          ${opciones.map(o => `<option ${String(o) === String(v) ? "selected" : ""}>${esc(o)}</option>`).join("")}
        </select>`;
    } else if (campo.tipo === "fk") {
      const pk = REFERENCIAS[campo.ref].pk;
      control = `
        <select name="${campo.nombre}" ${req}>
          <option value="">Seleccione...</option>
          ${(cache[campo.ref] || []).map(r => `
            <option value="${r[pk]}" ${String(r[pk]) === String(v) ? "selected" : ""}>${esc(etiqueta(campo.ref, r[pk]))}</option>`).join("")}
        </select>`;
    } else if (campo.tipo === "textarea") {
      control = `<textarea name="${campo.nombre}" ${req}>${esc(v)}</textarea>`;
    } else if (campo.tipo === "money") {
      control = `<input name="${campo.nombre}" type="number" min="0" step="1" value="${esc(v)}" ${req}>`;
    } else if (campo.tipo === "number") {
      control = `<input name="${campo.nombre}" type="number" step="any" value="${esc(v)}" ${req}>`;
    } else if (campo.tipo === "time") {
      control = `<input name="${campo.nombre}" type="time" value="${esc(String(v).slice(0, 5))}" ${req}>`;
    } else {
      control = `<input name="${campo.nombre}" type="${campo.tipo}" value="${esc(v)}" ${req} ${bloqueado} autocomplete="off">`;
    }

    return `
      <label class="field ${campo.completo ? "full" : ""}">
        <span>${titulo}</span>
        ${control}
        ${campo.ayuda ? `<small>${esc(campo.ayuda)}</small>` : ""}
      </label>`;
  }

  dibujar();
}
