import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/analyze-local-audio.mjs path-to-mp3');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<input type="file">');
  await page.locator('input').setInputFiles(source);
  const result = await page.evaluate(async () => {
    const file = document.querySelector('input').files[0];
    const context = new OfflineAudioContext(1, 1, 22050);
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const rate = buffer.sampleRate,
      length = buffer.length;
    const mono = new Float32Array(length);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) mono[i] += data[i] / buffer.numberOfChannels;
    }
    const size = 1024,
      hop = 220,
      previous = new Float64Array(size / 2),
      frames = [];
    function spectrum(offset) {
      const re = new Float64Array(size),
        im = new Float64Array(size);
      for (let i = 0; i < size; i++)
        re[i] = (mono[offset + i] || 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
      for (let i = 1, j = 0; i < size; i++) {
        let bit = size >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) [re[i], re[j]] = [re[j], re[i]];
      }
      for (let n = 2; n <= size; n *= 2) {
        const angle = (-2 * Math.PI) / n;
        for (let start = 0; start < size; start += n)
          for (let j = 0; j < n / 2; j++) {
            const a = start + j,
              b = a + n / 2,
              wr = Math.cos(angle * j),
              wi = Math.sin(angle * j),
              tr = wr * re[b] - wi * im[b],
              ti = wr * im[b] + wi * re[b];
            re[b] = re[a] - tr;
            im[b] = im[a] - ti;
            re[a] += tr;
            im[a] += ti;
          }
      }
      return re.slice(0, size / 2).map((v, i) => Math.log1p(10 * Math.hypot(v, im[i])));
    }
    for (let offset = 0; offset + size < length; offset += hop) {
      const spec = spectrum(offset);
      let flux = 0,
        low = 0,
        energy = 0;
      for (let k = 2; k < size / 2; k++) {
        const increase = Math.max(0, spec[k] - previous[k]);
        flux += increase;
        if ((k * rate) / size < 250) low += increase;
        previous[k] = spec[k];
      }
      for (let j = 0; j < size; j++) energy += mono[offset + j] ** 2;
      frames.push({
        time: +((offset + size / 2) / rate).toFixed(5),
        flux,
        low,
        rms: Math.sqrt(energy / size),
      });
    }
    return { duration: buffer.duration, sampleRate: rate, hopSeconds: hop / rate, frames };
  });
  result.sha256 = createHash('sha256').update(fs.readFileSync(source)).digest('hex');
  fs.mkdirSync('artifacts', { recursive: true });
  fs.writeFileSync(
    process.argv[3] || 'artifacts/local-audio-analysis.json',
    JSON.stringify(result),
  );
  const peaks = result.frames.filter(
    (f, i, a) => i > 0 && i < a.length - 1 && f.flux > a[i - 1].flux && f.flux >= a[i + 1].flux,
  );
  console.log(
    JSON.stringify(
      {
        duration: result.duration,
        sha256: result.sha256,
        strongest: peaks
          .filter((p) => p.time < 60)
          .sort((a, b) => b.flux - a.flux)
          .slice(0, 35),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
