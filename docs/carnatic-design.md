# Swarapetti: Carnatic design notes

This document records what was researched before building Swarapetti, which sources were trusted and how far, and how each finding maps into the app. All theory described here is checked by unit tests in `swarapetti/tests/`.

## 1. The idea

JahanChord is a chord instrument. Carnatic music is melodic, so Swarapetti does not port chords. It translates the idea instead:

| JahanChord | Swarapetti |
|---|---|
| 7 buttons = the 7 diatonic chords of a key | 7 keys = the 7 swaras of the ragam (plus an upper Sa key) |
| Every button stays in key | Every key stays in the ragam; swaras the ragam doesn't use are dimmed and silent |
| Joystick colours the chord (7th, sus, add9) | Joystick: up/down change sthayi, the six side directions are gamakas |
| Key + tempo | Shruti (kattai) + talam |
| Drum machine | Mridangam and five other percussion instruments, per talam and nadai |

## 2. How the research was done, and how much to trust it

### What was possible from this environment

The build environment's network policy only allows a few hosts (package registries, GitHub, Google Fonts). Wikipedia, karnatik.com, shivkumar.org and other reference sites were refused by policy, so pages could not be read directly. Research was done through a web search service that returns quoted extracts from those pages. Every scale and fact below was taken from those extracts. Where the extracts didn't settle something, it is marked here, and in the code, rather than filled in from memory.

### Sources, and how each was used

| Source | Used for | Trust |
|---|---|---|
| Wikipedia raga articles (Mohanam, Hindolam, Abhogi, Madhyamavati, Shree ranjani, Bilahari, Kedaragaula, Anandabhairavi, Sahana, Revati, Shuddha Saveri, Arabhi, Shree, Bhairavi, Saveri, Malahari, Nata, Gaula, Kalyanavasantam, Vasantha, Amritavarshini, Hamsanandi, Mukhari, Kapi, Atana, Kedaram, Shivaranjani, Valaji, Yadukulakamboji, Dhanyasi, Harikambhoji, Natabhairavi, Chalanata, Ratnangi, Kalyani) | Arohanam, avarohanam and parent of each janya | High: consistent infoboxes, cross-checked against a second source where one turned up |
| Wikipedia: Janya, Udayaravichandrika, Gamaka (music), Tanpura, Mridangam | Nalinakanti scale, Shuddha Dhanyasi swaras, gamaka definitions, tanpura tuning, stroke descriptions | High for definitions; stroke details cross-checked (see §7) |
| C. V. Raman's work on Indian drums, via "The eigenspectra of Indian musical drums" (arXiv 0809.1320) | The mridangam's nearly harmonic overtones | High |
| NCERT music textbook (Grade 8) and Darbar's "Carnatic Rhythms 101" | Laghu, drutam and Rupaka talam | High |
| carnaticrhythmblog, rasikas.org threads, Upbeat Labs primer | Chapu talam groupings and gestures | Medium: these agree on groupings, but not fully on gestures |
| Artium Academy, sriramv.com, Jayanthi Kumaresh's blog, Suja Music, Mysore Vadiraj's blog, ipassio, Karya (solkattu software docs) | Second opinions on scales, Kanada's avarohanam, Hamir Kalyani, mridangam strokes, sarali/janta varisai | Medium |
| shivkumar.org lesson pages (via search extracts), NIOS Carnatic Music course material | Dhatu varisai, sarali varisai shapes | Medium-high |
| shanmukhapriya.com, vignanam.org, dhanyasy.org (via search extracts) | Opening phrases of the geetham Sri Gananatha | Medium: only short phrases were visible |
| rasikas.org forum, tamilbrahmins.com, carnaticguitar blog | Kattai to Western mapping | Medium, but every source agreed |

## 3. Swaras and swarasthanas

**Finding.** Seven swaras (Sa Ri Ga Ma Pa Dha Ni). Sa and Pa are fixed. Twelve positions (swarasthanas) carry sixteen names, because four positions have two names: G1 = R2, R3 = G2, N1 = D2, D3 = N2.

**In the app.** `src/theory/swaras.js` lists all sixteen names with their positions and full names (Shuddha Rishabham, Sadharana Gandharam and so on). The display shows the current swara as S, R2, G3 and so on, with a dot above for mel sthayi and below for mandra. Settings can switch to Tamil script (ஸ ரி க ம ப த நி) and can add Western note names. Lesson 2 shows the full table of twelve positions.

