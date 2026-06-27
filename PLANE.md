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
that targets an **L2J Mobius CT_2.6_HighFive** server (protocol `267`).

> **Scope of this prompt:** HighFive only. Do not implement the CT-0 / Interlude dialect. Every
> opcode and crypto routine below is the HighFive variant. The game-server connection **uses
> encryption** (a 16-byte shifting XOR — see below); it is **not** a plaintext connection.

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
   L2J Mobius CT_2.6_HighFive and uses its own opcode set, confirmed by packet captures.
7. **Both connections use crypto.** Login Server: Blowfish ECB + RSA + XOR checksum. Game Server:
   a **16-byte shifting XOR cipher that is ENABLED** for HighFive. The **first client→server game
   packet (ProtocolVersion) is sent raw**, but **every game packet after CryptInit is encrypted**,
   including the first packet you send after receiving CryptInit. Implement both correctly. (Do
   **not** treat the game stream as plaintext — that only applies to the unsupported CT-0 dialect.)
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
    ├── debug/
    │   └── DebugTools.ts      # self-debug toolkit: crypto self-tests, [STATE] log, phase report
    ├── login/
    │   └── LoginClient.ts     # login-server state machine
    └── game/
        ├── GameClient.ts      # game-server state machine
        ├── GameCrypt.ts       # game-server 16-byte shifting XOR (HighFive)
        └── opcodes.ts        # HighFive opcode map
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
L2_LOGIN_IP=192.168.0.33     # Login server IP
L2_LOGIN_PORT=2106        # Login server port
L2_GAME_PORT=7777         # Game server port (host comes from the server list)
L2_USERNAME=qwerty          # Account login (max 14 chars)
L2_PASSWORD=qwerty          # Account password (max 16 chars)
L2_SERVER_ID=2            # Server id to pick from the login server list
L2_CHAR_SLOT=0            # Character slot index (0-based)
L2_PROTOCOL=267           # HighFive protocol (this prompt targets 267 only)
```

`config.ts` loads these via `dotenv`, converts numbers with `parseInt`, and throws a clear error
if any required value is missing.

---

## OPCODE MAP (CRITICAL — HighFive)

This is the **HighFive (protocol 267)** opcode set. Put these in `src/game/opcodes.ts`.

### Login Server opcodes

| Direction | Name               | Opcode |
| --------- | ------------------ | ------ |
| ← server  | Init               | `0x00` |
| → client  | RequestGGAuth      | `0x07` |
| ← server  | GGAuth             | `0x0B` |
| → client  | RequestAuthLogin   | `0x00` |
| ← server  | LoginOk            | `0x03` |
| ← server  | LoginFail          | `0x01` |
| → client  | RequestServerList  | `0x05` |
| ← server  | ServerList         | `0x04` |
| → client  | RequestServerLogin | `0x02` |
| ← server  | PlayOk             | `0x07` |
| ← server  | PlayFail           | `0x06` |

### Game Server opcodes (HighFive)

| Step | Name                   | Dir | Opcode                   |
| ---- | ---------------------- | --- | ------------------------ |
| 1    | ProtocolVersion        | →   | `0x0E`                   |
| 2    | CryptInit              | ←   | `0x2E`                   |
| 3    | AuthRequest            | →   | `0x2B`                   |
| 4    | CharSelectInfo         | ←   | `0x09`                   |
| 5    | CharacterSelected      | →   | `0x12`                   |
| 6    | CharSelected (confirm) | ←   | `0x0B`                   |
| 7    | RequestKeyMapping      | →   | `0xD0 0x0021` (extended) |
| 8    | EnterWorld             | →   | `0x11`                   |
| 9    | UserInfo               | ←   | `0x32`                   |
| -    | NetPingRequest         | ←   | `0xD3`                   |
| -    | NetPing (pong)         | →   | `0xA8`                   |

> **Robustness tip:** the first packet you receive from the game server (right after you send
> ProtocolVersion) is always **CryptInit (`0x2E`)** — read its 8-byte XOR key and encryption flag,
> then enable the game cipher (see GameCrypt below) before reading anything else.

---

## REUSABLE CODE — COPY VERBATIM

These are correct, working implementations. Copy them into the listed files. You only need to
**wire them into the flow**; do not rewrite the algorithms.

### `src/net/PacketReader.ts`

```typescript
export class PacketReader {
  constructor(
    private buf: Buffer,
    private pos: number = 0,
  ) {}
  readUInt8(): number {
    const v = this.buf.readUInt8(this.pos);
    this.pos += 1;
    return v;
  }
  readUInt16LE(): number {
    const v = this.buf.readUInt16LE(this.pos);
    this.pos += 2;
    return v;
  }
  readInt16LE(): number {
    const v = this.buf.readInt16LE(this.pos);
    this.pos += 2;
    return v;
  }
  readInt32LE(): number {
    const v = this.buf.readInt32LE(this.pos);
    this.pos += 4;
    return v;
  }
  readInt64LE(): bigint {
    const v = this.buf.readBigInt64LE(this.pos);
    this.pos += 8;
    return v;
  }
  readFloatLE(): number {
    const v = this.buf.readFloatLE(this.pos);
    this.pos += 4;
    return v;
  }
  readDouble(): number {
    const v = this.buf.readDoubleLE(this.pos);
    this.pos += 8;
    return v;
  }
  readBytes(n: number): Buffer {
    const r = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return Buffer.from(r);
  }
  readStringUTF16(): string {
    let end = this.pos;
    while (
      end + 1 < this.buf.length &&
      !(this.buf[end] === 0 && this.buf[end + 1] === 0)
    )
      end += 2;
    const s = this.buf.subarray(this.pos, end).toString("utf16le");
    this.pos = end + 2;
    return s;
  }
  remaining(): number {
    return this.buf.length - this.pos;
  }
  skip(n: number): this {
    this.pos += n;
    return this;
  }
}
```

### `src/net/PacketWriter.ts`

```typescript
export class PacketWriter {
  private chunks: Buffer[] = [];
  writeUInt8(v: number): this {
    const b = Buffer.alloc(1);
    b.writeUInt8(v, 0);
    this.chunks.push(b);
    return this;
  }
  writeUInt16LE(v: number): this {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(v, 0);
    this.chunks.push(b);
    return this;
  }
  writeInt32LE(v: number): this {
    const b = Buffer.alloc(4);
    b.writeInt32LE(v, 0);
    this.chunks.push(b);
    return this;
  }
  writeInt64LE(v: bigint): this {
    const b = Buffer.alloc(8);
    b.writeBigInt64LE(v, 0);
    this.chunks.push(b);
    return this;
  }
  writeBytes(b: Buffer): this {
    this.chunks.push(Buffer.from(b));
    return this;
  }
  writeStringNullUTF16(s: string): this {
    const b = Buffer.alloc(s.length * 2 + 2);
    b.write(s, 0, "utf16le"); // last two bytes already 0 => null terminator
    this.chunks.push(b);
    return this;
  }
  toBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }
}
```

### `src/net/Connection.ts` (TCP + packet reassembly)

```typescript
import { Socket } from "node:net";

