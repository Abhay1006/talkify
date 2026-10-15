import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useAuthContext } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { apiClient } from "../../api/client";
import usePushNotifications from "../../hooks/usePushNotifications";
import { usePwaStore, promptInstall } from "../../pwa";
import { ACCEPTED_IMAGE_TYPES, prepareImage, ImagePrepError } from "../../utils/prepareImage";
import Dialog from "../ui/Dialog";

const MAX_NAME = 50;
const MAX_BIO = 160;

// Opening this link (or scanning its QR code) takes someone straight to a
// chat with you. See useDeepLinks.
const profileLink = (username) => `${window.location.origin}/?add=${encodeURIComponent(username)}`;

const ProfileDialog = ({ open, onClose }) => {
  const { authUser, updateAuthUser } = useAuthContext();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(authUser.fullName);
  const [bio, setBio] = useState(authUser.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [qr, setQr] = useState(null);
  const fileRef = useRef(null);
  const push = usePushNotifications();
  const installEvent = usePwaStore((s) => s.installEvent);

  const link = profileLink(authUser.username);

  useEffect(() => {
    if (!open) return;
    setFullName(authUser.fullName);
    // Bio isn't in the login response; fetch the full profile once. (There is
    // no GET /api/users/me; the current profile lives at /api/auth/me.)
    apiClient
      .get("/api/auth/me")
      .then((me) => {
        setBio(me.bio ?? "");
        updateAuthUser({ bio: me.bio ?? "", profilePic: me.profilePic, fullName: me.fullName });
      })
      .catch(() => {});
    // Always dark-on-white: scanners need the contrast whatever the theme.
    QRCode.toDataURL(link, { margin: 1, width: 240, color: { dark: "#1a1a1a", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = fullName.trim() !== authUser.fullName || bio.trim() !== (authUser.bio ?? "");

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const me = await apiClient.put("/api/users/me", { fullName: fullName.trim(), bio: bio.trim() });
      updateAuthUser({ fullName: me.fullName, bio: me.bio });
      toast("Profile updated", "success");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const changeAvatar = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      // Shrinks big phone photos before upload; the server crops to a square.
      const { blob } = await prepareImage(file);
      const form = new FormData();
      form.append("image", blob, "avatar");
      const me = await apiClient.upload("/api/users/me/avatar", form);
      updateAuthUser({ profilePic: me.profilePic });
      toast("Profile picture updated", "success");
    } catch (error) {
      toast(error instanceof ImagePrepError ? error.message : error.message || "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast("Link copied", "success");
    } catch {
      toast("Couldn't copy. Select the link and copy it manually.", "warning");
    }
  };

  const togglePush = async () => {
    if (push.subscribed) {
      await push.disable();
    } else if (!(await push.enable())) {
      toast("Notifications weren't enabled", "warning");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} label="Your profile" className="profile">
      <div className="dialog-head">
        <span className="dialog-title">Profile</span>
        <button type="button" className="btn-link" onClick={onClose}>
          close
        </button>
      </div>

      <section className="dialog-section">
        <div className="profile-who">
          {/* The one place your own photo appears; it is what others see in
              notifications. */}
          {authUser.profilePic && <img className="profile-pic" src={authUser.profilePic} alt="" />}
          <div>
            <div className="profile-username">{authUser.username}</div>
            <button
              type="button"
              className="btn-link"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "uploading…" : "change photo"}
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              onChange={(e) => {
                changeAvatar(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </section>

      <form className="dialog-section" onSubmit={save}>
        <div className="dialog-section-title">About you</div>
        <div className="field">
          <label htmlFor="profile-name">Display name</label>
          <input
            id="profile-name"
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value.slice(0, MAX_NAME))}
            autoComplete="name"
          />
        </div>
        <div className="field">
          <label htmlFor="profile-bio">
            Bio{" "}
            <span className="text-faint">
              {bio.length}/{MAX_BIO}
            </span>
          </label>
          <textarea
            id="profile-bio"
            className="input"
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO))}
          />
        </div>
        <div className="dialog-actions">
          <button type="submit" className="btn btn-primary" disabled={!dirty || saving || !fullName.trim()}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      <section className="dialog-section">
        <div className="dialog-section-title">Share your profile</div>
        <div className="profile-share">
          {qr ? (
            <img className="profile-qr" src={qr} alt={`QR code linking to ${authUser.username}`} />
          ) : (
            <span className="profile-qr" />
          )}
          <div>
            <p className="text-muted">Anyone who scans this or opens the link can start a chat with you.</p>
            <div className="dialog-links">
              <button type="button" className="btn-link" onClick={copyLink}>
                copy link
              </button>
              {qr && (
                <a href={qr} download={`talkify-${authUser.username}.png`}>
                  save QR
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="dialog-section">
        <div className="dialog-section-title">This device</div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={push.subscribed}
            onChange={togglePush}
            disabled={!push.available || push.loading}
          />
          <span>
            Notifications
            <span className="check-row-help">
              {push.reason ?? "Messages and missed calls when talkify is closed."}
            </span>
          </span>
        </label>
        {installEvent && (
          <button type="button" className="btn" onClick={promptInstall}>
            Install talkify as an app
          </button>
        )}
      </section>
    </Dialog>
  );
};

export default ProfileDialog;
