#!/bin/bash

# ============================================
# ChatIA v4.4 - Atualizador VPS
# Versao: 1.0 (2026)
# Compatível com o instalador de produção
# ============================================

set -uo pipefail

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Defaults
INSTALL_DIR="${INSTALL_DIR:-/opt/chatia}"
BACKUP_DIR="$INSTALL_DIR/backups"
LOCK_FILE="/tmp/chatia-update.lock"
COMPOSE_FILE="docker-compose.yml"

clear
echo -e "${CYAN}==============================================${NC}"
echo -e "${CYAN}   ChatIA v4.4 - Atualizador VPS${NC}"
echo -e "${CYAN}   Update Seguro com Backup Local${NC}"
echo -e "${CYAN}==============================================${NC}"
echo ""

# ============================================
# FUNÇÕES AUXILIARES
# ============================================
command_exists() { command -v "$1" >/dev/null 2>&1; }

ask_with_default() {
    local prompt=$1
    local default=$2
    local value
    read -p "$(echo -e ${CYAN}$prompt ${NC}[${GREEN}$default${NC}]: )" value
    echo "${value:-$default}"
}

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
ok() { echo -e "${GREEN}  ✓${NC} $1"; }
warn() { echo -e "${YELLOW}  ⚠${NC}  $1"; }
fail() { echo -e "${RED}  ✗${NC} $1"; }

cleanup() {
    rm -f "$LOCK_FILE"
}
trap cleanup EXIT

acquire_lock() {
    if [ -f "$LOCK_FILE" ]; then
        fail "Ja existe um update em andamento: $LOCK_FILE"
        fail "Se travou, remova manualmente: rm -f $LOCK_FILE"
        exit 1
    fi
    echo $$ > "$LOCK_FILE"
}

detect_docker_compose() {
    if docker compose version >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker compose"
    elif command_exists docker-compose; then
        DOCKER_COMPOSE="docker-compose"
    else
        DOCKER_COMPOSE=""
    fi
}

dc() {
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" "$@"
}

load_env() {
    # Precedencia: usa .env da raiz; se nao existir, usa backend/.env
    if [ -f "$INSTALL_DIR/.env" ]; then
        set -a
        . "$INSTALL_DIR/.env"
        set +a
        return 0
    fi

    if [ -f "$INSTALL_DIR/backend/.env" ]; then
        set -a
        . "$INSTALL_DIR/backend/.env"
        set +a
        return 0
    fi

    fail "Nenhum arquivo .env encontrado em $INSTALL_DIR ou $INSTALL_DIR/backend"
    exit 1
}

backup_file_if_exists() {
    local src="$1"
    local dst="$2"
    if [ -f "$src" ]; then
        cp "$src" "$dst"
        ok "Backup criado: $(basename "$dst")"
    fi
}

get_relevant_git_changes() {
    git status --porcelain | grep -vE \
'(^\?\? docker-compose\.yml$|^\?\? \.credentials$|^\?\? \.env$|^\?\? backups/$|^\?\? backend/uploads/$|^\?\? backend/public/$|^\?\? update\.sh$|^\?\? .*\.bak$|^\?\? .*\.sql\.gz$|^\?\? .*\.tar\.gz$|^ M docker-compose\.yml$|^ M \.env$|^ M backend/\.env$|^ M backend/Dockerfile$|^ M frontend/Dockerfile$|^ M frontend/nginx\.conf$|^\?\? backend/database\.config\.js$|^\?\? backend/seed_admin\.js$|^\?\? backend/seed_settings\.js$|^\?\? fix-backend-errors\.sh$)' || true
}

restore_origin_url() {
    local clean_url="$1"
    if [ -n "$clean_url" ]; then
        git remote set-url origin "$clean_url" >/dev/null 2>&1 || true
    fi
}

# ============================================
# 1. VALIDAÇÕES
# ============================================
echo -e "${BLUE}[1/7] Validando ambiente...${NC}"

