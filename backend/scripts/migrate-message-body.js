/**
 * Renames Message.ciphertext -> Message.body and drops the unused `iv` and
 * `senderPublicKey` fields. See docs/V2-REDESIGN.md §3.2 for why those fields
 * were misleading.
 *
 * Idempotent: only touches documents that still have `ciphertext` and no
 * `body`, so re-running it is a no-op.
 *
 *   node backend/scripts/migrate-message-body.js --dry-run
 *   node backend/scripts/migrate-message-body.js
 *
 * Take a database backup before running without --dry-run.
 */
import "dotenv/config";
import mongoose from "mongoose";

const dryRun = process.argv.includes("--dry-run");

const run = async () => {
  if (!process.env.MONGO_DB_URI) {
    console.error("MONGO_DB_URI is not set");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_DB_URI);
  const messages = mongoose.connection.collection("messages");

  const total = await messages.countDocuments();
  const needsRename = await messages.countDocuments({
    ciphertext: { $exists: true },
    body: { $exists: false },
  });
  const hasDeadFields = await messages.countDocuments({
    $or: [{ iv: { $exists: true } }, { senderPublicKey: { $exists: true } }],
  });

  console.log(`messages total:        ${total}`);
  console.log(`needing ciphertext->body: ${needsRename}`);
  console.log(`with iv/senderPublicKey:  ${hasDeadFields}`);

  if (dryRun) {
    console.log("\n--dry-run: no changes written.");
    await mongoose.disconnect();
    return;
  }

  const renamed = await messages.updateMany(
    { ciphertext: { $exists: true }, body: { $exists: false } },
    { $rename: { ciphertext: "body" } }
  );
  console.log(`\nrenamed: ${renamed.modifiedCount}`);

  const cleaned = await messages.updateMany(
    { $or: [{ iv: { $exists: true } }, { senderPublicKey: { $exists: true } }] },
    { $unset: { iv: "", senderPublicKey: "" } }
  );
  console.log(`cleaned: ${cleaned.modifiedCount}`);

  const orphaned = await messages.countDocuments({ body: { $exists: false } });
  if (orphaned > 0) {
    console.warn(`\nWARNING: ${orphaned} message(s) still have no body field.`);
  } else {
    console.log("\nAll messages have a body field.");
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