export class Connection {
  private socket = new Socket();
  private recv = Buffer.alloc(0);
  onPacket: (packet: Buffer) => void = () => {}; // packet = full frame INCLUDING 2-byte size
  onConnect: () => void = () => {};
  onClose: () => void = () => {};

  connect(host: string, port: number): void {
    this.socket.connect(port, host, () => this.onConnect());
    this.socket.on("data", (chunk) => this.handleData(chunk));
    this.socket.on("close", () => this.onClose());
    this.socket.on("error", (e) => console.error("TCP error", e));
  }

  /** Send a body (opcode + payload, WITHOUT size). This prepends the 2-byte LE length. */
  send(bodyWithLengthPrefix: Buffer): void {
    this.socket.write(bodyWithLengthPrefix);
  }

  private handleData(chunk: Buffer): void {
    this.recv = Buffer.concat([this.recv, chunk]);
    while (this.recv.length >= 2) {
      const len = this.recv.readUInt16LE(0);
      if (len < 2 || this.recv.length < len) break; // wait for more bytes
      const frame = this.recv.subarray(0, len);
      this.recv = this.recv.subarray(len);
      this.onPacket(Buffer.from(frame));
    }
  }

  close(): void {
    this.socket.destroy();
  }
}
```

> Helper to build an outgoing frame from a body: `size = body.length + 2`, write `uint16LE size`,
> then the body. For the **login server after the session key is set**, the body must first be run
> through `LoginCrypt.encrypt(...)` (see below) before the length prefix is added.

### `src/crypto/Blowfish.ts` (Blowfish ECB, no padding)

```typescript
import { createCipheriv, createDecipheriv } from "node:crypto";