if [ "$EUID" -ne 0 ]; then
    fail "Execute como root"
    fail "Use: sudo $0"
    exit 1
fi

if [ ! -d "$INSTALL_DIR" ]; then
    fail "Diretorio de instalacao nao encontrado: $INSTALL_DIR"
    exit 1
fi

if [ ! -d "$INSTALL_DIR/.git" ]; then
    fail "O diretorio nao parece ser um repositorio Git: $INSTALL_DIR"
    exit 1
fi

# Detectar qual compose file existe
if [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
    COMPOSE_FILE="docker-compose.yml"
elif [ -f "$INSTALL_DIR/docker-compose.dev.yml" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    warn "Usando docker-compose.dev.yml (instalação antiga em modo dev)"
else
    fail "Nenhum docker-compose.yml encontrado em $INSTALL_DIR"
    exit 1
fi

if [ ! -f "$INSTALL_DIR/.env" ] && [ ! -f "$INSTALL_DIR/backend/.env" ]; then
    fail ".env nao encontrado em $INSTALL_DIR"
    exit 1
fi

if ! command_exists docker; then
    fail "Docker nao esta instalado"
    exit 1
fi

if ! command_exists git; then
    fail "Git nao esta instalado"
    exit 1
fi

detect_docker_compose
if [ -z "$DOCKER_COMPOSE" ]; then
    fail "Docker Compose nao encontrado"
    exit 1
fi

ok "Ambiente validado"
ok "Docker Compose: $DOCKER_COMPOSE"
ok "Compose file: $COMPOSE_FILE"

acquire_lock

# ============================================
# 2. CARREGAR CONFIGURAÇÕES E DADOS DO GIT
# ============================================
echo ""
echo -e "${BLUE}[2/7] Lendo configuracoes atuais...${NC}"

# Carregar .env (tenta raiz primeiro, depois backend/.env)
load_env

# Ler credenciais salvas (sobrescreve valores iguais vindos do .env)
# Precedencia: .env = config tecnica | .credentials = segredos (GITHUB_TOKEN etc)
if [ -f "$INSTALL_DIR/.credentials" ]; then
    set -a
    . "$INSTALL_DIR/.credentials"
    set +a
    ok "Credenciais carregadas de .credentials"
fi

# Detectar usuario e nome do banco (apos carregar .env e .credentials)
DB_USER_NAME="${DB_USER:-chatia}"
DB_NAME_VALUE="${DB_NAME:-chatia}"

# Detectar URL do git e token
DEFAULT_GITHUB_URL="$(cd "$INSTALL_DIR" && git remote get-url origin 2>/dev/null || echo "")"
# Limpar token da URL se existir
DEFAULT_GITHUB_URL_CLEAN="$(echo "$DEFAULT_GITHUB_URL" | sed 's|https://[^@]*@|https://|')"
DEFAULT_GITHUB_TOKEN=""

cd "$INSTALL_DIR"

CURRENT_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || echo main)"
CURRENT_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
CURRENT_SHORT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

ok "Commit atual: $CURRENT_SHORT_COMMIT"
ok "Branch atual: $CURRENT_BRANCH"

# Detectar nomes dos containers (usa -a para incluir containers parados)
BACKEND_CONTAINER="$(docker ps -a --format '{{.Names}}' | grep -E '^chatia-backend' | head -1 || echo "")"
FRONTEND_CONTAINER="$(docker ps -a --format '{{.Names}}' | grep -E '^chatia-frontend' | head -1 || echo "")"
POSTGRES_CONTAINER="$(docker ps -a --format '{{.Names}}' | grep -E '^chatia-postgres' | head -1 || echo "chatia-postgres")"

if [ -n "$BACKEND_CONTAINER" ]; then
    ok "Backend container: $BACKEND_CONTAINER"
fi
if [ -n "$FRONTEND_CONTAINER" ]; then
    ok "Frontend container: $FRONTEND_CONTAINER"
fi

echo ""
echo -e "${YELLOW}-> Dados do update:${NC}"
GITHUB_URL_INPUT=$(ask_with_default "URL do repositorio GitHub" "$DEFAULT_GITHUB_URL_CLEAN")
read -p "$(echo -e ${CYAN}Token do GitHub ${NC}[Enter para nenhum]: )" GITHUB_TOKEN_INPUT

if [ -z "${GITHUB_TOKEN_INPUT:-}" ]; then
    GITHUB_TOKEN_INPUT="$DEFAULT_GITHUB_TOKEN"
fi

REF="${1:-$CURRENT_BRANCH}"
if [ "$REF" = "HEAD" ] || [ -z "$REF" ]; then
    REF="main"
fi

ok "Referencia do update: $REF"

echo ""
echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}             RESUMO DO UPDATE${NC}"
echo -e "${GREEN}==============================================${NC}"
echo -e "  Diretorio:     ${MAGENTA}$INSTALL_DIR${NC}"
echo -e "  Repositorio:   ${MAGENTA}$GITHUB_URL_INPUT${NC}"
echo -e "  Ref:           ${MAGENTA}$REF${NC}"
echo -e "  Commit atual:  ${MAGENTA}$CURRENT_SHORT_COMMIT${NC}"
echo -e "  Compose file:  ${MAGENTA}$COMPOSE_FILE${NC}"
echo -e "  Backups em:    ${MAGENTA}$BACKUP_DIR${NC}"
echo ""

