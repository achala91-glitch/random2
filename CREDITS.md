# Credits

## Sounds

Neither app uses any recorded samples. Every sound is synthesised in the browser:

- **JahanChord:** Tone.js synthesisers and synthesised drum kits.
- **Swarapetti:**
  - **Veena:** a Karplus-Strong plucked string.
  - **Tanpura:** additive synthesis with a jivari formant sweep.
  - **Drums:** modal synthesis for all six (mridangam, tabla, kanjira, ghatam, morsing, thavil).
  - **Other voices:** oscillators shaped by filters.
  - **Reverb:** a generated impulse response.

Because no third-party audio is included, there are no sample licences to list.

## Code

- [Tone.js](https://tonejs.github.io/) (MIT licence): audio framework for JahanChord.
- [Vite](https://vitejs.dev/) (MIT licence): build tool.
- [Playwright](https://playwright.dev/) (Apache 2.0): browser tests only, not shipped.

## Fonts

Loaded from Google Fonts. All are under the SIL Open Font License.

- Space Grotesk and VT323 (JahanChord)
- Cormorant Garamond, Manrope and Noto Sans Tamil (Swarapetti)

## Music and reference material

- The varisais, alankarams and the geetham Sri Gananatha (Purandara Dasa, 16th century) are traditional teaching material in the public domain.
- The sources consulted for ragam scales, talam, gamakas, the drone and the percussion are listed with their trust levels in [docs/carnatic-design.md](docs/carnatic-design.md).
