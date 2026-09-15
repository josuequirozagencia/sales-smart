# Agentes IA

Agentes de IA reutilizables por empresa (`AiAgent`), asignados a una conexión
(`AiAgentChannel`, como máximo un agente por conexión) y usados igual en
WhatsApp (Baileys), WhatsApp Oficial, Facebook e Instagram. GHL queda fuera.

Estado: fase 1 en la rama `feat/agentes-ia`. Hechos el modelo, la API de
administración, el motor, la atención por canal, el estado de la IA por
conversación, la transferencia y los seguimientos. Pendientes: sandbox, página
de administración y selector de agente en los nodos del Flow Builder.

## Dos estados independientes

| Estado | Dónde vive | Quién lo cambia |
|---|---|---|
| **Asignación** | `Tickets.userId`, `status`, `queueId` (sin cambios) | asesores, enrutador, cartera, transferencia |
| **IA activa / pausada** | `AiAgentTicketStates` (una fila por ticket) | asesor, mensaje humano, transferencia |

Activar o pausar la IA **nunca** cambia la asignación, el status ni la fila, y
no cierra ni abre conversaciones. La IA responde si su estado es activo, aunque
el ticket esté abierto con un asesor.

No se reutilizó ningún campo existente:
- `Tickets.isBot` se pone a `false` con cada mensaje entrante (`FindOrCreateTicketService`);
- `Tickets.useIntegration` dispara Typebot y flujos;
- `Contacts.disableBot` («Desactivar chatbot») es por contacto y apaga todos los bots. Sigue igual y la IA lo respeta.

### Reglas del estado (`services/AiAgentServices/EstadoIaTicket.ts`)

- Vale por **atención** (`TicketTraking`). Al cerrarse el ticket, la siguiente atención empieza con la IA activa.
- Sin fila para la atención actual: activa, salvo que una persona ya haya escrito en ella. Se usa la regla del enrutador: `fromMe`, no privado y sin U+200E.
- `version` sube con cada cambio.
- Motivos (`reason`): `transfer`, `human_message`, `manual`.
- Cada cambio se emite por socket: `company-{id}-aiAgentTicketState`.

### Prioridad humana

- **Mensaje desde Sales Smart** (`MessageController.store`, `forwardMessage`, `storeTemplate`, salvo notas internas):
  1. toma el bloqueo del ticket;
  2. pausa la IA;
  3. **después** envía.
- **Respuesta de la IA:** antes de cada bloque toma el mismo bloqueo, relee el estado y, si cambió la `version` o está pausada, descarta lo que falta. Ninguna respuesta de IA sale detrás del mensaje humano.
- **Mensajes escritos en el celular (Baileys) o en la bandeja de Meta (FB/IG):** pausan al llegar su eco. Se detectan cuando ya salieron, así que un bloque de IA en envío puede cruzarse por milisegundos.
- **Mensajes del propio agente:** los textos llevan U+200E. Los audios, que no tienen texto, se registran por `wid` para que su eco no pause.
- Los envíos por la API externa o programados sin la marca también cuentan como humanos, igual que para el enrutador.
- El bloqueo vive en memoria: producción corre `node dist/server.js`, un solo proceso, porque las sesiones de Baileys viven en memoria. `server-cluster.ts` no se usa. Si algún día hubiera varias réplicas, el bloqueo tendría que pasar a Redis.
- Si falla la lectura del estado, el mensaje humano se envía igual y la IA no responde.

### Transferencia a humano

La IA envía su último mensaje, pausa (`reason: transfer`) y asigna con la cadena que ya usa el CRM:

1. el ticket ya tiene asesor → se queda con él;
2. el contacto tiene cartera → su dueño (si es de la empresa);
3. el agente tiene fila de transferencia → esa fila, y el enrutador elige asesor;
4. nada de lo anterior → pendiente sin asesor.

Detección: tool calling `transferir_a_humano` y, si el modelo no admite herramientas, el texto literal «Ação: Transferir para o setor de atendimento».

### Activar desde la conversación

`PUT /ai-agents/tickets/:ticketId/state {enabled}` (cualquier usuario de la empresa, como enviar mensajes):
- Si el último mensaje es del cliente, la IA le responde con todo el historial: cliente, IA y asesor. Los mensajes del asesor le llegan marcados como tales.
- Si el último es del asesor, espera al siguiente mensaje del cliente.
- Con la conversación cerrada: `409 ERR_AI_AGENT_TICKET_CLOSED`.

`GET /ai-agents/tickets/:ticketId/state` devuelve `available`, `enabled`, `reason`, `agentName`, `disableBot` y `withinSchedule`.

Frontend: `components/AiAgentTicketControl`, una franja bajo la cabecera de la conversación («🤖 Agente IA: ACTIVO [Pausar Agente IA]» / «PAUSADO [Activar Agente IA]»). Solo aparece si la conexión tiene agente.

## Cuándo atiende el agente

Enganches, justo después de guardar el mensaje entrante:
- Baileys: antes del horario de la empresa, colas, flujos e integraciones;
- WhatsApp Oficial: antes de `verifyQueueOficial`;
- Facebook/Instagram: antes de flujos y colas.

Responde si se cumple todo lo siguiente:
- la conexión tiene un agente activo;
- el estado de la IA es activo;
- el agente está en su horario (hora del negocio, `BUSINESS_TIMEZONE`);
- el contacto no tiene «Desactivar chatbot»;
- no es grupo, ni importado, ni está en `closed`/`lgpd`/`nps`;
- no hay Typebot, flujo ni input de flujo en marcha.

Si responde, el listener termina ahí. Si no, todo sigue como antes.

La respuesta se genera en segundo plano, una por ticket. Si llegan varios mensajes seguidos, se contesta al último con todo el contexto.

El horario del **asesor** no afecta a la IA; el del **agente**, sí.

## Seguimientos

- Cada respuesta del agente programa el paso 1 (`AiAgentFollowUpJobs`). `when` es el tiempo sin respuesta del cliente.
- Un worker (cada minuto, `SeguimientosWorker`) vuelve a validar todo antes de enviar:
  - **se cancela** si la IA está pausada, el cliente respondió, el ticket está cerrado, el contacto tiene `disableBot` o el agente ya no está en la conexión;
  - **espera** si está fuera del horario del agente.
- Pausar la IA cancela los pendientes.
- Límite de Meta: WhatsApp Oficial e Instagram rechazan texto libre pasadas 24 h desde el último mensaje del cliente. Esos pasos quedan como `failed` con el motivo.

## Pruebas

- `src/__tests__/services/AiAgents.spec.ts`: validación, cifrado, motor contra un proveedor falso y aislamiento por empresa.
- `src/__tests__/services/AiAgentTicketState.spec.ts`:
  - independencia de la asignación;
  - reinicio por atención;
  - prioridad humana durante la generación y entre bloques;
  - las tres ramas de la transferencia;
  - activación por el asesor;
  - seguimientos.

## Migraciones

`20260916120000` a `20260916120300`, todas aditivas (tablas nuevas). En Railway las aplica `deploy/predeploy.js`. En local:

```bash
cd backend && npx sequelize db:migrate
```
