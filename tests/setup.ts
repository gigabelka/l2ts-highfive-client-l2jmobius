import { beforeAll, afterAll } from 'vitest';
import { MockL2Server } from './utils/mockServer';
import { getContainer, resetContainer } from '../src/config/di/appContainer';
import { initGameCommandManager, resetGameCommandManager } from '../src/game/GameCommandManager';
import { DI_TOKENS } from '../src/config/di/Container';
import type { ICharacterRepository, IWorldRepository } from '../src/domain/repositories';
import type { IEventBus } from '../src/application/ports';
import { TEST_CONFIG } from './config';

/**
 * Global test setup
 * Runs once before all tests
 */
beforeAll(async () => {
    // Reset container for clean state
    resetContainer();
    
    // Get container and reset repositories
    const container = getContainer();
    const charRepo = container.resolve('CharacterRepository');
    const worldRepo = container.resolve('WorldRepository');
    const invRepo = container.resolve('InventoryRepository');
    const eventBus = container.resolve('EventBus');
    
    if (charRepo.isOk()) charRepo.getOrThrow().reset();
    if (worldRepo.isOk()) worldRepo.getOrThrow().reset();
    if (invRepo.isOk()) invRepo.getOrThrow().reset();
    
    // Initialize GameCommandManager with dependencies for tests
    if (charRepo.isOk() && worldRepo.isOk() && eventBus.isOk()) {
        initGameCommandManager({
            characterRepo: charRepo.getOrThrow(),
            worldRepo: worldRepo.getOrThrow(),
            eventBus: eventBus.getOrThrow(),
        });
    }

    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.API_KEY = TEST_CONFIG.api.apiKey;
    process.env.LOG_LEVEL = 'SILENT';

    console.log('Test environment initialized');
});

/**
 * Global test teardown
 * Runs once after all tests
 */
afterAll(async () => {
    // Final cleanup
    const container = getContainer();
    const charRepo = container.resolve('CharacterRepository');
    const worldRepo = container.resolve('WorldRepository');
    const invRepo = container.resolve('InventoryRepository');
    
    if (charRepo.isOk()) charRepo.getOrThrow().reset();
    if (worldRepo.isOk()) worldRepo.getOrThrow().reset();
    if (invRepo.isOk()) invRepo.getOrThrow().reset();
    
    resetGameCommandManager();

    console.log('Test environment cleaned up');
});

/**
 * Test context for sharing mock server across tests
 */
export interface TestContext {
    mockServer: MockL2Server;
}

/**
 * Setup helper for packet tests
 */
export function setupPacketTest() {
    let mockServer: MockL2Server;

    beforeEach(async () => {
        // Reset state before each test
        const container = getContainer();
        const charRepo = container.resolve('CharacterRepository');
        const worldRepo = container.resolve('WorldRepository');
        const invRepo = container.resolve('InventoryRepository');
        
        if (charRepo.isOk()) charRepo.getOrThrow().reset();
        if (worldRepo.isOk()) worldRepo.getOrThrow().reset();
        if (invRepo.isOk()) invRepo.getOrThrow().reset();
        
        // Create and start mock server
        mockServer = new MockL2Server();
        await mockServer.start();
    });

    afterEach(async () => {
        // Stop mock server after each test
        await mockServer.stop();
        
        // Clean up state
        const container = getContainer();
        const charRepo = container.resolve('CharacterRepository');
        const worldRepo = container.resolve('WorldRepository');
        const invRepo = container.resolve('InventoryRepository');
        
        if (charRepo.isOk()) charRepo.getOrThrow().reset();
        if (worldRepo.isOk()) worldRepo.getOrThrow().reset();
        if (invRepo.isOk()) invRepo.getOrThrow().reset();
    });

    return {
        getMockServer: () => mockServer
    };
}

/**
 * Setup helper for API tests
 */
export function setupApiTest() {
    let mockServer: MockL2Server;

    beforeEach(async () => {
        // Reset state before each test
        const container = getContainer();
        const charRepo = container.resolve('CharacterRepository');
        const worldRepo = container.resolve('WorldRepository');
        const invRepo = container.resolve('InventoryRepository');
        
        if (charRepo.isOk()) charRepo.getOrThrow().reset();
        if (worldRepo.isOk()) worldRepo.getOrThrow().reset();
        if (invRepo.isOk()) invRepo.getOrThrow().reset();
        
        // Create and start mock server
        mockServer = new MockL2Server();
        await mockServer.start();
    });

    afterEach(async () => {
        // Stop mock server after each test
        await mockServer.stop();
        
        // Clean up state
        const container = getContainer();
        const charRepo = container.resolve('CharacterRepository');
        const worldRepo = container.resolve('WorldRepository');
        const invRepo = container.resolve('InventoryRepository');
        
        if (charRepo.isOk()) charRepo.getOrThrow().reset();
        if (worldRepo.isOk()) worldRepo.getOrThrow().reset();
        if (invRepo.isOk()) invRepo.getOrThrow().reset();
    });

    return {
        getMockServer: () => mockServer
    };
}

// Vitest-style helper types
type TestFn = () => void | Promise<void>;

// Global test utilities
declare global {
    // eslint-disable-next-line no-var
    var testContext: TestContext | undefined;
}

// Helper to wait for a specific event using new EventBus
export function waitForEvent<T>(
    eventType: string, 
    timeout: number = TEST_CONFIG.timeouts.response
): Promise<T> {
    return new Promise((resolve, reject) => {
        const container = getContainer();
        const eventBusResult = container.resolve('EventBus');
        
        if (eventBusResult.isErr()) {
            reject(new Error('EventBus not available'));
            return;
        }
        
        const eventBus = eventBusResult.getOrThrow();

        const timer = setTimeout(() => {
            unsubscribe();
            reject(new Error(`Timeout waiting for event: ${eventType}`));
        }, timeout);

        const unsubscribe = eventBus.subscribe(eventType, (event: T) => {
            clearTimeout(timer);
            unsubscribe();
            resolve(event);
        });
    });
}

// Helper to wait for a condition
export async function waitForCondition(
    condition: () => boolean,
    timeout: number = TEST_CONFIG.timeouts.response,
    interval: number = 50
): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        if (condition()) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error('Timeout waiting for condition');
}
