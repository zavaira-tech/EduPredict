import mongoose from "mongoose";

let connectionPromise;

export async function connectToDatabase(uri) {
  if (!uri) {
    throw new Error("MONGODB_URI is required.");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 10000 })
      .catch((error) => {
        connectionPromise = undefined;
        throw error;
      });
  }

  await connectionPromise;
  return mongoose.connection;
}

export default mongoose;
