# С4 Shift Manager

> Красивое и простое расписание смен для команды С4 кибер-арены.

<img src="logo.png" alt="С4 Shift Manager" width="220" />

Веб-приложение показывает календарь смен, текущую смену и список сотрудников. Данные загружаются через Excel прямо из админки, а приложение работает без базы данных и без сложного backend-стека.

## Возможности

- календарь смен с переключением месяцев и дней;
- автоматическое определение текущей дневной или ночной смены;
- список сотрудников и ролей;
- светлая и тёмная тема;
- адаптивный интерфейс для телефона и компьютера;
- импорт и скачивание Excel-файла;
- админка с логином и паролем;
- сохранение загруженного файла на сервере;
- готовый production-деплой через Nginx, systemd и бесплатный Let's Encrypt SSL.

## Стек

- HTML, CSS и vanilla JavaScript;
- Python 3 (`http.server`);
- Excel `.xlsx` с чтением через SheetJS в браузере;
- Nginx как reverse proxy;
- systemd для автозапуска и перезапуска;
- Let's Encrypt для HTTPS.

## Быстрый запуск локально

Требуется Python 3.10+.

```bash
git clone https://github.com/sexforslutty/shift-manager.git
cd shift-manager
SHIFT_MANAGER_PORT=8080 python3 server.py
```

После этого откройте [http://127.0.0.1:8080](http://127.0.0.1:8080).

## Установка на сервер с HTTPS

Скрипт рассчитан на свежий Ubuntu/Debian-сервер с публичным IPv4-адресом.

### 1. Настройте DNS

Создайте у регистратора A-запись:

```text
shifts.example.com  ->  PUBLIC_SERVER_IP
```

Дождитесь обновления DNS. Домены `example.com` и `www.example.com` в командах ниже замените на свой домен.

### 2. Откройте порты

В firewall должны быть доступны TCP-порты `80` и `443`:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 3. Запустите установщик

```bash
git clone https://github.com/sexforslutty/shift-manager.git
cd shift-manager
sudo bash deploy/install.sh \
  --domain shifts.example.com \
  --email admin@example.com
```

Установщик автоматически:

1. установит Python, Nginx, Certbot и необходимые пакеты;
2. разместит приложение в `/opt/shift-manager`;
3. создаст отдельного системного пользователя;
4. настроит systemd и автозапуск после перезагрузки;
5. настроит Nginx на домен;
6. выпустит бесплатный SSL-сертификат Let's Encrypt;
7. включит автоматическое продление сертификата;
8. перенаправит HTTP на HTTPS.

После завершения сайт будет доступен по адресу `https://shifts.example.com`.

> Сертификат Let's Encrypt можно выпустить только после того, как домен указывает на сервер и порты 80/443 доступны из интернета.

## Управление на сервере

```bash
sudo systemctl status shift-manager
sudo systemctl restart shift-manager
sudo systemctl stop shift-manager
sudo journalctl -u shift-manager -f
sudo nginx -t
sudo systemctl reload nginx
```

Файл расписания хранится здесь:

```text
/opt/shift-manager/data/current.xlsx
```

## Обновление

```bash
cd shift-manager
git pull
sudo bash deploy/install.sh \
  --domain shifts.example.com \
  --email admin@example.com
```

Пользовательские данные в `data/current.xlsx` сохраняются при повторном запуске установщика.

## Формат Excel

Файл должен содержать листы:

- `Смены`: `Дата`, `Смена`, `Сотрудник`, `Роль`;
- `Команда`: `Сотрудник`, `Роль`.

Дата поддерживает формат `дд.мм.гггг`, например `09.09.2026`. Для смен используются значения вроде `День` и `Ночь`; ночная смена также определяется по времени `22:00`.

## Важное о безопасности

Админка предназначена для внутреннего использования. Перед публикацией смените стандартные учётные данные через интерфейс админки и используйте сложный пароль. Не передавайте сервер напрямую в интернет без Nginx и HTTPS.
