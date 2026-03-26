export {
    Container,
    ContainerBuilder,
    DIError,
    DI_TOKENS,
} from './Container';
export type {
    Constructor,
    Factory,
    Registration,
    IContainer,
} from './Container';

// Composition Root - настройка DI контейнера
export { createContainer } from './composition';

// Application container singleton
export { getContainer, resetContainer } from './appContainer';
