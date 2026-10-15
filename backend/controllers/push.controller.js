import { pushEnabled, vapidPublicKey, isAllowedEndpoint, saveSubscription, removeSubscription } from "../utils/push.js";

export const getPushConfig = (req, res) => {
  res.status(200).json({ enabled: pushEnabled, publicKey: vapidPublicKey });
};

export const subscribe = async (req, res) => {
  try {
    if (!pushEnabled) return res.status(503).json({ error: "Push notifications aren't configured on this server" });
    const { endpoint, keys } = req.body?.subscription ?? {};
    if (!isAllowedEndpoint(endpoint)) return res.status(400).json({ error: "Unsupported push service" });
    if (typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string" || keys.p256dh.length > 256 || keys.auth.length > 64) {
      return res.status(400).json({ error: "Invalid subscription" });
    }
    await saveSubscription(req.user._id, { endpoint, keys });
    res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Error in push subscribe", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const unsubscribe = async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (typeof endpoint === "string") await removeSubscription(req.user._id, endpoint);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Error in push unsubscribe", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
