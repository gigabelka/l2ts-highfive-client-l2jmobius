# L2 Headless Client — Developer Documentation

> **Проект:** `l2ts-interlude-client-l2jmobius`  
> **Версия:** `0.4.9`  
> **API Version:** `v1.0.0`  
> **Стек:** TypeScript 5.9.3 / Node.js 24.14.0+ · L2J_Mobius CT_0_Interlude  
> **Архитектура:** Clean Architecture + Dependency Injection  
> **Дата обновления:** 2026-03-20 (Final Verification ✅)
> 
> **Финальная проверка:**
> - ✅ TypeScript компиляция — ошибок нет
> - ✅ Циклические зависимости — не обнаружены
> - ✅ Тесты — 168 тестов проходят
> - ✅ Сборка — успешна
> - ✅ Graceful shutdown — реализован

---

## Overview

Headless Lineage 2 client для **L2J Mobius CT_0_Interlude** серверов. Подключается через TCP, аутентифицируется через Login Server, выбирает персонажа на Game Server и входит в игровой мир с keepalive (ping/pong).

**Target server:** L2J_Mobius CT_0_Interlude (https://gitlab.com/MobiusDevelopment/L2J_Mobius)  
**Protocol version:** 746 (Interlude)  
**Reference client:** https://github.com/npetrovski/l2js-client  
**Node.js:** LTS 24.14.0

---

## Architecture

```
src/
├── index.ts                    Entry point with DI container bootstrap
├── config.ts                   Environment configuration (Zod validation)
├── config/di/                  # Dependency Injection container
│   ├── Container.ts            DI container with Result<T,E> monad
│   ├── appContainer.ts         Singleton container instance
│   └── composition.ts          Service registration
├── api/                        # REST API Layer
│   ├── ApiServer.ts            Express REST API server
│   ├── ws/WsServer.ts          WebSocket server
│   ├── middleware/             Auth, rate limiting, request ID
│   └── routes/                 API endpoints
├── domain/                     # Domain Layer (Clean Architecture)
│   ├── entities/               Character, Npc, Item
│   ├── value-objects/          Position, Vitals, Stats, Experience
│   ├── events/                 Domain events (typed)
│   └── repositories/           Repository interfaces
├── application/                # Application Layer
│   └── ports/                  Interfaces (IEventBus, IPacketProcessor, etc.)
├── infrastructure/             # Infrastructure Layer
│   ├── persistence/            In-memory repository implementations
│   ├── event-bus/              SimpleEventBus, SystemEventBus
│   ├── cache/                  InMemoryCacheManager
│   ├── network/                PacketSerializer, BufferPool
│   └── protocol/game/          Packet processing (Factory + Strategy)
│       ├── packets/            DTOs for incoming packets
│       ├── handlers/           Strategy handlers
│       ├── PacketRegistry.ts   Centralized registration
│       ├── PacketDecoder.ts    Decoding logic
│       ├── GamePacketProcessor.ts
│       └── GameIncomingPacketFactory.ts
├── network/                    # TCP & Packet Layer
│   ├── Connection.ts           TCP client with L2 framing
│   ├── PacketReader.ts         Binary reader (little-endian)
│   └── PacketWriter.ts         Binary writer (little-endian)
├── crypto/                     # Encryption Layer
│   ├── BlowfishEngine.ts       Blowfish ECB implementation
│   ├── RSACrypt.ts             RSA (1024-bit, NO_PADDING)
│   ├── NewCrypt.ts             Blowfish + checksum + XOR wrapper
│   └── ScrambledRSAKey.ts      RSA modulus unscrambling
├── login/                      # Login Server Phase
│   ├── LoginClient.ts          FSM-driven login client
│   ├── LoginCrypt.ts           Login crypto (Blowfish + XOR)
│   ├── packets/incoming/       Incoming packet DTOs
│   ├── packets/outgoing/       Outgoing packet builders
│   ├── protocol/handlers/      Login packet handlers
│   ├── protocol/LoginPacketProcessor.ts
│   └── session/SessionManager.ts
├── game/                       # Game Server Phase
│   ├── GameClient.ts           FSM-driven game client
│   ├── GameCrypt.ts            XOR encryption (disabled for CT0)
│   ├── GameCommandManager.ts   Command manager singleton
│   ├── GameState.ts            Game state definitions
│   └── packets/outgoing/       Outgoing game packets
├── data/                       # Game data
│   ├── ItemDatabase.ts
│   ├── NpcDatabase.ts
│   ├── SkillDatabase.ts
│   └── export/                 Exported JSON data
├── services/                   # Application services
│   └── GameDataService.ts
├── shared/                     # Shared utilities
│   ├── result/Result.ts        Result<T,E> monad
│   ├── types/                  Primitive types, utility types
│   └── utils/                  BufferUtils, TimeUtils, TypeGuards
├── logger/                     # Logging utilities
│   └── Logger.ts
└── ui/                         # Dashboard UI
    └── Dashboard.ts
```

---

## API Layer (REST + WebSocket)

Клиент предоставляет **Hybrid API** (REST + WebSocket) для внешнего управления и мониторинга.

**ВАЖНО:** API Server запускается независимо от игрового клиента. Dashboard и API доступны даже когда нет подключения к игровому серверу.

### Base URLs

```
Dashboard:  http://localhost:3000/
REST API:   http://localhost:3000/api/v1
WebSocket:  ws://localhost:3000/ws
Health:     http://localhost:3000/health
API Docs:   http://localhost:3000/api-docs
```

### Running API Without Game Connection

Для запуска только API сервера без подключения к игровому серверу:

```bash
# Windows PowerShell
$env:AUTO_CONNECT_GAME='false'; npm start

# Linux/macOS
AUTO_CONNECT_GAME=false npm start
```

Полезно для разработки dashboard или когда игровой сервер недоступен.

### Authentication

Аутентификация контролируется через `API_CONFIG.apiKey` в `config.ts`:
- Если `apiKey` пустая строка (`''`): Аутентификация не требуется
- Если `apiKey` задан: Все запросы должны включать Bearer token

```http
Authorization: Bearer your_api_key_here
```

Для WebSocket токен передаётся в query string:
```
ws://localhost:3000/ws?token=your_api_key_here
```

### Rate Limiting

| Группа эндпоинтов | Лимит |
|---|---|
| Команды движения | 10 req/s |
| Боевые команды | 5 req/s |
| Читаемые данные (GET) | 60 req/s |
| Общий лимит | 100 req/s |

При превышении — `429 Too Many Requests` с заголовком `Retry-After: <seconds>`.

---

## REST API Endpoints

### 4.1 Управление клиентом

#### `GET /api/v1/status`

Возвращает текущее состояние подключения клиента к игровому серверу.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "phase": "IN_GAME",
    "loginServer": {
      "connected": true,
      "host": "127.0.0.1",
      "port": 2106
    },
    "gameServer": {
      "connected": true,
      "host": "127.0.0.1",
      "port": 7777
    },
    "uptime": 3620,
    "pingMs": 14
  }
}
```

**Возможные значения `phase`:**
- `DISCONNECTED` — нет соединений
- `LOGIN_CONNECTING` — подключение к Login Server
- `LOGIN_AUTHENTICATING` — процесс RSA/Blowfish handshake
- `SELECTING_CHARACTER` — выбор персонажа
- `ENTERING_GAME` — вход в игровой мир
- `IN_GAME` — активная игровая сессия

---

#### `POST /api/v1/connect`

Инициирует подключение к серверу. Использует учётные данные из `src/config.ts`.

**Тело запроса:**
```json
{
  "overrideConfig": {
    "host": "192.168.1.100",
    "loginPort": 2106,
    "login": "myaccount",
    "password": "secret",
    "characterSlot": 0
  }
}
```
> `overrideConfig` — необязательный. Если не указан, используется `src/config.ts`.

**Ответ `202 Accepted`:**
```json
{
  "success": true,
  "data": {
    "message": "Connection initiated",
    "phase": "LOGIN_CONNECTING"
  }
}
```

---

#### `POST /api/v1/disconnect`

Корректно разрывает соединение с игровым сервером (отправляет logout пакет).

**Ответ:**
```json
{
  "success": true,
  "data": {
    "message": "Disconnected gracefully"
  }
}
```

---

#### `POST /api/v1/reconnect`

Переподключение с текущей конфигурацией. Полезно при дропе соединения.

**Тело запроса:**
```json
{
  "delayMs": 3000
}
```

---

### 4.2 Персонаж

#### `GET /api/v1/character`

Полный срез состояния текущего персонажа.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "objectId": 268500123,
    "name": "MyCharacter",
    "title": "Warrior",
    "classId": 1,
    "className": "Human Fighter",
    "level": 40,
    "race": "Human",
    "sex": "Male",
    "hp": { "current": 1200, "max": 1500 },
    "mp": { "current": 350, "max": 400 },
    "cp": { "current": 0, "max": 0 },
    "exp": 4500000,
    "expPercent": 62.3,
    "sp": 12000,
    "karma": 0,
    "pvpKills": 5,
    "pkKills": 0,
    "position": {
      "x": 82928,
      "y": 53600,
      "z": -1490,
      "heading": 32768
    },
    "stats": {
      "str": 45,
      "con": 43,
      "dex": 30,
      "int": 21,
      "wit": 20,
      "men": 21,
      "pAtk": 320,
      "mAtk": 58,
      "pDef": 245,
      "mDef": 130,
      "atkSpd": 330,
      "castSpd": 333,
      "accuracy": 8,
      "evasion": 8,
      "critical": 4,
      "speed": 130
    },
    "buffs": [
      {
        "skillId": 1204,
        "name": "Berserker Spirit",
        "level": 2,
        "remainingTime": 1180
      }
    ],
    "target": {
      "objectId": 268701234,
      "name": "Wolf",
      "type": "NPC"
    }
  }
}
```

