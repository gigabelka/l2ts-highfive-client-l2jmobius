import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryConnectionRepository } from '../../../src/infrastructure/persistence/InMemoryConnectionRepository';
import { ConnectionPhase } from '../../../src/domain/repositories/IConnectionRepository';

describe('InMemoryConnectionRepository', () => {
    let repo: InMemoryConnectionRepository;

    beforeEach(() => {
        repo = new InMemoryConnectionRepository();
    });

    it('should have DISCONNECTED as initial phase', () => {
        const state = repo.get();
        expect(state.phase).toBe(ConnectionPhase.DISCONNECTED);
        expect(state.host).toBe('');
        expect(state.port).toBe(0);
    });

    it('should update phase correctly', () => {
        repo.setPhase(ConnectionPhase.LOGIN_CONNECTING);
        expect(repo.get().phase).toBe(ConnectionPhase.LOGIN_CONNECTING);

        repo.setPhase(ConnectionPhase.LOGIN_AUTHENTICATING);
        expect(repo.get().phase).toBe(ConnectionPhase.LOGIN_AUTHENTICATING);
    });

    it('should update host and port', () => {
        repo.update({ host: '127.0.0.1', port: 2106 });
        const state = repo.get();
        expect(state.host).toBe('127.0.0.1');
        expect(state.port).toBe(2106);
    });

    it('should include error message when provided', () => {
        repo.setPhase(ConnectionPhase.ERROR, { error: 'Test error' });
        const state = repo.get();
        expect(state.phase).toBe(ConnectionPhase.ERROR);
        expect(state.error).toBe('Test error');
    });

    it('should reset state correctly', () => {
        repo.update({ host: '127.0.0.1', port: 2106 });
        repo.setPhase(ConnectionPhase.IN_GAME);
        
        repo.reset();
        const state = repo.get();
        expect(state.phase).toBe(ConnectionPhase.DISCONNECTED);
        expect(state.host).toBe('');
    });

    it('should update uptime', async () => {
        repo.setPhase(ConnectionPhase.LOGIN_CONNECTING);
        const initialUptime = repo.get().uptime;
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const laterUptime = repo.get().uptime;
        expect(laterUptime).toBeGreaterThan(initialUptime);
    });
});
