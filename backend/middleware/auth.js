import admin from "firebase-admin";

// Firebase Admin SDK — verifies Firebase ID tokens issued by the frontend.
// FIREBASE_SERVICE_ACCOUNT_JSON must be the full service account JSON as a single-line string.
// Project: advenza-7  (must match the projectId used in frontend/src/lib/firebase.ts)

let adminInitialized = false;

const initAdmin = () => {
  if (adminInitialized || admin.apps.length > 0) return;

  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      // Ensure newlines in the private key are real newlines, not escaped \n
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
      }
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log(`🔐 Firebase Admin initialized for project: ${serviceAccount.project_id}`);
    } else {
      // No service account — run in dev bypass mode (no token verification)
      console.warn(
        "⚠️  FIREBASE_SERVICE_ACCOUNT_JSON not set. Auth middleware will run in BYPASS mode.",
      );
      admin.initializeApp({ projectId: "advenza-7" });
    }
    adminInitialized = true;
  } catch (e) {
    console.error("Firebase Admin init error:", e.message);
  }
};

export const verifyToken = async (req, res, next) => {
  // If Firebase Admin isn't configured, allow requests through (dev mode)
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    req.uid = req.headers["x-user-id"] || "guest";
    return next();
  }

  initAdmin();
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided." });
  }

  const token = header.split("Bearer ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    // Log the exact Firebase error for easier debugging
    console.error("Token verification failed:", err.code, err.message);
    return res.status(403).json({ error: "Forbidden: Invalid or expired token." });
  }
};
