# Despliegue en Railway

Produccion de Sales Smart en [Railway](https://railway.com). Decisiones tomadas:

- Codigo: la rama con la correccion de seguridad (contiene dev-4.7.9 y Meta Conversions API).
- Datos: base vacia (migraciones y seeds).
- Dominios: los `*.up.railway.app` de Railway. Pasar a dominio propio obliga a recompilar
  el frontend y a cambiar el webhook en Meta.
- Se despliega con `railway up` desde una copia limpia del commit elegido, no desde GitHub:
  lo que sube es exactamente ese commit y un push no despliega nada por su cuenta.

## Servicios

| Servicio | Origen | Disco | Puerto |
|---|---|---|---|
| `Postgres` | plantilla de Railway | volumen de la plantilla | 5432 (red privada) |
| `Redis` | plantilla de Railway, con AOF | volumen de la plantilla (`/data`) | 6379 (red privada) |
| `backend` | `backend/Dockerfile.railway` | volumen en `/app/public` | 8080 |
| `frontend` | `frontend/Dockerfile.railway` | ninguno | 3000 |
| `api-oficial` | `api_oficial/Dockerfile.railway` | ninguno (medios temporales) | 3000 |

`api_transcricao` (transcripcion de audios) queda fuera por ahora.

### Por que cada pieza

- **Redis guarda las sesiones de WhatsApp** (`useMultiFileAuthState` usa `cacheLayer`) y las colas
  de Bull. Si Redis pierde datos hay que volver a escanear todos los QR. Por eso lleva volumen y
  `--appendonly yes`: con solo las instantaneas por defecto se pierden los ultimos minutos.
- **El backend escribe los archivos en disco** (`backend/public`, 19 sitios del codigo). Sin volumen
  se borran en cada despliegue. Un servicio con volumen no admite replicas y tiene unos segundos
  de corte al redesplegar: WhatsApp reconecta solo.
- **Una sola base Postgres**: el backend usa el esquema `public` y api_oficial el esquema
  `api_oficial` (`?schema=api_oficial` en `DATABASE_LINK`). Prisma crea el esquema.
- **Migraciones antes de arrancar**: `preDeployCommand` en cada `railway.json`. Si una migracion
  falla, el despliegue no sigue y queda en marcha el anterior.
- **Seeds solo en una base nueva**: `sequelize` no registra que seeds ya corrieron y
  `20241109070007-create-payment-settings` no comprueba si ya existen los datos: repetir
  `db:seed:all` no da error pero duplica 7 filas de `Settings`. Por eso el `preDeployCommand` del
  backend es `backend/deploy/predeploy.js`: migra siempre y ejecuta los seeds solo si falta
  `requireApproval` de la empresa 1 (lo crea el ultimo seed). Probado: base nueva (siembra),
  redespliegue y base existente (no siembra). Asi no hace falta `railway ssh`, que exige registrar
  una clave SSH en la cuenta. Si Postgres no responde, Sequelize reintenta la conexion (hasta 100
  veces, configuracion original) y el despliegue tarda en fallar; el anterior sigue en marcha.
- **Instalacion desde cero**: la empresa 1 la crean los seeds, despues de todas las migraciones.
  Las migraciones que tocan ajustes de la empresa 1 no insertan nada si aun no existe, y el seed
  `20260907130000-create-host-settings` los crea (probado: base vacia y base existente acaban
  con los mismos ajustes y las mismas 78 tablas).

## Archivos del repositorio

| Archivo | Para que |
|---|---|
| `backend/Dockerfile.railway` | Node 20.19.4 (el de los tests). Copia `.sequelizerc`, que las migraciones necesitan. Enlaza `/backend/public` a `/app/public` porque `MessageController` busca ahi los medios reenviados. |
| `frontend/Dockerfile.railway` | Compila con las `REACT_APP_*` como `ARG` y sirve `build/` con el `server.js` existente (Express 4 y dotenv se instalan aparte: no estan en `package.json`). El `Dockerfile_frontend` original pide `nginx.conf` y `env.sh`, que no existen. |
| `api_oficial/Dockerfile.railway` | Instala desde `package-lock.json`, genera Prisma y anade OpenSSL a la imagen slim. |
| `*/railway.json` | Builder Dockerfile, migraciones previas y reinicio si falla. |
| `api_oficial/prisma/migrations/0_init` | Migracion base generada desde `schema.prisma`. El instalador original usaba `prisma migrate dev`, que no sirve en produccion. |
| `api_oficial/package-lock.json` | Sin lockfile, `npm install` trae versiones nuevas y la compilacion ya se rompio una vez (`@types/amqplib`). |

`railway up` respeta `.gitignore`: por eso `.gitignore` deja pasar las migraciones de Prisma
(ignoraba `*.sql`) y `api_oficial/.gitignore` ya no ignora el lockfile. Tampoco sube `.env`,
`node_modules`, `dist` ni `backend/public`.

## Variables

Los valores `${{...}}` son referencias de Railway y se resuelven solos. Los marcados como
**secreto** se generan una vez y se cargan con `--stdin`: nunca van al repositorio ni a la linea
de comandos.

### backend

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `BACKEND_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` (sin puerto; `PROXY_PORT` no se define) |
| `FRONTEND_URL` | `https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}` |
| `DB_DIALECT` | `postgres` |
| `DB_HOST` / `DB_PORT` | `${{Postgres.PGHOST}}` / `${{Postgres.PGPORT}}` |
| `DB_USER` / `DB_PASS` / `DB_NAME` | `${{Postgres.PGUSER}}` / `${{Postgres.PGPASSWORD}}` / `${{Postgres.PGDATABASE}}` |
| `DB_POOL_MAX` / `DB_POOL_MIN` | `20` / `2` (el valor por defecto, 100, agota las conexiones de Postgres) |
| `REDIS_URI` / `REDIS_URI_ACK` | `${{Redis.REDIS_URL}}` las dos (sin `REDIS_URI_ACK` no arrancan las colas de Bull) |
| `REDIS_OPT_LIMITER_MAX` / `REDIS_OPT_LIMITER_DURATION` | `1` / `3000` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | **secreto** |
| `TOKEN_ENCRYPTION_KEY` | **secreto**. Cifra los tokens de Meta: si cambia, hay que volver a cargarlos todos. |
| `VERIFY_TOKEN` | **secreto** (verificacion del webhook de Facebook) |
| `USE_WHATSAPP_OFICIAL` | `true` |
| `URL_API_OFICIAL` | `https://${{api-oficial.RAILWAY_PUBLIC_DOMAIN}}` |
| `TOKEN_API_OFICIAL` | `${{api-oficial.TOKEN_ADMIN}}` (tienen que ser iguales) |
| `SOCKET_ADMIN` | `false` (el panel de socket.io usaria como clave el hash del admin) |
| `USER_LIMIT` / `CONNECTIONS_LIMIT` / `CLOSED_SEND_BY_ME` | `10000` / `100000` / `true` |
| `BUSINESS_TIMEZONE` | `America/Guayaquil` (horario de la rotacion; por defecto seria Sao Paulo) |

Opcionales, cuando se usen: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `META_GRAPH_VERSION`,
pasarelas de pago, correo, `TRANSCRIBE_URL`.

### api-oficial

| Variable | Valor |
|---|---|
| `PORT` | `3000` |
| `DATABASE_LINK` | `${{Postgres.DATABASE_URL}}?schema=api_oficial` |
| `REDIS_URI` | `${{Redis.REDIS_URL}}` |
| `TOKEN_ADMIN` | **secreto** |
| `URL_BACKEND_MULT100` | `https://${{backend.RAILWAY_PUBLIC_DOMAIN}}` |
| `RABBITMQ_ENABLED_GLOBAL` | `false` |

### frontend

| Variable | Valor |
|---|---|
| `REACT_APP_BACKEND_URL` | `https://${{backend.RAILWAY_PUBLIC_DOMAIN}}` |
| `REACT_APP_REQUIRE_BUSINESS_MANAGEMENT` | `TRUE` |
| `REACT_APP_FACEBOOK_APP_ID` / `REACT_APP_NUMBER_SUPPORT` | vacias hasta que se usen |

Las `REACT_APP_*` se fijan al compilar: cambiarlas exige redesplegar el frontend.

## Primer despliegue

Requisitos: CLI de Railway (`npm i -g @railway/cli`) y sesion iniciada por el titular de la
cuenta con `railway login`. Todo desde una copia limpia del commit a desplegar.

`deploy/railway/provisionar.sh <paso>` ejecuta cada paso por separado:

1. `proyecto`: `railway init --name sales-smart`.
2. `bases`: plantillas de Postgres y Redis.
3. `servicios`: servicios vacios `backend`, `api-oficial` y `frontend`.
4. `dominios`: dominios `*.up.railway.app` con su puerto (8080, 3000, 3000).
5. `volumen`: volumen del backend en `/app/public`.
6. `variables`: las de las tablas de arriba, sin desplegar todavia (`--skip-deploys`).
7. `secretos`: genera y carga los secretos por stdin; si ya existen no los cambia.
8. `redis-aof`: muestra la configuracion de Redis. Hay que anadir `--appendonly yes --appendfsync
   everysec` al comando de arranque de la plantilla (Redis 8.2), conservando la contrasena y el
   directorio del volumen. `railway environment edit --service-config` responde "No changes to
   apply"; lo que funciona es la mutacion GraphQL `serviceInstanceUpdate` con `startCommand` y
   despues `serviceInstanceRedeploy`. Comprobacion en el log: "Creating AOF base file".
9. `subir-backend`, `subir-api-oficial`, `subir-frontend`, en ese orden. Se niegan si la copia
   tiene cambios sin commit o algun `.env`.
10. `seeds`: no ejecuta nada, solo busca en el log del backend si el predeploy sembro la base.
11. Entrar en el frontend y **cambiar enseguida la contrasena del admin sembrado**
    (`admin@multi100.com.br`, clave publica del instalador original).

## Comprobaciones tras el despliegue

- `railway logs --service backend`: `Server started on port: 8080`, sin errores de Redis ni de base.
- `railway logs --service api-oficial`: `Servidor API Oficial iniciado` y el socket conectado al backend.
- Login en el frontend, conexion de WhatsApp por QR y mensaje de ida y vuelta.
- Redesplegar el backend y confirmar que la sesion de WhatsApp sigue conectada (Redis) y que las
  imagenes antiguas se siguen viendo (volumen).
- WhatsApp Oficial: webhook de Meta a `https://<dominio de api-oficial>/webhook/<companyId>/<conexaoId>`.

## Vuelta atras

- Codigo: `railway down --service <servicio>` retira el ultimo despliegue y deja el anterior, o
  subir de nuevo el commit anterior con `railway up`.
- Las migraciones de Sequelize no se deshacen solas: antes de desplegar una migracion
  destructiva, copia de seguridad de Postgres desde el panel de Railway.

## Costes

Plan Hobby: 5 US$/mes con 5 US$ de consumo incluidos; RAM a 10 US$/GB/mes, CPU a 20 US$/vCPU/mes,
volumenes a 0,15 US$/GB/mes. Estimacion para estos cinco servicios con poco trafico: 20-35 US$/mes.
Limite de volumen en Hobby: 5 GB por volumen; si los archivos del backend crecen mas, plan Pro.
