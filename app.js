import {
  AudioEngine,
  NOTE_NAMES,
  SOUNDS,
  MODES,
  chordFor,
  encodeWav,
} from "./engine.js";
const $ = (id) => document.getElementById(id),
  $$ = (query) => [...document.querySelectorAll(query)];
const defaults = {
  key: 0,
  scale: "major",
  octave: 0,
  voicing: "base",
  inversion: 0,
  bass: false,
  sound: "keys",
  mode: "play",
  volume: 65,
  reverb: 28,
  delay: 16,
  filter: 8000,
  attack: 0.015,
  release: 0.6,
  chorus: 0,
  tremolo: 0,
  bpm: 100,
  rate: 2,
  pattern: "up",
  latch: false,
};
let saved = {};
try {
  saved = JSON.parse(localStorage.getItem("hichord-settings")) || {};
} catch {}
const state = { ...defaults };
for (const key of Object.keys(defaults)) {
  if (typeof saved[key] === typeof defaults[key]) state[key] = saved[key];
}
for (const [key, min, max] of [
  ["key", 0, 11],
  ["octave", -2, 2],
  ["inversion", 0, 2],
  ["volume", 0, 100],
  ["bpm", 40, 300],
  ["rate", 1, 4],
  ["reverb", 0, 100],
  ["delay", 0, 75],
  ["filter", 200, 16000],
  ["attack", 0.005, 1.5],
  ["release", 0.05, 3],
  ["chorus", 0, 100],
  ["tremolo", 0, 100],
])
  state[key] = Math.max(
    min,
    Math.min(max, Number.isFinite(state[key]) ? state[key] : defaults[key]),
  );
if (!SOUNDS.some((s) => s.id === state.sound)) state.sound = "keys";
if (!MODES.some((m) => m[0] === state.mode)) state.mode = "play";
if (!["major", "minor"].includes(state.scale)) state.scale = "major";
if (
  ![
    "base",
    "flip",
    "seventh",
    "ninth",
    "dom",
    "sus4",
    "sixth",
    "dim",
    "aug",
  ].includes(state.voicing)
)
  state.voicing = "base";
const engine = new AudioEngine();
const held = new Map(),
  rhythms = new Map();
let modifier = null,
  currentPanel = "sound",
  lastDegree = 0,
  drone = null,
  beat = null,
  seq = null,
  metronome = false,
  metroNext = 0,
  metroStep = 0;
let toastTimer,
  demoTimers = [],
  playing = false,
  recording = false,
  recordBusy = false,
  recStart = 0,
  playStart = 0,
  recTimeout,
  tracks = [],
  playNodes = [],
  loop = false,
  db = null,
  sessionLoading = true;
let seqSteps = [0, -1, 4, -1, 5, -1, 3, -1],
  hiroStep = 0,
  trainerTarget = null,
  micStream = null,
  micAnalyser = null,
  micRecorder = null,
  micChunks = [],
  micTimeout = null,
  micRequest = 0,
  sampleName = "";
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 4000);
}
function remember() {
  try {
    localStorage.setItem("hichord-settings", JSON.stringify(state));
  } catch {}
}
async function audio() {
  try {
    await engine.resume();
    engine.configure(state);
    $("audio-status").classList.add("ready");
    $("audio-status").innerHTML = "<i></i> Аудио активно";
    return true;
  } catch (error) {
    toast("Не удалось включить звук: " + error.message);
    return false;
  }
}
const drumNames = [
  "Kick",
  "Snare",
  "Clap",
  "Hi-hat",
  "Tom Hi",
  "Tom Lo",
  "Open Hat",
];
const beatNames = [
  "Pocket",
  "House",
  "Hip-hop",
  "Break",
  "Disco",
  "Half-time",
  "Shuffle",
];
const majorDegrees = ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
  minorDegrees = ["i", "ii°", "III", "iv", "v", "VI", "VII"];
