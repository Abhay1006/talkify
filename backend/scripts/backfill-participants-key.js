/**
 * Conversations now carry a `participantsKey` with a unique index, which stops
 * two simultaneous first messages from creating two conversations for the same
 * pair. Conversations created before that have no key; the app adds it lazily
 * the next time each pair messages, but this script does all of them at once
 * and merges any duplicate conversations that already exist.
 *
 * Messages live in their own collection and are looked up by sender and
 * receiver, so deleting a duplicate conversation document loses nothing.
 *
 *   node backend/scripts/backfill-participants-key.js            (dry run)
 *   node backend/scripts/backfill-participants-key.js --apply
 */
import "dotenv/config";
import mongoose from "mongoose";
import Conversation, { participantsKeyFor } from "../models/conversation.model.js";

const apply = process.argv.includes("--apply");

const run = async () => {
  if (!process.env.MONGO_DB_URI) {
    console.error("MONGO_DB_URI is not set");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_DB_URI);

  const conversations = await Conversation.find({ participantsKey: { $exists: false } })
    .sort({ _id: 1 })
    .lean();

  // Keys assigned during this run, so a dry run counts duplicates correctly
  // even though it writes nothing.
  const assigned = new Set();
  let keyed = 0;
  let removed = 0;

  for (const conv of conversations) {
    if (conv.participants.length !== 2) {
      console.log(`skip     ${conv._id}: has ${conv.participants.length} participants`);
      continue;
    }

    const key = participantsKeyFor(...conv.participants);
    const keeper = await Conversation.findOne({ participantsKey: key }).select("_id").lean();

    if (keeper || assigned.has(key)) {
      // An older conversation for this pair already holds the key.
      removed += 1;
      if (apply) await Conversation.deleteOne({ _id: conv._id });
    } else {
      keyed += 1;
      assigned.add(key);
      if (apply) await Conversation.updateOne({ _id: conv._id }, { $set: { participantsKey: key } });
    }
  }

  console.log(
    `${apply ? "" : "[dry run] "}${keyed} conversation(s) keyed, ${removed} duplicate(s) removed`
  );
  if (!apply && keyed + removed > 0) console.log("Re-run with --apply (after a backup) to write.");

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
