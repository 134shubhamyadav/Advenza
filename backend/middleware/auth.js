import admin from 'firebase-admin';

// Initialize Firebase Admin with project credentials
// NOTE FOR DEVELOPER: You need to set FIREBASE_SERVICE_ACCOUNT_JSON in backend/.env
// Get it from: Firebase Console → Project Settings → Service Accounts → Generate new private key
// Then copy the entire JSON file content as a one-line JSON string into the env variable.

let adminInitialized = false;

const initAdmin = () => {
  if (adminInitialized || admin.apps.length > 0) return;
  
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
      // Fallback: initialize with application default credentials or skip
      // This allows the server to run without auth enforcement during local dev
      console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT_JSON not set. Auth middleware will run in BYPASS mode.');
      admin.initializeApp({ projectId: 'aventra-2fd33' });
    }
    adminInitialized = true;
  } catch (e) {
    console.error('Firebase Admin init error:', e.message);
  }
};

export const verifyToken = async (req, res, next) => {
  // If Firebase Admin isn't configured, allow requests through (dev mode)
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    req.uid = req.headers['x-user-id'] || 'guest';
    return next();
  }

  initAdmin();
  const header = req.headers.authorization;
  
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }

  const token = header.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired token.' });
  }
};
