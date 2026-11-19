import admin from "firebase-admin";

// Firebase Admin SDK — verifies Firebase ID tokens issued by the frontend.
// FIREBASE_SERVICE_ACCOUNT_JSON must be the full service account JSON as a single-line string.
// Project: advenzaa7 (must match the projectId used in frontend/src/lib/firebase.ts)

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
      if (process.env.NODE_ENV === "production") {
        throw new Error("FATAL: FIREBASE_SERVICE_ACCOUNT_JSON is required in production environment.");
      }
      // No service account — run in dev bypass mode (no token verification)
      console.warn(
        "⚠️  FIREBASE_SERVICE_ACCOUNT_JSON not set. Auth middleware will run in gated DEV BYPASS mode.",
      );
      admin.initializeApp({ projectId: "advenzaa7" });
    }
    adminInitialized = true;
  } catch (e) {
    console.error("Firebase Admin init error:", e.message);
    if (process.env.NODE_ENV === "production") {
      throw e;
    }
  }
};

export const verifyToken = async (req, res, next) => {
  // Production security gate: Never permit development bypass in production
  if (process.env.NODE_ENV === "production" && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return res.status(500).json({
      error: "Authentication service misconfiguration: Firebase service account required in production.",
    });
  }

  // Development-only bypass: explicitly gated to non-production environments when service account is absent
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const isDevEnv = process.env.NODE_ENV !== "production";
    const isDevBypassAllowed = process.env.DEV_AUTH_BYPASS === "true" || isDevEnv;

    if (isDevBypassAllowed) {
      req.uid = req.headers["x-user-id"] || "dev-guest";
      req.userEmail = req.headers["x-user-email"] ? req.headers["x-user-email"].toLowerCase().trim() : "dev@advenza.travel";
      req.isDevBypass = true;
      return next();
    }
    return res.status(401).json({ error: "Unauthorized: Valid authentication credentials required." });
  }

  initAdmin();
  const header = req.headers.authorization;

  // Strict Token Enforcement: No unauthenticated header bypass when authentication provider is configured
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided." });
  }

  const token = header.split("Bearer ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    // Identity comes EXCLUSIVELY from the cryptographically verified token
    req.uid = decoded.uid;
    req.user = decoded;
    req.userEmail = (decoded.email || "").toLowerCase().trim();
    req.isDevBypass = false;
    next();
  } catch (err) {
    // Log verification failure server-side without falling back to arbitrary headers
    console.error("Token verification failed:", err.code, err.message);
    return res.status(403).json({ error: "Forbidden: Invalid or expired token." });
  }
};
