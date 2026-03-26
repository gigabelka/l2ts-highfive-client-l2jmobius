# L2 Headless Client for L2J_Mobius_CT_0_Interlude

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24.14.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.9.3-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Headless Lineage 2 клиент с **REST + WebSocket API** на TypeScript. Подключается к Login Server, аутентифицируется, выбирает персонажа и предоставляет API для управления и мониторинга.

Целевой сервер: [L2J_Mobius CT_0_Interlude](https://gitlab.com/MobiusDevelopment/L2J_Mobius) (Protocol 746).

---

## Быстрый старт

```bash
# Установка
npm install

# Настройка конфигурации
cp .env.example .env
# Отредактируй .env с вашими данными

# Запуск в режиме разработки
npm run dev

# Или сборка и запуск
npm run build
npm start
```

Открой дашборд: http://localhost:3000

---

## Конфигурация

Переменные окружения в `.env`:

```bash
L2_LOGIN_IP=192.168.0.33         # IP логин-сервера
L2_LOGIN_PORT=2106               # Порт логин-сервера
L2_GAME_PORT=7777                # Порт игрового сервера
L2_USERNAME=your_login           # Логин аккаунта
L2_PASSWORD=your_password        # Пароль
L2_SERVER_ID=2                   # ID сервера
L2_CHAR_SLOT=0                   # Слот персонажа
API_PORT=3000                    # Порт API
API_KEY=                         # API ключ (пусто = без авторизации)
LOG_LEVEL=ERROR                  # Уровень логирования
```

---

## API

### REST Endpoints

```bash
# Статус
GET  http://localhost:3000/api/v1/status

# Персонаж
GET  http://localhost:3000/api/v1/character
GET  http://localhost:3000/api/v1/character/stats
POST http://localhost:3000/api/v1/move/to             # { x, y, z }

# Бой
POST http://localhost:3000/api/v1/target/set          # { objectId }
POST http://localhost:3000/api/v1/combat/attack
POST http://localhost:3000/api/v1/combat/use-skill    # { skillId, level }

# Мир
GET  http://localhost:3000/api/v1/nearby/npcs
GET  http://localhost:3000/api/v1/nearby/items

# Чат
POST http://localhost:3000/api/v1/chat/send           # { channel, message }
```

### WebSocket Vision API

WebSocket Vision API — это "глаза" вашего персонажа. Он транслирует в реальном времени всё, что видит персонаж в игровом мире: других игроков, NPC, предметы на земле, сообщения чата, использование скиллов и многое другое.

**Как запустить:**

```bash
npm run dev  # WebSocket сервер стартует автоматически на порту 3000
```

Конфигурация в `.env`:

```bash
WS_ENABLED=true          # Включить WebSocket API
WS_PORT=3000             # Порт WebSocket сервера
WS_AUTH_ENABLED=false    # Включить авторизацию по токену
WS_AUTH_TOKENS=          # Список токенов через запятую
WS_MAX_CLIENTS=10        # Максимум клиентов
WS_BATCH_INTERVAL=50     # Интервал батчинга событий (мс)
WS_MOVE_THROTTLE_MS=100  # Троттлинг событий движения (мс)
```

**Как подключиться:**

С помощью wscat:

```bash
npm install -g wscat
wscat -c ws://localhost:3000
> {"type": "get.snapshot"}
```

На Node.js ([examples/ws-client-node.js](examples/ws-client-node.js)):

```bash
node examples/ws-client-node.js --host=localhost --port=3000 --channels='*'
```

На Python ([examples/ws-client-python.py](examples/ws-client-python.py)):

```bash
pip install websockets
python examples/ws-client-python.py --host=localhost --port=3000 --channels=me,chat,combat
```

**Доступные события:**

| Событие            | Описание                                                      |
| ------------------ | ------------------------------------------------------------- |
| `snapshot`         | Полный снимок состояния (me, players, npcs, items, inventory) |
| `me.update`        | Обновление данных персонажа (HP, MP, CP, опыт)                |
| `player.appear`    | Новый игрок в зоне видимости                                  |
| `player.update`    | Обновление данных игрока                                      |
| `npc.appear`       | Новый NPC/моб в зоне видимости                                |
| `npc.update`       | Обновление данных NPC                                         |
| `entity.move`      | Движение сущности с координатами                              |
| `entity.despawn`   | Исчезновение сущности                                         |
| `entity.die`       | Смерть сущности                                               |
| `entity.revive`    | Воскрешение сущности                                          |
| `status.update`    | Обновление HP/MP/CP                                           |
| `item.spawn`       | Появление предмета в мире                                     |
| `item.drop`        | Выпадение предмета                                            |
| `chat.message`     | Сообщение в чате                                              |
| `combat.skill.use` | Использование скилла                                          |
| `target.select`    | Выбор цели                                                    |
| `target.unselect`  | Снятие цели                                                   |
| `effects.update`   | Обновление баффов/дебаффов                                    |
| `inventory.full`   | Полное обновление инвентаря                                   |
| `skills.full`      | Список скиллов персонажа                                      |

**Каналы подписки:**

| Канал       | События                                             |
| ----------- | --------------------------------------------------- |
| `*`         | Все события                                         |
| `me`        | `me.update`, `me.sit`, `me.stand`                   |
| `players`   | `player.appear`, `player.update`                    |
| `npcs`      | `npc.appear`, `npc.update`                          |
| `items`     | `item.spawn`, `item.drop`                           |
| `movement`  | `entity.move`, `entity.despawn`                     |
| `combat`    | `combat.skill.use`, `entity.die`, `entity.revive`   |
| `chat`      | `chat.message`                                      |
| `target`    | `target.select`, `target.unselect`, `status.update` |
| `effects`   | `effects.update`                                    |
| `inventory` | `inventory.full`, `inventory.update`                |
| `skills`    | `skills.full`                                       |
| `party`     | `party.*` события                                   |

**HTTP эндпоинты (тот же порт 3000):**

```bash
# Полный снимок состояния
curl http://localhost:3000/api/v1/snapshot

# Данные персонажа
curl http://localhost:3000/api/v1/me

# Список игроков поблизости
curl http://localhost:3000/api/v1/players

# Список NPC поблизости
curl http://localhost:3000/api/v1/npcs

# Инвентарь
curl http://localhost:3000/api/v1/inventory

# Сообщения чата (последние 50)
curl http://localhost:3000/api/v1/chat

# Статистика сервера
curl http://localhost:3000/api/v1/stats

# Health check
curl http://localhost:3000/api/v1/health
```

**Примеры клиентов:**

- [examples/ws-client-node.js](examples/ws-client-node.js) — Node.js клиент с цветным выводом
- [examples/ws-client-python.py](examples/ws-client-python.py) — Python клиент с asyncio

---

## Команды

```bash
npm run dev              # Разработка
npm run debug            # Подробное логирование пакетов
npm run build            # Сборка
npm start                # Запуск
npm test                 # Тесты (168 тестов)
npm run test:watch       # Тесты в режиме наблюдения
npm run test:coverage    # Тесты с покрытием
npm run lint             # Линтинг
npm run export:data      # Экспорт данных из L2J
```

---

## Документация

- **[docs/DOCUMENTATION.md](docs/DOCUMENTATION.md)** — Полная техническая документация (API, архитектура, примеры)
- **[docs/client_server_protocol.md](docs/client_server_protocol.md)** — Спецификация протокола
- **[AGENTS.md](AGENTS.md)** — Руководство для AI-агентов

---

## Архитектура

```
src/
├── api/              # REST API + WebSocket
├── domain/           # Сущности, события, репозитории
├── application/      # Порты (интерфейсы)
├── infrastructure/   # Реализации (DB, EventBus, протокол)
├── network/          # TCP соединение
├── crypto/           # Blowfish, RSA, XOR
├── login/            # Login Server клиент
└── game/             # Game Server клиент
```

Clean Architecture + Dependency Injection + Result<T,E>.

---

## Лицензия

MIT — см. [LICENSE](LICENSE)
