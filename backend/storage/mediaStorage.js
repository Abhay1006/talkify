import mongoose from "mongoose";

// Storage adapter for uploaded media. Everything outside this file talks to
// three functions only — putObject / getObject / deleteObject — so moving from
// GridFS to Cloudinary (or S3) later means writing one new implementation of
// this interface, and no calling code changes. See docs/V2-REDESIGN.md §13,
// Decision 2.
//
// GridFS is used first because Render's local disk is ephemeral: every deploy
// would delete every image ever sent.

const BUCKET_NAME = "media";

let bucket = null;

const getBucket = () => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("Media storage unavailable: database is not connected");
  }
  if (!bucket || bucket.s?.db !== mongoose.connection.db) {
    bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: BUCKET_NAME,
    });
  }
  return bucket;
};

const toObjectId = (id) =>
  mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;

/**
 * Stores `buffer` and resolves to the new object's id (string).
 * `metadata` is stored alongside and handed back by getObject, which is how
 * the media route decides who may read the object.
 */
export const putObject = (buffer, { contentType, metadata = {} }) =>
  new Promise((resolve, reject) => {
    const upload = getBucket().openUploadStream("media", {
      metadata: { ...metadata, contentType },
    });
    upload.once("finish", () => resolve(upload.id.toString()));
    upload.once("error", reject);
    upload.end(buffer);
  });

/**
 * Resolves to null when the object does not exist. The bytes are not read
 * until openStream() is called, so callers can authorize first.
 */
export const getObject = async (id) => {
  const _id = toObjectId(id);
  if (!_id) return null;

  const [file] = await getBucket().find({ _id }).limit(1).toArray();
  if (!file) return null;

  return {
    id: file._id.toString(),
    length: file.length,
    contentType: file.metadata?.contentType ?? "application/octet-stream",
    metadata: file.metadata ?? {},
    // { start, end } (end exclusive) streams just that byte range.
    openStream: (range) => getBucket().openDownloadStream(_id, range),
  };
};

/** Deletes the object. Deleting one that is already gone is not an error. */
export const deleteObject = async (id) => {
  const _id = toObjectId(id);
  if (!_id) return;
  try {
    await getBucket().delete(_id);
  } catch (error) {
    if (!/FileNotFound|File not found/i.test(error.message)) throw error;
  }
};

export default { putObject, getObject, deleteObject };
