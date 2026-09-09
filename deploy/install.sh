#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="shift-manager"
APP_USER="shift-manager"
APP_DIR="/opt/${APP_NAME}"
SERVICE_NAME="${APP_NAME}"

DOMAIN=""
EMAIL=""

usage() {
  cat <<'EOF'
Установка Shift Manager на Ubuntu/Debian:

  sudo bash deploy/install.sh --domain shifts.example.com --email admin@example.com

Параметры:
  --domain DOMAIN  Домен, который уже указывает A-записью на этот сервер
  --email EMAIL    Email для уведомлений Let's Encrypt
  --help           Показать эту справку
EOF
}

die() {
  echo "Ошибка: $*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      [[ $# -ge 2 ]] || die "для --domain нужно указать значение"
      DOMAIN="$2"
      shift 2
      ;;
    --email)
      [[ $# -ge 2 ]] || die "для --email нужно указать значение"
      EMAIL="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "неизвестный параметр: $1"
      ;;
  esac
done

[[ $EUID -eq 0 ]] || die "запустите скрипт через sudo или от root"
[[ -n "$DOMAIN" ]] || die "укажите домен: --domain example.com"
[[ -n "$EMAIL" ]] || die "укажите email: --email admin@example.com"
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || die "некорректное имя домена"
[[ "$EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || die "некорректный email"

if [[ ! -f /etc/os-release ]]; then
  die "не удалось определить операционную систему"
fi
# shellcheck disable=SC1091
source /etc/os-release
[[ "${ID:-}" == "ubuntu" || "${ID:-}" == "debian" ]] || \
  die "поддерживаются только Ubuntu и Debian"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
[[ -f "${SOURCE_DIR}/server.py" && -f "${SOURCE_DIR}/index.html" ]] || \
  die "запускайте скрипт из клонированного репозитория Shift Manager"

export DEBIAN_FRONTEND=noninteractive
echo "==> Установка системных пакетов"
apt-get update
apt-get install -y nginx python3 certbot python3-certbot-nginx rsync

echo "==> Создание системного пользователя"
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --home-dir "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
fi

echo "==> Копирование приложения в ${APP_DIR}"
install -d -o "${APP_USER}" -g "${APP_USER}" "${APP_DIR}" "${APP_DIR}/data"
rsync -a --delete \
  --exclude ".git/" \
  --exclude ".venv/" \
  --exclude "__pycache__/" \
  --exclude "data/" \
  "${SOURCE_DIR}/" "${APP_DIR}/"

if [[ -f "${SOURCE_DIR}/data/current.xlsx" && ! -f "${APP_DIR}/data/current.xlsx" ]]; then
  install -o "${APP_USER}" -g "${APP_USER}" -m 0640 \
    "${SOURCE_DIR}/data/current.xlsx" "${APP_DIR}/data/current.xlsx"
fi
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

echo "==> Настройка systemd"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Shift Manager web application
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=SHIFT_MANAGER_PORT=8080
ExecStart=/usr/bin/python3 ${APP_DIR}/server.py
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

echo "==> Настройка Nginx"
cat > "/etc/nginx/sites-available/${APP_NAME}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
ln -sfn "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"
rm -f /etc/nginx/sites-enabled/default
nginx -t

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}"
systemctl enable --now nginx
systemctl reload nginx

echo "==> Выпуск бесплатного SSL-сертификата Let's Encrypt"
certbot --nginx \
  --non-interactive \
  --agree-tos \
  --redirect \
  --email "${EMAIL}" \
  -d "${DOMAIN}"

systemctl enable --now certbot.timer
systemctl is-active --quiet "${SERVICE_NAME}" || {
  journalctl -u "${SERVICE_NAME}" --no-pager -n 50
  die "сервис не запустился"
}

echo
echo "Готово: https://${DOMAIN}"
echo "Статус приложения: systemctl status ${SERVICE_NAME}"
echo "Логи приложения:   journalctl -u ${SERVICE_NAME} -f"
echo "Обновление:        sudo bash deploy/install.sh --domain ${DOMAIN} --email ${EMAIL}"