function chord(i) {
  return chordFor(i, state, modifier || state.voicing);
}
function showChord(i) {
  lastDegree = i;
  const ch = chord(i);
  $("screen-chord").textContent =
    state.mode === "drums"
      ? drumNames[i]
      : state.mode === "beat"
        ? beatNames[i]
        : ch.name;
}
function refreshPads() {
  for (const pad of $$(".pad")) {
    const degree = Number(pad.dataset.degree);
    pad.querySelector(".chord-name").textContent =
      state.mode === "drums"
        ? drumNames[degree]
        : state.mode === "beat"
          ? beatNames[degree]
          : chord(degree).short;
    pad.querySelector(".degree").textContent = ["drums", "beat"].includes(
      state.mode,
    )
      ? ""
      : (state.scale === "minor" ? minorDegrees : majorDegrees)[degree];
    pad.setAttribute(
      "aria-label",
      `${degree + 1}: ${pad.querySelector(".chord-name").textContent}`,
    );
  }
  showChord(lastDegree);
}
for (const i of [1, 3, 5, 0, 2, 4, 6]) {
  const pad = document.createElement("button");
  pad.className = "pad" + ([1, 3, 5].includes(i) ? " top-pad" : "");
  pad.dataset.degree = i;
  pad.innerHTML = `<span class="number">${i + 1}</span><span class="pad-info"><span class="chord-name"></span><span class="degree"></span></span>`;
  $("pads").append(pad);
  pad.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    pad.setPointerCapture(event.pointerId);
    press(i, "p" + event.pointerId);
  });
  const release = (event) => releaseKey("p" + event.pointerId);
  pad.addEventListener("pointerup", release);
  pad.addEventListener("pointercancel", release);
  pad.addEventListener("lostpointercapture", release);
  pad.addEventListener("contextmenu", (e) => e.preventDefault());
  pad.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
      e.preventDefault();
      press(i, "button" + i);
    }
  });
  pad.addEventListener("keyup", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      releaseKey("button" + i);
    }
  });
}
function highlight(i, on) {
  document.querySelector(`[data-degree="${i}"]`).classList.toggle("active", on);
  document
    .querySelector(".device")
    .classList.toggle("sounding", $$(".pad.active").length > 0);
}
function pulse(i, time, length = 0.12) {
  const delay = Math.max(0, (time - engine.ctx.currentTime) * 1000);
  setTimeout(() => {
    highlight(i, true);
    showChord(i);
    setTimeout(() => {
      if (![...held.values()].some((h) => h.i === i)) highlight(i, false);
    }, length * 1000);
  }, delay);
}
function playChord(i, time = engine.ctx.currentTime, duration = null) {
  const ch = chord(i);
  let notes = ch.notes;
  if (state.mode === "lead") notes = [ch.root + 12];
  if (state.mode === "drone") notes = [ch.root, ch.root + 7];
  if (held.size > 1 && state.mode !== "lead") {
    const first = [...held.values()][0];
    if (first.i !== i) notes = [chord(first.i).root - 12, ...notes];
  }
  return notes.map((note, k) =>
    engine.note(
      note,
      state,
      time + (state.mode === "strum" ? k * 0.045 : 0),
      duration,
    ),
  );
}
async function press(i, id) {
  if (held.has(id)) return;
  const entry = { i, voices: [] };
  held.set(id, entry);
  highlight(i, true);
  if (!(await audio()) || !held.has(id)) {
    releaseKey(id);
    return;
  }
  showChord(i);
  if (
    state.sound === "sample" &&
    !engine.sample &&
    !["drums", "beat"].includes(state.mode)
  ) {
    toast("Сначала загрузи или запиши семпл в режиме MIC.");
    releaseKey(id);
    return;
  }
  if (state.mode === "drums") {
    engine.drum(i);
    return;
  }
  if (state.mode === "beat") {
    if (beat?.i === i) {
      beat = null;
      toast("Бит остановлен");
    } else {
      beat = { i, next: engine.ctx.currentTime, step: 0 };
      toast("Ритм: " + beatNames[i]);
    }
    return;
  }
  if (state.mode === "drone") {
    drone?.forEach((v) => v.stop());
    drone = playChord(i);
    return;
  }
  if (state.mode === "arp" || state.mode === "repeat") {
    rhythms.clear();
    for (const [key, value] of held)
      if (key !== id) value.voices.forEach((v) => v.stop());
    rhythms.set(id, { i, next: engine.ctx.currentTime, step: 0 });
    return;
  }
  entry.voices = playChord(i);
  if (state.mode === "hiro") {
    const progression = [0, 4, 5, 3];
    if (i === progression[hiroStep % 4]) {
      hiroStep++;
      $("extra-status").textContent = `${hiroStep} верно`;
      $("hiro-next").textContent = chord(progression[hiroStep % 4]).short;
      $("hiro-number").textContent = progression[hiroStep % 4] + 1;
    } else toast("Следующий аккорд: " + chord(progression[hiroStep % 4]).short);
  }
  if (state.mode === "trainer" && trainerTarget !== null) {
    if (i === trainerTarget) {
      toast("Верно! Это " + chord(i).name);
      $("extra-status").textContent = "Верно! Нажми «Новый аккорд»";
      trainerTarget = null;
    } else toast("Попробуй ещё раз или послушай повторно.");
  }
}
function releaseKey(id) {
  const entry = held.get(id);
  if (!entry) return;
  entry.voices.forEach((v) => v.stop());
  held.delete(id);
  if (!state.latch) rhythms.delete(id);
  if (![...held.values()].some((h) => h.i === entry.i))
    highlight(entry.i, false);
}
function releaseAll() {
  for (const id of [...held.keys()]) releaseKey(id);
}
function cancelDemo() {
  demoTimers.forEach(clearTimeout);
  demoTimers = [];
  $("demo").innerHTML = "<span>▷</span> Послушать демо";
}
function silence() {
  cancelDemo();
  releaseAll();
  rhythms.clear();
  beat = null;
  seq = null;
  drone?.forEach((v) => v.stop());
  drone = null;
  engine.stopAll();
  $$(".pad").forEach((p) => p.classList.remove("active"));
  document.querySelector(".device").classList.remove("sounding");
  if ($("seq-play")) $("seq-play").textContent = "▶ Запустить";
}
function applySettings() {
  engine.configure(state);
  remember();
  refreshPads();
  $("screen-mode").textContent = state.mode.toUpperCase();
  $("screen-bpm").textContent = state.bpm;
  $("screen-sound").textContent = SOUNDS.find(
    (s) => s.id === state.sound,
  ).name.toUpperCase();
}
function syncControls() {
  for (const id of [
    "key",
    "sound",
    "mode",
    "bpm",
    "rate",
    "volume",
    "reverb",
    "delay",
    "filter",
    "attack",
    "release",
    "chorus",
    "tremolo",
    "voicing",
  ])
    $(id).value = state[id];
  $("arp-pattern").value = state.pattern;
  for (const id of ["bass", "latch"]) $(id).checked = state[id];
  $("octave").textContent =
    state.octave > 0 ? "+" + state.octave : state.octave;
  for (const id of ["volume", "reverb", "delay"])
    $(id + "-value").textContent = state[id] + "%";
  $("filter-value").textContent = (state.filter / 1000).toFixed(1) + " kHz";
  $("sound-number").textContent =
    String(SOUNDS.findIndex((s) => s.id === state.sound) + 1).padStart(2, "0") +
    " / 12";
  $("sound-description").textContent = SOUNDS.find(
    (s) => s.id === state.sound,
  ).description;
  $("mode-description").textContent = MODES.find((m) => m[0] === state.mode)[2];
  $$("[data-scale]").forEach((b) =>
    b.classList.toggle("selected", b.dataset.scale === state.scale),
  );
  $$("[data-inversion]").forEach((b) =>
    b.classList.toggle("selected", +b.dataset.inversion === state.inversion),
  );
  applySettings();
}
function panel(name) {
  currentPanel = name;
  $$(".settings-tabs button").forEach((b) => {
    b.classList.toggle("selected", b.dataset.panel === name);
    b.setAttribute("aria-selected", b.dataset.panel === name);
  });
  $$(".settings-panel").forEach((p) => (p.hidden = p.id !== "panel-" + name));
}
$$("[data-panel]").forEach((b) =>
  b.addEventListener("click", () => panel(b.dataset.panel)),
);
for (const [i, n] of NOTE_NAMES.entries()) $("key").add(new Option(n, i));
for (const sound of SOUNDS) $("sound").add(new Option(sound.name, sound.id));
for (const mode of MODES) $("mode").add(new Option(mode[1], mode[0]));
for (const id of [
  "key",
  "sound",
  "bpm",
  "rate",
  "volume",
  "reverb",
  "delay",
  "filter",
  "attack",
  "release",
  "chorus",
  "tremolo",
  "voicing",
])
  $(id).addEventListener("input", () => {
    state[id] =
      typeof defaults[id] === "number" ? Number($(id).value) : $(id).value;
    if (id === "bpm") state.bpm = Math.max(40, Math.min(300, state.bpm || 100));
    syncControls();
    if (["key", "voicing"].includes(id)) revoice();
  });
