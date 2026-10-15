import { useState } from "react";
import { fitImage } from "../../utils/messageImage";

// The display size is known before the image loads, so the list never jumps
// when it arrives. Sizes go through the style prop (CSSOM), which the CSP's
// style-src does not govern.
const MessageImage = ({ src, srcSet, placeholder, width, height, alt, onClick, dimmed }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const { w, h } = fitImage(width, height);

  const clickable = onClick && !failed;
  const Wrapper = clickable ? "button" : "div";

  return (
    <Wrapper
      {...(clickable && {
        type: "button",
        onClick,
        "aria-label": alt ? `Open image: ${alt}` : "Open image",
      })}
      className={`msg-image${dimmed ? " is-dimmed" : ""}`}
      style={{ width: w, aspectRatio: `${w} / ${h}` }}
    >
      {placeholder && !loaded && !failed && (
        <img className="msg-image-fill is-placeholder" src={placeholder} alt="" aria-hidden="true" />
      )}
      {!failed && (
        <img
          className={`msg-image-fill${loaded ? " is-loaded" : " is-loading"}`}
          src={src}
          srcSet={srcSet}
          sizes={`${w}px`}
          alt={alt || "Image"}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
      {failed && <span className="msg-image-failed">image unavailable</span>}
    </Wrapper>
  );
};

export default MessageImage;
