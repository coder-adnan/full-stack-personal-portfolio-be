import { initializeApp, cert, getApps } from "firebase-admin/app";
import dotenv from "dotenv";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
const envFile =
  process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
// Load environment variables
dotenv.config({ path: envFile });

// console.log(process.env.FIREBASE_SERVICE_ACCOUNT);
// const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
const serviceAccount = JSON.parse(
  fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH!, "utf8")
);

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

export const adminAuth = getAuth();
