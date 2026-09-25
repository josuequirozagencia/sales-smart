# Meta Conversions API

Sales Smart envía a Meta los **leads, citas y ventas** del CRM para que las
campañas de Meta Ads se optimicen con resultados reales. No depende de
cookies ni de la web: los leads de este negocio llegan por chat.

Fase 1: eventos **Lead**, **Schedule** y **Purchase**, con atribución de
anuncios **Click-to-WhatsApp** (`ctwa_clid`) en WhatsApp Oficial.

## Qué se envía y cuándo

| Hecho en el CRM | Cuándo | Evento en Meta |
| --- | --- | --- |
| Lead | Un contacto **nuevo** escribe **primero** por WhatsApp, WhatsApp Oficial, Facebook, Instagram o GHL | `LeadSubmitted` si llegó por un anuncio de WhatsApp hace ≤ 7 días; si no, `Lead` |
| Cita | Se agenda una cita desde el CRM | `Schedule` |
| Venta | Se registra una venta | `Purchase`, con el **total** de la venta y la **moneda de la empresa** |

**No generan Lead** los contactos creados a mano, por API, por
importaciones o campañas, los grupos, los contactos que nacen porque el
asesor escribió primero, ni mensajes de más de 24 h (historial importado
al reconectar una sesión).

**No generan Schedule** las citas traídas de Google Calendar.

**Purchase** se manda al registrar la venta, con el total aunque solo esté
pagada en parte (`deposit`): es el valor del pedido.

### Las dos rutas

Meta tiene dos formas de recibir eventos de chat, y cada una exige cosas
distintas ([documentación de Meta](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging)):

- **Mensajería de negocios** (`action_source: business_messaging`). Es la
  única que **atribuye la conversión al anuncio**. Se usa si el contacto
  llegó por un anuncio Click-to-WhatsApp hace 7 días o menos. Lleva
  `whatsapp_business_account_id` y `ctwa_clid`, sin datos personales. Meta
  solo acepta aquí ciertos nombres: por eso el Lead viaja como
  `LeadSubmitted`, y la cita **nunca** va por esta ruta.
- **Estándar** (`action_source: chat`). Para todo lo demás, y siempre para
  `Schedule`. Meta identifica al contacto por su **teléfono** o **email**,
  cifrados con SHA-256 antes de salir. En Facebook e Instagram el número
  del contacto es un identificador de la plataforma, no un teléfono, así
  que solo cuenta el email. **Sin teléfono ni email el evento no se envía**
  (queda `skipped`).

## Configurar una empresa

En **Configuración → Integraciones** (administradores):

1. **ID del dataset (Pixel)**: Administrador de eventos → Orígenes de datos.
   Para atribuir anuncios de WhatsApp, el dataset tiene que estar
   **vinculado a la cuenta de WhatsApp Business** de la conexión de
   WhatsApp Oficial.
2. **Token de acceso**: de un **usuario del sistema** de Meta Business con
   permiso sobre ese dataset. Se guarda cifrado y no se vuelve a mostrar:
   la pantalla solo dice que hay uno y sus 4 últimos caracteres. Déjalo
   vacío al editar para conservarlo.
3. **Código de prueba** (opcional): el de «Probar eventos». Mientras esté
   puesto, los eventos aparecen en esa pestaña y **no cuentan para las
   campañas**. Quítalo al terminar.
4. Revisa que la **moneda de la empresa** sea la correcta: es la que va
   con cada venta. Una empresa creada sin elegirla tiene `BRL`.

Al guardar, el CRM lee el dataset con ese token para comprobar que el
token llega a él. Se guarda igual si Meta lo rechaza, con el error a la
vista.

### API

`GET /meta/config` y `PUT /meta/config`
(`{ datasetId, accessToken?, testEventCode?, isActive }`), solo
administrador. La empresa sale **siempre del token**: un `companyId` en el
cuerpo se ignora. La respuesta nunca incluye el token.

## Cómo funciona por dentro

```
Contacto / Cita / Venta  ──►  registro en ConversionEventLogs  ──►  metaConversionsQueue
       (disparador)              (eventId único por empresa)          (Bull, REDIS_URI)
                                                                            │
                                         MetaConversionsProvider  ◄─────────┘
                                         (lee datos y credenciales, envía)
```

- **Los disparadores solo encolan.** Nunca llaman a Meta, nunca lanzan y
  no se esperan: una venta, una cita o un contacto se crean exactamente
  igual aunque Meta esté caído o mal configurado. A ventas y citas se les
  cuelga un **hook de modelo** registrado al arrancar
  (`registrarListenersDeConversion`): no hay lógica de Meta dentro de
  `SaleServices` ni `AppointmentServices`.
- **Deduplicación propia.** Meta **no deduplica** los eventos de
  mensajería. Cada evento tiene un `eventId` determinístico
  (`lead_<contactId>`, `schedule_<appointmentId>`, `purchase_<saleId>`),
  único por empresa en `ConversionEventLogs`: el mismo hecho no se registra
  ni se envía dos veces aunque el disparador o el trabajo se repitan.
