// Lessons, in the traditional order of learning. Steps:
//  read      - text to read, then Next
//  do        - something to do in the app; moves on when it happens (wait)
//  exercise  - play along: the keys light up in order. "Step by step" waits for
//              each swara; "With talam" lights them in time and gives feedback.
//  demo      - listen first (the app plays it), then try it step by step
import {
  SARALI, JANTA_1, DHATU_1, ALANKARAM_CHATUSRA_EKA, ALANKARAM_TISRA_EKA, GEETHAM_OPENING, GEETHAM_CADENCE,
} from './theory/exercises.js';

// The first four lines of dhatu varisai (the rest follows the same pattern).
const DHATU_START = DHATU_1.split('||').slice(0, 4).join('||') + '||';

export const LESSONS = [
  {
    id: 'shruti',
    title: 'Sa, shruti and the drone',
    blurb: 'Find your Sa and let the tanpura hold it.',
    steps: [
      { type: 'read', title: 'Everything begins with Sa', html: '<p>In Carnatic music every swara is measured from one note, Sa (shadjam). Sa is not a fixed pitch: each musician chooses the Sa that suits their voice or instrument, and the whole ragam is built on it.</p><p>The drone, or shruti, holds Sa (and usually Pa) underneath the music so the ear always knows where home is. A tanpura does this with four plucked strings; a shruti box does it with reeds and bellows.</p>' },
      { type: 'read', title: 'Kattai', html: '<p>Pitch is named in <b>kattai</b>, from the harmonium keyboard: 1 kattai is C, and each white key upward is the next kattai (2 is D, 3 is E, 4 is F, 5 is G, 6 is A, 7 is B). The black keys are the half kattais: 1½ is C♯, 2½ is D♯, 4½ is F♯, 5½ is G♯, 6½ is A♯.</p><p>Many men sing around 1 to 2½ kattai. Choose what lets you sing Sa comfortably, with room to go up to the next Sa and down to the Pa below.</p>' },
      { type: 'do', html: '<p>Use the <b>+</b> and <b>−</b> buttons in the Shruti panel to try a few kattais. Listen for the one where Sa feels easy and full.</p>', wait: 'kattai', highlight: '.kattai' },
      { type: 'do', html: '<p>Make sure the drone is on and set to <b>Tanpura</b>. Listen to the four strings: Pa, Sa, Sa, then the lower Sa, again and again.</p>', wait: 'drone-tanpura', highlight: '.p-drone' },
      { type: 'exercise', html: '<p>Now play Sa with the drone. Hold each swara for four beats and listen to how it blends. Then Pa, then the upper Sa, and home to Sa.</p>', ragam: 'mela-15', talam: 'adi', kalam: 1, tempo: 60, notation: "s , , , p , , , | s' , , , s , , , ||" },
      { type: 'read', title: 'Fine tuning', html: '<p>If your instrument or a recording sits between two kattais, use <b>Fine tune</b> to move Sa by cents (a hundredth of a semitone). The Western note and its frequency are shown under the kattai.</p>' },
    ],
  },
  {
    id: 'swaras',
    title: 'The swaras and the 12 swarasthanas',
    blurb: 'Seven swaras, twelve positions, sixteen names.',
    steps: [
      { type: 'read', title: 'Seven swaras', html: '<p>The seven swaras are Sa, Ri, Ga, Ma, Pa, Dha and Ni (shadjam, rishabham, gandharam, madhyamam, panchamam, dhaivatam, nishadam). Sa and Pa never change. Each of the other five can sit in more than one position.</p>' },
      { type: 'read', title: 'Twelve positions, sixteen names', table: true, html: '<p>Within one octave there are twelve swarasthanas. Four of them carry two names, which is why sixteen swara names fit onto twelve positions:</p>' },
      { type: 'do', html: '<p>Press the keys and watch the display: in <b>Mayamalavagowla</b> (melakarta 15) you hear R1, G3, M1, D1 and N3. Play a few swaras, then move on.</p>', wait: 'play:5', ragam: 'mela-15' },
      { type: 'do', html: '<p>Open the ragam picker (the ragam name at the top), choose <b>Kharaharapriya</b> (melakarta 22) and play the same keys. The same Ri now sounds as R2, Ga as G2. Same keys, different swarasthanas.</p>', wait: 'ragam:mela-22', highlight: '#ragamBtn' },
      { type: 'exercise', html: '<p>Back in Mayamalavagowla, play up and down the ragam. The upper Sa is the eighth key (or hold the stick up while you press Sa).</p>', ragam: 'mela-15', talam: 'adi', kalam: 1, tempo: 66, notation: SARALI[0] },
    ],
  },
  {
    id: 'varisai',
    title: 'Varisais and alankarams',
    blurb: 'The exercises every student begins with.',
    steps: [
      { type: 'read', title: 'Why varisais', html: '<p>Sarali varisai, janta varisai, dhatu varisai and the alankarams are the first exercises taught, traditionally in Mayamalavagowla and Adi talam. They train the ear to place each swara accurately and the hand to keep talam. Practise each one slowly first, then with the talam, then in second kalam (two swaras a beat).</p>' },
      { type: 'exercise', title: 'Sarali varisai 1', ragam: 'mela-15', talam: 'adi', kalam: 1, tempo: 66, notation: SARALI[0], html: '<p>Up and down the ragam, one swara a beat.</p>' },
      { type: 'exercise', title: 'Sarali varisai 2', ragam: 'mela-15', talam: 'adi', kalam: 1, tempo: 66, notation: SARALI[1], html: '<p>Turning back at Ri before going on.</p>' },
      { type: 'exercise', title: 'Sarali varisai 3', ragam: 'mela-15', talam: 'adi', kalam: 1, tempo: 66, notation: SARALI[2], html: '<p>Turning back at Ga.</p>' },
      { type: 'exercise', title: 'Sarali varisai 4', ragam: 'mela-15', talam: 'adi', kalam: 1, tempo: 66, notation: SARALI[3], html: '<p>Turning back at Ma.</p>' },
      { type: 'exercise', title: 'Janta varisai 1', ragam: 'mela-15', talam: 'adi', kalam: 1, tempo: 66, notation: JANTA_1, html: '<p>Every swara twice. Give the second of each pair a gentle stress; later you can add sphuritam (stick down-left) on it.</p>' },
      { type: 'exercise', title: 'Dhatu varisai 1', ragam: 'mela-15', talam: 'adi', kalam: 1, tempo: 60, notation: DHATU_START, html: '<p>Leaping between swaras. These are the first four lines; the exercise continues the same shapes up to the upper Sa and back down.</p>' },
      { type: 'exercise', title: 'Alankaram, chatusra jati eka talam', ragam: 'mela-15', talam: 'chatusra-eka', kalam: 1, tempo: 72, notation: ALANKARAM_CHATUSRA_EKA, html: '<p>Groups of four, each starting one swara higher, in a four-beat eka talam.</p>' },
      { type: 'exercise', title: 'Alankaram, tisra jati eka talam', ragam: 'mela-15', talam: 'tisra-eka', kalam: 1, tempo: 72, notation: ALANKARAM_TISRA_EKA, html: '<p>The same idea in groups of three, in a three-beat eka talam.</p>' },
    ],
  },
  {
    id: 'gamakas',
    title: 'Gamakas',
    blurb: 'What each direction of the stick does.',
    steps: [
      { type: 'read', title: 'The life of a swara', html: '<p>A gamaka is the movement that gives a swara its character: an oscillation, a slide, a touch of the swara above or below. In Carnatic music the plain note is often less important than how you move into it and around it.</p><p>On Swarapetti the stick does this. <b>Up</b> takes you to mel sthayi (the upper octave) and <b>down</b> to mandra sthayi (the lower octave). The other six directions are gamakas. Hold the direction, then press the key. You can also move the stick while a swara is sounding.</p>' },
      { type: 'demo', title: 'Kampitam (right)', ragam: 'mela-29', tempo: 60, notation: 'g~r , , , ||', html: '<p>Kampitam is the oscillation between a swara and the swara above it, the defining gamaka of Carnatic music. Listen to Ga in Shankarabharanam swinging towards Ma, then try it: push the stick right and hold Ga.</p>' },
      { type: 'demo', title: 'Nokku (left)', ragam: 'mela-29', tempo: 60, notation: 'm r~l , g ||', html: '<p>Nokku is a stress from above: the swara above is touched lightly before you land. Listen, then try: stick left, then Ri.</p>' },
      { type: 'demo', title: 'Jaru (up-right and down-right)', ragam: 'mela-29', tempo: 60, notation: 'p~ur , , , g~dr , , , ||', html: '<p>Jaru is a slide. <b>Up-right</b> slides up into the swara (etra jaru); <b>down-right</b> slides down into it (irakka jaru). Listen to Pa reached from below, then Ga reached from above.</p>' },
      { type: 'demo', title: 'Orikkai (up-left)', ragam: 'mela-29', tempo: 60, notation: 'r g p~ul , ||', html: '<p>Orikkai is a quick flick up to the next swara as a note ends. Hold the stick up-left, play Pa, and listen for the flick when you let go.</p>' },
      { type: 'demo', title: 'Sphuritam (down-left)', ragam: 'mela-29', tempo: 60, notation: 'g g~dl m m~dl ||', html: '<p>Sphuritam is a light pressure from the swara below, heard most clearly on the second of two repeated swaras (janta). Play Ga twice, the second time with the stick down-left.</p>' },
      { type: 'read', title: 'A word on taste', html: '<p>Gamakas belong to ragams: Shankarabharanam welcomes kampitam on Ga and Ni, while some ragams prefer their swaras plain. Listen to great musicians in the ragam you are playing and let them guide which gamakas you use and where. Latch the stick (the lock button, or L on a keyboard) when you want to keep one gamaka for a whole phrase.</p>' },
    ],
  },
  {
    id: 'ragams',
    title: 'Ragams',
    blurb: 'Melakartas, janyas, and why a ragam is more than a scale.',
    steps: [
      { type: 'read', title: 'The melakarta system', html: '<p>The 72 melakarta ragams contain all seven swaras in order, going up and coming down. They are arranged in 12 chakras of 6. The first 36 use shuddha madhyamam (M1) and the second 36 prati madhyamam (M2). Within each half, the chakra fixes the Ri and Ga, and the position inside the chakra fixes the Dha and Ni. Each melakarta\'s name also encodes its number, through the katapayadi system.</p>' },
      { type: 'read', title: 'Janya ragams', html: '<p>Janya ragams are derived from a melakarta (their parent). They may leave swaras out (audava: five swaras, shadava: six), take a zig-zag path (vakra), use different swaras going up and coming down, or borrow a swara from outside the parent (bhashanga).</p><p>The <b>arohanam</b> is the ascending order and the <b>avarohanam</b> the descending. Swarapetti follows both: keys for swaras the ragam does not use are dimmed and silent, and where the two directions differ, the key gives the right swara for the way your phrase is moving.</p>' },
      { type: 'do', html: '<p>Choose <b>Mohanam</b> in the ragam picker. Notice that Ma and Ni are dimmed: Mohanam uses only five swaras.</p>', wait: 'ragam:janya-mohanam', highlight: '#ragamBtn' },
      { type: 'exercise', html: '<p>Play the arohanam and avarohanam of Mohanam.</p>', ragam: 'janya-mohanam', talam: 'adi', kalam: 1, tempo: 66, notation: "s r g p | d s' | s' , || s' d p g | r s | s , ||" },
      { type: 'exercise', html: '<p>Now <b>Bhairavi</b>. Its Dha is chatushruti (D2) going up and shuddha (D1) coming down. Watch the display as you play this phrase: the same key gives two different swaras.</p>', ragam: 'janya-bhairavi', talam: 'adi', kalam: 1, tempo: 60, notation: "p d n s' | n d | p , ||" },
      { type: 'read', title: 'More than a scale', html: '<p>Two ragams can share the same swaras and still sound entirely different. A ragam is defined by its characteristic phrases (prayogas), the gamakas its swaras take, the swaras it rests on (nyasa) and dwells on (jiva swaras), and the way it moves. The arohanam and avarohanam are only the outline. Listen to compositions in a ragam to learn its true shape.</p>' },
    ],
  },
  {
    id: 'talam',
    title: 'Talam',
    blurb: 'Counting Adi talam with the hand.',
    steps: [
      { type: 'read', title: 'Keeping talam with the hand', html: '<p>Talam is kept with the hand: a clap (on the thigh or the other palm), finger counts, and a wave (veechu, turning the palm up).</p><p><b>Adi talam</b> has eight beats: a laghu of four (clap, little finger, ring finger, middle finger) and two drutams (clap, wave; clap, wave). The first beat, samam, is where the cycle (avartanam) begins.</p>' },
      { type: 'do', html: '<p>Press <b>Talam</b> to start Adi talam, and follow the gestures in the talam strip with your hand: clap, 1, 2, 3, clap, wave, clap, wave.</p>', wait: 'talam-on', highlight: '#talamPlay', talam: 'adi' },
      { type: 'exercise', html: '<p>Play Sa on every beat with the talam, counting with your other hand.</p>', ragam: 'mela-15', talam: 'adi', kalam: 1, tempo: 64, notation: 's s s s | s s | s s || s s s s | s s | s s ||', timedOnly: true },
      { type: 'exercise', html: '<p>Second kalam: two swaras in each beat, the talam at the same speed.</p>', ragam: 'mela-15', talam: 'adi', kalam: 2, tempo: 56, notation: SARALI[0] },
      { type: 'read', title: 'Other talams', html: '<p><b>Rupakam</b> here is a drutam and a four-beat laghu (six beats: clap, wave, clap, 1, 2, 3). <b>Misra Chapu</b> has seven beats grouped 3 + 2 + 2, and <b>Khanda Chapu</b> five beats grouped 2 + 1 + 2. Nadai is how each beat is divided: chatusram in four, tisram in three, khandam in five. Try them with the selectors and listen to the mridangam follow.</p>' },
    ],
  },
  {
    id: 'compose',
    title: 'Making your own tune',
    blurb: 'Choose a ragam, set the talam, build and vary a phrase.',
    steps: [
      { type: 'read', title: 'Start small', html: '<p>A good tune begins with a short phrase that sits comfortably in the ragam. Let the arrows on the keys guide you: they show where the arohanam and avarohanam go next from the swara you just played.</p>' },
      { type: 'do', html: '<p>Choose a ragam you love. Mohanam, Hamsadhwani, Madhyamavati and Hindolam are friendly places to begin.</p>', wait: 'ragam-change', highlight: '#ragamBtn' },
      { type: 'do', html: '<p>Start the talam (Adi talam, first kalam, at a relaxed tempo).</p>', wait: 'talam-on', highlight: '#talamPlay' },
      { type: 'read', title: 'Build a phrase', html: '<p>Play a phrase that fills one avartanam (eight beats) and ends on a strong swara such as Sa or Pa. Then make a second phrase that answers it. Sing it if you can; the ear learns faster than the hand.</p>' },
      { type: 'do', html: '<p>Record it: press <b>Rec</b>. Recording begins on the next samam. Play your two phrases, then press <b>Rec</b> again. It will repeat in time with the talam.</p>', wait: 'loop', highlight: '.looper' },
      { type: 'do', html: '<p>Now develop it. While the loop plays, play the same phrase again with a gamaka on one swara (kampitam on a long note works beautifully), or end it on a different swara.</p>', wait: 'gamaka', highlight: '.p-stick' },
      { type: 'read', title: 'What you just did', html: '<p>You stated an idea and then varied it, which is how much of Carnatic manodharma (improvisation) grows: phrase, answer, and gentle development within the ragam.</p>' },
    ],
  },
  {
    id: 'geetham',
    title: 'Sri Gananatha',
    blurb: 'The first geetham, in Malahari.',
    steps: [
      { type: 'read', title: 'The first geetham', html: '<p><b>Sri Gananatha</b> (also known as Lambodara) is by Purandara Dasa, the 16th century composer often called the father of Carnatic music. It is in ragam <b>Malahari</b> and Rupakam talam, and it is usually the first song a student learns after the varisais.</p><p>Malahari: arohanam S R1 M1 P D1 Ṡ, avarohanam Ṡ D1 P M1 G3 R1 S. Ga appears only coming down.</p><p class="small-note">Sahityam (opening): Śrī gaṇanātha sindhūra varṇa karuṇā sāgara karivadana</p>' },
      { type: 'exercise', title: 'Opening phrase', html: '<p>The opening of the pallavi, rising to the upper Sa and Ri and settling on Pa.</p>', ragam: 'janya-malahari', talam: 'rupakam', kalam: 1, tempo: 60, notation: GEETHAM_OPENING },
      { type: 'exercise', title: 'Closing phrase', html: '<p>A phrase that brings lines home to Sa. Notice that Ga sounds as you come down, as Malahari asks.</p>', ragam: 'janya-malahari', talam: 'rupakam', kalam: 1, tempo: 60, notation: GEETHAM_CADENCE },
      { type: 'read', title: 'Learning the whole geetham', html: '<p>These two phrases are the parts we could check against published notation. Learn the full geetham from a teacher or a printed book, line by line, singing the sahityam with the swaras. When you know it, play it here with the talam and enjoy it.</p>' },
    ],
  },
];

export const TIPS = [
  'Set your Sa before anything else. Every swara is measured from it.',
  'Play a swara and hold it against the tanpura. Listen until it settles.',
  'Practise slowly first. Speed comes by itself.',
  'A ragam is more than its scale. Listen to how great musicians move between its swaras.',
  'Push the stick right and hold a long note for kampitam.',
  'Keep talam with your other hand while you play. It steadies everything.',
  'Try the same phrase in first and second kalam.',
  'When a swara sounds wrong, it is often a gamaka that is missing, not the note.',
  'Latch the stick with the lock button to keep one gamaka for a whole phrase.',
  'Record a phrase with the looper and play an answer over it.',
];

export function tipOfTheDay(d = new Date()) {
  const day = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  return TIPS[day % TIPS.length];
}