$("arp-pattern").addEventListener("change", () => {
  state.pattern = $("arp-pattern").value;
  applySettings();
});
for (const id of ["bass", "latch"])
  $(id).addEventListener("change", () => {
    state[id] = $(id).checked;
    applySettings();
    if (id === "bass") revoice();
    if (id === "latch" && !state.latch)
      for (const key of rhythms.keys()) if (!held.has(key)) rhythms.delete(key);
  });
$$("[data-scale]").forEach(
  (b) =>
    (b.onclick = () => {
      state.scale = b.dataset.scale;
      syncControls();
      revoice();
    }),
);
$$("[data-inversion]").forEach(
  (b) =>
    (b.onclick = () => {
      state.inversion = +b.dataset.inversion;
      syncControls();
      revoice();
    }),
);
function octave(delta) {
  state.octave = Math.max(-2, Math.min(2, state.octave + delta));
  syncControls();
  revoice();
}
$("oct-down").onclick = () => octave(-1);
$("oct-up").onclick = () => octave(1);
function setMode(value) {
  silence();
  stopMic();
  state.mode = value;
  syncControls();
  renderExtra();
}
$("mode").onchange = () => setMode($("mode").value);
$("reset").onclick = () => {
  silence();
  stopMic();
  Object.assign(state, defaults);
  syncControls();
  renderExtra();
  toast("Настройки звука сброшены");
};
function revoice() {
  for (const entry of held.values()) {
    entry.voices.forEach((v) => v.stop());
    if (
      engine.ctx &&
      !["arp", "repeat", "drums", "beat", "drone"].includes(state.mode)
    )
      entry.voices = playChord(entry.i);
  }
  if (drone) {
    drone.forEach((v) => v.stop());
    drone = playChord(lastDegree);
  }
  refreshPads();
}
let taps = [];
$("tap").onclick = () => {
  const t = performance.now();
  taps = taps.filter((x) => t - x < 3000);
  taps.push(t);
  if (taps.length >= 3) {
    state.bpm = Math.max(
      40,
      Math.min(300, Math.round(60000 / ((t - taps[0]) / (taps.length - 1)))),
    );
    syncControls();
    toast("Темп: " + state.bpm + " BPM");
  } else toast("Ещё " + (3 - taps.length) + " нажатия в ритм");
};
$("metronome").onchange = async () => {
  metronome = $("metronome").checked;
  if (metronome && (await audio())) {
    metroNext = engine.ctx.currentTime;
    metroStep = 0;
  }
};
const arrowKeys = new Set();
const directionMap = {
  "0,-1": "flip",
  "1,-1": "dom",
  "1,0": "seventh",
  "1,1": "ninth",
  "0,1": "sus4",
  "-1,1": "sixth",
  "-1,0": "dim",
  "-1,-1": "aug",
};
function setDirection(x, y) {
  const next = directionMap[`${x},${y}`] || null;
  $("joystick").style.transform = `translate(${x * 10}px,${y * 10}px)`;
  if (next !== modifier) {
    modifier = next;
    revoice();
  }
}
let stickStart = null,
  stickMoved = false;
