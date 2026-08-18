/**
 * Phase 0 added unique indexes to ChatRequest { senderId, receiverId } and
 * BlockList { userId, blockedUserId }.
 *
 * If the database already contains duplicate rows, Mongoose's automatic index
 * build FAILS — and it fails on a background event handler, so the app keeps
 * serving happily while the index quietly does not exist. That would leave you
 * believing duplicates are impossible when they are not.
 *
 * Run this against production BEFORE deploying Phase 0:
 *
 *   node backend/scripts/check-index-preflight.js
 *   node backend/scripts/check-index-preflight.js --fix   (removes duplicates)
 */
import "dotenv/config";
import mongoose from "mongoose";

const fix = process.argv.includes("--fix");

const findDuplicates = async (collection, keys) => {
  const _id = Object.fromEntries(keys.map((k) => [k, `$${k}`]));
  return collection
    .aggregate([
      { $group: { _id, ids: { $push: "$_id" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();
};

const run = async () => {
  if (!process.env.MONGO_DB_URI) {
    console.error("MONGO_DB_URI is not set");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_DB_URI);
  const db = mongoose.connection.db;
  console.log(`database: ${db.databaseName}\n`);

  const targets = [
    { name: "chatrequests", keys: ["senderId", "receiverId"] },
    { name: "blocklists", keys: ["userId", "blockedUserId"] },
  ];

  let blocking = 0;

  for (const { name, keys } of targets) {
    const collection = db.collection(name);
    const duplicates = await findDuplicates(collection, keys);

    if (duplicates.length === 0) {
      console.log(`OK       ${name}: no duplicates on { ${keys.join(", ")} }`);
      continue;
    }

    const extras = duplicates.reduce((n, d) => n + d.count - 1, 0);
    console.log(`CONFLICT ${name}: ${duplicates.length} duplicated key(s), ${extras} extra row(s)`);

    if (!fix) {
      blocking += extras;
      continue;
    }

    // Keep the oldest row of each duplicate set and drop the rest.
    const toDelete = duplicates.flatMap((d) =>
      d.ids.sort((a, b) => a.getTimestamp() - b.getTimestamp()).slice(1)
    );
    const res = await collection.deleteMany({ _id: { $in: toDelete } });
    console.log(`         removed ${res.deletedCount} duplicate row(s)`);
  }

  if (blocking > 0) {
    console.log(
      `\n${blocking} duplicate row(s) would block the unique index build.` +
        `\nRe-run with --fix (after a backup) to remove them.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log("\nSafe to deploy: unique indexes will build cleanly.");
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
