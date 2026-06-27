# TEST PROMPT — Build a Headless Lineage 2 Auto-Login Client (Node.js 24.15.0 + TypeScript)

> **This whole file is a single prompt.** Copy everything below the line and give it to any LLM.
> The LLM must produce a working project. The only success goal: **a character automatically
> connects, authenticates, enters the game world, and stays connected (answers server pings)**.
>
> This prompt is deliberately self-contained: every opcode, byte layout, and crypto routine you
> need is included inline. Do **not** invent values — use only what is written here.

---

## ROLE & GOAL

You are a senior TypeScript network engineer. Build a small, headless **Lineage 2 game client**
that targets an **L2J Mobius CT_2.6_HighFive / CT-0 Interlude** server.

The program must, with **no human interaction**:

1. Connect to the **Login Server** over TCP, authenticate with a username/password, pick a game
   server from the server list, and obtain session keys.
2. Connect to the **Game Server** over TCP, authenticate with those session keys, select a
   character by slot index, and **enter the world**.
3. Print `IN_GAME` to the console when the character is in the world.
4. **Keep the connection alive**: when the server sends a ping, reply with a pong. Stay connected.

**Definition of done:** running `npm run dev` connects end-to-end against a real server, logs
`IN_GAME`, keeps answering pings for at least 60 seconds without crashing, and `npx tsc --noEmit`
reports no type errors.

### Out of scope (do NOT build these)
No REST API, no WebSocket server, no web dashboard, no combat, no movement, no inventory logic,
no database, no dependency-injection framework. Keep it small and single-purpose. One small class
per file is fine. All code comments in English.

---

## HARD CONSTRAINTS (read carefully — most failures come from breaking these)

1. **Node.js 24.15.0**, **TypeScript** (strict mode on).
2. **All integers are little-endian.**
3. **Packet framing:** every packet on the wire is `[uint16LE size][1-byte opcode][payload...]`.
   The 2-byte size field **includes itself**. Example: a 5-byte packet has size `0x0005`.
4. **Strings are UTF-16LE, null-terminated** (two `0x00` bytes terminator), unless stated otherwise.
5. **Extended packets:** opcodes `>= 0xD0` are written as `[0xD0][1-byte (or 2-byte) sub-opcode][...]`.
6. **Use the opcodes from the OPCODE MAP below — never the "textbook" L2 opcodes.** This server is
   L2J Mobius and uses its own opcode set, confirmed by packet captures.
7. **Login Server uses crypto** (Blowfish ECB + RSA + XOR checksum). **Game Server encryption is
   DISABLED** on this server (the server tells you so via a flag = 0). Implement both correctly.
8. Never block the event loop. Use Node's `net` module with proper TCP stream reassembly.

---

## PROJECT SETUP

Create this structure:

```
l2-headless-client/
├── package.json
├── tsconfig.json
├── .env.example
├── .env                 (the tester fills this in; do not commit real credentials)
└── src/
    ├── index.ts             # entry point: run login phase, then game phase
    ├── config.ts            # load + validate .env
    ├── net/
    │   ├── Connection.ts     # TCP socket + packet reassembly
    │   ├── PacketReader.ts    # binary reader (LE)
    │   └── PacketWriter.ts    # binary writer (LE)
    ├── crypto/
    │   ├── Blowfish.ts       # Blowfish ECB encrypt/decrypt
    │   ├── NewCrypt.ts       # checksum + rolling-XOR helpers
    │   ├── ScrambledRsaKey.ts # unscramble RSA modulus
    │   ├── RsaCrypt.ts       # encrypt credentials
    │   └── LoginCrypt.ts     # login packet enc/dec orchestration
    ├── login/
    │   └── LoginClient.ts     # login-server state machine
    └── game/
        ├── GameClient.ts      # game-server state machine
        └── opcodes.ts        # opcode map (per protocol)
```

### `package.json`

```json
{
  "name": "l2-headless-client",
  "version": "1.0.0",
  "type": "commonjs",
  "engines": { "node": ">=24.15.0" },
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "dotenv": "^17.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "ts-node": "^10.9.2",
    "@types/node": "^24.0.0"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"]
}
```

### `.env.example`