$("joystick").onpointerdown = (e) => {
  e.preventDefault();
  $("joystick").setPointerCapture(e.pointerId);
  stickStart = { x: e.clientX, y: e.clientY };
  stickMoved = false;
};
$("joystick").onpointermove = (e) => {
  if (!stickStart) return;
  const dx = e.clientX - stickStart.x,
    dy = e.clientY - stickStart.y;
  if (Math.hypot(dx, dy) > 7) stickMoved = true;
  setDirection(
    Math.abs(dx) > 9 ? Math.sign(dx) : 0,
    Math.abs(dy) > 9 ? Math.sign(dy) : 0,
  );
};
function stickEnd(e) {
  if (!stickStart) return;
  const clicked = !stickMoved && e.type === "pointerup";
  stickStart = null;
  setDirection(0, 0);
  if (clicked) toggleRecord();
}
$("joystick").onpointerup = stickEnd;
$("joystick").onpointercancel = stickEnd;
$("joystick").onlostpointercapture = stickEnd;
$("joystick").onkeydown = (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    if (!e.repeat) toggleRecord();
  }
};
function isEditing(target) {
  return (
    ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) ||
    target.isContentEditable
  );
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if ($("help-dialog").open) $("help-dialog").close();
    panic();
    return;
  }
  if (isEditing(e.target) || $("help-dialog").open) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.key.startsWith("Arrow")) {
    e.preventDefault();
    arrowKeys.add(e.key);
    setDirection(
      Number(arrowKeys.has("ArrowRight")) - Number(arrowKeys.has("ArrowLeft")),
      Number(arrowKeys.has("ArrowDown")) - Number(arrowKeys.has("ArrowUp")),
    );
    return;
  }
  if (e.repeat) return;
  if (/^[1-7]$/.test(e.key)) {
    e.preventDefault();
    press(Number(e.key) - 1, "k" + e.code);
  }
  if (e.code === "KeyR") {
    e.preventDefault();
    toggleRecord();
  }
  if (
    e.code === "Space" &&
    e.target.tagName !== "BUTTON" &&
    e.target.id !== "joystick"
  ) {
    e.preventDefault();
    togglePlay();
  }
  if (e.key === "?") $("help-dialog").showModal();
});
document.addEventListener("keyup", (e) => {
  releaseKey("k" + e.code);
  if (e.key.startsWith("Arrow")) {
    arrowKeys.delete(e.key);
    setDirection(
      Number(arrowKeys.has("ArrowRight")) - Number(arrowKeys.has("ArrowLeft")),
      Number(arrowKeys.has("ArrowDown")) - Number(arrowKeys.has("ArrowUp")),
    );
  }
});
window.addEventListener("blur", () => {
  releaseAll();
  arrowKeys.clear();
  setDirection(0, 0);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    silence();
    stopPlayback();
    if (recording) finishRecording();
    stopMic();
    metronome = false;
    $("metronome").checked = false;
  }
});
$("help").onclick = () => $("help-dialog").showModal();
$("close-help").onclick = () => $("help-dialog").close();
$("start-playing").onclick = async () => {
  $("help-dialog").close();
  await audio();
};
$("help-dialog").addEventListener("click", (e) => {
  if (e.target === $("help-dialog")) {
    const rect = $("help-dialog").getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    )
      $("help-dialog").close();
  }
});
async function demo() {
  if (demoTimers.length) {
    silence();
    return;
  }
  if (!(await audio())) return;
  silence();
  $("demo").innerHTML = "<span>□</span> Остановить демо";
  const progression = [0, 4, 5, 3, 0, 4, 5, 3],
    s = { ...state, mode: "play" };
  const now = engine.ctx.currentTime;
  progression.forEach((i, k) => {
    demoTimers.push(
      setTimeout(() => {
        chordFor(i, s).notes.forEach((n) =>
          engine.note(n, s, engine.ctx.currentTime, 0.75),
        );
        pulse(i, engine.ctx.currentTime, 0.75);
      }, k * 1000),
    );
  });
  demoTimers.push(
    setTimeout(() => {
      cancelDemo();
    }, 8000),
  );
}
$("demo").onclick = demo;
$("progression").onclick = demo;
function rhythmTick() {
  if (!engine.ctx || engine.ctx.state !== "running") return;
  const now = engine.ctx.currentTime,
    end = now + 0.075;
  if (metronome) {
    if (metroNext < now - 0.2) metroNext = now;
    while (metroNext < end) {
      engine.click(metroStep % 4 === 0, metroNext);
      metroStep++;
      metroNext += 60 / state.bpm;
    }
  }
  for (const item of rhythms.values()) {
    if (item.next < now - 0.2) item.next = now;
    while (item.next < end) {
      const ch = chord(item.i),
        step = 60 / state.bpm / state.rate;
      if (state.mode === "arp") {
        const count = ch.notes.length;
        let pos = item.step % count;
        if (state.pattern === "down") pos = count - 1 - pos;
        if (state.pattern === "updown") {
          const p = item.step % (count * 2 - 2);
          pos = p < count ? p : count * 2 - 2 - p;
        }
        if (state.pattern === "random") pos = Math.floor(Math.random() * count);
        engine.note(ch.notes[pos], state, item.next, step * 0.72);
      } else
        ch.notes.forEach((n) => engine.note(n, state, item.next, step * 0.55));
      pulse(item.i, item.next, step * 0.6);
      item.next += step;
      item.step++;
    }
  }
  if (beat) {
    if (beat.next < now - 0.2) beat.next = now;
    while (beat.next < end) {
      const n = beat.step % 16,
        b = beat.i;
      if (
        b === 1
          ? n % 4 === 0
          : b === 3
            ? [0, 6, 10].includes(n)
            : b === 5
              ? [0, 10].includes(n)
              : [0, 8].includes(n)
      )
        engine.drum(0, beat.next);
      if (b === 5 ? n === 8 : [4, 12].includes(n)) engine.drum(1, beat.next);
      if (n % (b === 2 ? 4 : 2) === 0) engine.drum(3, beat.next);
      if (b === 4 && n % 4 === 2) engine.drum(6, beat.next);
      if (b === 6 && [3, 7, 11, 15].includes(n)) engine.drum(3, beat.next);
      pulse(b, beat.next, 0.07);
      beat.next += 15 / state.bpm;
      beat.step++;
    }
  }
  if (seq) {
    if (seq.next < now - 0.2) seq.next = now;
    while (seq.next < end) {
      const pos = seq.step % seqSteps.length,
        degree = seqSteps[pos],
        time = seq.next,
        step = 60 / state.bpm;
      if (degree >= 0) {
        chord(degree).notes.forEach((n) =>
          engine.note(n, state, time, step * 0.8),
        );
        pulse(degree, time, step * 0.7);
      }
      setTimeout(
        () =>
          $$(".seq-steps button").forEach((b, i) =>
            b.classList.toggle("current", i === pos),
          ),
        Math.max(0, (time - now) * 1000),
      );
      seq.next += step;
      seq.step++;
    }
  }
}
setInterval(rhythmTick, 25);
function renderExtra() {
  const m = state.mode,
    visible = ["seq", "hiro", "trainer", "tuner", "mic", "mixer"].includes(m);
  $("extra-panel").hidden = !visible;
  $("extra-content").innerHTML = "";
  $("extra-status").textContent = "";
  if (!visible) return;
  $("extra-title").textContent = MODES.find((x) => x[0] === m)[1].toUpperCase();
  if (m === "seq") {
    $("extra-content").innerHTML =
      '<div class="extra-copy">Нажимай на шаг: аккорды I–VII и пауза. Один шаг = одна четверть.</div><div class="seq-steps"></div><button id="seq-play">▶ Запустить</button>';
    seqSteps.forEach((degree, i) => {
      const button = document.createElement("button");
      button.innerHTML = `<small>0${i + 1}</small><span>${degree < 0 ? "—" : chord(degree).short}</span>`;
      button.onclick = () => {
        seqSteps[i] = ((seqSteps[i] + 2) % 8) - 1;
        button.querySelector("span").textContent =
          seqSteps[i] < 0 ? "—" : chord(seqSteps[i]).short;
        saveSession();
      };
      document.querySelector(".seq-steps").append(button);
    });
    $("seq-play").onclick = async () => {
      if (!(await audio())) return;
      if (seq) {
        seq = null;
        $("seq-play").textContent = "▶ Запустить";
        $$(".seq-steps button").forEach((b) => b.classList.remove("current"));
      } else {
        seq = { next: engine.ctx.currentTime, step: 0 };
        $("seq-play").textContent = "■ Остановить";
      }
    };
  }
  if (m === "hiro") {
    hiroStep = 0;
    $("extra-content").innerHTML =
      `<div class="extra-copy">Следуй последовательности C → G → Am → F в выбранной тональности. Следующий аккорд:</div><div class="tuner-note" id="hiro-next">${chord(0).short}</div><div class="extra-copy">Нажми кнопку <span class="keycap" id="hiro-number">1</span>. Это свободная тренировка без оценки ритма.</div>`;
  }
  if (m === "trainer") {
    trainerTarget = null;
    $("extra-content").innerHTML =
      '<p class="extra-copy">Послушай аккорд, затем найди его среди семи кнопок. Тренируй слух в своей тональности.</p><div class="extra-buttons"><button id="trainer-new">Новый аккорд</button><button id="trainer-repeat" disabled>Послушать ещё раз</button></div>';
    const listen = async () => {
      if (!(await audio()) || trainerTarget === null) return;
      chord(trainerTarget).notes.forEach((n) =>
        engine.note(n, state, engine.ctx.currentTime, 1),
      );
      $("screen-chord").textContent = "?";
    };
    $("trainer-new").onclick = () => {
      trainerTarget = Math.floor(Math.random() * 7);
      $("trainer-repeat").disabled = false;
      $("extra-status").textContent = "Найди аккорд";
      listen();
    };
    $("trainer-repeat").onclick = listen;
  }
  if (m === "tuner") {
    $("extra-content").innerHTML =
      '<p class="extra-copy">Разреши доступ к микрофону и сыграй одну устойчивую ноту. A4 = 440 Hz.</p><div class="tuner-note" id="tuner-note">—</div><div class="extra-buttons"><button id="tuner-start">Включить микрофон</button><button id="tuner-stop" disabled>Выключить</button></div>';
    $("tuner-start").onclick = startTuner;
    $("tuner-stop").onclick = () => {
      stopMic();
      $("tuner-start").disabled = false;
      $("tuner-stop").disabled = true;
      $("tuner-note").textContent = "—";
      $("extra-status").textContent = "Микрофон выключен";
    };
  }
  if (m === "mic") {
    $("extra-content").innerHTML =
      '<p class="extra-copy">Запиши до 10 секунд или загрузи аудио до 20 МБ. Опорная нота семпла — C4. После загрузки кнопки играют аккорды твоим звуком.</p><div class="extra-buttons"><button id="sample-record">● Записать с микрофона</button><label class="sample-upload">↑ Загрузить аудио<input id="sample-file" type="file" accept="audio/*"></label></div>';
    $("extra-status").textContent = sampleName || "Семпл не загружен";
    $("sample-record").onclick = recordSample;
    $("sample-file").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) {
        toast("Выбери файл не больше 20 МБ.");
        return;
      }
      if (!(await audio())) return;
      try {
        engine.sample = await engine.ctx.decodeAudioData(
          await file.arrayBuffer(),
        );
        sampleName = file.name;
        persistSample();
        state.sound = "sample";
        syncControls();
        $("extra-status").textContent = sampleName;
        toast("Семпл готов. Играй на кнопках!");
      } catch {
        toast("Не удалось прочитать этот аудиофайл. Попробуй WAV или MP3.");
      }
    };
  }
  if (m === "mixer") {
    $("extra-content").innerHTML =
      '<p class="extra-copy">Все дорожки находятся в блоке «Твоя мелодия». Кнопка динамика отключает дорожку, ползунок меняет громкость. Начни запись, чтобы добавить следующий слой. Экспорт учитывает громкость и отключение дорожек.</p>';
  }
}
async function getMic() {
  const request = ++micRequest;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  if (request !== micRequest) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("Запрос отменён");
  }
  micStream = stream;
  return stream;
}
function stopMic() {
  micRequest++;
  clearTimeout(micTimeout);
  if (micRecorder?.state === "recording") micRecorder.stop();
  micStream?.getTracks().forEach((t) => t.stop());
  micStream = null;
  micAnalyser?.source.disconnect();
  micAnalyser = null;
}
async function startTuner() {
  if (!(await audio())) return;
  $("tuner-start").disabled = true;
  try {
    stopMic();
    const stream = await getMic();
    if (state.mode !== "tuner") {
      stopMic();
      return;
    }
    const source = engine.ctx.createMediaStreamSource(stream),
      analyser = engine.ctx.createAnalyser();
    analyser.fftSize = 4096;
    source.connect(analyser);
    micAnalyser = { source, analyser };
    $("tuner-stop").disabled = false;
    $("extra-status").textContent = "Слушаю…";
  } catch (error) {
    if ($("tuner-start")) $("tuner-start").disabled = false;
    toast("Микрофон недоступен: " + error.message);
  }
}
async function recordSample() {
  if (micRecorder?.state === "recording") {
    micRecorder.stop();
    return;
  }
  if (!(await audio())) return;
  $("sample-record").disabled = true;
  try {
    stopMic();
    const stream = await getMic();
    if (state.mode !== "mic") {
      stopMic();
      return;
    }
    micChunks = [];
    micRecorder = new MediaRecorder(stream);
    micRecorder.ondataavailable = (e) => {
      if (e.data.size) micChunks.push(e.data);
    };
    micRecorder.onstop = async () => {
      clearTimeout(micTimeout);
      stream.getTracks().forEach((t) => t.stop());
      micStream = null;
      try {
        engine.sample = await engine.ctx.decodeAudioData(
          await new Blob(micChunks, {
            type: micRecorder.mimeType,
          }).arrayBuffer(),
        );
        sampleName = "Мой семпл · " + engine.sample.duration.toFixed(1) + " с";
        persistSample();
        state.sound = "sample";
        syncControls();
        if (state.mode === "mic") renderExtra();
        toast("Семпл готов");
      } catch {
        toast("Не удалось записать семпл.");
      }
    };
    micRecorder.start();
    $("sample-record").disabled = false;
    $("sample-record").textContent = "■ Завершить запись";
    $("extra-status").textContent = "Запись микрофона…";
    micTimeout = setTimeout(() => {
      if (micRecorder?.state === "recording") micRecorder.stop();
    }, 10000);
  } catch (error) {
    if ($("sample-record")) $("sample-record").disabled = false;
    toast("Микрофон недоступен: " + error.message);
  }
}
let midiAccess = null;
$("midi").onclick = async () => {
  if (!navigator.requestMIDIAccess) {
    toast("Web MIDI недоступен в этом браузере. Попробуй Chrome или Edge.");
    return;
  }
  try {
    midiAccess = await navigator.requestMIDIAccess();
    if (!(await audio())) return;
    const attach = () => {
      for (const input of midiAccess.inputs.values())
        input.onmidimessage = ({ data }) => {
          const [status, note, velocity] = data;
          const id = "midi" + input.id + "-" + note;
          if ((status & 240) === 144 && velocity > 0) {
            held.get(id)?.voices.forEach((v) => v.stop());
            held.set(id, {
              i: 0,
              voices: [
                engine.note(
                  note,
                  state,
                  engine.ctx.currentTime,
                  null,
                  velocity / 127,
                ),
              ],
            });
          } else if ((status & 240) === 128 || (status & 240) === 144)
            releaseKey(id);
          else if ((status & 240) === 176 && [120, 123].includes(note))
            silence();
        };
      $("midi").textContent = "MIDI: " + midiAccess.inputs.size + " устройств";
    };
    attach();
    midiAccess.onstatechange = () => {
      releaseAll();
      attach();
    };
    toast("MIDI-вход включён. Играй ноты на контроллере.");
  } catch {
    toast("Доступ к MIDI не разрешён.");
  }
};
function refreshTransport() {
  const any = tracks.length > 0;
  $("play").disabled = !any || recording || recordBusy;
  $("export").disabled = !any || recording || recordBusy;
  $("clear-recording").disabled = !any || recording || recordBusy;
  $("record").disabled =
    recordBusy || sessionLoading || (!recording && tracks.length >= 6);
  $("record").classList.toggle("is-recording", recording);
  $("record").querySelector("span").textContent = recording
    ? "Завершить"
    : "Запись";
  $("recording-badge").textContent = recording
    ? "ИДЁТ ЗАПИСЬ"
    : recordBusy
      ? "СОХРАНЕНИЕ"
      : playing
        ? "ВОСПРОИЗВЕДЕНИЕ"
        : any
          ? tracks.length + " / 6 ДОРОЖЕК"
          : "ГОТОВ К ЗАПИСИ";
  $("recording-badge").classList.toggle("is-recording", recording);
  $("play").textContent = playing ? "Ⅱ" : "▶";
  $("play").setAttribute(
    "aria-label",
    playing ? "Остановить воспроизведение" : "Воспроизвести запись",
  );
  $("empty-recording").hidden = any || recording;
  $("playhead").style.opacity = playing ? 1 : 0;
}
function renderTracks() {
  $("tracks").innerHTML = "";
  tracks.forEach((track, i) => {
    const el = document.createElement("div");
    el.className = "track" + (track.muted ? " muted" : "");
    const title = document.createElement("span");
    title.textContent = String(i + 1).padStart(2, "0") + " " + track.name;
    el.append(title);
    const mute = document.createElement("button");
    mute.textContent = track.muted ? "○" : "◉";
    mute.setAttribute(
      "aria-label",
      `${track.muted ? "Включить" : "Отключить"} дорожку ${i + 1}`,
    );
    mute.setAttribute("aria-pressed", track.muted);
    mute.onclick = () => {
      track.muted = !track.muted;
      syncTrackGains();
      renderTracks();
      drawWaveform();
      saveSession();
    };
    el.append(mute);
    const gain = document.createElement("input");
    gain.type = "range";
    gain.min = "0";
    gain.max = "100";
    gain.value = track.gain * 100;
    gain.setAttribute("aria-label", "Громкость дорожки " + (i + 1));
    gain.oninput = () => {
      track.gain = +gain.value / 100;
      syncTrackGains();
      drawWaveform();
    };
    gain.onchange = saveSession;
    el.append(gain);
    const remove = document.createElement("button");
    remove.textContent = "×";
    remove.disabled = recording || recordBusy;
    remove.setAttribute("aria-label", "Удалить дорожку " + (i + 1));
    remove.onclick = () => {
      stopPlayback();
      tracks.splice(i, 1);
      renderTracks();
      refreshTransport();
      drawWaveform();
      saveSession();
    };
    el.append(remove);
    $("tracks").append(el);
  });
}
function syncTrackGains() {
  playNodes.forEach((node, i) => {
    if (tracks[i])
      node.gain.gain.setTargetAtTime(
        tracks[i].muted ? 0 : tracks[i].gain,
        engine.ctx.currentTime,
        0.01,
      );
  });
}
async function toggleRecord() {
  if (recordBusy || sessionLoading) return;
  if (recording) {
    await finishRecording();
    return;
  }
  if (tracks.length >= 6) {
    toast("Уже 6 дорожек. Удали одну, чтобы записать новую.");
    return;
  }
  recordBusy = true;
  refreshTransport();
  if (!(await audio())) {
    recordBusy = false;
    refreshTransport();
    return;
  }
  if (!engine.captureReady) {
    toast(
      "Запись недоступна в этом браузере. Попробуй Chrome или Edge через HTTPS.",
    );
    recordBusy = false;
    refreshTransport();
    return;
  }
  stopPlayback();
  try {
    engine.startCapture();
    recording = true;
    recordBusy = false;
    recStart = engine.ctx.currentTime;
    if (tracks.length) startPlayback(true);
    recTimeout = setTimeout(
      finishRecording,
      (tracks.length ? tracks[0].buffer.duration : 180) * 1000,
    );
    refreshTransport();
    renderTracks();
  } catch (e) {
    recordBusy = false;
    refreshTransport();
    toast(e.message);
  }
}
async function finishRecording() {
  if (!recording || recordBusy) return;
  recording = false;
  recordBusy = true;
  clearTimeout(recTimeout);
  stopPlayback();
  refreshTransport();
  try {
    let buffer = await engine.stopCapture();
    if (buffer.duration < 0.12) {
      toast("Слишком короткая запись. Попробуй ещё раз.");
      return;
    }
    if (tracks.length) {
      const base = tracks[0].buffer;
      const trimmed = engine.ctx.createBuffer(
        2,
        Math.round(base.duration * buffer.sampleRate),
        buffer.sampleRate,
      );
      for (let ch = 0; ch < 2; ch++)
        trimmed
          .getChannelData(ch)
          .set(buffer.getChannelData(ch).subarray(0, trimmed.length));
      buffer = trimmed;
    }
    tracks.push({
      buffer,
      name:
        state.mode === "drums" || state.mode === "beat"
          ? "Drums"
          : SOUNDS.find((s) => s.id === state.sound).name,
      gain: 1,
      muted: false,
    });
    await saveSession();
    toast(
      "Дорожка " + tracks.length + " записана. Можно добавить следующий слой.",
    );
  } catch (error) {
    toast("Ошибка записи: " + error.message);
  } finally {
    recordBusy = false;
    renderTracks();
    refreshTransport();
    drawWaveform();
    setTime(tracks[0]?.buffer.duration || 0);
  }
}
function startPlayback(overdub = false) {
  if (!tracks.length) return;
  stopPlayback();
  const c = engine.ctx;
  playStart = c.currentTime + 0.025;
  playing = true;
  tracks.forEach((track, i) => {
    const source = c.createBufferSource(),
      gain = c.createGain();
    source.buffer = track.buffer;
    source.loop = loop && !overdub;
    gain.gain.value = track.muted ? 0 : track.gain;
    source.connect(gain).connect(engine.master);
    source.start(playStart);
    if (i === 0)
      source.onended = () => {
        if (playing && !recording && !source.loop) stopPlayback();
      };
    playNodes.push({ source, gain });
  });
  refreshTransport();
}
function stopPlayback() {
  playing = false;
  for (const node of playNodes) {
    node.source.onended = null;
    try {
      node.source.stop();
    } catch {}
    node.source.disconnect();
    node.gain.disconnect();
  }
  playNodes = [];
  refreshTransport();
}
async function togglePlay() {
  if (recording || recordBusy) return;
  if (playing) {
    stopPlayback();
    return;
  }
  if (!tracks.length) {
    toast("Сначала запиши мелодию.");
    return;
  }
  if (await audio()) startPlayback();
}
$("record").onclick = toggleRecord;
$("play").onclick = togglePlay;
$("stop").onclick = () => {
  if (recording) finishRecording();
  else stopPlayback();
  silence();
};
$("loop").onclick = () => {
  loop = !loop;
  $("loop").setAttribute("aria-pressed", loop);
  if (playing && !recording) {
    stopPlayback();
    startPlayback();
  }
};
function panic() {
  silence();
  stopPlayback();
  if (recording) finishRecording();
  metronome = false;
  $("metronome").checked = false;
  stopMic();
  if (["mic", "tuner"].includes(state.mode)) renderExtra();
}
$("panic").onclick = panic;
$("clear-recording").onclick = () => {
  if (recording || recordBusy) return;
  stopPlayback();
  const previous = tracks;
  tracks = [];
  renderTracks();
  refreshTransport();
  drawWaveform();
  setTime(0);
  saveSession();
  toast("Запись очищена. Нажми Ctrl+Z в течение 10 секунд для отмены.");
  const undo = (e) => {
    if (
      (e.ctrlKey || e.metaKey) &&
      e.code === "KeyZ" &&
      !isEditing(e.target) &&
      !recording
    ) {
      e.preventDefault();
      stopPlayback();
      tracks = previous;
      renderTracks();
      refreshTransport();
      drawWaveform();
      saveSession();
      window.removeEventListener("keydown", undo);
      toast("Запись восстановлена");
    }
  };
  window.addEventListener("keydown", undo);
  setTimeout(() => window.removeEventListener("keydown", undo), 10000);
};
$("export").onclick = async () => {
  if (!tracks.length) return;
  $("export").disabled = true;
  try {
    const sampleRate = tracks[0].buffer.sampleRate,
      length = Math.max(
        ...tracks.map((t) => Math.round(t.buffer.duration * sampleRate)),
      );
    const offline = new OfflineAudioContext(2, length, sampleRate);
    const limiter = offline.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    limiter.connect(offline.destination);
    for (const track of tracks) {
      if (track.muted) continue;
      const source = offline.createBufferSource(),
        gain = offline.createGain();
      source.buffer = track.buffer;
      gain.gain.value = (track.gain * state.volume) / 100;
      source.connect(gain).connect(limiter);
      source.start();
    }
    const result = await offline.startRendering(),
      url = URL.createObjectURL(encodeWav(result));
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "HiChord-" +
      new Date().toISOString().slice(0, 19).replaceAll(":", "-") +
      ".wav";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast("WAV готов: " + result.duration.toFixed(1) + " с · стерео");
  } catch (error) {
    toast("Не удалось экспортировать: " + error.message);
  } finally {
    refreshTransport();
  }
};
function setTime(seconds) {
  seconds = Math.max(0, seconds);
  $("time").textContent =
    String(Math.floor(seconds / 60)).padStart(2, "0") +
    ":" +
    String(Math.floor(seconds % 60)).padStart(2, "0");
  $("time-ms").textContent = "." + (Math.floor(seconds * 10) % 10);
}
const canvas = $("waveform"),
  draw = canvas.getContext("2d");