// Blowfish ECB, 8-byte blocks, NO padding. Data length MUST be a multiple of 8.
// NOTE: On Node built against OpenSSL 3, 'bf-ecb' lives in the legacy provider and may throw
// "unsupported". If createCipheriv('bf-ecb', ...) throws, use the pure-JS fallback noted in
// TROUBLESHOOTING (a standard Blowfish implementation in ECB mode). Behavior must be identical.
export function blowfishEncrypt(data: Buffer, key: Buffer): Buffer {
  const c = createCipheriv("bf-ecb", key, null);
  c.setAutoPadding(false);
  return Buffer.concat([c.update(data), c.final()]);
}
export function blowfishDecrypt(data: Buffer, key: Buffer): Buffer {
  const d = createDecipheriv("bf-ecb", key, null);
  d.setAutoPadding(false);
  return Buffer.concat([d.update(data), d.final()]);
}
```

### `src/crypto/NewCrypt.ts` (checksum + rolling XOR)

```typescript
export const NewCrypt = {
  // XOR of every 4-byte LE word; written into the last 4 bytes before the trailing pad.
  appendChecksum(raw: Uint8Array): void {
    const size = raw.length;
    let chk = 0,
      i = 0;
    for (i = 0; i < size - 4; i += 4) {
      const w =
        raw[i] | (raw[i + 1] << 8) | (raw[i + 2] << 16) | (raw[i + 3] << 24);
      chk ^= w;
    }
    raw[i] = chk & 0xff;
    raw[i + 1] = (chk >>> 8) & 0xff;
    raw[i + 2] = (chk >>> 16) & 0xff;
    raw[i + 3] = (chk >>> 24) & 0xff;
  },

  // Reverse rolling-XOR pass used only when decrypting the Init packet.
  decXORPass(raw: Uint8Array, key: number): void {
    const size = raw.length;
    let pos = size - 12;
    let ecx = key;
    while (4 <= pos) {
      let edx =
        raw[pos] |
        (raw[pos + 1] << 8) |
        (raw[pos + 2] << 16) |
        (raw[pos + 3] << 24);
      edx ^= ecx;
      ecx -= edx;
      ecx = ecx & 0xffffffff;
      raw[pos] = edx & 0xff;
      raw[pos + 1] = (edx >>> 8) & 0xff;
      raw[pos + 2] = (edx >>> 16) & 0xff;
      raw[pos + 3] = (edx >>> 24) & 0xff;
      pos -= 4;
    }
  },
};
```

### `src/crypto/ScrambledRsaKey.ts` (unscramble the 128-byte modulus)

```typescript
// L2J scrambles the modulus; unscramble in this exact order before using it for RSA.
export function unscrambleModulus(scrambled: Buffer): Buffer {
  if (scrambled.length !== 128)
    throw new Error(`RSA modulus must be 128 bytes, got ${scrambled.length}`);
  const n = Buffer.from(scrambled);
  for (let i = 0; i < 0x40; i++) n[0x40 + i] ^= n[i]; // C^-1
  for (let i = 0; i < 4; i++) n[0x0d + i] ^= n[0x34 + i]; // B^-1
  for (let i = 0; i < 0x40; i++) n[i] ^= n[0x40 + i]; // A^-1
  for (let i = 0; i < 4; i++) {
    const t = n[i];
    n[i] = n[0x4d + i];
    n[0x4d + i] = t;
  } // D^-1 swap
  return n;
}
```

### `src/crypto/RsaCrypt.ts` (encrypt credentials, RSA-1024, NO_PADDING)

```typescript
import { createPublicKey, publicEncrypt, constants } from "node:crypto";

