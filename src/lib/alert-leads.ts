/**
 * Alert leads: one email score alert for a visitor with no account.
 *
 * A signed-out angler on a spot page leaves a name and an email, confirms by
 * link, and from then on hears about good days at that spot exactly the way a
 * Member's alert would: same outlook, same beats, same digest email. The
 * pieces that are pure (scoreBeatsFor, the digest template) are shared with
 * the account engine. The ledger is not, because alert_day_notices is keyed to
 * auth.users and a lead has no user, so leads keep their own twin of it with
 * the same insert-then-send rule.
 *
 * One lead per address. A second spot or species needs an account, and once
 * the address has one, claimAlertLeadForUser moves the lead onto it and the
 * normal tier rules take over.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { fetchSpotSpeciesOutlook } from '@/lib/bluecaster-score';
import { speciesLabel } from '@/lib/custom-alert-engine';
import { scoreBeatsFor, localDateOf, type LeadTimeMode, type NoticeState } from '@/lib/score-beats';
import { sendEmail } from '@/lib/email-service';
import { generateScoreAlertDigest, type ScoreAlertItem } from '@/lib/email-templates/score-alert';
import { alertLeadConfirmEmail, alertLeadDigestFooter } from '@/lib/email-templates/alert-lead';
import { SITE_URL } from '@/lib/site';

export interface AlertLead {
  id: string;
  name: string;
  email: string;
  spot_slug: string;
  spot_name: string;
  spot_lat: number | null;
  spot_lng: number | null;
  target_species: string | null;
  score_threshold: number;
  lead_time_mode: LeadTimeMode;
  token: string;
  confirm_sent_at: string | null;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  claimed_user_id: string | null;
}

let adminClient: SupabaseClient | null = null;
export function leadsAdmin(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  return adminClient;
}

export function appBase(): string {
  return process.env.NEXT_PUBLIC_APP_URL || SITE_URL;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Where the confirm and unsubscribe links land. Both need a tap on the page. */
export function leadActionUrl(token: string, action: 'confirm' | 'unsubscribe'): string {
  return `${appBase()}/alert-confirm?token=${encodeURIComponent(token)}&action=${action}`;
}

export async function sendLeadConfirmEmail(lead: AlertLead): Promise<boolean> {
  const { subject, html } = alertLeadConfirmEmail({
    name: lead.name,
    spotName: lead.spot_name,
    speciesName: speciesLabel(lead.target_species),
    threshold: lead.score_threshold,
    confirmUrl: leadActionUrl(lead.token, 'confirm'),
    unsubscribeUrl: leadActionUrl(lead.token, 'unsubscribe'),
  });
  const result = await sendEmail({ to: lead.email, subject, html });
  if (!result.success) {
    console.error(`[alert-leads] confirm email failed for lead ${lead.id}:`, result.error);
  }
  return result.success;
}

/**
 * Move this address's lead onto its new account.
 *
 * Called on signed-in page loads (via /api/welcome), so it must be cheap when
 * there is nothing to do: one indexed lookup by email. A confirmed lead becomes
 * an ordinary score alert, but only when the account has no alerts yet. An
 * account that already has one is under the tier rules, and a lead must not be
 * a way around the Member cap. Either way the lead is stamped claimed, which
 * stops the lead sender: from here on the account speaks for this address.
 *
 * Never throws. A failed claim leaves the lead sending, which is the right
 * failure for someone who asked for the alert.
 */
