// osu!mania object timestamps are milliseconds relative to AudioFilename, not beat offsets.
// Spec: https://osu.ppy.sh/wiki/en/Client/File_formats/osu_(file_format)
export function parseMania4K(text, leadIn = 4) {
  const sections = {};
  let section;
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    if (/^\[.+\]$/.test(line)) {
      section = line.slice(1, -1);
      sections[section] = [];
    } else if (section) sections[section].push(line);
  }
  const values = (name) =>
    Object.fromEntries(
      (sections[name] || [])
        .filter((l) => l.includes(':'))
        .map((l) => {
          const i = l.indexOf(':');
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        }),
    );
  const general = values('General'),
    difficulty = values('Difficulty'),
    metadata = values('Metadata');
  if (Number(general.Mode) !== 3 || Number(difficulty.CircleSize) !== 4)
    throw new Error('Import requires native osu!mania Mode: 3 and CircleSize: 4');
  if (!general.AudioFilename) throw new Error('Missing AudioFilename');
  let holdCount = 0,
    lastEnd = 0;
  const notes = (sections.HitObjects || [])
    .map((line) => {
      const fields = line.split(','),
        x = Number(fields[0]),
        ms = Number(fields[2]),
        type = Number(fields[3]);
      if (
        !Number.isFinite(x) ||
        x < 0 ||
        x > 512 ||
        !Number.isInteger(ms) ||
        ms < 0 ||
        !Number.isInteger(type)
      )
        throw new Error('Invalid hit object');
      let endTime;
      if (type & 128) {
        const end = Number(fields[5]?.split(':')[0]);
        if (!Number.isFinite(end) || end < ms) throw new Error('Invalid hold end');
        endTime = Number((leadIn + end / 1000).toFixed(3));
        holdCount++;
        lastEnd = Math.max(lastEnd, end / 1000);
      } else if (!(type & 1)) throw new Error('Unsupported object type in native mania chart');
      lastEnd = Math.max(lastEnd, ms / 1000);
      return {
        time: Number((leadIn + ms / 1000).toFixed(3)),
        lane: Math.min(3, Math.floor((x * 4) / 512)),
        ...(endTime === undefined ? {} : { endTime }),
      };
    })
    .sort((a, b) => a.time - b.time || a.lane - b.lane);
  if (!notes.length) throw new Error('No hit objects');
  const seen = new Set();
  for (const n of notes) {
    const key = n.time + ':' + n.lane;
    if (seen.has(key)) throw new Error('Duplicate lane/time object');
    seen.add(key);
  }
  return {
    notes,
    holdCount,
    lastEnd,
    audioFilename: general.AudioFilename,
    mode: 3,
    circleSize: 4,
    creator: metadata.Creator,
    version: metadata.Version,
    beatmapId: metadata.BeatmapID,
    beatmapSetId: metadata.BeatmapSetID,
  };
}
