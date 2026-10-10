# P1 — Mobile App (Rork / Expo) — Step-by-Step Checkpoints

> **Project:** WhatIf. **Your role:** you own the entire user interface: the mobile app now, the Flutter backup if needed, and the web app later.
> **Give your AI agent:** `plan/WHATIF-MASTER-PLAN.md` §0–§7 plus this file. §5 (contract) and §6 (config) are law.
> **You own:** `mobile/**` (plus `mobile-flutter/**` if you switch, and `web/**` later). **Never edit:** `backend/**` or `shared/contract/**`. To change the contract, ask P4.
> **Golden rule:** every screen talks to one `api` object. Switching from fixtures to the live backend is done by changing `EXPO_PUBLIC_API_MODE` only, never by editing screens.

---

## Checkpoint summary

| CP | Time (EDT) | Outcome | Gate |
|---|---|---|---|
| CP0 | 12:30–13:00 | Tools ready, plan understood, design direction chosen | G0 |
| CP1 | 13:00–13:45 | App scaffold, types, API layer, fixture client, banner | — |
| CP2 | 13:45–14:30 | Capture (camera + location), Mask, Prompt screens on fixtures | **G1** (Rork go/no-go) |
| CP3 | 14:30–17:00 | Generating, Preview/Post screens, Auth0 login, live client | **G2** (live loop on phone) |
| CP4 | 17:00–20:00 | Home feed (Local/Global, Hot/New/Top), Post detail, votes, comments, Profile | **G3** (3 accounts) |
| CP5 | 20:00–22:00 | Polish, error states, real-device testing, accessibility | **G4** (freeze) |
| CP6 | 22:00–07:00 | Demo video, rehearsals, fresh installs | Submission |
| BK | only if G1 fails | Local Expo continuation, or Flutter backup | — |
| W | after hackathon | Web app | — |

---

## CP0 — Kickoff (12:30–13:00)

**Goal:** you understand the product and contract, and your tools work.

1. Read master plan §1 (product), §4.2 (sequence), §5 (contract) and §6.2 (mobile config).
2. Create or log in to your **rork.com** account. Install **Expo Go** on your phone and confirm a Rork preview opens on it.
3. Confirm Node 20+ is installed locally, along with `git` and `npx expo` (needed if you later continue locally).
4. Agree with P4 on:
   - When `shared/fixtures/*.json` will land (target: by 13:30).
   - When the tunnel URL will be ready (target: by 14:30).
   - The Auth0 Native app client ID.
5. Choose the visual direction:
   - One accent color, for example civic teal `#0E9F8E`.
   - Neutral backgrounds.
   - Rounded cards.
   - System font.
   - "Before" and "AI reimagined" labels always visible on images.
6. Write your name next to P1 in `docs/DECISIONS.md` (or ask P4 to).

**Done when:** a Rork preview runs on your phone, and you can explain the full loop in one sentence.

---

## CP1 — Scaffold, types, API layer, fixtures (13:00–13:45)

**Goal:** the app skeleton exists with every route, and a fixture-backed `api` object returns contract-shaped data.

### Step 1.1 — Rork base prompt (prefix it to every Rork prompt from now on)
> "Expo + TypeScript + expo-router app called **WhatIf**. Do NOT create any backend, server, database or Supabase. All data must go through the `api` object exported from `src/api/index.ts`. Never invent API fields. Use exactly the types in `src/api/types.ts`. Keep `src/api/**` free of React imports."

### Step 1.2 — Create the folder structure (Rork prompt 1)
```
app/
  _layout.tsx                    QueryClientProvider, AuthProvider, GestureHandlerRootView, FixtureBanner
  (tabs)/_layout.tsx             tabs: Home · Create(+) · Profile
  (tabs)/index.tsx               Home feed (Local | Global, Hot | New | Top)
  (tabs)/create.tsx              redirects to /create/camera (requires login)
  (tabs)/profile.tsx             Profile: my posts, drafts, settings, login/logout
  create/camera.tsx              S1 camera / library + location capture
  create/details.tsx             S2 place label + consent → uploads → /post/[id]/mask
  post/[id]/index.tsx            S7 Post detail (slider, votes, comments)
  post/[id]/mask.tsx             S3 brush mask
  post/[id]/prompt.tsx           S4 suggestion prompt
  post/[id]/generating.tsx       S5 job progress
  post/[id]/preview.tsx          S6 preview, edit title, regenerate, post
  login.tsx                      sign-in screen (modal)
src/
  config.ts                      ONLY place that reads env (§6.2)
  api/types.ts                   contract types (below)
  api/ApiClient.ts               interface (below)
  api/errors.ts                  ApiError class
  api/fixtureClient.ts
  api/liveClient.ts              (CP3)
  api/index.ts                   export const api = config.apiMode === 'live' ? liveClient : fixtureClient
  auth/AuthProvider.tsx, auth/tokenStore.ts      (CP3)
  location/useLocation.ts        permission + current position + reverse geocode
  hooks/  usePost, useJob, useFeed, useVote, useComments, useMe, useMyPosts
  components/  FixtureBanner, FakeProviderBanner, AiLabel, BeforeAfterSlider, MaskCanvas,
               JobStageList, FlagList, VoteBar, PostCard, CommentItem, CommentComposer,
               FeedTabs, SortChips, ErrorState, EmptyState, PrimaryButton, FieldError
  lib/routeForPost.ts            which screen to open for a draft
  lib/format.ts                  relative time, distance "0.8 km away", score formatting
  fixtures/                      copied by scripts/sync_fixtures.py (or pasted)
```

