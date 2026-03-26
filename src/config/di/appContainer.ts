import { createContainer } from './index';
import type { Container } from './Container';

// Singleton DI container for the application
let _container: Container | null = null;

export function getContainer(): Container {
    if (!_container) {
        _container = createContainer();
    }
    return _container;
}

export function resetContainer(): void {
    _container = null;
}
