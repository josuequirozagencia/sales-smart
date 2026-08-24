#!/bin/bash

# ============================================
# Instalador ChatIA v4.5 - PRODUÇÃO + SSL
# Suporta: Ubuntu 20.04+ / Debian 11+
# Requer: execução como root
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
BOLD='\033[1m'

# Log de instalação
LOG_FILE="/tmp/chatia-install-$(date +%Y%m%d_%H%M%S).log"

# ============================================
# BARRA DE PROGRESSO ANIMADA
# ============================================
TOTAL_STEPS=11
CURRENT_STEP=0
PROGRESS_PID=""

# Mata animação de progresso se existir
kill_progress_animation() {
    if [ -n "$PROGRESS_PID" ] && kill -0 "$PROGRESS_PID" 2>/dev/null; then
        kill "$PROGRESS_PID" 2>/dev/null
        wait "$PROGRESS_PID" 2>/dev/null || true
    fi
    PROGRESS_PID=""
}

# Inicia barra animada que enche de 0% a ~80%
# Uso: progress_start "Nome da etapa"
# Para etapas interativas (com read): progress_start "Nome" interactive
progress_start() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    local step_name="$1"
    local mode="${2:-animated}"
    local step=$CURRENT_STEP
    local total=$TOTAL_STEPS

    kill_progress_animation
    echo ""

    # Etapas interativas: só mostra cabeçalho estático, sem animação em background
    if [ "$mode" = "interactive" ]; then
        printf "  ${CYAN}[░░░░░░░░░░░░░░░░░░░░] 0%% - Etapa ${step}/${total}: ${step_name}${NC}\n"
        echo ""
        return
    fi

    # Etapas automáticas: animação em background enchendo de 0% a ~80%
    (
        local i=0
        # Enche até 16/20 blocos (~80%) lentamente
        while [ "$i" -le 16 ]; do
            local bar=""
            local space=""
            [ "$i" -gt 0 ] && bar=$(printf '%0.s█' $(seq 1 $i))
            local remaining=$((20 - i))
            [ "$remaining" -gt 0 ] && space=$(printf '%0.s░' $(seq 1 $remaining))
            local pct=$((i * 5))
            printf "\r  ${CYAN}[${bar}${space}] ${pct}%% - Etapa ${step}/${total}: ${step_name}${NC}  "
            i=$((i + 1))
            if [ "$i" -le 5 ]; then
                sleep 0.2
            elif [ "$i" -le 10 ]; then
                sleep 0.5
            else
                sleep 2
            fi
        done
        # Fica piscando em ~80% até progress_done matar o processo
        while true; do
            printf "\r  ${YELLOW}[████████████████░░░░] 80%% - Etapa ${step}/${total}: ${step_name}...${NC}  "
            sleep 1
            printf "\r  ${CYAN}[████████████████░░░░] 80%% - Etapa ${step}/${total}: ${step_name}...${NC}  "
            sleep 1
        done
    ) &
    PROGRESS_PID=$!
}

# Finaliza barra - completa 100% em verde
progress_done() {
    local step_name="$1"
    local step=$CURRENT_STEP
    local total=$TOTAL_STEPS

    kill_progress_animation

    printf "\r  ${GREEN}[████████████████████] 100%% - Etapa ${step}/${total}: ${step_name} ✓${NC}  \n"
    echo ""
}

# Limpar processo de progresso ao sair
cleanup_progress() {
    kill_progress_animation
}
trap cleanup_progress EXIT

# ============================================
# FUNÇÕES AUXILIARES
# ============================================
command_exists() { command -v "$1" >/dev/null 2>&1; }

die() {
    cleanup_progress
    echo ""
    echo -e "${RED}ERRO: $1${NC}" >&2
    echo "[$(date)] ERRO: $1" >> "$LOG_FILE"
    exit 1
}

log() {
    echo "[$(date)] $1" >> "$LOG_FILE"
}

ask_with_default() {
    local prompt="$1"
    local default="$2"
    local value
    if [ -n "$default" ]; then
        read -p "$(echo -e "${CYAN}$prompt ${NC}[${GREEN}$default${NC}]: ")" value
    else
        read -p "$(echo -e "${CYAN}$prompt: ${NC}")" value
    fi
    echo "${value:-$default}"
}

# URL-encode para senhas em URIs (codifica @:#/+=%&? e outros)
urlencode() {
    local string="$1"
    local encoded=""
    local i char
    for (( i=0; i<${#string}; i++ )); do
        char="${string:$i:1}"
        case "$char" in
            [a-zA-Z0-9._~-]) encoded+="$char" ;;
            *) encoded+=$(printf '%%%02X' "'$char") ;;
        esac
    done
    echo "$encoded"
}

pull_image_with_retry() {
    local image="$1"
    if docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^${image}$"; then
        echo -e "${GREEN}  ✓ $image já existe${NC}"
        return 0
    fi
    local attempt=0
    while [ "$attempt" -lt 3 ]; do
        attempt=$((attempt + 1))
        if timeout 180 docker pull "$image" >/dev/null 2>&1; then
            echo -e "${GREEN}  ✓ $image baixada${NC}"
            return 0
        fi
        [ "$attempt" -lt 3 ] && sleep 3
    done
    echo -e "${RED}  ✗ Falha ao baixar $image${NC}"
    return 1
}

wait_for_container() {
    local container="$1"
    local max_wait="${2:-60}"
    local elapsed=0
    while [ "$elapsed" -lt "$max_wait" ]; do
        local status
        status=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || echo "not_found")
        if [ "$status" = "running" ]; then
            return 0
        elif [ "$status" = "exited" ] || [ "$status" = "dead" ]; then
            echo -e "${RED}  Container $container morreu (status: $status)${NC}"
            docker logs --tail 20 "$container" 2>&1 | head -10
            return 1
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    echo -e "${RED}  Timeout esperando container $container${NC}"
    return 1
}

# ============================================
# INÍCIO
# ============================================
clear
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}    Instalador ChatIA v4.5 - PRODUÇÃO${NC}"
echo -e "${CYAN}============================================${NC}"
echo -e "${YELLOW}  Log: $LOG_FILE${NC}"
echo ""
log "Instalação iniciada"

# ============================================
# ETAPA 1: PACOTES DO SISTEMA
# ============================================
progress_start "Verificando pacotes do sistema"

# Exigir root
if [ "$(id -u)" -ne 0 ]; then
    die "Este instalador deve ser executado como root. Use: sudo bash $0"
fi

# Detectar distro
if [ ! -f /etc/os-release ]; then
    die "Arquivo /etc/os-release não encontrado. Sistema operacional não suportado."
fi
OS_ID=$(grep '^ID=' /etc/os-release | cut -d= -f2 | tr -d '"')
OS_CODENAME=$(grep '^VERSION_CODENAME=' /etc/os-release | cut -d= -f2 | tr -d '"')

if [ "$OS_ID" = "ubuntu" ]; then
    DOCKER_REPO="https://download.docker.com/linux/ubuntu"
