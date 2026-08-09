# JamJade Mobile

Expo customer application for the JamJade Laravel API.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example`.

   Home/LAN mode derives the API host from Expo and uses port `8000`. For defense/demo use, set `EXPO_PUBLIC_BACKEND_TUNNEL_API` to the separate HTTPS tunnel exposing Laravel. Custom API URLs must end with `/api`.

3. Start Laravel so the phone can reach it:

   ```bash
   cd ../backend
   composer run serve-mobile
   ```

   This uses the repository PHP upload configuration: up to 5 MB per
   image and up to 12 MB for a request containing front and back images.

4. Start Expo:

   ```bash
   npm start
   ```

   Use `npm start -- --tunnel` when the phone cannot directly reach the computer running Expo. Expo's tunnel exposes Metro only, so Laravel still needs its own tunnel URL in `EXPO_PUBLIC_BACKEND_TUNNEL_API`.

The API client prefers LAN at home and the configured backend tunnel when Expo is in tunnel mode. If the preferred endpoint cannot connect, it tries the other endpoint and remembers the working one for later requests.

## Defense Tunnel

1. Keep Laravel running with `composer run serve-mobile`.
2. Install and authenticate a current ngrok agent once, then expose Laravel:

   ```bash
   ngrok config add-authtoken YOUR_PRIVATE_TOKEN
   ngrok http 8000
   ```

   The `@expo/ngrok` dependency is used internally by Expo's Metro tunnel.
   Do not use its bundled `node_modules/.bin/ngrok` executable for the
   Laravel tunnel because that legacy agent may no longer be accepted by
   ngrok.
3. Put the HTTPS forwarding URL in `.env.local`, appending `/api`:

   ```bash
   EXPO_PUBLIC_BACKEND_TUNNEL_API=https://your-ngrok-domain.ngrok-free.app/api
   ```

4. Restart Expo with `npm start -- --tunnel --clear`.

## API Structure

- `services/http`: base URL, bearer-token injection, SecureStore persistence, response parsing, and API errors.
- `services/api`: domain-specific API payloads and calls.
- `providers/AuthProvider.tsx`: session restoration and current authenticated user.
- `components/auth/AuthenticatedOnly.tsx`: protection for customer-only route groups.

Web admin authentication remains cookie/CSRF based. Mobile authentication uses Sanctum bearer tokens stored with Expo SecureStore.
