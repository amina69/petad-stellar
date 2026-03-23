type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function redact(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = ['secretKey', 'secret', 'privateKey', 'MASTER_SECRET_KEY'].includes(k)
      ? '[REDACTED]'
      : redact(v);
  }
  return out;
}

function log(level: LogLevel, message: string, context?: unknown) {
  const configured = (process.env.LOG_LEVEL || 'info') as LogLevel;
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  if (levels.indexOf(level) < levels.indexOf(configured)) return;
  const entry = { level, message, timestamp: new Date().toISOString(), ...(context ? { context: redact(context) } : {}) };
  if (level === 'error' || level === 'warn') {
    console.error(JSON.stringify(entry));
  } else {
    console.warn(JSON.stringify(entry)); // using warn to avoid eslint no-console on info/debug
  }
}

export const logger = {
  debug: (msg: string, ctx?: unknown) => log('debug', msg, ctx),
  info:  (msg: string, ctx?: unknown) => log('info',  msg, ctx),
  warn:  (msg: string, ctx?: unknown) => log('warn',  msg, ctx),
  error: (msg: string, ctx?: unknown) => log('error', msg, ctx),
};
