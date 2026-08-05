import { describe, expect, it } from 'vitest';
import { validateAttachmentFile, GENERIC_FILE_SIZE_LIMIT } from './attachmentPolicy';

function fakeFile(name: string, type: string, size: number): File {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('validateAttachmentFile', () => {
  it('allows generic documents within the generic tier', () => {
    expect(validateAttachmentFile(fakeFile('report.pdf', 'application/pdf', 50 * 1024 * 1024))).toBeNull();
    expect(validateAttachmentFile(fakeFile('data.zip', 'application/zip', 1024))).toBeNull();
    expect(validateAttachmentFile(fakeFile('notes.txt', 'text/plain', 1024))).toBeNull();
    expect(validateAttachmentFile(fakeFile('blob.bin', '', 1024))).toBeNull();
  });

  it('keeps media tiers', () => {
    expect(validateAttachmentFile(fakeFile('a.png', 'image/png', 10 * 1024 * 1024))).toBeNull();
    expect(validateAttachmentFile(fakeFile('a.png', 'image/png', 10 * 1024 * 1024 + 1))).toMatch(/10MB/);
    expect(validateAttachmentFile(fakeFile('a.mp4', 'video/mp4', 25 * 1024 * 1024 + 1))).toMatch(/25MB/);
    expect(validateAttachmentFile(fakeFile('a.mp3', 'audio/mpeg', 5 * 1024 * 1024 + 1))).toMatch(/5MB/);
  });

  it('enforces the generic tier cap', () => {
    expect(validateAttachmentFile(fakeFile('big.pdf', 'application/pdf', GENERIC_FILE_SIZE_LIMIT + 1))).toMatch(
      /100MB/,
    );
  });

  it('blocks executables regardless of declared type', () => {
    expect(validateAttachmentFile(fakeFile('setup.exe', 'application/pdf', 1))).toMatch(/blocked/);
    expect(validateAttachmentFile(fakeFile('Run.SH', 'text/plain', 1))).toMatch(/blocked/);
    expect(validateAttachmentFile(fakeFile('archive.tar.gz', 'application/gzip', 1))).toBeNull();
    expect(validateAttachmentFile(fakeFile('notes.exe.txt', 'text/plain', 1))).toBeNull();
  });
});
