import { FERIADOS } from "./config.js";

export const $ = (selector, raiz = document) => raiz.querySelector(selector);
export const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];

export function esc(valor) {
  return String(valor ?? "").replace(/[&<>'"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[c]));
}

export function normalizar(texto) {
  return String(texto ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const dos = n => String(n).padStart(2, "0");

export function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export function aFecha(valor) {
  let texto = String(valor).replace(" ", "T");
  if (!/(Z|[+-]\d\d:?\d\d)$/i.test(texto)) texto += "Z";
  return new Date(texto);
}

export function formatearFecha(valor) {
  if (!valor) return "";
  const texto = String(valor);
  if (texto.length <= 10) {
    const [a, m, d] = texto.split("-");
    return d ? `${d}/${m}/${a}` : texto;
  }
  const f = aFecha(texto);
  return `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()} ${dos(f.getHours())}:${dos(f.getMinutes())}`;
}

export function diaLocal(valor) {
  const f = aFecha(valor);
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`;
}

export function formatearDinero(valor) {
  if (valor === null || valor === undefined || valor === "") return "";
  return Number(valor).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}

export function diasHabiles(inicio, termino) {
  if (!inicio || !termino) return 0;
  const dia = new Date(inicio + "T12:00:00");
  const fin = new Date(termino + "T12:00:00");
  let total = 0;
  while (dia <= fin) {
    const semana = dia.getDay();
    const fecha = `${dia.getFullYear()}-${dos(dia.getMonth() + 1)}-${dos(dia.getDate())}`;
    if (semana !== 0 && semana !== 6 && !FERIADOS.includes(fecha)) total++;
    dia.setDate(dia.getDate() + 1);
  }
  return total;
}

export function horasEntre(entrada, salida) {
  if (!entrada || !salida) return null;
  const [h1, m1] = entrada.split(":").map(Number);
  const [h2, m2] = salida.split(":").map(Number);
  let minutos = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (minutos < 0) minutos += 24 * 60;
  return Math.round(minutos / 60 * 100) / 100;
}

export function formatearRut(rut) {
  const limpio = String(rut || "").replace(/[^0-9kK]/g, "").toUpperCase();
  if (limpio.length < 2) return limpio;
  return limpio.slice(0, -1) + "-" + limpio.slice(-1);
}

export function rutValido(rut) {
  const limpio = formatearRut(rut);
  if (!/^\d{7,8}-[\dK]$/.test(limpio)) return false;
  const [numero, dv] = limpio.split("-");
  let suma = 0;
  let multiplo = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    suma += Number(numero[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
  return dv === esperado;
}

const ESTADOS_OK = ["activo", "vigente", "presente", "haber", "crear", "inicio de sesion", "abono"];
const ESTADOS_WARN = ["pendiente", "atraso", "suspendido", "licencia", "permiso", "editar", "solicitud", "desactivar", "ajuste"];
const ESTADOS_BAD = ["desvinculado", "terminado", "ausente", "bloqueado", "anulado", "descuento", "eliminar"];

export function badge(valor) {
  if (valor === null || valor === undefined || valor === "") return "—";
  const v = normalizar(valor);
  let clase = "";
  if (ESTADOS_OK.includes(v)) clase = "badge-ok";
  else if (ESTADOS_WARN.includes(v)) clase = "badge-warn";
  else if (ESTADOS_BAD.includes(v)) clase = "badge-bad";
  return `<span class="badge ${clase}">${esc(valor)}</span>`;
}

export function mensaje(elemento, texto = "", esError = false) {
  if (!elemento) return;
  elemento.textContent = texto;
  elemento.classList.toggle("error", esError);
}

export function toast(texto, esError = false) {
  const caja = document.createElement("div");
  caja.className = "toast" + (esError ? " error" : "");
  caja.innerHTML = `<i class="ti ${esError ? "ti-alert-circle" : "ti-circle-check"}"></i><span>${esc(texto)}</span>`;
  $("#toastRoot").appendChild(caja);
  setTimeout(() => caja.remove(), 3500);
}

export function mostrarModal(titulo, contenidoHtml, tamano = "") {
  const raiz = $("#modalRoot");
  raiz.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal ${tamano}" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2>${esc(titulo)}</h2>
          <button type="button" class="btn btn-icon" data-cerrar title="Cerrar"><i class="ti ti-x"></i></button>
        </div>
        ${contenidoHtml}
      </div>
    </div>`;
  raiz.querySelector(".modal-backdrop").addEventListener("click", e => {
    if (e.target.classList.contains("modal-backdrop") || e.target.closest("[data-cerrar]")) cerrarModal();
  });
  return raiz.querySelector(".modal");
}

export function cerrarModal() {
  $("#modalRoot").replaceChildren();
}

export function confirmar(texto, textoBoton = "Eliminar", icono = "ti-trash") {
  return new Promise(resolver => {
    const modal = mostrarModal("Confirmar", `
      <p>${esc(texto)}</p>
      <div class="modal-actions">
        <button type="button" class="btn btn-light" data-cerrar>Cancelar</button>
        <button type="button" class="btn btn-danger" id="btnConfirmar"><i class="ti ${icono}"></i> ${esc(textoBoton)}</button>
      </div>`, "modal-sm");
    $("#btnConfirmar", modal).onclick = () => { cerrarModal(); resolver(true); };
    $$("[data-cerrar]", modal).forEach(b => b.addEventListener("click", () => resolver(false)));
  });
}

export function dibujarPaginador(contenedor, total, pagina, porPagina, alCambiar) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  contenedor.innerHTML = `
    <button class="btn btn-icon" data-pag="${pagina - 1}" ${pagina <= 1 ? "disabled" : ""} title="Anterior"><i class="ti ti-chevron-left"></i></button>
    <span>Página ${pagina} de ${paginas}</span>
    <button class="btn btn-icon" data-pag="${pagina + 1}" ${pagina >= paginas ? "disabled" : ""} title="Siguiente"><i class="ti ti-chevron-right"></i></button>`;
  $$("[data-pag]", contenedor).forEach(b => b.onclick = () => alCambiar(Number(b.dataset.pag)));
}

export function exportarExcel(nombreArchivo, filas) {
  if (!window.XLSX) {
    toast("No se pudo cargar la librería de Excel.", true);
    return;
  }
  if (!filas.length) {
    toast("No hay datos para exportar.", true);
    return;
  }
  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja["!cols"] = Object.keys(filas[0]).map(col => ({
    wch: Math.min(40, Math.max(col.length, ...filas.map(f => String(f[col] ?? "").length)) + 2)
  }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Datos");
  XLSX.writeFile(libro, `${nombreArchivo}_${hoy()}.xlsx`);
}