read -p "$(echo -e ${YELLOW}Continuar com o update? [S/n]: ${NC})" CONFIRM
if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
    warn "Update cancelado."
    exit 0
fi

# ============================================
# 3. BACKUPS LOCAIS
# ============================================
echo ""
echo -e "${BLUE}[3/7] Gerando backups locais...${NC}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DB_BACKUP_FILE="$BACKUP_DIR/db_${DB_NAME_VALUE:-chatia}_${TIMESTAMP}.sql.gz"
UPLOADS_BACKUP_FILE="$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz"
PUBLIC_BACKUP_FILE="$BACKUP_DIR/public_${TIMESTAMP}.tar.gz"
ENV_BACKUP_FILE="$BACKUP_DIR/env_${TIMESTAMP}.bak"
BACKEND_ENV_BACKUP_FILE="$BACKUP_DIR/backend_env_${TIMESTAMP}.bak"
COMPOSE_BACKUP_FILE="$BACKUP_DIR/compose_${TIMESTAMP}.bak"

# Backup dos arquivos de configuração
backup_file_if_exists "$INSTALL_DIR/.env" "$ENV_BACKUP_FILE"
backup_file_if_exists "$INSTALL_DIR/backend/.env" "$BACKEND_ENV_BACKUP_FILE"
backup_file_if_exists "$INSTALL_DIR/$COMPOSE_FILE" "$COMPOSE_BACKUP_FILE"

# Garantir que PostgreSQL está rodando
log "Subindo PostgreSQL, se necessario..."
cd "$INSTALL_DIR"
dc up -d postgres >/dev/null 2>&1

log "Aguardando PostgreSQL ficar pronto..."
MAX_DB_ATTEMPTS=30
DB_ATTEMPT=0

while [ $DB_ATTEMPT -lt $MAX_DB_ATTEMPTS ]; do
    if docker exec "$POSTGRES_CONTAINER" pg_isready -U "$DB_USER_NAME" >/dev/null 2>&1; then
        ok "PostgreSQL esta pronto"
        break
    fi
    DB_ATTEMPT=$((DB_ATTEMPT + 1))
    sleep 2
done

if [ $DB_ATTEMPT -eq $MAX_DB_ATTEMPTS ]; then
    fail "PostgreSQL nao ficou pronto em tempo habil"
    exit 1
fi

