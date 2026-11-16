# RH Gestión

Sistema web de Recursos Humanos hecho con HTML, CSS y JavaScript, conectado a Supabase (base de datos PostgreSQL + login).

## Tecnologías

| Tecnología | Uso |
|---|---|
| HTML / CSS / JavaScript (módulos ES) | Interfaz y lógica |
| Supabase | Base de datos, login (Authentication) y seguridad por rol (RLS) |
| Tabler Icons | Íconos (se cargan desde CDN) |
| SheetJS | Exportar a Excel (se carga desde CDN) |



### Configuración de Supabase

- **Authentication > Users**: el primer administrador se crea a mano (Add user, marcar *Auto Confirm User*) con el mismo correo que tiene en la tabla `usuario`.
- **Authentication > Sign In / Providers > Email**:
  - *Allow new users to sign up*: **activado** (el administrador crea usuarios desde el sistema).
  - *Confirm email*: **desactivado** (si no, los usuarios nuevos tendrían que confirmar el correo antes de entrar).
- `js/config.js`: poner la URL y la *publishable key* del proyecto (Project Settings > API Keys).

### Ejecutar

Por usar módulos ES no funciona abriendo el HTML con doble clic. Hay que levantar un servidor local:

```bash
cd rh-gestion-modular
python3 -m http.server 5500
```

Abrir `http://localhost:5500`.

## Roles y permisos

Los permisos están definidos en `js/config.js` (`PERMISOS_POR_ROL`) y también en la base de datos (`sql/04_seguridad_por_rol.sql`), para que no se puedan saltar llamando a la API directamente.

| Rol | Puede ver | Puede crear / editar |
|---|---|---|
| **Administrador** | Todo | Todo, incluida la Configuración (Usuarios y Auditoría) |
| **RRHH** | Personas, contratos, asistencia, vacaciones y remuneraciones | Lo mismo que ve |
| **Lector** | Personas, contratos, asistencia y vacaciones (sin sueldos ni liquidaciones) | Nada |

Reglas de acceso:

- Para entrar, el usuario debe existir en Supabase Authentication **y** en la tabla `usuario`, con estado **Activo** y un rol asignado.
- Un usuario Bloqueado o Inactivo no puede iniciar sesión.
- El administrador no puede desactivarse ni cambiarse el rol a sí mismo.

## Módulos

| Grupo | Módulo | Qué hace |
|---|---|---|
| Principal | Panel principal | Indicadores, trabajadores por estado y departamento, contratos por vencer, últimos movimientos (admin) o próximas vacaciones |
| Personas | Trabajadores | Ficha personal. Botón **Ver ficha** con todo el historial del trabajador e impresión |
| | Departamentos, Cargos | Catálogos de la empresa |
| Contratos | Contratos | Un solo contrato vigente por trabajador. Botón **Terminar** |
| | Anexos | Sugiere el número de anexo. Botón **Anular** |
| Asistencia y vacaciones | Asistencia diaria | Entrada y salida; las horas se calculan solas |
| | Vacaciones | Abono suma días, Solicitud resta, Ajuste corrige. Calcula días hábiles sin fines de semana ni feriados |
| | Saldo de vacaciones | Solo lectura: se calcula con los movimientos. Botón **Recalcular saldos** |
| Remuneraciones | Conceptos de pago | Haberes y descuentos |
| | Liquidaciones | Al elegir el contrato completa trabajador y sueldo. No permite dos liquidaciones del mismo contrato y periodo |
| | Detalle de liquidaciones | Al guardar, el líquido de la liquidación pasa a ser haberes − descuentos |
| Configuración | Usuarios | Crear usuarios con contraseña y asignar rol |
| | Auditoría | Historial con filtros y exportación a Excel |

En todas las tablas: buscador (sin importar mayúsculas ni tildes), filtros, orden por columna, paginación y exportación a Excel.

## Reglas de negocio

- **RUT**: se valida el dígito verificador y se guarda con formato `12345678-9`.
- **Trabajador desvinculado**: exige fecha de salida, que no puede ser anterior a la de ingreso.
- **Contrato a plazo fijo**: exige fecha de término.
- **Desactivar en vez de borrar**: trabajadores, departamentos, cargos, conceptos y usuarios pasan a *Inactivo*; contratos a *Terminado*; anexos a *Anulado*. Así se conserva el historial. Las demás tablas sí se eliminan; si un registro tiene datos relacionados, el sistema avisa.
- **Saldo de vacaciones** = abonos + ajustes − solicitudes. No se puede pedir más días de los disponibles. Cada año hay que registrar un *Abono* con los días que le corresponden al trabajador (15 días hábiles por ley).
- **Feriados**: lista en `js/config.js` (`FERIADOS`). Hay que agregar los del año siguiente.
- **Sueldo líquido**: al crear la liquidación se estima como sueldo base − 19,1% (AFP 11,5% + salud 7% + cesantía 0,6%). Cuando se agrega el detalle, pasa a ser la suma de haberes menos descuentos.

