#!/usr/bin/env bash
# Crea y despliega Sales Smart en Railway por pasos. Ver docs/DESPLIEGUE_RAILWAY.md.
# Uso, desde la raiz de una copia limpia del commit a desplegar y con `railway login` hecho:
#   bash deploy/railway/provisionar.sh <paso>
# Pasos, en orden: proyecto bases servicios dominios volumen variables secretos redis-aof
#                  subir-backend subir-api-oficial subir-frontend seeds estado
# Los secretos se generan aqui y viajan por stdin: no aparecen en pantalla, en el historial ni en Git.
set -euo pipefail

PROYECTO="sales-smart"
cd "$(git rev-parse --show-toplevel)"

secreto() { node -e 'process.stdout.write(require("crypto").randomBytes(48).toString("base64url"))'; }
# Carga un secreto solo si la variable aun no existe: repetir el paso no cambia claves ya en uso
# (TOKEN_ENCRYPTION_KEY cifra los tokens de Meta guardados).
cargar_secreto() {
  local servicio="$1" nombre="$2"
  if railway variable list --service "$servicio" --kv 2>/dev/null | grep -q "^${nombre}="; then
    echo "  $servicio.$nombre ya existe: no se toca"
  else
    secreto | railway variable set --service "$servicio" --skip-deploys --stdin "$nombre" > /dev/null
    echo "  $servicio.$nombre generado"
  fi
}
limpio() {
  [ -z "$(git status --porcelain)" ] || { echo "PARA: hay cambios sin commit; se subiria algo distinto del commit $(git rev-parse --short HEAD)"; exit 1; }
  [ ! -e backend/.env ] && [ ! -e api_oficial/.env ] && [ ! -e frontend/.env ] || { echo "PARA: hay un .env en la copia"; exit 1; }
}

case "${1:-}" in
  proyecto)
    railway init --name "$PROYECTO"
    ;;
  bases)
    railway add --database postgres
    railway add --database redis
    ;;
  servicios)
    railway add --service backend
    railway add --service api-oficial
    railway add --service frontend
    ;;
  dominios)
    railway domain --service backend --port 8080
    railway domain --service api-oficial --port 3000
    railway domain --service frontend --port 3000
    ;;
  volumen)
    railway service link backend
    railway volume add --mount-path /app/public
    ;;
  variables)
    railway variable set --service backend --skip-deploys \
      'NODE_ENV=production' 'PORT=8080' \
      'BACKEND_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}' \
      'FRONTEND_URL=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}' \
      'DB_DIALECT=postgres' 'DB_HOST=${{Postgres.PGHOST}}' 'DB_PORT=${{Postgres.PGPORT}}' \
      'DB_USER=${{Postgres.PGUSER}}' 'DB_PASS=${{Postgres.PGPASSWORD}}' 'DB_NAME=${{Postgres.PGDATABASE}}' \
      'DB_POOL_MAX=20' 'DB_POOL_MIN=2' \
      'REDIS_URI=${{Redis.REDIS_URL}}' 'REDIS_URI_ACK=${{Redis.REDIS_URL}}' \
      'REDIS_OPT_LIMITER_MAX=1' 'REDIS_OPT_LIMITER_DURATION=3000' \
      'USE_WHATSAPP_OFICIAL=true' 'URL_API_OFICIAL=https://${{api-oficial.RAILWAY_PUBLIC_DOMAIN}}' \
      'TOKEN_API_OFICIAL=${{api-oficial.TOKEN_ADMIN}}' \
      'SOCKET_ADMIN=false' 'USER_LIMIT=10000' 'CONNECTIONS_LIMIT=100000' 'CLOSED_SEND_BY_ME=true' \
      'BUSINESS_TIMEZONE=America/Guayaquil' > /dev/null
    echo "  backend: variables cargadas"
    railway variable set --service api-oficial --skip-deploys \
      'PORT=3000' 'DATABASE_LINK=${{Postgres.DATABASE_URL}}?schema=api_oficial' \
      'REDIS_URI=${{Redis.REDIS_URL}}' 'URL_BACKEND_MULT100=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}' \
      'RABBITMQ_ENABLED_GLOBAL=false' > /dev/null
    echo "  api-oficial: variables cargadas"
    railway variable set --service frontend --skip-deploys \
      'REACT_APP_BACKEND_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}' \
      'REACT_APP_REQUIRE_BUSINESS_MANAGEMENT=TRUE' > /dev/null
    echo "  frontend: variables cargadas"
    ;;
  secretos)
    cargar_secreto api-oficial TOKEN_ADMIN
    cargar_secreto backend JWT_SECRET
    cargar_secreto backend JWT_REFRESH_SECRET
    cargar_secreto backend TOKEN_ENCRYPTION_KEY
    cargar_secreto backend VERIFY_TOKEN
    ;;
  redis-aof)
    # El comando de arranque de la plantilla se revisa a mano antes de cambiarlo (lleva la
    # contrasena y el directorio del volumen); este paso solo lo muestra.
    railway service link Redis
    railway status --json
    ;;
  subir-backend)
    limpio; railway up ./backend --path-as-root --service backend --ci -m "backend $(git rev-parse --short HEAD)"
    ;;
  subir-api-oficial)
    limpio; railway up ./api_oficial --path-as-root --service api-oficial --ci -m "api-oficial $(git rev-parse --short HEAD)"
    ;;
  subir-frontend)
    limpio; railway up ./frontend --path-as-root --service frontend --ci -m "frontend $(git rev-parse --short HEAD)"
    ;;
  seeds)
    # Solo la primera vez: el seed de payment-settings no comprueba si ya existe.
    railway ssh --service backend npx sequelize db:seed:all
    ;;
  estado)
    for s in Postgres Redis backend api-oficial frontend; do railway service status --service "$s"; done
    for s in backend api-oficial frontend; do railway domain list --service "$s"; done
    ;;
  *)
    sed -n '2,7p' "$0"; exit 2
    ;;
esac
