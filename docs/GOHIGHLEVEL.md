# Canal GoHighLevel

Conecta una *location* de GoHighLevel como un canal más de Sales Smart. No
sustituye a la conexión directa con Meta: una empresa puede tener las dos a
la vez, porque son dos filas distintas de `Whatsapp`.

## Qué hace y qué no

| Hace | No hace |
| --- | --- |
| Recibe mensajes entrantes por webhook y los convierte en tickets normales | Crear el webhook en GHL (no existe esa API) |
| Envía la respuesta del asesor por la API de GHL, así queda espejada allí | Leer plantillas de WhatsApp (GHL no las expone) |
| Refleja en GHL las etiquetas que se ponen o quitan en Sales Smart | Crear usuarios en GHL: los asesores son solo de Sales Smart |
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

En GHL, cualquiera de las dos vías sirve:

- **Settings → Integrations → Webhooks**, para el evento de mensaje
  entrante (*Conversation message*), o
- un **Workflow** con el disparador «Customer Replied» y una acción
  **Webhook** de tipo POST a esa URL.

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
| `backend/src/services/GhlServices/SyncGhlTags.ts` | Espejo de etiquetas |
| `backend/src/controllers/GhlWebhookController.ts` | Endpoint público de entrada |
| `backend/src/controllers/GhlController.ts` | Configuración, flujos y plantillas |
| `frontend/src/pages/GoHighLevel/` | Pantalla de administración |

La sincronización de etiquetas **nunca lanza**: si GHL está caído o el
token caducó, el asesor sigue etiquetando en Sales Smart y el fallo queda
en el log. Una etiqueta es una acción secundaria y no debe cortarle el
trabajo a nadie.

## Comprobación de punta a punta

Con la *location* de prueba, en este orden:

1. **Entrada.** Manda un WhatsApp al número conectado en GHL. Debe
   aparecer un ticket nuevo en la bandeja. Si no llega, mira el log del
   backend: `[GHL] webhook rechazado` significa secreto incorrecto en la
   URL; `[GHL] evento no procesado` dice el motivo exacto.
2. **Salida.** Responde desde Sales Smart. El mensaje tiene que llegar al
   WhatsApp del cliente **y** verse en la conversación dentro de GHL.
3. **Etiquetas.** Pon una etiqueta al ticket y compruébala en el contacto
   dentro de GHL. Quítala y comprueba que desaparece allí también.
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
