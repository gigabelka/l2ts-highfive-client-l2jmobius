# CLAUDE.md

**Language:** Always respond to the user in Russian.

**IMPORTANT:** This file (CLAUDE.md) must always be written in English only.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **headless Lineage 2 client** for L2J Mobius CT_2.6_HighFive servers. It connects to a Login Server, authenticates with credentials, selects a character, enters the game world, and maintains a ping/pong keepalive connection.

**Target Server:** L2J_Mobius CT_2.6_HighFive (Protocol 267)
**Node.js:** 24.14.0
**Version:** 0.4.9

## Common Commands

```bash
npm install       # Install dependencies
npm run dev       # Run the client (silent logging)
npm run debug     # Run with verbose packet logging
npm run build     # Compile TypeScript to dist/
npm start         # Run production build

# Testing
npm test          # Run tests once
npm run test:watch # Run tests in watch mode
npm run test:ui   # Run Vitest UI
npm run test:coverage # Run tests with coverage

# Code Quality
npm run lint      # Check for linting errors
npm run lint:fix  # Auto-fix linting errors
npm run typecheck # Type checking without emit

# Data Export (requires L2J Mobius stats/ folder in project root)
npm run export:data # Full export: XML → JSON conversion + normalization

# Development
npm run clean     # Remove dist/ folder
npm run commit    # Bump version and commit changes
```

## Architecture

The project follows **Clean Architecture** principles with a layered approach:

### Clean Architecture Layers

- **Domain Layer** (`domain/`): Business entities, value objects, events, repository interfaces
- **Application Layer** (`application/`): Application services, use cases, port interfaces
- **Infrastructure Layer** (`infrastructure/`): Concrete implementations, packet processing, persistence
- **API Layer** (`api/`): REST endpoints, WebSocket server, middleware

### Dependency Injection

Uses a custom DI container (`config/di/`) with lazy initialization. All dependencies are resolved through the container using DI_TOKENS.

Key tokens:
- `DI_TOKENS.EventBus` - Event bus for domain events
- `DI_TOKENS.SystemEventBus` - System event bus
- `DI_TOKENS.CharacterRepository` - Character state repository
- `DI_TOKENS.WorldRepository` - World entities repository
- `DI_TOKENS.InventoryRepository` - Inventory repository
- `DI_TOKENS.PacketProcessor` - Game packet processor
- `DI_TOKENS.PacketSerializer` - Outgoing packet serializer

### GameState Architecture

**GameState** (`src/game/GameState.ts`) is a centralized in-memory store for all game state:
- `me` - Current character data
- `players` - Map of nearby players
- `npcs` - Map of visible NPCs
- `items` - Map of items on ground
- `inventory` - Character inventory
- `skills` - Character skills
- `party` - Party members
- `chat` - Chat history (last 50 messages)
- `effects` - Active buffs/debuffs
- `target` - Current target info

**GameStateUpdater** (`src/game/GameStateUpdater.ts`) bridges incoming packets and GameState:
- Processes decoded packets and updates GameState
- Emits `ws:event` for WebSocket Vision API
- Handles: UserInfo, CharInfo, NpcInfo, MoveToLocation, DeleteObject, StatusUpdate, Die, Revive, CreatureSay, AbnormalStatusUpdate, MagicSkillUse, MyTargetSelected, TargetUnselected

### Two-Phase Connection Model

The client uses FSM-driven clients for both connection phases:

#### Phase 1: Login Server (LoginClient)

- **Flow:** Init → GGAuth → AuthLogin → ServerList → PlayOk → disconnect
- **Crypto:** Static Blowfish for Init, dynamic Blowfish + XOR for rest, RSA for credentials
- **State Enum:** `LoginState` (IDLE, CONNECTING, WAIT_INIT, WAIT_GG_AUTH, WAIT_LOGIN_OK, WAIT_SERVER_LIST, WAIT_PLAY_OK, DONE, ERROR)

#### Phase 2: Game Server (GameClient)

