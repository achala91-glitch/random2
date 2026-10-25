# JahanChord and Swarapetti

Two instruments in one repo, both free, offline-capable web apps for iPad, phones and laptops.

- **JahanChord** (`/`): a pocket chord synth. Seven always-in-key chord buttons, a joystick that colours the chord, looper, drums, arpeggiator and lessons.
- **Swarapetti** (`/swarapetti/`): a Carnatic melody instrument. The seven swaras of any ragam (72 melakartas, 37 janyas), gamakas on the stick, a tanpura or shruti box drone set in kattai, talam with mridangam and five other percussion instruments, a looper, and lessons in the traditional order. Design notes and sources: [docs/carnatic-design.md](docs/carnatic-design.md).

## JahanChord

A pocket chord synth for the iPad. Seven buttons that are always in key, a joystick that colours the chord, a looper, drums, an arpeggiator, and short lessons that light up the button to play next.

## Run it locally

```bash
npm install
npm run dev               # JahanChord, also on your network so you can try it on the iPad
npm run dev:swarapetti    # Swarapetti
npm run build             # builds both into dist/ (Swarapetti goes to dist/swarapetti)
```

## Tests

```bash
npm run test:theory  # prints every button x joystick direction in 6 keys and checks it against music theory
npm run build && npx vite preview --port 4173 &
npm run test:ipad    # drives the app at iPad sizes with real multi-touch, saves screenshots to shots/
npm run test:joystick                       # joystick maths (shared by both apps)
node scripts/joystick-browser-test.mjs http://localhost:4173/ jahanchord              # mouse-only and touch
node scripts/joystick-browser-test.mjs http://localhost:4173/swarapetti/ swarapetti
npm run test:swarapetti                     # Carnatic theory (ragams, talam, gamakas) and sound rendering
node swarapetti/tests/browser.test.mjs shots   # Swarapetti in the browser: pitch of every voice, gamakas, talam, looper, lessons, layouts
```

## Laptop controls (both apps)

The joystick works with touch, mouse and trackpad. Turn on **Latch** (the lock button, or press L) and the stick stays where you leave it, so you can set it with the trackpad and then play the buttons. Tap the centre of the stick or double-click it to bring it back.

| Keys | JahanChord | Swarapetti |
|---|---|---|
| 1 to 7 | chord buttons | Sa to Ni |
| 8 | | upper Sa |
| Arrows or WASD | stick | stick |
| L | latch | latch |
| T | | start or stop the talam |

## Put it online for free (Netlify, about 5 minutes)

1. On your computer, run `npm install` and then `npm run build`. This makes a `dist` folder.
2. Go to https://app.netlify.com/drop and sign up (free).
3. Drag the `dist` folder onto the page. Netlify gives you a link like `https://something-random.netlify.app`.
4. Optional: in Site settings, rename it to something like `jahanchord.netlify.app`.

To update it later, build again and drag the new `dist` folder onto the same site's Deploys page.

Alternative: connect this GitHub repo in Netlify ("Add new site" then "Import an existing project"), with build command `npm run build` and publish directory `dist`. It then redeploys on every push.

## Or publish it on GitHub Pages

This repo has a workflow (`.github/workflows/deploy.yml`) that builds and publishes the app on every push.

1. On GitHub, open the repo, then **Settings**, then **Pages**.
2. Under "Build and deployment", set **Source** to **GitHub Actions**.
3. Open the **Actions** tab, pick "Deploy to GitHub Pages", and click **Run workflow** (or just push a commit).
4. When it goes green, the apps are live at:
   - JahanChord: https://achala91-glitch.github.io/random2/
   - Swarapetti: https://achala91-glitch.github.io/random2/swarapetti/

## Add it to the iPad home screen

1. Open the link in **Safari** (it has to be Safari). Each app is added separately and gets its own icon.
2. Tap the Share button (square with an arrow), then **Add to Home Screen**, then **Add**.
3. Open it from the new icon. It runs full screen with no browser bars, and works offline after the first visit.