```bash
L2_LOGIN_IP=127.0.0.1     # Login server IP
L2_LOGIN_PORT=2106        # Login server port
L2_GAME_PORT=7777         # Game server port (host comes from the server list)
L2_USERNAME=test          # Account login (max 14 chars)
L2_PASSWORD=test          # Account password (max 16 chars)
L2_SERVER_ID=1            # Server id to pick from the login server list
L2_CHAR_SLOT=0            # Character slot index (0-based)
L2_PROTOCOL=267           # 267/268/271/273 = HighFive; 746 = CT-0 Interlude
```

`config.ts` loads these via `dotenv`, converts numbers with `parseInt`, and throws a clear error
if any required value is missing.

---

## OPCODE MAP (CRITICAL)

This server uses **two opcode sets** depending on the protocol number. Pick the column by this rule:

> If `L2_PROTOCOL` ∈ `{267, 268, 271, 273}` → use the **HighFive** column.
> Otherwise (e.g. `746`) → use the **CT-0 Interlude** column.

Put these in `src/game/opcodes.ts` and select at startup. The **login server opcodes are the same
for both**.

### Login Server opcodes (same for all protocols)

| Direction | Name              | Opcode |
|-----------|-------------------|--------|
| ← server  | Init              | `0x00` |
| → client  | RequestGGAuth     | `0x07` |
| ← server  | GGAuth            | `0x0B` |
| → client  | RequestAuthLogin  | `0x00` |
| ← server  | LoginOk           | `0x03` |
| ← server  | LoginFail         | `0x01` |
| → client  | RequestServerList | `0x05` |
| ← server  | ServerList        | `0x04` |
| → client  | RequestServerLogin| `0x02` |
| ← server  | PlayOk            | `0x07` |
| ← server  | PlayFail          | `0x06` |

### Game Server opcodes

| Step | Name              | Dir | CT-0 Interlude | HighFive |
|------|-------------------|-----|----------------|----------|
| 1 | ProtocolVersion       | →   | `0x00`         | `0x0E`   |
| 2 | CryptInit             | ←   | `0x00` (or `0x2D`) | `0x2E` |
| 3 | AuthRequest           | →   | `0x08`         | `0x2B`   |
| 4 | CharSelectInfo        | ←   | `0x13` (or `0x04`/`0x2C`) | `0x09` |
| 5 | CharacterSelected     | →   | `0x0D`         | `0x12`   |
| 6 | CharSelected (confirm)| ←   | `0x15`         | `0x0B`   |
| 7 | EnterWorld            | →   | `0x03` (special seq.) | `0x11` |
| 8 | UserInfo              | ←   | `0x04`         | `0x32`   |
| - | NetPingRequest        | ←   | `0xD3`         | `0xD3`   |
| - | NetPing (pong)        | →   | `0xA8`         | `0xA8`   |

> **Robustness tip:** when reading server packets, match the opcode but tolerate the alternates in
> parentheses. The first packet you receive from the game server (right after you send
> ProtocolVersion) is always CryptInit, regardless of its exact opcode — read its encryption flag.

---

## REUSABLE CODE — COPY VERBATIM

These are correct, working implementations. Copy them into the listed files. You only need to
**wire them into the flow**; do not rewrite the algorithms.

### `src/net/PacketReader.ts`

```typescript
export class PacketReader {
  constructor(private buf: Buffer, private pos: number = 0) {}
  readUInt8(): number { const v = this.buf.readUInt8(this.pos); this.pos += 1; return v; }
  readUInt16LE(): number { const v = this.buf.readUInt16LE(this.pos); this.pos += 2; return v; }
  readInt16LE(): number { const v = this.buf.readInt16LE(this.pos); this.pos += 2; return v; }
  readInt32LE(): number { const v = this.buf.readInt32LE(this.pos); this.pos += 4; return v; }
  readInt64LE(): bigint { const v = this.buf.readBigInt64LE(this.pos); this.pos += 8; return v; }
  readFloatLE(): number { const v = this.buf.readFloatLE(this.pos); this.pos += 4; return v; }
  readDouble(): number { const v = this.buf.readDoubleLE(this.pos); this.pos += 8; return v; }
  readBytes(n: number): Buffer {
    const r = this.buf.subarray(this.pos, this.pos + n); this.pos += n; return Buffer.from(r);
  }
  readStringUTF16(): string {
    let end = this.pos;
    while (end + 1 < this.buf.length && !(this.buf[end] === 0 && this.buf[end + 1] === 0)) end += 2;
    const s = this.buf.subarray(this.pos, end).toString('utf16le');
    this.pos = end + 2; return s;
  }
  remaining(): number { return this.buf.length - this.pos; }
  skip(n: number): this { this.pos += n; return this; }
}
```