- **Motor sin Meta dentro.** `ConversionEvent` y `ConversionProvider`
  describen el hecho; `MetaConversionsProvider` es el único adaptador. Los
  datos se leen de la base en el momento de enviar, siempre filtrando por
  la empresa del evento.
- **Sin datos personales guardados.** Teléfono y email se leen al enviar y
  se cifran; `ConversionEventLogs` no los guarda.

### Atribución (`ctwa_clid`)

Meta incluye `referral` en el primer mensaje que un contacto envía tras
pulsar un anuncio. `api_oficial` lo reenvía por el socket que ya usa para
los mensajes (`receivedMessageWhatsAppOficial`), y el backend lo guarda en
`ContactAttributions` con el **WABA** de la conexión, **antes** de encolar
el Lead. Si el contacto vuelve a entrar por **otro** anuncio, se reemplaza
por el clic nuevo: el anterior deja de atribuir a los 7 días.

El backend solo acepta `receivedMessageWhatsAppOficial` y
`readMessageWhatsAppOficial` del socket que entra con `TOKEN_API_OFICIAL`.
Antes los aceptaba de cualquier socket, también del de un usuario con su
JWT, y así se podían inventar contactos y `ctwa_clid` (corregido en
`libs/socket.ts`; lo prueba `__tests__/libs/socket.spec.ts`).