---

#### `GET /api/v1/character/stats`

Только боевые характеристики (облегчённый запрос).

---

#### `GET /api/v1/character/buffs`

Список активных баффов и дебаффов.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "buffs": [
      {
        "skillId": 1204,
        "name": "Berserker Spirit",
        "level": 2,
        "remainingTime": 1180,
        "isDebuff": false,
        "icon": "icon.skill1204"
      }
    ],
    "debuffs": [
      {
        "skillId": 4082,
        "name": "Poison",
        "level": 1,
        "remainingTime": 15,
        "isDebuff": true
      }
    ]
  }
}
```

---

### 4.3 Инвентарь

#### `GET /api/v1/inventory`

Возвращает весь инвентарь персонажа.

**Query параметры:**
| Параметр | Тип | Описание |
|---|---|---|
| `type` | string | Фильтр по типу: `weapon`, `armor`, `consumable`, `material`, `quest`, `etc` |
| `equipped` | boolean | `true` — только надетые предметы |

**Ответ:**
```json
{
  "success": true,
  "data": {
    "adena": 125000,
    "weight": { "current": 8500, "max": 42000 },
    "items": [
      {
        "objectId": 268801000,
        "itemId": 57,
        "name": "Adena",
        "count": 125000,
        "type": "etc",
        "equipped": false,
        "slot": -1,
        "enchant": 0,
        "mana": -1
      },
      {
        "objectId": 268801001,
        "itemId": 49,
        "name": "Sword of Solidarity",
        "count": 1,
        "type": "weapon",
        "equipped": true,
        "slot": 6,
        "enchant": 3,
        "mana": -1,
        "grade": "D"
      }
    ]
  }
}
```

---

#### `POST /api/v1/inventory/use`

Использовать предмет из инвентаря (зелье, свиток и т.д.).

**Тело запроса:**
```json
{
  "objectId": 268801050
}
```

---

#### `POST /api/v1/inventory/drop`

Выбросить предмет на землю.

**Тело запроса:**
```json
{
  "objectId": 268801050,
  "count": 1,
  "position": {
    "x": 82928,
    "y": 53600,
    "z": -1490
  }
}
```

---

### 4.4 Цели и бой

#### `GET /api/v1/target`

Текущая цель персонажа.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "objectId": 268701234,
    "name": "Werewolf",
    "type": "NPC",
    "npcId": 20058,
    "level": 38,
    "hp": { "current": 800, "max": 1200 },
    "isAttackable": true,
    "isAggressive": false,
    "position": {
      "x": 82948,
      "y": 53610,
      "z": -1490
    }
  }
}
```

---

#### `POST /api/v1/target/set`

Установить цель по objectId.

**Тело запроса:**
```json
{
  "objectId": 268701234
}
```

---

#### `POST /api/v1/target/clear`

Снять текущую цель.

---

#### `POST /api/v1/target/next`

Переключиться на следующую ближайшую NPC цель. Только выбирает цель, не атакует.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "objectId": 268475143,
    "name": "Gremlin",
    "level": 1,
    "npcId": 18337,
    "distance": 5.2,
    "hp": { "current": 100, "max": 100, "percent": 100 },
    "isAttackable": true,
    "isAggressive": false
  }
}
```

---

#### `POST /api/v1/target/next-attack`

Переключиться на следующую ближайшую NPC цель и сразу атаковать её.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "objectId": 268475143,
    "name": "Gremlin",
    "level": 1,
    "npcId": 18337,
    "distance": 5.2,
    "hp": { "current": 100, "max": 100, "percent": 100 },
    "isAttackable": true,
    "isAggressive": false,
    "actionSent": true,
    "attackSent": true
  }
}
```

---

#### `POST /api/v1/combat/attack`

Атаковать текущую или указанную цель.

**Тело запроса:**
```json
{
  "objectId": 268701234
}
```

---

#### `POST /api/v1/combat/stop`

Остановить авто-атаку.

---

#### `GET /api/v1/nearby/npcs`

Список NPC/мобов в радиусе видимости.

**Query параметры:**
| Параметр | Тип | Описание |
|---|---|---|
| `radius` | number | Радиус поиска (по умолчанию 600, макс 2000) |
| `attackable` | boolean | Только атакуемые |
| `alive` | boolean | Только живые (по умолчанию `true`) |

**Ответ:**
```json
{
  "success": true,
  "data": {
    "count": 3,
    "npcs": [
      {
        "objectId": 268701234,
        "npcId": 20058,
        "name": "Werewolf",
        "level": 38,
        "hp": { "current": 1200, "max": 1200 },
        "isAttackable": true,
        "isAggressive": false,
        "distance": 145,
        "position": { "x": 82948, "y": 53610, "z": -1490 }
      }
    ]
  }
}
```

---

#### `GET /api/v1/nearby/players`

Список игроков в радиусе видимости.

---

#### `GET /api/v1/nearby/items`

Предметы на земле в радиусе видимости.

---

#### `POST /api/v1/pickup`

Подобрать предмет с земли.

**Тело запроса:**
```json
{
  "objectId": 268900001
}
```

---

### 4.5 Движение

#### `POST /api/v1/move/to`

Отправить персонажа к координатам.

**Тело запроса:**
```json
{
  "x": 83500,
  "y": 54000,
  "z": -1490,
  "validateRange": true
}
```

> `validateRange: true` — вернёт ошибку, если точка слишком далеко (>50 000 ед.) от текущей позиции.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "message": "Move command sent",
    "destination": { "x": 83500, "y": 54000, "z": -1490 },
    "estimatedTimeMs": 4200
  }
}
```

---

#### `POST /api/v1/move/stop`

Остановить движение.

---

#### `GET /api/v1/move/status`

Текущее состояние движения.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "isMoving": true,
    "destination": { "x": 83500, "y": 54000, "z": -1490 },
    "speed": 130
  }
}
```

---

#### `POST /api/v1/move/follow`

Следовать за объектом (персонаж/NPC).

**Тело запроса:**
```json
{
  "objectId": 268500456,
  "minDistance": 80
}
```

---

### 4.6 Чат

#### `POST /api/v1/chat/send`

Отправить сообщение в чат.

**Тело запроса:**
```json
{
  "channel": "ALL",
  "message": "Hello World!"
}
```

**Возможные значения `channel`:**
| Значение | Описание |
|---|---|
| `ALL` | Общий чат |
| `SHOUT` | Крик (`!message`) |
| `TELL` | Личное сообщение |
| `PARTY` | Чат группы |
| `CLAN` | Чат клана |
| `TRADE` | Торговый чат (`+message`) |
| `HERO` | Геройский чат (`@message`) |

Для `TELL` дополнительно требуется `"target": "PlayerName"`.

---

#### `GET /api/v1/chat/history`

История принятых сообщений (хранится в памяти, последние 500 сообщений).

**Query параметры:**
| Параметр | Тип | Описание |
|---|---|---|
| `channel` | string | Фильтр по каналу |
| `limit` | number | Кол-во записей (макс. 100, по умолчанию 50) |
| `since` | ISO timestamp | Сообщения начиная с этой даты |

---

### 4.7 Умения (Skills)

#### `GET /api/v1/skills`

Список всех умений персонажа.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "skills": [
      {
        "skillId": 3,
        "name": "Combat Stance",
        "level": 5,
        "isActive": true,
        "isPassive": false,
        "isToggle": false,
        "cooldownMs": 0,
        "mpCost": 12,
        "castTimeMs": 1080,
        "range": 40,
        "reuseDelayMs": 4000,
        "isReady": true
      }
    ]
  }
}
```

---

#### `POST /api/v1/skills/use`

Применить умение.

**Тело запроса:**
```json
{
  "skillId": 3,
  "level": 5,
  "targetObjectId": 268701234,
  "ctrlPressed": false,
  "shiftPressed": false
}
```

> `ctrlPressed: true` — принудительная атака игрока (PvP).

---

#### `GET /api/v1/skills/shortcuts`

Список умений, назначенных на хоткеи.

---

### 4.8 Пати и социальное

#### `GET /api/v1/party`

Информация о текущей группе.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "inParty": true,
    "isLeader": false,
    "members": [
      {
        "objectId": 268500456,
        "name": "Healer",
        "classId": 49,
        "level": 42,
        "hp": { "current": 900, "max": 1100 },
        "mp": { "current": 500, "max": 600 },
        "cp": { "current": 0, "max": 0 },
        "isOnline": true
      }
    ]
  }
}
```

---

#### `POST /api/v1/party/invite`

Пригласить игрока в группу.

```json
{ "playerName": "PlayerName" }
```

---

#### `POST /api/v1/party/leave`

Покинуть текущую группу.

---

#### `POST /api/v1/social/action`

Выполнить социальное действие (анимацию).

**Тело запроса:**
```json
{ "actionId": 2 }
```

---

#### `GET /api/v1/social/actions`

Список доступных социальных действий.

---

## WebSocket Vision API (Port 3001)

Standalone WebSocket сервер для трансляции GameState в реальном времени с оптимизациями производительности.

### Конфигурация

```typescript
export const WS_CONFIG = {
    enabled: true,           // WS_ENABLED env
    port: 3001,              // WS_PORT env
    authEnabled: false,      // WS_AUTH_ENABLED env
    authTokens: [],          // WS_AUTH_TOKENS env (comma-separated)
    maxClients: 10,          // WS_MAX_CLIENTS env
    batchInterval: 50,       // WS_BATCH_INTERVAL env (ms, 0 = disabled)
    moveThrottleMs: 100,     // WS_MOVE_THROTTLE_MS env
};
```

