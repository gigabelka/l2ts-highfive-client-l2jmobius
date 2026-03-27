import { Logger } from '../logger/Logger';
import { isCurrentProtocolHighFive } from '../config';

/**
 * Game Server Cryptography
 * Supports both CT_0_Interlude simple 8-byte XOR (used by L2J Mobius CT0)
 * and standard Lineage 2 16-byte shifting XOR (used by HighFive and retail).
 */
export class GameCrypt {
    private key_sc: Buffer = Buffer.alloc(16);
    private key_cs: Buffer = Buffer.alloc(16);
    private enabled: boolean = false;
    private firstPacket: boolean = true;
    private isStandardCrypt: boolean = false;

    /**
     * Initialize keys from CryptInit packet data.
     * @param xorKeyData 8 bytes from CryptInit body
     * @param enableEncryption whether encryption should be enabled
     */
    initKey(xorKeyData: Buffer, enableEncryption: boolean = true): void {
        const key = xorKeyData.subarray(0, 8);
        if (key.length < 8) {
            throw new Error(`initKey: expected at least 8 bytes for XOR key, got ${key.length}`);
        }

        this.isStandardCrypt = isCurrentProtocolHighFive();

        if (this.isStandardCrypt) {
            // Standard L2 Crypt: 16 bytes. First 8 from server, last 8 static
            const fullKey = Buffer.alloc(16);
            key.copy(fullKey, 0);
            
            const staticBytes = Buffer.from([0xc8, 0x27, 0x93, 0x01, 0xa1, 0x6c, 0x31, 0x97]);
            staticBytes.copy(fullKey, 8);

            this.key_sc = Buffer.from(fullKey);
            this.key_cs = Buffer.from(fullKey);
            Logger.info('GameCrypt', `XOR keys initialized (16-byte standard L2). Encryption enabled: ${enableEncryption}`);
        } else {
            // Mobius CT_0_Interlude custom Crypt: 8 bytes only
            this.key_sc = Buffer.alloc(8);
            this.key_cs = Buffer.alloc(8);
            key.copy(this.key_sc, 0);
            key.copy(this.key_cs, 0);
            Logger.info('GameCrypt', `XOR keys initialized (8-byte Mobius custom). Encryption enabled: ${enableEncryption}`);
        }

        this.enabled = enableEncryption;
        this.firstPacket = true;
        Logger.logKeys('GameCrypt key_cs', this.key_cs);
    }

    /**
     * Check if encryption is ready
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Decrypt incoming packet body.
     */
    decrypt(data: Buffer): Buffer {
        if (!this.enabled) {
            return data;
        }

        const result = Buffer.from(data);
        const size = result.length;

        Logger.hexDump('GAME DECRYPT INPUT', result, 16);

        if (this.isStandardCrypt) {
            let xOr = 0;
            for (let i = 0; i < size; i++) {
                const encrypted = result[i]! & 0xFF;
                result[i] = (encrypted ^ this.key_sc[i & 15]! ^ xOr) & 0xFF;
                xOr = encrypted;
            }

            // Shift key
            let old = this.key_sc[8]! & 0xFF;
            old |= (this.key_sc[9]! << 8) & 0xFF00;
            old |= (this.key_sc[10]! << 16) & 0xFF0000;
            old |= (this.key_sc[11]! << 24) & 0xFF000000;
            old += size;
            this.key_sc[8] = old & 0xFF;
            this.key_sc[9] = (old >> 8) & 0xFF;
            this.key_sc[10] = (old >> 16) & 0xFF;
            this.key_sc[11] = (old >> 24) & 0xFF;
        } else {
            for (let k = 0; k < size; k++) {
                result[k] = (result[k]! ^ this.key_sc[k & 7]!) & 0xFF;
            }
        }

        Logger.hexDump('GAME DECRYPT OUTPUT', result, 16);
        return result;
    }

    /**
     * Encrypt outgoing packet body.
     * First packet after CryptInit is NOT encrypted (only for CT_0_Interlude)!
     */
    encrypt(data: Buffer): Buffer {
        if (!this.enabled) {
            return data;
        }

        // First packet after CryptInit is UNENCRYPTED only for CT_0_Interlude!
        // For HighFive (protocol 267), first packet MUST be encrypted
        if (this.firstPacket && !this.isStandardCrypt) {
            Logger.info('GameCrypt', 'First packet - SKIPPING encryption (CT_0 only)');
            this.firstPacket = false;
            return data;
        }
        
        // Clear first packet flag for HighFive after encryption
        if (this.firstPacket) {
            this.firstPacket = false;
        }

        const result = Buffer.from(data);
        const size = result.length;

        Logger.hexDump('GAME ENCRYPT INPUT', result, 16);

        if (this.isStandardCrypt) {
            let encrypted = 0;
            for (let i = 0; i < size; i++) {
                const raw = result[i]! & 0xFF;
                encrypted = (raw ^ this.key_cs[i & 15]! ^ encrypted) & 0xFF;
                result[i] = encrypted;
            }

            // Shift key
            let old = this.key_cs[8]! & 0xFF;
            old |= (this.key_cs[9]! << 8) & 0xFF00;
            old |= (this.key_cs[10]! << 16) & 0xFF0000;
            old |= (this.key_cs[11]! << 24) & 0xFF000000;
            old += size;
            this.key_cs[8] = old & 0xFF;
            this.key_cs[9] = (old >> 8) & 0xFF;
            this.key_cs[10] = (old >> 16) & 0xFF;
            this.key_cs[11] = (old >> 24) & 0xFF;
        } else {
            for (let i = 0; i < size; i++) {
                result[i] = (result[i]! ^ this.key_cs[i & 7]!) & 0xFF;
            }
        }

        Logger.hexDump('GAME ENCRYPT OUTPUT', result, 16);
        return result;
    }
}
