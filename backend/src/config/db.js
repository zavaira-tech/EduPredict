import dns from "node:dns";
import mongoose from "mongoose";

// Ensure Node's DNS resolver on Windows can query MongoDB Atlas SRV records
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Ignore in environments where setting DNS servers is not permitted
}

let connectionPromise;

export const connectDB = async (customUri) => {
  const uri = customUri || process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required.");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 10000,
      })
      .then((conn) => {
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn.connection;
      })
      .catch((error) => {
        connectionPromise = undefined;
        console.error("MongoDB Connection Error:", error.message);
        throw error;
      });
  }

  await connectionPromise;
  return mongoose.connection;
};

export const connectToDatabase = connectDB;
export default connectDB;
