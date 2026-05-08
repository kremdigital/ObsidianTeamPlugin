/**
 * DTO mirrors of the server-side response shapes.
 *
 * These are hand-copied from the corresponding Next.js routes in
 * `server/src/app/api/...`. We don't share types directly because the two
 * sides ship as separate npm projects with different TS targets and tooling.
 * Keep this file in sync manually; the unit tests that mock `requestUrl`
 * exercise the response parsing and will catch most drift.
 *
 * BigInt note: the server serializes file sizes as **strings** (Prisma
 * `BigInt` → JSON via `.toString()`) — see `/api/projects/[id]/files`. The
 * plugin parses them into `number` once at the boundary; for files >2^53
 * bytes that would lose precision, but the server caps uploads via
 * `MAX_FILE_SIZE` long before that.
 */

export interface ApiUser {
  id: string;
  email: string;
  name: string | null;
  /** Server-side role enum (`MEMBER` / `ADMIN`). Not used by the plugin yet. */
  role?: string;
  emailVerified?: string | null;
  language?: string;
}

export interface ApiProject {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  iconEmoji: string | null;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ApiFileType = 'TEXT' | 'BINARY';

/** Single entry in `GET /api/projects/[id]/files`. */
export interface ApiFile {
  id: string;
  path: string;
  fileType: ApiFileType;
  contentHash: string;
  size: number;
  mimeType: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedById: string | null;
}

/** Subset of {@link ApiFile} returned by upload / update endpoints. */
export interface ApiFileMeta {
  id: string;
  path: string;
  fileType: ApiFileType;
  contentHash: string;
  size: number;
  mimeType: string | null;
  createdAt?: string;
  updatedAt: string;
}

export interface ApiFileVersion {
  id: string;
  versionNumber: number;
  contentHash: string;
  authorId: string;
  message: string | null;
  createdAt: string;
  author: { id: string; name: string | null; email: string } | null;
}
