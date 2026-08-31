/**
 * Alert Evaluation API
 *
 * POST /api/alerts/evaluate - Process all active alert profiles
 *
 * This endpoint is called by the GitHub Actions cron job every 15-30 minutes.
 * It evaluates all active alert profiles and sends notifications for matches.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processAlerts, getUserEmail, markBeatSent } from '@/lib/custom-alert-engine';
import { sendEmail } from '@/lib/email-service';
import { generateCustomAlertEmail } from '@/lib/email-templates/custom-alert';
import { generateScoreAlertDigest } from '@/lib/email-templates/score-alert';
import { mintShareCard } from '@/lib/share-cards-server';
import { smsCarriesDigest } from '@/lib/alert-channels';
import { sendSms, isTwilioConfigured } from '@/lib/twilio';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(request: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    console.log('Starting alert evaluation...');

    // Process all active alerts
    const results = await processAlerts();

    console.log(`Processed ${results.processed} profiles, ${results.triggered} triggered`);

    // Send notifications for triggered alerts
    const notificationResults: Array<{
      profileId: string;
      email: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const result of results.results) {
      if (!result.triggered) continue;

      try {
        // Get alert profile details
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('user_alert_profiles')
          .select('*')
          .eq('id', result.profileId)
          .single();

        if (profileError || !profile) {
          console.error(`Failed to fetch profile ${result.profileId}:`, profileError);
          continue;
        }

        // Score alerts are delivered from `digestJobs` below: they are about a
        // dated day rather than about right now, they write `alert_day_notices`
        // instead of `alert_history`, and their copy changes with the beat.
        if (profile.alert_kind === 'score' && profile.target_bluecaster_spot_slug) {
          continue;
        }

        // Get user email
        const email = await getUserEmail(profile.user_id);
        if (!email) {
          console.error(`No email found for user ${profile.user_id}`);
          continue;
        }

        // Get most recent history entry for condition snapshot
        const { data: historyEntry } = await supabaseAdmin
          .from('alert_history')
          .select('*')
          .eq('alert_profile_id', result.profileId)
          .order('triggered_at', { ascending: false })
          .limit(1)
          .single();

        const speciesName = profile.target_species
          ? profile.target_species
              .split('-')
              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')
          : null;

        const appBase =
          process.env.NEXT_PUBLIC_APP_URL || 'https://reelcaster.com';
        // Deep-link the CTA straight to the spot's forecast page when the alert
        // is tied to a spot; otherwise fall back to a coordinate map lookup.
        const forecastUrl = profile.target_bluecaster_spot_slug
          ? `${appBase}/explore/spot/${profile.target_bluecaster_spot_slug}`
          : `${appBase}?lat=${profile.location_lat}&lng=${profile.location_lng}`;

        const emailContent = generateCustomAlertEmail({
          alertName: profile.name,
          locationName: profile.location_name || `${profile.location_lat.toFixed(4)}, ${profile.location_lng.toFixed(4)}`,
          matchedTriggers: historyEntry?.matched_triggers || [],
          conditionSnapshot: historyEntry?.condition_snapshot || {},
          logicMode: profile.logic_mode,
          forecastUrl,
          manageAlertsUrl: `${appBase}/alerts`,
          alertKind: profile.alert_kind ?? 'composite',
          scoreThreshold: profile.score_threshold ?? null,
          speciesName,
        });

        const channels: string[] = profile.delivery_channels ?? ['email'];

        // Send email when channel is enabled (default behavior preserved)
        const sendResult = channels.includes('email')
          ? await sendEmail({
              to: email,
              subject: emailContent.subject,
              html: emailContent.html,
            })
          : { success: true };

        // SMS: only fire when channel requested + Twilio configured + phone verified
        if (channels.includes('sms') && isTwilioConfigured()) {
          const { data: settings } = await supabaseAdmin
            .from('user_settings')
            .select('phone_e164, phone_verified')
            .eq('user_id', profile.user_id)
            .maybeSingle();
          if (settings?.phone_verified && settings.phone_e164) {
            const smsBody =
              emailContent.subject.length > 160
                ? `${emailContent.subject.slice(0, 157)}...`
                : emailContent.subject;
            const smsResult = await sendSms(settings.phone_e164, smsBody);
            if (!smsResult.ok) {
              console.error(`SMS dispatch failed for ${result.profileId}:`, smsResult);
            }
          }
        }

        if (sendResult.success) {
          notificationResults.push({
            profileId: result.profileId,
            email,
            success: true,
          });

          // Update history to mark notification as sent
          if (historyEntry) {
            await supabaseAdmin
              .from('alert_history')
              .update({ notification_sent: true })
              .eq('id', historyEntry.id);
          }
        } else {
          notificationResults.push({
            profileId: result.profileId,
            email,
            success: false,
            error: sendResult.error,
          });

          // Log notification error
          if (historyEntry) {
            await supabaseAdmin
              .from('alert_history')
              .update({
                notification_sent: false,
                notification_error: sendResult.error,
              })
              .eq('id', historyEntry.id);
          }
        }
      } catch (notifyError) {
        console.error(`Error sending notification for ${result.profileId}:`, notifyError);
        notificationResults.push({
          profileId: result.profileId,
          email: 'unknown',
          success: false,
          error: notifyError instanceof Error ? notifyError.message : 'Unknown error',
        });
      }
    }

    // Score-alert delivery. One message per angler, covering every alert of
    // theirs with something to say today.
    //
    // Every item here has already been claimed in `alert_day_notices`, so the
    // send is allowed to fail: the claim is what guarantees we never say the
    // same thing about the same day twice, and a message lost to a bad SMTP
    // response is a better outcome than a duplicate.
    //
    // The whole digest is stamped as one unit. An email either carried all of
    // it or none of it, so per-item outcomes would be a fiction, and the
    // "already spoken to today" check that caps volume reads these same rows.
    for (const job of results.digestJobs) {
      const noticeIds = job.items.map((i) => i.noticeId);
      const stampAll = async (sent: boolean, delivered: string[], error?: string) => {
        await Promise.all(
          noticeIds.map((id) => markBeatSent(id, sent, delivered, error)),
        );
      };

      try {
        const email = await getUserEmail(job.userId);
        if (!email) {
          console.error(`No email found for user ${job.userId}`);
          await stampAll(false, [], 'No email on account');
          continue;
        }

        // Channel is a per-alert setting and this is one message covering
        // several alerts, so each half of the digest is built from the items
        // that asked for it. The email carries everything; the text carries
        // only the spots whose own alert asked to be texted.
        const emailItems = job.items.filter((i) => i.channels.includes('email'));
        const smsItems = job.items.filter((i) => i.channels.includes('sms'));
        const willEmail = emailItems.length > 0;

        // Only true when the email actually contains everything the text is
        // about. A text that says "full rundown in your email" is wrong both
        // for an angler who gets no email at all and for one whose email omits
        // the SMS-only spot the text just named.
        const smsCoveredByEmail =
          willEmail && smsItems.every((i) => i.channels.includes('email'));

        const appBase = process.env.NEXT_PUBLIC_APP_URL || 'https://reelcaster.com';

        // Mint a share card per day in the digest, so the email itself carries
        // the link and someone can forward a good day straight out of their
        // inbox without opening the app. It also has to exist BEFORE the tap:
        // navigator.share() needs transient activation, and iOS Safari refuses
        // a handler that first awaits a mint.
        //
        // Unique on (alert_profile_id, target_date), so a confirm beat reuses
        // the heads-up's card rather than minting a second one for the same
        // day. Every remaining beat is a day worth going out on — the
        // stand-down beat, which told someone a day had got worse, is gone from
        // the model — so there is no beat here that should be denied a link.
        //
        // Only for the items that will actually render it. A card is a nicety
        // on top of the alert and must never stop a send, so every failure here
        // falls back to the item unchanged.
        const withShareLinks = async (items: typeof job.items) =>
          Promise.all(
            items.map(async (item) => {
              if (!item.spotSlug) return item;
              try {
                const card = await mintShareCard({
                  source: 'alert',
                  slug: item.spotSlug,
                  // The engine builds this display name by title-casing the
                  // species slug, so lower-casing and hyphenating reverses it
                  // exactly. Without it the card would fall back to the spot's
                  // best species and could name a different fish than the
                  // alert did.
                  speciesSlug: item.speciesName
                    ? item.speciesName.toLowerCase().replace(/\s+/g, '-')
                    : null,
                  targetDate: item.targetDate,
                  userId: job.userId,
                  alertProfileId: item.profileId,
                });
                return card
                  ? {
                      ...item,
                      shareUrl: `${appBase}/explore/spot/${item.spotSlug}?share=${card.token}`,
                    }
                  : item;
              } catch (mintError) {
                console.error(
                  `Share card mint failed for profile ${item.profileId}:`,
                  mintError,
                );
                return item;
              }
            }),
          );

        const digestItems = await withShareLinks(
          willEmail ? emailItems : job.items,
        );

        const message = generateScoreAlertDigest({
          items: digestItems,
          smsItems,
          alsoEmailing: smsCoveredByEmail,
          appBase,
          manageAlertsUrl: `${appBase}/alerts`,
        });

        const delivered: string[] = [];

        if (willEmail) {
          const sendResult = await sendEmail({
            to: email,
            subject: message.subject,
            html: message.html,
          });
          if (sendResult.success) delivered.push('email');
          else console.error(`Email dispatch failed for user ${job.userId}:`, sendResult.error);
        }

        // SMS stays quiet for a heads-ups-only digest when email can carry it,
        // and carries everything for someone who picked no email at all.
        // See lib/alert-channels.ts.
        if (message.sms && smsCarriesDigest(job.items) && isTwilioConfigured()) {
          const { data: settings } = await supabaseAdmin
            .from('user_settings')
            .select('phone_e164, phone_verified')
            .eq('user_id', job.userId)
            .maybeSingle();
          if (settings?.phone_verified && settings.phone_e164) {
            const smsResult = await sendSms(settings.phone_e164, message.sms);
            if (smsResult.ok) delivered.push('sms');
            else console.error(`SMS dispatch failed for user ${job.userId}:`, smsResult);
          }
        }

        const sent = delivered.length > 0;
        await stampAll(sent, delivered, sent ? undefined : 'No channel delivered');

        notificationResults.push({
          profileId: job.items[0]?.profileId ?? job.userId,
          email,
          success: sent,
          error: sent ? undefined : 'No channel delivered',
        });
      } catch (notifyError) {
        const messageText =
          notifyError instanceof Error ? notifyError.message : 'Unknown error';
        console.error(`Error sending score digest for user ${job.userId}:`, notifyError);
        await stampAll(false, [], messageText);
        notificationResults.push({
          profileId: job.items[0]?.profileId ?? job.userId,
          email: 'unknown',
          success: false,
          error: messageText,
        });
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    const successfulNotifications = notificationResults.filter((r) => r.success).length;
    const failedNotifications = notificationResults.filter((r) => !r.success).length;

    const summary = {
      success: true,
      duration_ms: duration,
      profiles_processed: results.processed,
      alerts_triggered: results.triggered,
      alerts_skipped: results.skipped,
      errors: results.errors,
      notifications_sent: successfulNotifications,
      notifications_failed: failedNotifications,
      results: results.results,
      notification_results: notificationResults,
    };

    console.log('Alert evaluation complete:', {
      duration_ms: duration,
      processed: results.processed,
      triggered: results.triggered,
      notifications_sent: successfulNotifications,
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error in alert evaluation:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Allow GET for health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'alerts/evaluate',
    description: 'POST with CRON_SECRET to evaluate all active alert profiles',
  });
}
