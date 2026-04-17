# Lineage 2 HighFive — Client ↔ Server Protocol Specification

**Chronicle:** HighFive
**Protocol version:** `273` (also valid: `267`, `268`, `271` — same wire format)
**Server flavor:** L2J Mobius (CT 2.6 HighFive)
**Scope:** this document describes the complete wire protocol used between a game client and the two servers it talks to (the Login Server and the Game Server), plus the exact sequence of packets needed to automatically log in and enter the world as a character. It is language-agnostic and is intended to let another developer (or another LLM) re-implement a working client in any language.

The reference implementation this spec was extracted from lives in [src/](src/) of this repository. File paths are cited only for cross-checking; the spec itself does not depend on any language feature or library beyond "raw TCP socket", "RSA (no padding)", and "Blowfish ECB".

---

## 1. Overview

A Lineage 2 session has two independent TCP connections, executed strictly in sequence:

1. **Login phase** — client connects to the Login Server on `loginHost:loginPort` (typically port `2106`). The client authenticates with a login/password, receives a list of game servers, picks one, and is issued two pairs of 32-bit session tokens: `loginOkId1/2` and `playOkId1/2`. The client disconnects from the Login Server when this phase is over.

2. **Game phase** — client connects to the selected Game Server on the IP/port returned by the Login Server's ServerList. The client performs a handshake, identifies itself using the 4 session tokens obtained in phase 1, picks a character by slot number, and sends an EnterWorld packet. The server replies with a UserInfo packet which places the character in the world. From that point the connection is long-lived: the server streams world events, the client sends gameplay commands, and both sides periodically exchange keepalive pings.

```
  +--------+        +--------------+        +-------------+
  | Client |--TCP-->| Login Server |  disc. | Game Server |
  |        |<--6 pkt exchange-->  |------>  |             |
  |        |                                |             |
  |        |--------new TCP connect-------->|             |
  |        |<-------handshake + auth------->|             |
  |        |<======long-lived game session=>|             |
  +--------+                                 +-------------+
```

---

## 2. Common primitives

### 2.1 Endianness

**Everything is little-endian** unless explicitly noted. This applies to:

- packet length prefix (`u16 LE`),
- all integer fields in every packet (client → server and server → client),
- the 32-bit words inside the NewCrypt checksum,
- the rolling DWORD at bytes 8..11 of the game XOR key.

The two exceptions are:

- **IPv4 address bytes** inside the ServerList record — stored as 4 individual bytes in network (big-endian, `a.b.c.d`) order, not as a single 32-bit integer.
- **RSA modulus** — a big-endian 128-byte integer by convention of the RSA standard. The modulus is additionally scrambled by the server (see §3.4).

### 2.2 Primitive types

| Name | Size | Notes |
|------|------|-------|
| `u8`  | 1 byte | unsigned |
| `u16` | 2 bytes LE | unsigned |
| `i32` | 4 bytes LE | signed |
| `u32` | 4 bytes LE | unsigned |
| `i64` | 8 bytes LE | signed |
| `f64` | 8 bytes LE | IEEE-754 double |
| `bytes[N]` | N bytes | raw |
| `str` | UTF-16LE | variable, terminated by a `u16 0x0000` |

All types written by the reference implementation are in [src/network/PacketWriter.ts](src/network/PacketWriter.ts); all types read are in [src/network/PacketReader.ts](src/network/PacketReader.ts).

### 2.3 Packet framing

Every packet on both the Login Server connection and the Game Server connection has the same frame:

```
+---------+-----------------------+
| u16 len | body (len - 2 bytes)  |
+---------+-----------------------+
```

- `len` is little-endian and **includes the 2 bytes of the length field itself**. The minimum legal value is `2` (empty body).
- `body` starts with a 1-byte opcode (or, for extended game packets, a `u8` + `u16 LE` sub-opcode — see §5.3.7).
- `body` may be encrypted (see §3). **Encryption is applied to the body only, never to the length prefix.**

Reassembly algorithm (pseudocode):

```
buf = empty
while socket is open:
    buf += read(socket)
    while len(buf) >= 2:
        n = u16_le(buf[0..2])
        if len(buf) < n: break
        pkt = buf[0..n]
        buf = buf[n..]
        process(pkt)
```