export async function claimAlertLeadForUser(userId: string, email: string | null | undefined): Promise<void> {
  if (!email) return;
  const admin = leadsAdmin();
  try {
    const { data: lead } = await admin
      .from('alert_leads')
      .select('*')
      .eq('email', normalizeEmail(email))
      .is('claimed_user_id', null)
      .maybeSingle<AlertLead>();
    if (!lead) return;

    if (lead.confirmed_at && !lead.unsubscribed_at) {
      const { count } = await admin
        .from('user_alert_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if ((count ?? 0) === 0) {
        const { error } = await admin.from('user_alert_profiles').insert({
          user_id: userId,
          name: `${speciesLabel(lead.target_species) ?? 'Best species'} ≥${lead.score_threshold} at ${lead.spot_name}`,
          // Score alerts evaluate the spot slug, not these, but the columns
          // are NOT NULL and the Notifications page reads them.
          location_lat: lead.spot_lat ?? 0,
          location_lng: lead.spot_lng ?? 0,
          location_name: lead.spot_name,
          triggers: {
            fishing_score: {
              enabled: true,
              min_score: lead.score_threshold,
              species: lead.target_species ?? undefined,
            },
          },
          logic_mode: 'AND',
          cooldown_hours: 12,
          alert_kind: 'score',
          target_bluecaster_spot_slug: lead.spot_slug,
          target_species: lead.target_species,
          score_threshold: lead.score_threshold,
          delivery_channels: ['email'],
          lead_time_mode: lead.lead_time_mode,
        });
        if (error) {
          console.error(`[alert-leads] could not move lead ${lead.id} onto ${userId}:`, error);
          return;
        }
      }
    }

    await admin
      .from('alert_leads')
      .update({ claimed_user_id: userId, claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', lead.id)
      .is('claimed_user_id', null);
  } catch (err) {
    console.error('[alert-leads] claim failed:', err);
  }
}

const NOTICE_LOOKBACK_DAYS = 30;

/** Lead twin of the engine's loadNoticeState. Fails closed the same way. */
async function loadLeadNotices(leadId: string, today: string): Promise<NoticeState> {
  const since = new Date(Date.now() - NOTICE_LOOKBACK_DAYS * 86_400_000).toISOString();
  const { data, error } = await leadsAdmin()
    .from('alert_lead_notices')
    .select('target_date, beat, created_at')
    .eq('lead_id', leadId)
    .eq('beat', 'heads_up')
    .gte('created_at', since);

  if (error) {
    console.error(`[alert-leads] notice history unavailable for ${leadId}:`, error);
    return { headsUpSentOn: new Map(), lastHeadsUpAt: new Date() };
  }

  const headsUpSentOn = new Map<string, string>();
  let lastHeadsUpAt: Date | null = null;
  for (const row of data ?? []) {
    const at = new Date(row.created_at);
    if (row.target_date >= today) headsUpSentOn.set(row.target_date, localDateOf(at));
    if (!lastHeadsUpAt || at > lastHeadsUpAt) lastHeadsUpAt = at;
  }
  return { headsUpSentOn, lastHeadsUpAt };
}

/** Did this lead already get its one message today? Fails closed. */
async function leadEmailedToday(leadId: string, todayLocal: string): Promise<boolean> {
  const since = new Date(Date.now() - 36 * 3_600_000).toISOString();
  const { data, error } = await leadsAdmin()
    .from('alert_lead_notices')
    .select('sent_at')
    .eq('lead_id', leadId)
    .eq('notification_sent', true)
    .gte('sent_at', since);
  if (error) return true;
  return (data ?? []).some((r) => r.sent_at && localDateOf(new Date(r.sent_at)) === todayLocal);
}

export interface LeadRunSummary {
  leads: number;
  sent: number;
  failed: number;
  errors: number;
}

/**
 * Evaluate every confirmed lead and email the ones with a day to report.
 * Runs inside runAlertEvaluation, so both schedulers drive it.
 */
export async function processAlertLeads(): Promise<LeadRunSummary> {
  const admin = leadsAdmin();
  const summary: LeadRunSummary = { leads: 0, sent: 0, failed: 0, errors: 0 };

  const { data: leads, error } = await admin
    .from('alert_leads')
    .select('*')
    .not('confirmed_at', 'is', null)
    .is('unsubscribed_at', null)
    .is('claimed_user_id', null);

  if (error) {
    console.error('[alert-leads] could not load leads:', error);
    summary.errors++;
    return summary;
  }

  const todayLocal = localDateOf(new Date());
  const base = appBase();

  for (const lead of (leads ?? []) as AlertLead[]) {
    summary.leads++;
    try {
      if (await leadEmailedToday(lead.id, todayLocal)) continue;

      const outlook = await fetchSpotSpeciesOutlook(lead.spot_slug, lead.target_species);
      if (!outlook) continue;

      const today = outlook.days[0]?.date ?? new Date().toISOString().slice(0, 10);
      const notices = await loadLeadNotices(lead.id, today);
      const candidates = scoreBeatsFor(
        { score_threshold: lead.score_threshold, triggers: {}, lead_time_mode: lead.lead_time_mode },
        outlook,
        notices,
      );
      if (candidates.length === 0) continue;

      const noticeIds: string[] = [];
      const items: ScoreAlertItem[] = [];
      for (const c of candidates) {
        const { data: claimed, error: claimError } = await admin
          .from('alert_lead_notices')
          .insert({
            lead_id: lead.id,
            target_date: c.targetDate,
            beat: c.beat,
            score_at_send: c.score,
            lead_days: c.leadDays,
          })
          .select('id')
          .single();
        if (claimError || !claimed) continue; // 23505 = already sent for this day and beat
        noticeIds.push(claimed.id);
        items.push({
          beat: c.beat,
          spotName: lead.spot_name,
          spotSlug: lead.spot_slug,
          speciesName: speciesLabel(outlook.scoredSpeciesSlug ?? lead.target_species),
          speciesMatched: outlook.speciesMatched,
          targetDate: c.targetDate,
          leadDays: c.leadDays,
          score: c.score,
        });
      }
      if (items.length === 0) continue;

      items.sort((a, b) =>
        a.targetDate === b.targetDate ? b.score - a.score : a.targetDate < b.targetDate ? -1 : 1,
      );

      const signupUrl = `${base}/signup?next=${encodeURIComponent(`/explore/spot/${lead.spot_slug}`)}`;
      const message = generateScoreAlertDigest({
        items,
        smsItems: [],
        alsoEmailing: true,
        appBase: base,
        manageAlertsUrl: signupUrl,
        footerHtml: alertLeadDigestFooter(signupUrl, leadActionUrl(lead.token, 'unsubscribe')),
      });

      const result = await sendEmail({ to: lead.email, subject: message.subject, html: message.html });
      const now = new Date().toISOString();
      await admin
        .from('alert_lead_notices')
        .update({
          notification_sent: result.success,
          notification_error: result.success ? null : (result.error ?? 'send failed'),
          sent_at: result.success ? now : null,
        })
        .in('id', noticeIds);

      if (result.success) summary.sent++;
      else summary.failed++;
    } catch (err) {
      console.error(`[alert-leads] error on lead ${lead.id}:`, err);
      summary.errors++;
    }
  }

  return summary;
}
