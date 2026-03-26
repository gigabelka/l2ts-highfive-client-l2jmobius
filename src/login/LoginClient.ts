/**
 * @fileoverview LoginClientNew - Рефакторинг с новой архитектурой
 * Использует Clean Architecture: EventBus, LoginPacketProcessor
 * @module login/LoginClientNew
 */

import Connection from '../network/Connection';
import { Logger } from '../logger/Logger';
import { LoginCrypt } from './LoginCrypt';
import { LoginState, type SessionData, type LoginConfig } from './types';
import { ScrambledRSAKey } from '../crypto/ScrambledRSAKey';
import { RequestGGAuth } from './packets/outgoing/RequestGGAuth';
import { RequestAuthLogin } from './packets/outgoing/RequestAuthLogin';
import { RequestServerList } from './packets/outgoing/RequestServerList';
import { RequestServerLogin } from './packets/outgoing/RequestServerLogin';
import type { OutgoingLoginPacket } from './packets/outgoing/OutgoingLoginPacket';

// New Architecture imports
import type { IEventBus } from '../application/ports';
import { LoginPacketProcessor } from './protocol/LoginPacketProcessor';
import { configureLoginPacketFactory, configureLoginPacketProcessor } from './protocol/LoginPacketRegistry';
import { LoginIncomingPacketFactory } from './protocol/LoginIncomingPacketFactory';
import { SessionManager } from './session/SessionManager';
import { IConnectionRepository, ConnectionPhase, ConnectionPhaseChangedEvent } from '../domain';

/**
 * Dependencies for LoginClient
 */
export interface LoginClientDependencies {
    eventBus: IEventBus;
    connectionRepo: IConnectionRepository;
}

/**
 * Login Server client with Clean Architecture
 */
export class LoginClientNew extends Connection {
    private state: LoginState = LoginState.IDLE;
    private crypt: LoginCrypt = new LoginCrypt();
    private session: Partial<SessionData> = {};
    private packetProcessor: LoginPacketProcessor;
    private deps: LoginClientDependencies;

    constructor(
        private config: LoginConfig,
        private onComplete: (session: SessionData) => void,
        deps: LoginClientDependencies
    ) {
        super();
        this.deps = deps;
        
        // Initialize packet processor
        const sessionManager = SessionManager.getInstance();
        const packetFactory = configureLoginPacketFactory(new LoginIncomingPacketFactory());
        this.packetProcessor = new LoginPacketProcessor(packetFactory, sessionManager);
        configureLoginPacketProcessor(this.packetProcessor, sessionManager);
    }

    start(): void {
        Logger.logState(this.state, LoginState.CONNECTING);
        this.state = LoginState.CONNECTING;
        this.deps.connectionRepo.setPhase(ConnectionPhase.LOGIN_CONNECTING);
        this.deps.eventBus.publish(new ConnectionPhaseChangedEvent({ phase: ConnectionPhase.LOGIN_CONNECTING }));
        this.deps.connectionRepo.update({ host: this.config.LoginIp, port: this.config.LoginPort });
        this.connect(this.config.LoginIp, this.config.LoginPort);
    }

    protected override handleConnect(): void {
        Logger.info('LoginClient', 'Connected to Login Server');
        Logger.logState(this.state, LoginState.WAIT_INIT);
        this.state = LoginState.WAIT_INIT;
        this.deps.connectionRepo.setPhase(ConnectionPhase.LOGIN_AUTHENTICATING);
        this.deps.eventBus.publish(new ConnectionPhaseChangedEvent({ phase: ConnectionPhase.LOGIN_AUTHENTICATING }));
    }

    protected override handleDisconnect(): void {
        Logger.info('LoginClient', 'Login Server connection closed');
        if (this.state !== LoginState.DONE) {
            this.deps.connectionRepo.setPhase(ConnectionPhase.DISCONNECTED);
        this.deps.eventBus.publish(new ConnectionPhaseChangedEvent({ phase: ConnectionPhase.DISCONNECTED }));
        }
    }

    protected override handleError(err: Error): void {
        Logger.error('LoginClient', `Error: ${err.message}`);
        this.state = LoginState.ERROR;
        this.deps.connectionRepo.setPhase(ConnectionPhase.ERROR);
        this.deps.connectionRepo.update({ error: err.message });
        this.publishErrorEvent(err.message);
    }