### HTTP Endpoints (порт 3001)

| Эндпоинт | Метод | Описание |
|----------|-------|----------|
| `/api/v1/snapshot` | GET | Полный снимок GameState |
| `/api/v1/me` | GET | Данные персонажа |
| `/api/v1/players` | GET | Список видимых игроков |
| `/api/v1/npcs` | GET | Список видимых NPC |
| `/api/v1/inventory` | GET | Инвентарь |
| `/api/v1/chat` | GET | Последние 50 сообщений чата |
| `/api/v1/stats` | GET | Статистика WS-сервера |
| `/api/v1/health` | GET | Health check |

### WebSocket Команды

| Команда | Ответ | Описание |
|---------|-------|----------|
| `subscribe` | `subscribed` | Подписка на каналы |
| `unsubscribe` | `unsubscribed` | Отписка от каналов |
| `get.snapshot` | `snapshot` | Полный снапшот состояния |
| `get.me` | `me` | Данные персонажа |
| `get.players` | `players` | Список игроков |
| `get.npcs` | `npcs` | Список NPC |
| `get.inventory` | `inventory` | Инвентарь |
| `get.party` | `party` | Члены группы |
| `get.effects` | `effects` | Баффы/дебаффы |
| `get.skills` | `skills` | Скиллы |
| `ping` | `pong` | Проверка связи |

### Каналы подписки

| Канал | События |
|-------|---------|
| `*` | Все события |
| `me` | `me.update`, `me.sit`, `me.stand` |
| `players` | `player.appear`, `player.update` |
| `npcs` | `npc.appear`, `npc.update` |
| `items` | `item.spawn`, `item.drop` |
| `movement` | `entity.move`, `entity.despawn` |
| `combat` | `combat.skill.use`, `entity.die`, `entity.revive` |
| `chat` | `chat.message` |
| `target` | `target.select`, `target.unselect`, `status.update` |
| `effects` | `effects.update` |
| `inventory` | `inventory.full`, `inventory.update` |
| `skills` | `skills.full` |
| `party` | `party.*` |

### Оптимизации

1. **Throttling для `entity.move`** — события движения для каждого `objectId` отправляются не чаще 1 раза в `moveThrottleMs` (по умолчанию 100ms)
2. **Batching событий** — если `batchInterval > 0`, события накапливаются и отправляются пачкой
3. **Метрики** — eventsPerSecond, droppedMoveEvents, totalEventsSent

### Примеры клиентов

**Node.js** (`examples/ws-client-node.js`):
```bash
node examples/ws-client-node.js --host=localhost --port=3001 --channels='me,chat,combat'
```

**Python** (`examples/ws-client-python.py`):
```bash
python examples/ws-client-python.py --host=localhost --port=3001 --channels=me,chat,combat
```

---

## WebSocket API (Port 3000)

### Подключение

```javascript
const ws = new WebSocket('ws://localhost:3000/ws?token=YOUR_API_KEY');

ws.onopen = () => {
  // Подписаться на группы событий
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['character', 'combat', 'chat', 'world']
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(msg.type, msg.data);
};
```

### Формат сообщений WebSocket

**Входящее (сервер → клиент):**
```json
{
  "type": "EVENT_TYPE",
  "channel": "combat",
  "data": { ... },
  "timestamp": "2025-03-14T12:00:00.000Z"
}
```

**Исходящее (клиент → сервер):**
```json
{
  "type": "subscribe" | "unsubscribe" | "ping",
  "channels": ["combat", "chat"]
}
```

### Каналы подписки

| Канал | Описание |
|---|---|
| `system` | Статус подключения, ошибки |
| `character` | Изменения HP/MP/CP, баффы, XP |
| `combat` | Атаки, дамаг, смерть |
| `chat` | Входящие сообщения чата |
| `world` | NPC появление/исчезновение, предметы |
| `movement` | Изменение позиции персонажа |
| `party` | События группы |

---

### Системные события

#### `system.connected`
```json
{
  "type": "system.connected",
  "channel": "system",
  "data": {
    "phase": "IN_GAME",
    "characterName": "MyCharacter",
    "serverId": 1
  }
}
```

#### `system.disconnected`
```json
{
  "type": "system.disconnected",
  "channel": "system",
  "data": {
    "reason": "Connection lost",
    "phase": "DISCONNECTED",
    "willReconnect": true,
    "reconnectIn": 5000
  }
}
```

#### `system.error`
```json
{
  "type": "system.error",
  "channel": "system",
  "data": {
    "code": "LOGIN_FAILED",
    "message": "Invalid credentials"
  }
}
```

---

### События персонажа

#### `character.stats_changed`

Срабатывает при изменении HP, MP, CP, XP или характеристик.

```json
{
  "type": "character.stats_changed",
  "channel": "character",
  "data": {
    "hp": { "current": 1100, "max": 1500, "delta": -100 },
    "mp": { "current": 340, "max": 400, "delta": -10 },
    "cp": { "current": 0, "max": 0, "delta": 0 }
  }
}
```

#### `character.level_up`
```json
{
  "type": "character.level_up",
  "channel": "character",
  "data": {
    "newLevel": 41,
    "oldLevel": 40,
    "sp": 15000
  }
}
```

#### `character.buff_added`
```json
{
  "type": "character.buff_added",
  "channel": "character",
  "data": {
    "skillId": 1204,
    "name": "Berserker Spirit",
    "level": 2,
    "duration": 1200,
    "isDebuff": false
  }
}
```

#### `character.buff_removed`
```json
{
  "type": "character.buff_removed",
  "channel": "character",
  "data": {
    "skillId": 1204,
    "name": "Berserker Spirit"
  }
}
```

#### `character.died`
```json
{
  "type": "character.died",
  "channel": "character",
  "data": {
    "killerObjectId": 268701234,
    "killerName": "Werewolf",
    "position": { "x": 82928, "y": 53600, "z": -1490 }
  }
}
```

#### `character.revived`
```json
{
  "type": "character.revived",
  "channel": "character",
  "data": {
    "position": { "x": 82700, "y": 53200, "z": -1490 },
    "hp": 375,
    "mp": 100
  }
}
```

---

### Боевые события

#### `combat.attack_sent`

Персонаж атаковал цель.

```json
{
  "type": "combat.attack_sent",
  "channel": "combat",
  "data": {
    "attackerObjectId": 268500123,
    "targetObjectId": 268701234,
    "damage": 145,
    "isCritical": false,
    "isMiss": false,
    "attackType": "MELEE"
  }
}
```

#### `combat.attack_received`

Персонаж получил урон.

```json
{
  "type": "combat.attack_received",
  "channel": "combat",
  "data": {
    "attackerObjectId": 268701234,
    "attackerName": "Werewolf",
    "damage": 87,
    "isCritical": true,
    "newHp": 1013,
    "newMp": 340
  }
}
```

#### `combat.skill_used`

Применено умение (своё или чужое).

```json
{
  "type": "combat.skill_used",
  "channel": "combat",
  "data": {
    "casterObjectId": 268500123,
    "targetObjectId": 268701234,
    "skillId": 3,
    "skillName": "Combat Stance",
    "skillLevel": 5,
    "isSuccessful": true
  }
}
```

#### `combat.target_died`

Цель убита.

```json
{
  "type": "combat.target_died",
  "channel": "combat",
  "data": {
    "objectId": 268701234,
    "name": "Werewolf",
    "npcId": 20058,
    "position": { "x": 82948, "y": 53610, "z": -1490 }
  }
}
```

---

### Чат-события

#### `chat.message`
```json
{
  "type": "chat.message",
  "channel": "chat",
  "data": {
    "channel": "ALL",
    "senderName": "SomePlayer",
    "senderObjectId": 268600789,
    "message": "WTS Sword of Solidarity +5!",
    "receivedAt": "2025-03-14T12:05:00.000Z"
  }
}
```

#### `chat.system_message`

Системные сообщения от сервера (красные надписи).

```json
{
  "type": "chat.system_message",
  "channel": "chat",
  "data": {
    "messageId": 614,
    "messageText": "You have acquired 345 adena.",
    "params": ["345"]
  }
}
```

---

### Мировые события

#### `world.npc_spawned`
```json
{
  "type": "world.npc_spawned",
  "channel": "world",
  "data": {
    "objectId": 268701500,
    "npcId": 20058,
    "name": "Werewolf",
    "level": 38,
    "position": { "x": 83100, "y": 53800, "z": -1490 },
    "isAttackable": true
  }
}
```

#### `world.npc_despawned`
```json
{
  "type": "world.npc_despawned",
  "channel": "world",
  "data": {
    "objectId": 268701500
  }
}
```

#### `world.item_dropped`
```json
{
  "type": "world.item_dropped",
  "channel": "world",
  "data": {
    "objectId": 268900100,
    "itemId": 57,
    "name": "Adena",
    "count": 1240,
    "position": { "x": 82960, "y": 53615, "z": -1490 }
  }
}
```

#### `world.item_picked_up`
```json
{
  "type": "world.item_picked_up",
  "channel": "world",
  "data": {
    "objectId": 268900100,
    "pickedByObjectId": 268500123
  }
}
```

#### `movement.position_changed`
```json
{
  "type": "movement.position_changed",
  "channel": "movement",
  "data": {
    "objectId": 268500123,
    "position": { "x": 83100, "y": 53700, "z": -1490, "heading": 28000 },
    "speed": 130,
    "isRunning": true
  }
}
```

---

## Dashboard

