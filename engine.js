export const NOTE_NAMES = [
  "C",
  "C♯",
  "D",
  "E♭",
  "E",
  "F",
  "F♯",
  "G",
  "A♭",
  "A",
  "B♭",
  "B",
];
export const SOUNDS = [
  {
    id: "keys",
    name: "Warm Keys",
    description: "Мягкие клавиши с тёплым FM-звучанием.",
    wave: "sine",
    fm: 2,
    index: 1.8,
    decay: 1.8,
    sustain: 0.32,
  },
  {
    id: "piano",
    name: "Soft Piano",
    description: "Синтезированные клавиши с мягкой атакой.",
    wave: "triangle",
    fm: 1,
    index: 0.65,
    decay: 1.2,
    sustain: 0.15,
  },
  {
    id: "pad",
    name: "Analog Pad",
    description: "Широкий аналоговый звук с плавной атакой.",
    wave: "sawtooth",
    detune: 8,
    decay: 2,
    sustain: 0.7,
    attack: 0.25,
  },
  {
    id: "strings",
    name: "Slow Strings",
    description: "Протяжные струнные с лёгкой расстройкой.",
    wave: "sawtooth",
    detune: 13,
    decay: 2,
    sustain: 0.65,
    attack: 0.4,
  },
  {
    id: "organ",
    name: "Pocket Organ",
    description: "Чистые тона, октава и пятая гармоника.",
    wave: "sine",
    organ: true,
    decay: 0.2,
    sustain: 0.9,
  },
  {
    id: "bell",
    name: "Glass Bells",
    description: "Звонкие FM-колокольчики с длинным хвостом.",
    wave: "sine",
    fm: 3.5,
    index: 3,
    decay: 2.5,
    sustain: 0.04,
  },
  {
    id: "harp",
    name: "Plucked Harp",
    description: "Короткий щипок и прозрачное затухание.",
    wave: "triangle",
    fm: 2,
    index: 0.4,
    decay: 0.55,
    sustain: 0.02,
  },
  {
    id: "saw",
    name: "Classic Saw",
    description: "Яркая пила для аккордов и арпеджио.",
    wave: "sawtooth",
    detune: 3,
    decay: 0.5,
    sustain: 0.5,
  },
  {
    id: "square",
    name: "8-bit Square",
    description: "Пульсирующая ностальгия карманных консолей.",
    wave: "square",
    decay: 0.3,
    sustain: 0.45,
  },
  {
    id: "sine",
    name: "Pure Sine",
    description: "Минимальный, округлый синусоидальный звук.",
    wave: "sine",
    decay: 0.5,
    sustain: 0.8,
  },
  {
    id: "bass",
    name: "Round Bass",
    description: "Низкий упругий бас с короткой огибающей.",
    wave: "triangle",
    fm: 1,
    index: 1.2,
    decay: 0.4,
    sustain: 0.35,
    octave: -1,
  },
  {
    id: "sample",
    name: "Your Sample",
    description: "Загрузи или запиши звук в режиме MIC. Опорная нота — C4.",
    sample: true,
  },
];
export const MODES = [
  ["play", "Play", "Аккорд звучит, пока ты удерживаешь кнопку."],
  ["strum", "Strum", "Ноты появляются по очереди, как при ударе по струнам."],
  ["lead", "Lead", "Одна нота вместо аккорда — для мелодий."],
  [
    "drone",
    "Drone",
    "Устойчивый фон из тоники и квинты. Новая кнопка сменит аккорд.",
  ],
  ["arp", "Arp", "Ноты аккорда звучат по очереди в заданном темпе."],
  ["repeat", "Repeat", "Ритмическое повторение целого аккорда."],
  ["seq", "Sequencer", "Создай и запусти последовательность из восьми шагов."],
  ["drums", "Drums", "Семь синтезированных ударных под твоими пальцами."],
  ["beat", "Beat", "Семь ритмических рисунков. Нажми кнопку для запуска."],
  ["hiro", "Chord Hiro", "Играй подсказанную последовательность аккордов."],
  ["trainer", "Ear Trainer", "Услышь аккорд и найди его на панели."],
  ["tuner", "Tuner", "Настрой инструмент через микрофон браузера."],
  ["mic", "Mic Sample", "Запиши или загрузи свой звук и играй им на клавишах."],
  ["mixer", "Mixer", "Управляй громкостью и отключением записанных дорожек."],
];
export function chordFor(degree, s, modifier = s.voicing) {
  const scale =
    s.scale === "minor" ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const at = (i) => scale[i % 7] + Math.floor(i / 7) * 12;
  const root = 48 + s.key + scale[degree] + s.octave * 12;
  let intervals = [
    0,
    at(degree + 2) - scale[degree],
    at(degree + 4) - scale[degree],
  ];
  const minor = intervals[1] === 3,
    dim = intervals[2] === 6;
  let suffix = dim ? "dim" : minor ? "m" : "maj";
  const variants = {
    flip: [[0, minor ? 4 : 3, 7], minor ? "maj" : "m"],
    seventh: [
      [...intervals, minor ? 10 : 11],
      dim ? "m7♭5" : minor ? "m7" : "maj7",
    ],
    ninth: [
      dim ? [0, 3, 6, 10] : [...intervals, minor ? 10 : 11, 14],
      dim ? "m7♭5" : minor ? "m9" : "maj9",
    ],
    dom: [[0, 4, 7, 10], "7"],
    sus4: [[0, 5, 7], "sus4"],
    sixth: [minor ? [0, 2, 7] : [0, 4, 7, 9], minor ? "sus2" : "6"],
    dim: [dim ? [0, 3, 7] : [0, 3, 6], dim ? "m" : "dim"],
    aug: [[0, 4, 8], "aug"],
  };
  if (variants[modifier]) [intervals, suffix] = variants[modifier];
  let notes = intervals.map((n) => root + n);
  for (let i = 0; i < s.inversion; i++) notes.push(notes.shift() + 12);
  if (s.bass) notes.unshift(root - 12);
  return {
    notes,
    root,
    name: NOTE_NAMES[((root % 12) + 12) % 12] + suffix,
    short:
      NOTE_NAMES[((root % 12) + 12) % 12] + (suffix === "maj" ? "" : suffix),
  };
}
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.voices = new Set();
    this.recording = false;
    this.sample = null;
    this.captureReady = false;
  }
  async init() {
    if (this.pending) return this.pending;
    this.pending = this.setup();
    return this.pending;
  }
  async setup() {
    this.ctx = new AudioContext({ latencyHint: "interactive" });
    const c = this.ctx;
    this.input = c.createGain();
    this.filter = c.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 8000;
    this.filter.Q.value = 0.6;
    this.input.connect(this.filter);
    this.live = c.createGain();
    this.filter.connect(this.live);
    this.reverb = c.createConvolver();
    const impulse = c.createBuffer(2, c.sampleRate * 2.6, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.6);
    }
    this.reverb.buffer = impulse;
    this.reverbGain = c.createGain();
    this.reverbGain.gain.value = 0.28;
    this.filter
      .connect(this.reverb)
      .connect(this.reverbGain)
      .connect(this.live);
    this.delay = c.createDelay(2);
    this.delay.delayTime.value = 0.3;
    this.feedback = c.createGain();
    this.feedback.gain.value = 0.32;
    this.delayGain = c.createGain();
    this.delayGain.gain.value = 0.16;
    this.filter.connect(this.delay).connect(this.feedback).connect(this.delay);
    this.delay.connect(this.delayGain).connect(this.live);
    this.chorus = c.createDelay(0.1);
    this.chorus.delayTime.value = 0.018;
    this.chorusLfo = c.createOscillator();
    this.chorusLfo.frequency.value = 0.8;
    this.chorusDepth = c.createGain();
    this.chorusDepth.gain.value = 0.004;
    this.chorusLfo.connect(this.chorusDepth).connect(this.chorus.delayTime);
    this.chorusLfo.start();
    this.chorusGain = c.createGain();
    this.chorusGain.gain.value = 0;
    this.filter
      .connect(this.chorus)
      .connect(this.chorusGain)
      .connect(this.live);
    this.tremolo = c.createGain();
    this.tremolo.gain.value = 1;
    this.tremLfo = c.createOscillator();
    this.tremLfo.frequency.value = 4;
    this.tremDepth = c.createGain();
    this.tremDepth.gain.value = 0;
    this.tremLfo.connect(this.tremDepth).connect(this.tremolo.gain);
    this.tremLfo.start();
    this.live.connect(this.tremolo);
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -12;
    this.limiter.knee.value = 12;
    this.limiter.ratio.value = 6;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.2;
    this.tremolo.connect(this.limiter);
    this.master = c.createGain();
    this.master.gain.value = 0.65;
    this.outputLimiter = c.createDynamicsCompressor();
    this.outputLimiter.threshold.value = -2;
    this.outputLimiter.knee.value = 0;
    this.outputLimiter.ratio.value = 20;
    this.outputLimiter.attack.value = 0.002;
    this.outputLimiter.release.value = 0.12;
    this.limiter
      .connect(this.master)
      .connect(this.outputLimiter)
      .connect(c.destination);
    this.analyser = c.createAnalyser();
    this.analyser.fftSize = 1024;
    this.outputLimiter.connect(this.analyser);
    this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const noise = this.noise.getChannelData(0);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
    try {
      await c.audioWorklet.addModule("./recorder-worklet.js");
      this.recorder = new AudioWorkletNode(c, "hichord-recorder");
      this.limiter.connect(this.recorder);
      this.recorder.connect(c.destination);
      this.recorder.port.onmessage = ({ data }) => {
        if (data.left) {
          this.chunks.push(data);
          this.onChunk?.(data);
        }
        if (data.done && this.finishRecord) {
          this.finishRecord(this.mergeChunks());
          this.finishRecord = null;
        }
      };
      this.captureReady = true;
    } catch (error) {
      this.captureError = error;
    }
    await c.resume();
    return this;
  }
  async resume() {
    await this.init();
    await this.ctx.resume();
  }
  configure(s) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.volume / 100, t, 0.02);
    this.reverbGain.gain.setTargetAtTime(s.reverb / 100, t, 0.02);
    this.delayGain.gain.setTargetAtTime(s.delay / 100, t, 0.02);
    this.filter.frequency.setTargetAtTime(s.filter, t, 0.02);
    this.delay.delayTime.setTargetAtTime(30 / s.bpm, t, 0.05);
    this.chorusGain.gain.setTargetAtTime(s.chorus / 180, t, 0.02);
    this.tremolo.gain.setTargetAtTime(1 - s.tremolo / 200, t, 0.02);
    this.tremDepth.gain.setTargetAtTime(s.tremolo / 200, t, 0.02);
    this.tremLfo.frequency.setTargetAtTime(s.bpm / 30, t, 0.02);
  }
  note(midi, s, time = this.ctx.currentTime, duration = null, velocity = 1) {
    const c = this.ctx,
      p = SOUNDS.find((x) => x.id === s.sound) || SOUNDS[0],
      t = Math.max(time, c.currentTime),
      frequency = 440 * Math.pow(2, (midi + (p.octave || 0) * 12 - 69) / 12),
      env = c.createGain(),
      oscillators = [];
    env.connect(this.input);
    const level = 0.105 * velocity,
      attack = Math.max(s.attack, p.attack || 0.005);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(level, t + attack);
    env.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, level * (p.sustain || 0.2)),
      t + attack + (p.decay || 1),
    );
    const addOsc = (ratio, wave, amp = 1, detune = 0) => {
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = wave;
      o.frequency.value = frequency * ratio;
      o.detune.value = detune;
      g.gain.value = amp;
      o.connect(g).connect(env);
      o.start(t);
      oscillators.push(o);
      return o;
    };
    if (p.sample && this.sample) {
      const source = c.createBufferSource();
      source.buffer = this.sample;
      source.playbackRate.value = Math.pow(2, (midi - 60) / 12);
      source.connect(env);
      source.start(t);
      oscillators.push(source);
    } else {
      const o = addOsc(1, p.wave || "sine", p.detune ? 0.5 : 1, p.detune || 0);
      if (p.detune) addOsc(1, p.wave, 0.5, -p.detune);
      if (p.organ) {
        addOsc(2, "sine", 0.45);
        addOsc(3, "sine", 0.18);
      }
      if (p.fm) {
        const mod = c.createOscillator(),
          g = c.createGain();
        mod.frequency.value = frequency * p.fm;
        g.gain.setValueAtTime(frequency * p.index, t);
        g.gain.exponentialRampToValueAtTime(1, t + (p.decay || 1));
        mod.connect(g).connect(o.frequency);
        mod.start(t);
        oscillators.push(mod);
      }
    }
    let stopped = false;
    const voice = {
      stop: (at = c.currentTime) => {
        if (stopped) return;
        stopped = true;
        const end = Math.max(t, at),
          release = s.release || 0.6;
        env.gain.cancelAndHoldAtTime(end);
        env.gain.setTargetAtTime(0.00001, end, release / 5);
        for (const o of oscillators) {
          try {
            o.stop(end + release + 0.05);
          } catch {}
        }
        setTimeout(
          () => {
            env.disconnect();
            for (const o of oscillators) o.disconnect();
            this.voices.delete(voice);
          },
          Math.max(0, (end + release + 0.1 - c.currentTime) * 1000),
        );
      },
    };
    this.voices.add(voice);
    if (duration !== null) voice.stop(t + duration);
    return voice;
  }
  drum(index, time = this.ctx.currentTime) {
    const c = this.ctx,
      t = Math.max(time, c.currentTime),
      g = c.createGain();
    g.connect(this.input);
    let source;
    const durations = [0.5, 0.2, 0.13, 0.055, 0.35, 0.25, 0.5],
      length = durations[index];
    if ([0, 4, 5].includes(index)) {
      source = c.createOscillator();
      source.type = "sine";
      const freq = [140, 0, 0, 0, 180, 120][index];
      source.frequency.setValueAtTime(freq, t);
      source.frequency.exponentialRampToValueAtTime(
        index === 0 ? 42 : freq * 0.45,
        t + length,
      );
      source.connect(g);
    } else {
      source = c.createBufferSource();
      source.buffer = this.noise;
      const f = c.createBiquadFilter();
      f.type = index === 1 ? "bandpass" : "highpass";
      f.frequency.value = index === 1 ? 1800 : index === 6 ? 4000 : 6500;
      source.connect(f).connect(g);
    }
    g.gain.setValueAtTime(index === 0 ? 0.7 : 0.32, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    source.start(t);
    source.stop(t + length + 0.02);
    source.onended = () => {
      source.disconnect();
      g.disconnect();
    };
  }
  click(accent = false, time = this.ctx.currentTime) {
    const c = this.ctx,
      o = c.createOscillator(),
      g = c.createGain();
    o.frequency.value = accent ? 1400 : 950;
    g.gain.setValueAtTime(0.045, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
    o.connect(g).connect(this.master);
    o.start(time);
    o.stop(time + 0.05);
    o.onended = () => {
      g.disconnect();
      o.disconnect();
    };
  }
  stopAll() {
    for (const voice of this.voices) voice.stop();
  }
  startCapture() {
    if (!this.captureReady)
      throw new Error(
        "Запись недоступна: открой сайт через HTTPS или localhost.",
      );
    this.chunks = [];
    this.recording = true;
    this.recorder.port.postMessage("start");
  }
  stopCapture() {
    this.recording = false;
    return new Promise((resolve) => {
      this.finishRecord = resolve;
      this.recorder.port.postMessage("stop");
    });
  }
  mergeChunks() {
    const length = this.chunks.reduce((n, c) => n + c.left.length, 0);
    const buffer = this.ctx.createBuffer(
      2,
      Math.max(1, length),
      this.ctx.sampleRate,
    );
    let offset = 0;
    for (const chunk of this.chunks) {
      buffer.getChannelData(0).set(chunk.left, offset);
      buffer.getChannelData(1).set(chunk.right, offset);
      offset += chunk.left.length;
    }
    this.chunks = [];
    return buffer;
  }
}
export function encodeWav(buffer) {
  const n = buffer.length,
    channels = buffer.numberOfChannels,
    raw = new ArrayBuffer(44 + n * channels * 2),
    v = new DataView(raw);
  const text = (offset, s) => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  v.setUint32(4, 36 + n * channels * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, buffer.sampleRate, true);
  v.setUint32(28, buffer.sampleRate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, n * channels * 2, true);
  let offset = 44;
  for (let i = 0; i < n; i++)
    for (let ch = 0; ch < channels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      v.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
      offset += 2;
    }
  return new Blob([raw], { type: "audio/wav" });
}