# Backup do banco de dados
log "Gerando backup do banco de dados..."
docker exec "$POSTGRES_CONTAINER" pg_dump -U "$DB_USER_NAME" "$DB_NAME_VALUE" | gzip > "$DB_BACKUP_FILE"

if [ ! -s "$DB_BACKUP_FILE" ]; then
    fail "Backup do banco ficou vazio"
    exit 1
fi

DB_SIZE=$(du -h "$DB_BACKUP_FILE" | cut -f1)
ok "Backup do banco criado: $(basename "$DB_BACKUP_FILE") ($DB_SIZE)"

# Backup de uploads
if [ -d "$INSTALL_DIR/backend/uploads" ] && [ "$(ls -A "$INSTALL_DIR/backend/uploads" 2>/dev/null)" ]; then
    log "Gerando backup de uploads..."
    tar -czf "$UPLOADS_BACKUP_FILE" -C "$INSTALL_DIR/backend" uploads
    ok "Backup de uploads criado: $(basename "$UPLOADS_BACKUP_FILE")"
else
    warn "Pasta de uploads vazia ou nao encontrada, pulando"
fi

# Backup de public (logos, etc)
if [ -d "$INSTALL_DIR/backend/public" ] && [ "$(ls -A "$INSTALL_DIR/backend/public" 2>/dev/null)" ]; then
    log "Gerando backup de public..."
    tar -czf "$PUBLIC_BACKUP_FILE" -C "$INSTALL_DIR/backend" public
    ok "Backup de public criado: $(basename "$PUBLIC_BACKUP_FILE")"
fi

# Limpar backups antigos (manter últimos 5)
log "Limpando backups antigos (mantendo ultimos 5)..."
cd "$BACKUP_DIR"
ls -t db_*.sql.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
ls -t uploads_*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
ls -t public_*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
ls -t env_*.bak 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
ls -t backend_env_*.bak 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
ls -t compose_*.bak 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
ok "Backups antigos limpos"

# ============================================
# 4. ATUALIZAR CÓDIGO VIA GIT
# ============================================
echo ""
echo -e "${BLUE}[4/7] Atualizando codigo via Git...${NC}"

cd "$INSTALL_DIR"

DIRTY_FILES="$(get_relevant_git_changes)"
if [ -n "$DIRTY_FILES" ]; then
    warn "Existem alteracoes locais relevantes no projeto."
    echo -e "${YELLOW}  Arquivos alterados:${NC}"
    echo "$DIRTY_FILES"
    echo ""
    warn "Isso vai DESCARTAR mudancas rastreadas pelo git no codigo-fonte."
    warn "NAO afeta: backups, uploads, .env, backend/.env, docker-compose.yml, .credentials"
    read -p "$(echo -e ${YELLOW}Deseja descartar alteracoes locais e continuar? [s/N]: ${NC})" DIRTY_CONFIRM
    if [[ "$DIRTY_CONFIRM" =~ ^[Ss]$ ]]; then
        log "Descartando alteracoes locais..."
        git checkout -- . 2>/dev/null || true
        git clean -fd --exclude=backups --exclude=.env --exclude=backend/.env --exclude=backend/uploads --exclude=backend/public --exclude=docker-compose.yml --exclude=.credentials 2>/dev/null || true
        ok "Alteracoes locais descartadas"
    else
        warn "Update abortado por seguranca."
        exit 1
    fi
else
    ok "Nenhuma alteracao local relevante detectada"
fi

GITHUB_URL_CLEAN="$(echo "$GITHUB_URL_INPUT" | sed 's/\.git$//')"

if [ -n "${GITHUB_TOKEN_INPUT:-}" ]; then
    REPO_PATH="$(echo "$GITHUB_URL_CLEAN" | sed 's|https://||' | sed 's|http://||')"
    AUTH_URL="https://${GITHUB_TOKEN_INPUT}@${REPO_PATH}"
    log "Configurando acesso autenticado ao repositorio..."
    git remote set-url origin "$AUTH_URL"