## Auditoría

Se registra automáticamente:

- crear, editar, desactivar y eliminar (con el número de registro y el detalle; al editar se guarda qué cambió, por ejemplo `Sueldo base: $540.000 → $560.000`),
- inicio y cierre de sesión,
- cambio de contraseña.

Solo el Administrador puede ver la auditoría.

## Cambio de contraseña

Cada usuario puede cambiar su contraseña con el botón **Cambiar contraseña** del menú lateral.

## Estructura del proyecto

```
index.html                     Estructura de la página (login + aplicación)
css/styles.css                 Estilos
js/config.js                   Conexión a Supabase, listas de opciones, feriados, menú y permisos por rol
js/modulos.js                  Definición de cada tabla: campos, validaciones y cálculos automáticos
js/api.js                      Login, consultas a Supabase (CRUD), permisos y auditoría
js/calculos.js                 Saldo de vacaciones y líquido de liquidaciones
js/ui.js                       Funciones de apoyo: formatos, RUT, días hábiles, modal, mensajes, Excel
js/main.js                     Menú y navegación entre vistas
js/modules/auth.js             Inicio y cierre de sesión, cambio de contraseña
js/modules/dashboard.js        Panel principal
js/modules/crud.js             Pantalla reutilizable para todas las tablas
js/modules/ficha.js            Ficha del trabajador
js/modules/auditoria.js        Historial de auditoría
diagrama.dbml                  Modelo de datos (se puede abrir en dbdiagram.io)
```

## Cómo funciona `js/modulos.js`

Cada tabla es un objeto dentro de `MODULOS`. Ejemplo:

```js
cargo: {
  titulo: "Cargos", icono: "ti-briefcase", tabla: "cargo", pk: "id_cargo", orden: "nombre",
  descripcion: "Puestos de trabajo disponibles.",
  desactivar: { campo: "estado", valor: "Inactivo" },
  campos: [
    { nombre: "nombre", etiqueta: "Nombre", tipo: "text", requerido: true, tabla: true },
    { nombre: "estado", etiqueta: "Estado", tipo: "select", opciones: ["Activo", "Inactivo"], tabla: true, filtro: true, badge: true }
  ]
}
```

Opciones de cada campo:

| Opción | Significado |
|---|---|
| `nombre` | Columna en la base de datos |
| `etiqueta` | Texto que ve el usuario |
| `tipo` | `text`, `number`, `money`, `date`, `month`, `time`, `email`, `tel`, `password`, `textarea`, `select` o `fk` (relación con otra tabla) |
| `opciones` | Lista fija para los `select` |
| `ref` | Tabla relacionada para los `fk` (definidas en `REFERENCIAS`) |
| `requerido` | Obligatorio |
| `tabla` | Se muestra como columna |
| `filtro` | Aparece como filtro |
| `badge` | Se muestra con color según el estado |
| `completo` | Ocupa todo el ancho del formulario |
| `virtual` | Solo existe en el formulario, no se guarda |
| `soloNuevo` | Solo aparece al crear (ej: contraseña) |
| `bloqueadoEnEdicion` | No se puede cambiar al editar (ej: correo) |
| `porDefecto` | Valor inicial al crear |
| `ayuda` | Texto de ayuda bajo el campo |

Opciones del módulo:

| Opción | Significado |
|---|---|
| `desactivar` | Reemplaza "Eliminar" por cambiar un campo a un valor (ej: estado a Inactivo) |
| `soloLectura` | No permite crear ni editar |
| `ficha` | Muestra el botón Ver ficha |
| `herramienta` | Botón extra en la cabecera (ej: Recalcular saldos) |
| `alCambiar(form, campo, ctx)` | Se ejecuta al cambiar un campo (cálculos automáticos) |
| `antesDeGuardar(datos, form, ctx)` | Validaciones; si lanza un error, no se guarda |
| `despuesDeGuardar({ nuevo, anterior })` | Se ejecuta después de guardar o eliminar (ej: recalcular saldo) |

