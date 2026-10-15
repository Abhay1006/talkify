import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useSnackbar } from "notistack";
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  Divider,
  IconButton,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { PhotoCameraOutlined, ContentCopyOutlined, FileDownloadOutlined, Close } from "@mui/icons-material";
import { useAuthContext } from "../../context/AuthContext";
import { apiClient } from "../../api/client";
import usePushNotifications from "../../hooks/usePushNotifications";
import { usePwaStore, promptInstall } from "../../pwa";
import { ACCEPTED_IMAGE_TYPES, prepareImage, ImagePrepError } from "../../utils/prepareImage";

const MAX_NAME = 50;
const MAX_BIO = 160;

// Opening this link (or scanning its QR code) takes someone straight to a
// chat with you. See useDeepLinks.
const profileLink = (username) => `${window.location.origin}/?add=${encodeURIComponent(username)}`;

const Section = ({ title, children }) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, lineHeight: 1.5 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

const ProfileDialog = ({ open, onClose }) => {
  const { authUser, updateAuthUser } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
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
    // Bio isn't in the login response; fetch the full profile once.
    apiClient
      .get("/api/users/me")
      .then((me) => {
        setBio(me.bio ?? "");
        updateAuthUser({ bio: me.bio ?? "", profilePic: me.profilePic, fullName: me.fullName });
      })
      .catch(() => {});
    QRCode.toDataURL(link, { margin: 1, width: 240, color: { dark: "#0B0E1A", light: "#FFFFFF" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = fullName.trim() !== authUser.fullName || bio.trim() !== (authUser.bio ?? "");

  const save = async () => {
    setSaving(true);
    try {
      const me = await apiClient.put("/api/users/me", { fullName: fullName.trim(), bio: bio.trim() });
      updateAuthUser({ fullName: me.fullName, bio: me.bio });
      enqueueSnackbar("Profile updated", { variant: "success" });
    } catch (error) {
      enqueueSnackbar(error.message, { variant: "error" });
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
      enqueueSnackbar("Profile picture updated", { variant: "success" });
    } catch (error) {
      enqueueSnackbar(error instanceof ImagePrepError ? error.message : error.message || "Upload failed", {
        variant: "error",
      });
    } finally {
      setUploading(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      enqueueSnackbar("Link copied", { variant: "success" });
    } catch {
      enqueueSnackbar("Couldn't copy. Select the link and copy it manually.", { variant: "warning" });
    }
  };

  const togglePush = async () => {
    if (push.subscribed) {
      await push.disable();
    } else if (!(await push.enable())) {
      enqueueSnackbar("Notifications weren't enabled", { variant: "warning" });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{
        paper: {
          "aria-label": "Your profile",
          sx: {
            bgcolor: "#12152a",
            backdropFilter: "none",
            backgroundImage: "none",
            borderRadius: "20px",
            m: { xs: 1.5, sm: 4 },
            width: { xs: "calc(100% - 24px)", sm: "100%" },
          },
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", px: 3, pt: 2.5, pb: 1 }}>
        <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>
          Your profile
        </Typography>
        <IconButton onClick={onClose} aria-label="Close" sx={{ width: 40, height: 40 }}>
          <Close />
        </IconButton>
      </Box>

      <Box sx={{ px: 3, pb: 3, display: "flex", flexDirection: "column", gap: 3 }}>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <Box sx={{ position: "relative" }}>
            <Avatar src={authUser.profilePic} sx={{ width: 96, height: 96 }} />
            <IconButton
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Change profile picture"
              sx={{
                position: "absolute",
                right: -4,
                bottom: -4,
                bgcolor: "primary.main",
                color: "white",
                width: 36,
                height: 36,
                "&:hover": { bgcolor: "primary.dark" },
              }}
            >
              {uploading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <PhotoCameraOutlined sx={{ fontSize: 18 }} />
              )}
            </IconButton>
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
          </Box>
          <Typography variant="body2" color="text.secondary">
            @{authUser.username}
          </Typography>
        </Box>

        <Section title="About you">
          <TextField
            label="Display name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value.slice(0, MAX_NAME))}
            size="small"
            fullWidth
          />
          <TextField
            label="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO))}
            size="small"
            fullWidth
            multiline
            minRows={2}
            helperText={`${bio.length}/${MAX_BIO}`}
          />
          <Button
            variant="contained"
            onClick={save}
            disabled={!dirty || saving || !fullName.trim()}
            sx={{ alignSelf: "flex-end", py: 0.75 }}
          >
            {saving ? <CircularProgress size={18} color="inherit" /> : "Save"}
          </Button>
        </Section>

        <Divider />

        <Section title="Share your profile">
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <Box
              sx={{
                width: 120,
                height: 120,
                flexShrink: 0,
                borderRadius: "12px",
                overflow: "hidden",
                bgcolor: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {qr ? (
                <Box
                  component="img"
                  src={qr}
                  alt={`QR code linking to @${authUser.username}`}
                  sx={{ width: "100%", height: "100%" }}
                />
              ) : (
                <CircularProgress size={20} />
              )}
            </Box>
            <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Anyone who scans this or opens the link can start a chat with you.
              </Typography>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyOutlined />}
                  onClick={copyLink}
                  sx={{ py: 0.5, px: 1.5, background: "none" }}
                >
                  Copy link
                </Button>
                {qr && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FileDownloadOutlined />}
                    component="a"
                    href={qr}
                    download={`talkify-${authUser.username}.png`}
                    sx={{ py: 0.5, px: 1.5, background: "none" }}
                  >
                    Save QR
                  </Button>
                )}
              </Box>
            </Box>
          </Box>
        </Section>

        <Divider />

        <Section title="This device">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={500}>
                Notifications
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {push.reason ?? "Messages and missed calls when Talkify is closed."}
              </Typography>
            </Box>
            {push.loading ? (
              <CircularProgress size={20} />
            ) : (
              <Switch
                checked={push.subscribed}
                onChange={togglePush}
                disabled={!push.available}
                slotProps={{ input: { "aria-label": "Notifications on this device" } }}
              />
            )}
          </Box>
          {installEvent && (
            <Button variant="outlined" onClick={promptInstall} sx={{ background: "none", py: 0.75 }}>
              Install Talkify as an app
            </Button>
          )}
        </Section>
      </Box>
    </Dialog>
  );
};

export default ProfileDialog;
