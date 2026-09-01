'use client';

/**
 * useLogger Hook
 *
 * Provides logger instance to React components.
 * Allows component-specific logging context.
 */
import { ReactNode, createContext, useContext } from 'react';

import { ReactLogger, logger } from './react-logger';

const LoggerContext = createContext<ReactLogger | null>(null);

export interface LoggerProviderProps {
  children: ReactNode;
}

export function LoggerProvider({ children }: LoggerProviderProps) {
  const loggerInstance = logger;

  return (
    <LoggerContext.Provider value={loggerInstance}>
      {children}
    </LoggerContext.Provider>
  );
}

export function useLogger() {
  const loggerInstance = useContext(LoggerContext);

  if (!loggerInstance) {
    throw new Error('useLogger must be used within LoggerProvider');
  }

  return loggerInstance;
}
