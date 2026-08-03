/**
 * Shared types for The Port's support ticketing (/support).
 *
 * Mirrors the `support_tickets` table in
 * supabase/migrations/20260730_create_support_tickets.sql. The category and
 * status unions must stay in step with that table's CHECK constraints —
 * they're enforced in Postgres, so drift here surfaces as a 500 on insert
 * rather than a type error.
 */

export const TICKET_CATEGORIES = [
  'billing',
  'data_correction',
  'bug',
  'account',
  'forecast_question',
  'feature_request',
  'other',
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  billing: 'Billing & plan',
  data_correction: 'Spot data correction',
  bug: 'Something is broken',
  account: 'Account & login',
  forecast_question: 'Forecast or score question',
  feature_request: 'Feature request',
  other: 'Something else',
};

/** One-line hint shown under each category in the form's picker. */
export const TICKET_CATEGORY_HINTS: Record<TicketCategory, string> = {
  billing: 'Charges, plan changes, invoices, refunds',
  data_correction: 'A spot is wrong, missing, or in the wrong place',
  bug: 'A page, map, or alert is misbehaving',
  account: 'Sign-in trouble, email changes, deletion',
  forecast_question: 'Why a score reads the way it does',
  feature_request: 'Something you wish ReelCaster did',
  other: 'Anything that does not fit above',
};

export const TICKET_STATUSES = [
  'open',
  'in_progress',
  'waiting_on_user',
  'resolved',
  'closed',
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_on_user: 'Waiting on you',
  resolved: 'Resolved',
  closed: 'Closed',
};

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

/** Submission-time snapshot frozen onto the ticket. */
export interface TicketContext {
  tier?: string;
  subscriptionStatus?: string;
  /** Path the member filed from, e.g. "/explore/spot/pedder-bay". */
  page?: string;
  userAgent?: string;
  /** Seeded when the form is opened from a spot page. */
  spotSlug?: string;
  appBuild?: string;
  [key: string]: unknown;
}

export interface SupportTicket {
  id: string;
  ticket_ref: string;
  category: TicketCategory;
  subject: string;
  body: string;
  status: TicketStatus;
  priority: TicketPriority;
  context: TicketContext;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Request body accepted by POST /api/support/tickets. */
export interface CreateTicketInput {
  category: TicketCategory;
  subject: string;
  body: string;
  context?: TicketContext;
}

export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 200;
export const BODY_MIN = 10;
export const BODY_MAX = 8000;

export function isTicketCategory(v: unknown): v is TicketCategory {
  return (
    typeof v === 'string' &&
    (TICKET_CATEGORIES as readonly string[]).includes(v)
  );
}
