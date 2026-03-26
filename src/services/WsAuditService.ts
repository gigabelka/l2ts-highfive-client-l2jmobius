/**
 * @fileoverview WsAuditService - сервис аудита доставки пакетов в WebSocket
 * @module services/WsAuditService
 *
 * Отслеживает потери пакетов между получением от Game Server и отправкой в WS.
 * Логирует статистику каждые 10 секунд.
 */

import { Logger } from '../logger/Logger';

/**
 * Информация о потерянном пакете
 */
export interface LostPacketInfo {
    opcode: number;
    opcodeHex: string;
    name: string;
    timestamp: number;
    reason: 'broadcast_error' | 'no_subscribers' | 'unknown';
}

/**
 * Статистика аудита
 */
export interface AuditStats {
    packetsReceived: number;
    packetsSentToWs: number;
    lost: number;
    queueSize: number;
    lostPackets: LostPacketInfo[];
    uptime: number;
}

/**
 * Singleton сервис для аудита доставки пакетов в WS
 */
export class WsAuditService {
    private static instance: WsAuditService | null = null;

    // Счётчики
    private _packetsReceived = 0;
    private _packetsSentToWs = 0;

    // Очередь (размер ring buffer в PacketBroadcastService)
    private _queueSize = 0;
    private readonly MAX_QUEUE_SIZE = 1000;

    // Хранилище потерянных пакетов (последние 50)
    private lostPackets: LostPacketInfo[] = [];
    private readonly MAX_LOST_STORED = 50;

    // Таймер для периодического логирования
    private auditTimer: NodeJS.Timeout | null = null;
    private startTime: number = Date.now();

    // Флаг включения аудита
    private enabled = false;

    private constructor() {}

    /**
     * Получить singleton instance
     */
    static getInstance(): WsAuditService {
        if (!WsAuditService.instance) {
            WsAuditService.instance = new WsAuditService();
        }
        return WsAuditService.instance;
    }

    /**
     * Сбросить instance (для тестов)
     */
    static resetInstance(): void {
        if (WsAuditService.instance) {
            WsAuditService.instance.stop();
            WsAuditService.instance = null;
        }
    }

    /**
     * Включить аудит и запустить таймер логирования
     */
    enable(): void {
        if (this.enabled) return;

        this.enabled = true;
        this.startTime = Date.now();
        this.startAuditTimer();

        Logger.info('WsAuditService', '🔍 WS Audit enabled - packet loss tracking active');
    }

    /**
     * Выключить аудит
     */
    disable(): void {
        if (!this.enabled) return;

        this.enabled = false;
        this.stop();

        Logger.info('WsAuditService', '🔍 WS Audit disabled');
    }

    /**
     * Инкрементировать счётчик полученных пакетов
     * Вызывать при получении КАЖДОГО пакета от Game Server
     */
    incrementReceived(): void {
        if (!this.enabled) return;
        this._packetsReceived++;
    }

    /**
     * Инкрементировать счётчик отправленных пакетов в WS
     * Вызывать при КАЖДОЙ успешной отправке пакета в WS
     */
    incrementSent(): void {
        if (!this.enabled) return;
        this._packetsSentToWs++;
    }

    /**
     * Зарегистрировать потерю пакета
     */
    reportLost(
        opcode: number,
        name: string,
        reason: LostPacketInfo['reason'] = 'unknown'
    ): void {
        if (!this.enabled) return;

        const lostInfo: LostPacketInfo = {
            opcode,
            opcodeHex: `0x${opcode.toString(16).padStart(2, '0').toUpperCase()}`,
            name,
            timestamp: Date.now(),
            reason,
        };

        // Добавляем в начало массива (новые первыми)
        this.lostPackets.unshift(lostInfo);

        // Ограничиваем размер
        if (this.lostPackets.length > this.MAX_LOST_STORED) {
            this.lostPackets.pop();
        }
    }

    /**
     * Обновить размер очереди
     */
    updateQueueSize(size: number): void {
        this._queueSize = Math.min(size, this.MAX_QUEUE_SIZE);
    }

    /**
     * Получить текущую статистику
     */
    getStats(): AuditStats {
        const lost = Math.max(0, this._packetsReceived - this._packetsSentToWs);
        return {
            packetsReceived: this._packetsReceived,
            packetsSentToWs: this._packetsSentToWs,
            lost,
            queueSize: this._queueSize,
            lostPackets: [...this.lostPackets],
            uptime: Date.now() - this.startTime,
        };
    }

    /**
     * Проверяет, включен ли аудит
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Запустить таймер аудита (каждые 10 секунд)
     */
    private startAuditTimer(): void {
        // Сразу делаем первый лог через небольшую задержку
        setTimeout(() => this.logAudit(), 5000);

        // Затем каждые 10 секунд
        this.auditTimer = setInterval(() => {
            this.logAudit();
        }, 10000);
    }

    /**
     * Остановить таймер аудита
     */
    private stop(): void {
        if (this.auditTimer) {
            clearInterval(this.auditTimer);
            this.auditTimer = null;
        }
    }

    /**
     * Логировать текущую статистику
     */
    private logAudit(): void {
        if (!this.enabled) return;

        const stats = this.getStats();
        const lost = stats.lost;
        const queueInfo = stats.queueSize > 0 ? `, Queue: ${stats.queueSize}` : '';

        if (lost > 0) {
            // WARNING если есть потери
            Logger.warn(
                'WS-AUDIT',
                `Received: ${stats.packetsReceived}, Sent to WS: ${stats.packetsSentToWs}, ` +
                `Lost: ${lost}${queueInfo}`
            );

            // Логируем последние потерянные пакеты (максимум 5 для краткости)
            const recentLost = this.lostPackets.slice(0, 5);
            for (const pkt of recentLost) {
                Logger.warn(
                    'WS-AUDIT',
                    `  └─ Lost packet: ${pkt.name} (${pkt.opcodeHex}), reason: ${pkt.reason}, ` +
                    `time: ${new Date(pkt.timestamp).toISOString()}`
                );
            }
            if (this.lostPackets.length > 5) {
                Logger.warn('WS-AUDIT', `  ... and ${this.lostPackets.length - 5} more lost packets`);
            }
        } else {
            // INFO при нормальной работе
            Logger.info(
                'WS-AUDIT',
                `Received: ${stats.packetsReceived}, Sent to WS: ${stats.packetsSentToWs}, ` +
                `Lost: 0${queueInfo}`
            );
        }
    }
}

/**
 * Глобальный singleton для удобного доступа
 */
export const wsAudit = WsAuditService.getInstance();