### Концепция: "L2 Bot Dashboard"

**Специализированный игровой dashboard**, который:

- Показывает real-time состояние игры (HP/MP, позиция, цель)
- Визуализирует WebSocket события в live-режиме
- Документирует API (Scalar / OpenAPI)
- Позволяет тестировать эндпоинты (Try It Out)

### Архитектура Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Dashboard (порт 3000)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ API Docs    │  │ Live Status │  │ WebSocket Monitor   │  │
│  │ (Scalar)    │  │ (HP/MP/Pos) │  │ (Events Log)        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ API Tester  │  │ Inventory   │  │ Combat Controls     │  │
│  │ (Try It)    │  │ (Visual)    │  │ (Quick Actions)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Express Server (src/api/ApiServer.ts)             │
│  GET  /                ──▶  Dashboard SPA (static)          │
│  GET  /api-docs        ──▶  Scalar UI (static page)         │
│  GET  /openapi.json    ──▶  OpenAPI spec (static file)      │
│  ANY  /api/v1/*        ──▶  REST endpoints                  │
│  GET  /ws              ──▶  WebSocket upgrade               │
└─────────────────────────────────────────────────────────────┘
```

### Технологический стек

| Компонент     | Технология                   | Версия (CDN)               | Обоснование                   |
| ------------- | ---------------------------- | -------------------------- | ----------------------------- |
| **UI**        | Vanilla JS + Custom Elements | —                          | Нет зависимостей от React/Vue |
| **CSS**       | Pico.css                     | **2.0.6** (зафиксирован!)  | Семантический, нет классов    |
| **API Docs**  | Scalar                       | **latest** (CDN)           | Современная замена Swagger UI |
| **Icons**     | Lucide                       | **0.383.0**                | Легкие SVG иконки             |
| **Charts**    | Chart.js                     | **4.4.3**                  | Графики HP/MP/XP              |
| **Real-time** | Native WebSocket             | —                          | Прямое подключение к `/ws`    |
| **Security**  | helmet + cors                | npm                        | CSP, CORS для dev-режима      |

### Структура файлов

```
public/                        # Статика (не src/dashboard/!)
├── index.html                 # SPA точка входа
├── api-docs.html              # Scalar UI
├── openapi.json               # OpenAPI спецификация
├── css/
│   └── dashboard.css
└── js/
    ├── app.js                 # Инициализация + роутинг вкладок
    ├── api-client.js          # REST клиент
    ├── ws-client.js           # WebSocket клиент (с reconnect)
    ├── components/
    │   ├── status-panel.js    # HP/MP/XP + позиция
    │   ├── event-log.js       # WS лог событий
    │   ├── combat-controls.js # Быстрые действия
    │   └── inventory-grid.js  # Инвентарь
    └── utils/
        └── formatters.js      # hp%, время, числа L2
```

### Запуск Dashboard

```bash
# 1. Установить зависимости
npm install

# 2. Запустить сервер
npm run dev

# 3. Открыть дашборд
open http://localhost:3000

# 4. Открыть API docs
open http://localhost:3000/api-docs
```

---

## Connection Flow

### Phase 1: Login Server (LoginClient)

```
Client                          Login Server
  |--- TCP connect ------------->|
  |<---- Init (0x00) -----------|  (static Blowfish + rolling XOR encrypted)
  |                              |  Contains: sessionId, scrambled RSA key, Blowfish key
  |--- RequestGGAuth (0x07) --->|
  |<---- GGAuth (0x0B) ---------|  Contains: ggAuthResponse
  |--- RequestAuthLogin (0x00)->|  RSA-encrypted credentials + ggAuthResponse
  |<---- LoginOk (0x03) --------|  Contains: loginOkId1, loginOkId2
  |--- RequestServerList (0x05)->|
  |<---- ServerList (0x04) -----|  Contains: server IPs, ports, status
  |--- RequestServerLogin (0x02)->|
  |<---- PlayOk (0x07) ---------|  Contains: playOkId1, playOkId2
  |--- disconnect -------------->|
```

**Crypto:** Init packet uses static Blowfish key `6B 60 CB 5B 82 CE 90 B1 CC 2B 6C 55 6C 6C 6C 6C`. After Init, all packets use the dynamic Blowfish key from the Init packet. Outgoing packets get checksum + Blowfish ECB. Incoming packets get Blowfish ECB + checksum verify.

### Phase 2: Game Server (GameClient)

```
Client                          Game Server
  |--- TCP connect (7777) ----->|
  |--- ProtocolVersion (0x00) ->|  (UNENCRYPTED, sends protocol=746)
  |<---- CryptInit (0x00) ------|  Contains: XOR key seed and encryption flag
  |                              |  If flag=0, encryption is DISABLED
  |--- AuthRequest (0x08) ----->|  Username + session tokens (UTF-16LE)
  |<---- CharSelectInfo (0x13) --|  Character list with full details
  |--- CharacterSelected (0x0D)->|  Selects character by slot (14 bytes padding)
  |<---- CharSelected (0x15) ----|  Confirms selected character
  |--- 0x9D (empty) ---------->|
  |--- 0xD0-08-00 ------------->|
  |--- EnterWorld (0x03) ------>|  (with 104 bytes of 0x00 padding)
  |<---- UserInfo (0x04) -------|  Full character info → IN_GAME state
  |                              |
  |<---- NetPingRequest (0xD3) -|  (periodic keepalive, every ~3 seconds)
  |--- NetPing (0xA8) --------->|
```

**CRITICAL:** The server controls whether to use XOR encryption via the flag in CryptInit packet. For L2J Mobius CT0, this flag is **0** (encryption disabled), so GameCrypt passes packets through without modification.

---

## Key Implementation Details

### Packet Framing

Every L2 packet is length-prefixed with uint16LE (including the 2-byte header):

```
[uint16LE: total_length] [body bytes...]
```

### String Encoding

- **Login Server:** UTF-16LE, null-terminated, length-prefixed with uint16LE
- **Game Server:** UTF-16LE, null-terminated (no length prefix)

### RSA Encryption (Login)

- 1024-bit key
- NO_PADDING
- Modulus must be "unscrambled" using 4-step XOR+swap from Init packet

### Blowfish (Login)

- ECB mode
- Custom L2 checksum added before encryption
- Rolling XOR applied after encryption

### XOR Encryption (Game)

- Simple XOR with 8-byte key derived from seed
- Can be disabled via CryptInit flag

### UserInfo Packet Format (0x04)

**CRITICAL FIX:** The UserInfo packet format was corrected based on l2J-Mobius source code:

```
Offset  Field           Type        Description
------  -----           ----        -----------
0       opcode          uint8       0x04
1       x               int32       X coordinate
5       y               int32       Y coordinate
9       z               int32       Z coordinate
13      vehicleId       int32       Vehicle object ID (0 if not in vehicle)
17      objectId        int32       Player object ID
21      name            UTF16-LE    Character name (null-terminated)
...     race            int32       Race ID (0=Human, 1=Elf, 2=Dark Elf, 3=Orc, 4=Dwarf)
...     sex             int32       0=Male, 1=Female
...     classId         int32       Class ID
...     level           int32       Character level
...     exp             int64       Experience points
...     str             int32       STR stat
...     dex             int32       DEX stat
...     con             int32       CON stat
...     int             int32       INT stat
...     wit             int32       WIT stat
...     men             int32       MEN stat
...     maxHp           int32       Maximum HP
...     currentHp       int32       Current HP (NOT double!)
...     maxMp           int32       Maximum MP
...     currentMp       int32       Current MP (NOT double!)
...     sp              int32       Skill points
...     currentLoad     int32       Current weight
...     maxLoad         int32       Maximum weight
```

**Important:** In Interlude protocol, HP/MP values are **Int32**, not Double! This was corrected from an earlier implementation that incorrectly used Double.

---

## State Management

### GameState (WebSocket Vision API)

**GameState** (`src/game/GameState.ts`) — единое централизованное in-memory хранилище всего игрового состояния:

| Свойство | Тип | Описание |
|----------|-----|----------|
| `me` | `CharacterMe \| null` | Данные текущего персонажа |
| `players` | `Map<number, Player>` | Другие игроки (objectId → Player) |
| `npcs` | `Map<number, Npc>` | NPC/мобы в зоне видимости |
| `items` | `Map<number, DroppedItem>` | Предметы на земле |
| `inventory` | `Map<number, InventoryItem>` | Инвентарь персонажа |
| `skills` | `Skill[]` | Скиллы персонажа |
| `party` | `PartyMember[]` | Члены группы |
| `chat` | `ChatMessage[]` | История чата (50 последних) |
| `effects` | `ActiveEffect[]` | Активные баффы/дебаффы |
| `target` | `TargetInfo \| null` | Текущая цель |
| `serverTime` | `number` | Серверное время |

**Методы:**
- `update(eventName, data)` — обновляет состояние и эмитит `ws:event`
- `getSnapshot()` — возвращает полный снимок мира (Maps → Arrays)
- `reset()` — очищает все коллекции (при отключении)
- `calcDistance(x, y)` — 2D расстояние от персонажа до точки

### GameStateUpdater

**GameStateUpdater** (`src/game/GameStateUpdater.ts`) — мост между серверными пакетами и GameState:

| Метод | Описание |
|-------|----------|
| `handlePacket(opcode, data)` | Главный метод обработки пакета |
| `handleUserInfo(data)` | 0x04 - обновление state.me |
| `handleCharInfo(data)` | 0x03 - добавление/обновление state.players |
| `handleNpcInfo(data)` | 0x16 - добавление/обновление state.npcs |
| `handleMoveToLocation(data)` | 0x2E - движение сущности |
| `handleDeleteObject(data)` | 0x08 - удаление объекта |
| `handleStatusUpdate(data)` | 0x0E - обновление HP/MP/CP |
| `handleDie(data)` | 0x06 - смерть сущности |
| `handleRevive(data)` | 0x07 - воскрешение сущности |
| `handleCreatureSay(data)` | 0x4A - сообщение чата |
| `handleAbnormalStatusUpdate(data)` | 0x39 - баффы/дебаффы |
| `handleMagicSkillUse(data)` | 0x76 - использование скилла |
| `handleMyTargetSelected(data)` | 0xA1 - выбор цели |
| `handleTargetUnselected(data)` | 0xA6 - снятие цели |

**WS-события, генерируемые GameStateUpdater:**
- `me.update` — обновление данных персонажа
- `player.appear` / `player.update` — появление/обновление игрока
- `npc.appear` / `npc.update` — появление/обновление NPC
- `entity.move` — движение сущности
- `entity.despawn` / `entity.die` / `entity.revive` — исчезновение/смерть/воскрешение
- `chat.message` — сообщение чата
- `effects.update` — обновление баффов
- `target.select` / `target.unselect` — выбор/снятие цели
- `disconnected` — отключение от сервера

### GameStateStore (Legacy)

Legacy in-memory store for all game state (постепенно заменяется GameState):

- **CharacterState:** HP/MP/CP, position, stats, level, class, buffs
- **WorldState:** NPCs, players, items on ground
- **InventoryState:** Items, adena, weight
- **CombatState:** Current target, combat status
- **PartyState:** Party members, leader status
- **ConnectionState:** Connection phase, uptime, ping

### EventBus

Typed EventEmitter for real-time event streaming:

```typescript
EventBus.emitEvent({
    type: 'character.stats_changed',
    channel: 'character',
    data: { hp: { current: 1200, max: 1500, delta: -100 } },
    timestamp: new Date().toISOString()
});

EventBus.onAny((event) => {
    console.log(event.type, event.data);
});
```

---

## Dictionaries

Словари для маппинга ID в человекочитаемые названия (`src/game/dictionaries/`):

| Файл | Содержимое | Количество |
|------|------------|------------|
| `classNames.ts` | Маппинг classId → название класса | 118+ классов |
| `npcNames.ts` | Маппинг npcId → название NPC | 200+ NPC |
| `itemNames.ts` | Маппинг itemId → название предмета | 150+ предметов |

**Хелпер-функции:**
- `getClassName(id: number): string` — имя класса или `"Unknown Class #id"`
- `getNpcName(id: number): string` — имя NPC или `"Unknown NPC #id"`
- `getItemName(id: number): string` — имя предмета или `"Unknown Item #id"`

## Data Structures (Schemas)

### Position
```typescript
interface Position {
  x: number;       // Координата X игрового мира
  y: number;       // Координата Y игрового мира
  z: number;       // Высота
  heading?: number; // Направление (0–65535)
}
```

### HpMpCp
```typescript
interface HpMpCp {
  current: number;
  max: number;
}
```

### CharacterStats
```typescript
interface CharacterStats {
  str: number;       // Сила
  con: number;       // Телосложение
  dex: number;       // Ловкость
  int: number;       // Интеллект
  wit: number;       // Мудрость
  men: number;       // Концентрация
  pAtk: number;      // Физическая атака
  mAtk: number;      // Магическая атака
  pDef: number;      // Физическая защита
  mDef: number;      // Магическая защита
  atkSpd: number;    // Скорость атаки
  castSpd: number;   // Скорость каста
  accuracy: number;  // Точность
  evasion: number;   // Уклонение
  critical: number;  // Крит
  speed: number;     // Скорость бега
}
```

### Item
```typescript
interface Item {
  objectId: number;      // Уникальный ID экземпляра
  itemId: number;        // Тип предмета (из базы данных)
  name: string;
  count: number;
  type: 'weapon' | 'armor' | 'consumable' | 'material' | 'quest' | 'etc';
  equipped: boolean;
  slot: number;          // Слот (-1 = не надет)
  enchant: number;       // +N зачаровывание
  mana: number;          // -1 = нет мана-кристаллов
  grade?: 'No' | 'D' | 'C' | 'B' | 'A' | 'S';
}
```

### Buff
```typescript
interface Buff {
  skillId: number;
  name: string;
  level: number;
  remainingTime: number; // Секунды, -1 = постоянный
  isDebuff: boolean;
  icon?: string;
}
```

---

## Error Codes

| Код | HTTP | Описание |
|---|---|---|
| `NOT_CONNECTED` | 503 | Клиент не подключён к серверу |
| `NOT_IN_GAME` | 503 | Авторизован, но персонаж ещё не вошёл в игру |
| `INVALID_TARGET` | 400 | Указан несуществующий objectId |
| `TARGET_DEAD` | 400 | Цель уже мертва |
| `TARGET_OUT_OF_RANGE` | 400 | Цель вне зоны досягаемости |
| `SKILL_NOT_FOUND` | 404 | Умение отсутствует у персонажа |
| `SKILL_ON_COOLDOWN` | 429 | Умение на кулдауне |
| `NOT_ENOUGH_MP` | 400 | Недостаточно MP |
| `ITEM_NOT_FOUND` | 404 | Предмет не найден в инвентаре |
| `MOVEMENT_BLOCKED` | 400 | Движение заблокировано (кастует и т.д.) |
| `CHAT_FLOOD` | 429 | Слишком частая отправка сообщений |
| `UNAUTHORIZED` | 401 | Неверный или отсутствующий API ключ |
| `RATE_LIMIT_EXCEEDED` | 429 | Превышен лимит запросов |
| `INTERNAL_ERROR` | 500 | Внутренняя ошибка клиента |
| `CONFIG_MISSING` | 500 | Конфигурация `src/config.ts` не заполнена |

---

## Configuration

Edit `src/config.ts`:

```typescript
export const CONFIG = {
    Username: "your_login",
    Password: "your_password",
    LoginIp: "192.168.0.33",
    LoginPort: 2106,
    GamePort: 7777,
    Protocol: 746,
    ServerId: 2,
    CharSlotIndex: 0,
} as const;

export const API_CONFIG = {
    port: 3000,
    host: '0.0.0.0',
    apiKey: process.env.API_KEY || 'dev_api_key_change_in_production',
} as const;

export const DASHBOARD_CONFIG = {
    enabled: true,
    title: '🎮 L2 Bot Dashboard',
    refreshInterval: 2000,     // Status polling interval (ms)
    wsReconnect: {
        initialDelay: 1000,    // Initial reconnect delay (ms)
        maxDelay: 30000,       // Maximum reconnect delay (ms)
        multiplier: 2,         // Exponential backoff multiplier
    },
    theme: 'dark' as const,
} as const;
```

---

## Development

### Commands

```bash
npm install       # Install dependencies
npm run dev       # Run client with API server
npm run debug     # Run with DEBUG logging
npm run build     # Compile TypeScript to dist/
```

### Testing API

```bash
# Health check
curl http://localhost:3000/health

# Get character info
curl -H "Authorization: Bearer dev_api_key_change_in_production" \
     http://localhost:3000/api/v1/character

# Send move command
curl -X POST \
     -H "Authorization: Bearer dev_api_key_change_in_production" \
     -H "Content-Type: application/json" \
     -d '{"x": 83500, "y": 54000, "z": -1490}' \
     http://localhost:3000/api/v1/move/to

# Attack target
curl -X POST \
     -H "Authorization: Bearer dev_api_key_change_in_production" \
     -H "Content-Type: application/json" \
     -d '{"objectId": 268701234}' \
     http://localhost:3000/api/v1/combat/attack

# Send chat message
curl -X POST \
     -H "Authorization: Bearer dev_api_key_change_in_production" \
     -H "Content-Type: application/json" \
     -d '{"channel": "ALL", "message": "Hello!"}' \
     http://localhost:3000/api/v1/chat/send
```

---

## Usage Examples

### Example 1: Bot Script — Автофарм

```typescript
// Скрипт на TypeScript, использующий API клиента
import axios from 'axios';
import WebSocket from 'ws';

const API = 'http://localhost:3000/api/v1';
const HEADERS = { Authorization: 'Bearer my_api_key' };

// Подключиться и подписаться на события
const ws = new WebSocket('ws://localhost:3000/ws?token=my_api_key');

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'subscribe', channels: ['combat', 'world'] }));
});

ws.on('message', async (raw) => {
  const event = JSON.parse(raw.toString());

  // Когда моб убит — подобрать лут и найти следующего
  if (event.type === 'combat.target_died') {
    const { data: nearby } = await axios.get(`${API}/nearby/items`, { headers: HEADERS });
    for (const item of nearby.data.items) {
      await axios.post(`${API}/pickup`, { objectId: item.objectId }, { headers: HEADERS });
      await delay(300);
    }
    await findAndAttackNextMob();
  }
});

async function findAndAttackNextMob() {
  const { data } = await axios.get(
    `${API}/nearby/npcs?attackable=true&radius=600`,
    { headers: HEADERS }
  );
  if (data.data.npcs.length > 0) {
    const target = data.data.npcs[0];
    await axios.post(`${API}/combat/attack`, { objectId: target.objectId }, { headers: HEADERS });
  }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
```

---

### Example 2: Telegram-бот мониторинг

```javascript
// Уведомление в Telegram когда персонаж умирает
const ws = new WebSocket('ws://localhost:3000/ws?token=my_api_key');

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'subscribe', channels: ['character', 'system'] }));
});

ws.on('message', (raw) => {
  const event = JSON.parse(raw);
  if (event.type === 'character.died') {
    sendTelegramAlert(`☠️ Персонаж умер! Убийца: ${event.data.killerName}`);
  }
  if (event.type === 'system.disconnected') {
    sendTelegramAlert(`⚠️ Дроп соединения! Причина: ${event.data.reason}`);
  }
});
```

---

## Game Packet Parsing

### Overview

Клиент парсит входящие пакеты от Game Server для обновления состояния игры. Каждый пакет начинается с opcode (1 байт), за которым следуют данные.

### Implemented Packets

#### Character & Status

| Opcode | Packet Name | Direction | Description | Status |
|--------|-------------|-----------|-------------|--------|
| `0x04` | `UserInfo` | Server → Client | Полная информация о персонаже | ✅ Implemented |
| `0x03` | `CharInfo` | Server → Client | Информация о других игроках | ✅ Implemented |
| `0x13` | `CharSelectInfo` | Server → Client | Список персонажей на аккаунте | ✅ Implemented |
| `0x15` | `CharSelected` | Server → Client | Подтверждение выбора персонажа | ✅ Implemented |
| `0x00` | `CryptInit` | Server → Client | Инициализация шифрования | ✅ Implemented |
| `0x0E` | `StatusUpdate` | Server → Client | Обновление HP/MP/CP | ✅ Implemented |
| `0x06` | `Die` | Server → Client | Смерть сущности | ✅ Implemented |
| `0x07` | `Revive` | Server → Client | Воскрешение сущности | ✅ Implemented |
| `0x39` | `AbnormalStatusUpdate` | Server → Client | Баффы и дебаффы | ✅ Implemented |
| `0xA1` | `MyTargetSelected` | Server → Client | Выбор цели | ✅ Implemented |
| `0xA6` | `TargetUnselected` | Server → Client | Снятие цели | ✅ Implemented |

#### NPC & World

| Opcode | Packet Name | Direction | Description | Status |
|--------|-------------|-----------|-------------|--------|
| `0x16` | `NpcInfo` | Server → Client | Информация о NPC (спавн, позиция, статы) | ✅ Implemented |
| `0x08` | `DeleteObject` | Server → Client | Удаление объекта (деспавн) | ✅ Implemented |
| `0x0B` | `SpawnItem` | Server → Client | Появление предмета в мире | ✅ Implemented |
| `0x0C` | `DropItem` | Server → Client | Предмет упал на землю | ✅ Implemented |
| `0x21` | `GetItem` | Server → Client | Предмет подобран | ✅ Implemented |
| `0x2E` | `MoveToLocation` | Server → Client | Движение сущности | ✅ Implemented |

#### Combat

| Opcode | Packet Name | Direction | Description | Status |
|--------|-------------|-----------|-------------|--------|
| `0x05` | `Attack` | Server → Client | Атака (своя или чужая) | ✅ Implemented |
| `0x48` | `StatusUpdate` | Server → Client | Обновление HP/MP/CP цели | ✅ Implemented |
| `0x76` | `MagicSkillUse` | Server → Client | Использование скилла | ✅ Implemented |
| `0x62` | `SystemMessage` | Server → Client | Системные сообщения | ✅ Implemented |

#### Inventory & Skills

| Opcode | Packet Name | Direction | Description | Status |
|--------|-------------|-----------|-------------|--------|
| `0x1B` | `ItemList` | Server → Client | Полный список инвентаря | ✅ Implemented |
| `0x19` | `InventoryUpdate` | Server → Client | Частичное обновление инвентаря | ✅ Implemented |
| `0x58` | `SkillList` | Server → Client | Список скиллов персонажа | ✅ Implemented |

#### Chat

| Opcode | Packet Name | Direction | Description | Status |
|--------|-------------|-----------|-------------|--------|
| `0x4A` | `Say2` / `CreatureSay` | Server → Client | Сообщение в чате (все каналы) | ✅ Implemented |

#### Movement

| Opcode | Packet Name | Direction | Description | Status |
|--------|-------------|-----------|-------------|--------|
| `0x2E` | `MoveToLocation` | Server → Client | NPC/игрок начал движение | ✅ Implemented |
| `0x59` | `StopMove` | Server → Client | NPC/игрок остановился | ✅ Implemented |
| `0x03` | `CharMoveToLocation` | Server → Client | Движение персонажа | ✅ Implemented |

#### System

| Opcode | Packet Name | Direction | Description | Status |
|--------|-------------|-----------|-------------|--------|
| `0xD3` | `NetPingRequest` | Server → Client | Запрос ping (keepalive) | ✅ Implemented |
| `0x63` | `ServerClose` | Server → Client | Сервер закрывается | ✅ Implemented |

---

### Packet Structure Details

#### NpcInfo Packet (0x16)

```
Offset  Field           Type        Description
------  -----           ----        -----------
0       opcode          uint8       0x16
1       x               int32       X coordinate
5       y               int32       Y coordinate
9       z               int32       Z coordinate
13      heading         int32       Direction (0-65535)
17      objectId        int32       Unique object ID
21      npcId           int32       NPC template ID
25      isAttackable    uint8       1 = can attack, 0 = passive
26      mAtkSpd         int32       Magic attack speed
30      pAtkSpd         int32       Physical attack speed
34      runSpd          int32       Run speed
38      walkSpd         int32       Walk speed
42      swimRunSpd      int32       Swim run speed
46      swimWalkSpd     int32       Swim walk speed
50      flyRunSpd       int32       Fly run speed
54      flyWalkSpd      int32       Fly walk speed
58      doubleAtkSpd    int32       Double attack speed
62      collisionRadius double      Collision radius
70      collisionHeight double      Collision height
78      rhand           int32       Right hand item
82      lhand           int32       Left hand item
86      title           UTF16-LE    NPC title (if any)
...     name            UTF16-LE    NPC name
...     level           int32       NPC level
...     abnormalEffect  int32       Visual effects
...     clanCrestId     int32       Clan crest
...     allyCrestId     int32       Alliance crest
```

**Note:** `NpcInfo` отправляется сервером при появлении NPC в зоне видимости. Клиент обновляет `WorldState` и генерирует событие `world.npc_spawned`.

---

#### Say2 Packet (0x4A) — Chat

```
Offset  Field           Type        Description
------  -----           ----        -----------
0       opcode          uint8       0x4A
1       objectId        int32       Sender object ID
5       type            int32       Chat channel type
9       name            UTF16-LE    Sender name
...     message         UTF16-LE    Message text
```

**Chat Channel Types:**

| Value | Constant | Description |
|-------|----------|-------------|
| `0` | `ALL` | Общий чат |
| `1` | `SHOUT` | Крик (оранжевый) |
| `2` | `TELL` | Личное сообщение (PM) |
| `3` | `PARTY` | Чат группы |
| `4` | `CLAN` | Чат клана |
| `8` | `TRADE` | Торговый чат |
| `9` | `HERO` | Геройский чат |
| `10` | `ANNOUNCE` | Анонс от админа |

**Implementation:**
```typescript
// src/game/packets/incoming/Say2Packet.ts
export class Say2Packet {
    objectId: number;
    type: ChatType;
    senderName: string;
    message: string;

    static fromReader(reader: PacketReader): Say2Packet {
        const packet = new Say2Packet();
        packet.objectId = reader.readInt32();
        packet.type = reader.readInt32() as ChatType;
        packet.senderName = reader.readUtf16String();
        packet.message = reader.readUtf16String();
        return packet;
    }
}
```

---

#### Attack Packet (0x05) — Combat

```
Offset  Field           Type        Description
------  -----           ----        -----------
0       opcode          uint8       0x05
1       attackerId      int32       Object ID атакующего
5       targetId        int32       Object ID цели
9       damage          int32       Нанесённый урон
13      flags           uint8       Флаги (крит, промах и т.д.)
14      soulshot        uint8       Использован soulshot
```

**Flags:**
- `0x01` — Normal hit
- `0x02` — Critical hit
- `0x04` — Miss
- `0x08` — Shield block

**Event Generation:**
```typescript
// При получении Attack пакета
EventBus.emitEvent({
    type: attackerId === myObjectId ? 'combat.attack_sent' : 'combat.attack_received',
    channel: 'combat',
    data: {
        attackerObjectId: attackerId,
        targetObjectId: targetId,
        damage: damage,
        isCritical: (flags & 0x02) !== 0,
        isMiss: (flags & 0x04) !== 0
    }
});
```

---

#### StatusUpdate Packet (0x48)

```
Offset  Field           Type        Description
------  -----           ----        -----------
0       opcode          uint8       0x48
1       objectId        int32       Object ID
5       attributeCount  uint8       Количество атрибутов
6+      attributes      []          Массив атрибутов
```

**Attribute Structure:**
```
Field           Type        Description
-----           ----        -----------
attributeId     uint16      ID атрибута
value           int32       Значение
```

**Attribute IDs:**
| ID | Name | Description |
|----|------|-------------|
| `9` | `LEVEL` | Уровень |
| `10` | `EXP` | Опыт |
| `11` | `STR` | Сила |
| `12` | `DEX` | Ловкость |
| `13` | `CON` | Телосложение |
| `14` | `INT` | Интеллект |
| `15` | `WIT` | Мудрость |
| `16` | `MEN` | Концентрация |
| `27` | `CUR_HP` | Текущее HP |
| `28` | `MAX_HP` | Максимальное HP |
| `29` | `CUR_MP` | Текущее MP |
| `30` | `MAX_MP` | Максимальное MP |
| `31` | `CUR_CP` | Текущее CP |
| `32` | `MAX_CP` | Максимальное CP |

---

### Packet Handler Architecture

```typescript
// src/game/GamePacketHandler.ts
export class GamePacketHandler {
    private handlers: Map<number, PacketHandler> = new Map();

    constructor() {
        this.register(0x04, new UserInfoHandler());
        this.register(0x16, new NpcInfoHandler());
        this.register(0x4A, new Say2Handler());
        this.register(0x05, new AttackHandler());
        this.register(0x48, new StatusUpdateHandler());
        // ... etc
    }

    handlePacket(opcode: number, data: Buffer): void {
        const handler = this.handlers.get(opcode);
        if (handler) {
            handler.handle(data);
        } else {
            Logger.debug(`Unknown packet opcode: 0x${opcode.toString(16).padStart(2, '0')}`);
        }
    }
}
```

---

### Adding New Packet Support

Для добавления поддержки нового пакета:

1. **Create packet class:**
```typescript
// src/game/packets/incoming/MyNewPacket.ts
export class MyNewPacket {
    static fromReader(reader: PacketReader): MyNewPacket {
        // Parse fields
    }
}
```

2. **Create handler:**
```typescript
// src/game/handlers/MyNewHandler.ts
export class MyNewHandler implements PacketHandler {
    handle(data: Buffer): void {
        const reader = new PacketReader(data);
        const packet = MyNewPacket.fromReader(reader);
        
        // Update GameStateStore
        GameStateStore.updateSomething(packet);
        
        // Emit event
        EventBus.emitEvent({
            type: 'my.event',
            channel: 'world',
            data: packet
        });
    }
}
```

3. **Register handler:**
```typescript
// In GamePacketHandler constructor
this.register(0xXX, new MyNewHandler());
```

---

## Integration Tests

### Overview

Интеграционные тесты проверяют взаимодействие компонентов системы: подключение к серверу, парсинг пакетов, API endpoints, WebSocket события.

### Test Structure

```
tests/
├── integration/
│   ├── setup.ts                 # Test environment setup
│   ├── api/
│   │   ├── character.test.ts    # Character API tests
│   │   ├── combat.test.ts       # Combat API tests
│   │   └── websocket.test.ts    # WebSocket tests
│   ├── packets/
│   │   ├── UserInfo.test.ts     # UserInfo packet parsing
│   │   ├── NpcInfo.test.ts      # NpcInfo packet parsing
│   │   └── Say2.test.ts         # Chat packet parsing
│   └── game/
│       ├── connection.test.ts   # Connection flow
│       └── movement.test.ts     # Movement tests
├── new-architecture/            # Новая архитектура
│   ├── domain/                  # Тесты доменных сущностей
│   ├── infrastructure/          # Тесты инфраструктуры
│   └── application/             # Тесты приложения
├── performance/                 # Производственные тесты
│   ├── BufferPool.test.ts
│   ├── CacheManager.test.ts
│   └── PacketSerializer.test.ts
├── fixtures/
│   ├── packets/                 # Binary packet samples
│   └── mocks/                   # Mock server responses
└── utils/
    ├── mockServer.ts            # Mock L2 server
    └── testHelpers.ts           # Test utilities

src/__tests__/                   # Unit тесты
├── GameState.test.ts            # Тесты GameState
├── GameStateUpdater.test.ts     # Тесты обработки пакетов
└── WsServer.test.ts             # Тесты WebSocket сервера
```

**Статус:** ✅ **168 тестов проходят успешно**

### Test Configuration

```typescript
// tests/config.ts
export const TEST_CONFIG = {
    // Mock server settings
    mockServer: {
        loginPort: 22106,
        gamePort: 27777,
        host: '127.0.0.1'
    },
    
    // Test account
    testAccount: {
        username: 'test_user',
        password: 'test_pass',
        characterSlot: 0
    },
    
    // API settings
    api: {
        port: 13000,
        apiKey: 'test_api_key'
    },
    
    // Timeouts
    timeouts: {
        connection: 10000,
        response: 5000,
        websocket: 3000
    }
};
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- character.test.ts

# Run with coverage
npm run test:coverage

# Run integration tests only
npm run test:integration

# Run with debug output
DEBUG=l2client:* npm test
```

### Mock L2 Server

```typescript
// tests/utils/mockServer.ts
import { createServer, Server, Socket } from 'net';

export class MockL2Server {
    private loginServer: Server;
    private gameServer: Server;
    private clients: Map<string, Socket> = new Map();

    async start(): Promise<void> {
        // Start Login Server
        this.loginServer = createServer((socket) => {
            this.handleLoginConnection(socket);
        });
        
        // Start Game Server
        this.gameServer = createServer((socket) => {
            this.handleGameConnection(socket);
        });

        await Promise.all([
            new Promise<void>(resolve => this.loginServer.listen(TEST_CONFIG.mockServer.loginPort, resolve)),
            new Promise<void>(resolve => this.gameServer.listen(TEST_CONFIG.mockServer.gamePort, resolve))
        ]);
    }

    sendGamePacket(clientId: string, opcode: number, data: Buffer): void {
        const client = this.clients.get(clientId);
        if (client) {
            const packet = Buffer.concat([
                Buffer.from([opcode]),
                data
            ]);
            const length = Buffer.alloc(2);
            length.writeUInt16LE(packet.length + 2, 0);
            client.write(Buffer.concat([length, packet]));
        }
    }

    stop(): Promise<void> {
        // Cleanup
    }
}
```

### API Integration Tests

```typescript
// tests/integration/api/character.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockL2Server } from '../../utils/mockServer';
import { TEST_CONFIG } from '../../config';

describe('Character API', () => {
    let mockServer: MockL2Server;
    let apiBase: string;

    beforeAll(async () => {
        mockServer = new MockL2Server();
        await mockServer.start();
        apiBase = `http://localhost:${TEST_CONFIG.api.port}/api/v1`;
    });

    afterAll(async () => {
        await mockServer.stop();
    });

    describe('GET /api/v1/character', () => {
        it('should return character data when connected', async () => {
            // Connect client first
            await fetch(`${apiBase}/connect`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${TEST_CONFIG.api.apiKey}` }
            });

            // Wait for connection
            await new Promise(r => setTimeout(r, 2000));

            // Get character
            const response = await fetch(`${apiBase}/character`, {
                headers: { 'Authorization': `Bearer ${TEST_CONFIG.api.apiKey}` }
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toHaveProperty('name');
            expect(data.data).toHaveProperty('level');
        });

        it('should return 503 when not connected', async () => {
            const response = await fetch(`${apiBase}/character`, {
                headers: { 'Authorization': `Bearer ${TEST_CONFIG.api.apiKey}` }
            });

            expect(response.status).toBe(503);
            const data = await response.json();
            expect(data.error.code).toBe('NOT_IN_GAME');
        });
    });

    describe('GET /api/v1/character/stats', () => {
        it('should return combat stats', async () => {
            const response = await fetch(`${apiBase}/character/stats`, {
                headers: { 'Authorization': `Bearer ${TEST_CONFIG.api.apiKey}` }
            });

            const data = await response.json();
            expect(data.data).toHaveProperty('str');
            expect(data.data).toHaveProperty('dex');
            expect(data.data).toHaveProperty('con');
        });
    });
});
```

### WebSocket Tests

```typescript
// tests/integration/api/websocket.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';

describe('WebSocket Events', () => {
    let ws: WebSocket;
    const wsUrl = `ws://localhost:${TEST_CONFIG.api.port}/ws?token=${TEST_CONFIG.api.apiKey}`;

    beforeAll(() => {
        ws = new WebSocket(wsUrl);
        return new Promise<void>((resolve) => {
            ws.on('open', resolve);
        });
    });

    afterAll(() => {
        ws.close();
    });

    it('should receive character.stats_changed event on HP change', (done) => {
        // Subscribe to character channel
        ws.send(JSON.stringify({
            type: 'subscribe',
            channels: ['character']
        }));

        // Wait for subscription confirmation
        ws.once('message', () => {
            // Simulate HP change from mock server
            mockServer.simulateDamage(TEST_CONFIG.testAccount.username, 100);

            ws.once('message', (data) => {
                const event = JSON.parse(data.toString());
                expect(event.type).toBe('character.stats_changed');
                expect(event.data.hp.delta).toBe(-100);
                done();
            });
        });
    });

    it('should receive world.npc_spawned event', (done) => {
        ws.send(JSON.stringify({
            type: 'subscribe',
            channels: ['world']
        }));

        ws.once('message', () => {
            // Simulate NPC spawn
            mockServer.spawnNpc({
                objectId: 12345,
                npcId: 20058,
                name: 'TestWolf',
                x: 82928,
                y: 53600,
                z: -1490
            });

            ws.once('message', (data) => {
                const event = JSON.parse(data.toString());
                expect(event.type).toBe('world.npc_spawned');
                expect(event.data.name).toBe('TestWolf');
                done();
            });
        });
    });
});
```

### Packet Parsing Tests

```typescript
// tests/integration/packets/NpcInfo.test.ts
import { describe, it, expect } from 'vitest';
import { PacketReader } from '../../../src/network/PacketReader';
import { NpcInfoPacket } from '../../../src/game/packets/incoming/NpcInfoPacket';

describe('NpcInfo Packet Parsing', () => {
    it('should parse Wolf NPC correctly', () => {
        // Raw packet bytes (captured from real server)
        const rawPacket = Buffer.from([
            0x16, // opcode
            0x10, 0x43, 0x01, 0x00, // x = 82928
            0x60, 0xD1, 0x00, 0x00, // y = 53600
            0x2E, 0xFA, 0xFF, 0xFF, // z = -1490
            0x00, 0x80, 0x00, 0x00, // heading
            0xF4, 0xA1, 0x10, 0x10, // objectId
            0xBA, 0x4E, 0x00, 0x00, // npcId = 20154 (Wolf)
            0x01, // isAttackable = true
            // ... rest of packet
        ]);

        const reader = new PacketReader(rawPacket.slice(1)); // Skip opcode
        const packet = NpcInfoPacket.fromReader(reader);

        expect(packet.objectId).toBe(0x1010A1F4);
        expect(packet.npcId).toBe(20154);
        expect(packet.x).toBe(82928);
        expect(packet.y).toBe(53600);
        expect(packet.z).toBe(-1490);
        expect(packet.isAttackable).toBe(true);
    });

    it('should emit world.npc_spawned event', () => {
        const events: any[] = [];
        
        EventBus.on('world.npc_spawned', (event) => {
            events.push(event);
        });

        // Parse and handle packet
        const handler = new NpcInfoHandler();
        handler.handle(rawPacket);

        expect(events).toHaveLength(1);
        expect(events[0].data.name).toBeDefined();
    });
});
```

### End-to-End Combat Test

```typescript
// tests/integration/game/combat.test.ts
import { describe, it, expect, beforeAll } from 'vitest';

describe('Combat Flow', () => {
    it('should complete full attack cycle', async () => {
        // 1. Connect and enter game
        await connectClient();

        // 2. Find nearby NPC
        const npcs = await fetch(`${apiBase}/nearby/npcs`).then(r => r.json());
        const target = npcs.data.npcs[0];

        // 3. Set target
        await fetch(`${apiBase}/target/set`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ objectId: target.objectId })
        });

        // 4. Start attack
        const attackPromise = waitForEvent('combat.attack_sent');
        await fetch(`${apiBase}/combat/attack`, { method: 'POST' });
        
        const attackEvent = await attackPromise;
        expect(attackEvent.data.targetObjectId).toBe(target.objectId);

        // 5. Wait for target death
        const deathEvent = await waitForEvent('combat.target_died', 30000);
        expect(deathEvent.data.objectId).toBe(target.objectId);

        // 6. Check loot appeared
        const items = await fetch(`${apiBase}/nearby/items`).then(r => r.json());
        expect(items.data.items.length).toBeGreaterThan(0);
    });
});
```

### Test Scripts (package.json)

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:integration": "vitest run tests/integration",
    "test:packets": "vitest run tests/integration/packets",
    "test:api": "vitest run tests/integration/api"
  }
}
```

---

## Data Export

Скрипты для экспорта игровых данных (предметы, NPC, скиллы, сеты брони и др.) из сервера L2J Mobius.

### Требования

Перед использованием скриптов необходимо получить исходные XML-данные с сервера:

1. **Скачайте сервер L2J_Mobius CT_0 Interlude:**
   ```
   https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/tree/master/L2J_Mobius_CT_0_Interlude
   ```

2. **Скопируйте папку `data/stats`** из сервера в корень проекта (рядом с `package.json`).
   В результате должна появиться папка `stats/` с подпапками: `items/`, `npcs/`, `skills/` и др.

### Использование

```bash
# Полный экспорт (конвертация XML → JSON → нормализация)
npm run export:data

# Или пошагово:
node scripts/export-xml.js        # Конвертация XML в database.json
node scripts/normalize-database.js # Нормализация в удобную структуру
```

### Результат

Нормализованные данные сохраняются в `src/data/export/`:

| Файл | Описание |
|------|----------|
| `armorsets/armorsets.json` | Сеты брони со статами и бонусами |
| `items/items.json` | Все предметы (оружие, броня, расходники) |
| `npcs/npcs.json` | NPC с параметрами и дропом |
| `skills/skills.json` | Скиллы с эффектами |
| `players/skillTrees.json` | Деревья умений по классам |
| `players/classTemplates.json` | Стартовые статы и предметы классов |
| `pets/pets.json` | Данные питомцев |
| `fishing/fishing.json` | Рыбалка (удочки, рыбы, монстры) |
| `henna.json` | Хенна (татуировки) |
| `augmentation/augmentation.json` | Аугментация оружия |

---

## Adding New Packets

Для добавления поддержки нового входящего пакета:

### 1. Создайте Packet DTO

```typescript
// src/infrastructure/protocol/game/packets/MyNewPacket.ts
import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface MyNewData {
    objectId: number;
    value: number;
    name: string;
}

export class MyNewPacket implements IIncomingPacket {
    readonly opcode = 0xXX;
    private data!: MyNewData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        const value = reader.readInt32LE();
        const name = reader.readStringUTF16();

        this.data = { objectId, value, name };
        return this;
    }

    getData(): MyNewData {
        return { ...this.data };
    }
}
```

### 2. Создайте Handler

```typescript
// src/infrastructure/protocol/game/handlers/MyNewHandler.ts
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import type { PacketContext, IPacketReader } from '../../../../application/ports';
import type { IEventBus } from '../../../../application/ports';
import type { ICharacterRepository } from '../../../../domain/repositories';
import { MyNewPacket } from '../packets/MyNewPacket';

export class MyNewHandler extends BasePacketHandlerStrategy<MyNewPacket> {
    constructor(
        eventBus: IEventBus,
        private characterRepo: ICharacterRepository
    ) {
        super(0xXX, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(context: PacketContext, reader: IPacketReader): void {
        const packet = new MyNewPacket();
        packet.decode(reader);
        const data = packet.getData();

        // Update repository
        this.characterRepo.update((char) => {
            // ... update logic
            return char;
        });

        // Publish event
        this.eventBus.publish({
            type: 'character.my_event',
            channel: 'character',
            data: { value: data.value },
            timestamp: new Date().toISOString()
        });
    }
}
```

### 3. Зарегистрируйте в PacketRegistry

```typescript
// src/infrastructure/protocol/game/PacketRegistry.ts
import { MyNewPacket } from './packets/MyNewPacket';
import { MyNewHandler } from './handlers/MyNewHandler';

const PACKET_REGISTRY: PacketConfig[] = [
    // ... existing packets ...
    {
        opcode: 0xXX,
        packetClass: MyNewPacket,
        handlerClass: MyNewHandler,
        repositories: ['character'],
        description: 'MyNewPacket - description',
    },
];
```

---

## Project Status

**Current Phase:** Production Ready (v0.4.9)

### Project Statistics
- **Source Files:** 180+ TypeScript modules
- **Test Coverage:** Unit, integration, and performance tests
- **Packets Implemented:** 20+ incoming, 15+ outgoing
- **API Endpoints:** 30+ REST endpoints
- **WebSocket Events:** 15+ event types across 8 channels

### Implemented Features

#### Core Infrastructure
- ✅ **Dependency Injection** - Custom DI container with Result<T,E> monad
- ✅ **Zod Validation** - Runtime configuration validation
- ✅ State Store (GameStateStore) - Character, World, Inventory, Combat, Party
- ✅ EventBus - Typed event system with WebSocket broadcasting
- ✅ Network Layer - TCP client with L2 packet framing
- ✅ Crypto - RSA, Blowfish, XOR encryption

#### Game Protocol
- ✅ Login Server - Full flow: Init → GGAuth → AuthLogin → ServerList → PlayOk
- ✅ Game Server - Full flow: CryptInit → Auth → CharSelect → EnterWorld → InGame
- ✅ **Incoming Packets (11+)** - UserInfo, NpcInfo, CharInfo, ItemList, InventoryUpdate, SkillList, Attack, MoveToLocation, SpawnItem, DropItem, StatusUpdate
- ✅ **Outgoing Packets (15+)** - Move, Attack, UseSkill, UseItem, Chat, SocialActions, EnterWorld, ProtocolVersion

#### REST API (100% Implemented)
- ✅ Connection Management - /connect, /disconnect, /reconnect
- ✅ Character - /character, /stats, /buffs
- ✅ Inventory - /inventory, /use, /drop
- ✅ Combat - /attack, /stop, /target/*
- ✅ Movement - /move/to, /stop, /status, /follow
- ✅ Skills - /skills, /use, /shortcuts
- ✅ Chat - /send, /history
- ✅ Party - /party, /invite, /leave
- ✅ Nearby - /npcs, /players, /items

#### WebSocket Events
- ✅ System - connected, disconnected, error
- ✅ Character - stats_changed, level_up, buff_added/removed, died, revived
- ✅ Combat - attack_sent, attack_received, skill_used, target_died
- ✅ World - npc_spawned, npc_despawned, item_dropped, item_picked_up
- ✅ Movement - position_changed
- ✅ Chat - message

#### Dashboard
- ✅ Real-time status panel (HP/MP/XP/Position)
- ✅ WebSocket event monitor
- ✅ Combat controls
- ✅ API documentation (Scalar)

#### Testing
- ✅ Integration tests structure
- ✅ Mock L2 Server for testing
- ✅ Packet parsing tests
- ✅ API endpoint tests

---

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
npm start

# Run tests
npm test

# Run with debug logging
npm run debug
```

## Configuration

Edit `src/config.ts`:

```typescript
export const CONFIG = {
    Username: "your_login",
    Password: "your_password",
    LoginIp: "192.168.0.33",
    LoginPort: 2106,
    GamePort: 7777,
    Protocol: 746,
    ServerId: 2,
    CharSlotIndex: 0,
} as const;

export const API_CONFIG = {
    port: 3000,
    host: '0.0.0.0',
    apiKey: 'dev_api_key_change_in_production',
} as const;
```

## Dashboard Access

- **Dashboard**: http://localhost:3000/
- **API Docs**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/health

---

*Documentation last updated: 2026-03-20*
