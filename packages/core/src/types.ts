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
  /** Mux asset id — the stable key used by the "Sync from Mux" import (Phase 4). */
  muxAssetId?: string;
  /**
   * Legacy mirror column. Source of truth is now `tags` (Discipline group).
   * Widened to `string` for the Phase 4 transition; dropped in migration 003.
   * @deprecated derive from `tags` instead
   */
  category?: string;
  /**
   * Legacy mirror column. Source of truth is now `tags` (Intensity group).
   * Widened to `string` for the Phase 4 transition; dropped in migration 003.
   * @deprecated derive from `tags` instead
   */
  difficulty?: string;
  /** Tags attached to this class (hydrated reads). */
  tags?: Tag[];
  createdAt: Date;
  publishedAt?: Date;
}

/**
 * Legacy known values — retained only as hints for default badge colors / display
 * mapping during the Phase 4 transition. Tags (`Tag.slug`) are the real source of
 * truth; display code must tolerate any slug (see plan §12). Removed in migration 003.
 */
export type ClassCategory =
  | "strength"
  | "cardio"
  | "yoga"
  | "mobility"
  | "hiit"
  | "recovery";

export type Difficulty = "beginner" | "intermediate" | "advanced";

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