**Tuning.** Carnatic pitch is fluid and shaped by gamaka, but against a drone the resting points sit close to simple ratios. The app offers **Natural** tuning (5-limit just ratios: Pa 3/2, M1 4/3, G3 5/4 and so on), which is the default because it blends with the tanpura, and **Equal tempered**, which matches a harmonium or keyboard. The drone's Pa is always a pure 3/2.

## 4. Shruti: kattai

**Finding.** Kattai numbering follows the harmonium keyboard. Whole kattais are the white keys from C (1 = C, 2 = D, 3 = E, 4 = F, 5 = G, 6 = A, 7 = B), and half kattais are the black keys (1½ = C♯, 2½ = D♯, 4½ = F♯, 5½ = G♯, 6½ = A♯). There is no 3½ or 7½. Modern electronic shruti boxes use A = 440 Hz. A forum source gives typical male Sa as about ½ to 2½ kattai.

**In the app.** Twelve kattais, A4 = 440 Hz. A "register" setting puts Sa in octave 3 (C3 to B3, the default) or octave 4. Fine tuning runs to ±50 cents. The shruti panel shows the Western equivalent and the frequency (for example "C♯3 · 138.6 Hz"). The default is 1½ kattai. Tests check every kattai's note name and frequency, including that +100 cents of fine tuning equals the next half kattai.

## 5. Ragams

### Melakartas

**Finding.** There are 72 melakartas with all seven swaras in order, in 12 chakras of 6 (Indu, Netra, Agni, Veda, Bana, Rutu, Rishi, Vasu, Brahma, Disi, Rudra, Aditya):
- 1 to 36 use M1 and 37 to 72 use M2.
- Within each half, the chakra fixes the Ri-Ga pair and the position within the chakra fixes the Dha-Ni pair. Both cycle through R1G1, R1G2, R1G3, R2G2, R2G3, R3G3.
- The names encode their numbers by the katapayadi system.

**In the app.** `src/theory/melakarta.js` *generates* every mela's swaras from its number. Only the 72 names are typed by hand, in the common modern scheme. Tests check:
- **Reference melas:** 18 melas against a separately typed table, including 15 Mayamalavagowla, 22 Kharaharapriya, 28 Harikambhoji, 29 Dheerashankarabharanam, 36 Chalanata, and 65 Mechakalyani.
- **Structure:** every chakra assignment and the M1/M2 rule, and that all 72 scales are distinct.
- **Katapayadi:** the first two syllables of 58 names reproduce their numbers. Names that begin with conjunct consonants are skipped, because their readings are irregular.

### Janya ragams (37)

All of the following come from the sources in §2. They're stored in `src/theory/ragams.js` and repeated in a separately typed reference table in the tests.

Mohanam, Hamsadhwani, Hindolam, Abhogi, Madhyamavati, Sriranjani, Bilahari, Kedaragowla, Anandabhairavi, Begada, Kambhoji, Sahana, Hamir Kalyani, Revati, Shuddha Dhanyasi, Shuddha Saveri, Arabhi, Sri, Kanada, Bhairavi, Saveri, Malahari, Nattai, Gowla, Kalyana Vasantam, Vasanta, Amritavarshini, Hamsanandi, Mukhari, Kapi, Nalinakanti, Atana, Kedaram, Shivaranjani, Valaji, Yadukula Kambhoji, Dhanyasi.

Notes on the less certain ones:
- **Begada:** the arohanam (S G3 R2 G3 M1 P D2 P Ṡ) is confirmed by several sources. The avarohanam is the commonly taught Ṡ N3 D2 P M1 G3 R2 S, but sources mention debate about it, so it is flagged `unverified` in the data.
- **Hamir Kalyani:** the scale comes from a teaching blog plus flashcard material. There is no encyclopaedia entry to cross-check it against. It uses both madhyamams, so it is declared bhashanga with M1 as an anya swara.
- **Anandabhairavi:** Wikipedia places it under 22 Kharaharapriya (its scale notes match 22), while other sources place it under 20 Natabhairavi. The app shows 22 and mentions both.
- **Kanada:** its avarohanam (Ṡ N2 Ṡ D2 P M1 G2 M1 R2 S) comes from one detailed source (sriramv.com).
- **Valaji:** parent shown as 16 Chakravakam, as on Wikipedia. Its swaras are also a subset of 28.
- **Nalinakanti:** parent shown as 27 Sarasangi. Its swaras fit that mela.
- **Kambhoji:** stored with its characteristic phrase S N3 P D2 S (kakali nishadam as an anya swara).

