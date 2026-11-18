import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const PROJECT_ID = "pet-finder-f57at5";

function app() {
  if (getApps().length) return getApps()[0];
  // Vercel: FIREBASE_SERVICE_ACCOUNT_JSON (the full JSON as one env var).
  // Local: GOOGLE_APPLICATION_CREDENTIALS (path to the JSON file).
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return initializeApp({
    credential: json ? cert(JSON.parse(json)) : applicationDefault(),
    projectId: PROJECT_ID,
  });
}

export const adminDb = () => getFirestore(app());
export const adminAuth = () => getAuth(app());
export const adminMessaging = () => getMessaging(app());

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

/** Every /api/admin/* handler must call this first: valid ID token AND admin == true claim. */
export async function requireAdmin(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) throw new HttpError(401, "Missing bearer token.");
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    if (decoded.admin !== true) throw new HttpError(403, "Not authorised.");
    return decoded;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(401, "Invalid or expired token.");
  }
}

export function handle(fn: (req: Request, ctx: unknown) => Promise<unknown>) {
  return async (req: Request, ctx: unknown) => {
    try {
      const body = await fn(req, ctx);
      return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message, ...e.extra }, { status: e.status });
      console.error("admin api error", e instanceof Error ? e.message : e);
      return Response.json({ error: e instanceof Error ? e.message : "Internal error" }, { status: 500 });
    }
  };
}