- **Flow:** ProtocolVersion (0x00) → CryptInit (0x00) → AuthRequest (0x08) → CharSelectInfo (0x13) → CharacterSelected (0x0D) → CharSelected (0x15) → (0x9D + 0xD0-08-00 + EnterWorld 0x03) → UserInfo (0x04) → IN_GAME (ping/pong)
- **Crypto:** Encryption is disabled via flag sent in CryptInit (L2J Mobius CT0 specific)
- **State Enum:** `GameState` (IDLE, CONNECTING, WAIT_CRYPT_INIT, WAIT_CHAR_LIST, WAIT_CHAR_SELECTED, WAIT_USER_INFO, IN_GAME, ERROR)

### Event-Driven Architecture

Uses typed EventBus for loose coupling between components. Events are published from packet handlers and consumed by API layers.

Domain events include:
- `CharacterEvents` - Character state changes, level up, buffs
- `WorldEvents` - NPC spawn/despawn, items, combat
- `ConnectionEvents` - Connection state changes
- `ChatEvents` - Chat messages

### External APIs

- **REST API** (port 3000): HTTP endpoints for character control, combat, movement, inventory
- **WebSocket API** (port 3000/ws): Real-time game event streaming with channel-based subscriptions
- **WebSocket Vision API** (port 3001): Standalone high-performance WebSocket server for GameState streaming
- **Dashboard**: Web UI for monitoring client state and manual control

**CRITICAL:** The client strictly mimics the packet layout and padding observed in Wireshark captures to successfully connect.

## Directory Structure

```
src/
├── index.ts                    # Entry point with DI container bootstrap
├── config.ts                   # Environment configuration (Zod validation)
├── config/                     # Configuration and DI container
│   ├── di/
│   │   ├── Container.ts        # DI container with Result<T,E>
│   │   ├── appContainer.ts     # Singleton instance
│   │   └── composition.ts      # Service registration
│   └── ...
├── api/                        # REST API + WebSocket server
│   ├── ApiServer.ts           # Express server
│   ├── routes/                # HTTP endpoints
│   ├── middleware/            # Auth, rate limiting
│   └── ws/                    # WebSocket server
├── domain/                     # Business logic layer
│   ├── entities/              # Character, Npc, Item
│   ├── value-objects/         # Position, Vitals, Stats
│   ├── events/                # Domain events
│   └── repositories/          # Repository interfaces
├── application/                # Application service layer
│   └── ports/                 # Interface definitions
├── infrastructure/             # Implementation layer
│   ├── persistence/           # In-memory repositories
│   ├── event-bus/             # EventBus implementation
│   ├── protocol/game/         # Packet processing
│   └── network/               # PacketSerializer, BufferPool
├── network/                    # TCP & Packet Layer
│   ├── Connection.ts          # TCP client
│   ├── PacketReader.ts        # Binary reader
│   └── PacketWriter.ts        # Binary writer
├── crypto/                     # Encryption Layer
│   ├── BlowfishEngine.ts      # Blowfish ECB
│   ├── RSACrypt.ts            # RSA encryption
│   └── NewCrypt.ts            # Blowfish wrapper
├── login/                      # Login server client
│   ├── LoginClient.ts         # FSM login client
│   ├── LoginCrypt.ts          # Login crypto
│   └── packets/               # Login packets
├── game/                       # Game server client
│   ├── GameClient.ts          # FSM game client
│   ├── GameCrypt.ts           # XOR encryption
│   └── packets/               # Game packets
└── data/                       # Game data (items, NPCs, skills)
```

## Key Implementation Details

- **Packet framing:** Each L2 packet starts with uint16LE length (including the 2-byte header)
- **Two crypto systems:** Login uses Blowfish ECB (NewCrypt → BlowfishEngine), Game uses XOR (GameCrypt, disabled for CT0)
- **RSA encryption:** 1024-bit with NO_PADDING, modulus must be unscrambled first using ScrambledRSAKey
- **Packet format types:** C=uint8, H=uint16, D=int32, Q=int64, F=double, S=UTF-16LE null-terminated string
- **Game Server ProtocolVersion:** Uses opcode 0x00 (NOT 0x0B), confirmed from working Wireshark capture

## Configuration

The project uses environment variables via `.env` file:

```bash
# L2 Server Connection
L2_LOGIN_IP=192.168.0.33         # Login server IP address
L2_LOGIN_PORT=2106               # Login server port
L2_GAME_PORT=7777                # Game server port
L2_USERNAME=your_login           # Game account login
L2_PASSWORD=your_password        # Game account password
L2_SERVER_ID=2                   # Server ID from server list
L2_CHAR_SLOT=0                   # Character slot (0-based index)
L2_PROTOCOL=267                  # HighFive protocol version

# API
API_KEY=                         # API authentication key (empty = no auth)
API_PORT=3000                    # API server port

# Logging
LOG_LEVEL=ERROR                  # DEBUG, INFO, WARN, ERROR, SILENT
AUTO_CONNECT_GAME=true           # Auto-connect on startup
```

Copy `.env.example` to `.env` and configure your settings. Configuration is validated using Zod schemas at startup.

## Data Export

The project can export game data from L2J Mobius server XML files:

1. **Download L2J_Mobius CT_0 Interlude** from GitLab
2. **Copy `data/stats` folder** from server to project root (next to `package.json`)
3. **Run export command**: `npm run export:data`

Exported data is saved to `src/data/export/` in JSON format (items, NPCs, skills, armorsets, etc.).

## Documentation Source of Truth

**IMPORTANT:** The following files are the single source of truth and **MUST NOT BE EDITED**:

- `docs/client_server_protocol.md` — client-server protocol documentation

All information about protocol, packet formats and crypto must be taken exclusively from these files. Code in `src/` must match them, not the other way around.

**docs/DOCUMENTATION.md** is a documentation file that must always be kept up to date. It must be regularly updated based on newly received information. This file should contain the most current and accurate information about the project.

## Debugging

- Use `npm run debug` for verbose packet logging (instead of manually setting Logger.level)
- Monitor `[STATE]` log lines to track FSM transitions
- Use `npm run test:watch` for TDD development
- Check Dashboard at `http://localhost:3000` for real-time client state
- WebSocket events can be monitored via browser DevTools or WebSocket clients
- Check `docs/client_server_protocol.md` for detailed packet formats and crypto specifications

## API Access

- **REST API**: `http://localhost:3000/api/v1/*`
- **WebSocket**: `ws://localhost:3000/ws`
- **API Documentation**: `http://localhost:3000/api-docs`
- **Dashboard**: `http://localhost:3000`
- **Detailed API Reference**: See README.md for full endpoint documentation

## Adding New Packets

The project uses Factory + Strategy pattern for packet processing:

1. **Create Packet DTO** in `infrastructure/protocol/game/packets/` with `decode()` method
2. **Create Handler** in `infrastructure/protocol/game/handlers/` extending `BasePacketHandlerStrategy`
3. **Register in PacketRegistry** - add to `PACKET_REGISTRY` array with opcode mapping
4. **Add Event Types** in `domain/events/` if emitting new events

Handlers receive dependencies via DI (characterRepo, worldRepo, eventBus) and should:
- Check `canHandleInState()` for valid game states
- Update domain repositories
- Publish typed events via EventBus

## WebSocket Channels

Available subscription channels:
- `system` - Connection status, errors
- `character` - HP/MP/CP changes, level up, buffs
- `combat` - Attacks, damage, deaths
- `chat` - Chat messages
- `world` - NPC spawn/despawn, items
- `movement` - Position changes
- `party` - Party events
- `inventory` - Inventory changes

## WebSocket Vision API (Port 3001)

Standalone WebSocket server (`src/ws/WsServer.ts`) that streams GameState updates with optimizations:

**Features:**
- Throttling for `entity.move` events (100ms per object)
- Batching of events (50ms interval)
- Metrics: eventsPerSecond, droppedMoveEvents, totalEventsSent
- HTTP endpoints for snapshots: `/api/v1/snapshot`, `/api/v1/me`, `/api/v1/npcs`, etc.

**Subscription channels:** `*`, `me`, `players`, `npcs`, `items`, `inventory`, `combat`, `chat`, `party`, `effects`, `target`, `movement`, `skills`

**Client examples:**
- `examples/ws-client-node.js` - Node.js client with colored output
- `examples/ws-client-python.py` - Python asyncio client

## Testing

- **Framework:** Vitest
- **Unit tests:** Domain entities, value objects
- **Integration tests:** Packet encoding/decoding, API endpoints
- **Performance tests:** BufferPool, CacheManager

Run tests with:
```bash
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

## Code Style

- One class/interface per file
- PascalCase for classes/interfaces, camelCase for methods
- Use `readonly` for immutable properties
- Prefer interfaces over type aliases
- Comments in Russian (domain language)
