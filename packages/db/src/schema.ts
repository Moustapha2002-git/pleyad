/**
 * Pleyad — data model (M1 spine)
 * ------------------------------------------------------------------------
 * Design rules encoded here (see docs/architecture.md + docs/adr/0001):
 *
 *  1. Multi-tenant, shared schema. Every tenant-scoped row carries
 *     `organizationId`. A personal workspace IS an organization (type=personal),
 *     so individuals and companies use the same primitives.
 *  2. Users are GLOBAL identities; `memberships` grant a user access to an
 *     organization with a role.
 *  3. `learningResources` is a CANONICAL, polymorphic catalog:
 *       - source_type=external → global/shared, deduped by (platform, external_id)
 *       - source_type=native   → org-owned/private (ownerOrganizationId set)
 *     Native hosting (video upload) is a Phase-2 switch-on; the discriminator +
 *     ownership FK exist now so it is additive, never a rewrite (docs/adr — content hosting).
 *  4. `userActivities` is the user's PERSONAL progress graph (not org-scoped).
 *     Org completion metrics are DERIVED by matching org-assigned resources to a
 *     member's activities — which keeps personal learning private by construction.
 *  5. Externally-exposed entities carry a `publicId` (nanoid) so we never leak
 *     sequential integer IDs in URLs/APIs.
 *
 * Tables anticipated but intentionally NOT built in M1 (they slot onto this spine
 * without altering it): teams, team_memberships, assignments, invitations.
 */
import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { nanoid } from "nanoid";

const publicId = () =>
  varchar("public_id", { length: 24 })
    .notNull()
    .unique()
    .$defaultFn(() => nanoid());

// ─────────────────────────────────────────────────────────────────────────
// IDENTITY (global)
// ─────────────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  publicId: publicId(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  // Auth is wired in M2; the column exists now so the identity table is stable.
  passwordHash: varchar("password_hash", { length: 255 }),
  emailVerifiedAt: timestamp("email_verified_at"),
  avatarUrl: text("avatar_url"),

  // ── Mentor profile (self-edited in Settings; shown wherever they mentor).
  headline: varchar("headline", { length: 160 }),
  bio: text("bio"),
  expertiseJson: text("expertise_json"), // JSON string[] of expertise tags
  languagesJson: text("languages_json"), // JSON string[] of spoken languages
  availabilityNote: varchar("availability_note", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  lastSignedInAt: timestamp("last_signed_in_at"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// TENANCY
// ─────────────────────────────────────────────────────────────────────────

export const organizations = mysqlTable(
  "organizations",
  {
    id: int("id").autoincrement().primaryKey(),
    publicId: publicId(),
    slug: varchar("slug", { length: 100 }).notNull().unique(), // subdomain: <slug>.pleyad.com
    name: varchar("name", { length: 255 }).notNull(),
    type: mysqlEnum("type", ["personal", "team"]).default("team").notNull(),

    // ── Branding (white-label). Dormant until Phase 2; fields present now so
    //    white-labeling is pure product work, not a migration.
    logoUrl: text("logo_url"),
    faviconUrl: text("favicon_url"),
    primaryColor: varchar("primary_color", { length: 9 }),
    accentColor: varchar("accent_color", { length: 9 }),
    themeConfig: text("theme_config"), // JSON for future extensibility
    customDomain: varchar("custom_domain", { length: 255 }).unique(),
    customDomainVerified: boolean("custom_domain_verified").default(false).notNull(),
    brandingEnabled: boolean("branding_enabled").default(false).notNull(),

    // ── Billing. Dormant until Phase 2 (Stripe). Billing attaches to the org.
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    plan: varchar("plan", { length: 50 }).default("free").notNull(),
    subscriptionStatus: varchar("subscription_status", { length: 50 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex("uq_org_slug").on(t.slug),
  }),
);

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

/** The join that grants a user access to an organization with a role. */
export const memberships = mysqlTable(
  "memberships",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id),
    organizationId: int("organization_id")
      .notNull()
      .references(() => organizations.id),
    // Full role set now, even though M1 only exercises owner/member.
    role: mysqlEnum("role", ["owner", "admin", "manager", "mentor", "member"])
      .default("member")
      .notNull(),
    status: mysqlEnum("status", ["active", "invited", "suspended"])
      .default("active")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    userOrgUnique: uniqueIndex("uq_membership_user_org").on(t.userId, t.organizationId),
    orgIdx: index("idx_membership_org").on(t.organizationId),
  }),
);

export type Membership = typeof memberships.$inferSelect;
export type InsertMembership = typeof memberships.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// LEARNING CONTENT (canonical, polymorphic)
// ─────────────────────────────────────────────────────────────────────────