    protected override handleRawPacket(fullPacket: Buffer): void {
        const body = fullPacket.subarray(2);

        let decrypted: Buffer;

        if (this.state === LoginState.WAIT_INIT) {
            decrypted = this.crypt.decryptInit(body);
        } else {
            decrypted = this.crypt.decrypt(body);
        }

        const opcode = decrypted[0];

        Logger.logPacket('RECV', opcode!, fullPacket);
        Logger.hexDump('RECV DECRYPTED', decrypted);

        // Publish raw packet event
        this.publishRawPacketEvent(opcode!, decrypted.length);

        // Process packet
        const result = this.packetProcessor.process(opcode!, decrypted, this.state);

        if (result.success && result.packet) {
            this.handlePacket(result.packet, opcode!);
        } else {
            Logger.warn('LoginClient', `Failed to process packet opcode=0x${opcode!.toString(16)}: ${result.error}`);
        }
    }

    private handlePacket(packet: unknown, opcode: number): void {
        switch (this.state) {
            case LoginState.WAIT_INIT: {
                if (opcode === 0x01) {
                    // LoginFail
                    const pkt = packet as { reason: number };
                    Logger.error('LoginClient', `Init error: ${this.getLoginFailReason(pkt.reason)}`);
                    this.state = LoginState.ERROR;
                    this.deps.connectionRepo.setPhase(ConnectionPhase.ERROR, { error: this.getLoginFailReason(pkt.reason) });
                    this.deps.eventBus.publish(new ConnectionPhaseChangedEvent({ phase: ConnectionPhase.ERROR }));
                    this.disconnect();
                    return;
                }
                if (opcode !== 0x00) {
                    Logger.warn('LoginClient', `Expected Init(0x00), got 0x${opcode.toString(16)}`);
                    return;
                }

                const pkt = packet as { sessionId: number; scrambledRsaKey: Buffer; blowfishKey: Buffer };
                this.session.sessionId = pkt.sessionId;
                this.session.rsaPublicKey = ScrambledRSAKey.unscramble(pkt.scrambledRsaKey);
                this.crypt.setSessionKey(pkt.blowfishKey);

                Logger.logState(this.state, LoginState.WAIT_GG_AUTH);
                this.state = LoginState.WAIT_GG_AUTH;
                this.sendPacket(new RequestGGAuth(this.session.sessionId));
                break;
            }

            case LoginState.WAIT_GG_AUTH: {
                if (opcode !== 0x0B) {
                    Logger.debug('LoginClient', `WAIT_GG_AUTH: ignoring 0x${opcode.toString(16)}`);
                    return;
                }

                const pkt = packet as { ggAuthResponse: number };
                this.session.ggAuthResponse = pkt.ggAuthResponse;

                Logger.logState(this.state, LoginState.WAIT_LOGIN_OK);
                this.state = LoginState.WAIT_LOGIN_OK;
                this.sendPacket(new RequestAuthLogin(
                    this.config.Username,
                    this.config.Password,
                    this.session.rsaPublicKey!,
                    this.session.ggAuthResponse,
                ));
                break;
            }

            case LoginState.WAIT_LOGIN_OK: {
                if (opcode === 0x03) {
                    const pkt = packet as { loginOkId1: number; loginOkId2: number };
                    this.session.loginOkId1 = pkt.loginOkId1;
                    this.session.loginOkId2 = pkt.loginOkId2;

                    Logger.logState(this.state, LoginState.WAIT_SERVER_LIST);
                    this.state = LoginState.WAIT_SERVER_LIST;
                    this.deps.connectionRepo.setPhase(ConnectionPhase.WAITING_SERVER_SELECT);
                    this.deps.eventBus.publish(new ConnectionPhaseChangedEvent({ phase: ConnectionPhase.WAITING_SERVER_SELECT }));
                    this.sendPacket(new RequestServerList(
                        this.session.loginOkId1,
                        this.session.loginOkId2,
                    ));
                } else if (opcode === 0x01) {
                    const pkt = packet as { reason: number };
                    Logger.error('LoginClient', `Auth failed: ${this.getLoginFailReason(pkt.reason)}`);
                    this.state = LoginState.ERROR;
                    this.deps.connectionRepo.setPhase(ConnectionPhase.ERROR, { error: this.getLoginFailReason(pkt.reason) });
                    this.deps.eventBus.publish(new ConnectionPhaseChangedEvent({ phase: ConnectionPhase.ERROR }));
                    this.disconnect();
                } else {
                    Logger.debug('LoginClient', `WAIT_LOGIN_OK: ignoring 0x${opcode.toString(16)}`);
                }
                break;
            }

            case LoginState.WAIT_SERVER_LIST: {
                if (opcode !== 0x04) {
                    Logger.debug('LoginClient', `WAIT_SERVER_LIST: ignoring 0x${opcode.toString(16)}`);
                    return;
                }

                const pkt = packet as { servers: Array<{ serverId: number; ip: string; port: number }> };
                const server = pkt.servers.find(s => s.serverId === this.config.ServerId);

                if (!server) {
                    Logger.error('LoginClient', `Server ID=${this.config.ServerId} not found in list`);
                    this.state = LoginState.ERROR;
                    this.deps.connectionRepo.setPhase(ConnectionPhase.ERROR, { error: `Server ID=${this.config.ServerId} not found` });
                    this.deps.eventBus.publish(new ConnectionPhaseChangedEvent({ phase: ConnectionPhase.ERROR }));
                    this.disconnect();
                    return;
                }

                this.session.gameServerIp = server.ip;
                this.session.gameServerPort = server.port;
                Logger.info('LoginClient', `Selected server: ID=${server.serverId} IP=${server.ip}:${server.port}`);

                Logger.logState(this.state, LoginState.WAIT_PLAY_OK);
                this.state = LoginState.WAIT_PLAY_OK;
                this.sendPacket(new RequestServerLogin(
                    this.session.loginOkId1!,
                    this.session.loginOkId2!,
                    this.config.ServerId,
                ));
                break;
            }

            case LoginState.WAIT_PLAY_OK: {
                if (opcode === 0x07) {
                    const pkt = packet as { playOkId1: number; playOkId2: number };
                    this.session.playOkId1 = pkt.playOkId1;
                    this.session.playOkId2 = pkt.playOkId2;

                    Logger.info('LoginClient', 'PlayOk received, Login Server auth complete');
                    this.disconnect();
                    this.state = LoginState.DONE;
                    this.session.username = this.config.Username;
                    this.onComplete(this.session as SessionData);
                } else if (opcode === 0x06) {
                    const pkt = packet as { reason: number };
                    Logger.error('LoginClient', `PlayFail: ${this.getPlayFailReason(pkt.reason)}`);
                    this.state = LoginState.ERROR;
                    this.deps.connectionRepo.setPhase(ConnectionPhase.ERROR, { error: this.getPlayFailReason(pkt.reason) });
                    this.deps.eventBus.publish(new ConnectionPhaseChangedEvent({ phase: ConnectionPhase.ERROR }));
                } else {
                    Logger.debug('LoginClient', `WAIT_PLAY_OK: ignoring 0x${opcode.toString(16)}`);
                }
                break;
            }

            default:
                Logger.warn('LoginClient', `Packet in state ${this.state}, opcode=0x${opcode.toString(16)}`);
        }
    }