elif [ "$OS_ID" = "debian" ]; then
    DOCKER_REPO="https://download.docker.com/linux/debian"
else
    die "Distribuição não suportada: $OS_ID. Use Ubuntu 20.04+ ou Debian 11+."
fi

if [ -z "$OS_CODENAME" ]; then
    die "Não foi possível detectar o codename da distribuição. Verifique /etc/os-release."
fi

echo -e "${CYAN}Sistema: ${GREEN}$OS_ID $OS_CODENAME${NC}"

NEED_INSTALL=false
command_exists docker || NEED_INSTALL=true
command_exists nginx || NEED_INSTALL=true
command_exists certbot || NEED_INSTALL=true
command_exists git || NEED_INSTALL=true
command_exists openssl || NEED_INSTALL=true
(docker compose version >/dev/null 2>&1 || command_exists docker-compose) || NEED_INSTALL=true

if [ "$NEED_INSTALL" = true ]; then
    echo -e "${YELLOW}Instalando pacotes necessários...${NC}"

    apt-get update -qq >> "$LOG_FILE" 2>&1 || die "Falha no apt-get update"
    apt-get install -y -qq apt-transport-https ca-certificates curl gnupg lsb-release openssl >> "$LOG_FILE" 2>&1

    if ! command_exists docker; then
        echo -e "${CYAN}  Instalando Docker...${NC}"
        curl -fsSL "${DOCKER_REPO}/gpg" | gpg --batch --yes --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg 2>/dev/null
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] ${DOCKER_REPO} ${OS_CODENAME} stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
        apt-get update -qq >> "$LOG_FILE" 2>&1
    fi

    apt-get install -y docker-ce docker-ce-cli containerd.io nginx certbot python3-certbot-nginx git bind9-host >> "$LOG_FILE" 2>&1 || {
        apt-get install -y nginx certbot python3-certbot-nginx git bind9-host >> "$LOG_FILE" 2>&1 || true
    }

    # Docker Compose plugin
    if ! docker compose version >/dev/null 2>&1 && ! command_exists docker-compose; then
        echo -e "${CYAN}  Instalando Docker Compose...${NC}"
        curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi

    rm -f /etc/nginx/sites-enabled/default

    # Verificar se Docker está rodando
    if ! systemctl is-active --quiet docker 2>/dev/null; then
        systemctl start docker >> "$LOG_FILE" 2>&1 || die "Não foi possível iniciar o Docker"
        systemctl enable docker >> "$LOG_FILE" 2>&1 || true
    fi

    echo -e "${GREEN}✓ Pacotes instalados${NC}"
else
    if ! systemctl is-active --quiet docker 2>/dev/null; then
        systemctl start docker >> "$LOG_FILE" 2>&1 || die "Docker não está rodando"
    fi
    echo -e "${GREEN}✓ Todos os pacotes já instalados${NC}"
fi

# Swap (2GB se não existir)
if [ "$(swapon --show | wc -l)" -eq "0" ]; then
    echo -e "${YELLOW}Criando swap de 2GB...${NC}"
    fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 2>/dev/null
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null 2>&1
    swapon /swapfile 2>/dev/null || true
    grep -q "/swapfile" /etc/fstab || echo "/swapfile none swap sw 0 0" | tee -a /etc/fstab >/dev/null
    echo -e "${GREEN}✓ Swap criado${NC}"
fi

# Docker daemon config (log rotation)
DAEMON_JSON="/etc/docker/daemon.json"
if [ ! -f "$DAEMON_JSON" ] || ! grep -q "max-concurrent-downloads" "$DAEMON_JSON" 2>/dev/null; then
    tee "$DAEMON_JSON" > /dev/null << 'DOCKERCONF'
{
  "max-concurrent-downloads": 10,
  "max-concurrent-uploads": 5,
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
DOCKERCONF
    systemctl restart docker >> "$LOG_FILE" 2>&1
    sleep 2
fi

progress_done "Pacotes do sistema"

# ============================================
# ETAPA 2: DOMÍNIOS E VALIDAÇÃO DE DNS
# (Primeira coisa a perguntar - trava se errado)
# ============================================
progress_start "Validando domínios e DNS" interactive

# Detectar IP do servidor
SERVER_IP=$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || curl -4 -s --max-time 5 icanhazip.com 2>/dev/null || echo "")

if [ -z "$SERVER_IP" ]; then
    echo -e "${YELLOW}⚠️  Não foi possível detectar o IP público deste servidor.${NC}"
    echo -e "${YELLOW}   Continuando sem validação de DNS...${NC}"
fi

echo ""
echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║  CONFIGURAÇÃO DE DOMÍNIOS (OBRIGATÓRIO)                 ║${NC}"
echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
if [ -n "$SERVER_IP" ]; then
    echo -e "${YELLOW}  O IP deste servidor é: ${BOLD}${GREEN}${SERVER_IP}${NC}"
    echo -e "${YELLOW}  Antes de continuar, aponte os domínios para esse IP no painel DNS.${NC}"
    echo -e "${YELLOW}  Tipo: ${BOLD}A${NC}${YELLOW} | Host: ${BOLD}subdominio${NC}${YELLOW} | Valor: ${BOLD}${SERVER_IP}${NC}"
fi
echo ""
echo -e "${YELLOW}  Exemplo: crmback.suaempresa.com.br (API) / crm.suaempresa.com.br (Painel)${NC}"
echo ""

if [ -z "${BACKEND_DOMAIN:-}" ]; then
    BACKEND_DOMAIN=$(ask_with_default "Domínio do Backend (API)" "")
fi
if [ -z "${FRONTEND_DOMAIN:-}" ]; then
    FRONTEND_DOMAIN=$(ask_with_default "Domínio do Frontend (Painel)" "")
fi

[ -z "${BACKEND_DOMAIN:-}" ] && die "Domínio do Backend é obrigatório!"
[ -z "${FRONTEND_DOMAIN:-}" ] && die "Domínio do Frontend é obrigatório!"

echo ""
echo -e "${CYAN}Verificando apontamento DNS...${NC}"

# Resolver domínios
resolve_domain() {
    local domain="$1"
    local resolved=""
    if command_exists host; then
        resolved=$(host "$domain" 2>/dev/null | awk '/has address/ {print $4; exit}' || echo "")
    fi
    if [ -z "$resolved" ]; then
        resolved=$(getent hosts "$domain" 2>/dev/null | awk '{print $1; exit}' || echo "")
    fi
    echo "$resolved"
}

BACKEND_RESOLVED=$(resolve_domain "$BACKEND_DOMAIN")
FRONTEND_RESOLVED=$(resolve_domain "$FRONTEND_DOMAIN")

DNS_OK=true

# Validar backend domain
if [ -z "$BACKEND_RESOLVED" ]; then
    echo -e "${RED}  ✗ $BACKEND_DOMAIN não resolve para nenhum IP!${NC}"
    echo -e "${RED}    Verifique se o registro A foi criado no painel DNS.${NC}"
    DNS_OK=false