else
    log "Configurando acesso ao repositorio..."
    git remote set-url origin "$GITHUB_URL_CLEAN"
fi

log "Buscando atualizacoes..."
git fetch --all --tags

log "Posicionando em $REF..."
if ! git checkout "$REF" 2>&1; then
    fail "Nao foi possivel fazer checkout para $REF"
    restore_origin_url "$GITHUB_URL_CLEAN"
    exit 1
fi

log "Salvando arquivos de producao antes do pull..."
# Arquivos criados pelo instalador de produção que o git pode sobrescrever
PROD_FILES_TO_PROTECT=(
    "docker-compose.yml"
    "backend/Dockerfile"
    "frontend/Dockerfile"
    "frontend/nginx.conf"
    "backend/.sequelizerc"
    "backend/database.config.js"
)

PROD_BACKUP_TMP="/tmp/chatia-prod-files-$$"
mkdir -p "$PROD_BACKUP_TMP"

for pfile in "${PROD_FILES_TO_PROTECT[@]}"; do
    if [ -f "$INSTALL_DIR/$pfile" ]; then
        mkdir -p "$PROD_BACKUP_TMP/$(dirname "$pfile")"
        cp "$INSTALL_DIR/$pfile" "$PROD_BACKUP_TMP/$pfile"
    fi
done
ok "Arquivos de producao salvos"

# Detectar se REF é branch (precisa pull) ou tag/commit (já posicionado pelo checkout)
REF_IS_BRANCH=false
if git show-ref --verify --quiet "refs/heads/$REF" 2>/dev/null || \
   git show-ref --verify --quiet "refs/remotes/origin/$REF" 2>/dev/null; then
    REF_IS_BRANCH=true
fi

if [ "$REF_IS_BRANCH" = true ]; then
    log "Aplicando atualizacoes (pull branch $REF)..."
    if ! git pull origin "$REF"; then
        warn "git pull falhou. Restaurando arquivos de producao..."
        for pfile in "${PROD_FILES_TO_PROTECT[@]}"; do
            if [ -f "$PROD_BACKUP_TMP/$pfile" ]; then
                cp "$PROD_BACKUP_TMP/$pfile" "$INSTALL_DIR/$pfile"
            fi
        done
        rm -rf "$PROD_BACKUP_TMP"
        fail "Falha ao fazer git pull. Verifique conflitos ou conectividade."
        fail "Os arquivos de producao foram restaurados."
        exit 1
    fi
else
    ok "REF e tag ou commit ($REF) - checkout ja posicionado, pull nao necessario"
fi

# Restaurar arquivos de produção que o git pode ter sobrescrito
log "Restaurando arquivos de producao..."
for pfile in "${PROD_FILES_TO_PROTECT[@]}"; do
    if [ -f "$PROD_BACKUP_TMP/$pfile" ]; then
        cp "$PROD_BACKUP_TMP/$pfile" "$INSTALL_DIR/$pfile"
    fi
done
rm -rf "$PROD_BACKUP_TMP"
ok "Arquivos de producao restaurados"

# Restaurar URL sem token
restore_origin_url "$GITHUB_URL_CLEAN"

NEW_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
NEW_SHORT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ]; then
    warn "Nenhum commit novo foi encontrado. O codigo ja estava atualizado."
else
    ok "Codigo atualizado: $CURRENT_SHORT_COMMIT -> $NEW_SHORT_COMMIT"

    # Mostrar o que mudou
    echo ""
    log "Commits novos:"
    git log --oneline "$CURRENT_COMMIT..$NEW_COMMIT" 2>/dev/null | head -20 || true
    echo ""
fi

# ============================================
# 5. RODAR MIGRATIONS PENDENTES
# ============================================
echo ""
echo -e "${BLUE}[5/7] Aplicando migrations pendentes...${NC}"

cd "$INSTALL_DIR"

# Parar backend e frontend antes de rebuild
log "Parando backend e frontend..."
dc stop backend frontend 2>/dev/null || true

