import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Only initialize if not already initialized (for hot reload/dev)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: "YOUR_PROJECT_ID",
      clientEmail: "YOUR_CLIENT_EMAIL",
      privateKey: "YOUR_PRIVATE_KEY".replace(/\\n/g, "\n"),
    }),
  });
}

export const adminAuth = getAuth();
