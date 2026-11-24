export const KEYS = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
export const HIT_WINDOW = 0.15;
export class RhythmEngine {
  constructor(map) {
    this.notes = map.notes.map((n) => ({ ...n, judged: false, active: false }));
    this.score = this.combo = this.maxCombo = this.perfect = this.good = this.miss = 0;
    this.judgement = 'GET READY';
  }
  finish(note, grade) {
    if (note.judged) return;
    note.judged = true;
    note.active = false;
    this[grade]++;
    if (grade === 'miss') {
      this.combo = 0;
      this.judgement = 'MISS';
      return;
    }
    this.score += grade === 'perfect' ? 1000 : 500;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.judgement = grade.toUpperCase();
  }
  advance(time) {
    for (const note of this.notes) {
      if (note.judged) continue;
      if (note.active) {
        // Audio sample-clock subtraction can round an exact tail a few ulps early.
        if (time + 1e-9 >= note.endTime) this.finish(note, note.headGrade);
      } else if (time - note.time > HIT_WINDOW + 1e-9) this.finish(note, 'miss');
    }
  }
  hit(lane, time) {
    this.advance(time);
    const note = this.notes.find(
      (n) =>
        !n.judged && !n.active && n.lane === lane && Math.abs(n.time - time) <= HIT_WINDOW + 1e-9,
    );
    if (!note) return false;
    const grade = Math.abs(note.time - time) <= 0.06 + 1e-9 ? 'perfect' : 'good';
    if (note.endTime !== undefined && note.endTime > note.time) {
      // A late press after the tail cannot satisfy a hold, even inside the head window.
      if (time + 1e-9 >= note.endTime) {
        this.finish(note, 'miss');
        return false;
      }
      note.active = true;
      note.headGrade = grade;
      this.judgement = 'HOLD';
    } else this.finish(note, grade);
    return true;
  }
  release(lane, time) {
    this.advance(time); // Release at/after the exact tail completes before checking early release.
    for (const note of this.notes) if (note.active && note.lane === lane) this.finish(note, 'miss');
  }
  reconcileHeld(lanes, time) {
    for (const note of this.notes)
      if (note.active && !lanes.has(note.lane)) this.release(note.lane, time);
  }
  get activeLanes() {
    return [...new Set(this.notes.filter((n) => n.active).map((n) => n.lane))];
  }
  result() {
    return Object.fromEntries(
      ['score', 'maxCombo', 'perfect', 'good', 'miss'].map((k) => [k, this[k]]),
    );
  }
}