# Rebuild do backend (precisa compilar o novo código para migrations)
log "Reconstruindo backend..."
dc build backend

# Iniciar backend para rodar migrations
log "Iniciando backend para migrations..."
dc up -d backend

# Aguardar backend estar pronto
log "Aguardando backend iniciar..."
sleep 5

# Detectar nome do container backend (pode ser -dev ou não)
BACKEND_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'chatia-backend' | head -1)"

if [ -z "$BACKEND_CONTAINER" ]; then
    fail "Container do backend nao esta rodando"
    fail "Verifique: dc logs backend"
    exit 1
fi

ok "Backend rodando: $BACKEND_CONTAINER"

# Pré-criar colunas problemáticas (evita falhas em migrations conhecidas)
log "Pre-criando colunas problematicas..."
docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER_NAME" -d "$DB_NAME_VALUE" << 'SQLPREP' 2>/dev/null || true
ALTER TABLE "CompaniesSettings" ADD COLUMN IF NOT EXISTS "DirectTicketsToWallets" VARCHAR(255) DEFAULT 'enabled';
ALTER TABLE "CompaniesSettings" ADD COLUMN IF NOT EXISTS "closeTicketOnTransfer" VARCHAR(255) DEFAULT 'disabled';
INSERT INTO "SequelizeMeta" (name) VALUES
  ('20231122223411-add-DirectTicketsToWallets-to-CompaniesSettings.js'),
  ('20231201123411-add-closeTicketOnTransfer-to-CompaniesSettings.js'),
  ('20251013170001-add-unique-constraint-companies-document.js')
ON CONFLICT DO NOTHING;
SQLPREP
ok "Colunas problematicas verificadas"

# Contar migrations antes
MIGRATIONS_BEFORE=$(docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER_NAME" -d "$DB_NAME_VALUE" -t -c "SELECT COUNT(*) FROM \"SequelizeMeta\";" 2>/dev/null | tr -d ' ' || echo "0")

# Executar migrations
log "Executando migrations..."
MIGRATION_FAILED=false

for ROUND in 1 2 3; do
    log "Rodada ${ROUND} de migrations..."
    MIGRATE_OUTPUT=$(docker exec "$BACKEND_CONTAINER" sh -c "npx sequelize-cli db:migrate" 2>&1) || true
    MIGRATED_COUNT=$(echo "$MIGRATE_OUTPUT" | grep -c "migrated" || echo "0")
    MIGRATED_COUNT=$(echo "$MIGRATED_COUNT" | tr -d '[:space:]')

    # Verificar se houve erro
    if echo "$MIGRATE_OUTPUT" | grep -qi "error\|ERROR" 2>/dev/null; then
        if [ "$ROUND" -lt 3 ]; then
            warn "Erros na rodada $ROUND, tentando novamente..."
            continue
        else
            warn "Algumas migrations com erro na rodada $ROUND"
            MIGRATION_FAILED=true
        fi
    fi

    if [ "${MIGRATED_COUNT:-0}" -eq "0" ] && ! echo "$MIGRATE_OUTPUT" | grep -qi "error" 2>/dev/null; then
        ok "Todas migrations executadas"
        break
    else
        ok "${MIGRATED_COUNT} migrations executadas na rodada ${ROUND}"
    fi
done

if [ "$MIGRATION_FAILED" = true ]; then
    warn "Houve erros em algumas migrations. Verifique os logs do backend."
fi

# Validar tabelas essenciais
log "Validando tabelas essenciais..."
TABLES_OK=true
for TABLE in Users Whatsapps Tickets Contacts Messages Queues; do
    EXISTS=$(docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER_NAME" -d "$DB_NAME_VALUE" -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '$TABLE');" 2>/dev/null | tr -d ' ' || echo "f")
    if [ "$EXISTS" != "t" ]; then
        fail "Tabela $TABLE nao existe!"
        TABLES_OK=false
    fi
