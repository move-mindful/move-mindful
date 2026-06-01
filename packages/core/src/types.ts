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
  category: ClassCategory;
  difficulty: Difficulty;
  createdAt: Date;
  publishedAt?: Date;
}

export type ClassCategory =
  | "strength"
  | "cardio"
  | "yoga"
  | "mobility"
  | "hiit"
  | "recovery";

export type Difficulty = "beginner" | "intermediate" | "advanced";

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