### Step 1.3 — `src/config.ts`
```ts
export const config = {
  apiMode: (process.env.EXPO_PUBLIC_API_MODE ?? 'fixture') as 'fixture' | 'live',
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  auth0Domain: process.env.EXPO_PUBLIC_AUTH0_DOMAIN ?? '',
  auth0ClientId: process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ?? '',
  auth0Audience: process.env.EXPO_PUBLIC_AUTH0_AUDIENCE ?? 'https://api.whatif.dev',
  auth0Scheme: process.env.EXPO_PUBLIC_AUTH0_SCHEME ?? 'whatif',
  jobPollMs: Number(process.env.EXPO_PUBLIC_JOB_POLL_MS ?? 2000),
  defaultRadiusKm: Number(process.env.EXPO_PUBLIC_DEFAULT_RADIUS_KM ?? 10),
};
```
If Rork can't use env vars, replace the right-hand sides with constants. Keep this file as the only place config is read.

### Step 1.4 — `src/api/types.ts` (paste verbatim; it mirrors master §5)
```ts
export type PostStatus = 'draft' | 'ready' | 'published' | 'removed';
export type LocationSource = 'gps' | 'exif' | 'manual' | 'none';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type JobStage = 'queued' | 'moderate' | 'prompt' | 'render' | 'review' | 'title' | 'finalize' | 'done';
export type ReviewVerdict = 'clear' | 'needs_review' | 'blocked';
export type FlagSeverity = 'info' | 'warning' | 'blocking';
export type FeedTab = 'local' | 'global';
export type FeedSort = 'hot' | 'new' | 'top';
export type VoteValue = 1 | -1 | 0;

export interface ErrorBody { code: string; message: string; retryable: boolean; fieldErrors?: Record<string, string[]>; }
export interface Asset { id: string; kind: 'source' | 'mask' | 'concept'; width: number; height: number;
  mimeType: string; sha256: string; url: string; urlExpiresAt: string; }
export interface Location { lat: number; lng: number; source: LocationSource; }
export interface Author { displayName: string; isViewer: boolean; }
export interface Job { id: string; postId: string; kind: 'generate'; status: JobStatus; stage: JobStage;
  attempt: number; createdAt: string; updatedAt: string; error: ErrorBody | null; }
export interface Flag { id: string; code: string; severity: FlagSeverity; message: string; }
export interface Review { verdict: ReviewVerdict; flags: Flag[]; outsideMaskChange: number | null;
  provider: string; model: string; reviewedAt: string; }
export interface Generation { provider: string; model: string; seed: number | null; durationMs: number;
  workflowVersion: string; prompt: string; createdAt: string; }
export interface Post { id: string; revision: number; status: PostStatus; createdAt: string; updatedAt: string;
  publishedAt: string | null; author: Author; title: string; prompt: string; placeLabel: string;
  location: Location | null; distanceKm: number | null; source: Asset; concept: Asset | null;
  maskAssetId: string | null; review: Review | null; generation: Generation | null; activeJob: Job | null;
  aiDisclosure: string; score: number; upvotes: number; downvotes: number; viewerVote: VoteValue; commentCount: number; }
export interface PostSummary { id: string; status: PostStatus; title: string; promptPreview: string; placeLabel: string;
  location: Location | null; distanceKm: number | null; publishedAt: string | null; updatedAt: string;
  sourceThumbUrl: string; conceptThumbUrl: string | null; score: number; viewerVote: VoteValue;
  commentCount: number; author: Author; }
export interface Page<T> { items: T[]; nextCursor: string | null; }
export interface VoteResult { postId: string; score: number; upvotes: number; downvotes: number; viewerVote: VoteValue; }
export interface Comment { id: string; postId: string; parentId: string | null; author: Author; body: string;
  createdAt: string; isDeleted: boolean; replyCount: number; }
export interface Me { id: string; displayName: string; createdAt: string; }
export interface PublicConfig { apiVersion: string; maxUploadBytes: number; maxImageEdge: number;
  promptMinChars: number; promptMaxChars: number; localRadiusKm: number; localRadiusMaxKm: number;
  aiDisclosure: string; providers: { prompt: string; render: string; review: string }; }
export interface MaskStroke { mode: 'paint' | 'erase'; width: number; points: [number, number][]; }
export interface MaskStrokes { version: 1; strokes: MaskStroke[]; }
```