done
if [ "$TABLES_OK" = true ]; then
    ok "Todas tabelas essenciais presentes"
else
    fail "Tabelas essenciais faltando. Migrations podem ter falhado."
    warn "Considere rollback manual."
    exit 1
fi

# Contar migrations depois
MIGRATIONS_AFTER=$(docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER_NAME" -d "$DB_NAME_VALUE" -t -c "SELECT COUNT(*) FROM \"SequelizeMeta\";" 2>/dev/null | tr -d ' ' || echo "0")
MIGRATIONS_NEW=$((${MIGRATIONS_AFTER:-0} - ${MIGRATIONS_BEFORE:-0}))

if [ "$MIGRATIONS_NEW" -gt "0" ]; then
    ok "Total de novas migrations aplicadas: $MIGRATIONS_NEW"
else
    ok "Nenhuma nova migration necessaria (total: ${MIGRATIONS_AFTER})"
fi

# ============================================
# 6. REBUILD E RESTART DA APLICAÇÃO
# ============================================
echo ""
echo -e "${BLUE}[6/7] Rebuildando e reiniciando aplicacao...${NC}"

cd "$INSTALL_DIR"

# Rebuild do frontend
log "Reconstruindo frontend (isso pode levar alguns minutos)..."
dc build frontend

# Reiniciar tudo (force-recreate garante que containers usem imagens novas)
log "Reiniciando todos os servicos..."
dc up -d --force-recreate backend frontend

# Restart explícito do backend para aplicar estado final das migrations
log "Reiniciando backend para aplicar estado final..."
if [ -n "$BACKEND_CONTAINER" ]; then
    docker restart "$BACKEND_CONTAINER" 2>/dev/null || true
fi

# Aguardar backend responder
log "Aguardando backend responder..."
MAX_BE_WAIT=120
BE_WAIT=0
BACKEND_OK=false

while [ $BE_WAIT -lt $MAX_BE_WAIT ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000" 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" =~ ^(200|301|302|403|404)$ ]]; then
        BACKEND_OK=true
        ok "Backend respondendo (HTTP $HTTP_CODE)"
        break
    fi

    if [ $((BE_WAIT % 10)) -eq 0 ] && [ $BE_WAIT -gt 0 ]; then
        echo -ne "${YELLOW}  Aguardando backend... ${BE_WAIT}s / ${MAX_BE_WAIT}s${NC}\r"
    fi

    sleep 2
    BE_WAIT=$((BE_WAIT + 2))
done
echo ""

if [ "$BACKEND_OK" = false ]; then
    fail "Backend nao respondeu apos o update"
    echo -e "${YELLOW}Ultimas linhas do log:${NC}"
    dc logs --tail 40 backend || true
    echo ""
    echo -e "${YELLOW}Rollback manual sugerido:${NC}"
    echo -e "  Codigo anterior: ${CYAN}cd $INSTALL_DIR && git reset --hard $CURRENT_COMMIT${NC}"
    echo -e "  Backup banco:    ${CYAN}$DB_BACKUP_FILE${NC}"
    exit 1
fi

# Aguardar frontend responder
log "Aguardando frontend responder..."
MAX_FE_WAIT=60
FE_WAIT=0
FRONTEND_OK=false

while [ $FE_WAIT -lt $MAX_FE_WAIT ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3001" 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" =~ ^(200|304)$ ]]; then
        FRONTEND_OK=true
        ok "Frontend respondendo (HTTP $HTTP_CODE)"
        break
    fi

    if [ $((FE_WAIT % 10)) -eq 0 ] && [ $FE_WAIT -gt 0 ]; then
        echo -ne "${YELLOW}  Aguardando frontend... ${FE_WAIT}s / ${MAX_FE_WAIT}s${NC}\r"
    fi

    sleep 2
    FE_WAIT=$((FE_WAIT + 2))
done
echo ""