    private sendPacket(packet: OutgoingLoginPacket): void {
        const body = packet.encode();
        Logger.logPacket('SEND', body[0]!, body);

        const encrypted = this.crypt.prepareOutgoing(body);
        const len = encrypted.length + 2;
        const out = Buffer.allocUnsafe(len);
        out.writeUInt16LE(len, 0);
        encrypted.copy(out, 2);
        Logger.hexDump('SEND FINAL (with length)', out);
        this.sendRaw(out);
    }

    // ============================================================================
    // Helpers
    // ============================================================================

    private getLoginFailReason(reason: number): string {
        const reasons: Record<number, string> = {
            0x01: 'System error',
            0x02: 'Invalid password',
            0x03: 'Account banned',
            0x04: 'Account already in use',
            0x05: 'Server maintenance',
            0x06: 'Account expired',
            0x07: 'Account restricted',
        };
        return reasons[reason] || `Unknown reason: ${reason}`;
    }

    private getPlayFailReason(reason: number): string {
        const reasons: Record<number, string> = {
            0x01: 'Server is full',
            0x02: 'Server is down',
            0x03: 'Invalid server ID',
            0x04: 'Access denied',
        };
        return reasons[reason] || `Unknown reason: ${reason}`;
    }

    // ============================================================================
    // Event Publishing
    // ============================================================================

    private publishRawPacketEvent(opcode: number, length: number): void {
        this.deps.eventBus.publish({
            type: 'system.raw_packet',
            channel: 'system',
            payload: {
                opcode,
                opcodeHex: `0x${opcode.toString(16).padStart(2, '0')}`,
                length,
                state: `LOGIN_${this.state}`,
                source: 'login_server',
            },
            timestamp: new Date(),
        });
    }

    private publishErrorEvent(message: string): void {
        this.deps.eventBus.publish({
            type: 'system.error',
            channel: 'system',
            payload: {
                code: 'LOGIN_CONNECTION_ERROR',
                message,
            },
            timestamp: new Date(),
        });
    }
}
