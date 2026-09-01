import { createRegistry } from '../registry';
import { Logger as LoggerInstance } from './logger';

// Define the type for the logger provider.  Currently supporting 'pino'.
type LoggerProvider = 'pino' | 'console';

// Use pino as the default logger provider
const LOGGER = (process.env.LOGGER ?? 'pino') as LoggerProvider;

// Create a registry for logger implementations
const loggerRegistry = createRegistry<LoggerInstance, LoggerProvider>();

// Register the 'pino' logger implementation
loggerRegistry.register('pino', async () => {
  const { Logger: PinoLogger } = await import('./impl/pino');

  return PinoLogger;
});

// Register the 'console' logger implementation
loggerRegistry.register('console', async () => {
  const { Logger: ConsoleLogger } = await import('./impl/console');

  return ConsoleLogger;
});

/**
 * @name getLogger
 * @description Retrieves the logger implementation based on the LOGGER environment variable using the registry API.
 * For server-side usage.
 */
export async function getLogger() {
  return loggerRegistry.get(LOGGER);
}

/**
 * React-specific logger exports for client-side usage.
 * Use these in React components and browser environments.
 */
export { logger as reactLogger, ReactLogger } from './react-logger';
export type { LogEntry, LogLevel } from './react-logger';
export { useLogger, LoggerProvider } from './use-logger';
export type { LoggerProviderProps } from './use-logger';
