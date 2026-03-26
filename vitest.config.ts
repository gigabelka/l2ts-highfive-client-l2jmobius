import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
        setupFiles: ['./tests/setup.ts'],
        coverage: {
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'tests/',
                'dist/',
                '**/*.config.ts'
            ]
        },
        testTimeout: 30000,
        hookTimeout: 30000,
        teardownTimeout: 30000
    },
    resolve: {
        alias: {
            '@': './src'
        }
    }
});
