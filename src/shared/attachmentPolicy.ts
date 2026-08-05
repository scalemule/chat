/**
 * Client-side mirror of scalemule-chat's attach-time policy
 * (validate_attachment_type_and_size). Any file type is attachable; media
 * keeps its historical tiers and every other type gets the generic tier,
 * which matches the server cap (= the malware scanner's max file size).
 * The server remains authoritative — this exists for immediate UX feedback.
 */

const MEDIA_SIZE_LIMITS: Record<string, number> = {
  'image/': 10 * 1024 * 1024, // 10 MB
  'video/': 25 * 1024 * 1024, // 25 MB
  'audio/': 5 * 1024 * 1024, // 5 MB
};

export const GENERIC_FILE_SIZE_LIMIT = 100 * 1024 * 1024; // 100 MB

/** Platform-default executable denylist — mirrors the server's list. */
const BLOCKED_EXTENSIONS = [
  '.exe',
  '.dll',
  '.bat',
  '.cmd',
  '.sh',
  '.ps1',
  '.msi',
  '.com',
  '.scr',
];

/**
 * Returns a user-facing error message, or null when the file is attachable.
 */
export function validateAttachmentFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (BLOCKED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return `${file.name} is a blocked file type`;
  }
  const baseType = (file.type || '').split(';')[0].trim().toLowerCase();
  for (const [prefix, limit] of Object.entries(MEDIA_SIZE_LIMITS)) {
    if (baseType.startsWith(prefix)) {
      if (file.size > limit) {
        return `${file.name} exceeds ${limit / (1024 * 1024)}MB limit`;
      }
      return null;
    }
  }
  if (file.size > GENERIC_FILE_SIZE_LIMIT) {
    return `${file.name} exceeds ${GENERIC_FILE_SIZE_LIMIT / (1024 * 1024)}MB limit`;
  }
  return null;
}