### `src/net/PacketWriter.ts`

```typescript
export class PacketWriter {
  private chunks: Buffer[] = [];
  writeUInt8(v: number): this { const b = Buffer.alloc(1); b.writeUInt8(v, 0); this.chunks.push(b); return this; }
  writeUInt16LE(v: number): this { const b = Buffer.alloc(2); b.writeUInt16LE(v, 0); this.chunks.push(b); return this; }
  writeInt32LE(v: number): this { const b = Buffer.alloc(4); b.writeInt32LE(v, 0); this.chunks.push(b); return this; }
  writeInt64LE(v: bigint): this { const b = Buffer.alloc(8); b.writeBigInt64LE(v, 0); this.chunks.push(b); return this; }
  writeBytes(b: Buffer): this { this.chunks.push(Buffer.from(b)); return this; }
  writeStringNullUTF16(s: string): this {
    const b = Buffer.alloc(s.length * 2 + 2);
    b.write(s, 0, 'utf16le'); // last two bytes already 0 => null terminator
    this.chunks.push(b); return this;
  }
  toBuffer(): Buffer { return Buffer.concat(this.chunks); }
}
```

### `src/net/Connection.ts` (TCP + packet reassembly)

```typescript
import { Socket } from 'node:net';

export class Connection {
  private socket = new Socket();
  private recv = Buffer.alloc(0);
  onPacket: (packet: Buffer) => void = () => {};   // packet = full frame INCLUDING 2-byte size
  onConnect: () => void = () => {};
  onClose: () => void = () => {};

  connect(host: string, port: number): void {
    this.socket.connect(port, host, () => this.onConnect());
    this.socket.on('data', (chunk) => this.handleData(chunk));
    this.socket.on('close', () => this.onClose());
    this.socket.on('error', (e) => console.error('TCP error', e));
  }

  /** Send a body (opcode + payload, WITHOUT size). This prepends the 2-byte LE length. */
  send(bodyWithLengthPrefix: Buffer): void { this.socket.write(bodyWithLengthPrefix); }

  private handleData(chunk: Buffer): void {
    this.recv = Buffer.concat([this.recv, chunk]);
    while (this.recv.length >= 2) {
      const len = this.recv.readUInt16LE(0);
      if (len < 2 || this.recv.length < len) break;          // wait for more bytes
      const frame = this.recv.subarray(0, len);
      this.recv = this.recv.subarray(len);
      this.onPacket(Buffer.from(frame));
    }
  }

  close(): void { this.socket.destroy(); }
}
```

> Helper to build an outgoing frame from a body: `size = body.length + 2`, write `uint16LE size`,
> then the body. For the **login server after the session key is set**, the body must first be run
> through `LoginCrypt.encrypt(...)` (see below) before the length prefix is added.

### `src/crypto/Blowfish.ts` (Blowfish ECB, no padding)

```typescript
import { createCipheriv, createDecipheriv } from 'node:crypto';

// Blowfish ECB, 8-byte blocks, NO padding. Data length MUST be a multiple of 8.
// NOTE: On Node built against OpenSSL 3, 'bf-ecb' lives in the legacy provider and may throw
// "unsupported". If createCipheriv('bf-ecb', ...) throws, use the pure-JS fallback noted in
// TROUBLESHOOTING (a standard Blowfish implementation in ECB mode). Behavior must be identical.
export function blowfishEncrypt(data: Buffer, key: Buffer): Buffer {
  const c = createCipheriv('bf-ecb', key, null); c.setAutoPadding(false);
  return Buffer.concat([c.update(data), c.final()]);
}
export function blowfishDecrypt(data: Buffer, key: Buffer): Buffer {
  const d = createDecipheriv('bf-ecb', key, null); d.setAutoPadding(false);
  return Buffer.concat([d.update(data), d.final()]);
}
```

### `src/crypto/NewCrypt.ts` (checksum + rolling XOR)

