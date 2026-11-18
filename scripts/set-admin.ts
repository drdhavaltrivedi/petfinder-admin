/**
 * One-off: grant the `admin` custom claim.
 *
 *   npx tsx scripts/set-admin.ts <uid | email>
 *
 * Env: GOOGLE_APPLICATION_CREDENTIALS = path to a service-account JSON (never commit it).
 * If an email is given and no such Auth user exists, the user is created when ADMIN_PASSWORD is set.
 * The user must sign out/in (the panel force-refreshes the token) to see the new claim.
 */
import { existsSync } from "node:fs";
import { config } from "dotenv";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

config({ path: ".env.local" });

async function main() {
  const target = process.argv[2];
  if (!target) throw new Error("Usage: npx tsx scripts/set-admin.ts <uid | email>");
  const cred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!cred || !existsSync(cred))
    throw new Error("Set GOOGLE_APPLICATION_CREDENTIALS to the path of your service-account JSON.");

  initializeApp({ credential: applicationDefault(), projectId: "pet-finder-f57at5" });
  const auth = getAuth();

  let uid = target;
  if (target.includes("@")) {
    try {
      uid = (await auth.getUserByEmail(target)).uid;
    } catch (e) {
      if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
      const password = process.env.ADMIN_PASSWORD;
      if (!password) throw new Error(`No user ${target}. Set ADMIN_PASSWORD to create it.`);
      uid = (await auth.createUser({ email: target, password, emailVerified: true })).uid;
      console.log(`Created Auth user ${target} (${uid})`);
    }
  }

  await auth.setCustomUserClaims(uid, { admin: true });
  const u = await auth.getUser(uid);
  console.log(`admin=true set for ${u.email ?? "(no email)"} uid=${uid}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