let wavePeaks = [];
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * devicePixelRatio));
  canvas.height = Math.max(1, Math.floor(rect.height * devicePixelRatio));
  drawWaveform();
}
new ResizeObserver(resizeCanvas).observe(canvas);
function drawWaveform() {
  draw.clearRect(0, 0, canvas.width, canvas.height);
  if (!tracks.length) return;
  const count = Math.floor(canvas.width / 5),
    mid = canvas.height / 2;
  draw.fillStyle = "#a8c776";
  for (let i = 0; i < count; i++) {
    let peak = 0;
    for (const track of tracks) {
      if (track.muted) continue;
      const data = track.buffer.getChannelData(0),
        from = Math.floor((i * data.length) / count),
        to = Math.floor(((i + 1) * data.length) / count);
      let p = 0;
      const stride = Math.max(1, Math.floor((to - from) / 30));
      for (let k = from; k < to; k += stride)
        p = Math.max(p, Math.abs(data[k]));
      peak += p * track.gain;
    }
    const height = Math.min(
      canvas.height * 0.92,
      Math.max(2, peak * canvas.height * 2),
    );
    draw.fillRect(i * 5, mid - height / 2, 2.5, height);
  }
}
let lastTuner = 0;
function frame(now) {
  if (recording && engine.ctx) {
    setTime(engine.ctx.currentTime - recStart);
    const values = new Float32Array(engine.analyser.fftSize);
    engine.analyser.getFloatTimeDomainData(values);
    const peak = values.reduce((max, v) => Math.max(max, Math.abs(v)), 0);
    wavePeaks.push(peak);
    if (wavePeaks.length > canvas.width / 4) wavePeaks.shift();
    draw.clearRect(0, 0, canvas.width, canvas.height);
    draw.fillStyle = "#ed8b7b";
    wavePeaks.forEach((p, i) => {
      const h = Math.min(
        canvas.height * 0.9,
        Math.max(2, p * canvas.height * 2),
      );
      draw.fillRect(i * 4, (canvas.height - h) / 2, 2, h);
    });
  } else if (playing && tracks.length) {
    const elapsed = Math.max(0, engine.ctx.currentTime - playStart),
      duration = tracks[0].buffer.duration,
      position = loop ? elapsed % duration : Math.min(elapsed, duration);
    setTime(position);
    $("playhead").style.left = (100 * position) / duration + "%";
  }
  if (micAnalyser && now - lastTuner > 120) {
    lastTuner = now;
    analysePitch();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
function analysePitch() {
  if (!$("tuner-note")) return;
  const data = new Float32Array(4096);
  micAnalyser.analyser.getFloatTimeDomainData(data);
  let power = 0;
  for (const x of data) power += x * x;
  if (Math.sqrt(power / data.length) < 0.015) {
    $("tuner-note").textContent = "—";
    $("extra-status").textContent = "Сыграй одну ноту";
    return;
  }
  const sr = engine.ctx.sampleRate,
    min = Math.floor(sr / 1200),
    max = Math.min(1800, Math.floor(sr / 45));
  let best = 0,
    bestLag = 0,
    previous = 1,
    found = false;
  for (let lag = min; lag < max; lag++) {
    let diff = 0,
      norm = 0;
    for (let i = 0; i < 2048; i++) {
      diff += (data[i] - data[i + lag]) ** 2;
      norm += data[i] ** 2 + data[i + lag] ** 2;
    }
    const correlation = 1 - diff / (norm || 1);
    if (correlation > 0.92 && !found) {
      found = true;
    }
    if (found && correlation > best) {
      best = correlation;
      bestLag = lag;
    }
    if (found && correlation < previous && best > 0.92) break;
    previous = correlation;
  }
  if (!bestLag) {
    $("tuner-note").textContent = "—";
    return;
  }
  const freq = sr / bestLag,
    midi = 69 + 12 * Math.log2(freq / 440),
    rounded = Math.round(midi),
    cents = Math.round((midi - rounded) * 100);
  $("tuner-note").textContent =
    NOTE_NAMES[((rounded % 12) + 12) % 12] + (Math.floor(rounded / 12) - 1);
  $("extra-status").textContent =
    `${freq.toFixed(1)} Hz · ${cents > 0 ? "+" : ""}${cents} cents${Math.abs(cents) < 6 ? " · В строе" : ""}`;
}
async function persistSample() {
  if (!db || !engine.sample) return;
  try {
    const sample = engine.sample;
    const data = {
      name: sampleName,
      sampleRate: sample.sampleRate,
      channels: Array.from({ length: sample.numberOfChannels }, (_, i) =>
        sample.getChannelData(i).slice(),
      ),
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction("sessions", "readwrite");
      tx.objectStore("sessions").put(data, "sample");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    toast("Семпл работает, но его не удалось сохранить локально.");
  }
}
async function restoreSample() {
  const data = await new Promise((resolve, reject) => {
    const request = db
      .transaction("sessions")
      .objectStore("sessions")
      .get("sample");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (data) {
    engine.sample = new AudioBuffer({
      numberOfChannels: data.channels.length,
      length: data.channels[0].length,
      sampleRate: data.sampleRate,
    });
    data.channels.forEach((ch, i) => engine.sample.copyToChannel(ch, i));
    sampleName = data.name;
  } else if (state.sound === "sample") {
    state.sound = "keys";
    syncControls();
  }
}
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("hichord-studio", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("sessions");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveSession() {
  if (!db) return;
  try {
    const data = {
      tracks: tracks.map((t) => ({
        name: t.name,
        gain: t.gain,
        muted: t.muted,
        sampleRate: t.buffer.sampleRate,
        left: t.buffer.getChannelData(0).slice(),
        right: t.buffer.getChannelData(1).slice(),
      })),
      seqSteps,
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction("sessions", "readwrite");
      tx.objectStore("sessions").put(data, "current");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    toast(
      "Не хватило места для автосохранения. Скачай WAV, чтобы сохранить запись.",
    );
  }
}
async function restoreSession() {
  try {
    db = await openDB();
    await restoreSample();
    const data = await new Promise((resolve, reject) => {
      const request = db
        .transaction("sessions")
        .objectStore("sessions")
        .get("current");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (data) {
      tracks = data.tracks.slice(0, 6).map((t) => {
        const buffer = new AudioBuffer({
          numberOfChannels: 2,
          length: t.left.length,
          sampleRate: t.sampleRate,
        });
        buffer.copyToChannel(t.left, 0);
        buffer.copyToChannel(t.right, 1);
        return { buffer, name: t.name, gain: t.gain, muted: t.muted };
      });
      if (data.seqSteps?.length === 8) seqSteps = data.seqSteps;
      renderTracks();
      drawWaveform();
      if (tracks.length) toast("Восстановлено дорожек: " + tracks.length);
    }
  } catch {
    toast("Локальное сохранение недоступно. Записи можно скачать в WAV.");
  } finally {
    sessionLoading = false;
    refreshTransport();
    renderExtra();
  }
}
syncControls();
renderExtra();
refreshTransport();
restoreSession();