```typescript
export const NewCrypt = {
  // XOR of every 4-byte LE word; written into the last 4 bytes before the trailing pad.
  appendChecksum(raw: Uint8Array): void {
    const size = raw.length; let chk = 0, i = 0;
    for (i = 0; i < size - 4; i += 4) {
      const w = (raw[i]) | (raw[i + 1] << 8) | (raw[i + 2] << 16) | (raw[i + 3] << 24);
      chk ^= w;
    }
    raw[i] = chk & 0xff; raw[i + 1] = (chk >>> 8) & 0xff;
    raw[i + 2] = (chk >>> 16) & 0xff; raw[i + 3] = (chk >>> 24) & 0xff;
  },

  // Reverse rolling-XOR pass used only when decrypting the Init packet.
  decXORPass(raw: Uint8Array, key: number): void {
    const size = raw.length; let pos = size - 12; let ecx = key;
    while (4 <= pos) {
      let edx = (raw[pos]) | (raw[pos + 1] << 8) | (raw[pos + 2] << 16) | (raw[pos + 3] << 24);
      edx ^= ecx; ecx -= edx; ecx = ecx & 0xffffffff;
      raw[pos] = edx & 0xff; raw[pos + 1] = (edx >>> 8) & 0xff;
      raw[pos + 2] = (edx >>> 16) & 0xff; raw[pos + 3] = (edx >>> 24) & 0xff;
      pos -= 4;
    }
  },
};
```

### `src/crypto/ScrambledRsaKey.ts` (unscramble the 128-byte modulus)

```typescript
// L2J scrambles the modulus; unscramble in this exact order before using it for RSA.
export function unscrambleModulus(scrambled: Buffer): Buffer {
  if (scrambled.length !== 128) throw new Error(`RSA modulus must be 128 bytes, got ${scrambled.length}`);
  const n = Buffer.from(scrambled);
  for (let i = 0; i < 0x40; i++) n[0x40 + i] ^= n[i];           // C^-1
  for (let i = 0; i < 4; i++) n[0x0D + i] ^= n[0x34 + i];       // B^-1
  for (let i = 0; i < 0x40; i++) n[i] ^= n[0x40 + i];           // A^-1
  for (let i = 0; i < 4; i++) { const t = n[i]; n[i] = n[0x4D + i]; n[0x4D + i] = t; } // D^-1 swap
  return n;
}
```

### `src/crypto/RsaCrypt.ts` (encrypt credentials, RSA-1024, NO_PADDING)

```typescript
import { createPublicKey, publicEncrypt, constants } from 'node:crypto';

// Plaintext is exactly 128 bytes: login at offset 0x5E (14 bytes), password at 0x6E (16 bytes).
function buildPlaintext(login: string, password: string): Buffer {
  const p = Buffer.alloc(128, 0);
  Buffer.from(login.slice(0, 14), 'ascii').copy(p, 0x5E);
  Buffer.from(password.slice(0, 16), 'ascii').copy(p, 0x6E);
  return p;
}

function derLen(len: number): number[] {
  if (len < 128) return [len];
  if (len < 256) return [0x81, len];
  return [0x82, (len >> 8) & 0xff, len & 0xff];
}

// Build a PKCS#1 DER public key from a raw modulus + exponent 65537.
function buildDer(modulus: Buffer): Buffer {
  const e = Buffer.from([0x01, 0x00, 0x01]); // 65537
  const m = (modulus[0] & 0x80) ? Buffer.concat([Buffer.from([0]), modulus]) : modulus;
  const mInt = Buffer.concat([Buffer.from([0x02, ...derLen(m.length)]), m]);
  const eInt = Buffer.concat([Buffer.from([0x02, ...derLen(e.length)]), e]);
  const inner = Buffer.concat([mInt, eInt]);
  return Buffer.concat([Buffer.from([0x30, ...derLen(inner.length)]), inner]);
}

export function encryptCredentials(login: string, password: string, modulus: Buffer): Buffer {
  const der = buildDer(modulus);
  const key = createPublicKey({ key: der, format: 'der', type: 'pkcs1' });
  return Buffer.from(publicEncrypt({ key, padding: constants.RSA_NO_PADDING }, buildPlaintext(login, password)));
}
```

### `src/crypto/LoginCrypt.ts` (login packet enc/dec)

