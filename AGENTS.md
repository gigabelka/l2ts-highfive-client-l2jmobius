# L2 Headless Client — Agent Guide

This file provides essential information for AI coding agents working on this project.

## Project Overview

**L2 Headless Client** is a TypeScript/Node.js bot client for Lineage 2 Interlude game servers. It connects to L2J Mobius CT_0_Interlude servers, authenticates, enters the game world, and provides a REST + WebSocket API for external control.

- **Project Name:** `l2ts-interlude-client-l2jmobius`
- **Version:** 0.4.9
- **Target Server:** L2J_Mobius CT_0_Interlude (Protocol 746)
- **Node.js Version:** >= 24.14.0
- **License:** MIT
- **Author:** Viktor Belkin
- **Repository:** https://github.com/gigabelka/l2ts-interlude-client-l2jmobius

## Technology Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript 5.9.3 |
| Runtime | Node.js 24.14.0+ |
| Build | tsc (CommonJS output) |
| Testing | Vitest 2.1.4 |
| Linting | ESLint with TypeScript |
| API Framework | Express.js 5.x |
| WebSocket | ws library |
| Validation | Zod 4.3.6 |
| DI Container | Custom implementation with Result<T,E> |

## Architecture Overview

The project follows **Clean Architecture** principles with clear separation of concerns:

```
src/
├── index.ts                    # Entry point with DI container bootstrap
├── config.ts                   # Environment configuration (Zod validation)
├── config/di/                  # Dependency Injection container
│   ├── Container.ts            # DI container implementation with Result<T,E>
│   ├── appContainer.ts         # Singleton container instance
│   └── composition.ts          # Service registration
│
├── domain/                     # Domain Layer (business logic)
│   ├── entities/               # Character, Npc, Item
│   ├── value-objects/          # Position, Vitals, Stats, Experience, Identity
│   ├── events/                 # Domain events (CharacterEvents, ChatEvents, etc.)
│   └── repositories/           # Repository interfaces (ICharacterRepository, etc.)
│
├── application/                # Application Layer
│   └── ports/                  # Interfaces (IEventBus, IPacketProcessor, IConnection, IStateMachine)
│
├── infrastructure/             # Infrastructure Layer
│   ├── persistence/            # In-memory repository implementations
│   ├── event-bus/              # SimpleEventBus, SystemEventBus implementations
│   ├── cache/                  # InMemoryCacheManager, ICacheManager
│   ├── network/                # PacketSerializer, BufferPool
│   └── protocol/game/          # Packet processing (Factory + Strategy)
│       ├── packets/            # DTOs for incoming packets (UserInfoPacket, NpcInfoPacket, etc.)
│       ├── handlers/           # Strategy handlers (UserInfoHandler, NpcInfoHandler, etc.)
│       ├── PacketRegistry.ts   # Centralized packet registration
│       ├── PacketDecoder.ts    # Packet decoding logic
│       ├── GamePacketProcessor.ts
│       └── GameIncomingPacketFactory.ts
│
├── api/                        # API Layer (REST + WebSocket на порту 3000)
│   ├── ApiServer.ts            # Express REST server with Helmet, CORS
│   ├── routes/                 # API endpoints (character, combat, movement, chat, etc.)
│   ├── middleware/             # Auth, rate limiting, request ID
│   └── ws/WsServer.ts          # WebSocket server (shared mode)
│
├── ws/                         # Standalone WebSocket Vision API (порт 3001)
│   ├── WsServer.ts             # WsApiServer с throttling/batching
│   ├── HttpEndpoints.ts        # HTTP endpoints для снимков GameState
│   └── auth.ts                 # Timing-safe аутентификация
│
├── game/                       # Game Server Phase + GameState
│   ├── GameClient.ts           # FSM-driven game client
│   ├── GameCrypt.ts            # XOR encryption (disabled for CT0)
│   ├── GameCommandManager.ts   # Command manager singleton
│   ├── GameState.ts            # Единое in-memory хранилище состояния
│   ├── GameStateUpdater.ts     # Мост между пакетами и GameState
│   ├── entities/types.ts       # TypeScript интерфейсы для API
│   ├── dictionaries/           # Словари имён
│   │   ├── classNames.ts       # Маппинг classId → имя класса
│   │   ├── npcNames.ts         # Маппинг npcId → имя NPC
│   │   ├── itemNames.ts        # Маппинг itemId → имя предмета
│   │   └── index.ts
│   ├── packets/outgoing/       # Outgoing game packets
│   └── IGameClient.ts
│
├── network/                    # TCP & Packet Layer
│   ├── Connection.ts           # TCP client with L2 framing
│   ├── PacketReader.ts         # Binary reader (little-endian)
│   └── PacketWriter.ts         # Binary writer (little-endian)
│
├── crypto/                     # Encryption
│   ├── BlowfishEngine.ts       # Blowfish ECB implementation
│   ├── RSACrypt.ts             # RSA (1024-bit, NO_PADDING)
│   ├── NewCrypt.ts             # Blowfish + checksum + XOR wrapper
│   └── ScrambledRSAKey.ts      # RSA modulus unscrambling
│
├── login/                      # Login Server Phase
│   ├── LoginClient.ts          # FSM-driven login client
│   ├── LoginCrypt.ts           # Login crypto (Blowfish + XOR)
│   ├── packets/incoming/       # Incoming packet DTOs
│   ├── packets/outgoing/       # Outgoing packet builders
│   ├── protocol/handlers/      # Login packet handlers
│   ├── protocol/LoginPacketProcessor.ts
│   └── session/SessionManager.ts
│
├── data/                       # Game data
│   ├── ItemDatabase.ts
│   ├── NpcDatabase.ts
│   ├── SkillDatabase.ts
│   ├── types.ts
│   ├── constants.ts
│   └── slotMasks.ts
│
├── services/                   # Application services
│   └── GameDataService.ts
│
├── shared/                     # Shared utilities
│   ├── result/Result.ts        # Result<T,E> monad
│   ├── types/                  # Primitive types, utility types
│   └── utils/                  # BufferUtils, TimeUtils, TypeGuards
│
├── logger/                     # Logging utilities
│   └── Logger.ts
│
└── ui/                         # Dashboard UI
    └── Dashboard.ts
```

