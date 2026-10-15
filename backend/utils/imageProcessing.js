import sharp from "sharp";

// Every input is processed once and never again, so sharp's operation cache
// only costs memory on a small Render instance.
sharp.cache(false);

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "gif"]);

const FULL_MAX_EDGE = 1600;
const THUMB_MAX_EDGE = 400;
const PLACEHOLDER_MAX_EDGE = 16;

// Decompression-bomb guard: a tiny file can declare enormous dimensions. For
// animated input this counts every frame, so long GIFs are bounded too.
const MAX_INPUT_PIXELS = 50_000_000;

// Re-encoding an animated GIF can grow it. Refuse to store anything silly.
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

const PROCESSING_TIMEOUT_SECONDS = 15;

/** An upload that is the user's problem (wrong type, corrupt), not ours. */
export class ImageRejectedError extends Error {}

/**
 * Validates and re-encodes an uploaded image.
 *
 * The type is decided by libvips sniffing the actual bytes. The request's
 * Content-Type and the file name are attacker-controlled and are never
 * consulted.
 *
 * Every image is decoded and re-encoded, never stored as uploaded. That strips
 * EXIF — which on phone photos includes GPS coordinates — and destroys any
 * polyglot payload (an image that is also valid HTML or script), since only
 * pixels survive the round trip. See docs/V2-REDESIGN.md §6.2.
 */
export const processImage = async (input) => {
  let meta;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch (error) {
    throw new ImageRejectedError(
      /pixel limit/i.test(error.message)
        ? "That image's dimensions are too large"
        : "That file isn't a supported image"
    );
  }

  if (!ACCEPTED_FORMATS.has(meta.format)) {
    throw new ImageRejectedError("Only JPEG, PNG, WebP and GIF images are supported");
  }

  const animated = meta.format !== "jpeg" && (meta.pages ?? 1) > 1;

  const pipeline = (options = {}) => {
    const img = sharp(input, {
      animated: options.animated ?? animated,
      limitInputPixels: MAX_INPUT_PIXELS,
    }).timeout({ seconds: PROCESSING_TIMEOUT_SECONDS });
    // Apply the EXIF orientation to the pixels before the metadata is dropped,
    // or portrait phone photos arrive sideways. Animated formats carry no
    // orientation tag.
    return animated && options.animated !== false ? img : img.rotate();
  };

  const resizeInside = (edge) => ({
    width: edge,
    height: edge,
    fit: "inside",
    withoutEnlargement: true,
  });

  let full, thumb, placeholder;
  try {
    [full, thumb, placeholder] = await Promise.all([
      pipeline()
        .resize(resizeInside(FULL_MAX_EDGE))
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true }),
      pipeline()
        .resize(resizeInside(THUMB_MAX_EDGE))
        .webp({ quality: 75 })
        .toBuffer({ resolveWithObject: true }),
      // A ~16px still, inlined into the message as a data URI and shown
      // blurred while the thumbnail loads. Same idea as a blurhash, with no
      // client-side decoder needed.
      pipeline({ animated: false })
        .resize(resizeInside(PLACEHOLDER_MAX_EDGE))
        .webp({ quality: 40 })
        .toBuffer(),
    ]);
  } catch (error) {
    if (/pixel limit|timeout|corrupt|premature|bad|invalid/i.test(error.message)) {
      throw new ImageRejectedError("That image couldn't be processed");
    }
    throw error;
  }

  if (full.data.length > MAX_OUTPUT_BYTES) {
    throw new ImageRejectedError("That image is too large once processed");
  }

  // For animations, sharp reports the height of all frames stacked.
  const height = full.info.pageHeight ?? full.info.height;

  return {
    full: full.data,
    thumb: thumb.data,
    contentType: "image/webp",
    width: full.info.width,
    height,
    animated,
    placeholder: `data:image/webp;base64,${placeholder.toString("base64")}`,
  };
};

const AVATAR_EDGE = 256;

/**
 * Profile pictures: same checks and re-encode as message images (so EXIF and
 * GPS are stripped too), cropped to a 256px square, first frame only.
 */
export const processAvatar = async (input) => {
  let meta;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new ImageRejectedError("That file isn't a supported image");
  }
  if (!ACCEPTED_FORMATS.has(meta.format)) {
    throw new ImageRejectedError("Only JPEG, PNG, WebP and GIF images are supported");
  }
  try {
    return await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .timeout({ seconds: PROCESSING_TIMEOUT_SECONDS })
      .rotate()
      .resize(AVATAR_EDGE, AVATAR_EDGE, { fit: "cover", position: "attention" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new ImageRejectedError("That image couldn't be processed");
  }
};