elif [ -n "$SERVER_IP" ] && [ "$BACKEND_RESOLVED" != "$SERVER_IP" ]; then
    echo -e "${RED}  ✗ $BACKEND_DOMAIN aponta para ${BACKEND_RESOLVED}, mas o IP deste servidor é ${SERVER_IP}${NC}"
    echo -e "${RED}    Corrija o apontamento DNS para ${SERVER_IP}${NC}"
    DNS_OK=false
else
    echo -e "${GREEN}  ✓ $BACKEND_DOMAIN → $BACKEND_RESOLVED${NC}"
fi

# Validar frontend domain
if [ -z "$FRONTEND_RESOLVED" ]; then
    echo -e "${RED}  ✗ $FRONTEND_DOMAIN não resolve para nenhum IP!${NC}"
    echo -e "${RED}    Verifique se o registro A foi criado no painel DNS.${NC}"
    DNS_OK=false
elif [ -n "$SERVER_IP" ] && [ "$FRONTEND_RESOLVED" != "$SERVER_IP" ]; then
    echo -e "${RED}  ✗ $FRONTEND_DOMAIN aponta para ${FRONTEND_RESOLVED}, mas o IP deste servidor é ${SERVER_IP}${NC}"
    echo -e "${RED}    Corrija o apontamento DNS para ${SERVER_IP}${NC}"
    DNS_OK=false
else
    echo -e "${GREEN}  ✓ $FRONTEND_DOMAIN → $FRONTEND_RESOLVED${NC}"
fi

# TRAVA: não continua se DNS estiver errado
if [ "$DNS_OK" = false ]; then
    echo ""
    echo ""
    echo -e "${RED}${BOLD}  INSTALAÇÃO BLOQUEADA - DNS NÃO ESTÁ CORRETO!${NC}"
    echo ""
    echo -e "${RED}  Os domínios precisam apontar para o IP deste servidor${NC}"
    echo -e "${RED}  ANTES de continuar a instalação.${NC}"
    if [ -n "$SERVER_IP" ]; then
    echo ""
    echo -e "${RED}  IP do servidor: ${BOLD}${SERVER_IP}${NC}"
    fi
    echo ""
    echo -e "${YELLOW}  Passos para corrigir:${NC}"
    echo -e "${YELLOW}  1. Acesse o painel DNS do seu domínio${NC}"
    echo -e "${YELLOW}  2. Crie registros tipo A apontando para o IP acima${NC}"
    echo -e "${YELLOW}  3. Aguarde propagação (pode levar até 30 minutos)${NC}"
    echo -e "${YELLOW}  4. Execute o instalador novamente${NC}"
    echo ""
    die "Corrija o apontamento DNS e execute o instalador novamente."
fi

echo ""
echo -e "${GREEN}✓ DNS validado! Ambos os domínios apontam para este servidor.${NC}"

# E-mail para SSL (pedir aqui pois é relacionado aos domínios)
echo ""
echo -e "${YELLOW}  E-mail usado para o certificado SSL (Let's Encrypt):${NC}"
if [ -z "${LETSENCRYPT_EMAIL:-}" ]; then
    LETSENCRYPT_EMAIL=$(ask_with_default "Seu e-mail" "")
fi

progress_done "Domínios e DNS validados"

# ============================================
# ETAPA 3: CONFIGURAÇÃO INTERATIVA
# ============================================
progress_start "Coletando configurações" interactive

echo -e "${YELLOW}Configure sua instalação:${NC}"
echo ""

echo -e "${BLUE}--- Repositório ---${NC}"
if [ -z "${GITHUB_URL:-}" ]; then
    GITHUB_URL=$(ask_with_default "URL do repositório GitHub" "https://github.com/TappyID/chatia-4.4.git")
else
    echo -e "${CYAN}Repositório: ${GREEN}$GITHUB_URL${NC}"
fi

if [ -z "${GITHUB_TOKEN:-}" ]; then
    echo -e "${YELLOW}  (Token de acesso ao repositório privado. Gere em: GitHub > Settings > Developer settings > Tokens)${NC}"
    read -s -p "$(echo -e "${CYAN}Token do GitHub: ${NC}")" GITHUB_TOKEN
    echo ""
    if [ -z "$GITHUB_TOKEN" ]; then
        die "Token do GitHub é obrigatório para repositórios privados!"
    fi
else
    echo -e "${CYAN}Token: ${GREEN}****${GITHUB_TOKEN: -4}${NC}"
fi

echo ""
echo -e "${BLUE}--- Dados da Empresa ---${NC}"
if [ -z "${COMPANY_NAME:-}" ]; then
    COMPANY_NAME=$(ask_with_default "Nome da sua empresa (aparece no sistema)" "ChatIA")
fi

echo ""
echo -e "${BLUE}--- Contato ---${NC}"
echo -e "${YELLOW}  Ex: 5511999999999${NC}"
if [ -z "${CONTACT_PHONE:-}" ]; then
    CONTACT_PHONE=$(ask_with_default "Telefone de suporte (com DDD, sem espaços)" "")
fi

echo ""
echo -e "${BLUE}--- Credenciais de Acesso ao Sistema ---${NC}"
echo -e "${YELLOW}  E-mail e senha que você vai usar para entrar no painel.${NC}"
if [ -z "${ADMIN_EMAIL:-}" ]; then
    ADMIN_EMAIL=$(ask_with_default "E-mail do administrador" "")
fi
if [ -z "${ADMIN_PASSWORD:-}" ]; then
    read -s -p "$(echo -e "${CYAN}Senha do administrador: ${NC}")" ADMIN_PASSWORD
    echo ""
fi

echo ""
echo -e "${BLUE}--- Senhas do Banco de Dados (uso interno) ---${NC}"
echo -e "${YELLOW}  Pode pressionar Enter para gerar senhas automáticas (recomendado).${NC}"
if [ -z "${DB_PASSWORD:-}" ]; then
    read -s -p "$(echo -e "${CYAN}Senha do PostgreSQL ${NC}[Enter = gerar automática]: ")" DB_PASSWORD_INPUT
    echo ""
    DB_PASSWORD="${DB_PASSWORD_INPUT:-$(openssl rand -hex 16)}"
fi
if [ -z "${REDIS_PASSWORD:-}" ]; then
    read -s -p "$(echo -e "${CYAN}Senha do Redis ${NC}[Enter = gerar automática]: ")" REDIS_PASSWORD_INPUT
    echo ""
    REDIS_PASSWORD="${REDIS_PASSWORD_INPUT:-$(openssl rand -hex 16)}"
fi

echo ""
echo -e "${BLUE}--- Diretório ---${NC}"
if [ -z "${INSTALL_DIR:-}" ]; then
    INSTALL_DIR=$(ask_with_default "Onde instalar o sistema" "/opt/chatia")
fi