Spellings follow one consistent transliteration across the app (for example Kambhoji, Gowla, Kalyana Vasantam).

Tests check that every janya:
- starts and ends on Sa;
- uses only swaras from its parent mela or declared anya swaras;
- declares anya swaras that really are outside the parent;
- has its classification right in spot checks (Mohanam audava-audava, Bilahari audava-sampurna, Nattai sampurna-audava, Sahana, Begada and Kanada vakra).

### Ragams that aren't simple seven-note scales

This was the most important design problem. The app handles it with four mechanisms:

1. **Dimming.** A letter (Sa..Ni) the ragam never uses is dimmed and silent: Ma and Ni in Mohanam, Ri and Ma in Valaji. There are no wrong notes.
2. **Direction.** Each key press compares the new swara with the previous one. Moving up, the arohanam is read; moving down, the avarohanam. So Bhairavi's Dha plays D2 going up and D1 coming down, and Kapi's Ni plays N3 up and N2 down. The key shows both (for example "D₂↑ D₁↓").
3. **Path following.** The app remembers where the phrase is within each list and looks for the next occurrence of the swara from there. This resolves ragams that use the same letter twice on one side, like Hamir Kalyani's "P M2 M1 G3 P M1 R2 S".
   - **Vakra continuation:** if the swara is the very next token on the path being followed, the app stays on that path even when the step goes the other way. That's how Kapi's "N2 D2 N2" and Sahana's "P M1 D2" resolve correctly.
4. **Off-path swaras.** A swara that only exists in the other direction (Ma going up in Bilahari) still plays, using that direction's swarasthana, so that free playing never stops dead.
   - **Path hints:** small ▲ ▼ arrows on the keys show where the arohanam and avarohanam go next from the swara just played. In vakra ragams this teaches the zig-zag (in Sahana, after Pa going up, the ▲ is on Ma).

Tests play phrases through this logic and check the swarasthanas: Bhairavi, Kapi, Mohanam, Bilahari up and down, Hamir Kalyani's full avarohanam, and mandra sthayi in Mayamalavagowla. The geetham's closing phrase is also checked: Malahari's G3 only appears coming down.

### The ragam picker

The picker has search (by name, short name such as Kalyani or Shankarabharanam, number, or parent) and an All / Melakarta / Janya filter. Melakartas are grouped by chakra with their numbers, and janyas show their parent. Every row shows the arohanam and avarohanam.

## 6. Gamakas and the stick

**Finding.** Kampitam (oscillation) is described as *the* defining Carnatic gamaka. Other gamakas found in the sources:
- **Jaru:** ettra (ascending) and irakka (descending) slides.
- **Nokku:** a stress from the note above.
- **Odukkal:** a stress from the note below.
- **Orikkai:** a flick up to a higher note at the end of the main note.
- **Sphuritam:** a stress on the second of a janta pair, touching the note below.
- Others are listed in older texts (andolam, tripuchcha, ahatam, pratyahatam and more).

**Choice.** Up and down change sthayi, as specified. The six side directions get the six gamakas that are most characteristic and that sound natural as pitch contours on a digital voice:

| Direction | Gamaka | Contour |
|---|---|---|
| → right | Kampitam | Dwell on the swara, rise to the next ragam swara above, dwell, fall, repeating about 4 times a second for as long as the key is held |
| ← left | Nokku | Start on the swara above, hold briefly, fall onto the swara |
| ↗ up-right | Etra jaru | Slide up into the swara from two ragam swaras below |
| ↘ down-right | Irakka jaru | Slide down into the swara from two ragam swaras above |
| ↖ up-left | Orikkai | Hold the swara, flick up to the next swara on release |
| ↙ down-left | Sphuritam | A quick dip to the swara below and back; on janta swaras this gives the classic stress |

Neighbours come from the ragam itself: the next swara above in the arohanam, the next below in the avarohanam. So a kampitam on Ga swings to Ma in Shankarabharanam, but to Pa in Mohanam. Very wide intervals are capped (to 320 cents for neighbours, 520 for jaru) so gamakas stay musical.

Moving the stick while a swara is held applies the new gamaka from the pitch the note is at, with no jump. The latch keeps one gamaka for a whole phrase. Contours are S-curves (`src/theory/gamaka.js`), scheduled on the voices' pitch parameters (`src/audio/contour.js`). Tests check every gamaka's start, end and extremes. A browser test measures the real output: kampitam on Ga moves between Ga and Ma, and jaru slides up into Pa.

