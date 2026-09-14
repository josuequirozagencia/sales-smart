# Clonar la configuración de una empresa

Copia la configuración de una empresa (**origen**) a otra que ya existe
(**destino**). Sirve para montar una empresa nueva a partir de otra que hace
de plantilla: mismas etiquetas, colas, chatbot, mensajes rápidos, prompts y
ajustes, sin rehacerlos a mano.

Solo lo puede lanzar un **superadministrador**.

## Cómo se usa

1. Crea la empresa destino por el flujo normal (pantalla de **Empresas** o
   registro).
2. En **Empresas** o en **Configuración → Empresas**, botón **Clonar configuración**.
3. Elige la empresa origen y la destino. El diálogo muestra qué se copia y
   qué no antes de confirmar.
4. Al terminar muestra un resumen: lo copiado, lo que ya existía en destino
   y lo que se omitió por regla, más los avisos.

Por API: `POST /companies/clone-config` con
`{ "sourceCompanyId": 3, "targetCompanyId": 7 }`, autenticado como
superadministrador. Devuelve el mismo resumen.

## Duplicar una empresa

En **Configuración → Empresas**, cada fila tiene un botón **Duplicar**. Crea
una empresa **nueva** a partir de esa, en un solo paso:

- **Hereda** de la original: plan, estado, vencimiento y recurrencia,
  generación de facturas, moneda, método de pago y horario de atención.
- **Recibe** toda la configuración que copia el clonado (tabla de abajo).
- **Se escribe en el modal**: nombre de la empresa nueva, email y contraseña
  de su admin, teléfono y documento (propuestos con los de la original).

Nace aprobada, sin clientes ni conexiones y con **un único usuario**: ese
admin. Tampoco se copia la tabla `Settings` de la original, que en la
empresa 1 guarda las claves de las pasarelas de pago y el whitelabel de toda
la plataforma.

Empresa, admin y configuración van en **una sola transacción**: si el
clonado falla, la empresa tampoco se crea. El duplicado queda anotado en
`CompanyConfigClones` como un clonado más, así que después no se puede
volver a clonar la original sobre la copia.

Por API: `POST /companies/:id/duplicate` con
`{ "name", "email", "password", "phone", "document" }`, autenticado como
superadministrador. Devuelve `{ empresa, clon }`, donde `clon` es el mismo
resumen del clonado.

## Qué se copia

| Qué | Cómo |
| --- | --- |
| Etiquetas y columnas del Kanban | Con el encadenado de columnas (`nextLaneId`, `rollbackLaneId`) traducido a las copias. |
| Colas | Con su árbol de opciones y sus productos. |
| Chatbot | El árbol completo. |
| Listas de ficheros | Con sus archivos físicos. |
| Mensajes rápidos | Con sus componentes y sus adjuntos físicos. |
| Prompts de IA | **Sin API key** (ver «Decisiones»). |
| Integraciones | **Sin credenciales y sin enlazar** (ver «Decisiones»). |
| Ajustes de la empresa (`CompaniesSettings`) | Se **actualiza** la fila que la destino ya tiene. |
| Ajustes de cumpleaños (`BirthdaySettings`) | Se actualiza la de la destino; si no tiene, se crea. |
| Ajustes de campaña | Las claves que la destino no tiene. |
| Motivos de finalización | Los que la destino no tiene con el mismo nombre. |
| Presets de webhook | Solo los propios de la empresa origen. Los de sistema (`companyId` nulo) ya son de todas. |
| Webhooks | Con URL nueva y sin flujo enlazado (ver «Decisiones»). |

## Qué NO se copia

- **Canales y sus credenciales**: WhatsApp, GoHighLevel, Google Calendar.
  La empresa destino conecta los suyos.
- **Usuarios** y su asignación a colas.
- **Datos operativos**: contactos, etiquetas de contactos, tickets,
  mensajes, campañas y sus envíos, ventas, citas, historial de tickets,
  carteras, y el estado de las conversaciones dentro del chatbot
  (`DialogChatBots`, que es de cada contacto, no una plantilla).
- **Anuncios**: tienen caducidad y muchos son automáticos.
- **FlowBuilder** y todo lo que cuelga de él (`FlowBuilders`,
  `FlowCampaigns`, `FlowDefaults`, `FlowImgs`, `FlowAudios`, `FlowDocs`).
  Queda para una **segunda fase**: el JSON de un flujo referencia ids de
  otros recursos, y copiarlo a otra empresa sin traducirlos dejaría flujos
  con apariencia de copiados pero rotos por dentro.
- La tabla heredada `Integrations`, que no tiene modelo activo.

## Cómo se comporta

- **Todo o nada.** Va en una sola transacción: si algo falla a mitad, la
  empresa destino queda como estaba. Los archivos copiados, que la base de
  datos no puede deshacer, se borran a mano en ese caso.
- **Aditivo.** Lo que la destino ya tenía no se borra ni se sobrescribe,
  salvo sus ajustes generales y de cumpleaños, que son una fila por empresa.
- **Una sola vez por par.** Clonar otra vez de la misma origen a la misma
  destino se **bloquea** con un error claro: como es aditivo, repetirlo
  duplicaría toda la configuración. Lo garantiza un índice único en la
  tabla de registro, así que vale también si dos personas lo lanzan a la
  vez. Sí se puede clonar a la misma destino desde **otra** origen.
