import { iniciarSesion, cerrarSesion, escucharSesion, cargarUsuarioActual, registrarAuditoria, cambiarContrasena } from "../api.js";
import { $, mensaje, toast, mostrarModal, cerrarModal } from "../ui.js";

export function iniciarAuth({ alEntrar, alSalir }) {
  let sesionActiva = null;

  $("#loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const boton = e.submitter;
    boton.disabled = true;
    mensaje($("#loginMessage"), "Validando acceso...");
    try {
      await iniciarSesion($("#loginEmail").value.trim(), $("#loginPassword").value);
      $("#loginForm").reset();
    } catch (error) {
      mensaje($("#loginMessage"), error.message, true);
    } finally {
      boton.disabled = false;
    }
  });

  $("#logoutButton").addEventListener("click", () => cerrarSesion());

  $("#passwordButton").addEventListener("click", abrirCambioContrasena);

  escucharSesion((evento, sesion) => {
    setTimeout(async () => {
      if (!sesion) {
        sesionActiva = null;
        alSalir();
        return;
      }
      if (sesionActiva === sesion.user.id) return;

      try {
        const usuario = await cargarUsuarioActual(sesion.user.email);
        sesionActiva = sesion.user.id;
        if (evento === "SIGNED_IN") {
          await registrarAuditoria("Inicio de sesión", "sesion");
          toast(`Bienvenido/a, ${usuario.nombre_usuario}`);
        }
        alEntrar(usuario);
      } catch (error) {
        await cerrarSesion(false);
        mensaje($("#loginMessage"), error.message, true);
      }
    }, 0);
  });
}

function abrirCambioContrasena() {
  const modal = mostrarModal("Cambiar contraseña", `
    <form id="frmClave">
      <label class="field">
        <span>Nueva contraseña *</span>
        <input name="clave1" type="password" required minlength="6" autocomplete="new-password">
      </label>
      <label class="field">
        <span>Repetir contraseña *</span>
        <input name="clave2" type="password" required minlength="6" autocomplete="new-password">
      </label>
      <p id="claveMensaje" class="message"></p>
      <div class="modal-actions">
        <button type="button" class="btn btn-light" data-cerrar>Cancelar</button>
        <button type="submit" class="btn btn-primary"><i class="ti ti-key"></i> Cambiar</button>
      </div>
    </form>`, "modal-sm");

  const form = $("#frmClave", modal);
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const clave1 = form.elements.clave1.value;
    const clave2 = form.elements.clave2.value;
    if (clave1 !== clave2) {
      mensaje($("#claveMensaje", form), "Las contraseñas no coinciden.", true);
      return;
    }
    try {
      await cambiarContrasena(clave1);
      cerrarModal();
      toast("Contraseña actualizada.");
    } catch (error) {
      mensaje($("#claveMensaje", form), error.message, true);
    }
  });
}