### Step 1.5 — `src/api/ApiClient.ts`
```ts
export interface CreatePostInput {
  photo: { uri: string; mimeType: string } | { file: Blob };     // Blob variant is for web later
  placeLabel: string; lat?: number; lng?: number; locationSource: LocationSource;
  locationAccuracyM?: number; consent: true;
}
export interface ApiClient {
  getConfig(): Promise<PublicConfig>;
  getMe(): Promise<Me>;
  updateMe(b: { displayName: string }): Promise<Me>;
  createPost(i: CreatePostInput): Promise<Post>;
  getPost(id: string, viewer?: { lat: number; lng: number }): Promise<Post>;
  updatePost(id: string, b: { expectedRevision: number; title?: string; prompt?: string; placeLabel?: string }): Promise<Post>;
  deletePost(id: string): Promise<void>;
  saveMask(id: string, b: { expectedRevision: number; strokes: MaskStrokes }): Promise<{ assetId: string; revision: number }>;
  generate(id: string, b: { prompt: string; maskAssetId: string; expectedRevision: number }, idempotencyKey: string): Promise<{ jobId: string; postId: string }>;
  getJob(id: string): Promise<Job>;
  publish(id: string, b: { expectedRevision: number; acknowledgedFlagIds: string[] }): Promise<Post>;
  getFeed(q: { tab: FeedTab; sort: FeedSort; lat?: number; lng?: number; radiusKm?: number; cursor?: string; limit?: number }): Promise<Page<PostSummary>>;
  getMyPosts(q: { status: 'draft' | 'published'; cursor?: string }): Promise<Page<PostSummary>>;
  vote(postId: string, value: VoteValue): Promise<VoteResult>;
  getComments(postId: string, q: { sort: 'old' | 'new'; cursor?: string }): Promise<Page<Comment>>;
  createComment(postId: string, b: { body: string; parentId?: string }): Promise<Comment>;
  deleteComment(commentId: string): Promise<Comment>;
}
```
`src/api/errors.ts`: `class ApiError extends Error { status: number; code: string; retryable: boolean; fieldErrors: Record<string,string[]> }`. Add `errorMessage(code)`, which maps every code in master §5.6 to the user-facing text in that table.

### Step 1.6 — Fixture client (Rork prompt 2)
- Load JSON from `src/fixtures/` (master §5.9). If they haven't arrived from P4 yet, make temporary copies from master §5.3 examples and replace them when P4's land.
- Wait a random 300–800 ms before each call.
- Keep in-memory state so the flow feels real:
  - `createPost` returns `post_draft` with a new ID.
  - `saveMask` increments `revision`.
  - `generate` creates a fake job. Each `getJob` call advances one stage: `queued → moderate → prompt → render → review → title → finalize → done(succeeded)`.
  - `publish` sets status to published and adds the post to the feed.
- Votes: track `viewerVote` per post and recompute the score (up→down = −2; 0 removes the vote).
- Comments: in-memory list, with replies allowed only on top-level comments (otherwise throw `ApiError` with `REPLY_DEPTH_EXCEEDED`).
- Failure toggles (set in Profile → Developer): `failRender` makes the job fail with `RENDER_FAILED`; `disallowPrompt` makes `generate` throw `PROMPT_DISALLOWED`; `revisionConflict` makes the next mutation throw 409.
- Never touch the network.

### Step 1.7 — Global banners
- `FixtureBanner`: a thin bar fixed at the top, shown when `config.apiMode === 'fixture'`. Text: "DEVELOPMENT FIXTURES — NOT LIVE AI".
- `FakeProviderBanner`: shown when any value in `getConfig().providers` equals `'fake'`. Text: "Demo renderer (fake)".

**CP1 done when:**
- [ ] Every route opens without crashing.
- [ ] `api.getFeed({tab:'global', sort:'new'})` returns fixture items rendered as plain text on Home.
- [ ] The banner is visible.
- [ ] Commit and open a PR: `feat/mobile: scaffold + fixture client`.

---

## CP2 — Capture, location, mask, prompt on fixtures (13:45–14:30) → Gate G1

**Goal:** a user can take a photo with location, confirm a place, brush a mask and type a prompt, all against fixtures.