## Two-Phase Connection Model

### Phase 1: Login Server
```
IDLE → CONNECTING → WAIT_INIT → WAIT_GG_AUTH → WAIT_LOGIN_OK → 
WAIT_SERVER_LIST → WAIT_PLAY_OK → DONE
```
- **Encryption:** Static Blowfish → Dynamic Blowfish + XOR → RSA for credentials

### Phase 2: Game Server
```
IDLE → CONNECTING → WAIT_CRYPT_INIT → WAIT_CHAR_LIST → 
WAIT_CHAR_SELECTED → WAIT_USER_INFO → IN_GAME
```
- **Encryption:** XOR (disabled via CryptInit flag=0 for L2J Mobius CT0)

## Packet Format

- Each L2 packet starts with `uint16LE` length (including 2-byte header)
- Data types: C=uint8, H=uint16, D=int32, Q=int64, F=double, S=UTF-16LE null-terminated
- Extended packets (0xD0 opcode): `[2 bytes: size] [0xD0] [1 byte: extended ID] [payload...]`

## Build and Run Commands

```bash
# Development
npm install          # Install dependencies
npm run dev          # Run with ts-node (auto-connects to game)
npm run debug        # Verbose packet logging (LOG_LEVEL=DEBUG)

# Build & Production
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled code
npm run clean        # Remove dist/

# Testing
npm test             # Run all tests once
npm run test:watch   # Watch mode
npm run test:ui      # Vitest UI
npm run test:coverage # Coverage report

# Code Quality
npm run lint         # ESLint check
npm run lint:fix     # Auto-fix linting errors
npm run typecheck    # TypeScript type check only

# Data Export (from L2J_Mobius XML files)
npm run export:data  # Full XML → JSON conversion
```

## Configuration

Create `.env` file (copy from `.env.example`):

```bash
# L2 Server Connection
L2_LOGIN_IP=192.168.0.33
L2_LOGIN_PORT=2106
L2_GAME_PORT=7777
L2_USERNAME=your_login
L2_PASSWORD=your_password
L2_SERVER_ID=2
L2_CHAR_SLOT=0
L2_PROTOCOL=746

# API
API_KEY=             # Empty = no auth required
API_PORT=3000
LOG_LEVEL=ERROR      # DEBUG | INFO | WARN | ERROR | SILENT
AUTO_CONNECT_GAME=true

# WebSocket Vision API (Port 3001)
WS_ENABLED=true          # Enable standalone WebSocket API
WS_PORT=3001             # Port for WebSocket server
WS_AUTH_ENABLED=false    # Enable token authentication
WS_AUTH_TOKENS=          # Comma-separated valid tokens
WS_MAX_CLIENTS=10        # Maximum concurrent clients
WS_BATCH_INTERVAL=50     # Event batching interval in ms (0 = disabled)
WS_MOVE_THROTTLE_MS=100  # Move event throttling in ms per object
```