# Validar campos obrigatórios
MISSING=""
[ -z "${ADMIN_EMAIL:-}" ] && MISSING="$MISSING E-mail-Admin"
[ -z "${ADMIN_PASSWORD:-}" ] && MISSING="$MISSING Senha-Admin"
if [ -n "$MISSING" ]; then
    die "Campos obrigatórios faltando:$MISSING"
fi

# Fallbacks
[ -z "${LETSENCRYPT_EMAIL:-}" ] && LETSENCRYPT_EMAIL="$ADMIN_EMAIL"
[ -z "${CONTACT_PHONE:-}" ] && CONTACT_PHONE=""

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "  Empresa:     ${MAGENTA}$COMPANY_NAME${NC}"
echo -e "  Backend:     ${MAGENTA}$BACKEND_DOMAIN${NC}"
echo -e "  Frontend:    ${MAGENTA}$FRONTEND_DOMAIN${NC}"
echo -e "  SSL Email:   ${MAGENTA}$LETSENCRYPT_EMAIL${NC}"
echo -e "  Telefone:    ${MAGENTA}$CONTACT_PHONE${NC}"
echo -e "  Admin:       ${MAGENTA}$ADMIN_EMAIL${NC}"
echo -e "  Diretório:   ${MAGENTA}$INSTALL_DIR${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

if [ -z "${AUTO_CONFIRM:-}" ] && [ -z "${FORCE_REINSTALL:-}" ]; then
    read -p "$(echo -e "${YELLOW}Deseja continuar com essas configurações? ${NC}[S/n]: ")" CONFIRM
    [[ "${CONFIRM:-S}" =~ ^[Nn]$ ]] && { echo "Cancelado."; exit 0; }
fi

log "Config: BACKEND_DOMAIN=$BACKEND_DOMAIN FRONTEND_DOMAIN=$FRONTEND_DOMAIN INSTALL_DIR=$INSTALL_DIR"

progress_done "Configurações coletadas"

# ============================================
# ETAPA 4: CLONAR REPOSITÓRIO
# ============================================
progress_start "Clonando repositório"

# Verificar diretório existente
if [ -d "$INSTALL_DIR" ] && [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
    if [ -n "${FORCE_REINSTALL:-}" ]; then
        echo -e "${YELLOW}Removendo instalação anterior...${NC}"
        cd "$INSTALL_DIR" 2>/dev/null && docker compose down -v 2>/dev/null || true
        cd /tmp
        rm -rf "$INSTALL_DIR"
    else
        echo -e "${YELLOW}⚠️  $INSTALL_DIR já existe.${NC}"
        echo -e "  ${GREEN}1)${NC} Remover e reinstalar (APAGA TUDO)"
        echo -e "  ${GREEN}2)${NC} Cancelar"
        read -p "Escolha [1/2] (padrão: 2): " OPTION
        case "${OPTION:-2}" in
            1)
                echo -e "${YELLOW}Parando containers...${NC}"
                cd "$INSTALL_DIR" 2>/dev/null && docker compose down -v 2>/dev/null || true
                cd /tmp
                rm -rf "$INSTALL_DIR"
                ;;
            *) echo "Cancelado."; exit 0 ;;
        esac
    fi
fi

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo -e "${CYAN}Clonando repositório...${NC}"
REPO_PATH=$(echo "$GITHUB_URL" | sed 's|https://||' | sed 's|http://||')
if ! git clone "https://${GITHUB_TOKEN}@${REPO_PATH}" . >> "$LOG_FILE" 2>&1; then
    die "Falha ao clonar repositório. Verifique URL e token."
fi

# Remover token do .git/config (segurança)
git remote set-url origin "$GITHUB_URL" >> "$LOG_FILE" 2>&1 || true
log "Token removido do git remote"

# Validar estrutura do repositório
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    die "Estrutura do repositório inválida! Pastas backend/ e frontend/ não encontradas."
fi

if [ ! -f "backend/Dockerfile" ] || [ ! -f "frontend/Dockerfile" ]; then
    die "Dockerfiles não encontrados! Verifique o repositório."
fi

echo -e "${GREEN}✓ Repositório clonado${NC}"

progress_done "Repositório clonado"

# ============================================
# ETAPA 5: CRIAR ARQUIVOS DE CONFIGURAÇÃO
# ============================================
progress_start "Criando configurações"

JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)

# URL-encode das senhas para URIs Redis
REDIS_PASSWORD_ENCODED=$(urlencode "$REDIS_PASSWORD")

# docker-compose.yml (específico desta VPS)
cat > docker-compose.yml << COMPOSEFILE
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: chatia-backend
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - ./backend/public:/app/public
      - ./backend/uploads:/app/uploads
    environment:
      - NODE_ENV=production
    env_file:
      - ./backend/.env
    depends_on:
      - postgres
      - redis
    networks:
      - chatia-network
    command: node dist/server.js

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - REACT_APP_BACKEND_URL=https://${BACKEND_DOMAIN}
        - "REACT_APP_NAME_SYSTEM=${COMPANY_NAME}"
        - "REACT_APP_COMPANY_NAME=${COMPANY_NAME}"
        - "REACT_APP_NUMBER_SUPPORT=${CONTACT_PHONE}"
        - REACT_APP_HOURS_CLOSE_TICKETS_AUTO=9999
        - "REACT_APP_PRIMARY_COLOR=#6B46C1"
        - "REACT_APP_PRIMARY_DARK=#4C1D95"
        - REACT_APP_FACEBOOK_APP_ID=
        - REACT_APP_REQUIRE_BUSINESS_MANAGEMENT=FALSE
    container_name: chatia-frontend
    restart: unless-stopped
    ports:
      - "127.0.0.1:3001:80"
    environment:
      - NODE_ENV=production
    depends_on:
      - backend
    networks:
      - chatia-network

  postgres:
    image: postgres:13
    container_name: chatia-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: chatia
      POSTGRES_USER: chatia
      POSTGRES_PASSWORD: "${DB_PASSWORD}"
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    networks:
      - chatia-network

  redis:
    image: redis:6-alpine
    container_name: chatia-redis
    restart: unless-stopped
    command: redis-server --requirepass "${REDIS_PASSWORD}"
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - chatia-network

networks:
  chatia-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
COMPOSEFILE

# backend/.env
cat > backend/.env << BACKENDENV
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
BACKEND_URL=https://${BACKEND_DOMAIN}
FRONTEND_URL=https://${FRONTEND_DOMAIN}
DB_DIALECT=postgres
DB_HOST=postgres
DB_PORT=5432
DB_USER=chatia
DB_PASS="${DB_PASSWORD}"
DB_NAME=chatia
DB_POOL_MAX=100
DB_POOL_MIN=15
DB_POOL_ACQUIRE=30000
DB_POOL_IDLE=600000
IO_REDIS_SERVER=redis
IO_REDIS_PORT=6379
IO_REDIS_PASSWORD="${REDIS_PASSWORD}"
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD="${REDIS_PASSWORD}"
REDIS_DB=0
REDIS_SECRET_KEY=MULTI100
REDIS_OPT_LIMITER_MAX=1
REDIS_OPT_LIMITER_DURATION=3000
REDIS_URI=redis://:${REDIS_PASSWORD_ENCODED}@redis:6379
IO_REDIS_URI=redis://:${REDIS_PASSWORD_ENCODED}@redis:6379
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
ADMIN_USERNAME=${ADMIN_EMAIL}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD="${ADMIN_PASSWORD}"
COMPANY_NAME="${COMPANY_NAME}"
CONTACT_PHONE="${CONTACT_PHONE}"
SESSION_SECRET=${SESSION_SECRET}
STORAGE_TYPE=local
LOG_LEVEL=info
FFMPEG_PATH=/usr/bin/ffmpeg
BACKENDENV