### Step 2.1 — Location hook `src/location/useLocation.ts`
- Use `expo-location`. Call `requestForegroundPermissionsAsync()`.
- If permission is granted, call `getCurrentPositionAsync({ accuracy: Balanced })` and return `{ lat, lng, accuracyM }`. Then call `reverseGeocodeAsync({latitude, longitude})` and build a suggested label `"{street or name}, {city}"`.
- Return a status of `'granted' | 'denied' | 'unavailable'`. Never block the flow on denial.
- Cache the last position in memory for 2 minutes (the Home feed reuses it).

### Step 2.2 — S1 Camera screen `create/camera.tsx` (Rork prompt 3)
- **Login gate:** if the user is not signed in, push `/login` and come back afterwards.
- **Main button "Take photo":** use `expo-image-picker` `launchCameraAsync({ quality: 0.85, exif: true })`. If you want an in-app viewfinder, use `expo-camera`, but the picker is simpler and fine.
- **Secondary "Choose from library":** `launchImageLibraryAsync({ quality: 0.85, exif: true })`.
- **Location for camera photos:** start the location request when the screen opens, so GPS is ready by the time the photo is taken. Use `locationSource='gps'`.
- **Location for library photos:**
  - If `asset.exif.GPSLatitude` exists, convert it to signed decimal degrees using the `GPSLatitudeRef`/`GPSLongitudeRef` S/W refs, and set `locationSource='exif'`.
  - Otherwise ask "Use your current location for this photo?" and choose `gps` or `none` based on the answer.
  - The backend also extracts EXIF GPS as a backup.
- After picking a photo, go to `create/details` with `{ uri, mimeType, lat, lng, accuracyM, locationSource }`.

### Step 2.3 — S2 Details screen `create/details.tsx`
- Show the photo preview.
- **Location row:**
  - With location: "📍 {suggested label} · ±{accuracy} m". The label is editable, and a "Remove location" link sets `locationSource='none'`.
  - Without location: "No location — this post will only appear in Global."
- **Place label input:** prefilled from reverse geocoding, 0–120 chars.
- **Consent checkbox (required):** "I took this photo or have permission, and it doesn't show identifiable people, license plates or private information."
- **"Continue" button:**
  - Calls `api.createPost(...)`, then `router.replace('/post/{id}/mask')`.
  - Keeps the form data on error and shows `fieldErrors` inline.
  - Disabled while uploading, with a spinner.

### Step 2.4 — S3 Mask screen `post/[id]/mask.tsx` (Rork prompt 4; paste master §5.7 verbatim)
- **Load the post** and display **`post.source.url`** with `expo-image` and `contentFit="contain"`.
- **Content rectangle:** compute the displayed image rectangle inside the view:
  ```
  scale = min(viewW / imgW, viewH / imgH); dispW = imgW*scale; dispH = imgH*scale;
  offX = (viewW - dispW)/2; offY = (viewH - dispH)/2
  nx = (touchX - offX)/dispW; ny = (touchY - offY)/dispH   // ignore if outside [0,1]
  ```
- **Gesture:** with `react-native-gesture-handler` `Gesture.Pan()`, start a stroke on begin and append points on update. Throttle points so consecutive points are at least 0.004 apart in normalized distance.
- **Rendering:** draw an `react-native-svg` `<Path>` over the image, stroke `rgba(14,159,142,0.5)`, `strokeLinecap="round"`, `strokeLinejoin="round"`, `strokeWidth = width * dispW`. Erase strokes render as image-colored gaps. Simpler option: render erase strokes in a semi-transparent red outline only and let the backend handle the actual erase.
- **Toolbar:** Paint / Erase toggle; brush sizes S/M/L = 0.03 / 0.05 / 0.08; Undo; Clear.
- **Tip text:** "Brush over the part of the photo you want to change."
- **"Next" button:** disabled until at least one paint stroke exists. Calls `api.saveMask(id, { expectedRevision: post.revision, strokes })`, then goes to `/post/{id}/prompt`.
- **Persistence:** keep strokes in a zustand store keyed by post ID, so returning to this screen restores them.

### Step 2.5 — S4 Prompt screen `post/[id]/prompt.tsx`
- Show a small thumbnail of the source with the mask overlay.
- **Multiline input** "What if…", with placeholder "This bus stop needs a roof/shed". Counter `n/300`; minimum 5 characters (values from `getConfig()`).
- **Suggestion chips** that fill the input: "Add a roof/shelter", "Plant trees", "Add a bike lane", "Add benches", "Add street lights", "Paint a mural".
- **"Reimagine" button:**
  - Generate `idempotencyKey = Crypto.randomUUID()` and store it in a ref.
  - Call `api.generate(id, { prompt, maskAssetId: post.maskAssetId, expectedRevision: post.revision }, key)`, then `router.replace('/post/{id}/generating?jobId=...')`.
- **Errors:**
  - `PROMPT_DISALLOWED`: show the message inline and keep the text.
  - `JOB_IN_PROGRESS`: go to the generating screen using `post.activeJob.id`.

