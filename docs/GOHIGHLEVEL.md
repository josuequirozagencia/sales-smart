# Canal GoHighLevel

Conecta una *location* de GoHighLevel como un canal más de Sales Smart. No
sustituye a la conexión directa con Meta: una empresa puede tener las dos a
la vez, porque son dos filas distintas de `Whatsapp`.

## Qué hace y qué no

| Hace | No hace |
| --- | --- |
| Recibe mensajes entrantes por webhook y los convierte en tickets normales | Crear el webhook en GHL (no existe esa API) |
| Envía la respuesta del asesor por la API de GHL, así queda espejada allí | Leer plantillas de WhatsApp (GHL no las expone) |
| Sincroniza etiquetas en los dos sentidos (ver «Etiquetas») | Crear usuarios en GHL: los asesores son solo de Sales Smart |
| Mete cada ticket en la cola de la conexión; el reparto entre asesores es el de siempre | Mover etapas del Kanban desde GHL |
| Inscribe contactos en flujos de GHL desde el panel de contacto | Tocar la integración directa con Meta |

## Puesta en marcha

### 1. Crear el token en GoHighLevel

En GHL: **Settings → Private Integrations → Create new integration**.

Permisos (*scopes*) imprescindibles:

- `conversations/message.write` — para que el asesor pueda responder.
- `contacts.write` — para etiquetas e inscripción en flujos.
- `contacts.readonly` y `workflows.readonly` — para resolver contactos y
  listar los flujos disponibles.

Copia el token: GHL solo lo muestra una vez.

### 2. Guardarlo en Sales Smart

Menú lateral → **GoHighLevel**. Pega el token y el *Location ID*, deja el
canal activo y guarda.

El token se guarda **cifrado** (AES-256-GCM, el mismo mecanismo que ya
protege los de Google Calendar) y no vuelve a mostrarse: la pantalla solo
dice si hay uno guardado.

### 3. Crear la conexión

**Conexiones → Nueva conexión → GoHighLevel**. Ponle nombre y asígnale las
colas que correspondan, igual que a cualquier otra conexión. No hay código
QR ni emparejamiento: la entrega la hace la API de GHL, así que la conexión
nace en `CONNECTED`.

### 4. Apuntar el webhook — paso manual

Este paso **no se puede automatizar**: GoHighLevel no tiene API para crear
suscripciones de webhook. Hay que hacerlo una vez a mano.

La pantalla de GoHighLevel muestra la URL exacta ya montada. Tiene esta
forma:

```
https://TU-DOMINIO/ghl/webhook/<companyId>/<secreto>
```

En GHL, crea un **Workflow** con el disparador «Customer Replied» y una
acción **Webhook** de tipo POST a esa URL. Las etiquetas necesitan otro
Workflow, con el disparador «Contact Tag»: está explicado en «Etiquetas».

> **¿Por qué no basta con el token?** El token solo sirve en un sentido:
> deja a Sales Smart llamar a GHL —responder, poner etiquetas, inscribir
> en flujos—, pero no hace que GHL avise de lo que pasa allí. Esos avisos
> son suscripciones a eventos, y con un Private Integration Token no se
> pueden crear: son exclusivas de las apps OAuth del Marketplace. Lo que
> sí puede avisar es un Workflow con la acción Webhook.

> **El último tramo de la URL es un secreto.** Es lo único que impide que
> un tercero meta mensajes falsos en la bandeja de la empresa. No lo
> publiques. No cambia al editar la configuración, precisamente para que la
> URL pegada en GHL siga funcionando.

### 5. Requisito de red

GHL tiene que poder alcanzar tu servidor desde internet, así que
`BACKEND_URL` debe apuntar a una dirección pública. En desarrollo local
hace falta un túnel (ngrok, Cloudflare Tunnel o similar) y volver a pegar
la URL resultante en GHL.

Ese mismo requisito aplica a los adjuntos salientes: a GHL se le pasa la
URL pública del archivo (`/public/companyN/...`) para que se lo descargue.

## Colas y reparto

Los tickets de GHL entran en la **cola de la conexión** —la que se elige
en **Conexiones**, editando la conexión GoHighLevel—, igual que los de
cualquier otro canal. No hay un selector aparte en la pantalla de
GoHighLevel: sería un segundo sitio para configurar lo mismo.

Si la conexión tiene varias colas se usa la primera según su orden. Los
demás canales, con varias colas, mandan un menú de chatbot para que el
cliente elija; aquí eso exigiría enviar mensajes por GHL, así que no se
hace.

La cola solo se pone si el ticket **aún no tiene una**. Así se arreglan
los tickets anteriores a este cambio y se respetan las transferencias: un
ticket que un asesor movió a otra cola se queda donde lo dejó. Pasarle la
cola directamente a `FindOrCreateTicketService` no vale: con un ticket
existente en otra cola, ese servicio lanza «Ticket em outro atendimento» y
el mensaje no entraría.

