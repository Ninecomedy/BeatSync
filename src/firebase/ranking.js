// One existing score document per UID; equal best scores retain a stable document ID.
export function rankRows(rows) {
  const best = new Map();
  for (const row of rows) {
    const previous = best.get(row.uid);
    if (!previous || row.score > previous.score ||
        (row.score === previous.score && row.id.localeCompare(previous.id) < 0)) best.set(row.uid, row);
  }
  const sorted = [...best.values()].sort((a,b) => b.score-a.score || a.uid.localeCompare(b.uid));
  let rank = 0;
  return sorted.map((row, i) => {
    if (i === 0 || row.score !== sorted[i - 1].score) rank = i + 1;
    return { ...row, rank };
  });
}
export function bestPerScope(rows) {
  const best = new Map();
  for (const row of rows) {
    const difficulty = row.songId === 'neon-pulse-v1' ? 'normal' : row.difficulty;
    if (!difficulty) continue;
    const key = JSON.stringify([row.songId, difficulty]);
    if (!best.has(key) || row.score > best.get(key).score) best.set(key, { ...row, difficulty });
  }
  return [...best.values()];
}
export function bestPlacement(rows) {
  return (
    [...rows].sort(
      (a, b) =>
        a.rank - b.rank ||
        b.score - a.score ||
        a.songId.localeCompare(b.songId) ||
        a.difficulty.localeCompare(b.difficulty),
    )[0] || null
  );
}