// Plaintext is exactly 128 bytes: login at offset 0x5E (14 bytes), password at 0x6E (16 bytes).
function buildPlaintext(login: string, password: string): Buffer {
  const p = Buffer.alloc(128, 0);
  Buffer.from(login.slice(0, 14), "ascii").copy(p, 0x5e);
  Buffer.from(password.slice(0, 16), "ascii").copy(p, 0x6e);
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
  const m =
    modulus[0] & 0x80 ? Buffer.concat([Buffer.from([0]), modulus]) : modulus;
  const mInt = Buffer.concat([Buffer.from([0x02, ...derLen(m.length)]), m]);
  const eInt = Buffer.concat([Buffer.from([0x02, ...derLen(e.length)]), e]);
  const inner = Buffer.concat([mInt, eInt]);
  return Buffer.concat([Buffer.from([0x30, ...derLen(inner.length)]), inner]);
}

export function encryptCredentials(
  login: string,
  password: string,
  modulus: Buffer,
): Buffer {
  const der = buildDer(modulus);
  const key = createPublicKey({ key: der, format: "der", type: "pkcs1" });
  return Buffer.from(
    publicEncrypt(
      { key, padding: constants.RSA_NO_PADDING },
      buildPlaintext(login, password),
    ),
  );
}
```

### `src/crypto/LoginCrypt.ts` (login packet enc/dec)

```typescript
import { blowfishEncrypt, blowfishDecrypt } from "./Blowfish";
import { NewCrypt } from "./NewCrypt";

const STATIC_KEY = Buffer.from([
  0x6b, 0x60, 0xcb, 0x5b, 0x82, 0xce, 0x90, 0xb1, 0xcc, 0x2b, 0x6c, 0x55, 0x6c,
  0x6c, 0x6c, 0x6c,
]);

export class LoginCrypt {
  private key: Buffer = STATIC_KEY; // starts as static key, replaced after Init
  private hasSession = false;

  setSessionKey(blowfishKey: Buffer): void {
    this.key = blowfishKey;
    this.hasSession = true;
  }