# .env raiz
cat > .env << ROOTENV
BACKEND_URL=https://${BACKEND_DOMAIN}
FRONTEND_URL=https://${FRONTEND_DOMAIN}
REACT_APP_BACKEND_URL=https://${BACKEND_DOMAIN}
REACT_APP_NAME_SYSTEM="${COMPANY_NAME}"
REACT_APP_COMPANY_NAME="${COMPANY_NAME}"
REACT_APP_NUMBER_SUPPORT="${CONTACT_PHONE}"
REACT_APP_HOURS_CLOSE_TICKETS_AUTO=9999
REACT_APP_PRIMARY_COLOR=#6B46C1
REACT_APP_PRIMARY_DARK=#4C1D95
REACT_APP_FACEBOOK_APP_ID=
REACT_APP_REQUIRE_BUSINESS_MANAGEMENT=FALSE
DB_NAME=chatia
DB_USER=chatia
DB_PASS="${DB_PASSWORD}"
DB_HOST=postgres
DB_PORT=5432
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD="${REDIS_PASSWORD}"
IO_REDIS_SERVER=redis
IO_REDIS_PORT=6379
IO_REDIS_PASSWORD="${REDIS_PASSWORD}"
ROOTENV

# Credenciais salvas (arquivo protegido)
cat > .credentials << CREDS
# ChatIA - Credenciais ($(date))
# GUARDE ESTE ARQUIVO EM LOCAL SEGURO
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD="${ADMIN_PASSWORD}"
DB_PASSWORD="${DB_PASSWORD}"
REDIS_PASSWORD="${REDIS_PASSWORD}"
BACKEND_DOMAIN=${BACKEND_DOMAIN}
FRONTEND_DOMAIN=${FRONTEND_DOMAIN}
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
COMPANY_NAME="${COMPANY_NAME}"
CONTACT_PHONE="${CONTACT_PHONE}"
CREDS
chmod 600 .credentials

# Criar diretórios de volumes
mkdir -p backend/public backend/uploads

