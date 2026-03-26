type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT';

const LEVELS: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    SILENT: 4,
};

class LoggerLevel {
    private static _level: LogLevel = 'DEBUG';

    static get level(): LogLevel {
        return this._level;
    }

    static set level(value: LogLevel) {
        this._level = value;
    }
}

function formatTimestamp(): string {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm_ = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mm_}:${ss}.${ms}`;
}

function log(level: LogLevel, tag: string, message: string): void {
    if (LEVELS[level] < LEVELS[LoggerLevel.level]) {
        return;
    }

    const timestamp = formatTimestamp();
    const line = `[${timestamp}] [${level}] [${tag}] ${message}`;

    switch (level) {
        case 'ERROR':
            console.error(line);
            break;
        case 'WARN':
            console.warn(line);
            break;
        default:
            console.log(line);
            break;
    }
}

function formatHexDump(buf: Buffer, label: string, maxBytes: number): void {
    const displayBuf = buf.slice(0, Math.min(buf.length, maxBytes));
    const truncated = buf.length > maxBytes;

    console.log(`[HEXDUMP: ${label}]`);

    for (let i = 0; i < displayBuf.length; i += 16) {
        const chunk = displayBuf.slice(i, i + 16);
        const offset = String(i).padStart(4, '0');

        let hexParts: string[] = [];
        for (let j = 0; j < chunk.length; j++) {
            hexParts.push(chunk[j]!.toString(16).padStart(2, '0').toUpperCase());
        }

        const group1 = hexParts.slice(0, 8);
        const group2 = hexParts.slice(8);
        let hexLine = `${group1.join(' ')}  ${group2.join(' ')}`;

        if (chunk.length < 16) {
            const padding = 16 - chunk.length;
            hexLine += '   '.repeat(padding);
        }

        let ascii = '';
        for (let j = 0; j < 16; j++) {
            if (j < chunk.length) {
                const byte = chunk[j]!;
                ascii += byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
            } else {
                ascii += ' ';
            }
        }

        console.log(`${offset}: ${hexLine} |${ascii}|`);
    }

    if (truncated) {
        console.log(`... (truncated)`);
    }
}

function formatHexBytes(buf: Buffer): string {
    const hexArray: number[] = [];
    for (let i = 0; i < buf.length; i++) {
        hexArray.push(buf[i]!);
    }
    return hexArray.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

export const Logger = {
    get level(): LogLevel {
        return LoggerLevel.level;
    },

    set level(value: LogLevel) {
        LoggerLevel.level = value;
    },

    debug: (tag: string, message: string): void => log('DEBUG', tag, message),
    info:  (tag: string, message: string): void => log('INFO', tag, message),
    warn:  (tag: string, message: string): void => log('WARN', tag, message),
    error: (tag: string, message: string): void => log('ERROR', tag, message),

    hexDump: (label: string, buf: Buffer, maxBytes?: number): void => {
        if (LEVELS['DEBUG'] < LEVELS[LoggerLevel.level]) return;
        const max = maxBytes ?? 256;
        formatHexDump(buf, label, max);
    },

    logPacket: (direction: 'RECV' | 'SEND', opcode: number, raw: Buffer): void => {
        if (LEVELS['DEBUG'] < LEVELS[LoggerLevel.level]) return;
        console.log(`[${direction}] OpCode=0x${opcode.toString(16).toUpperCase()}  Size=${raw.length} bytes`);
    },

    logKeys: (label: string, key: Buffer): void => {
        if (LEVELS['DEBUG'] < LEVELS[LoggerLevel.level]) return;
        const hex = formatHexBytes(key);
        console.log(`[KEYS] ${label}: ${hex}`);
    },

    logCrypto: (op: string, before: Buffer, after: Buffer): void => {
        if (LEVELS['DEBUG'] < LEVELS[LoggerLevel.level]) return;
        const max = 16;
        const beforeDump = before.slice(0, Math.min(before.length, max));
        const afterDump = after.slice(0, Math.min(after.length, max));

        console.log(`[CRYPTO] ${op} BEFORE: ${formatHexBytes(beforeDump)}${before.length > max ? ' ...' : ''}`);
        console.log(`[CRYPTO] ${op} AFTER:  ${formatHexBytes(afterDump)}${after.length > max ? ' ...' : ''}`);
    },

    logCryptoSingle: (op: string, data: Buffer, maxBytes?: number): void => {
        if (LEVELS['DEBUG'] < LEVELS[LoggerLevel.level]) return;
        const max = maxBytes !== undefined ? maxBytes : 16;
        const dump = data.slice(0, Math.min(data.length, max));

        console.log(`[CRYPTO] ${op}: ${formatHexBytes(dump)}${data.length > max ? ' ...' : ''}`);
    },

    logState: (from: string, to: string): void => {
        if (LEVELS['DEBUG'] < LEVELS[LoggerLevel.level]) return;
        console.log(`[STATE] ${from} -> ${to}`);
    },
};