/**
 * A pointer to "a thing you learn from." External = a shared canonical reference
 * to public content (deduped globally). Native = private content owned by one org
 * (Phase 2 hosting). Everything downstream references a resource by id and does not
 * care which it is — so a path can mix internal + external content freely.
 */
export const learningResources = mysqlTable(
  "learning_resources",
  {
    id: int("id").autoincrement().primaryKey(),
    publicId: publicId(),
    sourceType: mysqlEnum("source_type", ["external", "native"])
      .default("external")
      .notNull(),
    // NULL = global/shared (external). Set = org-owned/private (native).
    ownerOrganizationId: int("owner_organization_id").references(() => organizations.id),

    // External-source fields (null for native).
    platform: mysqlEnum("platform", [
      "youtube",
      "coursera",
      "udemy",
      "edx",
      "linkedin",
      "other",
    ]),
    externalId: varchar("external_id", { length: 255 }), // canonical id derived from URL
    url: varchar("url", { length: 2048 }),

    // Common metadata (both sources).
    title: varchar("title", { length: 512 }).notNull(),
    description: text("description"),
    thumbnailUrl: text("thumbnail_url"),
    provider: varchar("provider", { length: 255 }), // display author/provider
    durationSeconds: int("duration_seconds"),

    // Native-asset fields (hosting_provider, playback_id, status, ...) are added
    // in Phase 2 once a managed video provider is chosen — deliberately deferred.

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    // Global dedupe for external resources. Native rows keep these NULL (MySQL
    // permits multiple NULLs in a unique index), so they never collide.
    platformExternalUnique: uniqueIndex("uq_resource_platform_external").on(
      t.platform,
      t.externalId,
    ),
    ownerIdx: index("idx_resource_owner").on(t.ownerOrganizationId),
  }),
);

export type LearningResource = typeof learningResources.$inferSelect;
export type InsertLearningResource = typeof learningResources.$inferInsert;

/**
 * A user's engagement with a resource — the personal library + the raw material
 * that org completion metrics are derived from. Global to the user, NOT org-scoped.
 * Progress arrives either from the extension (external) or the Pleyad player (native);
 * either way it lands here.
 */
export const userActivities = mysqlTable(
  "user_activities",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id),
    resourceId: int("resource_id")
      .notNull()
      .references(() => learningResources.id),
    status: mysqlEnum("status", ["not_started", "in_progress", "completed", "paused"])
      .default("not_started")
      .notNull(),
    progress: int("progress").default(0).notNull(), // 0–100
    watchSeconds: int("watch_seconds").default(0).notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    lastActivityAt: timestamp("last_activity_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    userResourceUnique: uniqueIndex("uq_activity_user_resource").on(t.userId, t.resourceId),
    userIdx: index("idx_activity_user").on(t.userId),
  }),
);

export type UserActivity = typeof userActivities.$inferSelect;
export type InsertUserActivity = typeof userActivities.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// COLLECTIONS (personal playlists AND org learning paths — one structure)
// ─────────────────────────────────────────────────────────────────────────

/**
 * An ordered set of resources owned by an organization. In a personal workspace
 * (org.type=personal) these are the user's playlists; in a team workspace they are
 * assignable learning paths. Same table, because a personal workspace is an org.
 */
export const collections = mysqlTable(
  "collections",
  {
    id: int("id").autoincrement().primaryKey(),
    publicId: publicId(),
    organizationId: int("organization_id")
      .notNull()
      .references(() => organizations.id),
    ownerUserId: int("owner_user_id").references(() => users.id), // creator
    kind: mysqlEnum("kind", ["playlist", "path"]).default("playlist").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    goal: varchar("goal", { length: 255 }),
    coverUrl: text("cover_url"),
    status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    orgIdx: index("idx_collection_org").on(t.organizationId),
  }),
);

export type Collection = typeof collections.$inferSelect;
export type InsertCollection = typeof collections.$inferInsert;