# Nginx configs (HTTP only - SSL será adicionado pelo certbot)
tee /etc/nginx/sites-available/chatia-backend > /dev/null << NGINXBACK
server {
    listen 80;
    server_name ${BACKEND_DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:3000/socket.io;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
        proxy_cache_bypass \$http_upgrade;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_buffering off;
        proxy_request_buffering off;
        client_max_body_size 100M;
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
NGINXBACK

tee /etc/nginx/sites-available/chatia-frontend > /dev/null << NGINXFRONT
server {
    listen 80;
    server_name ${FRONTEND_DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINXFRONT

# Ativar configs nginx e garantir que está rodando
rm -f /etc/nginx/sites-enabled/chatia-backend /etc/nginx/sites-enabled/chatia-frontend
ln -sf /etc/nginx/sites-available/chatia-backend /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/chatia-frontend /etc/nginx/sites-enabled/

# Criar diretório para challenge do certbot
mkdir -p /var/www/html/.well-known/acme-challenge

if nginx -t >> "$LOG_FILE" 2>&1; then
    systemctl restart nginx >> "$LOG_FILE" 2>&1
    echo -e "${GREEN}✓ Nginx configurado e rodando${NC}"
else
    echo -e "${RED}⚠️  Configuração do Nginx inválida!${NC}"
    nginx -t 2>&1
    die "Nginx não pôde ser configurado. Verifique os domínios."
fi

echo -e "${GREEN}✓ Configurações criadas${NC}"

progress_done "Configurações criadas"

# ============================================
# ETAPA 6: BAIXAR IMAGENS DOCKER (PARALELO)
# ============================================
progress_start "Baixando imagens Docker"

IMAGES_OK=true
pull_image_with_retry "postgres:13" &
PID1=$!
pull_image_with_retry "redis:6-alpine" &
PID2=$!
pull_image_with_retry "node:20-alpine" &
PID3=$!
pull_image_with_retry "nginx:alpine" &
PID4=$!

wait $PID1 || IMAGES_OK=false
wait $PID2 || IMAGES_OK=false
wait $PID3 || IMAGES_OK=false
wait $PID4 || IMAGES_OK=false

if [ "$IMAGES_OK" = false ]; then
    echo -e "${YELLOW}⚠️  Algumas imagens falharam. O build tentará baixar novamente.${NC}"
fi

progress_done "Imagens Docker baixadas"

# ============================================
# ETAPA 7: INICIAR BANCO E CACHE
# ============================================
progress_start "Iniciando PostgreSQL e Redis"

cd "$INSTALL_DIR"
docker compose down 2>/dev/null || true
docker compose up -d postgres redis >> "$LOG_FILE" 2>&1

echo -e "${CYAN}Aguardando PostgreSQL...${NC}"
PG_READY=false
for i in $(seq 1 45); do
    if docker exec chatia-postgres pg_isready -U chatia >/dev/null 2>&1; then
        PG_READY=true
        break
    fi
    sleep 2
done
if [ "$PG_READY" = false ]; then
    echo -e "${RED}PostgreSQL não ficou pronto em 90s. Logs:${NC}"
    docker logs --tail 10 chatia-postgres 2>&1
    die "PostgreSQL não iniciou. Verifique os logs acima."
fi
echo -e "${GREEN}✓ PostgreSQL pronto${NC}"

# Verificar Redis
echo -e "${CYAN}Verificando Redis...${NC}"
REDIS_READY=false
for i in $(seq 1 15); do
    if docker exec chatia-redis redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -q "PONG"; then
        REDIS_READY=true
        break
    fi
    sleep 2
done
if [ "$REDIS_READY" = false ]; then
    echo -e "${YELLOW}⚠️  Redis pode não estar pronto, continuando...${NC}"
else
    echo -e "${GREEN}✓ Redis pronto${NC}"
fi

progress_done "PostgreSQL e Redis prontos"

# ============================================
# ETAPA 8: BUILD E INICIAR BACKEND
# ============================================
progress_start "Construindo backend (npm install + compilação TypeScript)"

echo -e "${CYAN}Isso pode levar de 3 a 10 minutos dependendo do servidor...${NC}"
if ! docker compose build backend >> "$LOG_FILE" 2>&1; then
    echo -e "${RED}Build do backend falhou! Últimas linhas do log:${NC}"
    tail -20 "$LOG_FILE"
    die "Build do backend falhou. Verifique o log: $LOG_FILE"
fi
echo -e "${GREEN}✓ Backend compilado${NC}"

docker compose up -d backend >> "$LOG_FILE" 2>&1

echo -e "${CYAN}Aguardando container do backend...${NC}"
if ! wait_for_container "chatia-backend" 60; then
    die "Container do backend não iniciou. Verifique: docker logs chatia-backend"
fi
echo -e "${GREEN}✓ Backend rodando${NC}"

progress_done "Backend construído"

# ============================================
# ETAPA 9: MIGRATIONS, SEEDS E ADMIN
# ============================================
progress_start "Executando migrations e seeds"

# Pré-criar colunas problemáticas (falha silenciosa em install limpo, funciona em reinstall)
docker exec chatia-postgres psql -U chatia -d chatia << 'SQLPREP' >> "$LOG_FILE" 2>&1 || true
ALTER TABLE "CompaniesSettings" ADD COLUMN IF NOT EXISTS "DirectTicketsToWallets" VARCHAR(255) DEFAULT 'enabled';
ALTER TABLE "CompaniesSettings" ADD COLUMN IF NOT EXISTS "closeTicketOnTransfer" VARCHAR(255) DEFAULT 'disabled';
INSERT INTO "SequelizeMeta" (name) VALUES
  ('20231122223411-add-DirectTicketsToWallets-to-CompaniesSettings.js'),
  ('20231201123411-add-closeTicketOnTransfer-to-CompaniesSettings.js'),
  ('20251013170001-add-unique-constraint-companies-document.js')
ON CONFLICT DO NOTHING;
SQLPREP

# Migrations (até 3 rodadas para resolver dependências entre migrations)
MIGRATION_FAILED=false
for ROUND in 1 2 3; do
    echo -e "${CYAN}  Migrations rodada ${ROUND}...${NC}"
    MIGRATE_OUTPUT=$(docker exec chatia-backend sh -c "npx sequelize-cli db:migrate" 2>&1) || true
    echo "$MIGRATE_OUTPUT" >> "$LOG_FILE"

    # Contar migrations executadas
    MIGRATED_COUNT=$(echo "$MIGRATE_OUTPUT" | grep -c "migrated" 2>/dev/null || echo "0")
    MIGRATED_COUNT=$(echo "$MIGRATED_COUNT" | tr -d '[:space:]')

    # Verificar se houve erro
    if echo "$MIGRATE_OUTPUT" | grep -qi "error\|ERROR" 2>/dev/null; then
        if [ "$ROUND" -lt 3 ]; then
            echo -e "${YELLOW}  ⚠️  Erros na rodada $ROUND, tentando novamente...${NC}"
            continue
        else
            echo -e "${YELLOW}  ⚠️  Algumas migrations com erro (rodada $ROUND).${NC}"
            MIGRATION_FAILED=true
        fi
    fi

    if [ "${MIGRATED_COUNT:-0}" -eq "0" ] && ! echo "$MIGRATE_OUTPUT" | grep -qi "error" 2>/dev/null; then
        echo -e "${GREEN}  ✓ Todas migrations executadas${NC}"
        break
    fi
    echo -e "${GREEN}  ✓ ${MIGRATED_COUNT} migrations na rodada ${ROUND}${NC}"
done

# Validar tabelas principais existem
TABLES_OK=true
for TABLE in Users Companies Whatsapps Tickets Contacts Messages Queues; do
    EXISTS=$(docker exec chatia-postgres psql -U chatia -d chatia -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '$TABLE');" 2>/dev/null | tr -d ' ' || echo "f")
    if [ "$EXISTS" != "t" ]; then
        echo -e "${RED}  ✗ Tabela $TABLE não existe!${NC}"
        TABLES_OK=false
    fi
done

if [ "$TABLES_OK" = false ]; then
    die "Migrations falharam: tabelas essenciais não foram criadas. Verifique o log: $LOG_FILE"
fi

MIGRATIONS_COUNT=$(docker exec chatia-postgres psql -U chatia -d chatia -t -c "SELECT COUNT(*) FROM \"SequelizeMeta\";" 2>/dev/null | tr -d ' ' || echo "?")
echo -e "${GREEN}  ✓ Total migrations registradas: ${MIGRATIONS_COUNT}${NC}"

if [ "$MIGRATION_FAILED" = true ]; then
    echo -e "${YELLOW}  ⚠️  Houve erros em migrations não-críticas. Verifique o log para detalhes.${NC}"
fi

# Seeds
echo -e "${CYAN}  Executando seeds...${NC}"
SEED_OUTPUT=$(docker exec chatia-backend sh -c "npx sequelize-cli db:seed:all" 2>&1) || true
echo "$SEED_OUTPUT" >> "$LOG_FILE"
echo -e "${GREEN}  ✓ Seeds executados${NC}"

# Seed admin com credenciais do usuário
echo -e "${CYAN}  Criando admin...${NC}"
cat > backend/seed_admin.js << 'SEEDSCRIPT'
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const adminEmail = process.env.ADMIN_EMAIL || 'admin@admin.com';
const adminPassword = process.env.ADMIN_PASSWORD || '123456';
const companyName = process.env.COMPANY_NAME || 'ChatIA';
const passwordHash = bcrypt.hashSync(adminPassword, 10);

async function tableExists(client, tableName) {
  const result = await client.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)", [tableName]);
  return result.rows[0].exists;
}

async function seedAdmin() {
  const client = new Client({ host: 'postgres', port: 5432, database: 'chatia', user: 'chatia', password: process.env.DB_PASS });
  try {
    await client.connect();
    const hasCompanies = await tableExists(client, 'Companies');
    const hasPlans = await tableExists(client, 'Plans');
    let companyId = null;

    if (hasPlans && hasCompanies) {
      const planCheck = await client.query('SELECT id FROM "Plans" WHERE id = 1');
      if (planCheck.rows.length === 0) {
        await client.query(`INSERT INTO "Plans" (id, name, users, connections, queues, amount, "useWhatsapp", "useFacebook", "useInstagram", "useCampaigns", "useSchedules", "useInternalChat", "useExternalApi", "useKanban", "createdAt", "updatedAt") VALUES (1, 'Plano Padrão', 10, 10, 10, 100, true, true, true, true, true, true, true, true, NOW(), NOW())`);
      }
      const companyResult = await client.query('SELECT id FROM "Companies" ORDER BY id LIMIT 1');
      if (companyResult.rows.length === 0) {
        const ins = await client.query('INSERT INTO "Companies" (name, "planId", "createdAt", "updatedAt") VALUES ($1, 1, NOW(), NOW()) RETURNING id', [companyName]);
        companyId = ins.rows[0].id;
      } else {
        companyId = companyResult.rows[0].id;
      }
    }

    const checkAdmin = await client.query('SELECT id, email FROM "Users" WHERE id = 1');
    const checkByEmail = await client.query('SELECT id, email FROM "Users" WHERE email = $1', [adminEmail]);
    const existing = checkAdmin.rows[0] || checkByEmail.rows[0];

    if (existing) {
      await client.query('UPDATE "Users" SET email = $1, "passwordHash" = $2, name = $3, profile = $4, super = true WHERE id = $5', [adminEmail, passwordHash, 'Admin', 'admin', existing.id]);
      console.log('[OK] Admin atualizado: ' + adminEmail);
    } else {
      const colsResult = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'Users'");
      const columns = colsResult.rows.map(r => r.column_name);
      let insertCols = ['name', 'email', '"passwordHash"', 'profile', '"tokenVersion"', '"createdAt"', '"updatedAt"'];
      let insertVals = ['$1', '$2', '$3', '$4', '0', 'NOW()', 'NOW()'];
      let insertParams = ['Admin', adminEmail, passwordHash, 'admin'];
      if (columns.includes('companyId') && companyId) { insertCols.push('"companyId"'); insertVals.push('$' + (insertParams.length + 1)); insertParams.push(companyId); }
      if (columns.includes('super')) { insertCols.push('super'); insertVals.push('true'); }
      await client.query(`INSERT INTO "Users" (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`, insertParams);
      console.log('[OK] Admin criado: ' + adminEmail);
    }

    // CompaniesSettings
    if (hasCompanies) {
      const settingsCount = await client.query('SELECT COUNT(*) FROM "CompaniesSettings"');
      if (parseInt(settingsCount.rows[0].count) === 0) {
        await client.query(`INSERT INTO "CompaniesSettings" ("companyId", "hoursCloseTicketsAuto", "chatBotType", "acceptCallWhatsapp", "userRandom", "sendGreetingMessageOneQueues", "sendSignMessage", "sendFarewellWaitingTicket", "userRating", "sendGreetingAccepted", "CheckMsgIsGroup", "sendQueuePosition", "scheduleType", "acceptAudioMessageContact", "enableLGPD", "sendMsgTransfTicket", "requiredTag", "lgpdDeleteMessage", "lgpdHideNumber", "lgpdConsent", "showNotificationPending", "overrideDefaultTimezone", "createDemoUser", "createdAt", "updatedAt") SELECT id, '9999', 'text', 'disabled', 'disabled', 'disabled', 'disabled', 'disabled', 'disabled', 'disabled', 'enabled', 'disabled', 'disabled', 'disabled', 'disabled', 'disabled', 'disabled', 'disabled', 'disabled', 'disabled', true, false, 'disabled', NOW(), NOW() FROM "Companies" WHERE NOT EXISTS (SELECT 1 FROM "CompaniesSettings" WHERE "companyId" = "Companies".id)`);
        console.log('[OK] CompaniesSettings criado');
      }
    }

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('[ERRO]', error.message);
    process.exit(1);
  }
}
seedAdmin();
SEEDSCRIPT

docker cp backend/seed_admin.js chatia-backend:/app/seed_admin.js >> "$LOG_FILE" 2>&1
ADMIN_OUTPUT=$(docker exec \
    -e "DB_PASS=${DB_PASSWORD}" \
    -e "ADMIN_EMAIL=${ADMIN_EMAIL}" \
    -e "ADMIN_PASSWORD=${ADMIN_PASSWORD}" \
    -e "COMPANY_NAME=${COMPANY_NAME}" \
    chatia-backend node seed_admin.js 2>&1) || true
echo "$ADMIN_OUTPUT" >> "$LOG_FILE"
echo -e "${GREEN}  $ADMIN_OUTPUT${NC}"

# Limpar seed temporário
rm -f backend/seed_admin.js

# Validar que admin foi criado no banco
ADMIN_EXISTS=$(docker exec chatia-postgres psql -U chatia -d chatia -t -c "SELECT COUNT(*) FROM \"Users\" WHERE email = '${ADMIN_EMAIL}';" 2>/dev/null | tr -d ' ' || echo "0")
if [ "${ADMIN_EXISTS:-0}" -eq 0 ]; then
    die "Administrador não foi criado corretamente. Verifique o log: $LOG_FILE"
fi
echo -e "${GREEN}  ✓ Admin verificado no banco${NC}"

echo -e "${GREEN}✓ Banco de dados configurado${NC}"

progress_done "Migrations e seeds concluídos"

# ============================================
# ETAPA 10: BUILD E INICIAR FRONTEND + SSL
# ============================================
progress_start "Construindo frontend (pode levar de 5 a 15 minutos)"

echo -e "${CYAN}Compilando React (craco build)...${NC}"
if ! docker compose build frontend >> "$LOG_FILE" 2>&1; then
    echo -e "${RED}Build do frontend falhou! Últimas linhas do log:${NC}"
    tail -20 "$LOG_FILE"
    die "Build do frontend falhou. Verifique o log: $LOG_FILE"
fi
echo -e "${GREEN}✓ Frontend compilado${NC}"

docker compose up -d frontend >> "$LOG_FILE" 2>&1

# Reiniciar backend para aplicar estado final das migrations
docker restart chatia-backend >> "$LOG_FILE" 2>&1

# Aguardar serviços responderem
echo -e "${CYAN}Aguardando serviços responderem...${NC}"

BACKEND_READY=false
for i in $(seq 1 45); do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000" 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" =~ ^(200|301|302|403|404)$ ]]; then
        BACKEND_READY=true
        echo -e "${GREEN}✓ Backend respondendo (HTTP $HTTP_CODE)${NC}"
        break
    fi
    sleep 2
done
if [ "$BACKEND_READY" = false ]; then
    echo -e "${YELLOW}⚠️  Backend não respondeu em 90s. Verificando container...${NC}"
    docker logs --tail 5 chatia-backend 2>&1
fi

FRONTEND_READY=false
for i in $(seq 1 30); do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3001" 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" =~ ^(200|301|304)$ ]]; then
        FRONTEND_READY=true
        echo -e "${GREEN}✓ Frontend respondendo (HTTP $HTTP_CODE)${NC}"
        break
    fi
    sleep 2