### Step 2.6 — G1 readiness (Rork go/no-go)
Demo on your phone, in fixture mode: camera → details (location shown) → mask brushing → prompt → "Reimagine" accepted.

**Pass criteria:**
- (a) All the screens above work.
- (b) The brush draws correctly and you see the normalized points in a debug log.
- (c) You are confident the multipart upload will work, or it already works against the tunnel.

**If it fails:** see BK below.

**CP2 done when:**
- [ ] The flow above works in fixture mode.
- [ ] A mask drawn on a **portrait** photo produces points that stay inside [0,1].
- [ ] Location is shown, or the "no location" message appears when permission is denied.
- [ ] PR: `feat/mobile: capture, location, mask, prompt`.

---

## CP3 — Generating, Preview/Post, Auth0, live client (14:30–17:00) → Gate G2

**Goal:** the real backend is reachable from your phone, and a real AI edit shows up in the app.

### Step 3.1 — Job polling hook `useJob(jobId)`
- Use react-query with `refetchInterval: (data) => data?.status === 'succeeded' || data?.status === 'failed' ? false : config.jobPollMs`.
- Return `{ job, isDone, isFailed }`.

### Step 3.2 — S5 Generating screen `post/[id]/generating.tsx`
- **Job ID:** read it from the query param; if missing, fall back to `post.activeJob?.id`.
- **`JobStageList`:** stages `moderate → prompt → render → review → title → finalize` with labels "Checking request", "Planning the edit", "Reimagining the photo", "Reviewing the result", "Writing a title", "Saving". Each stage shows done (✓), active (spinner) or pending. Also show elapsed time.
- **Expectation note:** "Rendering usually takes 30–120 seconds." Never show fake percentages.
- **On success:** `router.replace('/post/{id}/preview')`.
- **On failure:** show an `ErrorState` with `errorMessage(job.error.code)` and these actions:
  - "Try again": creates a new idempotency key and calls `generate` with the same prompt.
  - "Edit prompt": goes back to prompt.
  - "Adjust brush": goes back to mask.
  - `STALE_RESULT`: reload the post and route it with `routeForPost`.
  - `PROMPT_DISALLOWED`: go back to prompt and show the message.
- **Resume:** if the app restarts mid-job, the Profile drafts list routes the user back here via `activeJob`.

### Step 3.3 — S6 Preview & Post screen `post/[id]/preview.tsx` (Rork prompt 5)
- **`BeforeAfterSlider`:** source and concept with the same aspect ratio, a draggable vertical divider (gesture-handler plus reanimated shared value), a "Before" label at top-left and an `AiLabel` "AI reimagined" chip at top-right. A toggle switches to a "Side by side" layout.
- **Review card:** shows the verdict badge (Clear / Needs review / Blocked).
  - Each flag: severity icon, message, and an "I understand" checkbox for warnings.
  - Blocked: a red box saying "This image can't be posted. Try a different prompt or brush area." The Post button is disabled.
- **Fields:**
  - Title: editable, at most 120 chars. Save on blur with `updatePost({ expectedRevision, title })`.
  - Prompt: shown read-only, with an "Edit & regenerate" link back to the prompt screen.
  - Place label: editable.
- **AI disclosure:** show the text `post.aiDisclosure`.
- **Buttons:**
  - **Post:** `publish({ expectedRevision, acknowledgedFlagIds })`, then `router.replace('/post/{id}')`, then a toast "Posted!".
  - **Regenerate:** goes to prompt (prefilled).
  - **Save draft:** goes back to Profile.
- **Error handling:**
  - `REVISION_CONFLICT`: refetch the post and show the toast "Updated — please review again".
  - `FLAGS_NOT_ACKNOWLEDGED`: highlight the unchecked flags.

### Step 3.4 — Auth0 login (Rork prompt 6)
- **`AuthProvider`:**
  - Use `expo-auth-session`: `const discovery = AuthSession.useAutoDiscovery('https://' + config.auth0Domain)`.
  - Build the redirect: `redirectUri = AuthSession.makeRedirectUri({ scheme: config.auth0Scheme, path: 'auth' })`.
  - Create the request: `useAuthRequest({ clientId, redirectUri, scopes: ['openid','profile','email','offline_access'], usePKCE: true, extraParams: { audience: config.auth0Audience } }, discovery)`.
  - On success, call `exchangeCodeAsync` and store `{accessToken, refreshToken, expiresAt}`.
