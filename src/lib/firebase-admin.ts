import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0];

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

// Lazy, not eager: any route importing this file only needs FIREBASE_ADMIN_*
// to be set correctly at the moment it actually calls getAdminAuth()/
// getAdminDb(), not merely by importing this module. An earlier version
// initialized the Admin SDK at module top level, which made `next build`'s
// route-data collection crash on any page importing this file whenever those
// env vars were unset — even for fully dynamic routes that only need real
// credentials at request time, not at build time.
let cachedAuth: Auth | undefined;
export function getAdminAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(getAdminApp());
  }
  return cachedAuth;
}

let cachedDb: Firestore | undefined;
export function getAdminDb(): Firestore {
  if (!cachedDb) {
    cachedDb = getFirestore(getAdminApp());
    cachedDb.settings({ ignoreUndefinedProperties: true });
  }
  return cachedDb;
}
