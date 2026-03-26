# L2J Mobius CT-0 Interlude Protocol Documentation

This document provides detailed technical specifications for the Lineage 2 Interlude client-server communication protocol. It is designed for Large Language Models (LLMs) developing a Node.js 24.14.0 + TypeScript client.

---

## Table of Contents

1. [Overview](#overview)
2. [Packet Structure](#part-1-packet-structure)
3. [Login Server Protocol](#part-2-login-server-protocol)
4. [Login Server Encryption](#part-3-login-server-encryption)
5. [Game Server Protocol](#part-4-game-server-protocol)
6. [Game Server Encryption](#part-5-game-server-encryption-xor-based)
7. [Blowfish Implementation Reference](#part-6-blowfish-implementation-reference)
8. [Checksum Implementation](#part-7-checksum-implementation)
9. [Implementation Notes for Node.js Client](#part-8-implementation-notes-for-nodejs-client)
10. [Packet ID Reference](#reference-packet-id-summary)

---

## Overview

L2J Mobius is an open-source Lineage 2 Interlude server emulator. The protocol operates in two distinct phases:

1. **Login Server Phase** - Authentication and server selection
2. **Game Server Phase** - Gameplay communication

Both use TCP connections on different ports:
- **Login Server**: Default port 2106
- **Game Server**: Default port 7777

---

## Part 1: Packet Structure

### Basic Packet Format

All packets follow this structure:

```
[2 bytes: packet size (little-endian)] [1 byte: packet ID] [payload...]
```

The packet size includes the 2 bytes of the size field itself.

**Example:**
```
0x0F 0x00  01  00 01 02 03 04 05 06 07 08 09 10 11
|size|  |ID |  |------------- payload ------------|
```

### Extended Packets (0xD0 opcode)

For packets with IDs >= 0xD0:

```
[2 bytes: packet size] [0xD0] [1 byte: extended ID] [payload...]
```

### Byte Order

- All multi-byte integers are **little-endian** (least significant byte first)
- String encoding: UTF-8 or system default

### Reading Packets

```typescript
import { Buffer } from 'buffer';

function readPacket(buffer: Buffer): { size: number; id: number; payload: Buffer } {
    const size = buffer.readUInt16LE(0);
    const id = buffer.readUInt8(2);
    const payload = buffer.subarray(3, size);
    return { size, id, payload };
}
```

---

## Part 2: Login Server Protocol

### Connection Flow

```
Client                    Login Server
   |                           |
   |-------- TCP Connect ----->|
   |                           |
   |<----- Init (0x00) --------|  (RSA public key + Blowfish key)
   |                           |
   |--- RequestAuthLogin ---->|  (credentials encrypted with RSA)
   |      (0x01)              |
   |                           |
   |<---- LoginOk (0x03) -----|  or LoginFail (0x04)
   |      / LoginFail         |
   |                           |
   |-- RequestServerList ---->|  (0x05)
   |                           |
   |<---- ServerList (0x04) ---|
   |                           |
   |-- RequestServerLogin --->|  (0x02) - connect to game server
   |                           |
   |<---- PlayOk (0x05) -------|  (session key for game server)
```

### Detailed Packet Specifications

#### 1. Init Packet (0x00) - Server to Client

Sent immediately upon TCP connection. This is the first unencrypted packet.

**Structure:**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 1 | Packet ID: 0x00 |
| 1 | 4 | Session ID (int32, little-endian) |
| 5 | 4 | Protocol revision: 0x0000c621 (50721 for Interlude) |
| 9 | 128 | RSA Public Key (scrambled modulus, see below) |
| 137 | 4 | GG seed 1: 0x29DD954E |
| 141 | 4 | GG seed 2: 0x77C39CFC |
| 145 | 4 | GG seed 3: 0x97ADB620 |
| 149 | 4 | GG seed 4: 0x07BDE0F7 |
| 153 | 17 | Blowfish key (16 bytes) + null terminator |

#### RSA Key Scrambling Algorithm

The RSA modulus is scrambled to prevent easy identification. The server applies these transformations:

```typescript
function scrambleModulus(modulus: Buffer): Buffer {
    // Make a copy if needed
    let scrambled = Buffer.from(modulus);

    // Step 1: Swap bytes 0x00-0x03 with bytes 0x4D-0x50
    const temp0 = scrambled.subarray(0, 4);
    scrambled.subarray(0, 4).copy(scrambled, 0x4D);
    temp0.copy(scrambled, 0x00);

    // Step 2: XOR first 0x40 bytes with last 0x40 bytes
    for (let i = 0; i < 0x40; i++) {
        scrambled[i] ^= scrambled[0x40 + i];
    }

    // Step 3: XOR bytes 0x0D-0x10 with bytes 0x34-0x38
    for (let i = 0; i < 4; i++) {
        scrambled[0x0D + i] ^= scrambled[0x34 + i];
    }

    // Step 4: XOR last 0x40 bytes with first 0x40 bytes
    for (let i = 0; i < 0x40; i++) {
        scrambled[0x40 + i] ^= scrambled[i];
    }

    return scrambled;
}
```

#### 2. RequestAuthLogin (0x01) - Client to Server

Sent after receiving Init packet.

**Structure:**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 1 | Packet ID: 0x01 |
| 1 | 128 | RSA-encrypted login data |

**Login Data (before RSA encryption):**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 15 | Username (null-padded) |
| 15 | 16 | Password (null-padded) |
| 31 | 1 | Reserved: 0x00 |
| 32 | 4 | Session ID (from Init packet) |
| 36 | 4 | Protocol revision |
| 40 | 9 | Reserved padding |

```typescript
function createAuthLoginPacket(
    username: string,
    password: string,
    sessionId: number,
    publicKey: Buffer
): Buffer {
    const loginData = Buffer.alloc(49);

    // Username (15 bytes, null-padded)
    Buffer.from(username).copy(loginData, 0, 15);

    // Password (16 bytes, null-padded)
    Buffer.from(password).copy(loginData, 15, 16);

    // Reserved
    loginData[31] = 0x00;

    // Session ID
    loginData.writeUInt32LE(sessionId, 32);

    // Protocol revision
    loginData.writeUInt32LE(0x0000c621, 36);

    // RSA encrypt
    // Note: Use the scrambled modulus with private key
    const encrypted = rsaEncrypt(loginData, publicKey);

    // Create packet
    const packet = Buffer.alloc(1 + encrypted.length);
    packet[0] = 0x01;
    encrypted.copy(packet, 1);

    return packet;
}
```

#### 3. LoginOk (0x03) - Server to Client

Sent on successful authentication.

**Structure:**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 1 | Packet ID: 0x03 |
| 1 | 4 | Session ID 1 |
| 5 | 4 | Session ID 2 |
| 9 | 4 | Login OK: 0x00000000 |

#### 4. LoginFail (0x04) - Server to Client

Sent on failed authentication.

**Structure:**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 1 | Packet ID: 0x04 |
| 1 | 4 | Reason code |

**Reason Codes:**
- 0x01: Incorrect password
- 0x02: Account does not exist
- 0x03: Access denied
- 0x04: Account or IP banned
- 0x07: Service unavailable

#### 5. RequestServerList (0x05) - Client to Server

Sent after successful login to get server list.

**Structure:**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 1 | Packet ID: 0x05 |
| 1 | 4 | Session ID |

#### 6. ServerList (0x04) - Server to Client

**Structure:**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 1 | Packet ID: 0x04 |
| 1 | 2 | Server count |
| 3+ | Per server data | See below |

**Per Server Entry:**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 2 | Server ID |
| 2 | 1 | Server age limit |
| 3 | 1 | Server brackets |
| 4 | 30 | Server name (null-terminated) |
| 34 | 4 | Server IP (4 bytes) |
| 38 | 2 | Server port |
| 40 | 1 | Online players |
| 41 | 2 | Max players |
| 43 | 1 | Server type |

#### 7. RequestServerLogin (0x02) - Client to Server

Sent to connect to a specific game server.

**Structure:**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 1 | Packet ID: 0x02 |
| 1 | 4 | Session ID |
| 5 | 1 | Server ID |
| 6 | 4 | Reserved: 0x00000000 |

#### 8. PlayOk (0x05) - Server to Client

Sent to authorize connection to game server.

**Structure:**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 1 | Packet ID: 0x05 |
| 1 | 4 | Session key part 1 |
| 5 | 4 | Session key part 2 |
| 9 | 4 | Play OK: 0x00000000 |

---

## Part 3: Login Server Encryption

The login server uses two encryption phases:

### Phase 1: Static XOR + Blowfish (First Packet Only)

For the first packet from client (RequestAuthLogin), encryption works differently:

**Static Blowfish Key:**
```typescript
const STATIC_BLOWFISH_KEY = Buffer.from([
    0x6b, 0x60, 0xcb, 0x5b, 0x82, 0xce, 0x90, 0xb1,
    0xcc, 0x2b, 0x6c, 0x55, 0x6c, 0x6c, 0x6c, 0x6c
]);
```

**XOR Encryption (encXORPass):**
Uses a random 4-byte key generated per packet:

```typescript
function encXORPass(buffer: Buffer, offset: number, size: number, key: number): void {
    const stop = size - 8;
    let pos = 4 + offset;
    let ecx = key; // Initial XOR key

    while (pos < stop) {
        let edx = buffer.readUInt32LE(pos);
        ecx += edx;
        edx ^= ecx;
        buffer.writeUInt32LE(edx, pos);
        pos += 4;
    }

    // Write the key as last 4 bytes (checksum)
    buffer.writeUInt32LE(ecx, pos);
}
```

Then apply Blowfish ECB encryption with the static key.

### Phase 2: Dynamic Blowfish + Checksum (Subsequent Packets)

For all packets after the first:

1. **Append XOR Checksum** (4 bytes at end)
2. **Blowfish ECB Encryption**

```typescript
function encryptLoginPacket(buffer: Buffer, blowfishKey: Buffer, isFirstPacket: boolean): void {
    if (isFirstPacket) {
        // XOR pass with random key
        const randomKey = Math.floor(Math.random() * 0xFFFFFFFF);
        encXORPass(buffer, 0, buffer.length, randomKey);

        // Static Blowfish encryption
        blowfishEcbEncrypt(buffer, STATIC_BLOWFISH_KEY);
    } else {
        // Append checksum
        appendChecksum(buffer, 0, buffer.length);

        // Dynamic Blowfish encryption
        blowfishEcbEncrypt(buffer, blowfishKey);
    }
}
```

---

## Part 4: Game Server Protocol

### Connection Flow

```
Client                    Game Server
   |                           |
   |-------- TCP Connect ----->|
   |                           |
   |--- ProtocolVersion (0x0E)->|  (initial handshake)
   |<---- KeyPacket (0xE9) -----|  (Blowfish key)
   |                           |
   |--- AuthLogin (0x2B) ----->|  (session key from login)
   |<--- CharSelectionInfo ----|  (character list)
   |                           |
   |-- CharacterSelect (0x36)->|
   |<--- CharSelected (0x1D)--|
   |                           |
   |--- EnterWorld (0x11) ---->|
   |                           |  (full game begins)
```

### Detailed Packets

#### 1. ProtocolVersion (0x0E) - Client to Server

Sent immediately upon connection. This is the first unencrypted packet.

**Structure:**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 1 | Packet ID: 0x0E |
| 1 | 1 | Protocol version: 0x5A (for Interlude) |

#### 2. KeyPacket (0xE9) - Server to Client

Sent in response to ProtocolVersion.

**Structure:**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 1 | Packet ID: 0xE9 |
| 1 | 1 | Result: 0 = wrong protocol, 1 = OK |
| 2 | 8 | 8-byte encryption key |
| 10 | 4 | Encryption flag |
| 14 | 4 | Server ID |
| 18 | 1 | Unknown: 0x01 |
| 19 | 4 | Obfuscation key: 0x00000000 |

**IMPORTANT**: The game server uses only the FIRST 8 BYTES of this key for XOR encryption (NOT Blowfish).

```typescript
interface KeyPacketData {
    result: number;
    key: Buffer;  // 8 bytes
    encryptionFlag: number;
    serverId: number;
}
```

#### 3. AuthLogin (0x2B) - Client to Server

Sent after receiving KeyPacket.

**Structure:**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 1 | Packet ID: 0x2B |
| 1 | 4 | Session key part 1 (from PlayOk) |
| 5 | 4 | Session key part 2 (from PlayOk) |
| 9 | 4 | Play key part 1 |
| 13 | 4 | Play key part 2 |
| 17 | 1 | Unknown: 0x00 |

#### 4. CharSelectionInfo (0x09) - Server to Client

**Structure:**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 1 | Packet ID: 0x09 |
| 1 | 4 | Session ID |
| 5 | 1 | Active flag |
| 6 | 4 | Unknown |

**Per Character Entry:**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 4 | Character ID |
| 4 | 20 | Name (null-padded) |
| 24 | 2 | Race |
| 26 | 1 | Class ID |
| 27 | 1 | Sex |
| 28 | 2 | Skin color |
| 30 | 2 | Hair style |
| 32 | 2 | Hair color |
| 34 | 1 | Face |
| ... | ... | More fields |

#### 5. CharacterSelect (0x36) - Client to Server

**Structure:**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 1 | Packet ID: 0x36 |
| 1 | 4 | Character ID |
| 5 | 4 | Unknown: 0x00000000 |

#### 6. CharSelected (0x1D) - Server to Client

**Structure:**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 1 | Packet ID: 0x1D |
| 1 | 4 | Character ID |
| 5 | ... | Character details |

#### 7. EnterWorld (0x11) - Client to Server

Sent after character selection to enter the game world.

**Structure:**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 1 | Packet ID: 0x11 |

---

## Part 5: Game Server Encryption

**IMPORTANT**: For L2J Mobius CT_0_Interlude, encryption is **DISABLED** by the server.

The CryptInit packet (0x00) contains an encryption flag (`useEncryption` / `useBlowfish`):
- If flag = 0: Encryption is DISABLED — all packets pass through unchanged
- If flag != 0: Encryption is ENABLED — use XOR cipher

### When Encryption is Disabled (L2J Mobius CT0)

```typescript
class GameCrypt {
    private enabled: boolean = false;

    initKey(xorKeyData: Buffer, enableEncryption: boolean): void {
        // For L2J Mobius CT0, enableEncryption is always 0
        this.enabled = enableEncryption;
    }

    encrypt(data: Buffer): Buffer {
        if (!this.enabled) return data;  // Pass-through
        // XOR encryption (not used for CT0)
    }

    decrypt(data: Buffer): Buffer {
        if (!this.enabled) return data;  // Pass-through
        // XOR decryption (not used for CT0)
    }
}
```

### XOR Encryption (For Servers With Encryption Enabled)

If the server sends a non-zero flag, use this simple XOR algorithm:

```typescript
class GameCrypt {
    private key: Buffer;
    private enabled: boolean = false;

    initKey(xorKeyData: Buffer, enableEncryption: boolean): void {
        this.key = Buffer.from(xorKeyData);  // 8 bytes
        this.enabled = enableEncryption;
    }

    encrypt(data: Buffer): Buffer {
        if (!this.enabled) return data;

        const result = Buffer.alloc(data.length);
        for (let i = 0; i < data.length; i++) {
            result[i] = data[i] ^ this.key[i & 7];
        }
        return result;
    }
}
```

---

## Part 6: Blowfish Implementation Reference

For Node.js, you can use the built-in `crypto` module with Blowfish ECB:

### Using Node.js crypto

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const STATIC_BLOWFISH_KEY = Buffer.from([
    0x6b, 0x60, 0xcb, 0x5b, 0x82, 0xce, 0x90, 0xb1,
    0xcc, 0x2b, 0x6c, 0x55, 0x6c, 0x6c, 0x6c, 0x6c
]);

function blowfishEcbEncrypt(data: Buffer, key: Buffer): Buffer {
    const cipher = createCipheriv('bf-ecb', key, null);
    cipher.setAutoPadding(false);
    return Buffer.concat([cipher.update(data), cipher.final()]);
}

function blowfishEcbDecrypt(data: Buffer, key: Buffer): Buffer {
    const decipher = createDecipheriv('bf-ecb', key, null);
    decipher.setAutoPadding(false);
    return Buffer.concat([decipher.update(data), decipher.final()]);
}
```

### Blowfish ECB Parameters

- **Algorithm**: Blowfish
- **Mode**: ECB (Electronic Codebook)
- **Block size**: 8 bytes (64 bits)
- **Key size**: 16 bytes (128 bits)
- **Rounds**: 16
- **Padding**: None (must be multiple of 8 bytes)

### Packet Padding for Blowfish

When encrypting with Blowfish, the data must be a multiple of 8 bytes:

```typescript
function padForBlowfish(data: Buffer): Buffer {
    const padding = 8 - (data.length % 8);
    if (padding === 8) return data;

    const padded = Buffer.alloc(data.length + padding);
    data.copy(padded, 0);
    // Fill with padding value (same as padding length)
    padded.fill(padding, data.length);
    return padded;
}
```

---

## Part 7: Checksum Implementation (XOR)

Every packet (except Init and KeyPacket) must have an XOR checksum appended.

### Append Checksum

```typescript
function appendChecksum(data: Buffer, offset: number, size: number): void {
    // XOR all 4-byte blocks (excluding last 4 bytes which will hold checksum)
    let checksum = 0;
    const count = size - 4;

    for (let i = offset; i < count; i += 4) {
        const value = data.readUInt32LE(i);
        checksum ^= value;
    }

    // Write checksum as last 4 bytes
    data.writeUInt32LE(checksum, count);
}
```

### Verify Checksum

```typescript
function verifyChecksum(data: Buffer, offset: number, size: number): boolean {
    // Size must be multiple of 4 and greater than 4
    if ((size & 3) !== 0 || size <= 4) {
        return false;
    }

    let checksum = 0;
    const count = size - 4;

    // Compute checksum of all data except last 4 bytes
    for (let i = offset; i < count; i += 4) {
        const value = data.readUInt32LE(i);
        checksum ^= value;
    }

    // Get stored checksum from last 4 bytes
    const storedCheck = data.readUInt32LE(count);

    return checksum === storedCheck;
}
```

---

## Part 8: Implementation Notes for Node.js Client

### Connection States

**Login Server States:**
```typescript
enum LoginServerState {
    CONNECTED = 0,       // Just connected
    AUTHED = 1,          // Successfully authenticated
    IN_GAME_LIST = 2,    // Received server list
    CONNECTING_TO_GAME = 3  // Requested game server connection
}
```

**Game Server States:**
```typescript
enum GameServerState {
    CONNECTED = 0,   // Just connected
    AUTHED = 1,      // Authenticated with session key
    IN_GAME = 2      // Character selected, in game world
}
```

### Full Login Flow Example

```typescript
import { Socket } from 'net';
import { createDecipheriv, createCipheriv, randomBytes } from 'crypto';

class L2LoginClient {
    private socket: Socket;
    private state: LoginServerState = LoginServerState.CONNECTED;
    private sessionId: number = 0;
    private blowfishKey: Buffer | null = null;
    private isFirstPacket: boolean = true;
    private rsaPrivateKey: Buffer | null = null;

    constructor() {
        this.socket = new Socket();
    }

    async connect(host: string, port: number = 2106): Promise<void> {
        return new Promise((resolve, reject) => {
            this.socket.connect(port, host);

            this.socket.on('connect', () => {
                console.log('Connected to login server');
                resolve();
            });

            this.socket.on('data', (data) => {
                this.handleData(data);
            });

            this.socket.on('error', reject);
        });
    }

    private handleData(data: Buffer): void {
        const packetId = data.readUInt8(2);

        switch (packetId) {
            case 0x00:  // Init
                this.handleInit(data);
                break;
            case 0x03:  // LoginOk
                this.handleLoginOk(data);
                break;
            case 0x04:  // LoginFail or ServerList
                this.handleLoginFailOrServerList(data);
                break;
            case 0x05:  // PlayOk
                this.handlePlayOk(data);
                break;
        }
    }

    private handleInit(data: Buffer): void {
        // Extract session ID
        this.sessionId = data.readUInt32LE(1);

        // Extract Blowfish key (skip null terminator)
        this.blowfishKey = data.subarray(153, 169);

        // RSA key would be extracted here for encryption
        // ...

        this.state = LoginServerState.AUTHED;
    }

    // ... more handlers
}
```

### Full Game Server Flow Example

```typescript
class L2GameClient {
    private socket: Socket;
    private state: GameServerState = GameServerState.CONNECTED;
    private encryption: GameEncryption | null = null;
    private sessionKey: Buffer | null = null;

    async connect(host: string, port: number = 7777): Promise<void> {
        // Similar to login client
    }

    sendProtocolVersion(): void {
        const packet = Buffer.alloc(2);
        packet.writeUInt16LE(2, 0);  // Size (includes itself)
        packet.writeUInt8(0x0E, 2);  // Protocol version packet ID
        packet.writeUInt8(0x5A, 3);  // Protocol version (Interlude)

        this.socket.write(packet);
    }

    handleKeyPacket(data: Buffer): void {
        const result = data.readUInt8(3);
        if (result !== 1) {
            throw new Error('Protocol version rejected');
        }

        // Extract 8-byte key
        const key = data.subarray(4, 12);
        this.encryption = new GameEncryption(key);

        // Now we can send AuthLogin
        this.sendAuthLogin();
    }

    private sendAuthLogin(): void {
        // Build AuthLogin packet with session key from PlayOk
        // ...
    }
}
```

### Key Implementation Points

1. **First packet is special**: The first packet from client to login server uses XOR + static Blowfish. All subsequent packets use dynamic Blowfish.

2. **Game encryption is XOR-based**: Despite the KeyPacket containing a "Blowfish" key, only the first 8 bytes are used for XOR encryption, NOT Blowfish.

3. **Checksum is mandatory**: Every packet (except Init and KeyPacket) must have XOR checksum appended.

4. **Little-endian everywhere**: All multi-byte integers are little-endian.

5. **Packet size includes itself**: The 2-byte size field includes the 2 bytes of the size field itself.

6. **Encryption enablement**: In game server, the first encrypted packet (AuthLogin) triggers encryption but is sent unencrypted to allow the server to process it.

---

## Reference: Packet ID Summary

### Login Server Packets (Client → Server)

| ID | Packet Name | Description |
|----|-------------|-------------|
| 0x01 | RequestAuthLogin | Account login |
| 0x02 | RequestServerLogin | Connect to game server |
| 0x05 | RequestServerList | Request server list |
| 0x07 | AuthGameGuard | GameGuard authentication |

### Login Server Packets (Server → Client)

| ID | Packet Name | Description |
|----|-------------|-------------|
| 0x00 | Init | Initial handshake (RSA key + Blowfish key) |
| 0x03 | LoginOk | Login successful |
| 0x04 | LoginFail | Login failed / ServerList |
| 0x05 | PlayOk | Game server connection authorized |
| 0x06 | PlayFail | Game server connection failed |

### Game Server Packets (Client → Server)

| ID | Packet Name | Description |
|----|-------------|-------------|
| 0x0E | ProtocolVersion | Protocol version check |
| 0x11 | EnterWorld | Enter game world |
| 0x2B | AuthLogin | Authenticate with session key |
| 0x36 | CharacterSelect | Select character |
| 0x48 | Action | Action (attack, etc.) |
| 0x01 | MoveToLocation | Movement |
| 0x2A | AttackRequest | Attack |

### Game Server Packets (Server → Client)

| ID | Packet Name | Description |
|----|-------------|-------------|
| 0x09 | CharSelectionInfo | Character list |
| 0x1D | CharSelected | Character selected |
| 0x1E | CharInfo | Character spawn info |
| 0xE9 | KeyPacket | Encryption key |
| 0x05 | SystemMessage | System messages |
| 0x19 | InventoryUpdate | Inventory changes |
| 0x22 | StatusUpdate | Status bar update |
| 0x27 | NpcInfo | NPC spawn info |
| 0x31 | Die | Character death |
| 0x43 | Revive | Character revival |

---
---

## L2J Mobius CT0 Interlude - Specific Notes

**IMPORTANT:** The opcodes above are for standard L2 servers. L2J Mobius uses different opcodes and flow, as confirmed by Wireshark captures:

### L2J Mobius Game Server Opcodes

| Opcode | Packet | Notes |
|--------|--------|-------|
| 0x00 | ProtocolVersion | First packet sent by client (NOT 0x0E) |
| 0x00 | CryptInit | First packet from server. Contains encryption flag. |
| 0x08 | AuthRequest | Client auth packet (NOT 0x9D or 0x2B) |
| 0x13 | CharSelectInfo | Character list from server |
| 0x0D | CharacterSelected | Client character selection by slot |
| 0x15 | CharSelected | Confirmation from server |
| 0x03 | EnterWorld | Client request to enter game (with 104 bytes padding) |
| 0x04 | UserInfo | Full character info from server |

### Key Differences from Standard L2

1. ProtocolVersion uses opcode 0x00 (not 0x0E)
2. **Encryption is DISABLED by the server** — CryptInit packet sends flag=0, meaning all packets pass through without XOR encryption. This is the key to making the client work with L2J Mobius CT0.
3. AuthRequest (0x08) sends username in UTF-16LE, playOkId2, playOkId1, loginOkId1, loginOkId2, and language (1)
4. CharacterSelect (0x0D) sends the slot index followed by exactly 14 bytes of zeros
5. To EnterWorld, the client sends three packets: 0x9D (empty), 0xD0 0x08 0x00, and 0x03 (with 104 bytes of padding).

