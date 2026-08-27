# Entorno de desarrollo — ChatIA 4.7.9

Estado del setup local en Windows 10 Pro (i7-3770, 16 GB RAM).

## Estado actual

| Componente | Requerido | Estado |
|---|---|---|
| Git | — | ✅ 2.55.0 |
| nvm-windows | — | ✅ 1.2.2 |
| Node | 20 (frontend) / 21.6.2 (backend) | ✅ 20.19.4 activo |
| npm | — | ✅ 10.8.2 |
| PostgreSQL | 13 | ✅ 13.23, servicio `postgresql-x64-13` |
| Redis | 6 | ✅ Memurai 4.1.2 (protocolo Redis 7.2.5) |
| Docker | opcional | ❌ **bloqueado** (ver abajo) |

### Verificado funcionando

- `npm install` backend: 1380 paquetes, exit 0
- `npm run build` (tsc 4.9.5): **exit 0, cero errores de tipos**
- `npm install` frontend: 3029 paquetes, exit 0
- **317/317 migraciones aplicadas**, 64 tablas, sin errores
- 5 seeds aplicados
- Backend levantando en `http://localhost:8080`
- `POST /auth/login` responde **HTTP 200** con JWT

### Credenciales locales

- **App:** `admin@multi100.com.br` / `adminpro` (del seed por defecto)
- **PostgreSQL:** usuario `chatia`, base `chatia`. La contraseña está en
  `backend/.env` (gitignoreado). Se generó aleatoria de 24 caracteres.

## Servicios locales

| Servicio | Puerto | Notas |
|---|---|---|
| Backend | 8080 | `node dist/server.js` |
| Frontend | 3000 | `npm start` |
| PostgreSQL 13 | 5432 | servicio automático |
| Memurai (Redis) | 6379 | solo `127.0.0.1` |

### Arrancar el frontend

```bash
cd frontend && CI=true npm start
```

Sirve en **~20 segundos**. Requiere `CI=true`: sin esa variable, react-scripts
registra un handler que **mata el dev server en cuanto `stdin` se cierra**, así
que muere al instante si se lanza en segundo plano.

Ya **no** hace falta `--openssl-legacy-provider`: eso era un parche para
webpack 4 en Node moderno.

### Herramienta de build

El frontend usa **CRA 5.0.1 con webpack 5**, configurado mediante
**CRACO** (`craco.config.js`). Antes usaba `react-app-rewired` con
`config-overrides.js`, que se quedó en la versión 2.2.1, hecha para CRA 4.

Dos cosas que conviene saber al tocar `craco.config.js`:

- **El ajuste de `splitChunks` y del minimizador es solo de producción.** CRA
  desactiva el code splitting en desarrollo a propósito. Aplicarlo también en
  dev hacía que el servidor abriera el puerto y **no sirviera nunca la página**.
- **El analizador de bundle está bajo demanda:** `ANALYZE=true npm start` genera
  `bundle-report.html`. Antes corría en cada compilación produciendo un
  `stats.json` de 177 MB que ni siquiera se usaba.

```bash
cd frontend && npm run build
```

Unos **3 minutos**. Genera 12 MB con CSS minificado, 73 archivos gzip y los
`console.*` eliminados.

### ⚠️ Entrar siempre por `localhost`, nunca por `127.0.0.1`

El backend permite un único origen CORS:

```js
const allowedOrigins = [process.env.FRONTEND_URL];
```

Con `FRONTEND_URL=http://localhost:3000`, abrir la app en `http://127.0.0.1:3000`
hace que **todas** las llamadas al API fallen por CORS — para el navegador
`127.0.0.1` y `localhost` son orígenes distintos. Los síntomas son un login que
parece cargar pero no responde y errores `net::ERR_FAILED` en consola.

**Usar siempre `http://localhost:3000`.**

## Pruebas automatizadas

Jest ya venía configurado en el backend pero no había ninguna prueba escrita.
Ahora hay una capa fina sobre lo que más duele si se rompe.

