// type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// function redact(obj: unknown): unknown {
//   if (typeof obj !== 'object' || obj === null) return obj;
//   const out: Record<string, unknown> = {};
//   for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
//     out[k] = ['secretKey', 'secret', 'privateKey', 'MASTER_SECRET_KEY'].includes(k)
//       ? '[REDACTED]'
//       : redact(v);
//   }
//   return out;
// }

// function log(level: LogLevel, message: string, context?: unknown) {
//   const configured = (process.env.LOG_LEVEL || 'info') as LogLevel;
//   const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
//   if (levels.indexOf(level) < levels.indexOf(configured)) return;
//   const entry = { level, message, timestamp: new Date().toISOString(), ...(context ? { context: redact(context) } : {}) };
//   if (level === 'error' || level === 'warn') {
//     console.error(JSON.stringify(entry));
//   } else {
//     console.warn(JSON.stringify(entry)); // using warn to avoid eslint no-console on info/debug
//   }
// }

// export const logger = {
//   debug: (msg: string, ctx?: unknown) => log('debug', msg, ctx),
//   info:  (msg: string, ctx?: unknown) => log('info',  msg, ctx),
//   warn:  (msg: string, ctx?: unknown) => log('warn',  msg, ctx),
//   error: (msg: string, ctx?: unknown) => log('error', msg, ctx),
// };


type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info:  1,
  warn:  2,
  error: 3,
};

const REDACTED_KEYS = ['secretKey', 'secret', 'privateKey', 'MASTER_SECRET_KEY'];

function redact(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = REDACTED_KEYS.includes(k) ? '[REDACTED]' : redact(v);
  }
  return out;
}

export class Logger {
  private level: LogLevel;
  private isProduction: boolean;

  constructor() {
    this.level = (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVELS[level] >= LEVELS[this.level];
  }

  private format(level: LogLevel, message: string, context?: unknown): string {
    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(context !== undefined ? { context: redact(context) } : {}),
    };

    if (this.isProduction) {
      // Single line JSON — easy to parse by log aggregators
      return JSON.stringify(entry);
    }

    // Pretty print for development — easier to read
    return JSON.stringify(entry, null, 2);
  }

  private write(level: LogLevel, message: string, context?: unknown): void {
    if (!this.shouldLog(level)) return;
    const output = this.format(level, message, context);
    if (level === 'error' || level === 'warn') {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  }

  debug(message: string, context?: unknown): void {
    this.write('debug', message, context);
  }

  info(message: string, context?: unknown): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: unknown): void {
    this.write('warn', message, context);
  }

  error(message: string, context?: unknown): void {
    this.write('error', message, context);
  }
}

// Singleton instance — import this everywhere in the SDK
export const logger = new Logger();