Configuration is validated using **Zod** schemas at startup. Invalid configuration will cause the process to exit with detailed error messages.

## TypeScript Configuration

- **Target:** ES2022
- **Module:** CommonJS
- **Strict mode:** Enabled with all strict flags
- **Path aliases:**
  - `@/*` → `src/*`
  - `@domain/*` → `src/domain/*`
  - `@application/*` → `src/application/*`
  - `@infrastructure/*` → `src/infrastructure/*`
  - `@shared/*` → `src/shared/*`
  - `@core/*` → `src/core/*`

## Code Style Guidelines

### Naming Conventions

- **Classes/Interfaces:** PascalCase (e.g., `GameClient`, `ICharacterRepository`)
- **Methods/Properties:** camelCase (e.g., `getCharacter`, `updatePosition`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `MAX_PACKET_SIZE`)
- **Files:** PascalCase for classes, camelCase for utilities
- **Private fields:** Use `private` or `private readonly` modifier

### ESLint Rules

- `@typescript-eslint/no-explicit-any`: warn
- `@typescript-eslint/no-unused-vars`: warn (ignores `_` prefix)
- `@typescript-eslint/no-non-null-assertion`: off
- `prefer-const`: off

### Code Organization

- One class/interface per file
- Use `index.ts` for clean exports from directories
- Prefer interfaces over type aliases for public APIs
- Use `readonly` for immutable properties
- Comments in source code are primarily in **Russian**

## Testing Strategy

- **Framework:** Vitest v2.1.4
- **Test Location:** `tests/` directory + `src/__tests__/`
- **Pattern:** `**/*.test.ts`
- **Setup:** `tests/setup.ts`
- **Coverage:** HTML, JSON, text reports

### Test Categories

1. **Unit tests:** Domain entities, value objects (`tests/new-architecture/domain/`)
2. **Integration tests:** Packet encoding/decoding (`tests/integration/`)
3. **Infrastructure tests:** Repositories, EventBus, StateMachine (`tests/new-architecture/infrastructure/`)
4. **Performance tests:** BufferPool, CacheManager, PacketSerializer (`tests/performance/`)
5. **GameState tests:** (`src/__tests__/`) - GameState, GameStateUpdater, WsServer

### Test Statistics

- ✅ **168 tests passing**
- ✅ TypeScript compilation — no errors
- ✅ No circular dependencies detected
- ✅ Build successful

### Test Utilities

- `setupPacketTest()` - Helper for packet tests with mock server
- `setupApiTest()` - Helper for API tests
- `waitForEvent<T>()` - Wait for specific event with timeout
- `waitForCondition()` - Wait for condition with polling

## Dependency Injection

The project uses a custom DI container with `Result<T,E>` monad for error handling:

```typescript
// Tokens
DI_TOKENS.CharacterRepository
DI_TOKENS.WorldRepository
DI_TOKENS.EventBus
DI_TOKENS.PacketProcessor
DI_TOKENS.GameState           // GameState singleton
DI_TOKENS.GameStateUpdater    // GameStateUpdater middleware
DI_TOKENS.WsApiServer         // WebSocket Vision API server
// ... etc

// Usage
const container = getContainer();
const result = container.resolve<IEventBus>(DI_TOKENS.EventBus);
if (result.isOk()) {
    const eventBus = result.getOrThrow();
    // use eventBus
}
```

## API Endpoints

### Public (No Auth)
- `GET /health` - Health check
- `GET /` - Dashboard
- `GET /api-docs` - API documentation (Scalar)
- `GET /openapi.json` - OpenAPI spec

