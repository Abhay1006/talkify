import { useState } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import { ImageOutlined } from "@mui/icons-material";
import { fitImage } from "../../utils/messageImage";

const fill = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" };

const MessageImage = ({ src, srcSet, placeholder, width, height, alt, onClick, overlay }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const { w, h } = fitImage(width, height);

  const Wrapper = onClick && !failed ? ButtonBase : Box;

  return (
    <Wrapper
      {...(Wrapper === ButtonBase && { onClick, "aria-label": alt ? `Open image: ${alt}` : "Open image" })}
      sx={{
        position: "relative",
        display: "block",
        width: w,
        maxWidth: "100%",
        aspectRatio: `${w} / ${h}`,
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "rgba(255,255,255,0.05)",
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.light", outlineOffset: 2 },
      }}
    >
      {placeholder && !loaded && !failed && (
        <Box
          component="img"
          src={placeholder}
          alt=""
          aria-hidden
          sx={{ ...fill, filter: "blur(12px)", transform: "scale(1.15)" }}
        />
      )}
      {!failed && (
        <Box
          component="img"
          src={src}
          srcSet={srcSet}
          sizes={`${w}px`}
          alt={alt || "Image"}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          sx={{
            ...fill,
            opacity: loaded ? 1 : 0,
            transition: "opacity 200ms ease",
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          }}
        />
      )}
      {failed && (
        <Box
          sx={{
            ...fill,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.5,
            color: "text.secondary",
          }}
        >
          <ImageOutlined sx={{ fontSize: 24 }} />
          <Typography variant="caption">Image unavailable</Typography>
        </Box>
      )}
      {overlay}
    </Wrapper>
  );
};

export default MessageImage;
