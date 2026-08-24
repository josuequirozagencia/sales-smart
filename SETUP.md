# Entorno de desarrollo — ChatIA 4.7.9

Estado del setup local en Windows 10 Pro (i7-3770, 16 GB RAM).

## Estado actual

| Componente | Requerido | Estado |
|---|---|---|
| Git | — | ✅ 2.55.0 |
| nvm-windows | — | ✅ 1.2.2 |
| Node | 20 (frontend) / 21.6.2 (backend) | ✅ 20.19.4 activo |
| npm | — | ✅ 10.8.2 |
| PostgreSQL | 13 | ⬜ pendiente |
| Redis | 6 | ⬜ pendiente |
| Docker | opcional | ❌ **bloqueado** (ver abajo) |

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