- **Queda registrado** en `CompanyConfigClones`: quién, cuándo, de qué
  empresa a cuál y con qué resultado.

### Choques con lo que la destino ya tenía

| Caso | Qué pasa |
| --- | --- |
| Cola con el mismo nombre | La copia se llama «… (copia)». El nombre de una cola es único por empresa. |
| Cola con el mismo color | La copia recibe otro color. El color también es único por empresa. |
| Etiqueta con el mismo nombre y tipo | Se reutiliza la de la destino: dos columnas iguales romperían el tablero. |
| Motivo de finalización con el mismo nombre | Se deja el de la destino. |
| Ajuste de campaña con la misma clave | Se deja el de la destino. |

### Traducción de ids

Cada copia tiene un id nuevo, y todo lo que apuntaba a la fila vieja se
traduce a la nueva: la lista de ficheros de una cola, las opciones de una
cola y su árbol, los productos, el árbol del chatbot y sus colas y listas
de destino, los componentes de un mensaje rápido y la cola de un prompt.
Una referencia **sin equivalente en destino queda en blanco**: nunca se deja
apuntando a una fila de la empresa origen.

## Decisiones

- **Integraciones sin credenciales y desconectadas.** Guardan la cuenta de
  servicio de Dialogflow (`jsonContent`) y la URL del n8n o Typebot
  (`urlN8N`) de la empresa origen. Copiadas tal cual, las conversaciones de
  los clientes de la destino acabarían en sistemas de la origen. Se crean
  vacías y **las colas y el chatbot copiados no se enlazan a ellas**:
  enlazadas y sin credenciales, el bot fallaría con clientes reales. El
  admin de la destino completa las credenciales y las vuelve a enlazar.
  Como su nombre y `projectName` son únicos en toda la base, la copia lleva
  el sufijo «(empresa N)».
- **Prompts sin claves.** `apiKey`, `voiceKey` y `voiceRegion` son de la
  cuenta de IA de la origen: la destino gastaría con ella. Quedan vacíos, y
  los contadores de tokens vuelven a cero.
- **Webhooks con URL nueva y sin flujo.** `hash_id` es el tramo de la URL
  pública y se genera uno nuevo; copiarlo haría que dos empresas
  compartieran endpoint. Su `config` apunta a un flujo de FlowBuilder de la
  origen: se deja vacía para que el webhook de la destino no ejecute un
  flujo ajeno. El webhook se asigna al administrador de la destino, porque
  `user_id` no admite vacío.
- **Mensajes rápidos.** Pierden el usuario y el canal, que son de la origen.
  Los **personales pasan a generales**, porque sin dueño no los vería
  nadie. Las **plantillas oficiales de Meta no se copian**: son espejo de
  las aprobadas en la cuenta de WhatsApp de la origen.
- **Chatbot.** Pierde el usuario al que transfería una opción, que no existe
  en destino.
- **Archivos.** Se copian a la carpeta de la empresa destino. Las listas de
  ficheros viven en `public/company{N}/fileList/{idLista}/`, así que su
  carpeta cambia con el id nuevo; los adjuntos de mensajes rápidos, en
  `public/company{N}/quickMessage/`. Si un archivo ya no estaba en disco en
  la origen, la fila se copia igual y el resumen lo lista.

## Dónde vive el código

| Ruta | Qué es |
| --- | --- |
| `backend/src/services/CompanyService/CloneCompanyConfigService.ts` | Toda la lógica |
| `backend/src/controllers/CompanyController.ts` (`cloneConfig`) | Endpoint, con el guard de superadministrador |
| `backend/src/models/CompanyConfigClone.ts` | Registro de clonados |
| `backend/src/services/CompanyService/DuplicateCompanyService.ts` | Duplicar: crea la empresa y su admin y clona, en una transacción |
| `backend/src/controllers/CompanyController.ts` (`duplicate`) | Endpoint de duplicar, con el mismo guard |
| `frontend/src/components/CloneCompanyConfigModal/` | Diálogo de clonar, en Empresas y en Configuración → Empresas; `comun.js` lo comparte con el de duplicar |
| `frontend/src/components/DuplicateCompanyModal/` | Diálogo de duplicar, en Configuración → Empresas |

## Diagnóstico

| Error | Qué significa |
| --- | --- |
| `ERR_NO_PERMISSION` | Quien lo lanza no es superadministrador |
| `ERR_CLONE_SAME_COMPANY` | Origen y destino son la misma empresa |
| `ERR_CLONE_COMPANY_NOT_FOUND` | Alguna de las dos empresas no existe |
| `ERR_CLONE_ALREADY_DONE` | Ese par ya se clonó; repetirlo duplicaría todo |
| `ERR_CLONE_INVALID_COMPANIES` | Faltan los ids o no son números |
| `ERR_DUPLICATE_INVALID_NAME` | El nombre de la empresa nueva tiene menos de 2 caracteres |
| `ERR_DUPLICATE_INVALID_EMAIL` | El email del admin no es válido |
| `ERR_DUPLICATE_INVALID_PASSWORD` | La contraseña del admin tiene menos de 5 caracteres |
| `ERR_DUPLICATE_NAME_IN_USE` | Ya existe una empresa con ese nombre |
| `ERR_DUPLICATE_EMAIL_IN_USE` | Ese email ya lo usa otro usuario, de cualquier empresa |
