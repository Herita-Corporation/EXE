# CLAUDE.md — Disa Travel Front-End

Guidance for Claude Code (and any other agent) working in this folder.

## What this is

A single **Expo (React Native + TypeScript) app**, run via **Expo Go**, that is
the mobile client for the Disa ecosystem. It talks directly to the three
backend services that are actually implemented today (see
`../Disa-App/disa.md` and the AI-Itinerary spec at
`../AI-Itinerary/instruction.md` for backend details):

| Service | Repo path | Default port | What the app uses it for |
|---|---|---|---|
| **IAMService** | `../Disa-App/IAMService` | `5195` (http) | Register, login, JWT refresh, `/me`, change/forgot/reset password, logout |
| **AITourService** | `../Disa-App/AITour.Presentation` | `5289` (http) | Proxy that forwards itinerary requests (with the caller's JWT) to AI-Itinerary |
| **Task.Presentation** | `../Disa-App/Task.Presentation` | `5020` (http) | Mission templates, assigning missions, submitting photo/location evidence |

`AITourService` itself calls the Python **AI-Itinerary** service
(`../AI-Itinerary`, default port `8000`) — the app never talks to AI-Itinerary
directly, only through AITourService, matching the real architecture
(`Client → AITourService → AI-Itinerary`).

**Not wired up** (see `../Disa-App/disa.md`): `AIService` (generic),
`BlogService`, `BookingService`, `CustomerService`, and the `Disa` API
Gateway are still empty ASP.NET boilerplate with no controllers — there is
nothing for the app to call there yet. When those are implemented, add a new
`ServiceKey` in `src/utils/apiConfigStore.ts` and an `src/api/endpoints/*.ts`
module the same way the three working services are wired.

## Why this structure exists (read before changing the API layer)

- **Expo Go runs on a phone, not this PC.** `localhost` in `.env` only works
  in a simulator on the same machine as the .NET services. For a real device,
  the base URLs must be the dev machine's LAN IP. Because that IP is only
  known once the app is running on the phone's Wi-Fi, base URLs are **not**
  hardcoded: they come from `EXPO_PUBLIC_*` env vars as defaults
  (`src/utils/apiConfigStore.ts`) and can be overridden at runtime from the
  in-app **Settings** screen (`app/settings.tsx`), persisted in
  `AsyncStorage`. Don't "simplify" this into static axios `baseURL`s — that
  regresses the one thing that makes the app usable in Expo Go at all.
- **`src/api/http.ts` is a single `request()` helper, not three axios
  instances.** The base URL is resolved per-call from `apiConfigStore` so a
  Settings change takes effect immediately without recreating clients.
- **Field casing differs by service and is intentional, not inconsistent:**
  - IAM and Task DTOs have no `[JsonPropertyName]` overrides on the C# side,
    so ASP.NET Core's default System.Text.Json camelCase output applies →
    TypeScript types in `src/types/auth.ts` / `src/types/missions.ts` are
    **camelCase**.
  - The AITour ↔ AI-Itinerary itinerary contract
    (`AITour.Infrastructure/ExternalServices/AIItinerary/Models/ItineraryModels.cs`)
    explicitly sets `[JsonPropertyName]` to **snake_case** on every field, to
    match AI-Itinerary's own Pydantic schemas
    (`../AI-Itinerary/app/schemas/*.py`). `src/types/itinerary.ts` mirrors
    that with snake_case. If you add a field on either side, keep the casing
    matching its source DTO — don't "fix" it to be consistent across
    services, that would break deserialization.
- **No "list my itineraries" endpoint exists** on AI-Itinerary (only
  generate / get-by-id / delete-by-id —
  `../AI-Itinerary/app/api/routes/itinerary.py`). The Itinerary tab keeps a
  local history of generated `itinerary_id`s per device
  (`src/utils/itineraryHistory.ts`, AsyncStorage) purely so there's something
  to browse; it is not a substitute for a real backend list endpoint.
- **`user_id` comes from the JWT, not from app state.** IAMService signs the
  user's id into the standard `sub` claim
  (`IAM.Infrastructure/Security/JwtTokenGenerator.cs`); AI-Itinerary and this
  app both read it from there (`src/utils/jwt.ts#decodeJwt`). Email/roles use
  the long `ClaimTypes.*` URIs as keys in the decoded payload (see
  `AuthContext.tsx#userFromToken`) since the token was created with .NET's
  default (unmapped) claim types.
- **Task.Presentation controllers currently have no `[Authorize]`
  attribute.** The app still attaches the Bearer token to every call
  (harmless, and ready for when auth is added there).

## Folder structure

```
Front-End/
├── app/                        # expo-router file-based routes
│   ├── _layout.tsx             # Root providers (ApiConfig, Auth) + Stack
│   ├── index.tsx                # Redirects to (auth) or (tabs) once auth state is known
│   ├── settings.tsx            # Runtime API base URL overrides (modal)
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (tabs)/
│       ├── home.tsx            # Dashboard + live reachability check per service
│       ├── itinerary/
│       │   ├── index.tsx       # Generate form + local history
│       │   └── [id].tsx        # Trip summary, budget breakdown, day-by-day plan
│       ├── missions/
│       │   ├── index.tsx       # Mission templates + "my missions", assign flow
│       │   └── [id].tsx        # Mission detail + photo/location evidence submission
│       └── profile.tsx         # /me info, change password, logout, link to Settings
├── src/
│   ├── api/
│   │   ├── http.ts             # request() — the ONLY place axios is called generically
│   │   └── endpoints/          # One file per backend service (auth, itinerary, missions)
│   ├── types/                  # TS interfaces mirroring each service's C#/Pydantic DTOs
│   ├── context/                # AuthContext (session), ApiConfigContext (base URLs)
│   ├── utils/                  # tokenStore (SecureStore), apiConfigStore (AsyncStorage),
│   │                           # jwt (dependency-free decode), itineraryHistory
│   ├── components/             # Themed primitives: Button, Input, Card, Badge, etc.
│   └── theme/colors.ts
├── app.json / package.json / babel.config.js / tsconfig.json
└── .env.example
```

## Running it

```bash
npm install
npx expo install --fix     # reconciles dependency versions with your installed Expo Go/CLI
cp .env.example .env       # then edit the URLs — see the comments inside
npx expo start
```

Scan the QR code with **Expo Go** (Android/iOS). Phone and PC must be on the
same Wi-Fi network. If a URL was wrong, fix it live from **Profile → ⚙ API
Settings** instead of editing `.env` and restarting.

Backend prerequisites (see each repo's own docs for full setup):
- `AI-Itinerary`: `uvicorn main:app --reload` (or `docker-compose up`), needs
  Postgres + `OPENAI_API_KEY`.
- `IAMService`, `AITourService` (`AITour.Presentation`), `Task.Presentation`:
  each is a normal `dotnet run` project; they expect SQL Server connection
  strings in their `appsettings.json` (see `../Disa-App/*/appsettings.json`).
  Run all three — AITourService also needs `AIItinerary:BaseUrl` in its
  `appsettings.json` pointed at wherever AI-Itinerary is actually reachable
  from that machine.

## Conventions when extending this app

- New backend calls go in `src/api/endpoints/<service>.ts`, calling
  `request(service, path, opts)` from `src/api/http.ts` — never call `axios`
  directly from a screen (the one exception today is the lightweight
  reachability ping in `home.tsx`/`settings.tsx`, which intentionally bypasses
  auth/error handling because it's just a health probe).
- New screens go under `app/` following expo-router's file-based convention;
  shared visuals go in `src/components/`, not inline styles copy-pasted
  across screens.
- No icon/splash image assets are configured in `app.json` on purpose (Expo
  Go falls back to defaults) — add real ones only when the project has actual
  brand assets to use.