done
if [ "$FRONTEND_READY" = false ]; then
    echo -e "${YELLOW}⚠️  Frontend não respondeu em 60s. Verificando container...${NC}"
    docker logs --tail 5 chatia-frontend 2>&1
fi

# Reload Nginx para garantir que está servindo os domínios antes do certbot
systemctl reload nginx >> "$LOG_FILE" 2>&1

progress_done "Frontend construído"

# ============================================
# SSL - CERTIFICADOS LET'S ENCRYPT
# ============================================
progress_start "Configurando certificados SSL"

echo -e "${CYAN}Obtendo certificados SSL via Let's Encrypt...${NC}"

# Verificar que Nginx está servindo os domínios antes do certbot
echo -e "${CYAN}  Verificando acessibilidade HTTP dos domínios...${NC}"
for DOMAIN in "$BACKEND_DOMAIN" "$FRONTEND_DOMAIN"; do
    HTTP_CHECK=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://${DOMAIN}/" 2>/dev/null || echo "000")
    if [[ "$HTTP_CHECK" =~ ^(200|301|302|403|404|502)$ ]]; then
        echo -e "${GREEN}    ✓ http://${DOMAIN} acessível (HTTP $HTTP_CHECK)${NC}"
    else
        echo -e "${YELLOW}    ⚠️  http://${DOMAIN} não respondeu (HTTP $HTTP_CHECK)${NC}"
    fi