```typescript
import { blowfishEncrypt, blowfishDecrypt } from './Blowfish';
import { NewCrypt } from './NewCrypt';

const STATIC_KEY = Buffer.from([
  0x6b, 0x60, 0xcb, 0x5b, 0x82, 0xce, 0x90, 0xb1,
  0xcc, 0x2b, 0x6c, 0x55, 0x6c, 0x6c, 0x6c, 0x6c,
]);

export class LoginCrypt {
  private key: Buffer = STATIC_KEY;     // starts as static key, replaced after Init
  private hasSession = false;

  setSessionKey(blowfishKey: Buffer): void { this.key = blowfishKey; this.hasSession = true; }

  // Init packet (the very first one): static-key Blowfish decrypt, then reverse rolling XOR,
  // then drop the trailing 8 bytes. Input/output are bodies WITHOUT the 2-byte length prefix.
  decryptInit(body: Buffer): Buffer {
    const raw = new Uint8Array(blowfishDecrypt(body, STATIC_KEY));
    const size = raw.length;
    const xor = (raw[size - 8]) | (raw[size - 7] << 8) | (raw[size - 6] << 16) | (raw[size - 5] << 24);
    NewCrypt.decXORPass(raw, xor);
    return Buffer.from(raw).subarray(0, size - 8);
  }

  // Every packet after Init: Blowfish-decrypt with the session key.
  decrypt(body: Buffer): Buffer {
    if (!this.hasSession) return body;
    return blowfishDecrypt(body, this.key);
  }

  // Outgoing after session key set: pad to 4, add 8 zero bytes, pad to 8, checksum, encrypt.
  encrypt(body: Buffer): Buffer {
    if (!this.hasSession) return body;
    let buf = Buffer.from(body);
    if (buf.length % 4 !== 0) buf = Buffer.concat([buf, Buffer.alloc(4 - (buf.length % 4))]);
    buf = Buffer.concat([buf, Buffer.alloc(8)]);
    if (buf.length % 8 !== 0) buf = Buffer.concat([buf, Buffer.alloc(8 - (buf.length % 8))]);
    const raw = new Uint8Array(buf);
    NewCrypt.appendChecksum(raw);
    return blowfishEncrypt(Buffer.from(raw), this.key);
  }
}
```

> The **RequestGGAuth** packet (the first thing you send, before the session key is active) is sent
> with the static key path: build the body, then `blowfishEncrypt(padTo8(body), STATIC_KEY)` after
> appending the checksum the same way as `encrypt`. Simplest correct approach: call
> `setSessionKey(blowfishKeyFromInit)` immediately after decoding Init, then use `encrypt()` for
> **all** outgoing packets including RequestGGAuth. (The session key from Init is what the server
> expects for every client→server login packet.)

---

## PROTOCOL REFERENCE (field-by-field)

Field types: `C`=uint8 (1), `H`=uint16LE (2), `D`=int32LE (4), `Q`=int64LE (8), `S`=UTF-16LE
null-terminated string, `b[n]`=`n` raw bytes.

### PHASE 1 — LOGIN SERVER

Flow: `Init ← | → RequestGGAuth | GGAuth ← | → RequestAuthLogin | LoginOk ← | → RequestServerList |
ServerList ← | → RequestServerLogin | PlayOk ←`.

**Init (← `0x00`)** — first packet, special crypto (`LoginCrypt.decryptInit`). After decrypt, read:

| Off | Type | Field |
|-----|------|-------|
| 0 | C | opcode `0x00` |
| 1 | D | sessionId |
| 5 | D | protocol revision |
| 9 | b[128] | scrambled RSA modulus → run `unscrambleModulus` |
| 137 | b[16] | unknown (skip) |
| 153 | b[16] | **Blowfish session key** → `LoginCrypt.setSessionKey` |

**RequestGGAuth (→ `0x07`)**: `C 0x07` + `D sessionId` + `b[16]` GG constants
(`0x00000123, 0x00004567, 0x000089AB, 0x0000CDEF` as four `D`) + `b[19]` zeros. (Some servers don't
require this. If you receive LoginOk-shaped data instead of GGAuth, just continue.)

**GGAuth (← `0x0B`)**: `C 0x0B` + `D response` (keep `response`).

**RequestAuthLogin (→ `0x00`)**: `C 0x00` + `b[128]` = `encryptCredentials(username, password,
unscrambledModulus)` + `D ggResponse` + the fixed 43-byte GG block:
```
23 01 00 00 67 45 00 00 ab 89 00 00 ef cd 00 00 08 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
```
(If you skipped GGAuth, use `ggResponse = 0`.)

