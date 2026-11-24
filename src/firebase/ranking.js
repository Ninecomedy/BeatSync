// Competition ranking counts score entries, consistently with the leaderboard.
export function rankRows(rows) {
  let rank = 0;
  return rows.map((row, i) => {
    if (i === 0 || row.score !== rows[i - 1].score) rank = i + 1;
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
