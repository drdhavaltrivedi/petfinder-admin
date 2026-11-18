# PetFinder Admin

Admin web panel for the PetFinder mobile app (FlutterFlow). Next.js (App Router) + TypeScript + Firebase JS SDK + Tailwind.
Firebase project: `pet-finder-f57at5`.

> **This project never changes or deploys Firestore/Storage rules** – they are managed in FlutterFlow.

## Features
Sign in · posts list (20/page, category filter, reported posts highlighted) · create / edit post (live preview, client-side
resize to ≤1080×1080 JPEG) · post detail with comments (read-only) · delete with confirm and a clear permission-denied error.

## Setup
```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
```

### Environment variables (`.env.example`)
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` | Web app config (Firebase console → Project settings → Your apps) |
| `NEXT_PUBLIC_OFFICIAL_AUTHOR_UID` | `Users/{uid}` the panel posts as |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service-account JSON, **only for `set-admin`** |
| `ADMIN_PASSWORD` | Optional, **only for `set-admin`**: creates the admin user if the email doesn't exist |

Web config values are not secrets (they ship to the browser) – access is enforced by Auth claims + Firebase rules.
The service-account JSON and `ADMIN_PASSWORD` must never be committed or set on Vercel (`.gitignore` covers `.env*` and service-account files).

## Making someone an admin
Only users whose ID token has the custom claim `admin == true` can use the panel; everyone else sees “Not authorised” and is signed out.

1. Firebase console → Project settings → Service accounts → *Generate new private key* → save **outside the repo**.
2. Run:
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
npx tsx scripts/set-admin.ts <uid>                 # existing user by uid
npx tsx scripts/set-admin.ts admin@example.com     # by email (creates the user if ADMIN_PASSWORD is set)
```
3. Sign in to the panel (the panel force-refreshes the token, so the claim is picked up immediately).

Email/Password sign-in must be enabled in Firebase Auth → Sign-in method.

## Firestore rules & indexes (managed elsewhere)
* The panel needs **read** on `Post`, `Users`, `Post/*/Comments`; **create/update** on `Post`; **delete** on `Post` and **write** on Storage `users/{uid}/uploads/**` for admins. Until rules allow admin deletes, Delete shows a permission-denied message.
* Filtering by category + ordering by `created_at` needs a composite index (`Post`: `category` ASC, `created_at` DESC). If missing, the list shows an error containing a link that creates it in one click.

## Data model written by the panel
`Post`: `caption, photo_url, category (Story|Adoption|Advice|Photo|Events), user (DocumentReference → Users/{uid}), created_at, updated_at (serverTimestamp), likes_count=0, comments_count=0, report_count=0, reported_users=[]`.
Edits only change `caption`, `category`, `photo_url` (if replaced) and `updated_at`.
Images upload to `users/{signedInUid}/uploads/{Date.now()}.jpg`.

## Deploy
**Vercel:** import the repo, add the `NEXT_PUBLIC_*` variables (Production + Preview), deploy. Then in Firebase Auth → Settings → *Authorized domains* add your Vercel domain.
**Firebase Hosting:** use the Next.js framework-aware hosting (`firebase init hosting`, choose the web frameworks option) and deploy with `firebase deploy --only hosting` – never `--only firestore:rules`.

## Data & caching (how the dashboard avoids API calls)
* `GET /api/admin/bundle` (admin-only) builds one compact dataset – every user (uid, email, name, signup, last active), pets, locations and
  precomputed dashboard stats (~1 MB gzipped). The first build reads all Auth users and takes ~25 s.
* The browser stores the bundle in IndexedDB for **48 hours**. Dashboard, Users, Pets and the Connect pickers filter, sort, count and
  paginate locally with **no API calls**. The **Refresh** button (or expiry after 48 h) rebuilds it. Signing out clears it.
* Only these are live calls: a single user's profile (cached 5 min), recent adoption requests/chats, and creating a connection.
* Posts are loaded once through the Firestore client SDK (cached 10 min) and paged locally.
* No cron job and no extra Firestore collection is used.

### Extra environment variables for the server routes
`FIREBASE_SERVICE_ACCOUNT_JSON` (Vercel, Sensitive) or `GOOGLE_APPLICATION_CREDENTIALS` (local path), optional `ADMIN_TZ_OFFSET_MIN` (default 330).
