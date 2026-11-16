import { SUPABASE_URL, SUPABASE_KEY, PERMISOS_POR_ROL } from "./config.js";

export const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const clienteAltas = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, storageKey: "rh-altas" }
});

let usuarioActual = null;
export const getUsuarioActual = () => usuarioActual;

function errorAmigable(error, accion = "") {
  const codigo = error?.code;
  if (codigo === "23503") {
    return new Error(accion === "eliminar"
      ? "No se puede eliminar: hay otros registros que dependen de este."
      : "El registro relacionado no existe.");
  }
  if (codigo === "23505") return new Error("Ya existe un registro con esos datos (dato duplicado).");
  if (codigo === "23502") return new Error("Falta completar un campo obligatorio.");
  if (codigo === "22P02" || codigo === "22007" || codigo === "22008") return new Error("Hay un dato con formato inválido.");
  if (codigo === "22001") return new Error("Un texto es demasiado largo para el campo.");
  if (codigo === "42501") return new Error("Tu rol no tiene permiso para realizar esta acción.");
  return new Error(error?.message || "Ocurrió un error inesperado.");
}

export async function iniciarSesion(email, password) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(error.message === "Invalid login credentials"
      ? "Correo o contraseña incorrectos."
      : error.message);
  }
}

export async function cerrarSesion(registrar = true) {
  if (registrar && usuarioActual) await registrarAuditoria("Cierre de sesión", "sesion");
  usuarioActual = null;
  await client.auth.signOut();
}

export function escucharSesion(callback) {
  client.auth.onAuthStateChange((evento, sesion) => callback(evento, sesion));
}

export async function cargarUsuarioActual(email) {
  const { data, error } = await client.from("usuario").select("*").eq("correo", email.toLowerCase()).maybeSingle();
  if (error) throw errorAmigable(error);
  if (!data) throw new Error("Tu usuario no está registrado en el sistema. Pide al administrador que te cree.");
  if (data.estado !== "Activo") throw new Error(`Tu usuario está ${data.estado.toLowerCase()}. Contacta al administrador.`);
  if (!data.id_rol) throw new Error("Tu usuario no tiene un rol asignado. Contacta al administrador.");

  const rol = await client.from("rol").select("nombre").eq("id_rol", data.id_rol).maybeSingle();
  data.nombre_rol = rol.data?.nombre || "";
  if (!PERMISOS_POR_ROL[data.nombre_rol]) throw new Error(`El rol "${data.nombre_rol}" no existe en el sistema.`);

  usuarioActual = data;
  return data;
}

export async function crearUsuarioLogin(email, password) {
  const { data, error } = await clienteAltas.auth.signUp({ email, password });
  if (error) {
    if (/already registered|already exists/i.test(error.message)) return "existente";
    if (/signups not allowed/i.test(error.message)) {
      throw new Error("Supabase no permite registrar usuarios. Activa 'Allow new users to sign up' en Authentication.");
    }
    throw new Error(error.message);
  }
  if (data.user && !data.session) return "por-confirmar";
  return "creado";
}

export async function cambiarContrasena(nueva) {
  const { error } = await client.auth.updateUser({ password: nueva });
  if (error) throw new Error(error.message);
  await registrarAuditoria("Cambio de contraseña", "sesion");
}

function permisosActuales() {
  return PERMISOS_POR_ROL[usuarioActual?.nombre_rol] || { ver: [], editar: [] };
}

export function puedeVer(vista) {
  if (vista === "dashboard") return true;
  const { ver } = permisosActuales();
  return ver === "*" || ver.includes(vista);
}

export function puedeEditar(vista) {
  const { editar } = permisosActuales();
  return editar === "*" || editar.includes(vista);
}

export const esAdministrador = () => usuarioActual?.nombre_rol === "Administrador";

export async function listar(tabla, columnas = "*", orden = null, descendente = false) {
  let consulta = client.from(tabla).select(columnas).limit(1000);
  if (orden) consulta = consulta.order(orden, { ascending: !descendente });
  const { data, error } = await consulta;
  if (error) throw errorAmigable(error);
  return data || [];
}

export async function listarDe(tabla, campo, valor, orden = null, descendente = false) {
  let consulta = client.from(tabla).select("*").eq(campo, valor).limit(1000);
  if (orden) consulta = consulta.order(orden, { ascending: !descendente });
  const { data, error } = await consulta;
  if (error) throw errorAmigable(error);
  return data || [];
}

export async function crear(tabla, datos, pk, detalle = null) {
  const { data, error } = await client.from(tabla).insert(datos).select().single();
  if (error) throw errorAmigable(error);
  await registrarAuditoria("Crear", tabla, data?.[pk], detalle);
  return data;
}

export async function actualizar(tabla, pk, id, datos, detalle = null, accion = "Editar") {
  const { data, error } = await client.from(tabla).update(datos).eq(pk, id).select().single();
  if (error) throw errorAmigable(error);
  await registrarAuditoria(accion, tabla, id, detalle);
  return data;
}

export async function eliminar(tabla, pk, id, detalle = null) {
  const { error } = await client.from(tabla).delete().eq(pk, id);
  if (error) throw errorAmigable(error, "eliminar");
  await registrarAuditoria("Eliminar", tabla, id, detalle);
}

export async function actualizarSinAuditoria(tabla, pk, id, datos) {
  const { error } = await client.from(tabla).update(datos).eq(pk, id);
  if (error) throw errorAmigable(error);
}

export async function crearSinAuditoria(tabla, datos) {
  const { error } = await client.from(tabla).insert(datos);
  if (error) throw errorAmigable(error);
}

export async function registrarAuditoria(accion, tabla, idRegistro = null, detalle = null) {
  try {
    await client.from("auditoria").insert({
      id_usuario: usuarioActual?.id_usuario ?? null,
      accion,
      tabla_afectada: tabla,
      id_registro: idRegistro ? Number(idRegistro) : null,
      detalle: detalle ? String(detalle).slice(0, 500) : null
    });
  } catch (e) {
    console.warn("No se pudo registrar la auditoría", e);
  }
}