**Upper Sa key.** Varisais constantly reach the upper Sa, so there is an eighth key, Ṡ. It saves holding the stick up for that one note.

## 7. Talam

**Findings.**
- A laghu is a clap followed by finger counts (little, ring, middle), and a drutam is a clap followed by a wave (veechu).
- **Adi:** 8 beats = laghu of 4 + drutam + drutam: clap, 1, 2, 3, clap, wave, clap, wave.
- **Rupakam** (chatusra jati): drutam + laghu = 6 aksharas, written O |4. One practice guide counts Rupakam as three beats ("ta ki ta"). The app shows the six-akshara form and the lesson notes the other.
- **Misra Chapu:** 7 beats grouped 3 + 2 + 2, with gestures on beats 1, 4 and 6 ("ta ki ta ta ka di mi"). Some sources describe it as 3 + 4. The app uses 3 + 2 + 2, with a clap on 1, 4 and 6 and silent counts between.
- **Khanda Chapu:** 5 beats, 2 + 3 or 2 + 1 + 2, often written 0 U 0 (drutam, anudrutam, drutam). The app uses that reading: clap, wave, clap, clap, wave.
- **Nadai** divides each beat: chatusram 4, tisram 3, khandam 5.
- **Kalam** is the speed of the swaras against the talam: 1, 2 or 4 swaras a beat in practice.

**In the app.** The talam strip shows each beat as its kriya (a clap, a hand with 1, 2 or 3 fingers, or a wave) and marks the current beat with a gentle brass pulse. The avartanam count is shown alongside. The clock schedules ahead on the audio timeline, with no drift. Kalam scales both the lesson guide and the percussion (the pattern plays two or four times per avartanam).

**Honest caveat.** Sources agree on the groupings, but not entirely on the exact hand shapes for the chapu talams. Check them with a teacher.

## 8. Percussion

### Mridangam strokes

Sources disagree on which hand plays some strokes (tha in particular). The app follows the most common description:

| Stroke | Head | How | Sound |
|---|---|---|---|
| Tha | Left (thoppi) | Palm, closed | Damped low slap |
| Thi / dhi | Right (valanthalai) | Middle, ring and little fingers on the centre of the black patch | Damped |
| Thom | Left | Open | Resonant bass |
| Nam | Right | Index finger on the rim, ring finger resting near the black patch | Ringing, at the drum's pitch |
| Dhin | Right | Open stroke on the black patch | Deep, sustained fundamental |
| Chapu | Right | Little finger between the black patch and the rim | Bright ringing overtone |
| Gumki | Left | Bass with the wrist pressing the skin | Pitch glides upward |
| Ki | Right | Light middle-finger touch | Short and soft |

**Synthesis.** Raman showed that the right head's loading makes its first modes nearly harmonic. So each right-head stroke is a set of harmonic partials at the drum's pitch (tuned to Sa), with stroke-specific balance and decay: dhin is fundamental-heavy, chapu third-harmonic-heavy, thi heavily damped. Left-head strokes are low partials, with an upward pitch bend for gumki. Tests check that dhin rings at Sa, that gumki bends upward, and that thi is short.

### The other instruments

- **Tabla:** dayan tuned to Sa (na, tin, tun, tit, te), bayan (ge with and without bend, ke).
- **Kanjira:** membrane modes with the circular-membrane ratios, plus a jingle of high metallic partials; bass bends.
- **Ghatam:** mouth bass ("gumm", with bend), bright short rings on the body and neck, slap.
- **Morsing:** a narrow-pulse reed at Sa through two moving formants (each stroke a different mouth shape).
- **Thavil:** a stick boom on one head and a thimble crack on the other.

Every pattern is written in mridangam strokes and mapped to each drum's nearest equivalent.

### Patterns

These are built per talam and nadai in a sarvalaghu spirit:
- a full stroke (thom) on samam;
- a bass stroke (gumki) at the start of each anga;
- flowing nam and dhin strokes in between;
- a small fill on the last beat.

They are practice accompaniment patterns, not transcriptions of particular artists.

## 9. The drone

**Findings.**
- **Tanpura:** four strings tuned Pa (lower) Sa Sa Sa (lower octave), plucked in that order ("5-8-8-1") with a short pause before the cycle repeats. The first string can be tuned to Ma or Ni depending on the ragam.
- **Jivari:** the buzzing, overtone-rich sound comes from the wide, curved bridge, with a cotton thread (also called jivari) between string and bridge.
- **Shruti box:** reeds and bellows, set to drones such as Sa Pa Sa.

