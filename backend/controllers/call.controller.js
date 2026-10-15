// ICE servers for WebRTC. Served from config rather than hardcoded in the
// client so a TURN relay can be added later by setting ICE_SERVERS — no code
// change, no redeploy of the frontend. See docs/V2-REDESIGN.md §8.4.
//
// ICE_SERVERS is a JSON array of RTCIceServer objects, e.g.
//   [{"urls":"stun:stun.l.google.com:19302"},
//    {"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]

const DEFAULT_ICE_SERVERS = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

const loadIceServers = () => {
  if (!process.env.ICE_SERVERS) return DEFAULT_ICE_SERVERS;
  try {
    const parsed = JSON.parse(process.env.ICE_SERVERS);
    if (
      Array.isArray(parsed) &&
      parsed.every((s) => s && (typeof s.urls === "string" || Array.isArray(s.urls)))
    ) {
      return parsed;
    }
  } catch {
    // fall through
  }
  console.error("ICE_SERVERS is not a valid JSON array of ICE servers; using STUN defaults.");
  return DEFAULT_ICE_SERVERS;
};

const iceServers = loadIceServers();

export const getIceServers = (req, res) => {
  // TURN credentials, once configured, are for logged-in users only.
  res.set("Cache-Control", "private, max-age=300");
  res.status(200).json({ iceServers });
};
