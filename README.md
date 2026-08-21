# Chai Baarish Gaane

Old Hindi songs, layered Indian weather and warm chai on a cinematic veranda.

## Local development

Install dependencies and run the combined static + realtime server:

```bash
npm install
npm run dev
```

Open `http://localhost:4173`. Set `PORT` to use another port.

## Chai Pe Chat

Chat uses Socket.IO and server memory only. The server retains at most 150 recent messages; messages, reactions, reports and presence reset whenever the Node process restarts. There is no database or authentication. A visitor's display name is stored only in their browser under `cbg-chai-chat-name`.

For production, run `server.js` on one long-running WebSocket-capable Node instance. The included `render.yaml` pins one Render web-service instance in Singapore, uses Node 22, runs `npm start`, and checks `/health`.

Backend environment variables:

- `PORT`: supplied by the host; local fallback is `4173`.
- `CHAT_ALLOWED_ORIGINS`: comma-separated frontend origins (production: `https://baarishfm.vercel.app`).
- `CHAT_BLOCKED_WORDS`: optional comma-separated replacement for the small default blocked-word list.

After the backend is live on HTTPS, put its origin (for example, `https://chai-pe-chat.onrender.com`) in the `cbg-chat-server` meta tag in `index.html`, then redeploy the Vercel frontend. Local frontend origins continue to work with `http://localhost:4173` without source edits.

The existing Vercel static deployment continues serving the frontend; it should not host this persistent Socket.IO process. Chat state remains memory-only and requires exactly one backend instance—multiple replicas would create separate message/presence rooms. A Render free web service can sleep when idle, so use a paid always-on instance if cold starts are unacceptable.
