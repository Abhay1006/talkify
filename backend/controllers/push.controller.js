import { HttpError, badRequest } from "../utils/httpError.js";
import {
  pushEnabled,
  vapidPublicKey,
  isAllowedEndpoint,
  saveSubscription,
  removeSubscription,
} from "../utils/push.js";

export const getPushConfig = (req, res) => {
  res.status(200).json({ enabled: pushEnabled, publicKey: vapidPublicKey });
};

export const subscribe = async (req, res) => {
  if (!pushEnabled) throw new HttpError(503, "Push notifications aren't configured on this server");
  const { endpoint, keys } = req.body?.subscription ?? {};
  if (!isAllowedEndpoint(endpoint)) throw badRequest("Unsupported push service");
  if (
    typeof keys?.p256dh !== "string" ||
    typeof keys?.auth !== "string" ||
    keys.p256dh.length > 256 ||
    keys.auth.length > 64
  ) {
    throw badRequest("Invalid subscription");
  }
  await saveSubscription(req.user._id, { endpoint, keys });
  res.status(201).json({ ok: true });
};

export const unsubscribe = async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (typeof endpoint === "string") await removeSubscription(req.user._id, endpoint);
  res.status(200).json({ ok: true });
};