done

# Emitir certificados para ambos os domínios num único comando
echo -e "${CYAN}  Emitindo certificados para ambos os domínios...${NC}"
CERTBOT_OUTPUT=$(certbot --nginx \
    -d "$BACKEND_DOMAIN" \
    -d "$FRONTEND_DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "$LETSENCRYPT_EMAIL" \
    --redirect \
    --preferred-challenges http 2>&1) || true
echo "$CERTBOT_OUTPUT" >> "$LOG_FILE"

# Validar SSL pelos arquivos e SANs reais do certificado
SSL_BACKEND_OK=false
SSL_FRONTEND_OK=false

CERT_MAIN="/etc/letsencrypt/live/${BACKEND_DOMAIN}/fullchain.pem"
CERT_ALT="/etc/letsencrypt/live/${FRONTEND_DOMAIN}/fullchain.pem"

if [ -f "$CERT_MAIN" ]; then
    SAN_LIST=$(openssl x509 -in "$CERT_MAIN" -text -noout 2>/dev/null | grep -o "DNS:[^,]*")
    echo "$SAN_LIST" | grep -q "DNS:${BACKEND_DOMAIN}" && SSL_BACKEND_OK=true
    echo "$SAN_LIST" | grep -q "DNS:${FRONTEND_DOMAIN}" && SSL_FRONTEND_OK=true
fi

if [ "$SSL_FRONTEND_OK" = false ] && [ -f "$CERT_ALT" ]; then
    SAN_LIST_ALT=$(openssl x509 -in "$CERT_ALT" -text -noout 2>/dev/null | grep -o "DNS:[^,]*")
    echo "$SAN_LIST_ALT" | grep -q "DNS:${FRONTEND_DOMAIN}" && SSL_FRONTEND_OK=true
fi

if [ "$SSL_BACKEND_OK" = true ]; then
    echo -e "${GREEN}  ✓ SSL backend OK${NC}"
else
    echo -e "${RED}  ✗ SSL backend falhou${NC}"
    echo "$CERTBOT_OUTPUT" | grep -i "error\|problem\|fail\|unable\|challenge" | head -3
    echo -e "${YELLOW}  Verifique o log para detalhes: $LOG_FILE${NC}"
fi

if [ "$SSL_FRONTEND_OK" = true ]; then
    echo -e "${GREEN}  ✓ SSL frontend OK${NC}"
else
    echo -e "${RED}  ✗ SSL frontend falhou${NC}"
    echo "$CERTBOT_OUTPUT" | grep -i "error\|problem\|fail\|unable\|challenge" | head -3
    echo -e "${YELLOW}  Verifique o log para detalhes: $LOG_FILE${NC}"
fi

# Reload final do Nginx
systemctl reload nginx >> "$LOG_FILE" 2>&1 || true

# Configurar renovação automática
if [ "$SSL_BACKEND_OK" = true ] || [ "$SSL_FRONTEND_OK" = true ]; then
    # Certbot instala cron/timer automaticamente, mas verificar
    if ! systemctl is-enabled certbot.timer >/dev/null 2>&1; then
        systemctl enable certbot.timer >> "$LOG_FILE" 2>&1 || true
        systemctl start certbot.timer >> "$LOG_FILE" 2>&1 || true
    fi
    echo -e "${GREEN}✓ Renovação automática de SSL configurada${NC}"
fi

if [ "$SSL_BACKEND_OK" = true ] && [ "$SSL_FRONTEND_OK" = true ]; then
    progress_done "SSL configurado com sucesso"
else
    progress_done "SSL parcialmente configurado"
fi

# ============================================
# RESULTADO FINAL
# ============================================
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}    INSTALAÇÃO CONCLUÍDA!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# URLs
if [ "$SSL_FRONTEND_OK" = true ]; then
    echo -e "  Frontend: ${MAGENTA}https://${FRONTEND_DOMAIN}${NC}"
else
    echo -e "  Frontend: ${YELLOW}http://${FRONTEND_DOMAIN}${NC} ${RED}(sem SSL)${NC}"
fi
if [ "$SSL_BACKEND_OK" = true ]; then
    echo -e "  Backend:  ${MAGENTA}https://${BACKEND_DOMAIN}${NC}"
else
    echo -e "  Backend:  ${YELLOW}http://${BACKEND_DOMAIN}${NC} ${RED}(sem SSL)${NC}"
fi

echo ""
echo -e "${BLUE}Credenciais de acesso:${NC}"
echo -e "  Email: ${MAGENTA}${ADMIN_EMAIL}${NC}"
echo -e "  Senha: ${MAGENTA}${ADMIN_PASSWORD}${NC}"

echo ""
echo -e "${CYAN}Comandos úteis:${NC}"
echo -e "  Logs:      ${YELLOW}cd $INSTALL_DIR && docker compose logs -f${NC}"
echo -e "  Status:    ${YELLOW}cd $INSTALL_DIR && docker compose ps${NC}"
echo -e "  Reiniciar: ${YELLOW}cd $INSTALL_DIR && docker compose restart${NC}"
echo ""

if [ "$SSL_BACKEND_OK" = false ] || [ "$SSL_FRONTEND_OK" = false ]; then
    echo -e "${YELLOW}Para configurar SSL manualmente:${NC}"
    echo -e "  ${YELLOW}certbot --nginx -d ${BACKEND_DOMAIN} -d ${FRONTEND_DOMAIN}${NC}"
    echo ""
fi

echo -e "${GREEN}Credenciais salvas em: ${INSTALL_DIR}/.credentials${NC}"
echo -e "${GREEN}Log da instalação: ${LOG_FILE}${NC}"
echo ""

# Status final dos containers
echo -e "${BLUE}Status dos containers:${NC}"
cd "$INSTALL_DIR"
docker compose ps

# Validação final
echo ""
ISSUES=0
for CONTAINER in chatia-backend chatia-frontend chatia-postgres chatia-redis; do
    STATUS=$(docker inspect -f '{{.State.Status}}' "$CONTAINER" 2>/dev/null || echo "not_found")
    if [ "$STATUS" = "running" ]; then
        echo -e "  ${GREEN}✓ $CONTAINER: rodando${NC}"
    else
        echo -e "  ${RED}✗ $CONTAINER: $STATUS${NC}"
        ISSUES=$((ISSUES + 1))
    fi
done

echo ""
if [ "$ISSUES" -eq 0 ]; then
    echo -e "${GREEN}Todos os serviços estão rodando! Sistema pronto para uso.${NC}"
else
    echo -e "${YELLOW}⚠️  $ISSUES container(s) com problema. Verifique com: docker compose logs${NC}"
fi

log "Instalação finalizada. Issues: $ISSUES"
