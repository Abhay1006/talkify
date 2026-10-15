import mongoose from "mongoose";

// Throws on failure. The caller decides what to do; the server should not
// start accepting requests that would only hang on a missing database.
const connectToMongoDB = async (uri = process.env.MONGO_DB_URI) => {
  if (!uri) throw new Error("MONGO_DB_URI is not set");
  await mongoose.connect(uri);
  console.log("connected to mongodb");
};

export default connectToMongoDB;
