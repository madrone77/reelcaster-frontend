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
import { generateScoreAlertMessage } from '@/lib/email-templates/score-alert';
import { smsCarriesBeat } from '@/lib/alert-channels';
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

        // Score alerts are delivered from `sendJobs` below: they are about a
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

    // Score-alert delivery.
    //
    // Every job here has already been claimed in `alert_day_notices`, so the
    // send is allowed to fail: the claim is what guarantees we never say the
    // same thing about the same day twice, and a message lost to a bad SMTP
    // response is a better outcome than a duplicate.
    for (const job of results.sendJobs) {
      try {
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('user_alert_profiles')
          .select('*')
          .eq('id', job.profileId)
          .single();

        if (profileError || !profile) {
          console.error(`Failed to fetch profile ${job.profileId}:`, profileError);
          await markBeatSent(job.noticeId, false, [], 'Profile lookup failed');
          continue;
        }

        const email = await getUserEmail(profile.user_id);
        if (!email) {
          console.error(`No email found for user ${profile.user_id}`);
          await markBeatSent(job.noticeId, false, [], 'No email on account');
          continue;
        }

        // Name the species we actually scored, which is not always the one on
        // the alert when the mapping has drifted.
        const speciesSlug = job.scoredSpeciesSlug ?? profile.target_species ?? null;
        const speciesName = speciesSlug
          ? speciesSlug
              .split('-')
              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')
          : null;

        const appBase = process.env.NEXT_PUBLIC_APP_URL || 'https://reelcaster.com';
        const message = generateScoreAlertMessage({
          beat: job.beat,
          spotName: profile.location_name || profile.target_bluecaster_spot_slug || 'your spot',
          speciesName,
          speciesMatched: job.speciesMatched,
          targetDate: job.targetDate,
          leadDays: job.leadDays,
          score: job.score,
          threshold: profile.score_threshold ?? 75,
          forecastUrl: `${appBase}/explore/spot/${profile.target_bluecaster_spot_slug}`,
          manageAlertsUrl: `${appBase}/alerts`,
        });

        const channels: string[] = profile.delivery_channels ?? ['email'];
        const delivered: string[] = [];

        if (channels.includes('email')) {
          const sendResult = await sendEmail({
            to: email,
            subject: message.subject,
            html: message.html,
          });
          if (sendResult.success) delivered.push('email');
          else console.error(`Email dispatch failed for ${job.profileId}:`, sendResult.error);
        }

        // SMS skips the heads-up for anyone who also gets email, and carries it
        // for anyone who does not. See lib/alert-channels.ts.
        if (smsCarriesBeat(job.beat, channels) && isTwilioConfigured()) {
          const { data: settings } = await supabaseAdmin
            .from('user_settings')
            .select('phone_e164, phone_verified')
            .eq('user_id', profile.user_id)
            .maybeSingle();
          if (settings?.phone_verified && settings.phone_e164) {
            const smsResult = await sendSms(settings.phone_e164, message.sms);
            if (smsResult.ok) delivered.push('sms');
            else console.error(`SMS dispatch failed for ${job.profileId}:`, smsResult);
          }
        }

        const sent = delivered.length > 0;
        await markBeatSent(
          job.noticeId,
          sent,
          delivered,
          sent ? undefined : 'No channel delivered',
        );

        notificationResults.push({
          profileId: job.profileId,
          email,
          success: sent,
          error: sent ? undefined : 'No channel delivered',
        });
      } catch (notifyError) {
        const messageText =
          notifyError instanceof Error ? notifyError.message : 'Unknown error';
        console.error(`Error sending score alert for ${job.profileId}:`, notifyError);
        await markBeatSent(job.noticeId, false, [], messageText);
        notificationResults.push({
          profileId: job.profileId,
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