- **`tokenStore`:** `expo-secure-store` on native, in-memory storage on web (`Platform.OS === 'web'`).
- **`getAccessToken()`:** if the token expires within 60 s, refresh it with `AuthSession.refreshAsync`. If the refresh fails, clear the store and return null.
- **Logout:** clear the store, then `WebBrowser.openBrowserAsync('https://' + domain + '/v2/logout?client_id=...&returnTo=' + encodeURIComponent(redirectUri))`.
- **`login.tsx`:** app logo, a short pitch, a "Sign in / Create account" button, and in development the displayed `redirectUri`. **Send that exact string to P4** so it can be added to Auth0's allowed callbacks.
- **After login:** call `api.getMe()` and store `me` in context.
- **Gated actions:** Create, vote, comment and Profile → My posts. If a user does a gated action while logged out, push `/login`, then return them to where they were.

### Step 3.5 — Live client `src/api/liveClient.ts` (Rork prompt 7)
- **One `request(method, path, { body, form, query, headers, auth })` helper:**
  - URL = `config.apiBaseUrl + path`, plus the query string (skip undefined values).
  - Adds `Authorization: Bearer` when `getAccessToken()` returns a token.
  - JSON bodies use `Content-Type: application/json`. FormData bodies get no manual content type.
  - Non-2xx: parse `{error}` and throw `ApiError(status, error.code, error.message, error.retryable, error.fieldErrors)`. Network failure: throw `ApiError(0, 'NETWORK', ...)`.
  - 401: try one token refresh and retry once. If it still fails, throw `AUTH_REQUIRED`.
- **`createPost`:**
  ```ts
  const fd = new FormData();
  fd.append('photo', { uri, name: 'photo.jpg', type: mimeType } as any);
  fd.append('placeLabel', placeLabel); fd.append('locationSource', locationSource); fd.append('consent', 'true');
  if (lat != null) { fd.append('lat', String(lat)); fd.append('lng', String(lng)); }
  if (accuracyM != null) fd.append('locationAccuracyM', String(accuracyM));
  ```
- **`generate`:** sends the header `Idempotency-Key: <key>`.
- **Route map** (exactly master §5.4): `GET /config`, `GET/PATCH /me`, `POST /posts`, `GET/PATCH/DELETE /posts/{id}`, `POST /posts/{id}/mask`, `POST /posts/{id}/generate`, `GET /jobs/{id}`, `POST /posts/{id}/publish`, `GET /feed`, `GET /me/posts`, `POST /posts/{id}/vote`, `GET/POST /posts/{id}/comments`, `DELETE /comments/{id}`. No trailing slashes.

### Step 3.6 — Switch to live (G2)
1. Get the tunnel URL from P4. Set `EXPO_PUBLIC_API_MODE=live` and `EXPO_PUBLIC_API_BASE_URL=https://<tunnel>/api/v1`, plus the Auth0 values.
2. On your phone, run the full flow: login → camera → details → mask → prompt → generating → preview with a **real** edit.
3. Report any mismatch to P4 with the exact endpoint, the request, and the response body.

**CP3 done when:**
- [ ] On a real phone, live mode: login works and a real concept appears in the preview slider, aligned with the brushed area.
- [ ] Failure UI verified with the fixture toggles.
- [ ] Killing the app mid-render and reopening resumes the job (via Profile → Drafts → `routeForPost`).
- [ ] PR: `feat/mobile: generate, preview, auth, live client`.

---

## CP4 — Community: feed, detail, votes, comments, profile (17:00–20:00) → Gate G3

**Goal:** the Reddit-style forum works with Local and Global tabs.

### Step 4.1 — Home feed `(tabs)/index.tsx` (Rork prompt 8)
- **Header:** the "WhatIf" wordmark, plus a segmented control **Local | Global** (`FeedTabs`).
- **Sort chips:** **Hot | New | Top** (`SortChips`). Remember the last tab and sort in AsyncStorage.
- **Local tab:**
  - Uses `useLocation()`. Calls `getFeed({ tab:'local', sort, lat, lng, radiusKm: config.defaultRadiusKm })`.
  - Header text: "Within {radius} km of you".
  - **Permission denied:** show an EmptyState "Turn on location to see posts near you" with buttons "Enable location" (`Linking.openSettings()`) and "Browse Global".
  - **Fewer than 3 results:** show the banner "Few posts nearby — check Global" at the end of the list.
- **Global tab:** `getFeed({ tab:'global', sort })`. If location is available, pass `lat`/`lng` so `distanceKm` appears.
- **List behavior:** `FlatList` with pull-to-refresh and infinite scroll (load the next page from `nextCursor` when the end is reached). Show skeleton cards while loading.
- **`PostCard`:**
  - Concept thumbnail with the `AiLabel` chip.
  - Title (2 lines), place label, "0.8 km away" if `distanceKm` exists, and relative time.
  - Author display name.
  - `VoteBar` (▲ score ▼, compact).
  - 💬 comment count.
  - Tapping the card opens `/post/{id}`.
- **Empty state:** "No posts yet — be the first to imagine a change" with a "Create" button.

