import { mediaUrl } from './prepareImage';

const MAX_WIDTH = 280;
const MAX_HEIGHT = 320;
const MIN_EDGE = 96;
const THUMB_EDGE = 400;

// Display size inside the bubble. Known before the image loads, so the
// message list never jumps when it arrives.
export const fitImage = (width, height) => {
  const scale = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height);
  return {
    w: Math.max(MIN_EDGE, Math.round(width * scale)),
    h: Math.max(MIN_EDGE, Math.round(height * scale)),
  };
};

// Thumbnail for normal screens, full size where the display is dense enough
// to need it. The browser picks.
export const imageSrcSet = (image) => {
  const scale = Math.min(1, THUMB_EDGE / Math.max(image.width, image.height));
  if (scale === 1) return undefined;
  const thumbWidth = Math.round(image.width * scale);
  return `${mediaUrl(image.thumbId)} ${thumbWidth}w, ${mediaUrl(image.fullId)} ${image.width}w`;
};

// Resolves once the browser has the same image a message bubble would show,
// or after a timeout. Never rejects.
export const preloadMessageImage = (image, timeoutMs = 3000) =>
  new Promise((resolve) => {
    const img = new Image();
    const srcSet = imageSrcSet(image);
    if (srcSet) {
      img.sizes = `${fitImage(image.width, image.height).w}px`;
      img.srcset = srcSet;
    }
    img.src = mediaUrl(image.thumbId);
    const timer = setTimeout(resolve, timeoutMs);
    img.decode().catch(() => {}).finally(() => {
      clearTimeout(timer);
      resolve();
    });
  });