### Protected Endpoints (require API_KEY if set)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/status` | GET | Connection status |
| `/api/v1/character` | GET | Character state |
| `/api/v1/character/stats` | GET | Character stats |
| `/api/v1/character/skills` | GET | Character skills |
| `/api/v1/inventory` | GET | Inventory contents |
| `/api/v1/target` | GET/POST | Target management |
| `/api/v1/combat/attack` | POST | Attack target |
| `/api/v1/combat/use-skill` | POST | Use skill |
| `/api/v1/move/to` | POST | Move to position |
| `/api/v1/nearby/npcs` | GET | Nearby NPCs |
| `/api/v1/chat/say` | POST | Send chat message |
| `/api/v1/connect` | POST | Connect to game |
| `/api/v1/disconnect` | POST | Disconnect |

### Rate Limits

- Movement commands: 10 req/s
- Combat commands: 5 req/s
- General read: 100 req/s

## WebSocket Vision API (Port 3001)

Standalone WebSocket API сервер для трансляции игрового состояния в реальном времени.

**Конфигурация (.env):**
```bash
WS_ENABLED=true          # Включить WebSocket API
WS_PORT=3001             # Порт сервера
WS_AUTH_ENABLED=false    # Авторизация по токену
WS_AUTH_TOKENS=          # Список токенов через запятую
WS_MAX_CLIENTS=10        # Максимум клиентов
WS_BATCH_INTERVAL=50     # Интервал батчинга (мс)
WS_MOVE_THROTTLE_MS=100  # Троттлинг движения (мс)
```

**HTTP эндпоинты (порт 3001):**
- `GET /api/v1/snapshot` - Полный снимок GameState
- `GET /api/v1/me` - Данные персонажа
- `GET /api/v1/players` - Список игроков
- `GET /api/v1/npcs` - Список NPC
- `GET /api/v1/inventory` - Инвентарь
- `GET /api/v1/chat` - История чата
- `GET /api/v1/stats` - Статистика сервера
- `GET /api/v1/health` - Health check

**Каналы подписки:** `*`, `me`, `players`, `npcs`, `items`, `inventory`, `combat`, `chat`, `party`, `effects`, `target`, `movement`, `skills`

**Оптимизации:**
- Throttling для `entity.move` (100ms на объект)
- Batching событий (50ms интервал)
- Метрики: eventsPerSecond, droppedMoveEvents, totalEventsSent

**Примеры клиентов:**
- `examples/ws-client-node.js` - Node.js клиент
- `examples/ws-client-python.py` - Python клиент

## Adding New Packets

1. Create Packet DTO in `src/infrastructure/protocol/game/packets/`
2. Create Handler in `src/infrastructure/protocol/game/handlers/`
3. Register in `src/infrastructure/protocol/game/PacketRegistry.ts`
4. Add event type to domain events if needed

Example packet structure:
```typescript
export class MyPacket implements IIncomingPacket {
    readonly opcode = 0xXX;
    
    decode(reader: IPacketReader): this {
        // Read packet data
        return this;
    }
    
    getData(): MyData {
        return { ...this.data };
    }
}
```

## Documentation Files

| File | Purpose |
|------|---------|
| `docs/DOCUMENTATION.md` | Full API documentation (Russian) |
| `docs/client_server_protocol.md` | Protocol specification (SOURCE OF TRUTH) |
| `CLAUDE.md` | Claude Code guidance |
| `readme.md` | User-facing README |

**Important:** `docs/client_server_protocol.md` is the single source of truth for protocol details. Do not modify it. Code in `src/` must match the protocol documentation.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/copy-dashboard.js` | Copy dashboard files to dist/ |
| `scripts/export-xml.js` | Export XML data from L2J_Mobius |
| `scripts/normalize-database.js` | Normalize exported data |
| `scripts/bump-version.js` | Version bumping for commits |

## Security Considerations

- Credentials stored in `.env` (gitignored)
- API key authentication optional (`API_KEY` in config)
- Rate limiting on sensitive endpoints
- Helmet middleware for HTTP security headers
- CORS enabled for API access
- Content Security Policy configured for Scalar CDN

## Common Issues

1. **Connection fails:** Check server IP/port in `.env`
2. **Protocol mismatch:** Ensure server uses Protocol 746
3. **Login fails:** Verify credentials and ServerId
4. **Packet errors:** Check `docs/client_server_protocol.md` for format

## Language Notes

- Comments in source code are primarily in **Russian**
- This AGENTS.md file must be in **English**
- User-facing documentation is in Russian
