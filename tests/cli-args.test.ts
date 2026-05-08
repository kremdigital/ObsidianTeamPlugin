import { CliArgsError, parseArgs } from '../scripts/cli-args';

describe('parseArgs', () => {
  it('returns help with no args', () => {
    expect(parseArgs([])).toEqual({ command: 'help', server: '', apiKey: '' });
  });

  it('parses list-projects with required options', () => {
    expect(parseArgs(['list-projects', '--server', 'https://x', '--api-key', 'k'])).toEqual({
      command: 'list-projects',
      server: 'https://x',
      apiKey: 'k',
    });
  });

  it('parses list-files with project id', () => {
    expect(
      parseArgs(['list-files', '--server', 'https://x', '--api-key', 'k', '--project', 'p1']),
    ).toEqual({
      command: 'list-files',
      server: 'https://x',
      apiKey: 'k',
      projectId: 'p1',
    });
  });

  it('parses pull with folder', () => {
    expect(
      parseArgs([
        'pull',
        '--server',
        'https://x',
        '--api-key',
        'k',
        '--project',
        'p1',
        '--folder',
        './vault',
      ]),
    ).toEqual({
      command: 'pull',
      server: 'https://x',
      apiKey: 'k',
      projectId: 'p1',
      folder: './vault',
    });
  });

  it('accepts --client-id override', () => {
    const args = parseArgs([
      'watch',
      '--server',
      'https://x',
      '--api-key',
      'k',
      '--project',
      'p1',
      '--client-id',
      'box-1',
    ]);
    expect(args.clientId).toBe('box-1');
  });

  it('rejects unknown commands', () => {
    expect(() => parseArgs(['nonsense'])).toThrow(CliArgsError);
  });

  it('rejects positional arguments after the command', () => {
    expect(() => parseArgs(['list-projects', 'extra', '--server', 'https://x'])).toThrow(
      /Unexpected positional/,
    );
  });

  it('rejects missing required options', () => {
    expect(() => parseArgs(['list-projects'])).toThrow(/--server/);
    expect(() => parseArgs(['list-projects', '--server', 'https://x'])).toThrow(/--api-key/);
  });

  it('rejects commands that require --project without one', () => {
    expect(() =>
      parseArgs(['pull', '--server', 'https://x', '--api-key', 'k', '--folder', '.']),
    ).toThrow(/--project/);
  });

  it('rejects commands that require --folder without one', () => {
    expect(() =>
      parseArgs(['push', '--server', 'https://x', '--api-key', 'k', '--project', 'p1']),
    ).toThrow(/--folder/);
  });

  it('rejects flags missing values', () => {
    expect(() => parseArgs(['list-projects', '--server'])).toThrow(/Missing value/);
  });
});