Corren contra una base separada, `chatia_test`, definida en `backend/.env.test`
(gitignoreado). `bootstrap.ts` la carga solo cuando `NODE_ENV=test`, así que
**nunca tocan tus datos de desarrollo**.

### Preparación (una sola vez)

```bash
cd backend && npm run test:setup
```

Aplica migraciones y seeds sobre `chatia_test`. No hace falta repetirlo salvo
que añadas migraciones nuevas.

### Ciclo normal

```bash
cd backend && npm test
```

Unos 13 segundos. Los scripts disponibles:

| Script | Para qué |
|---|---|
| `npm test` | la suite completa |
| `npm run test:watch` | reejecuta al guardar |
| `npm run test:coverage` | con cobertura (mucho más lento) |
| `npm run typecheck` | tipos, incluidas las pruebas |
| `npm run test:setup` | preparar la base de pruebas |
| `npm run test:reset` | recrear el esquema desde cero |

### Decisiones que conviene conocer

- **`pretest`/`posttest` eliminados.** Corrían las 317 migraciones antes de cada
  ejecución y las revertían después: varios minutos por cada `npm test`. Ahora
  la base se prepara una vez con `test:setup`.
- **`isolatedModules: true`** en `jest.config.js`. Sin esto `ts-jest` verifica
  tipos en cada ejecución y la suite pasaba de 13 s a más de 40 s, con solo
  0,2 s de pruebas reales. La verificación sigue cubierta por `npm run build`
  y `npm run typecheck`.
- **Cobertura desactivada por defecto.** Instrumentar `src/services` entero
  triplicaba el tiempo. Está en `npm run test:coverage`.
- **`--runInBand`.** Las pruebas comparten base; en paralelo se pisarían.
- **`src/__tests__` excluido de `tsconfig.json`**, para que `npm run build` no
  las compile dentro de `dist/`. Los tipos se verifican con
  `tsconfig.test.json`, que sí las incluye.

### ⚠️ `.rejects.toThrow()` no funciona en este proyecto

`AppError` (`src/errors/AppError.ts`) es una clase simple que **no extiende
`Error`**, y el matcher `toThrow()` de Jest exige una instancia de `Error`. Una
prueba que lo use falla con *"Received function did not throw"* aunque el
servicio haya rechazado correctamente. Usar en su lugar:

```js
await expect(algunServicio(...)).rejects.toMatchObject({ message: "ERR_..." });
```

## Dependencia vendorizada: `xlsx`

SheetJS dejó de publicar `xlsx` en npm. La última versión que queda allí es la
0.18.5, con dos fallos ya corregidos aguas arriba (contaminación de prototipo y
ReDoS), ambos disparables al **parsear** una hoja de cálculo.

Eso importa aquí porque el backend parsea archivos que suben los usuarios en
`ImportContacts.ts` e `ImportContactsService.ts`. En un proceso Node
multi-tenant, ese fallo es más grave que en el navegador.

La copia oficial 0.20.3 vive en `backend/vendor/` y `frontend/vendor/`, y los
`package.json` la referencian con `file:vendor/xlsx-0.20.3.tgz`.

**Por qué copia local y no la URL del CDN:** el despliegue corre
`docker compose build` en VPS de clientes, con el contexto limitado a `./backend`
y `./frontend`. Apuntar la dependencia a `cdn.sheetjs.com` haría que una
instalación fallara —con un error poco claro— si ese host no responde. La propia
documentación de SheetJS recomienda vendorizar por este motivo.

Para actualizar: descargar el `.tgz` nuevo del CDN, dejarlo en `vendor/`,
actualizar la referencia en `package.json` y borrar el anterior. Hay un
`vendor/README.md` en cada proyecto con el detalle.

## Diferencias con producción

Ninguna es bloqueante, pero conviene tenerlas presentes:

