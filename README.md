# AlansChat
A premium, real-time communication platform engineered with Next-Gen React, Socket.IO, Clerk Authentication, and modern Tailwind CSS glassmorphism.

## Features
- **Real-time Live Chat**: Instant messaging powered by WebSockets.
- **Swipe-to-Reply Kinematics**: Unique touch/mouse dragging physics to natively reply to messages.
- **CRUD Message Controls**: Hover over your own messages to Edit or Delete them directly from the database in real-time.
- **Live Typing Presence**: Real-time broadcast of typing and construction indicators.
- **Micro-Animations**: Butter-smooth micro-interactions, scale-ins, and radial glow effects.

## Local Development

### Requirements
- Node.js & pnpm
- Valid MongoDB Cluster URI
- Clerk Publishable & Secret Keys

### Setup
1. Duplicate `.env.example` to `.env.local` inside `client/` and `.env` inside `server/`, filling in your production or test keys.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run the complete mono-repo concurrently:
   ```bash
   pnpm run dev
   ```

## Production Deployment

**Frontend (Vercel / Netlify):**
1. Connect your GitHub repository to Vercel.
2. Set the root directory to `client`.
3. Add `VITE_CLERK_PUBLISHABLE_KEY` to the environment variables.
4. Deploy.

**Backend Server (Render / Railway):**
1. Connect your GitHub repository to Render as a "Web Service".
2. Set root directory to `server`.
3. Build Command: `pnpm install && pnpm run build`
4. Start Command: `pnpm start`
5. Add `CLERK_SECRET_KEY` and `MONGODB_URI` to Environment Variables.
6. Deploy.

---
*Engineered for flawless speed, security, and fluid user experience.*
