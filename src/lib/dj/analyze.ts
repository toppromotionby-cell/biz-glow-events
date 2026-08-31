// Браузерный акустический анализ: BPM и энергия. Используется только когда
// в тегах и имени файла нет темпа — чтобы не тратить время зря.
// Анализируем окно из середины трека (не более 60 секунд), моно, 11 кГц.

const WINDOW_SEC = 60;
const TARGET_RATE = 11025;

type Analysis = { bpm: number | null; energy: number | null };

/** Онсет-детекция по огибающей + автокорреляция интервалов 60–190 BPM. */
function detectBpm(data: Float32Array, rate: number): number | null {
  const hop = Math.max(1, Math.floor(rate / 100)); // ~10 мс
  const frames = Math.floor(data.length / hop);
  if (frames < 200) return null;

  const env = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) {
    let sum = 0;
    for (let j = 0; j < hop; j += 1) {
      const v = data[i * hop + j] ?? 0;
      sum += v * v;
    }
    env[i] = Math.sqrt(sum / hop);
  }

  // Спектральный поток: только положительные приросты энергии.
  const flux = new Float32Array(frames);
  for (let i = 1; i < frames; i += 1) flux[i] = Math.max(0, (env[i] ?? 0) - (env[i - 1] ?? 0));

  const fps = rate / hop;
  const minLag = Math.round((60 / 190) * fps);
  const maxLag = Math.round((60 / 60) * fps);
  let bestLag = 0;
  let bestScore = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let score = 0;
    for (let i = lag; i < frames; i += 1) score += (flux[i] ?? 0) * (flux[i - lag] ?? 0);
    score /= frames - lag;
    if (score > bestScore) { bestScore = score; bestLag = lag; }
  }
  if (!bestLag || bestScore <= 0) return null;

  let bpm = (60 * fps) / bestLag;
  while (bpm < 70) bpm *= 2;
  while (bpm > 185) bpm /= 2;
  const rounded = Math.round(bpm);
  return rounded >= 60 && rounded <= 200 ? rounded : null;
}

/** Энергия 1..10 по RMS с логарифмическим сжатием. */
function detectEnergy(data: Float32Array): number | null {
  if (!data.length) return null;
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) sum += (data[i] ?? 0) ** 2;
  const rms = Math.sqrt(sum / data.length);
  if (!Number.isFinite(rms) || rms <= 0) return null;
  const db = 20 * Math.log10(rms); // обычно -30…-6 dBFS
  const scaled = Math.round(((db + 32) / 26) * 9) + 1;
  return Math.min(10, Math.max(1, scaled));
}

/** Полный анализ файла. Никогда не бросает — при сбое возвращает пустой результат. */
export async function analyzeAudio(file: Blob, opts: { needBpm: boolean }): Promise<Analysis> {
  if (typeof window === "undefined") return { bpm: null, energy: null };
  try {
    const buf = await file.arrayBuffer();
    const Ctor = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (!Ctor) return { bpm: null, energy: null };

    // Декодируем через короткоживущий контекст, затем ресемплим окно.
    const probe = new Ctor(1, TARGET_RATE, TARGET_RATE);
    const decoded = await probe.decodeAudioData(buf);

    const duration = Math.min(decoded.duration, WINDOW_SEC);
    const offset = Math.max(0, (decoded.duration - duration) / 2);
    const length = Math.ceil(duration * TARGET_RATE);
    const ctx = new Ctor(1, length, TARGET_RATE);
    const src = ctx.createBufferSource();
    src.buffer = decoded;
    src.connect(ctx.destination);
    src.start(0, offset, duration);
    const rendered = await ctx.startRendering();
    const data = rendered.getChannelData(0);

    return {
      bpm: opts.needBpm ? detectBpm(data, TARGET_RATE) : null,
      energy: detectEnergy(data),
    };
  } catch {
    return { bpm: null, energy: null };
  }
}
