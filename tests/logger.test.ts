import { Logger, formatLogEntry, type LogEntry, type LogSink } from '@/utils/logger';
import { ConsoleLogSink } from '@/utils/console-log-sink';
import { CompositeLogSink } from '@/utils/composite-log-sink';

class RecordingSink implements LogSink {
  entries: LogEntry[] = [];
  write(entry: LogEntry): void {
    this.entries.push(entry);
  }
}

const fixedNow = (): Date => new Date('2026-05-08T12:00:00Z');

describe('Logger — level filter', () => {
  it('emits at the active level and below', () => {
    const sink = new RecordingSink();
    const log = new Logger('info', sink, {}, { now: fixedNow });
    log.error('e');
    log.warn('w');
    log.info('i');
    log.debug('d');
    expect(sink.entries.map((e) => e.level)).toEqual(['error', 'warn', 'info']);
  });

  it('respects setLevel', () => {
    const sink = new RecordingSink();
    const log = new Logger('error', sink, {}, { now: fixedNow });
    log.warn('a'); // dropped
    log.setLevel('debug');
    log.warn('b');
    log.debug('c');
    expect(sink.entries.map((e) => e.message)).toEqual(['b', 'c']);
  });

  it('preserves message + args + context', () => {
    const sink = new RecordingSink();
    const log = new Logger('debug', sink, { component: 'engine' }, { now: fixedNow });
    log.info('connected', { server: 'Local' }, 42);
    expect(sink.entries[0]).toEqual({
      level: 'info',
      timestamp: '2026-05-08T12:00:00.000Z',
      message: 'connected',
      context: { component: 'engine' },
      args: [{ server: 'Local' }, 42],
    });
  });
});

describe('Logger — child', () => {
  it('merges parent + child context', () => {
    const sink = new RecordingSink();
    const parent = new Logger('debug', sink, { component: 'engine' }, { now: fixedNow });
    const child = parent.child({ bindingId: 'b1' });
    child.info('hi');
    expect(sink.entries[0]?.context).toEqual({ component: 'engine', bindingId: 'b1' });
  });

  it('child overrides clashing keys', () => {
    const sink = new RecordingSink();
    const parent = new Logger('debug', sink, { run: 1 }, { now: fixedNow });
    const child = parent.child({ run: 2 });
    child.info('hi');
    expect(sink.entries[0]?.context).toEqual({ run: 2 });
  });

  it('shares the level (initial value) but is independent of later setLevel', () => {
    // Stage 12 design: child snapshots level at construction time. A
    // future change might switch to live propagation; this test pins the
    // current behavior.
    const sink = new RecordingSink();
    const parent = new Logger('error', sink, {}, { now: fixedNow });
    const child = parent.child({});
    parent.setLevel('debug');
    parent.debug('p');
    child.debug('c'); // dropped — child still at 'error'
    expect(sink.entries.map((e) => e.message)).toEqual(['p']);
  });
});

describe('formatLogEntry', () => {
  it('renders a no-context entry', () => {
    const entry: LogEntry = {
      level: 'info',
      timestamp: '2026-05-08T12:00:00Z',
      message: 'hello',
      context: {},
      args: [],
    };
    expect(formatLogEntry(entry)).toBe('2026-05-08T12:00:00Z [info] hello');
  });

  it('inlines context as k=v pairs', () => {
    const entry: LogEntry = {
      level: 'warn',
      timestamp: 'T',
      message: 'm',
      context: { binding: 'b1', count: 3 },
      args: [],
    };
    expect(formatLogEntry(entry)).toBe('T [warn] [binding=b1 count=3] m');
  });

  it('formats Error args readably', () => {
    const entry: LogEntry = {
      level: 'error',
      timestamp: 'T',
      message: 'crash',
      context: {},
      args: [new TypeError('boom')],
    };
    expect(formatLogEntry(entry)).toBe('T [error] crash TypeError: boom');
  });

  it('JSON-stringifies object args', () => {
    const entry: LogEntry = {
      level: 'info',
      timestamp: 'T',
      message: 'cfg',
      context: {},
      args: [{ port: 3000 }],
    };
    expect(formatLogEntry(entry)).toBe('T [info] cfg {"port":3000}');
  });
});

describe('ConsoleLogSink', () => {
  it('routes error/warn through the matching console methods', () => {
    const log = jest.fn();
    const warn = jest.fn();
    const error = jest.fn();
    const sink = new ConsoleLogSink({ log, warn, error });
    sink.write({
      level: 'error',
      timestamp: 'T',
      message: 'a',
      context: {},
      args: [],
    });
    sink.write({
      level: 'warn',
      timestamp: 'T',
      message: 'b',
      context: {},
      args: [],
    });
    sink.write({
      level: 'info',
      timestamp: 'T',
      message: 'c',
      context: {},
      args: [],
    });
    sink.write({
      level: 'debug',
      timestamp: 'T',
      message: 'd',
      context: {},
      args: [],
    });
    expect(error).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(2);
  });
});

describe('CompositeLogSink', () => {
  it('fans entries to every sink', () => {
    const a = new RecordingSink();
    const b = new RecordingSink();
    const composite = new CompositeLogSink([a, b]);
    composite.write({
      level: 'info',
      timestamp: 'T',
      message: 'hi',
      context: {},
      args: [],
    });
    expect(a.entries).toHaveLength(1);
    expect(b.entries).toHaveLength(1);
  });

  it('isolates sink errors so the rest still receive the entry', () => {
    const broken: LogSink = {
      write: () => {
        throw new Error('disk full');
      },
    };
    const ok = new RecordingSink();
    const composite = new CompositeLogSink([broken, ok]);
    expect(() =>
      composite.write({
        level: 'info',
        timestamp: 'T',
        message: 'hi',
        context: {},
        args: [],
      }),
    ).not.toThrow();
    expect(ok.entries).toHaveLength(1);
  });

  it('swallows rejected promises', async () => {
    const broken: LogSink = {
      write: async () => {
        throw new Error('async fail');
      },
    };
    const ok = new RecordingSink();
    const composite = new CompositeLogSink([broken, ok]);
    composite.write({
      level: 'info',
      timestamp: 'T',
      message: 'hi',
      context: {},
      args: [],
    });
    // Allow the broken promise to settle without blowing up.
    await new Promise((r) => setTimeout(r, 0));
    expect(ok.entries).toHaveLength(1);
  });
});