**LoginOk (← `0x03`)**: `C 0x03` + `D loginOkId1` + `D loginOkId2`. (Failure is `LoginFail 0x01`
with `C reason` — log and stop.)

**RequestServerList (→ `0x05`)**: `C 0x05` + `D loginOkId1` + `D loginOkId2` + `D 0x04000000`.

**ServerList (← `0x04`)**: `C 0x04` + `C serverCount` + `C 0x00`, then `serverCount` records of:
`C id` + `b[4] ip` (each byte one octet) + `D port` + `C ageLimit` + `C pvp` + `H online` +
`H maxPlayers` + `C status` + `D 0` + `C 0`. Find the record with `id == L2_SERVER_ID`; its `ip` and
`port` are your game server address (or use `L2_GAME_PORT` if you prefer the env value).

**RequestServerLogin (→ `0x02`)**: `C 0x02` + `D loginOkId1` + `D loginOkId2` + `C serverId`.

**PlayOk (← `0x07`)**: `C 0x07` + `D playOkId1` + `D playOkId2`. (Failure is `PlayFail 0x06`.)

**Carry into Phase 2:** `loginOkId1`, `loginOkId2`, `playOkId1`, `playOkId2`, and the game server
host/port. Then close the login connection.

### PHASE 2 — GAME SERVER (encryption DISABLED on this server)

> Connect to the game host/port. Send packets as plaintext (just `[size][opcode][payload]`). Read
> the encryption flag from CryptInit and confirm it is `0`. If it were non-zero you'd need XOR, but
> for this server it is `0` — pass-through.

Flow: `→ ProtocolVersion | CryptInit ← | → AuthRequest | CharSelectInfo ← | → CharacterSelected |
CharSelected ← | → EnterWorld sequence | UserInfo ← ⇒ IN_GAME | (loop) ping/pong`.

**ProtocolVersion (→ `OP[ProtocolVersion]`)**: `C opcode` + `D L2_PROTOCOL`. Sent immediately on
connect, raw.

**CryptInit (← `OP[CryptInit]`)** — first packet from server. ~23 bytes: `C opcode` + `C status`
+ `b[8] xorKey` + `D encryptionFlag` (expect `0`) + rest. Just verify the flag is `0`.

**AuthRequest (→ `OP[AuthRequest]`)** — order matters:
`C opcode` + `S username` + `D playOkId2` + `D playOkId1` + `D loginOkId1` + `D loginOkId2`, and
**for CT-0 only** append `D 1` (language). HighFive does **not** append the language field.
> Note the key order: **playOkId2 first, then playOkId1**, then loginOkId1, loginOkId2.

**CharSelectInfo (← `OP[CharSelectInfo]`)**: `C opcode` + `D charCount` + per-character data. You
only need to confirm `charCount >= 1`. Log the count.

**CharacterSelected (→ `OP[CharacterSelected]`)**: `C opcode` + `D L2_CHAR_SLOT` + `b[14]` zeros.
(The 14 zero bytes are required for both protocols.)

**CharSelected confirm (← `OP[CharSelected]`)**: just the opcode (and char details you can ignore).
Some servers skip this and jump straight to UserInfo — handle both: if you receive the UserInfo
opcode while waiting for the confirm, proceed as if confirmed.

**EnterWorld sequence (→):**
- **HighFive:** send RequestKeyMapping = extended packet `C 0xD0` + `H 0x0021`, then EnterWorld =
  `C 0x11` + `b[104]` zeros.
- **CT-0 Interlude:** send three packets in order: `[0x9D]`, then `[0xD0, 0x08, 0x00]`, then
  EnterWorld = `C 0x03` + `b[104]` zeros.
> The 104 zero bytes of padding after the EnterWorld opcode are mandatory (the server parses a
> fixed-size trailer; missing bytes cause a server-side buffer underflow and a silent disconnect).

**UserInfo (← `OP[UserInfo]`)**: the character is now in the world. **Print `IN_GAME`.** You don't
need to parse its fields for this task.

**Keepalive — NetPingRequest (← `0xD3`) / NetPing pong (→ `0xA8`):** once IN_GAME, whenever you
receive opcode `0xD3` (`C 0xD3` + `D pingId`), reply with NetPing:
`C 0xA8` + `D pingId` + `D 0x00000000` + `D 0x00080000`. Keep the process alive.

---

## MILESTONES (build incrementally — verify each before moving on)