  // Init packet (the very first one): static-key Blowfish decrypt, then reverse rolling XOR,
  // then drop the trailing 8 bytes. Input/output are bodies WITHOUT the 2-byte length prefix.
  decryptInit(body: Buffer): Buffer {
    const raw = new Uint8Array(blowfishDecrypt(body, STATIC_KEY));
    const size = raw.length;
    const xor =
      raw[size - 8] |
      (raw[size - 7] << 8) |
      (raw[size - 6] << 16) |
      (raw[size - 5] << 24);
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
    if (buf.length % 4 !== 0)
      buf = Buffer.concat([buf, Buffer.alloc(4 - (buf.length % 4))]);
    buf = Buffer.concat([buf, Buffer.alloc(8)]);
    if (buf.length % 8 !== 0)
      buf = Buffer.concat([buf, Buffer.alloc(8 - (buf.length % 8))]);
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

### `src/game/GameCrypt.ts` (game-server 16-byte shifting XOR — HighFive)

```typescript
// HighFive game-server cipher. NOT plaintext. The key is 16 bytes:
//   bytes 0..7  = the 8-byte XOR key from CryptInit
//   bytes 8..15 = the fixed static tail below
// Encryption is enabled as soon as CryptInit is processed. The very first game packet you SEND
// after CryptInit (AuthRequest) IS encrypted. Decrypt/encrypt mutate a rolling carry and then
// advance bytes 8..11 of the key by the packet size.
const STATIC_TAIL = Buffer.from([
  0xc8, 0x27, 0x93, 0x01, 0xa1, 0x6c, 0x31, 0x97,
]);

export class GameCrypt {
  private keyIn = Buffer.alloc(16); // server -> client (decrypt)
  private keyOut = Buffer.alloc(16); // client -> server (encrypt)
  private enabled = false;

  // xorKey = the 8 bytes read from CryptInit. enable = (CryptInit flag != 0) — true for HighFive.
  init(xorKey: Buffer, enable: boolean): void {
    const full = Buffer.alloc(16);
    xorKey.subarray(0, 8).copy(full, 0);
    STATIC_TAIL.copy(full, 8);
    this.keyIn = Buffer.from(full);
    this.keyOut = Buffer.from(full);
    this.enabled = enable;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  decrypt(data: Buffer): Buffer {
    if (!this.enabled) return data;
    const out = Buffer.from(data);
    const size = out.length;
    let xor = 0;
    for (let i = 0; i < size; i++) {
      const enc = out[i] & 0xff;
      out[i] = (enc ^ this.keyIn[i & 15] ^ xor) & 0xff;
      xor = enc;
    }
    this.shift(this.keyIn, size);
    return out;
  }

  encrypt(data: Buffer): Buffer {
    if (!this.enabled) return data;
    const out = Buffer.from(data);
    const size = out.length;
    let enc = 0;
    for (let i = 0; i < size; i++) {
      enc = ((out[i] & 0xff) ^ this.keyOut[i & 15] ^ enc) & 0xff;
      out[i] = enc;
    }
    this.shift(this.keyOut, size);
    return out;
  }

  // Advance bytes 8..11 of the key (little-endian uint32) by the packet size.
  private shift(key: Buffer, size: number): void {
    let v = key[8] | (key[9] << 8) | (key[10] << 16) | (key[11] << 24);
    v = (v + size) >>> 0;
    key[8] = v & 0xff;
    key[9] = (v >>> 8) & 0xff;
    key[10] = (v >>> 16) & 0xff;
    key[11] = (v >>> 24) & 0xff;
  }
}
```

> **Wiring:** on the game connection, after you decode CryptInit call `gameCrypt.init(xorKey, flag !== 0)`.
> From then on: **decrypt every received game body** and **encrypt every sent game body** before the
> 2-byte length prefix is added. ProtocolVersion is the only exception — it is sent raw, before
> CryptInit exists.

### `src/debug/DebugTools.ts` (self-debug toolkit)

```typescript
// Lightweight facilities so the client can validate its own progress while running a phase.
// Three tools: crypto self-tests, [STATE] FSM logging, and a per-phase checklist + report.

let passed = 0,
  failed = 0;
export function check(name: string, cond: boolean): boolean {
  if (cond) {
    passed++;
    console.log(`  [ok] ${name}`);
  } else {
    failed++;
    console.log(`  [FAIL] ${name}`);
  }
  return cond;
}
export function selfTestCounts(): { passed: number; failed: number } {
  return { passed, failed };
}

// [STATE] logging: print every FSM transition the same way for every phase.
export function logState(from: string, to: string): void {
  console.log(`[STATE] ${from} -> ${to}`);
}
// Assert the FSM is where you expect before handling a packet; throws a clear error otherwise.
export function assertState(
  actual: string,
  expected: string,
  ctx: string,
): void {
  if (actual !== expected)
    throw new Error(`[STATE] expected ${expected} but was ${actual} (${ctx})`);
}

// Standard per-phase report. Call once at the end of a phase.
export function report(
  phase: number,
  statePath: string,
  artifacts: Record<string, unknown>,
  notes = "",
): void {
  const c = selfTestCounts();
  console.log(`=== PHASE ${phase} REPORT ===`);
  console.log(`status: ${failed === 0 ? "PASS" : "FAIL"}`);
  console.log(`self-tests: ${c.passed}/${c.passed + c.failed}`);
  console.log(`state-path: ${statePath}`);
  console.log(
    `artifacts: ${Object.entries(artifacts)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(", ")}`,
  );
  if (notes) console.log(`notes: ${notes}`);
}
```

> **Crypto self-tests (run at the start of every phase that touches crypto, before any socket I/O):**
>
> ```typescript
> import { blowfishEncrypt, blowfishDecrypt } from "../crypto/Blowfish";
> import { GameCrypt } from "../game/GameCrypt";
> import { check } from "./DebugTools";
>
> export function runCryptoSelfTests(): void {
>   const k = Buffer.from("0123456789abcdef", "ascii"); // any 16-byte key
>   const x = Buffer.from("deadbeefdeadbeef", "ascii"); // 8-byte block
>   check(
>     "blowfish round-trip",
>     blowfishDecrypt(blowfishEncrypt(x, k), k).equals(x),
>   );
>
>   const a = new GameCrypt();
>   a.init(Buffer.alloc(8, 0x11), true);
>   const b = new GameCrypt();
>   b.init(Buffer.alloc(8, 0x11), true);
>   const msg = Buffer.from([0x2b, 1, 2, 3, 4, 5, 6, 7]);
>   check(
>     "game-xor round-trip",
>     b.decrypt(a.encrypt(Buffer.from(msg))).equals(msg),
>   );
> }
> ```
>
> Add `check('modulus is 128 bytes', unscrambledModulus.length === 128)` inside Phase 2 once you
> have the modulus, and `check('charCount >= 1', charCount >= 1)` inside Phase 3. **If any
> self-test fails, stop the phase and print the report** — do not open sockets with broken crypto.

---

## PROTOCOL REFERENCE (field-by-field)

Field types: `C`=uint8 (1), `H`=uint16LE (2), `D`=int32LE (4), `Q`=int64LE (8), `S`=UTF-16LE
null-terminated string, `b[n]`=`n` raw bytes.

### PART A — LOGIN SERVER (used by PHASE 2)

Flow: `Init ← | → RequestGGAuth | GGAuth ← | → RequestAuthLogin | LoginOk ← | → RequestServerList |
ServerList ← | → RequestServerLogin | PlayOk ←`.

**Init (← `0x00`)** — first packet, special crypto (`LoginCrypt.decryptInit`). After decrypt, read:

| Off | Type   | Field                                                 |
| --- | ------ | ----------------------------------------------------- |
| 0   | C      | opcode `0x00`                                         |
| 1   | D      | sessionId                                             |
| 5   | D      | protocol revision                                     |
| 9   | b[128] | scrambled RSA modulus → run `unscrambleModulus`       |
| 137 | b[16]  | unknown (skip)                                        |
| 153 | b[16]  | **Blowfish session key** → `LoginCrypt.setSessionKey` |

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

**Carry into the game phases:** `loginOkId1`, `loginOkId2`, `playOkId1`, `playOkId2`, and the game
server host/port. Then close the login connection.

### PART B — GAME SERVER (encryption ENABLED — HighFive 16-byte shifting XOR)

> Connect to the game host/port. **ProtocolVersion is sent raw.** After you receive CryptInit, call
> `gameCrypt.init(xorKey, flag !== 0)` and from then on **decrypt every received body and encrypt
> every sent body** (see `GameCrypt.ts`). For HighFive the flag is non-zero, so the cipher is on —
> the connection is **not** plaintext, and the first packet you send afterwards (AuthRequest) is
> encrypted.

Flow: `→ ProtocolVersion | CryptInit ← | → AuthRequest | CharSelectInfo ← | → CharacterSelected |
CharSelected ← | → RequestKeyMapping + EnterWorld | UserInfo ← ⇒ IN_GAME | (loop) ping/pong`.

**ProtocolVersion (→ `0x0E`)**: `C 0x0E` + `D L2_PROTOCOL`. Sent immediately on connect, **raw**
(no game encryption yet).

**CryptInit (← `0x2E`)** — first packet from server. `C 0x2E` + `C status` + `b[8] xorKey` +
`D encryptionFlag` + rest. Read the 8-byte `xorKey` and the flag, then call
`gameCrypt.init(xorKey, encryptionFlag !== 0)`. For HighFive the flag is non-zero ⇒ cipher enabled.
This CryptInit packet body itself is **not** encrypted.

**AuthRequest (→ `0x2B`)** — order matters, and this packet **is encrypted**:
`C 0x2B` + `S username` + `D playOkId2` + `D playOkId1` + `D loginOkId1` + `D loginOkId2`.
HighFive does **not** append a language field.

> Note the key order: **playOkId2 first, then playOkId1**, then loginOkId1, loginOkId2.

**CharSelectInfo (← `0x09`)**: `C 0x09` + `D charCount` + per-character data. You only need to
confirm `charCount >= 1`. Log the count.

**CharacterSelected (→ `0x12`)**: `C 0x12` + `D L2_CHAR_SLOT` + `b[14]` zeros.
(The 14 zero bytes are required.)

**CharSelected confirm (← `0x0B`)**: just the opcode (and char details you can ignore). Some servers
skip this and jump straight to UserInfo — handle both: if you receive the UserInfo opcode (`0x32`)
while waiting for the confirm, proceed as if confirmed.

**EnterWorld sequence (→):** send two packets in order:

1. RequestKeyMapping = extended packet `C 0xD0` + `H 0x0021`.
2. EnterWorld = `C 0x11` + `b[104]` zeros.
   > The 104 zero bytes of padding after the EnterWorld opcode are mandatory (the server parses a
   > fixed-size trailer; missing bytes cause a server-side buffer underflow and a silent disconnect).

**UserInfo (← `0x32`)**: the character is now in the world. **Print `IN_GAME`.** You don't need to
parse its fields for this task.

**Keepalive — NetPingRequest (← `0xD3`) / NetPing pong (→ `0xA8`):** once IN_GAME, whenever you
receive opcode `0xD3` (`C 0xD3` + `D pingId`), reply with NetPing:
`C 0xA8` + `D pingId` + `D 0x00000000` + `D 0x00080000`. Keep the process alive.

---

## PHASES (independent, separately-invocable units of work)

Build and verify the client as **four independent phases**. The tester drives them one at a time:
the prompt will say **"execute PHASE N"**, you implement/run only that phase, then **stop and print
the phase report** (format below). Each phase has explicit **Inputs** (artifacts carried in from the
previous phase) and **Outputs** (artifacts handed to the next), its own self-debug, and a
done-criteria. Phase N's Inputs are exactly Phase N-1's Outputs, so a phase can be graded on its own.

> **Self-debug in every phase:** (1) run `runCryptoSelfTests()` before opening any socket in phases
> that touch crypto; (2) log every FSM move with `logState(from, to)` and guard packet handlers with
> `assertState(...)`; (3) end the phase with the `check(...)` checklist and a single `report(...)`
> call. If a self-test or checklist item fails, **stop and print the report with `status: FAIL`** —
> do not continue to the next phase.

### Standard per-phase report format

```
=== PHASE <n> REPORT ===
status: PASS | FAIL
self-tests: <passed>/<total>
state-path: IDLE -> ... -> <final>
artifacts: <key=value list handed to the next phase>
notes: <first failing assertion / error, if any>
```

### PHASE 1 — Setup & Config

- **Objective:** project compiles and runs; config loads.
- **Inputs:** none (just `.env`).
- **Steps:** create the structure, `npm install`, implement `config.ts` (load + validate `.env`,
  `parseInt` numbers, throw on missing required values) and `index.ts` that prints the loaded config
  and reads `PHASE` to know which phase to run.
- **Self-debug:** `check('tsc clean', ...)` via `npx tsc --noEmit`; `check('config complete', ...)`.
- **Outputs:** validated config object.
- **Done:** `npm run dev` prints config; `npx tsc --noEmit` is clean.

### PHASE 2 — Login Server

- **Objective:** authenticate at the login server and obtain all session ids + game address.
- **Inputs:** validated config (Phase 1).
- **Steps:** implement `Connection`, `PacketReader/Writer`, and the crypto files; connect; decode
  Init (`decryptInit` → modulus + Blowfish key); RequestGGAuth (or skip); RequestAuthLogin with RSA
  credentials → LoginOk (`loginOkId1/2`); RequestServerList → parse → pick `L2_SERVER_ID`;
  RequestServerLogin → PlayOk (`playOkId1/2`); close the login connection.
- **Self-debug:** `runCryptoSelfTests()` first; `[STATE]` path WAIT_INIT → WAIT_LOGIN_OK →
  WAIT_SERVER_LIST → WAIT_PLAY_OK; checklist `check('modulus is 128 bytes', ...)`,
  `check('have 4 session ids', ...)`, `check('have game host/port', ...)`. On `LoginFail`/`PlayFail`
  print the reason and report FAIL.
- **Outputs:** `loginOkId1`, `loginOkId2`, `playOkId1`, `playOkId2`, `gameHost`, `gamePort`.
- **Done:** PlayOk reached; all four ids + game address known.

### PHASE 3 — Game Auth & Character

- **Objective:** authenticate at the game server and select the character.
- **Inputs:** the 4 session ids + game host/port (Phase 2).
- **Steps:** connect to the game server; send ProtocolVersion `0x0E` (raw); read CryptInit `0x2E`,
  call `gameCrypt.init(xorKey, flag !== 0)` (cipher ON); send AuthRequest `0x2B` (encrypted); read
  CharSelectInfo `0x09` (confirm `charCount >= 1`); send CharacterSelected `0x12`; read CharSelected
  `0x0B` (tolerate it being skipped to UserInfo).
- **Self-debug:** `runCryptoSelfTests()` incl. game-XOR round-trip first; `[STATE]` path
  WAIT_CRYPT_INIT → WAIT_CHAR_LIST → WAIT_CHAR_SELECTED; checklist `check('crypt enabled', ...)`,
  `check('charCount >= 1', ...)`.
- **Outputs:** an open, encrypted game connection in state WAIT_USER_INFO (+ the live `gameCrypt`).
- **Done:** character selected (or UserInfo already arriving).

### PHASE 4 — Enter World & Keepalive

- **Objective:** enter the world and stay connected.
- **Inputs:** the encrypted game connection in WAIT_USER_INFO (Phase 3).
- **Steps:** send RequestKeyMapping (`0xD0 0x0021`) then EnterWorld `0x11` + 104 zero bytes; on
  UserInfo `0x32` print **`IN_GAME`**; then answer every `0xD3` ping with a `0xA8` pong.
- **Self-debug:** `[STATE]` path WAIT_USER_INFO → IN_GAME; checklist `check('IN_GAME printed', ...)`,
  `check('answered >=1 ping', ...)`.
- **Outputs:** a live, ping-answering session.
- **Done:** `IN_GAME` printed; stays connected ≥ 60s answering pings with no crash.

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
  HighFive OPCODE MAP exactly (ProtocolVersion `0x0E`, CryptInit `0x2E`, AuthRequest `0x2B`, …).
- **AuthRequest rejected.** Key order is `playOkId2, playOkId1, loginOkId1, loginOkId2`. HighFive has
  **no** trailing language field. Remember AuthRequest is **encrypted** (cipher is on after CryptInit).
- **CharacterSelected ignored.** You must append exactly 14 zero bytes after the slot index.
- **No UserInfo after EnterWorld / silent disconnect.** You forgot the 104 bytes of padding, or you
  skipped RequestKeyMapping. HighFive enter-world = RequestKeyMapping (`0xD0 0x0021`) then EnterWorld
  `0x11` + `b[104]` zeros.
- **Game packets look scrambled / decode as garbage.** The game stream **is encrypted** (16-byte
  shifting XOR). Make sure you called `gameCrypt.init(xorKey, flag !== 0)` after CryptInit and that
  you **decrypt every received body and encrypt every sent body** (except the raw ProtocolVersion).
  The static key tail is `c8 27 93 01 a1 6c 31 97`. Verify `decrypt(encrypt(x)) === x` first.
- **First game packet after CryptInit rejected.** Unlike the CT-0 dialect, HighFive **encrypts** the
  first client packet after CryptInit (AuthRequest) — do not send it raw.
- **Connection closes after a minute.** You aren't answering pings. Reply to every `0xD3` with the
  13-byte `0xA8` pong.

---

## FINAL DELIVERABLE

A complete, compiling project as specified. Running `npm run dev` with a valid `.env` against a live
L2J Mobius CT_2.6_HighFive server connects through both the login and game phases, prints `IN_GAME`,
and keeps the character connected by answering pings. Each phase prints its self-debug report. No
extra features.
