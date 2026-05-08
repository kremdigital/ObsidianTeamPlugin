import { classifyFileType } from '@/sync/file-type';

describe('classifyFileType', () => {
  it('classifies text by extension', () => {
    expect(classifyFileType('note.md')).toBe('TEXT');
    expect(classifyFileType('config.json')).toBe('TEXT');
    expect(classifyFileType('script.ts')).toBe('TEXT');
    expect(classifyFileType('readme.txt')).toBe('TEXT');
  });

  it('classifies binary by extension (or absence of one)', () => {
    expect(classifyFileType('image.png')).toBe('BINARY');
    expect(classifyFileType('video.mp4')).toBe('BINARY');
    expect(classifyFileType('Makefile')).toBe('BINARY');
    expect(classifyFileType('archive.tar.gz')).toBe('BINARY');
  });

  it('lets text mime types win over the extension', () => {
    expect(classifyFileType('blob.bin', 'text/plain')).toBe('TEXT');
    expect(classifyFileType('blob.bin', 'application/json')).toBe('TEXT');
    expect(classifyFileType('blob.bin', 'application/xml')).toBe('TEXT');
  });

  it('keeps binary classification for non-text mime types', () => {
    expect(classifyFileType('something.unknown', 'application/octet-stream')).toBe('BINARY');
    expect(classifyFileType('image.png', 'image/png')).toBe('BINARY');
  });

  it('is case-insensitive on extensions', () => {
    expect(classifyFileType('NOTE.MD')).toBe('TEXT');
    expect(classifyFileType('Notes.YAML')).toBe('TEXT');
  });
});