**M1 — Project compiles & runs.** Create the structure, `npm install`, implement `config.ts` and
`index.ts` that prints the loaded config. `npm run dev` prints config; `npx tsc --noEmit` is clean.
→ STOP and verify before continuing.

**M2 — Login TCP + Init.** Implement `Connection`, `PacketReader/Writer`, and the crypto files.
Connect to the login server, receive the first frame, `decryptInit`, log `sessionId` and that you
got a 128-byte modulus + 16-byte Blowfish key. → STOP and verify you see a sane sessionId.

**M3 — Reach LoginOk.** Send RequestGGAuth (or skip), then RequestAuthLogin with RSA credentials.
Log `loginOkId1/2`. If you get LoginFail, print the reason and fix credentials/crypto.
→ STOP: you must reach LoginOk.

**M4 — Reach PlayOk.** Send RequestServerList, parse it, pick `L2_SERVER_ID`, send
RequestServerLogin, receive PlayOk. Log `playOkId1/2` and the chosen game host/port.
→ STOP: you must have all four session ids + game address.

**M5 — Game connect → CharSelectInfo.** Connect to the game server, send ProtocolVersion, read
CryptInit (confirm flag `0`), send AuthRequest, receive CharSelectInfo, log the character count.
→ STOP: count must be `>= 1`.

**M6 — Character selected.** Send CharacterSelected for `L2_CHAR_SLOT`, receive CharSelected confirm
(or tolerate it being skipped). → STOP.

**M7 — Enter world.** Send the protocol-correct EnterWorld sequence, receive UserInfo, print
`IN_GAME`. → STOP: `IN_GAME` must appear.

**M8 — Keepalive.** Answer `0xD3` pings with `0xA8` pongs; stay connected ≥ 60s with no crash.
→ DONE.

---

## TROUBLESHOOTING (common failure modes)

- **`bf-ecb` "unsupported" / "Unknown cipher".** Node on OpenSSL 3 hides Blowfish in the legacy
  provider. Either run Node with the legacy provider enabled, or drop in a pure-JS Blowfish ECB
  implementation behind the same `blowfishEncrypt/blowfishDecrypt` interface. Blowfish: 8-byte
  blocks, 16 rounds, ECB (no IV), no padding. Verify round-trip `decrypt(encrypt(x)) === x` first.
- **Init won't decode / garbage modulus.** You must Blowfish-decrypt with the **static key**, then
  `decXORPass`, then drop the last 8 bytes — in that order. Don't verify a checksum on Init.
- **LoginFail right after AuthLogin.** Usually wrong RSA: the modulus must be **unscrambled** before
  building the DER key; padding must be `RSA_NO_PADDING`; plaintext must be exactly 128 bytes with
  login at `0x5E` and password at `0x6E` (ASCII).
- **Checksum mismatch / server drops you on login.** For outgoing login packets: pad to 4 bytes,
  append 8 zero bytes, pad to 8, write the XOR checksum into the 4 bytes before the final pad, then
  Blowfish-encrypt. Then add the `uint16LE` length prefix (length includes the 2 size bytes and is
  measured on the **encrypted** body).
- **Wrong opcodes / nothing happens on the game server.** You used the textbook L2 opcodes. Use the
  OPCODE MAP and pick the column by `L2_PROTOCOL`.
- **AuthRequest rejected.** Key order is `playOkId2, playOkId1, loginOkId1, loginOkId2`. Append the
  trailing `D 1` only for CT-0, not for HighFive.
- **CharacterSelected ignored.** You must append exactly 14 zero bytes after the slot index.
- **No UserInfo after EnterWorld / silent disconnect.** You forgot the 104 bytes of padding, or used
  the wrong enter-world sequence for the protocol (HighFive = KeyMapping + `0x11`; CT-0 = `0x9D` +
  `0xD0 08 00` + `0x03`).
- **Game packets look scrambled.** Don't apply any decryption on the game server — encryption is
  disabled (CryptInit flag `0`); packets are plaintext.
- **Connection closes after a minute.** You aren't answering pings. Reply to every `0xD3` with the
  13-byte `0xA8` pong.

---

## FINAL DELIVERABLE

A complete, compiling project as specified. Running `npm run dev` with a valid `.env` against a live
L2J Mobius server connects through both phases, prints `IN_GAME`, and keeps the character connected
by answering pings. No extra features.