### Step 4.2 — `VoteBar` and `useVote`
- **Tap behavior:**
  - Tap ▲: if `viewerVote === 1`, send 0; otherwise send 1.
  - Tap ▼: if `viewerVote === -1`, send 0; otherwise send −1.
- **Optimistic update:** compute the new score locally (for example 1→−1 is −2), call `api.vote`, then **replace the score with the server's `VoteResult`**. Roll back on error.
- **Logged-out users:** push `/login`.
- **Double taps:** disable the bar while a request is in flight, so a double tap never sends two requests.
- **Sync:** update both the feed cache and the post-detail cache (`queryClient.setQueryData`).
- **Colors:** an upvoted ▲ uses the accent color; a downvoted ▼ uses a muted red.

### Step 4.3 — S7 Post detail `post/[id]/index.tsx` (Rork prompt 9)
- **Top section:** title, author, relative time, place label with "📍 0.8 km away", and a static map is optional (skip it).
- **Media:** `BeforeAfterSlider` (source vs concept) and the AI disclosure.
- **Prompt:** shown in a quote style: "What if… This bus stop needs a roof/shed".
- **`VoteBar`** in its large variant.
- **Owner menu (⋯):** "Edit title" (inline) and "Delete post" (confirm dialog, then `deletePost`, then back to the feed).
- **Comments section:**
  - Header "Comments (n)" and a sort toggle Oldest/Newest.
  - Use `getComments` with infinite scroll. Group items client-side: top-level comments sorted as requested, with replies under their parent oldest-first.
  - **`CommentItem`:** author, relative time and body. Show "Reply" only on top-level comments. Show "Delete" only when `author.isViewer`. Deleted comments render as "[deleted]" in grey but keep their replies.
  - **`CommentComposer`:** sticky at the bottom, multiline, 1–1000 chars. "Replying to {name} ✕" appears when replying.
    - Submit calls `createComment`, appends the result, increments the count and clears the input.
    - `CONTENT_DISALLOWED` shows "Please keep it respectful." and keeps the text.
  - Logged-out users see "Sign in to comment" instead of the composer.
- **Drafts:** if the post is not published and the viewer is the owner, show a "Continue editing" button that uses `routeForPost`.

### Step 4.4 — Profile `(tabs)/profile.tsx`
- **Logged out:** a sign-in prompt.
- **Logged in:**
  - Display name with an edit icon (`updateMe`) and a "Sign out" button.
  - Segmented control: **My posts | Drafts**, using `getMyPosts({status:'published'|'draft'})`.
  - Draft cards show a status badge: Draft / Ready / Processing (when `activeJob`).
  - Tapping a card calls `routeForPost(post)`.
- **Developer section (only when `__DEV__`):** API mode, base URL, the Auth0 redirect URI, and the fixture failure toggles.

### Step 4.5 — `lib/routeForPost.ts`
```ts
export function routeForPost(p: Post): string {
  if (p.status === 'published') return `/post/${p.id}`;
  if (p.activeJob && (p.activeJob.status === 'queued' || p.activeJob.status === 'running'))
    return `/post/${p.id}/generating?jobId=${p.activeJob.id}`;
  if (!p.maskAssetId) return `/post/${p.id}/mask`;
  if (!p.concept) return `/post/${p.id}/prompt`;
  return `/post/${p.id}/preview`;
}
```
`getMyPosts` returns summaries, so fetch the full post with `getPost` before routing.

### Step 4.6 — G3 test with 3 accounts (with P4)
1. demo1 creates and posts.
2. demo2 (on another phone or after logging out) sees the post in **Local**, upvotes, comments, and toggles the vote.
3. demo3 downvotes, then switches to an upvote. The score shown must always equal the server's value.
4. demo1 replies to demo2's comment and deletes a test comment.
5. Check that the far-away seed post is in Global only.

**CP4 done when:**
- [ ] The G3 test above passes live.
- [ ] Rapid double taps on vote never desync the score.
- [ ] Location-denied path works.
- [ ] PR: `feat/mobile: community feed, votes, comments, profile`.

---

## CP5 — Polish and hardening (20:00–22:00) → Gate G4 (freeze)

1. **Error audit:** trigger every master §5.6 code you can reach and confirm readable messages, no lost input, and a retry button where `retryable` is true.
2. **Loading states:** skeletons on the feed, post detail and comments. Buttons disable while their request is pending.
3. **Image handling:** `expo-image` with `cachePolicy="memory-disk"`. On image load error (an expired signed URL), refetch the post or feed once.
4. **Accessibility:** touch targets at least 44 pt; `accessibilityLabel` on vote buttons ("Upvote, current score 5"), images ("Before photo", "AI reimagined photo") and the brush tools; acceptable contrast.
5. **Visual consistency:** one accent color; "Before" and "AI reimagined" labels on every image pair; the same card radius everywhere.
6. **Devices:** test on at least one iOS and one Android device if available, in both portrait and landscape photos.
7. **Performance:** use thumbnails (`sourceThumbUrl`/`conceptThumbUrl`) in the feed; set `FlatList` `windowSize` and `removeClippedSubviews`.
8. **Freeze:** after 22:00, no new dependencies or features.

