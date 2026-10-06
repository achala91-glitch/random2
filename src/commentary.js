// "Wife commentary": quiet toasts triggered by things he actually does.
// Rules: at most one every ~3.5 minutes, never while he's playing fast,
// never the same line twice in a session.

const LINES = {
  firstChord: { once: true, lines: ["See? You didn't have to spend 30K on this."] },
  nextDay: { lines: ['Back again? Told you this was enough.', 'You again. The free one is winning, by the way.'] },
  tenMinutes: { lines: ['Ten minutes in and your bank account is still intact. Proud of you.'] },
  thirtyMinutes: { lines: ["Half an hour. I'd call this a hobby now. A free one."] },
  fortyFive: { lines: ["Forty-five minutes. Dinner isn't going to make itself. Just saying."] },
  hour: { lines: ["An hour. If you'd bought the real one you'd still be charging it."] },
  firstLoop: { once: true, lines: ['Your first loop. Somewhere, a ₹30,000 box is feeling very unnecessary.'] },
  loop: { lines: ["Another loop. You're basically a producer now. An unpaid one.", "Loop recorded. I'd clap, but it would end up on the recording."] },
  firstLesson: { once: true, lines: ['Practice a little more and maybe your wife will let you buy the real one.'] },
  lesson: { lines: ['Another lesson done. Who knew you could follow instructions.', "Lesson complete. Don't let it go to your head."] },
  allLessons: { once: true, lines: ['All the lessons. Fine. I take back about forty percent of what I said.'] },
  pop: { lines: ['Congrats, you just played half the songs on the radio.'] },
  sad: { lines: ['The sad version. Should I be worried, or is this just art?'] },
  midnight: { lines: ["It's past midnight, Jahan. The synth will still be here tomorrow."] },
  lateLate: { lines: ["It's nearly 3 a.m. Even the free synth needs sleep."] },
  dim: { lines: ['Ooh, spooky. Okay, I see you.', 'Diminished again. Very dramatic. Very you.'] },
  aug: { lines: ["Augmented. Nobody knows what that one's for, but it sounds expensive."] },
  allPresets: { lines: ['All six sounds tried. Still think you needed to spend 30K?'] },
  firstArp: { once: true, lines: ['The arpeggiator. Now you sound like a video game. Which, to be fair, was the goal.'] },
  firstDrums: { once: true, lines: ['Drums. The neighbours are going to love this.'] },
  tempoMax: { lines: ['160 BPM. Who exactly are you running from?'] },
  tempoMin: { lines: ['60 BPM. Very relaxed. Like your approach to the dishes.'] },
  keyHopping: { lines: ["You can change the key all you like. It's still the same four chords."] },
  dreamy: { lines: ["All these 7ths. Very dreamy. Very 'I have feelings now'."] },
  susHold: { lines: ["You can resolve that sus chord whenever you're ready. I'll wait."] },
  sameChord: { lines: ["That's the same chord twenty times in a row. Bold artistic choice."] },
  maxVolume: { lines: ['Full volume. The building appreciates your art.'] },
  lofiCombo: { lines: ['Lo-fi beats to not buy a synth to.'] },
  drop: { lines: ['Did you just do a drop? In our living room?'] },
};

const COOLDOWN_MS = 210 * 1000; // 3.5 minutes
const PENDING_TTL_MS = 25 * 1000;

export class Commentary {
  constructor({ store, save, show }) {
    this.store = store;
    this.save = save;
    this.show = show;
    this.lastShown = 0;
    this.usedThisSession = new Set();
    this.presses = [];
    this.pending = null;
    setInterval(() => this.flush(), 1500);
  }

  get enabled() { return this.store.settings.commentary; }

  notePress() {
    const now = Date.now();
    this.presses.push(now);
    this.presses = this.presses.filter((t) => now - t < 4000);
  }

  // Playing fast = 4+ chord presses in the last 3 seconds.
  busy() {
    const now = Date.now();
    return this.presses.filter((t) => now - t < 3000).length >= 4;
  }

  pickLine(id) {
    const def = LINES[id];
    if (!def) return null;
    if (def.once && this.store.toastsOnce.includes(id)) return null;
    const fresh = def.lines.filter((l) => !this.usedThisSession.has(l));
    return fresh.length ? fresh[0] : null;
  }

  // Something happened. Show a line if the rules allow it.
  fire(id) {
    if (!this.enabled) return;
    if (!this.pickLine(id)) return;
    if (Date.now() - this.lastShown < COOLDOWN_MS) {
      // "once" moments are worth waiting for; they'll be retried next time they happen.
      return;
    }
    if (!this.pending) this.pending = { id, at: Date.now() };
    this.flush();
  }

  flush() {
    if (!this.pending || !this.enabled) return;
    if (Date.now() - this.pending.at > PENDING_TTL_MS) { this.pending = null; return; }
    if (this.busy()) return; // wait for a breather
    if (Date.now() - this.lastShown < COOLDOWN_MS) { this.pending = null; return; }
    const { id } = this.pending;
    this.pending = null;
    const line = this.pickLine(id);
    if (!line) return;
    this.usedThisSession.add(line);
    if (LINES[id].once) { this.store.toastsOnce.push(id); this.save(); }
    this.lastShown = Date.now();
    this.show(line);
  }

  wouldFire(id) { return this.enabled && !!this.pickLine(id); }
}
