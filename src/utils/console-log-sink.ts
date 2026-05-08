import { formatLogEntry, type LogEntry, type LogSink } from './logger';

/**
 * Mirrors log entries to the DevTools console. Used in addition to the
 * file sink when `logLevel = debug` so developers can watch the stream
 * live without `tail -f`-ing the log file.
 *
 * `error` / `warn` are routed through `console.error` / `console.warn`
 * so they show up red/yellow in DevTools. Everything else uses
 * `console.log` to keep the noise level reasonable.
 */
export class ConsoleLogSink implements LogSink {
  constructor(
    private readonly target: {
      log: (...args: unknown[]) => void;
      warn: (...args: unknown[]) => void;
      error: (...args: unknown[]) => void;
    } = console,
  ) {}

  write(entry: LogEntry): void {
    const line = formatLogEntry(entry);
    if (entry.level === 'error') this.target.error(line);
    else if (entry.level === 'warn') this.target.warn(line);
    else this.target.log(line);
  }
}