> **Despliegue:** hace falta desplegar `api_oficial` además del backend.
> Hasta hacerlo, los Lead y Purchase de WhatsApp Oficial salen sin
> atribución, por la ruta estándar. Ver [Despliegue](#despliegue).

## Despliegue

La atribución necesita **dos servicios**: el backend (motor, tablas, cola,
pantalla) y `api_oficial` (reenvío del `referral`). Son independientes y
compatibles en **cualquier orden**:

- `api_oficial` nuevo con backend viejo: el backend ignora el campo
  `referral`. Nada cambia.
- Backend nuevo con `api_oficial` viejo: no llega `referral`; los eventos
  salen por la ruta estándar, sin atribución.

### `api_oficial`

**Qué cambia:** `src/resources/v1/webhook/webhook.service.ts` e
`src/@core/interfaces/IWebsocket.interface.ts` (reenvían seis campos del
`referral` por el socket), su test `webhook.service.spec.ts`, y
`package.json`, que fija `@types/amqplib` en **0.10.6**.

Ese fijado es obligatorio para poder construir: `api_oficial` no tiene
lockfile y `npm install` resuelve `^0.10.5` a 0.10.8, cuyos tipos cambiaron
lo que devuelve `connect` y rompen `RabbitMq.service.ts`
(`npm run build` falla con 3 errores). Pasa igual sin este cambio.

**Sin migraciones** (no toca Prisma) **ni variables nuevas.** Sí tienen que
cumplirse las que ya usa:

| Variable (`api_oficial`) | Debe ser |
| --- | --- |
| `URL_BACKEND_MULT100` | URL pública del backend, la del socket |
| `TOKEN_ADMIN` | **Igual** a `TOKEN_API_OFICIAL` del backend: es con lo que el backend reconoce el socket de `api_oficial`, y es la única vía por la que acepta sus mensajes. Si no coinciden, el socket se desconecta y los mensajes entrantes se pierden. Debe ser un valor largo y aleatorio, no uno de ejemplo como `adminpro` |
| `DATABASE_LINK`, `REDIS_URI`, `RABBITMQ_URL`, `PORT` | Sin cambios |

**Flujo manual (VPS con pm2, `api_oficial/README.md`):**

```bash
cd <ruta de api_oficial en el servidor>
git fetch origin
git checkout <commit o rama con el cambio>
npm install
npm run build
pm2 restart api_oficial
```

No uses `install/restart.sh` tal cual: hace `git pull` de la rama que
tenga el servidor y `pm2 restart all`, que reinicia **todos** los procesos
pm2 de la máquina, backend incluido si comparte servidor.

**Flujo Docker (`multiflow_deploy/deploy_fastalk.sh` y
`Dockerfile_apioficial`):** reconstruir la imagen `multiflow_api_oficial`
desde el código actualizado y recrear el contenedor. Ojo: el compose que
genera ese script solo pasa `PORT` y `TOKEN_API_OFICIAL`, pero el código lee
`TOKEN_ADMIN`, `URL_BACKEND_MULT100`, `DATABASE_LINK` y `REDIS_URI`: confirma
que el contenedor de producción los tiene.

**Vuelta atrás:** volver a desplegar la versión anterior de `api_oficial`.
El backend sigue funcionando, sin atribución.

### Backend y frontend

Desplegar la rama con el motor, ejecutar las **3 migraciones**
(`MetaConfigs`, `ContactAttributions`, `ConversionEventLogs`) y reiniciar el
backend (registra la cola `MetaConversions` y los hooks). Construir el
frontend (pantalla de Integraciones). Variables: ninguna obligatoria nueva;
`META_GRAPH_VERSION` es opcional (por defecto `v20.0`). El token de Meta se
cifra con `TOKEN_ENCRYPTION_KEY` o, si no existe, con `JWT_SECRET`: cambiar
ese valor deja ilegibles los tokens guardados y hay que volver a pegarlos.

### Antes de dar por buena la atribución en producción

1. La conexión de WhatsApp Oficial tiene su **WABA ID** rellenado
   (`waba_id`); sin él no hay atribución.
2. El dataset está **vinculado a esa cuenta de WhatsApp Business**.
3. La empresa tiene su configuración en **Configuración → Integraciones**,
   con estado **Conectado**, y un **código de prueba** puesto.
4. Desde un anuncio Click-to-WhatsApp real, escribir al número. Comprobar:
   fila en `ContactAttributions` con `ctwaClid` y `wabaId`; fila `lead_…` en
   `ConversionEventLogs` con `status = sent`, `route = business_messaging` y
   `sentEventName = LeadSubmitted`; y el evento en «Probar eventos» de Meta.
5. Quitar el código de prueba.

## Estados de un evento

| Estado | Qué significa |
| --- | --- |
| `pending` | Encolado, sin enviar todavía |
| `sent` | Meta lo aceptó (`route`: por cuál ruta; `sentEventName`: con qué nombre) |
| `skipped` | No se envía por regla; `lastError` dice por qué (sin teléfono ni email, origen borrado, moneda inválida…) |
| `blocked` | Las credenciales de la empresa están con error; se reencola al corregirlas si sigue dentro de los 7 días |
| `failed` | Meta rechazó el contenido, o se agotaron los reintentos |
| `expired` | Pasó de los 7 días que Meta admite sin llegar a enviarse |

## Diagnóstico

| Síntoma | Causa y solución |
| --- | --- |
| Estado **Error** con `(190) …` | Token caducado o revocado. Genera otro en el usuario del sistema y guárdalo |
| Estado **Error** con `(100/33) …` | El dataset no existe o el token no tiene acceso a él. Revisa el ID y los permisos del usuario del sistema |
| Estado **Error** con `(200) …` o `(10) …` | Faltan permisos del token sobre el dataset |
| Estado **Sin verificar** | Meta no respondió al guardar. Los eventos se intentan igual; vuelve a guardar más tarde para verificar |
| Eventos en `skipped` «sin teléfono ni email» | Contactos de Facebook o Instagram sin email, o de WhatsApp con identificador LID en vez de número |
| Eventos en `failed` con `(100) …` | Meta rechazó un campo. Revisa `lastError` en `ConversionEventLogs` |
| Ventas que no aparecen atribuidas al anuncio | Más de 7 días desde el clic, conexión sin WABA, dataset no vinculado a la cuenta de WhatsApp Business, o `api_oficial` sin desplegar |
| Eventos solo en «Probar eventos» | Hay un código de prueba puesto: quítalo |

Consulta útil:

```sql
select "eventType", status, route, "sentEventName", "lastError", "occurredAt"
  from "ConversionEventLogs"
 where "companyId" = <empresa>
 order by id desc limit 50;
```

Tras cambiar un error de credenciales, guardar la configuración reencola
los eventos bloqueados de los últimos 7 días.

## Limitaciones conocidas

- **Atribución solo en WhatsApp Oficial.** La mensajería de negocios exige
  una cuenta de WhatsApp Business (WABA). Las conexiones de Baileys no lo
  son, y GHL no entrega una señal equivalente a `ctwa_clid`: sus eventos
  van por la ruta estándar.
- **Atribución de 7 días.** Una venta más de 7 días después del clic ya no
  se atribuye al anuncio (va por la ruta estándar).
- **Schedule no se atribuye al anuncio**: Meta no lo admite en la ruta de
  mensajería.
- **Moneda por empresa**, no por venta: se usa `Company.currency`.
- **Fuera de esta fase**: `CompleteRegistration`, `Refund` (borrar una
  venta no envía nada), atribución para GHL y cualquier informe de
  atribución dentro del CRM.

## Dónde vive el código

| Ruta | Qué es |
| --- | --- |
| `backend/src/services/ConversionServices/types.ts` | Contratos `ConversionEvent` y `ConversionProvider`, `eventId` |
| `backend/src/services/ConversionServices/ConversionService.ts` | Encolado resiliente, disparador de Lead y hooks de venta y cita |
| `backend/src/services/ConversionServices/ProcessConversionJob.ts` | Trabajo de la cola: arma el evento, envía y gestiona estados y reintentos |
| `backend/src/services/ConversionServices/MetaConversionsProvider.ts` | Las dos rutas, cifrado y clasificación de errores |
| `backend/src/services/ConversionServices/ContactAttributionService.ts` | Guarda el `ctwa_clid` |
| `backend/src/services/MetaConfigService/MetaConfigService.ts` | Credenciales por empresa y verificación |
| `backend/src/queues.ts` | `metaConversionsQueue` |
| `frontend/src/components/MetaConversionsSettings/` | Pantalla de Configuración → Integraciones |
| `api_oficial/src/resources/v1/webhook/webhook.service.ts` | Reenvío del `referral` por el socket |
| `backend/src/__tests__/services/MetaConversions.spec.ts` | Tests |