Reference: [Connection.ts:239-258](src/network/Connection.ts#L239-L258).

---

## 3. Cryptography

Three independent cryptographic primitives are used: Blowfish (login phase), RSA-1024 with no padding (credential submission only), and an L2-specific 16-byte XOR stream cipher (game phase).

### 3.1 Blowfish (login phase)

Standard Blowfish in **ECB mode**, 16 Feistel rounds, 64-bit block, P-array of 18 DWORDs, 4 S-boxes of 256 DWORDs each. Any production Blowfish library will work; the L2 protocol uses no tweaks.

- **Block size:** 8 bytes. All login packets to be encrypted/decrypted are padded to a multiple of 8 bytes before encryption and are whole-number-of-8-blocks after decryption.
- **Byte order inside a block:** Blowfish internally consumes two 32-bit halves. The L2 implementation uses **little-endian** `bytesTo32Bits`, which is the standard OpenSSL / Bouncy Castle convention for packet-based Blowfish.
- **Key length:** 16 bytes (both the static login key and the session key returned in Init).

Reference: [BlowfishEngine.ts](src/crypto/BlowfishEngine.ts).

### 3.2 NewCrypt XOR checksum (login phase, post-Init)

Every login packet after Init is protected by a 32-bit XOR checksum written in the last 4 bytes of the (already-padded) body.

**Compute / verify algorithm** (little-endian, 4-byte DWORDs):

```
sum = 0
for i in 0, 4, 8, ..., size - 8:       # every DWORD except the last one
    sum ^= u32_le(raw[i..i+4])
# last 4 bytes of raw hold the checksum (or must be overwritten with `sum`)
```

The `size` MUST be a multiple of 4 and strictly greater than 4.

Reference: [NewCrypt.ts:18-66](src/crypto/NewCrypt.ts#L18-L66).

### 3.3 NewCrypt rolling XOR (Init packet only)

The Init packet uses a rolling XOR applied *in addition to* the Blowfish decryption. The rolling XOR is a one-pass operation over the 4-byte DWORDs of the body, walked **from the end toward the beginning**, with a feedback loop:

```
size = len(body)
seed = u32_le(body[size - 8 .. size - 4])     # 4-byte seed (the 8 bytes at the tail
                                              # are reserved: seed then 4 unused bytes)
key  = seed
pos  = size - 12
while pos >= 4:
    w = u32_le(body[pos..pos+4])
    w ^= key
    key = (key - w) & 0xFFFFFFFF              # new key for the next (lower) DWORD
    body[pos..pos+4] = u32_le_bytes(w)
    pos -= 4
# After this loop the body up to (size - 8) is the real payload;
# discard the last 8 bytes.
```

Reference: [NewCrypt.ts:69-90](src/crypto/NewCrypt.ts#L69-L90), [LoginCrypt.ts:41-64](src/login/LoginCrypt.ts#L41-L64).

### 3.4 RSA-1024 for credential submission

The server sends a scrambled 128-byte RSA public modulus inside the Init packet. The client unscrambles it, encrypts a 128-byte plaintext credential block with `RSA_NO_PADDING`, and sends the 128-byte ciphertext inside RequestAuthLogin.

**Key parameters:**

- Key size: 1024 bits (128 bytes modulus).
- Public exponent: `65537` (`0x10001`).
- Padding: **none** (`RSA_NO_PADDING`). The 128-byte plaintext block must be exactly 128 bytes.

**Plaintext block layout (128 bytes):**

| Offset | Size | Content |
|--------|------|---------|
| `0x00` | 94   | zeros |
| `0x5E` | 14   | login, ASCII, null-padded (no null terminator required, the padding is zeros) |
| `0x6C` | 2    | zeros (separator) |
| `0x6E` | 16   | password, ASCII, null-padded |
| `0x7E` | 2    | zeros |

Reference: [RSACrypt.ts:68-127](src/crypto/RSACrypt.ts#L68-L127).

**Unscrambling the modulus.** The Init packet's 128-byte `scrambledRsaKey` must be unscrambled with this sequence of in-place operations (in exactly this order):

```
# C^-1: XOR bytes 0x40..0x7F with bytes 0x00..0x3F
for i in 0..0x40:
    n[0x40 + i] ^= n[i]

# B^-1: XOR bytes 0x0D..0x10 with bytes 0x34..0x37
for i in 0..4:
    n[0x0D + i] ^= n[0x34 + i]

# A^-1: XOR bytes 0x00..0x3F with bytes 0x40..0x7F
for i in 0..0x40:
    n[i] ^= n[0x40 + i]

# D^-1: swap bytes 0x00..0x03 with 0x4D..0x50
for i in 0..4:
    swap(n[0x00 + i], n[0x4D + i])
```

After that, `n` is the big-endian RSA modulus ready to be used with a standard RSA library.

Reference: [ScrambledRSAKey.ts:24-40](src/crypto/ScrambledRSAKey.ts#L24-L40).

### 3.5 Login Blowfish keys

**Static key** (used *only* to decrypt the Init packet):

```
6B 60 CB 5B 82 CE 90 B1 CC 2B 6C 55 6C 6C 6C 6C
```

**Session key** — 16 bytes received inside Init, at offset 153 of the body (after opcode+sessionId+protocolRev+scrambledRsaKey+16 reserved bytes). It is used for all login packets after Init, in both directions.

Reference: [LoginCrypt.ts:12-31](src/login/LoginCrypt.ts#L12-L31).

### 3.6 Login packet encryption pipelines

**Decrypt the Init packet (S→C, opcode `0x00`):**

```
body_enc = raw[2..]                         # strip u16 length
plain    = blowfish_ecb_decrypt(body_enc, STATIC_KEY)   # whole body (multiple of 8)
seed     = u32_le(plain[size - 8 .. size - 4])
rolling_xor_reverse(plain, seed)            # see §3.3
payload  = plain[0 .. size - 8]             # drop last 8 bytes
```

**Decrypt any subsequent S→C login packet:**

```
body_enc = raw[2..]
plain    = blowfish_ecb_decrypt(body_enc, SESSION_KEY)
assert newcrypt_checksum_ok(plain)          # last 4 bytes = XOR of all preceding DWORDs
# `plain` is the real body, starting with the opcode byte.
```

**Encrypt a C→S login packet (used for every outgoing login packet):**

```
body = opcode_byte + fields...              # raw, unencrypted
# 1. pad to multiple of 4 with zeros
# 2. append 8 zero bytes (4 reserved for checksum + 4 spare)
# 3. pad to multiple of 8 with zeros
# 4. write checksum into the last 4 bytes of the *3-step-padded* buffer
# 5. Blowfish-ECB encrypt with SESSION_KEY
# 6. prepend u16 LE length (encrypted_len + 2)
```

Reference: [LoginCrypt.ts:84-111](src/login/LoginCrypt.ts#L84-L111).

### 3.7 Game XOR stream cipher

After the game-side handshake (§5.3) the client receives 8 bytes of server-chosen XOR key. The full 16-byte key is formed by appending a fixed 8-byte tail:

```
staticTail = C8 27 93 01 A1 6C 31 97
key_cs = serverKey[0..8] + staticTail     # client→server key
key_sc = serverKey[0..8] + staticTail     # server→client key (same bytes, but evolves independently)
```

**Encryption (client → server)** — XOR each byte with the key and the previous *output* byte:

```
prev = 0
for i in 0..len(body):
    out[i] = body[i] ^ key_cs[i & 15] ^ prev
    prev   = out[i]
```

**Decryption (server → client)** — XOR each byte with the key and the previous *input* byte:

```
prev = 0
for i in 0..len(body):
    out[i] = body[i] ^ key_sc[i & 15] ^ prev
    prev   = body[i]                         # NOTE: the *encrypted* byte, not the decrypted one
```

**Per-packet key rotation** — after each direction processes a packet of size `N`, the DWORD at bytes 8..11 of the corresponding key is incremented by `N` (little-endian):

```
w  = u32_le(key[8..12])
w  = (w + N) & 0xFFFFFFFF
key[8..12] = u32_le_bytes(w)
```

Both `key_cs` and `key_sc` evolve independently. If the two sides drift out of sync, subsequent packets will be garbage — the stream cipher has no framing recovery.

**First packet rule (HighFive):** on HighFive the very first packet the server sends (CryptInit, §5.3.2) and the very first packet the client sends (ProtocolVersion, §5.3.1) are **plaintext** because the key has not yet been established. Everything after that is encrypted — including the client's AuthRequest, which is the *first encrypted packet*.

Reference: [GameCrypt.ts](src/game/GameCrypt.ts).

---

## 4. Login Server protocol

### 4.1 State machine

```
IDLE
  | connect()
  v
CONNECTING
  | TCP established
  v
WAIT_INIT
  | recv Init (0x00) ............ store sessionId, rsaPublicKey, set session Blowfish key
  |   send RequestGGAuth (0x07)
  v
WAIT_GG_AUTH
  | recv GGAuth (0x0B) .......... store ggAuthResponse
  |   send RequestAuthLogin (0x00)
  v
WAIT_LOGIN_OK
  |-- recv LoginFail (0x01) ---> ERROR (abort)
  |-- recv LoginOk  (0x03) ..... store loginOkId1/2
  |       send RequestServerList (0x05)
  v
WAIT_SERVER_LIST
  | recv ServerList (0x04) ..... pick gameServerIp/port by ServerId
  |   send RequestServerLogin (0x02)
  v
WAIT_PLAY_OK
  |-- recv PlayFail (0x06) ---> ERROR (abort)
  |-- recv PlayOk   (0x07) ..... store playOkId1/2
  v
DONE  (disconnect from login server, move to §5)
```

Reference: [types.ts](src/login/types.ts), [LoginClient.ts](src/login/LoginClient.ts).

### 4.2 Login Server opcode table

| Opcode | Direction | Name | Section |
|--------|-----------|------|---------|
| `0x00` | S→C | Init | §4.3 |
| `0x01` | S→C | LoginFail | §4.4 |
| `0x03` | S→C | LoginOk | §4.5 |
| `0x04` | S→C | ServerList | §4.6 |
| `0x06` | S→C | PlayFail | §4.7 |
| `0x07` | S→C | PlayOk | §4.8 |
| `0x0B` | S→C | GGAuth | §4.9 |
| `0x00` | C→S | RequestAuthLogin | §4.10 |
| `0x02` | C→S | RequestServerLogin | §4.11 |
| `0x05` | C→S | RequestServerList | §4.12 |
| `0x07` | C→S | RequestGGAuth | §4.13 |

Note that opcodes are not globally unique: `0x00` and `0x07` exist in both directions with different semantics. Always disambiguate by direction.

### 4.3 Init (S→C, opcode `0x00`)

Decrypted body (after Blowfish + reverse rolling XOR + dropping 8 trailing bytes):

| Offset | Field | Type | Size | Notes |
|--------|-------|------|------|-------|
| 0 | opcode | `u8` | 1 | `0x00` |
| 1 | `sessionId` | `i32` | 4 | used by RequestGGAuth |
| 5 | `protocolRevision` | `i32` | 4 | expected `0x0000C621` |
| 9 | `scrambledRsaKey` | `bytes[128]` | 128 | must be unscrambled (§3.4) |
| 137 | reserved | `bytes[16]` | 16 | four `i32`, ignored |
| 153 | `blowfishKey` | `bytes[16]` | 16 | session key for subsequent login packets |
| 169 | null terminator | `u8` | 1 | `0x00` |

Total payload: **170 bytes**.

Reference: [InitPacket.ts](src/login/packets/incoming/InitPacket.ts).

### 4.4 LoginFail (S→C, opcode `0x01`)

| Offset | Field | Type |
|--------|-------|------|
| 0 | opcode | `u8` = `0x01` |
| 1 | `reason` | `u8` |

Reason codes observed in the wild:

| Code | Meaning |
|------|---------|
| `0x01` | System error |
| `0x02` | Invalid password |
| `0x03` | User or password wrong |
| `0x04` | Access failed |
| `0x05` | Invalid account info |
| `0x06` | Access denied (try later) |
| `0x07` | Account already in use |

On any LoginFail the client must close the connection.

### 4.5 LoginOk (S→C, opcode `0x03`)

| Offset | Field | Type |
|--------|-------|------|
| 0 | opcode | `u8` = `0x03` |
| 1 | `loginOkId1` | `i32` |
| 5 | `loginOkId2` | `i32` |

Both tokens must be remembered — they are sent in RequestServerList, RequestServerLogin, and later in the game AuthRequest.

### 4.6 ServerList (S→C, opcode `0x04`)

| Offset | Field | Type |
|--------|-------|------|
| 0 | opcode | `u8` = `0x04` |
| 1 | `serverCount` | `u8` |
| 2 | reserved | `u8` |
| 3 + k·21 | server record `k` | see below (21 bytes each) |

**Server record (21 bytes):**

| Offset | Field | Type | Notes |
|--------|-------|------|-------|
| 0 | `serverId` | `u8` | |
| 1 | `ip[0..4]` | `bytes[4]` | IPv4 as `a.b.c.d` (bytes are already in display order) |
| 5 | `port` | `i32` | |
| 9 | `ageLimit` | `u8` | |
| 10 | `isPvp` | `u8` | `0`/`1` |
| 11 | `onlinePlayers` | `u16` | |
| 13 | `maxPlayers` | `u16` | |
| 15 | `isOnline` | `u8` | `0`/`1` |
| 16 | `flags` | `i32` | informational |
| 20 | reserved | `u8` | |

The client selects the record whose `serverId` matches the configured `ServerId` and uses its `ip:port` for the Game Server connection.

Reference: [ServerListPacket.ts](src/login/packets/incoming/ServerListPacket.ts).

### 4.7 PlayFail (S→C, opcode `0x06`)

| Offset | Field | Type |
|--------|-------|------|
| 0 | opcode | `u8` = `0x06` |
| 1 | `reason` | `i32` |

Reasons: `0x01` server full, `0x02` server down, `0x03` invalid server id, `0x04` access denied.

### 4.8 PlayOk (S→C, opcode `0x07`)

| Offset | Field | Type |
|--------|-------|------|
| 0 | opcode | `u8` = `0x07` |
| 1 | `playOkId1` | `i32` |
| 5 | `playOkId2` | `i32` |

Both tokens must be remembered — they are sent later in the game AuthRequest.

### 4.9 GGAuth (S→C, opcode `0x0B`)

| Offset | Field | Type |
|--------|-------|------|
| 0 | opcode | `u8` = `0x0B` |
| 1 | `ggAuthResponse` | `i32` |

The client must remember `ggAuthResponse` and echo it inside RequestAuthLogin.

### 4.10 RequestAuthLogin (C→S, opcode `0x00`)

Body size: **176 bytes** (before padding/encryption).

| Offset | Field | Type | Size |
|--------|-------|------|------|
| 0 | opcode | `u8` | 1 |
| 1 | RSA ciphertext | `bytes[128]` | 128 |
| 129 | `ggAuthResponse` | `i32` | 4 |
| 133 | fixed GG block | `bytes[43]` | 43 |

The fixed GG block (hex):

```
23 01 00 00 67 45 00 00 AB 89 00 00 EF CD 00 00
08 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00
```

The 128-byte RSA ciphertext is computed per §3.4 from the login, password, and the unscrambled modulus from Init.

Reference: [RequestAuthLogin.ts](src/login/packets/outgoing/RequestAuthLogin.ts).

### 4.11 RequestServerLogin (C→S, opcode `0x02`)

| Offset | Field | Type |
|--------|-------|------|
| 0 | opcode | `u8` = `0x02` |
| 1 | `loginOkId1` | `i32` |
| 5 | `loginOkId2` | `i32` |
| 9 | `serverId` | `u8` |

### 4.12 RequestServerList (C→S, opcode `0x05`)

| Offset | Field | Type | Value |
|--------|-------|------|-------|
| 0 | opcode | `u8` | `0x05` |
| 1 | `loginOkId1` | `i32` | from LoginOk |
| 5 | `loginOkId2` | `i32` | from LoginOk |
| 9 | `flags` | `i32` | constant `0x04000000` |

Reference: [RequestServerList.ts](src/login/packets/outgoing/RequestServerList.ts).

### 4.13 RequestGGAuth (C→S, opcode `0x07`)

Body size: **40 bytes** (before padding/encryption).

| Offset | Field | Type | Value |
|--------|-------|------|-------|
| 0 | opcode | `u8` | `0x07` |
| 1 | `sessionId` | `i32` | from Init |
| 5 | constant 1 | `i32` | `0x00000123` |
| 9 | constant 2 | `i32` | `0x00004567` |
| 13 | constant 3 | `i32` | `0x000089AB` |
| 17 | constant 4 | `i32` | `0x0000CDEF` |
| 21 | padding | `bytes[19]` | zeros |

Reference: [RequestGGAuth.ts](src/login/packets/outgoing/RequestGGAuth.ts).

---

## 5. Game Server protocol

### 5.1 State machine

```
IDLE
  | connect()
  v
CONNECTING
  | TCP established
  |   send ProtocolVersion (0x0E)   -- plaintext
  v
WAIT_CRYPT_INIT
  | recv CryptInit (0x2E)            -- plaintext
  |   init XOR cipher
  |   send AuthRequest (0x2B)        -- first encrypted packet
  v
WAIT_CHAR_LIST
  | recv CharSelectionInfo (0x09)
  |   send CharacterSelected (0x12, slot = configured char slot)
  v
WAIT_CHAR_SELECTED
  |-- recv CharSelected (0x0B) ----.
  |-- recv UserInfo (0x32) direct -+--> fall through to IN_GAME steps
  |                                |
  |   send RequestKeyMapping (0xD0 0x21)
  |   send EnterWorld (0x11)
  v
WAIT_USER_INFO
  | recv UserInfo (0x32)
  v
IN_GAME
  | handle world packets, send gameplay packets,
  | answer NetPingRequest (0xD3) with NetPing (0xA8)
  v
(disconnect) -> ERROR / DISCONNECTED
```

Reference: [GameClientState.ts](src/game/GameClientState.ts), [GameClient.ts](src/game/GameClient.ts).

### 5.2 Framing and encryption

- Packet framing is identical to the login server (§2.3): `u16 LE length` prefix that includes itself, followed by the body.
- The body is encrypted with the 16-byte XOR stream cipher (§3.7) **except for the very first packet in each direction**: client's ProtocolVersion and server's CryptInit are plaintext.
- There is **no** per-packet checksum on the game stream (in contrast to the login stream). Integrity is implicit: a wrong byte desynchronizes the stream cipher and corrupts all following packets.

### 5.3 Handshake packets

Every multi-byte field below is little-endian. Opcodes are the first byte of the *decrypted* body.

#### 5.3.1 ProtocolVersion (C→S, opcode `0x0E`) — plaintext

| Offset | Field | Type | Value |
|--------|-------|------|-------|
| 0 | opcode | `u8` | `0x0E` |
| 1 | `protocol` | `i32` | `273` |

Reference: [ProtocolVersion.ts](src/game/packets/outgoing/ProtocolVersion.ts).

#### 5.3.2 CryptInit (S→C, opcode `0x2E`) — plaintext

23-byte packet (body, without the 2-byte length prefix):

| Offset | Field | Type | Notes |
|--------|-------|------|-------|
| 0 | opcode | `u8` | `0x2E` |
| 1 | `result` | `u8` | must be `1` for success; any other value is a rejection |
| 2 | `xorKey` | `bytes[8]` | first 8 bytes of the stream cipher key |
| 10 | `encryptionFlag` | `u32` | non-zero → encryption enabled for subsequent packets |
| 14 | reserved | `bytes[9]` | ignored |

After receiving CryptInit, the client builds `key_cs` and `key_sc` as `xorKey || staticTail` (§3.7) and enables encryption according to `encryptionFlag`.

Reference: [GameClient.ts:205-250](src/game/GameClient.ts#L205-L250).

#### 5.3.3 AuthRequest (C→S, opcode `0x2B`) — first encrypted packet

| Offset | Field | Type | Notes |
|--------|-------|------|-------|
| 0 | opcode | `u8` | `0x2B` |
| 1 | `username` | `str` | UTF-16LE, 2-byte null terminator |
| var | `playOkId2` | `i32` | **note the swapped order** |
| var+4 | `playOkId1` | `i32` | |
| var+8 | `loginOkId1` | `i32` | |
| var+12 | `loginOkId2` | `i32` | |

**The field order `play2, play1, login1, login2` is mandatory** — getting it wrong silently breaks auth on L2J Mobius. Reference: [AuthRequest.ts:34-37](src/game/packets/outgoing/AuthRequest.ts#L34-L37).

#### 5.3.4 CharSelectionInfo (S→C, opcode `0x09`)

| Offset | Field | Type |
|--------|-------|------|
| 0 | opcode | `u8` = `0x09` |
| 1 | `charCount` | `u32` |
| 5 | character records | variable |

The auto-login algorithm does not need to parse character records; it simply picks `CONFIG.CharSlotIndex` (default `0`) and sends CharacterSelected. A reimplementer that wants to display the character list must parse each record: per-character data includes the character name (UTF-16LE string), character id (`i32`), access level (`i32`), class id (`i32`), last used flag, and a variable-length block with appearance, stats, and equipment. The layout is stable across L2J Mobius builds but is irrelevant for auto-entering the world, so its full decoding is out of scope here.

#### 5.3.5 CharacterSelected (C→S, opcode `0x12`)

| Offset | Field | Type | Value |
|--------|-------|------|-------|
| 0 | opcode | `u8` | `0x12` |
| 1 | `slotIndex` | `i32` | 0-based |
| 5 | padding | `bytes[14]` | all zeros |

**The 14 zero bytes are mandatory on L2J Mobius** — the server reads them and will disconnect otherwise. Reference: [CharacterSelected.ts](src/game/packets/outgoing/CharacterSelected.ts).

#### 5.3.6 CharSelected (S→C, opcode `0x0B`)

Confirmation that the selected character was loaded. The body beyond the opcode is not required by the client; the presence of the opcode in state `WAIT_CHAR_SELECTED` triggers sending RequestKeyMapping and EnterWorld.

**Important quirk:** some server builds skip CharSelected and send UserInfo (`0x32`) directly. The client must therefore also accept UserInfo while still in `WAIT_CHAR_SELECTED` and promote the state machine straight to IN_GAME. Reference: [GameClient.ts:184-197](src/game/GameClient.ts#L184-L197).

#### 5.3.7 RequestKeyMapping (C→S, extended opcode `0xD0 0x21`)

| Offset | Field | Type | Value |
|--------|-------|------|-------|
| 0 | main opcode | `u8` | `0xD0` |
| 1 | sub-opcode | `u16` | `0x0021` |

This is the canonical "extended packet" form used by L2 from Interlude onwards: a 1-byte primary opcode (`0xD0`) followed by a 2-byte LE sub-opcode. Reference: [RequestKeyMapping.ts](src/game/packets/outgoing/RequestKeyMapping.ts).

#### 5.3.8 EnterWorld (C→S, opcode `0x11`)

| Offset | Field | Type | Value |
|--------|-------|------|-------|
| 0 | opcode | `u8` | `0x11` |
| 1 | padding | `bytes[104]` | all zeros |

**The 104 zero bytes are mandatory on L2J Mobius** — the server parses them as hardware info / traceroute blob and will throw `BufferUnderflowException` otherwise. Reference: [EnterWorld.ts](src/game/packets/outgoing/EnterWorld.ts).

#### 5.3.9 UserInfo (S→C, opcode `0x32`)

Large packet containing the player's current state. The fields relevant for reaching IN_GAME are the first ones; the rest are used by the world simulation and can be decoded incrementally.

Initial fields (byte offsets within the decrypted body):

| Offset | Field | Type | Notes |
|--------|-------|------|-------|
| 0 | opcode | `u8` = `0x32` | |
| 1 | `x` | `i32` | spawn X |
| 5 | `y` | `i32` | spawn Y |
| 9 | `z` | `i32` | spawn Z |
| 13 | `vehicleId` | `i32` | `0` if unmounted |
| 17 | `objectId` | `i32` | unique id of the player's character in the world |
| 21 | `name` | `str` | UTF-16LE + null terminator |
| var | `race` | `i32` | |
| var+4 | `sex` | `i32` | `0`=male, `1`=female |
| var+8 | `classId` | `i32` | |
| var+12 | `level` | `i32` | |
| var+16 | `exp` | `i64` | |
| ... | STR/DEX/CON/INT/WIT/MEN | `i32` × 6 | |
| ... | `maxHp`, `curHp` | `i32` × 2 | |
| ... | `maxMp`, `curMp` | `i32` × 2 | |
| ... | `maxCp`, `curCp` | `i32` × 2 | |
| ... | `sp` | `i32` | |
| ... | `curLoad`, `maxLoad` | `i32` × 2 | |

The fields after `maxLoad` contain inventory paperdoll slots, abnormal effects, PvP info, etc. They are not needed for the auto-login to report "in game". A reimplementer can treat everything after the first `~24` fields as opaque until it chooses to parse specific features.

### 5.4 Keepalive

The server periodically sends NetPingRequest; the client must answer promptly with NetPing or the server will close the connection.

#### 5.4.1 NetPingRequest (S→C, opcode `0xD3`)

| Offset | Field | Type |
|--------|-------|------|
| 0 | opcode | `u8` = `0xD3` |
| 1 | `pingId` | `i32` |

#### 5.4.2 NetPing (C→S, opcode `0xA8`)

13-byte body (before encryption):

| Offset | Field | Type | Value |
|--------|-------|------|-------|
| 0 | opcode | `u8` | `0xA8` |
| 1 | `pingId` | `i32` | echo from NetPingRequest |
| 5 | reserved | `i32` | `0x00000000` |
| 9 | unknown | `i32` | `0x00080000` |

Reference: [NetPing.ts](src/game/packets/outgoing/NetPing.ts).

### 5.5 Representative gameplay packets

These packets are not required to enter the world, but are included so that a reimplementer knows the pattern used for common commands. All are encrypted with the XOR cipher.

| Opcode | Name | Body (beyond opcode) |
|--------|------|----------------------|
| `0x01` | MoveToLocation | `i32 targetX, i32 targetY, i32 targetZ, i32 originX, i32 originY, i32 originZ, i32 movementMode` (`1` = mouse click) |
| `0x04` | Action | `i32 objectId, i32 originX, i32 originY, i32 originZ, u8 shiftClick` |
| `0x0A` | AttackRequest | `i32 objectId, i32 originX, i32 originY, i32 originZ, u8 shiftClick` |
| `0x14` | UseItem | `i32 itemObjectId` |
| `0x17` | DropItem | `i32 objectId, i32 count, i32 x, i32 y, i32 z` |
| `0x1D` | ChangeWaitType2 | `u8 typeStand` (`0`=sit, `1`=stand) |
| `0x29` | RequestJoinParty | `str playerName` |
| `0x38` | Say2 | `str text, i32 chatType, [str target]` — the `target` field is present only when `chatType` = `24` (whisper) |
| `0x39` | UseSkill | `i32 skillId, u8 ctrlPressed, u8 shiftPressed` |
| `0x63` | RequestQuestList | *(no body)* |

These suffice to implement movement, combat, inventory use, chat, and skill casting. Additional opcodes can be added incrementally — the L2J Mobius source is the authoritative reference for any packet not listed here.

---

## 6. Automatic enter-game algorithm

This section describes the exact sequence of steps the reference client performs to go from "cold start" to "character walking in the world", using only the configuration inputs `username`, `password`, `loginHost`, `loginPort`, `serverId`, `charSlot`, and `protocol = 273`.

### 6.1 Sequence diagram

```
Client                 Login Server                     Game Server
  |                         |                                 |
  |--- TCP connect -------->|                                 |
  |<-- Init (0x00) ---------|                                 |
  |--- RequestGGAuth(0x07)->|                                 |
  |<-- GGAuth (0x0B) -------|                                 |
  |--- RequestAuthLogin ----|                                 |
  |    (0x00, RSA creds)    |                                 |
  |<-- LoginOk (0x03) ------|                                 |
  |--- RequestServerList ---|                                 |
  |    (0x05)               |                                 |
  |<-- ServerList (0x04) ---|                                 |
  |--- RequestServerLogin --|                                 |
  |    (0x02)               |                                 |
  |<-- PlayOk (0x07) -------|                                 |
  |--- disconnect --------->|                                 |
  |                         |                                 |
  |--------------- TCP connect ---------------------->|       |
  |                                                   |       |
  |--- ProtocolVersion (0x0E, plaintext) ------------>|       |
  |<-- CryptInit (0x2E, plaintext) --------------------|       |
  |--- AuthRequest (0x2B, encrypted) ---------------->|       |
  |<-- CharSelectionInfo (0x09) -----------------------|       |
  |--- CharacterSelected (0x12, slot=charSlot) ------>|       |
  |<-- CharSelected (0x0B)  OR  UserInfo (0x32) ------|       |
  |--- RequestKeyMapping (0xD0 0x21) ---------------->|       |
  |--- EnterWorld (0x11, 104 zero bytes) ------------>|       |
  |<-- UserInfo (0x32) --------------------------------|       |
  |                                                   |       |
  |======= IN_GAME =========================================|
  |                                                   |       |
  |<-- NetPingRequest (0xD3) --------------------------|       |
  |--- NetPing (0xA8) --------------------------------->      |
  |                ...                                        |
```

### 6.2 Detailed pseudocode

```
# ---- Phase 1: Login Server ----
loginSock = tcp_connect(loginHost, loginPort)

pkt = read_framed(loginSock)                      # §2.3
init = blowfish_ecb_decrypt(pkt.body, STATIC_LOGIN_BLOWFISH_KEY)
seed = u32_le(init[len(init)-8 : len(init)-4])
rolling_xor_reverse(init, seed)                   # §3.3
init = init[ : len(init) - 8]

assert init[0] == 0x00
sessionId          = i32_le(init[1:5])
protocolRev        = i32_le(init[5:9])            # expect 0xC621
scrambledRsaKey    = init[9:137]
# init[137:153] reserved
sessionBlowfishKey = init[153:169]                # 16 bytes

rsaModulus = unscramble_rsa_key(scrambledRsaKey)  # §3.4
currentLoginKey = sessionBlowfishKey              # switch from static to session key

# --- RequestGGAuth (0x07) ---
body = bytes([0x07]) + i32_le(sessionId)
     + i32_le(0x123) + i32_le(0x4567) + i32_le(0x89AB) + i32_le(0xCDEF)
     + zeros(19)                                   # body = 40 bytes
send_login_encrypted(loginSock, body, currentLoginKey)

pkt = read_framed(loginSock)
gg = decrypt_login(pkt.body, currentLoginKey)     # Blowfish + verify checksum
assert gg[0] == 0x0B
ggAuthResponse = i32_le(gg[1:5])

# --- RequestAuthLogin (0x00) ---
plaintext = zeros(94) + ascii_right_padded(username, 14) + zeros(2)
          + ascii_right_padded(password, 16) + zeros(2)               # 128 bytes
rsaCipher = rsa_encrypt_no_padding(plaintext, rsaModulus, e=65537)    # 128 bytes
body = bytes([0x00]) + rsaCipher + i32_le(ggAuthResponse) + GG_FIXED_BLOCK_43
send_login_encrypted(loginSock, body, currentLoginKey)

pkt = read_framed(loginSock)
ok = decrypt_login(pkt.body, currentLoginKey)
if ok[0] == 0x01: abort("LoginFail reason=" + str(ok[1]))
assert ok[0] == 0x03
loginOkId1 = i32_le(ok[1:5])
loginOkId2 = i32_le(ok[5:9])

# --- RequestServerList (0x05) ---
body = bytes([0x05]) + i32_le(loginOkId1) + i32_le(loginOkId2) + i32_le(0x04000000)
send_login_encrypted(loginSock, body, currentLoginKey)

pkt = read_framed(loginSock)
sl = decrypt_login(pkt.body, currentLoginKey)
assert sl[0] == 0x04
count = sl[1]; pos = 3
servers = []
for i in 0..count:
    rec = parse_server_record(sl[pos : pos+21])   # §4.6
    pos += 21
    servers.append(rec)

chosen = first(s for s in servers if s.serverId == targetServerId)
if chosen is None: abort("ServerId not found")

# --- RequestServerLogin (0x02) ---
body = bytes([0x02]) + i32_le(loginOkId1) + i32_le(loginOkId2) + bytes([chosen.serverId])
send_login_encrypted(loginSock, body, currentLoginKey)

pkt = read_framed(loginSock)
po = decrypt_login(pkt.body, currentLoginKey)
if po[0] == 0x06: abort("PlayFail reason=" + str(i32_le(po[1:5])))
assert po[0] == 0x07
playOkId1 = i32_le(po[1:5])
playOkId2 = i32_le(po[5:9])

tcp_close(loginSock)

# ---- Phase 2: Game Server ----
gameSock = tcp_connect(chosen.ip, chosen.port)

# Plaintext ProtocolVersion (0x0E)
send_framed(gameSock, bytes([0x0E]) + i32_le(273))

# Plaintext CryptInit (0x2E), exactly 23 bytes of body
pkt = read_framed(gameSock)
body = pkt.body
assert body[0] == 0x2E and body[1] == 0x01
xorKey        = body[2:10]
encryptionOn  = u32_le(body[10:14]) != 0
staticTail    = bytes([0xC8, 0x27, 0x93, 0x01, 0xA1, 0x6C, 0x31, 0x97])
key_cs = xorKey + staticTail        # 16 bytes
key_sc = xorKey + staticTail
# from now on, encrypt/decrypt with §3.7

# AuthRequest (0x2B) — FIRST ENCRYPTED PACKET (on HighFive it IS encrypted)
nameUtf16 = utf16le(username) + bytes([0x00, 0x00])
body = bytes([0x2B]) + nameUtf16
     + i32_le(playOkId2) + i32_le(playOkId1)    # SWAPPED ORDER!
     + i32_le(loginOkId1) + i32_le(loginOkId2)
send_game_encrypted(gameSock, body, key_cs)

# CharSelectionInfo (0x09)
pkt = read_framed(gameSock); body = decrypt_game(pkt.body, key_sc)
assert body[0] == 0x09
# charCount = u32_le(body[1:5]); per-character records are not needed here.

# CharacterSelected (0x12, slot = charSlot) + 14 zero bytes
body = bytes([0x12]) + i32_le(charSlot) + zeros(14)
send_game_encrypted(gameSock, body, key_cs)

# Either CharSelected (0x0B) or UserInfo (0x32) directly
pkt = read_framed(gameSock); body = decrypt_game(pkt.body, key_sc)
if body[0] == 0x0B:
    # RequestKeyMapping (0xD0 0x21)
    send_game_encrypted(gameSock, bytes([0xD0]) + u16_le(0x0021), key_cs)
    # EnterWorld (0x11) + 104 zero bytes
    send_game_encrypted(gameSock, bytes([0x11]) + zeros(104), key_cs)
    pkt = read_framed(gameSock); body = decrypt_game(pkt.body, key_sc)

assert body[0] == 0x32    # UserInfo
state = IN_GAME

# ---- Phase 3: stay in-game ----
loop forever:
    pkt  = read_framed(gameSock)
    body = decrypt_game(pkt.body, key_sc)
    if body[0] == 0xD3:
        pingId = i32_le(body[1:5])
        pong   = bytes([0xA8]) + i32_le(pingId) + i32_le(0) + i32_le(0x00080000)
        send_game_encrypted(gameSock, pong, key_cs)
    else:
        handle_world_packet(body)
```

### 6.3 Required configuration inputs

| Input | Typical value | Notes |
|-------|---------------|-------|
| `username` | string | Login account (the reference client defaults to `qwerty`) |
| `password` | string | Password (defaults to `qwerty`) |
| `loginHost` | IPv4/DNS | Login Server address |
| `loginPort` | `2106` | |
| `protocol` | `273` | Must match a HighFive-compatible value (also `267`, `268`, `271`) |
| `serverId` | `1..255` | The numeric id of the desired Game Server inside the ServerList |
| `charSlot` | `0..6` | Which existing character to log in as (no auto-create is performed) |

The reference implementation reads these from environment variables (`L2_USERNAME`, `L2_PASSWORD`, `L2_LOGIN_IP`, `L2_LOGIN_PORT`, `L2_PROTOCOL`, `L2_SERVER_ID`, `L2_CHAR_SLOT`) — see [src/config.ts:77-111](src/config.ts#L77-L111). A reimplementer can use any equivalent source.

### 6.4 Error handling expected from a correct client

- **Wrong credentials** → LoginFail (`0x01`) with reason code; abort.
- **Server not in list** → no record matches `serverId`; abort before sending RequestServerLogin.
- **Server full / down** → PlayFail (`0x06`); abort.
- **Bad protocol version** → CryptInit's `result` byte is not `1`; abort.
- **Character slot empty or out of range** → the server closes the connection after CharacterSelected; the client should surface this as an error (there is no dedicated "char missing" packet).
- **Missing NetPing answer** → server disconnects after a timeout (~60 s). Always answer pings.

---

## 7. Implementation checklist

Use this list when porting to a new language. Tick every box to have a working auto-login client.

- [ ] TCP connection with `u16 LE` length-prefixed frame reassembly.
- [ ] Blowfish ECB 16-round cipher, little-endian byte-to-DWORD conversion.
- [ ] Static login Blowfish key `6B 60 CB 5B 82 CE 90 B1 CC 2B 6C 55 6C 6C 6C 6C`.
- [ ] Init packet decryption = Blowfish(static) + rolling XOR reverse + drop trailing 8 bytes.
- [ ] Per-packet NewCrypt XOR checksum (compute on send, verify on recv) over 4-byte DWORDs with last 4 bytes holding the result.
- [ ] Login-packet padding: 4-byte align → +8 zeros → 8-byte align → write checksum → Blowfish encrypt.
- [ ] RSA modulus unscrambler (C^-1, B^-1, A^-1, D^-1 in that order).
- [ ] RSA-1024 encryption with `RSA_NO_PADDING`, exponent 65537, 128-byte plaintext layout (94 / 14 login / 2 / 16 password / 2).
- [ ] Login state machine with all 7 packets (§4.3 — §4.13).
- [ ] ServerList parsing with 21-byte records (§4.6).
- [ ] Transition to Game Server using `gameServerIp:gameServerPort` from the matched ServerList record.
- [ ] Game packet framing same as login; XOR cipher only after CryptInit.
- [ ] Static game XOR tail `C8 27 93 01 A1 6C 31 97`.
- [ ] Stream-cipher chaining: `out[i] = src[i] ^ key[i&15] ^ prev`; on send `prev = out[i]`, on recv `prev = encrypted[i]`.
- [ ] Key rotation after every packet: `key[8..12] += packetSize` (LE DWORD).
- [ ] ProtocolVersion (0x0E) with `i32 273`, plaintext.
- [ ] AuthRequest (0x2B): username UTF-16LE + null, then **playOkId2, playOkId1, loginOkId1, loginOkId2** in that order.
- [ ] CharacterSelected (0x12): `i32 slotIndex` + 14 zero bytes.
- [ ] Accept UserInfo (0x32) directly in `WAIT_CHAR_SELECTED` state as an implicit confirmation.
- [ ] RequestKeyMapping extended packet `0xD0 0x21` followed by EnterWorld (0x11) + 104 zero bytes.
- [ ] Reach IN_GAME upon receiving UserInfo (0x32); parse at least the initial fields (x, y, z, objectId, name, level, HP/MP).
- [ ] NetPing (0xA8) answer to every NetPingRequest (0xD3) with `pingId, 0x00000000, 0x00080000`.

---

## 8. Constants appendix

| Name | Value | Used in |
|------|-------|---------|
| Protocol version (HighFive) | `273` (also `267`, `268`, `271`) | ProtocolVersion (§5.3.1) |
| Expected Init protocol revision | `0x0000C621` | Init (§4.3) |
| Static login Blowfish key | `6B 60 CB 5B 82 CE 90 B1 CC 2B 6C 55 6C 6C 6C 6C` | Init decryption (§3.5) |
| Static game XOR tail | `C8 27 93 01 A1 6C 31 97` | XOR key (§3.7) |
| RequestServerList flags | `0x04000000` | §4.12 |
| RequestGGAuth constants | `0x00000123`, `0x00004567`, `0x000089AB`, `0x0000CDEF` | §4.13 |
| RequestAuthLogin fixed GG block | 43 bytes starting `23 01 00 00 67 45 00 00 AB 89 ...` | §4.10 |
| RSA plaintext layout | 94 zero / 14 login / 2 zero / 16 password / 2 zero = 128 bytes | §3.4 |
| RSA public exponent | `65537` (`0x10001`) | §3.4 |
| CharacterSelected padding | 14 zero bytes after `slotIndex` | §5.3.5 |
| EnterWorld padding | 104 zero bytes after opcode | §5.3.8 |
| NetPing trailing constants | `0x00000000`, `0x00080000` | §5.4.2 |

---

## 9. Source cross-reference

For cross-checking against the reference TypeScript implementation in this repository:

- Framing: [src/network/Connection.ts](src/network/Connection.ts), [src/network/PacketReader.ts](src/network/PacketReader.ts), [src/network/PacketWriter.ts](src/network/PacketWriter.ts).
- Crypto: [src/crypto/BlowfishEngine.ts](src/crypto/BlowfishEngine.ts), [src/crypto/NewCrypt.ts](src/crypto/NewCrypt.ts), [src/crypto/RSACrypt.ts](src/crypto/RSACrypt.ts), [src/crypto/ScrambledRSAKey.ts](src/crypto/ScrambledRSAKey.ts).
- Login: [src/login/LoginCrypt.ts](src/login/LoginCrypt.ts), [src/login/LoginClient.ts](src/login/LoginClient.ts), [src/login/types.ts](src/login/types.ts), [src/login/packets/incoming/](src/login/packets/incoming/), [src/login/packets/outgoing/](src/login/packets/outgoing/).
- Game: [src/game/GameCrypt.ts](src/game/GameCrypt.ts), [src/game/GameClient.ts](src/game/GameClient.ts), [src/game/GameClientState.ts](src/game/GameClientState.ts), [src/game/packets/outgoing/](src/game/packets/outgoing/).
- Config: [src/config.ts](src/config.ts).