**CP5 done when:**
- [ ] Three clean full runs on a real phone in live mode with no crashes.
- [ ] Final PR merged by P4.

---

## CP6 — Demo and submission support (22:00 → 07:00)

1. Record the screen-capture segments for the 3-minute video (master §1.5), using real accounts and real generation. If a prepared backup clip is used, say so in the video.
2. Prepare 2 phones (or a phone plus a simulator) logged into demo1 and demo2.
3. At 05:30, run 3 rehearsals on a fresh install with the final backend URL.
4. Give P4 screenshots for the Devpost gallery: feed, mask, generating, preview, detail with comments.

---

## BK — Backup paths (only if Gate G1 fails)

### BK1 — Continue the Rork code locally (preferred)
1. In Rork, export or sync to GitHub, then copy it into `mobile/` on `feat/mobile`.
2. Run `cd mobile && npm install && npx expo start`. Open it in Expo Go on your phone.
3. Continue the same checkpoints with your local AI agent (Cursor/Claude). Nothing else changes.

### BK2 — Flutter (last resort; same contract, routes and config)
- **Structure:** `mobile-flutter/lib/`:
  - `config.dart` (reads `--dart-define`).
  - `api/` with `api_client.dart` (abstract), `live_api_client.dart` (dio), `fixture_api_client.dart`, `models.dart`, `api_error.dart`.
  - `auth/auth_service.dart` (`auth0_flutter`).
  - `location/location_service.dart` (`geolocator` + `geocoding`).
  - `screens/` and `widgets/` mirroring the RN names.
- **Packages:** `go_router`, `flutter_riverpod`, `dio`, `auth0_flutter`, `flutter_secure_storage`, `image_picker`, `geolocator`, `geocoding`, `uuid`, `cached_network_image`.
- **Mask:** `GestureDetector` + `CustomPainter`. Use `applyBoxFit(BoxFit.contain, imageSize, viewSize)` to get the content rect and emit the **same normalized strokes JSON**.
- **Routes:** `/`, `/create/camera`, `/create/details`, `/post/:id`, `/post/:id/mask|prompt|generating|preview`, `/profile`, `/login`.
- **Auth0 callback:** `whatif://{domain}/android/{package}/callback` and the iOS equivalent. Send these to P4.
- **Acceptance:** the same checklists as CP2–CP5.

---

## W — Web app (after the hackathon; planned now)

1. **Scaffold:** `npm create vite@latest web -- --template react-ts`. Add `react-router-dom`, `@tanstack/react-query` and `@auth0/auth0-react`.
2. **API layer:** copy `mobile/src/api/**` unchanged. Use the `{ file: Blob }` variant of `createPost`.
3. **`web/src/config.ts`:** reads the `VITE_*` vars from master §6.4.
4. **Auth:** `<Auth0Provider domain clientId authorizationParams={{ audience, redirect_uri: window.location.origin, scope: 'openid profile email offline_access' }}>`. Tokens come from `getAccessTokenSilently()`.
5. **Location:** `navigator.geolocation.getCurrentPosition` for the Local tab.
6. **Mask:** a `<canvas>` absolutely positioned over an `<img>`, using pointer events. Normalize with the img's `getBoundingClientRect()` and object-fit math, and send the same strokes JSON.
7. **Routes:** `/` (feed with `?tab=local&sort=hot`), `/create`, `/post/:id`, `/post/:id/mask|prompt|generating|preview`, `/profile`.
8. **Layout:** responsive from 360 to 1440 px. On desktop, the feed grid sits on the left and the detail with comments on the right.
9. **Hosting:** Vercel or Netlify. P4 adds the origin to `CORS_ALLOWED_ORIGINS` and the Auth0 SPA callbacks.

---

## P1 final acceptance checklist
- [ ] The full loop works in fixture mode with the banner.
- [ ] Flipping `EXPO_PUBLIC_API_MODE=live` makes everything work with zero screen changes.
- [ ] Location is captured (GPS or EXIF), and denial is handled gracefully.
- [ ] The mask aligns with the edit on portrait and landscape photos.
- [ ] Local and Global tabs work with Hot/New/Top. The far-away post is Global only.
- [ ] Votes are always consistent with the server; double taps are safe.
- [ ] Comments, replies (one level) and deletes work.
- [ ] Every error code produces a readable message, and input is never lost.
- [ ] Works on a real phone through the tunnel or deploy URL.