/** A resource inside a collection, with ordering + curation metadata. */
export const collectionItems = mysqlTable(
  "collection_items",
  {
    id: int("id").autoincrement().primaryKey(),
    collectionId: int("collection_id")
      .notNull()
      .references(() => collections.id),
    resourceId: int("resource_id")
      .notNull()
      .references(() => learningResources.id),
    position: int("position").default(0).notNull(),
    section: varchar("section", { length: 255 }), // e.g. "Week 1: Fundamentals"
    required: boolean("required").default(true).notNull(),
    notes: text("notes"),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (t) => ({
    collectionIdx: index("idx_collection_item_collection").on(t.collectionId),
    collectionResourceUnique: uniqueIndex("uq_collection_item").on(
      t.collectionId,
      t.resourceId,
    ),
  }),
);

export type CollectionItem = typeof collectionItems.$inferSelect;
export type InsertCollectionItem = typeof collectionItems.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// PROGRESSION — the three development dimensions (Savoir / Savoir-faire /
// Savoir-être). A learning path is tagged with 1–3 dimensions; a learner's
// per-dimension gauge is DERIVED from their progress on paths feeding it
// (no stored counters). See docs/roadmap + client V1 plan.
// ─────────────────────────────────────────────────────────────────────────

export const DIMENSIONS = ["knowledge", "skills", "human_development"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/** Which dimension(s) a learning path (collection) feeds. */
export const collectionDimensions = mysqlTable(
  "collection_dimensions",
  {
    id: int("id").autoincrement().primaryKey(),
    collectionId: int("collection_id")
      .notNull()
      .references(() => collections.id),
    dimension: mysqlEnum("dimension", DIMENSIONS).notNull(),
  },
  (t) => ({
    collectionIdx: index("idx_collection_dimensions_collection").on(t.collectionId),
    uniquePair: uniqueIndex("uq_collection_dimension").on(t.collectionId, t.dimension),
  }),
);

export type CollectionDimension = typeof collectionDimensions.$inferSelect;
export type InsertCollectionDimension = typeof collectionDimensions.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// MENTORSHIP — a mentor is a member (role=mentor) assigned to learners within
// an organization. Assignment is org-scoped; a learner can have a mentor in one
// org and not another. (Admin assignment UI is Phase 2; V1 seeds the link.)
// ─────────────────────────────────────────────────────────────────────────

export const mentorAssignments = mysqlTable(
  "mentor_assignments",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organization_id")
      .notNull()
      .references(() => organizations.id),
    mentorUserId: int("mentor_user_id")
      .notNull()
      .references(() => users.id),
    learnerUserId: int("learner_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("idx_mentor_assignments_org").on(t.organizationId),
    uniqueTriple: uniqueIndex("uq_mentor_assignment").on(
      t.organizationId,
      t.mentorUserId,
      t.learnerUserId,
    ),
  }),
);

export type MentorAssignment = typeof mentorAssignments.$inferSelect;
export type InsertMentorAssignment = typeof mentorAssignments.$inferInsert;

/** Simple 1:1 messaging within an organization (mentor ↔ learner in V1). */
export const messages = mysqlTable(
  "messages",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organization_id")
      .notNull()
      .references(() => organizations.id),
    senderUserId: int("sender_user_id")
      .notNull()
      .references(() => users.id),
    recipientUserId: int("recipient_user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("idx_messages_org").on(t.organizationId),
    pairIdx: index("idx_messages_pair").on(t.senderUserId, t.recipientUserId),
  }),
);

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// SCHEDULING — mentoring sessions (the calendar's first event type). Both
// participants join the same deterministic video room at the scheduled time.
// ─────────────────────────────────────────────────────────────────────────

export const mentoringSessions = mysqlTable(
  "mentoring_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organization_id")
      .notNull()
      .references(() => organizations.id),
    mentorUserId: int("mentor_user_id")
      .notNull()
      .references(() => users.id),
    learnerUserId: int("learner_user_id")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 255 }).notNull(),
    scheduledAt: timestamp("scheduled_at").notNull(),
    durationMinutes: int("duration_minutes").default(30).notNull(),
    status: mysqlEnum("status", ["scheduled", "cancelled", "completed"])
      .default("scheduled")
      .notNull(),
    createdByUserId: int("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("idx_sessions_org").on(t.organizationId),
    mentorIdx: index("idx_sessions_mentor").on(t.mentorUserId),
    learnerIdx: index("idx_sessions_learner").on(t.learnerUserId),
  }),
);

export type MentoringSession = typeof mentoringSessions.$inferSelect;
export type InsertMentoringSession = typeof mentoringSessions.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// ASSIGNMENTS — a learning path targeted to a specific learner, with an
// optional due date. Completion stays DERIVED from the learner's activity.
// (V1: assign a path to an individual; team/cohort assignment is a follow-up.)
// ─────────────────────────────────────────────────────────────────────────

export const pathAssignments = mysqlTable(
  "path_assignments",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organization_id")
      .notNull()
      .references(() => organizations.id),
    collectionId: int("collection_id")
      .notNull()
      .references(() => collections.id),
    learnerUserId: int("learner_user_id")
      .notNull()
      .references(() => users.id),
    assignedByUserId: int("assigned_by_user_id")
      .notNull()
      .references(() => users.id),
    dueAt: timestamp("due_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("idx_path_assignments_org").on(t.organizationId),
    learnerIdx: index("idx_path_assignments_learner").on(t.learnerUserId),
    uniquePair: uniqueIndex("uq_path_assignment").on(t.collectionId, t.learnerUserId),
  }),
);

export type PathAssignment = typeof pathAssignments.$inferSelect;
export type InsertPathAssignment = typeof pathAssignments.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// COACHING — mentor tools: tasks/exercises and official feedback.
// ─────────────────────────────────────────────────────────────────────────

