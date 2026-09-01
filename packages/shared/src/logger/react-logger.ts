/**
 * React Logger
 *
 * Provides production-safe logging for React applications.
 * Only logs in development mode to prevent data exposure and reduce bundle size.
 *
 * Note: This logger is for client-side React usage. For server-side logging,
 * use the getLogger() function from '@kit/shared/logger' instead.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerContext {
  level: LogLevel;
  logs: LogEntry[];
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: unknown;
}

/** Maximum number of log entries to keep in memory */
const MAX_LOG_ENTRIES = 500;

/** Sentry window interface for type-safe access */
interface SentryWindow extends Window {
  Sentry?: {
    captureException?: (error: unknown, options?: object) => void;
    captureMessage?: (message: string, options?: object) => void;
  };
}

class ReactLogger {
  private static instance: ReactLogger;
  private isDev: boolean;
  private context: LoggerContext = {
    level: 'info',
    logs: [],
  };

  private constructor() {
    this.isDev = process.env.NODE_ENV === 'development';
  }

  static getInstance(): ReactLogger {
    if (!ReactLogger.instance) {
      ReactLogger.instance = new ReactLogger();
    }
    return ReactLogger.instance;
  }

  /**
   * Log debug message (development only)
   */
  debug(message: string, data?: unknown): void {
    if (!this.isDev) return;

    this.log('debug', message, data);
  }

  /**
   * Log info message (development only)
   */
  info(message: string, data?: unknown): void {
    if (!this.isDev) return;

    this.log('info', message, data);
  }

  /**
   * Log warning message (development only)
   */
  warn(message: string, data?: unknown): void {
    if (!this.isDev) return;

    this.log('warn', message, data);
  }

  /**
   * Log error message (always logged)
   */
  error(message: string, error?: unknown): void {
    this.log('error', message, error);

    // Track errors in production via Sentry (if available)
    if (!this.isDev && typeof window !== 'undefined') {
      this.trackError(message, error);
    }
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      data,
    };

    // Add entry and enforce memory limit
    this.context.logs.push(entry);
    if (this.context.logs.length > MAX_LOG_ENTRIES) {
      // Remove oldest entries when exceeding limit
      this.context.logs = this.context.logs.slice(-MAX_LOG_ENTRIES);
    }

    if (this.isDev || level === 'error') {
      const prefix = `[${level.toUpperCase()}] ${entry.timestamp.toISOString()} - `;

      switch (level) {
        case 'debug':
          console.debug(prefix, message, data);
          break;
        case 'info':
          console.info(prefix, message, data);
          break;
        case 'warn':
          console.warn(prefix, message, data);
          break;
        case 'error':
          console.error(prefix, message, data);
          break;
      }
    }
  }

  /**
   * Track error via Sentry if available
   * Uses defensive checks to handle Sentry not being loaded
   */
  private trackError(message: string, error?: unknown): void {
    // Early return if not in browser
    if (typeof window === 'undefined') return;

    try {
      const sentryWindow = window as SentryWindow;

      // Check if Sentry is available and has captureException
      if (sentryWindow.Sentry?.captureException) {
        sentryWindow.Sentry.captureException(error ?? new Error(message), {
          contexts: {
            custom: { message },
          },
        });
      }
    } catch {
      // Silently ignore errors when tracking fails
      // Don't let error tracking cause additional errors
    }
  }

  /**
   * Get all logged entries
   */
  getLogs(): LogEntry[] {
    return [...this.context.logs];
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.context.logs = [];
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.context.logs.filter((log) => log.level === level);
  }
}

export const logger = ReactLogger.getInstance();

export { ReactLogger };
export type { LogEntry, LogLevel };
