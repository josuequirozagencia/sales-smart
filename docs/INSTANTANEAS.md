# Instantáneas de configuración

Una **instantánea** guarda la configuración de una empresa tal como está en
un momento dado —etiquetas, colas, chatbot, mensajes rápidos, prompts,
ajustes…— con sus archivos, para **cargarla después** en otras empresas.

Sirve para tener plantillas estables («Academia v1», «Clínica v2») y montar
empresas nuevas creadas a mano, con sus propios usuarios, sin rehacer la
configuración.

Está en **Configuración → Instantáneas**.

## Quién puede qué

| | Superadministrador | Admin de una empresa | Otros usuarios |
| --- | --- | --- | --- |
| Ver la lista | Sí | Sí | No |
| Crear | Sí | No | No |
| Cargar | En cualquier empresa | Solo en la suya | No |
| Eliminar | Sí | No | No |

El backend comprueba lo mismo: un admin que pida cargar en otra empresa
recibe `ERR_NO_PERMISSION`.

## Crear una instantánea

1. **Crear instantánea**.
2. Elige la empresa que hace de plantilla, un nombre (único) y, si quieres,
   una descripción.
3. Marca las funciones que se empaquetan. El chatbot y los prompts necesitan
   las colas: al marcarlos se marcan también.

La instantánea queda **congelada**: guarda una copia de las filas y de los
archivos. Si después cambias o borras la empresa de origen, la instantánea no
cambia (conserva el nombre de la empresa de la que salió).

**Nunca guarda secretos.** Se sanean al capturar, no al cargar:

- Integraciones sin credenciales ni URL (Dialogflow, n8n, Typebot).
- Prompts sin API key, sin clave ni región de voz y con los contadores de
  tokens a cero.
- Webhooks sin flujo enlazado, sin URL y sin usuario.
- Mensajes rápidos sin usuario ni canal; los personales, como generales; las
  plantillas oficiales de Meta no se guardan.
- Chatbot sin el usuario ni la integración a los que transfería.

Tampoco guarda canales, usuarios, contactos, tickets, mensajes, campañas,
anuncios ni FlowBuilder.

## Cargar una instantánea

1. En la fila de la instantánea, **Cargar**.
2. El superadministrador elige la empresa; el admin carga en la suya.
3. Marca qué funciones cargar. Las que esa empresa ya cargó de esta misma
   instantánea salen marcadas y bloqueadas.

Cómo se comporta:

- **Aditiva.** Lo que la empresa ya tiene no se borra ni se sobrescribe,
  salvo los ajustes generales y de cumpleaños si se cargan (son una fila por
  empresa). Las mismas reglas de choque que el clonado: una cola con el mismo
  nombre se crea como «… (copia)»; una etiqueta, un motivo o un ajuste de
  campaña con el mismo nombre se reutiliza.
- **Por partes.** Se puede cargar hoy «Listas de archivos» y mañana
  «Chatbot»: el chatbot enlaza con las listas cargadas antes. Para eso cada
  carga guarda qué ids recibió cada fila. Si entretanto se borró algo de lo
  cargado, esa referencia queda en blanco en vez de fallar.
- **Sin duplicados.** Una función ya cargada de esta instantánea en esta
  empresa no se vuelve a cargar: se salta y se informa. Si todo lo pedido ya
  estaba cargado, se rechaza con `ERR_SNAPSHOT_ALREADY_APPLIED`.
- **Todo o nada.** Cada carga va en una transacción; si falla, los archivos
  que llegó a copiar se borran.
- Integraciones y prompts llegan sin credenciales: hay que ponerlas en la
  empresa. Los webhooks se asignan a su admin, con URL nueva.

## Eliminar

Borra la instantánea y su carpeta. Lo que ya se cargó en las empresas se
queda como está.

## Dónde vive

| Ruta | Qué es |
| --- | --- |
| `backend/src/services/ConfigPackageService/motor.ts` | El motor: captura (con el saneado) y aplicación de cada función. Lo comparten el clonado y el duplicado |
| `backend/src/services/ConfigSnapshotService/` | Crear, listar, cargar y borrar instantáneas |
| `backend/src/controllers/ConfigSnapshotController.ts` | Endpoints y permisos |
| `backend/src/models/ConfigSnapshot.ts` | La instantánea: paquete en JSONB, funciones, recuentos |
| `backend/src/models/ConfigSnapshotApplication.ts` | Qué se cargó de cada instantánea en cada empresa, con los ids |
| `backend/snapshots/snapshot{id}/` | Archivos de cada instantánea |
| `frontend/src/components/ConfigSnapshotsManager/` | Pestaña, selector de funciones y modales |

**La carpeta `backend/snapshots/` está fuera de `public/` a propósito** (no
se sirve por HTTP) y **tiene que persistir entre despliegues**, igual que
`public/`. No va al repositorio (`.gitignore`), y `nodemon.json` la ignora
para que copiar archivos no reinicie el servidor en desarrollo.

## API

| Método y ruta | Quién | Cuerpo / parámetros |
| --- | --- | --- |
| `GET /config-snapshots` | super, admin | — |
| `POST /config-snapshots` | super | `{ sourceCompanyId, name, description?, modules }` |
| `GET /config-snapshots/:id/applied` | super, admin | `?companyId=` (solo super) |
| `POST /config-snapshots/:id/apply` | super, admin | `{ modules, companyId? }` (`companyId` solo super) |
| `DELETE /config-snapshots/:id` | super | — |

Funciones (`modules`): `integraciones`, `archivos`, `etiquetas`, `colas`,
`chatbot`, `mensajesRapidos`, `prompts`, `ajustesEmpresa`, `cumpleanos`,
`campanas`, `motivos`, `webhooks`.

## Diagnóstico

| Error | Qué significa |
| --- | --- |
| `ERR_NO_PERMISSION` | No es superadministrador ni admin, o un admin pidió otra empresa |
| `ERR_SNAPSHOT_INVALID_NAME` | Nombre de menos de 2 caracteres |
| `ERR_SNAPSHOT_NAME_IN_USE` | Ya hay una instantánea con ese nombre |
| `ERR_SNAPSHOT_INVALID_MODULES` | Lista vacía, una función desconocida o que la instantánea no lleva |
| `ERR_SNAPSHOT_COMPANY_NOT_FOUND` | La empresa no existe |
| `ERR_SNAPSHOT_NOT_FOUND` | La instantánea no existe |
| `ERR_SNAPSHOT_ALREADY_APPLIED` | Todo lo pedido ya estaba cargado en esa empresa |