export const learnerTasks = mysqlTable(
  "learner_tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organization_id")
      .notNull()
      .references(() => organizations.id),
    mentorUserId: int("mentor_user_id")
      .notNull()
      .references(() => users.id),
    learnerUserId: int("learner_user_id")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 255 }).notNull(),
    instructions: text("instructions"),
    dueAt: timestamp("due_at"),
    status: mysqlEnum("status", ["open", "done"]).default("open").notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("idx_learner_tasks_org").on(t.organizationId),
    learnerIdx: index("idx_learner_tasks_learner").on(t.learnerUserId),
  }),
);

export type LearnerTask = typeof learnerTasks.$inferSelect;
export type InsertLearnerTask = typeof learnerTasks.$inferInsert;

export const mentorFeedback = mysqlTable(
  "mentor_feedback",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organization_id")
      .notNull()
      .references(() => organizations.id),
    mentorUserId: int("mentor_user_id")
      .notNull()
      .references(() => users.id),
    learnerUserId: int("learner_user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("idx_mentor_feedback_org").on(t.organizationId),
    learnerIdx: index("idx_mentor_feedback_learner").on(t.learnerUserId),
  }),
);

export type MentorFeedback = typeof mentorFeedback.$inferSelect;
export type InsertMentorFeedback = typeof mentorFeedback.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// QUIZZES — a mentor builds a multiple-choice quiz for a learner; the learner
// takes it and is graded server-side (correct answers never leave the server).
// ─────────────────────────────────────────────────────────────────────────

export const quizzes = mysqlTable(
  "quizzes",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organization_id")
      .notNull()
      .references(() => organizations.id),
    mentorUserId: int("mentor_user_id")
      .notNull()
      .references(() => users.id),
    learnerUserId: int("learner_user_id")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("idx_quizzes_org").on(t.organizationId),
    learnerIdx: index("idx_quizzes_learner").on(t.learnerUserId),
  }),
);

export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuiz = typeof quizzes.$inferInsert;

export const quizQuestions = mysqlTable(
  "quiz_questions",
  {
    id: int("id").autoincrement().primaryKey(),
    quizId: int("quiz_id")
      .notNull()
      .references(() => quizzes.id),
    prompt: varchar("prompt", { length: 512 }).notNull(),
    options: text("options").notNull(), // JSON array of option strings
    correctIndex: int("correct_index").notNull(),
    position: int("position").default(0).notNull(),
  },
  (t) => ({
    quizIdx: index("idx_quiz_questions_quiz").on(t.quizId),
  }),
);

export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type InsertQuizQuestion = typeof quizQuestions.$inferInsert;

export const quizAttempts = mysqlTable(
  "quiz_attempts",
  {
    id: int("id").autoincrement().primaryKey(),
    quizId: int("quiz_id")
      .notNull()
      .references(() => quizzes.id),
    learnerUserId: int("learner_user_id")
      .notNull()
      .references(() => users.id),
    answers: text("answers").notNull(), // JSON array of chosen indices
    correctCount: int("correct_count").notNull(),
    totalCount: int("total_count").notNull(),
    score: int("score").notNull(), // 0–100
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  },
  (t) => ({
    quizLearnerIdx: index("idx_quiz_attempts_quiz_learner").on(t.quizId, t.learnerUserId),
  }),
);

export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type InsertQuizAttempt = typeof quizAttempts.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS — in-app activity feed. One row per (recipient, event). The
// `linkTo` is a client route the item deep-links to; unread = readAt IS NULL.
// ─────────────────────────────────────────────────────────────────────────

export const NOTIFICATION_TYPES = [
  "path_assigned",
  "task",
  "feedback",
  "session",
  "quiz",
  "message",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: int("user_id") // the recipient
      .notNull()
      .references(() => users.id),
    type: mysqlEnum("type", NOTIFICATION_TYPES).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: varchar("body", { length: 512 }),
    linkTo: varchar("link_to", { length: 255 }),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("idx_notifications_user").on(t.organizationId, t.userId),
  }),
);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// INVITATIONS — reusable join links. Anyone with the link registers (or accepts
// while signed in) and lands in the organization with the invite's role. No
// email provider needed: the admin shares the link through their own channel.
// ─────────────────────────────────────────────────────────────────────────

export const invitations = mysqlTable(
  "invitations",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organization_id")
      .notNull()
      .references(() => organizations.id),
    role: mysqlEnum("role", ["member", "mentor", "admin"]).default("member").notNull(),
    token: varchar("token", { length: 48 })
      .notNull()
      .unique()
      .$defaultFn(() => nanoid(32)),
    createdByUserId: int("created_by_user_id")
      .notNull()
      .references(() => users.id),
    usedCount: int("used_count").default(0).notNull(),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("idx_invitations_org").on(t.organizationId),
  }),
);

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;
