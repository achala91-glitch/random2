# Aurolab Sales Assistant

Two self-contained static pages. No server, no build step, no API keys. Open either file by double-clicking it, or put the folder on any static host.

- `index.html`: the sales rep chat app (mobile first)
- `admin.html`: the admin console (desktop)
- `aurolab_knowledge_base.json`: the source knowledge base, already embedded in both pages

## Sign-in

The login is set by three constants at the top of the `<script>` in both files:

```js
const DEMO_EMAIL = "test@aurolab.com";
const DEMO_PASSWORD = "testlab12345";
const DEMO_NAME = "Aurolab Rep";
```

Change them in both files to use a different login.

## Rep app to admin loop

Both pages share `localStorage` when opened from the same place (same folder or same host). Questions asked in the rep app count towards the admin dashboard, and questions it cannot answer show up under "Gaps to fill".