**In the app.**
- **Tanpura:** each string is rendered as harmonic partials (up to about 9.5 kHz) whose balance is shaped by a formant that sweeps from bright to warm as the note rings. That's the "moving overtone" sound of the jivari. Each partial also breathes slowly.
  - **Order:** the strings are plucked Pa, Sa, Sa, lower Sa, with a longer gap after the lower Sa.
  - **First string:** for ragams without Pa it automatically becomes Ma (or Ni). Settings can override this.
  - **Tests:** check tuning, and that the sound is brighter early than late.
- **Shruti box:** paired reeds (two oscillators each, a few cents apart, so they beat gently) with a narrow-pulse reed tone, a soft lower Sa for body, and a slow, slightly irregular bellows breath. It offers Sa Pa Sa, Sa Ma Sa and Sa Ni Sa; Ma and Ni use the ragam's own swarasthana (M1 or M2, N2 or N3).
- **Controls:** drone volume and on/off. A quiet visualiser draws the drone's waveform.

## 10. Melody voices

**Approach.** No samples are used. CC0 Carnatic recordings could not be downloaded from this environment, and synthesis has two real advantages for this instrument:
- gamakas need continuous pitch movement, which samples handle poorly;
- the whole app works offline at about 34 KB of compressed script.

**Veena.** A Karplus-Strong plucked string, rendered in JavaScript at the exact pitch of each note in about 5 ms:
- bright excitation, shaped by a pluck position near the bridge;
- a decay that shortens for higher notes;
- a gentle bridge nonlinearity (brighter while loud).

Gamakas deflect the string by changing the playback rate, without replucking. Pressing a new key while another is held slides on the same pluck, as a veena player does.

The other voices are live oscillators, with continuous pitch control:

| Voice | Design |
|---|---|
| Violin | Bowed-string waveform, body resonances (around 290 Hz and the 2.8 kHz bridge hill), bow-hair noise through the body, a slight bow-pressure shimmer; slurs glide |
| Flute (venu) | Mostly fundamental, breath noise focused around the note and following the pitch, a chiff at the start, gentle breath movement; an octave up |
| Nadaswaram | A bright double-reed waveform, soft saturation and nasal formants; an octave up |
| Harmonium | Two reeds a few cents apart plus a lower reed bank, gentle bellows movement |
| Keyboard | A soft lead with a filter that closes after the attack, gliding like a pitch bend |
| Voice "aa" | A glottal source through the formants of the vowel "aa", with a few cents of natural unsteadiness and a little breath |

In-browser tests measure every voice playing Pa. All seven are within 3 cents of the expected frequency.

## 11. Learn module

Lessons follow the traditional order:
1. Sa, shruti and choosing a kattai.
2. The swaras and swarasthanas.
3. Varisais and alankarams in Mayamalavagowla.
4. Gamakas.
5. Ragams.
6. Talam.
7. Making your own tune.
8. A geetham.

Each exercise can be played **step by step** (the guide waits for each swara and gives gentle, specific feedback) or **with talam** (the keys light in time from the next samam and the result is summarised kindly). Gamaka lessons play a demonstration first, then check that the right stick direction is used.

**Exercises.**
- **Sarali varisai 1 to 4 and janta varisai 1:** from teaching sources.
- **Dhatu varisai:** the first line ("s m g m | r g | s r || s g r g | s r | g m") is from published notation, and the second line's opening ("r p m p") matches another source. The app generates the rest by moving the same two shapes up and back down, and only the first four lines are used in the lesson.
- **Alankarams:** the chatusra and tisra jati eka talam alankarams. These are the stepped patterns described by the sources.

**The geetham.** Sri Gananatha (Lambodara) is by Purandara Dasa (16th century), in Malahari and Rupakam. It is public domain. Only two phrases could be confirmed against published notation:
- the pallavi opening: M P | D Ṡ Ṡ Ṙ || Ṙ Ṡ | D P M P;
- a closing phrase: R M | P D M P || D P | M G R S.

The lesson teaches those and says plainly that the full geetham should be learnt from a teacher or a printed book. Nothing beyond what could be checked is presented as traditional notation.

## 12. Things to check with a teacher

- Begada's avarohanam and Hamir Kalyani's scale (see §5).
- The chapu talam gestures (see §7).
- Whether the gamaka contours (speed and width of kampitam, length of jaru) feel right for the ragams you play. They are deliberately moderate defaults.
- The geetham: the app only includes the two confirmed phrases.