El reparto entre asesores no es propio de GHL: es el job de `queues.ts`
(`handleRandomUser`, cada dos minutos), el mismo para todos los canales.
Asigna un ticket pendiente de la cola a un asesor cuando se cumple todo
esto:

- la cola tiene el enrutador activo (`ativarRoteador`) y un tiempo de
  enrutador distinto de cero;
- el asesor pertenece a esa cola, tiene perfil `user`, está **conectado**,
  dentro de su **horario laboral** (en la zona horaria del negocio) y con
  **peso de distribución** mayor que cero.

Si nadie cumple las condiciones, el ticket se queda pendiente y sin dueño
hasta que alguien las cumpla. No es un fallo del canal.

**El saludo de espera.** Con el ajuste «saludo con una sola cola» activado,
el job manda un «buscando atendente» antes de asignar. Ese envío solo sabe
salir por Baileys, así que ahora **solo se intenta en tickets de WhatsApp**,
y si falla se anota en el log y el ticket se asigna igual. Antes, en un
ticket de GHL —o de WhatsApp con la sesión caída— el envío lanzaba
`ERR_WAPP_NOT_INITIALIZED`, el error escapaba sin capturar y el ticket no
se asignaba nunca, aunque hubiera asesores conectados.

## Etiquetas

### De Sales Smart hacia GHL

Poner o quitar una etiqueta en Sales Smart —en el ticket o en el
contacto— la pone o la quita en el contacto de GHL. Si el contacto aún no
existe en GHL, se crea.

### De GHL hacia Sales Smart

GHL no avisa de los cambios de etiquetas a un **Private Integration
Token**: el evento `ContactTagUpdate` solo lo pueden recibir las apps
OAuth del Marketplace, que lo activan en los ajustes de webhooks de la
app. La vía para este canal es un **Workflow**:

1. Disparador **Contact Tag**. Salta al poner y al quitar etiquetas; no
   le pongas filtro de «añadida» o «quitada» si quieres los dos sentidos.
2. Acción **Webhook** (POST) a la **misma URL** que los mensajes.
3. En *Custom Data*, estos dos datos, tal cual:

   | Clave | Valor |
   | --- | --- |
   | `ghl_event` | `tag_update` |
   | `contact_id` | `{{contact.id}}` |

`ghl_event` es lo que distingue el evento de un mensaje. `contact_id` se
pide explícito porque la ayuda de GHL no documenta que el webhook de un
Workflow lo mande por defecto. No hace falta ningún permiso más en el
token: el Workflow empuja los datos, no se leen por API.

**Qué se aplica.** GHL manda la lista **completa** de etiquetas del
contacto, nunca cuál cambió —pasa igual con `ContactTagUpdate`—. Lo que
cambió se saca comparándola con la lista del evento anterior, que se
guarda en `Contacts.ghlTagsSnapshot`. De ahí salen tres reglas:

- Las etiquetas que solo existen en Sales Smart **no se tocan nunca**: las
  puestas antes de conectar GHL y las que no llegaron a espejarse porque
  GHL estaba caído.
- El **primer** evento de cada contacto solo añade: sin lista anterior no
  hay forma de saber qué quitó GHL.
- Un evento **sin** el campo de etiquetas no borra nada; uno con la lista
  **vacía** sí quita las que GHL tenía antes.

**Decisiones.**

- Una etiqueta de GHL que no existe en Sales Smart **se ignora** y queda
  en el log; no se crea. El catálogo de etiquetas lo lleva cada empresa
  aquí, y crearlas dejaría que cualquier automatización de GHL lo llenara.
- Solo se tocan etiquetas de **contacto**. Las etapas del Kanban son de
  ticket y no se mueven desde GHL.
- Los nombres se comparan **exactos**: las etiquetas de GHL distinguen
  mayúsculas.
- No hay bucle: lo que llega de GHL se escribe sin pasar por el espejo
  hacia GHL, y el eco que GHL devuelve tras un cambio hecho aquí llega sin
  diferencias.

## Plantillas de WhatsApp

GHL no permite leerlas por API. En la pantalla de GoHighLevel se anotan a
mano las que **ya están aprobadas por Meta dentro de GHL**, con el mismo
nombre exacto.

Esa lista es un espejo: no valida nada. Si el nombre no coincide con una
plantilla real, el envío falla del lado de GHL.

## Cómo encaja por dentro

Un mensaje entrante de GHL recorre exactamente el mismo camino que uno de
Facebook o de WhatsApp oficial:

```
webhook → CreateOrUpdateContactService
        → FindOrCreateTicketService
        → FindOrCreateATicketTrakingService
        → CreateMessageService   ← aquí se emite el socket
```

