import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabaseUrl = requireSecret("SUPABASE_URL");
const serviceRoleKey = requireSecret("SUPABASE_SERVICE_ROLE_KEY");
const vapidPublicKey = requireSecret("VAPID_PUBLIC_KEY");
const vapidPrivateKey = requireSecret("VAPID_PRIVATE_KEY");
const vapidSubject = requireSecret("VAPID_SUBJECT");

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const now = Date.now();
  const windowStart = new Date(now - 65_000).toISOString();
  const windowEnd = new Date(now + 5_000).toISOString();

  const { data: records, error: recordsError } = await supabase
    .from("xiaoji_sync_records")
    .select("user_id,record_id,payload")
    .eq("record_type", "item")
    .is("deleted_at", null)
    .eq("payload->>reminderEnabled", "true")
    .eq("payload->>completed", "false")
    .gte("payload->>reminderAt", windowStart)
    .lt("payload->>reminderAt", windowEnd);

  if (recordsError) {
    console.error("Failed to query reminders", recordsError);
    return Response.json({ error: "Failed to query reminders" }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const record of records || []) {
    const reminderAt = asString(record.payload?.reminderAt);
    if (!reminderAt) {
      skipped += 1;
      continue;
    }

    const { error: claimError } = await supabase.from("xiaoji_reminder_deliveries").insert({
      user_id: record.user_id,
      item_id: record.record_id,
      reminder_at: reminderAt
    });
    if (claimError?.code === "23505") {
      skipped += 1;
      continue;
    }
    if (claimError) {
      console.error("Failed to claim reminder", claimError);
      failed += 1;
      continue;
    }

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("xiaoji_push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("user_id", record.user_id);

    if (subscriptionsError) {
      console.error("Failed to query subscriptions", subscriptionsError);
      await releaseClaim(record.user_id, record.record_id, reminderAt);
      failed += 1;
      continue;
    }

    let delivered = false;
    for (const subscription of subscriptions || []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth
            }
          },
          JSON.stringify({
            title: "冰小记提醒",
            body: `${asString(record.payload?.title) || "事项"}将在 5 分钟后开始`,
            itemId: record.record_id,
            date: asString(record.payload?.date)
          }),
          { TTL: 60, urgency: "high" }
        );
        delivered = true;
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number }).statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("xiaoji_push_subscriptions")
            .delete()
            .eq("user_id", record.user_id)
            .eq("endpoint", subscription.endpoint);
        } else {
          console.error("Push delivery failed", error);
        }
      }
    }

    if (delivered) {
      await supabase
        .from("xiaoji_reminder_deliveries")
        .update({ sent_at: new Date().toISOString() })
        .eq("user_id", record.user_id)
        .eq("item_id", record.record_id)
        .eq("reminder_at", reminderAt);
      sent += 1;
    } else {
      await releaseClaim(record.user_id, record.record_id, reminderAt);
      failed += 1;
    }
  }

  return Response.json({ checked: records?.length || 0, sent, skipped, failed });
});

async function releaseClaim(userId: string, itemId: string, reminderAt: string) {
  await supabase
    .from("xiaoji_reminder_deliveries")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("reminder_at", reminderAt);
}

function requireSecret(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}
