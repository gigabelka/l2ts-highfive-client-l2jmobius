import { Logger } from '../logger/Logger';

/**
 * Unscramble RSA modulus from Login Server Init packet.
 *
 * L2J server scrambles the 128-byte modulus with operations D -> A -> B -> C.
 * Client must unscramble in reverse order: C^-1 -> B^-1 -> A^-1 -> D^-1.
 *
 *   C^-1: bytes[40..7F] ^= bytes[0..3F]
 *   B^-1: bytes[0D..10] ^= bytes[34..37]
 *   A^-1: bytes[0..3F]  ^= bytes[40..7F]
 *   D^-1: swap(bytes[0..3], bytes[4D..50])
 */
class ScrambledRSAKey {
  static unscramble(scrambled: Buffer): Buffer {
    if (scrambled.length !== 128) {
      throw new Error(`Scrambled RSA key must be 128 bytes, got ${scrambled.length}`);
    }

    const n = Buffer.from(scrambled);

    Logger.logCryptoSingle('RSA SCRAMBLED (first 16)', scrambled.subarray(0, 16));

    for (let i = 0; i < 0x40; i++) {
      n[0x40 + i]! ^= n[i]!;
    }

    for (let i = 0; i < 4; i++) {
      n[0x0D + i]! ^= n[0x34 + i]!;
    }

    for (let i = 0; i < 0x40; i++) {
      n[i]! ^= n[0x40 + i]!;
    }

    for (let i = 0; i < 4; i++) {
      const tmp    = n[0x00 + i]!;
      n[0x00 + i]  = n[0x4D + i]!;
      n[0x4D + i]  = tmp;
    }

    Logger.logCryptoSingle('RSA UNSCRAMBLED (first 16)', n.subarray(0, 16));

    return n;
  }
}

export { ScrambledRSAKey };