if [ "$FRONTEND_OK" = false ]; then
    warn "Frontend ainda nao respondeu, mas o backend esta OK"
    warn "Verifique: cd $INSTALL_DIR && $DOCKER_COMPOSE -f $COMPOSE_FILE logs --tail 50 frontend"
fi

# Recarregar Nginx
log "Recarregando Nginx..."
if nginx -t 2>/dev/null; then
    systemctl reload nginx 2>/dev/null || true
    ok "Nginx recarregado"
else
    warn "Nginx nao instalado ou config invalida (proxy reverso pode nao funcionar)"
fi

# ============================================
# 7. VALIDAÇÃO FINAL
# ============================================
echo ""
echo -e "${BLUE}[7/7] Validacao final...${NC}"

TABLES=$(docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER_NAME" -d "$DB_NAME_VALUE" -t -c \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ' || echo "0")

RUNNING=$(docker ps --filter "name=chatia" --format "{{.Names}}" | wc -l | tr -d ' ')

ok "Banco de dados acessivel ($TABLES tabelas)"
ok "Containers rodando: $RUNNING"

# Verificar status dos containers
echo ""
log "Status dos containers:"
dc ps

echo ""
echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}       UPDATE CONCLUIDO COM SUCESSO${NC}"
echo -e "${GREEN}==============================================${NC}"
echo ""
echo -e "${CYAN}  Commit anterior:${NC}  ${MAGENTA}$CURRENT_SHORT_COMMIT${NC}"
echo -e "${CYAN}  Commit atual:${NC}     ${MAGENTA}$NEW_SHORT_COMMIT${NC}"
echo -e "${CYAN}  Migrations novas:${NC} ${MAGENTA}$MIGRATIONS_NEW${NC}"
echo ""
echo -e "${CYAN}  Backups:${NC}"
echo -e "    Banco:     ${MAGENTA}$DB_BACKUP_FILE${NC}"

if [ -f "$UPLOADS_BACKUP_FILE" ]; then
    echo -e "    Uploads:   ${MAGENTA}$UPLOADS_BACKUP_FILE${NC}"
fi

if [ -f "$PUBLIC_BACKUP_FILE" ]; then
    echo -e "    Public:    ${MAGENTA}$PUBLIC_BACKUP_FILE${NC}"
fi

echo -e "    .env:      ${MAGENTA}$ENV_BACKUP_FILE${NC}"
echo -e "    Compose:   ${MAGENTA}$COMPOSE_BACKUP_FILE${NC}"
echo ""
echo -e "${CYAN}  Comandos uteis:${NC}"
echo -e "   Status:  ${YELLOW}cd $INSTALL_DIR && $DOCKER_COMPOSE -f $COMPOSE_FILE ps${NC}"
echo -e "   Logs:    ${YELLOW}cd $INSTALL_DIR && $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f${NC}"
echo ""
echo -e "${YELLOW}  Se precisar rollback manual:${NC}"
echo -e "   1. Voltar codigo:  ${CYAN}cd $INSTALL_DIR && git reset --hard $CURRENT_COMMIT${NC}"
echo -e "   2. Restaurar banco: ${CYAN}gunzip < $DB_BACKUP_FILE | docker exec -i $POSTGRES_CONTAINER psql -U $DB_USER_NAME -d $DB_NAME_VALUE${NC}"
echo -e "   3. Rebuild:         ${CYAN}cd $INSTALL_DIR && $DOCKER_COMPOSE -f $COMPOSE_FILE up -d --build${NC}"
echo ""
echo -e "${YELLOW}  Nota: Arquivos de producao foram preservados (Dockerfiles, nginx.conf, docker-compose.yml).${NC}"
echo -e "${YELLOW}  Mudancas nesses arquivos vindas do repositorio NAO foram aplicadas.${NC}"
echo -e "${YELLOW}  Se a nova versao exigir mudancas nesses arquivos, aplique-as manualmente.${NC}"
echo ""
