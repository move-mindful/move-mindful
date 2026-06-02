/**
 * Core types shared across web and mobile apps
 */

// ── Users ──────────────────────────────────────────────

export interface User {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: Date;
}

// ── Video Classes ──────────────────────────────────────

export interface VideoClass {
  id: string;
  title: string;
  description: string;
  instructorName: string;
  durationMinutes: number;
  thumbnailUrl: string;
  muxPlaybackId: string;
  /** Mux asset id — the stable key used by the "Sync from Mux" import. */
  muxAssetId?: string;
  /** Tags attached to this class (hydrated reads). Source of truth for discipline/intensity. */
  tags?: Tag[];
  createdAt: Date;
  publishedAt?: Date;
}

// ── Tags & Collections (Phase 4) ───────────────────────

export interface TagGroup {
  id: string;
  name: string;
  slug: string;
  position: number;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  groupId?: string;
  position: number;
}

export type CollectionKind = "manual" | "smart";
export type MatchMode = "any" | "all";

export interface Collection {
  id: string;
  title: string;
  slug: string;
  description: string;
  kind: CollectionKind;
  matchMode: MatchMode;
  position: number;
  publishedAt?: Date;
}

// ── Subscriptions & Access ─────────────────────────────

export type EntitlementStatus = "active" | "expired" | "none";

export interface UserAccess {
  membership: EntitlementStatus;
  challenge: {
    status: EntitlementStatus;
    expiresAt?: Date;
  };
}

// ── Challenge ──────────────────────────────────────────

export interface Challenge {
  id: string;
  title: string;
  description: string;
  durationDays: number;
  classes: VideoClass[];
}

export interface ChallengeProgress {
  userId: string;
  challengeId: string;
  currentDay: number;
  completedClassIds: string[];
  startedAt: Date;
  completesAt: Date;
}