- **Collation:** la base local quedó en `Spanish_Ecuador.1252` (locale de Windows).
  Producción corre en Linux con otra collation, así que el orden de `ORDER BY`
  sobre texto puede diferir.
- **Redis:** Memurai habla protocolo 7.2.5; producción usa Redis 6.
- **Node:** local unifica en 20.19.4; producción usa 21.6.2 en backend.

## Endurecimiento pendiente (opcional)

PostgreSQL quedó con `listen_addresses = '*'` (escucha en todas las interfaces).
El riesgo real es bajo porque `pg_hba.conf` solo acepta `127.0.0.1` y `::1`, y no
se creó regla de firewall para el 5432. Para defensa en profundidad se puede poner
`listen_addresses = 'localhost'` en `postgresql.conf` y reiniciar el servicio.

## PostgreSQL 17 huérfano

La máquina tenía un `C:\Program Files\PostgreSQL\17` previo **sin servicio
registrado ni escuchando**. No se tocó. Si hacía falta para otro proyecto, hay que
revisarlo aparte.

## ⚠️ Docker está bloqueado por hardware

El CPU **Intel i7-3770** reporta `VirtualizationFirmwareEnabled: False` — VT-x está
desactivado en la BIOS. Docker Desktop requiere WSL2, que requiere virtualización.

Estado de las features de Windows:

- `Microsoft-Windows-Subsystem-Linux` → Disabled
- `VirtualMachinePlatform` → Enabled
- `Microsoft-Hyper-V` → Disabled

**Para desbloquear Docker:** entrar a la BIOS/UEFI al arrancar y habilitar
*Intel Virtualization Technology (VT-x)*. Luego habilitar la feature WSL e instalar
Docker Desktop.

**Mientras tanto** se puede desarrollar sin Docker con Postgres y Redis nativos
(ver más abajo).

## Versiones de Node

Los Dockerfiles de producción usan versiones distintas:

- `multiflow_deploy/Dockerfile_backend` → `node:21.6.2`
- `multiflow_deploy/Dockerfile_frontend` → `node:20`

En local usamos **20.19.4** para ambos (un solo runtime). Está fijado en los
`.nvmrc` de cada módulo.

El frontend **no compila con Node 22+**: usa `react-scripts` 3.4.3 (webpack 4, de
2020) y ya depende de `--openssl-legacy-provider` en su script de build.

### Cambiar de versión

```bash
nvm use 20.19.4
```

## Servicios: opción sin Docker

Equivalentes nativos de lo que producción corre en contenedores:

```bash
winget install --id PostgreSQL.PostgreSQL.13 --exact
```

```bash
winget install --id Memurai.MemuraiDeveloper --exact
```

Memurai es un servidor compatible con Redis para Windows; su edición Developer es
gratuita. El backend solo habla protocolo Redis (Bull para colas, caché y adaptador
de Socket.io), así que funciona como reemplazo.

## Servicios: opción con Docker (requiere VT-x)

Una vez habilitada la virtualización, `deploy/installer/instalador-chatia-v4.5.1.sh`
contiene el `docker-compose.yml` de referencia que usa producción: `postgres:13`,
`redis:6-alpine`, backend y frontend.

## Instalar dependencias

Ambos módulos requieren `--legacy-peer-deps` (así lo hacen los Dockerfiles):

```bash
cd backend && npm install --legacy-peer-deps
```

```bash
cd frontend && npm install --legacy-peer-deps
```

## Notas del repositorio

- `.gitattributes` fuerza **LF** en `*.sh`, `Dockerfile*` y `*.yml`. Sin esto Git los
  convierte a CRLF en Windows y fallan al desplegar en Linux (`bad interpreter`).
- Los `package-lock.json` **sí** se versionan (los `.gitignore` originales los
  excluían). Baileys está pineado a un commit de GitHub y el árbol requiere
  `--legacy-peer-deps`: sin lockfile no hay build reproducible.
- `main` conserva el código original intacto. El trabajo va en `dev-4.7.9`.
