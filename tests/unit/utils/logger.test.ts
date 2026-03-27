import { Logger } from '../../../src/utils/logger';

describe('Logger', () => {

  it('redacts secretKey from context object', () => {
    const log = new Logger();
    const output: string[] = [];

    // Capture stdout
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string) => {
      output.push(chunk);
      return true;
    };

    log.info('test message', { secretKey: 'SXXXXX', userId: 'user-1' });

    // Restore stdout
    process.stdout.write = original;

    const parsed = JSON.parse(output[0]);
    expect(parsed.context.secretKey).toBe('[REDACTED]');
    expect(parsed.context.userId).toBe('user-1');
  });

  it('redacts secret and privateKey fields too', () => {
    const log = new Logger();
    const output: string[] = [];

    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string) => { output.push(chunk); return true; };

    log.info('test', { secret: 'abc', privateKey: 'xyz', name: 'petad' });

    process.stdout.write = original;

    const parsed = JSON.parse(output[0]);
    expect(parsed.context.secret).toBe('[REDACTED]');
    expect(parsed.context.privateKey).toBe('[REDACTED]');
    expect(parsed.context.name).toBe('petad');
  });

  it('does not log debug messages when level is info', () => {
    process.env.LOG_LEVEL = 'info';
    const log = new Logger();
    const output: string[] = [];

    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string) => { output.push(chunk); return true; };

    log.debug('this should not appear');

    process.stdout.write = original;

    expect(output).toHaveLength(0);
  });

  it('logs debug messages when level is debug', () => {
    process.env.LOG_LEVEL = 'debug';
    const log = new Logger();
    const output: string[] = [];

    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string) => { output.push(chunk); return true; };

    log.debug('this should appear');

    process.stdout.write = original;

    expect(output).toHaveLength(1);
    const parsed = JSON.parse(output[0]);
    expect(parsed.level).toBe('debug');

    // Clean up
    delete process.env.LOG_LEVEL;
  });

  it('outputs valid JSON for every log level', () => {
    

    const outputs: string[] = [];
    const stdoutOriginal = process.stdout.write.bind(process.stdout);
    const stderrOriginal = process.stderr.write.bind(process.stderr);
    process.stdout.write = (chunk: string) => { outputs.push(chunk); return true; };
    process.stderr.write = (chunk: string) => { outputs.push(chunk); return true; };

    process.env.LOG_LEVEL = 'debug';
    const log2 = new Logger();
    log2.debug('debug msg');
    log2.info('info msg');
    log2.warn('warn msg');
    log2.error('error msg');

    process.stdout.write = stdoutOriginal;
    process.stderr.write = stderrOriginal;
    delete process.env.LOG_LEVEL;

    outputs.forEach(o => {
      expect(() => JSON.parse(o)).not.toThrow();
    });
  });

});