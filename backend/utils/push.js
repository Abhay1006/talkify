import webpush from "web-push";
import PushSubscription from "../models/pushSubscription.model.js";
import ConversationPref from "../models/conversationPref.model.js";

// Web Push for people who aren't connected: a message or a missed call
// reaches their phone or desktop through the browser's push service.
//
// Needs VAPID keys, set once and kept stable (rotating them invalidates every
// existing subscription). Generate with:  npx web-push generate-vapid-keys
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: or https: URL)
// Without them push is simply off and the rest of the app is unaffected.

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@talkify.invalid";

export const pushEnabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
export const vapidPublicKey = pushEnabled ? VAPID_PUBLIC_KEY : null;

if (pushEnabled) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else if (process.env.NODE_ENV !== "test") {
  console.warn("Push notifications are off: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to enable them.");
}

// The server POSTs to whatever endpoint a subscription names, so an
// unrestricted endpoint would be an SSRF hole. Only the real browser push
// services are accepted.
const PUSH_SERVICE_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/,
];

// Tests deliver to a local fake push service. Never honoured outside tests.
const testEndpointPrefix = process.env.NODE_ENV === "test" ? process.env.PUSH_TEST_ENDPOINT_PREFIX : null;

export const isAllowedEndpoint = (endpoint) => {
  if (typeof endpoint !== "string" || endpoint.length > 1024) return false;
  if (testEndpointPrefix && endpoint.startsWith(testEndpointPrefix)) return true;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.port && PUSH_SERVICE_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
};

const MAX_SUBSCRIPTIONS_PER_USER = 10;

export const saveSubscription = async (userId, { endpoint, keys }) => {
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { userId, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  // Keep the newest few; old browsers and reinstalled apps pile up otherwise.
  const extra = await PushSubscription.find({ userId })
    .sort({ updatedAt: -1 })
    .skip(MAX_SUBSCRIPTIONS_PER_USER)
    .select("_id");
  if (extra.length) await PushSubscription.deleteMany({ _id: { $in: extra.map((s) => s._id) } });
};

export const removeSubscription = (userId, endpoint) => PushSubscription.deleteOne({ userId, endpoint });

/**
 * Sends `payload` to every device of `userId`, unless they muted `fromUserId`.
 * Fire-and-forget: never throws, never delays the caller's response.
 */
export const notifyUser = async (userId, payload, { fromUserId } = {}) => {
  if (!pushEnabled) return;
  try {
    if (fromUserId) {
      const muted = await ConversationPref.exists({ userId, partnerId: fromUserId, muted: true });
      if (muted) return;
    }
    const subscriptions = await PushSubscription.find({ userId }).lean();
    const body = JSON.stringify(payload);
    await Promise.all(
      subscriptions.map((sub) =>
        webpush
          .sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body, { TTL: 60 * 60, urgency: payload.urgency ?? "normal" })
          .catch((error) => {
            // 404/410: the browser dropped this subscription. Forget it.
            if (error.statusCode === 404 || error.statusCode === 410) {
              return PushSubscription.deleteOne({ _id: sub._id });
            }
            console.warn("push failed", error.statusCode ?? error.message);
          })
      )
    );
  } catch (error) {
    console.error("Error sending push", error);
  }
};

/** The one-line summary a notification shows for a message. */
export const messagePreview = (message) => {
  if (message.voice) return "🎤 Voice message";
  if (message.image) return message.body ? `📷 ${message.body}` : "📷 Photo";
  const text = (message.body ?? "").replace(/\s+/g, " ").trim();
  return text.length > 100 ? `${text.slice(0, 99)}…` : text;
};
