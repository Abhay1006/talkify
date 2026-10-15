// Client-side half of the image pipeline (docs/V2-REDESIGN.md §6.1). Photos
// are downscaled and re-encoded before upload, so a typical 4 MB phone photo
// goes up as ~300 KB and the 2 MB server limit is a backstop users rarely hit.

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const MAX_EDGE = 1600;
const WEBP_QUALITY = 0.82;

export class ImagePrepError extends Error {}

const toBlob = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

const decode = async (file) => {
  try {
    // 'from-image' applies EXIF orientation, so portrait photos stay portrait.
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImagePrepError("That image couldn't be read");
  }
};

/**
 * Resolves to { blob, width, height } ready for upload, or throws an
 * ImagePrepError with a message fit to show the user.
 */
export const prepareImage = async (file) => {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new ImagePrepError('Only JPEG, PNG, WebP and GIF images are supported');
  }

  const bitmap = await decode(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  // A canvas would flatten a GIF to its first frame, so GIFs go up as-is and
  // the server resizes them with the animation intact.
  if (file.type === 'image/gif') {
    bitmap.close?.();
    if (file.size > MAX_IMAGE_BYTES) {
      throw new ImagePrepError('GIFs must be 2 MB or smaller');
    }
    return { blob: file, width, height };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let blob = await toBlob(canvas, 'image/webp', WEBP_QUALITY);
  // Older Safari cannot encode WebP and silently hands back a PNG instead.
  // Fall back to JPEG, or PNG where transparency would otherwise turn black.
  if (!blob || blob.type !== 'image/webp') {
    blob = file.type === 'image/png'
      ? await toBlob(canvas, 'image/png')
      : await toBlob(canvas, 'image/jpeg', 0.85);
  }

  // Already small and re-encoding didn't help: send the original.
  if (scale === 1 && (!blob || file.size <= blob.size)) {
    blob = file;
  }

  if (blob.size > MAX_IMAGE_BYTES) {
    throw new ImagePrepError('That image is over 2 MB, even after resizing');
  }

  return { blob, width, height };
};

export const formatBytes = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export const mediaUrl = (id) => `/api/media/${id}`;
