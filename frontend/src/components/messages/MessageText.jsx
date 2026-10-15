import { Box, Link, Typography } from "@mui/material";

const URL_SPLIT = /(\bhttps?:\/\/[^\s<>"']+)/gi;
const TRAILING = /[.,;:!?)\]}'"]+$/;

// Message text with http(s) links made clickable. Built from text nodes and
// <a> elements, never innerHTML, so message content can't inject markup.
export const LinkifiedText = ({ text, fromMe }) => {
  const parts = text.split(URL_SPLIT);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        const url = part.replace(TRAILING, "");
        const trailing = part.slice(url.length);
        return (
          <span key={i}>
            <Link
              href={url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              sx={{ color: fromMe ? "white" : "primary.light", textDecorationColor: "currentColor", wordBreak: "break-all" }}
            >
              {url}
            </Link>
            {trailing}
          </span>
        );
      })}
    </>
  );
};

const clamp = (lines) => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
});

// Title/description card for a link. Text only; see backend/utils/linkPreview.js.
export const LinkPreviewCard = ({ preview, fromMe }) => {
  let host = "";
  try {
    host = new URL(preview.url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  return (
    <Box
      component="a"
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      sx={{
        display: "block",
        mt: 1,
        px: 1.5,
        py: 1,
        borderRadius: "10px",
        borderLeft: "3px solid",
        borderLeftColor: fromMe ? "rgba(255,255,255,0.7)" : "primary.main",
        bgcolor: fromMe ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.05)",
        color: "inherit",
        textDecoration: "none",
        maxWidth: 360,
        "&:hover": { bgcolor: fromMe ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.08)" },
      }}
    >
      <Typography variant="caption" sx={{ opacity: 0.75, display: "block" }}>{preview.siteName || host}</Typography>
      <Typography variant="body2" fontWeight={600} sx={{ ...clamp(2), lineHeight: 1.35 }}>{preview.title}</Typography>
      {preview.description && (
        <Typography variant="caption" sx={{ ...clamp(2), opacity: 0.85, mt: 0.25 }}>{preview.description}</Typography>
      )}
    </Box>
  );
};