Por eso el ticket aparece en la bandeja del asesor sin ningún cambio en la
interfaz: para el resto del sistema es un ticket normal.

Al responder, `MessageController` despacha por `ticket.channel` igual que
con los demás canales, y el mensaje solo se guarda en Sales Smart **si GHL
lo aceptó**; si no, el asesor ve el error en vez de un mensaje que el
cliente nunca recibió.

### Dónde vive el código

| Ruta | Qué es |
| --- | --- |
| `backend/src/services/GhlServices/GhlConfigService.ts` | Credenciales por empresa (tabla `Integrations`, `type = "ghl"`) |
| `backend/src/services/GhlServices/GhlApiClient.ts` | Cliente de la API v2 de GHL |
| `backend/src/services/GhlServices/ReceiveGhlMessageService.ts` | Entrada: evento → ticket |
| `backend/src/services/GhlServices/SendGhlMessage.ts` | Salida: respuesta del asesor → GHL |
| `backend/src/services/GhlServices/SyncGhlTags.ts` | Etiquetas de Sales Smart hacia GHL |
| `backend/src/services/GhlServices/ReceiveGhlTagEventService.ts` | Etiquetas de GHL hacia Sales Smart |
| `backend/src/controllers/GhlWebhookController.ts` | Endpoint público de entrada, para mensajes y etiquetas |
| `backend/src/controllers/GhlController.ts` | Configuración, flujos y plantillas |
| `frontend/src/pages/GoHighLevel/` | Pantalla de administración |

La sincronización de etiquetas **nunca lanza**: si GHL está caído o el
token caducó, el asesor sigue etiquetando en Sales Smart y el fallo queda
en el log. Una etiqueta es una acción secundaria y no debe cortarle el
trabajo a nadie. Vale igual en el sentido contrario: un evento de
etiquetas que no se puede aplicar se anota en el log y GHL recibe su 200.

## Comprobación de punta a punta

Con la *location* de prueba, en este orden:

1. **Entrada.** Manda un WhatsApp al número conectado en GHL. Debe
   aparecer un ticket nuevo en la bandeja, ya con la cola de la conexión, y
   en menos de dos minutos asignado a un asesor de esa cola que esté
   conectado y en horario. Si no llega, mira el log del
   backend: `[GHL] webhook rechazado` significa secreto incorrecto en la
   URL; `[GHL] evento no procesado` dice el motivo exacto.
2. **Salida.** Responde desde Sales Smart. El mensaje tiene que llegar al
   WhatsApp del cliente **y** verse en la conversación dentro de GHL.
3. **Etiquetas.** Pon una etiqueta al ticket y compruébala en el contacto
   dentro de GHL. Quítala y comprueba que desaparece allí también. Después,
   al revés: pon una etiqueta al contacto **desde GHL** —tiene que existir
   con el mismo nombre en Sales Smart— y comprueba que aparece aquí; quítala
   en GHL y comprueba que desaparece.
4. **Flujos.** En el panel de contacto, botón «Flujo GHL», elige un flujo
   de prueba y confirma que se dispara en GHL.

## Diagnóstico

| Error | Qué significa |
| --- | --- |
| `ERR_GHL_NO_CONFIGURADO` | No hay fila de integración o el canal está apagado |
| `ERR_GHL_CREDENCIALES_INCOMPLETAS` | Falta el token o el `locationId`; también sale si cambió `TOKEN_ENCRYPTION_KEY`, que deja ilegible lo ya cifrado |
| `ERR_GHL_CONTACTO_NO_RESUELTO` | No se pudo crear ni encontrar el contacto en GHL — revisa el scope `contacts.write` |
| `ERR_GHL_SIN_BACKEND_URL` | Se intentó enviar un adjunto sin `BACKEND_URL` configurada |
| `GHL 401` en el log | Token inválido o caducado, o falta la cabecera `Version` (la pone el cliente, no debería pasar) |
| Ticket de GHL sin cola | La conexión GoHighLevel no tiene ninguna cola asignada en Conexiones |
| Ticket de GHL con cola pero sin asesor | Nadie de esa cola cumple las condiciones del reparto: conectado, en horario y con peso mayor que cero; o la cola no tiene el enrutador activo |
| `evento de etiquetas sin contact_id` | Falta el dato personalizado `contact_id = {{contact.id}}` en la acción Webhook del Workflow |
| `evento de etiquetas sin campo tags` | El webhook no trae la lista de etiquetas; no se toca nada a propósito |
| `contacto … no fichado en Sales Smart` | GHL etiquetó a alguien que nunca escribió por este canal; un evento de etiquetas no crea contactos |
| `etiquetas de GHL sin equivalente … ignoradas` | Esa etiqueta no existe como etiqueta de contacto en Sales Smart; créala aquí con el mismo nombre exacto |
