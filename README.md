# JahanChord

A pocket chord synth for the iPad. Seven buttons that are always in key, a joystick that colours the chord, a looper, drums, an arpeggiator, and short lessons that light up the button to play next.

## Run it locally

```bash
npm install
npm run dev          # opens on your network too, so you can try it on the iPad
npm run build        # production build into dist/
```

## Tests

```bash
npm run test:theory  # prints every button x joystick direction in 6 keys and checks it against music theory
npm run build && npx vite preview --port 4173 &
npm run test:ipad    # drives the app at iPad sizes with real multi-touch, saves screenshots to shots/
```

## Put it online for free (Netlify, about 5 minutes)

1. On your computer, run `npm install` and then `npm run build`. This makes a `dist` folder.
2. Go to https://app.netlify.com/drop and sign up (free).
3. Drag the `dist` folder onto the page. Netlify gives you a link like `https://something-random.netlify.app`.
4. Optional: in Site settings, rename it to something like `jahanchord.netlify.app`.

To update it later, build again and drag the new `dist` folder onto the same site's Deploys page.

Alternative: connect this GitHub repo in Netlify ("Add new site" then "Import an existing project"), with build command `npm run build` and publish directory `dist`. It then redeploys on every push.

## Add it to the iPad home screen

1. Open the link in **Safari** (it has to be Safari).
2. Tap the Share button (square with an arrow), then **Add to Home Screen**, then **Add**.
3. Open it from the new icon. It runs full screen with no browser bars, and works offline after the first visit.
