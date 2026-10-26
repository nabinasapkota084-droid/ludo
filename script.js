"use strict";

// A token's progress is -1 in base, 0-50 on the shared track, and 51-56 on its home path.
const TRACK = [
  ...Array.from({ length: 5 }, (_, index) => [6, index + 1]),
  ...Array.from({ length: 5 }, (_, index) => [5 - index, 6]),
  [0, 6], [0, 7], [0, 8],
  ...Array.from({ length: 5 }, (_, index) => [index + 1, 8]),
  ...Array.from({ length: 5 }, (_, index) => [6, index + 9]),
  [6, 14], [7, 14], [8, 14],
  ...Array.from({ length: 5 }, (_, index) => [8, 13 - index]),
  ...Array.from({ length: 5 }, (_, index) => [index + 9, 8]),
  [14, 8], [14, 7], [14, 6],
  ...Array.from({ length: 5 }, (_, index) => [13 - index, 6]),
  ...Array.from({ length: 5 }, (_, index) => [8, 5 - index]),
  [8, 0], [7, 0], [6, 0]
];

const PLAYERS = [
  { id: "red", name: "Red", start: 0, home: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], nests: [[1, 1], [1, 4], [4, 1], [4, 4]] },
  { id: "green", name: "Green", start: 13, home: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], nests: [[1, 10], [1, 13], [4, 10], [4, 13]] },
  { id: "yellow", name: "Yellow", start: 26, home: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], nests: [[10, 10], [10, 13], [13, 10], [13, 13]] },
  { id: "blue", name: "Blue", start: 39, home: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]], nests: [[10, 1], [10, 4], [13, 1], [13, 4]] }
];

const SAFE_TRACK_INDEXES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const TOKEN_STEP_DELAY_MS = 300;
const CAPTURE_ANIMATION_MS = 420;
const EVENT_DISPLAY_MS = 1700;
const DICE_FACES = [
  { value: 1, rotation: [0, 0], pips: [4] },
  { value: 2, rotation: [-90, 0], pips: [0, 8] },
  { value: 3, rotation: [0, -90], pips: [0, 4, 8] },
  { value: 4, rotation: [0, 90], pips: [0, 2, 6, 8] },
  { value: 5, rotation: [90, 0], pips: [0, 2, 4, 6, 8] },
  { value: 6, rotation: [0, 180], pips: [0, 2, 3, 5, 6, 8] }
];
const REACTION_OPTIONS = [
  { emoji: "😊", label: "Happy", animation: "happy", sound: "happy.mp3", caption: "Happy!" },
  { emoji: "😢", label: "Sad", animation: "sad", sound: "sad.mp3", caption: "Aww..." },
  { emoji: "😡", label: "Angry", animation: "angry", sound: "angry.mp3", caption: "Grr!" },
  { emoji: "😭", label: "Crying", animation: "crying", sound: "crying.mp3", caption: "Boo hoo!" },
  { emoji: "😂", label: "Laughing", animation: "laugh", sound: "laugh.mp3", caption: "HAHA!" },
  { emoji: "😱", label: "Shocked", animation: "shocked", sound: "shocked.mp3", caption: "Whoa!" },
  { emoji: "😍", label: "Love / excited", animation: "love", sound: "excited.mp3", caption: "Love it!" },
  { emoji: "😎", label: "Cool", animation: "cool", sound: "cool.mp3", caption: "Too cool!" },
  { emoji: "🤩", label: "Excited", animation: "excited", sound: "excited.mp3", caption: "Amazing!" },
  { emoji: "🥳", label: "Celebration", animation: "celebrate", sound: "celebration.mp3", caption: "Party time!" },
  { emoji: "👏", label: "Applause", animation: "applause", sound: "applause.mp3", caption: "Well played!" },
  { emoji: "🔥", label: "Amazing", animation: "fire", sound: "amazing.mp3", caption: "On fire!" },
  { emoji: "👍", label: "Thumbs up", animation: "good", sound: "good.mp3", caption: "Nice!" },
  { emoji: "😤", label: "Frustrated", animation: "frustrated", sound: "frustrated.mp3", caption: "Hmph!" }
];
const REACTION_SOUND_FILES = Object.fromEntries(REACTION_OPTIONS.map(({ emoji, sound }) => [emoji, `sounds/reactions/${sound}`]));
const DEFAULT_REACTIONS = [
  ["😊", "😡", "😂", "😱"],
  ["😢", "😭", "😱", "😍"],
  ["😎", "🔥", "👍"],
  ["🥳", "🤩", "👏"]
];
const board = document.getElementById("board");
const currentPlayerLabel = document.getElementById("current-player");
const turnDot = document.getElementById("turn-dot");
const gameMessage = document.getElementById("game-message");
const eventIndicator = document.getElementById("event-indicator");
const diceResult = document.getElementById("dice-result");
const diceCube = document.getElementById("die-cube");
const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");
const soundToggle = document.getElementById("sound-toggle");

let tokens = [];
let currentPlayerIndex = 0;
let diceValue = null;
let lastDiceValue = null;
let gameStarted = false;
let gameOver = false;
let awaitingMove = false;
let isMovingToken = false;
let isDiceAnimating = false;
let passTurnTimer = null;
let diceSpin = 0;
let audioContext = null;
let audioMasterGain = null;
let soundsEnabled = true;
let eventDisplayTimer = null;
let message = "Roll the dice to start.";
let playerReactionSets = DEFAULT_REACTIONS.map((emojis) => new Set(emojis));
let reactionEditModes = PLAYERS.map(() => false);
let reactionCooldowns = PLAYERS.map(() => false);
let reactionCooldownTimers = PLAYERS.map(() => null);
let reactionHideTimers = PLAYERS.map(() => null);
let reactionMenus = PLAYERS.map(() => null);
let reactionSoundQueue = Promise.resolve();
let activeReactionAudio = null;
let activeReactionSources = new Set();
let gameplaySoundBusyUntil = 0;

function coordinateKey(row, column) {
  return `${row},${column}`;
}

function playerIndexAtStart(trackIndex) {
  return PLAYERS.findIndex((player) => player.start === trackIndex);
}

function getAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return null;

  if (!audioContext) {
    audioContext = new AudioContextConstructor();
    audioMasterGain = audioContext.createGain();
    audioMasterGain.gain.value = soundsEnabled ? 1 : 0;
    audioMasterGain.connect(audioContext.destination);
  }
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}

function updateSoundToggle() {
  soundToggle.textContent = `Sound: ${soundsEnabled ? "On" : "Off"}`;
  soundToggle.setAttribute("aria-pressed", String(soundsEnabled));
  soundToggle.setAttribute("aria-label", soundsEnabled ? "Mute all game sounds" : "Unmute all game sounds");
}

function showGameEvent(emoji, text) {
  clearTimeout(eventDisplayTimer);
  eventIndicator.textContent = `${emoji} ${text}`;
  eventIndicator.classList.remove("event-pop");
  void eventIndicator.offsetWidth;
  eventIndicator.classList.add("event-pop");
  eventDisplayTimer = window.setTimeout(() => {
    eventIndicator.textContent = "";
    eventIndicator.classList.remove("event-pop");
  }, EVENT_DISPLAY_MS);
}

function toggleGameSounds() {
  soundsEnabled = !soundsEnabled;
  if (audioMasterGain) {
    const currentTime = audioContext.currentTime;
    audioMasterGain.gain.cancelScheduledValues(currentTime);
    audioMasterGain.gain.value = soundsEnabled ? 1 : 0;
  }
  if (!soundsEnabled) {
    stopDiceSound();
    stopMoveSound();
    stopReactionSound();
  }
  updateSoundToggle();
}

function playTone(context, frequency, startTime, duration, volume, endFrequency = frequency) {
  stopReactionSound();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startTime + duration);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(audioMasterGain);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.01);
  gameplaySoundBusyUntil = Math.max(gameplaySoundBusyUntil, startTime + duration + 0.02);
}

function playNoiseBurst(context, startTime, duration, volume, cutoff) {
  stopReactionSound();
  const frameCount = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < frameCount; index += 1) {
    samples[index] = Math.random() * 2 - 1;
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioMasterGain);
  source.start(startTime);
  source.stop(startTime + duration + 0.01);
  gameplaySoundBusyUntil = Math.max(gameplaySoundBusyUntil, startTime + duration + 0.02);
}

function playDiceSound() {
  if (!soundsEnabled) return;
  const context = getAudioContext();
  if (!context) return;

  stopReactionSound();
  stopDiceSound();
  const duration = 1.1;
  const frameCount = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  samples.fill(0);
  [0.01, 0.052, 0.108, 0.177, 0.258, 0.351, 0.456, 0.572, 0.701, 0.84, 0.98, 1.065].forEach((clackTime, clackIndex) => {
    const clackStart = Math.floor(clackTime * context.sampleRate);
    const clackLength = Math.floor((0.007 + Math.random() * 0.008) * context.sampleRate);
    const clackVolume = 0.84 - clackIndex * 0.032;
    const clackPitch = 320 + Math.random() * 400;
    for (let index = 0; index < clackLength && clackStart + index < frameCount; index += 1) {
      const noiseDecay = Math.exp(-index / (context.sampleRate * 0.002));
      const bodyDecay = Math.exp(-index / (context.sampleRate * 0.012));
      const body = Math.sin((2 * Math.PI * clackPitch * index) / context.sampleRate) * bodyDecay * 0.42;
      samples[clackStart + index] += ((Math.random() * 2 - 1) * noiseDecay * 0.5 + body) * clackVolume;
    }
  });

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const startTime = context.currentTime;
  source.buffer = buffer;
  source.loop = false;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(3200, startTime);
  gain.gain.setValueAtTime(0.24, startTime);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioMasterGain);
  source.onended = () => {
    if (context.diceRollSource === source) context.diceRollSource = null;
  };
  context.diceRollSource = source;
  source.start(startTime);
  source.stop(startTime + duration);
  gameplaySoundBusyUntil = Math.max(gameplaySoundBusyUntil, startTime + duration + 0.02);
}

function stopDiceSound() {
  const source = audioContext?.diceRollSource;
  if (!source) return;

  audioContext.diceRollSource = null;
  source.stop();
}

function playMoveSound() {
  if (!soundsEnabled) return;
  const context = getAudioContext();
  if (!context) return;

  stopReactionSound();
  stopMoveSound();
  const loopDuration = 0.24;
  const frameCount = Math.floor(context.sampleRate * loopDuration);
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  samples.fill(0);
  [[0.018, 255], [0.132, 205]].forEach(([tapTime, frequency]) => {
    const tapStart = Math.floor(tapTime * context.sampleRate);
    const tapLength = Math.floor(0.045 * context.sampleRate);
    for (let index = 0; index < tapLength && tapStart + index < frameCount; index += 1) {
      const body = Math.sin((2 * Math.PI * frequency * index) / context.sampleRate);
      const bodyDecay = Math.exp(-index / (context.sampleRate * 0.014));
      const clickDecay = Math.exp(-index / (context.sampleRate * 0.0015));
      samples[tapStart + index] += (body * bodyDecay * 0.55 + (Math.random() * 2 - 1) * clickDecay * 0.2) * 0.7;
    }
  });

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  source.loop = true;
  source.loopStart = 0;
  source.loopEnd = loopDuration;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1500, context.currentTime);
  gain.gain.setValueAtTime(0.2, context.currentTime);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioMasterGain);
  source.onended = () => {
    if (context.moveSoundSource === source) context.moveSoundSource = null;
  };
  context.moveSoundSource = source;
  source.start();
}

function stopMoveSound() {
  const source = audioContext?.moveSoundSource;
  if (!source) return;

  audioContext.moveSoundSource = null;
  source.stop();
}

function playCaptureSound() {
  if (!soundsEnabled) return;
  const context = getAudioContext();
  if (!context) return;

  const startTime = context.currentTime;
  playNoiseBurst(context, startTime, 0.12, 0.22, 1000);
  playTone(context, 240, startTime, 0.13, 0.22, 100);
  playTone(context, 190, startTime + 0.07, 0.12, 0.18, 95);
}

function playEventNotes(notes) {
  if (!soundsEnabled) return;
  const context = getAudioContext();
  if (!context) return;

  stopReactionSound();
  const startTime = context.currentTime;
  notes.forEach(([frequency, delay, volume]) => {
    playTone(context, frequency, startTime + delay, 0.12, volume, frequency * 0.94);
  });
}

function playSafeSound() {
  playEventNotes([[880, 0, 0.13], [1174, 0.1, 0.15]]);
}

function playHomeSound() {
  playEventNotes([[523, 0, 0.14], [659, 0.1, 0.15], [784, 0.2, 0.17]]);
}

function playWinSound() {
  playEventNotes([[523, 0, 0.17], [659, 0.1, 0.18], [784, 0.2, 0.19], [1047, 0.34, 0.2]]);
}

function playExtraTurnSound() {
  playEventNotes([[740, 0, 0.13], [988, 0.09, 0.15], [1318, 0.18, 0.17]]);
}

function playReactionSound(emoji, onStart = () => {}) {
  const soundNotes = {
    "😊": [[659, 0, 0.055], [784, 0.11, 0.06]],
    "😢": [[392, 0, 0.06], [330, 0.12, 0.055]],
    "😡": [[220, 0, 0.075], [185, 0.11, 0.07]],
    "😭": [[494, 0, 0.06], [330, 0.12, 0.05], [262, 0.24, 0.045]],
    "😂": [[622, 0, 0.055], [740, 0.1, 0.06], [622, 0.2, 0.055]],
    "😱": [[1047, 0, 0.07], [784, 0.13, 0.06]],
    "😍": [[587, 0, 0.055], [880, 0.13, 0.065]],
    "😎": [[440, 0, 0.055], [554, 0.14, 0.06]],
    "🤩": [[659, 0, 0.06], [880, 0.11, 0.065], [1175, 0.22, 0.07]],
    "🥳": [[523, 0, 0.06], [659, 0.11, 0.065], [784, 0.22, 0.07]],
    "👏": [[740, 0, 0.055], [740, 0.1, 0.055], [880, 0.23, 0.065]],
    "🔥": [[784, 0, 0.06], [988, 0.12, 0.065]],
    "👍": [[523, 0, 0.055], [659, 0.13, 0.06]],
    "😤": [[247, 0, 0.07], [196, 0.15, 0.065]]
  }[emoji];
  if (!soundNotes) {
    onStart();
    return Promise.resolve(false);
  }

  let animationStarted = false;
  const startAnimation = () => {
    if (animationStarted) return;
    animationStarted = true;
    onStart();
  };
  const context = getAudioContext();
  if (!soundsEnabled || !context) {
    startAnimation();
    return Promise.resolve(false);
  }

  reactionSoundQueue = reactionSoundQueue
    .then(async () => {
      while (soundsEnabled && (context.diceRollSource || context.moveSoundSource || context.currentTime < gameplaySoundBusyUntil)) {
        await new Promise((resolve) => window.setTimeout(resolve, 40));
      }
      if (!soundsEnabled) {
        startAnimation();
        return false;
      }

      const soundFile = REACTION_SOUND_FILES[emoji];
      if (soundFile) {
        const audio = new Audio(soundFile);
        audio.volume = 0.26;
        activeReactionAudio = audio;
        try {
          await audio.play();
          startAnimation();
          await new Promise((resolve) => audio.addEventListener("ended", resolve, { once: true }));
          if (activeReactionAudio === audio) activeReactionAudio = null;
          return true;
        } catch {
          audio.pause();
          if (activeReactionAudio === audio) activeReactionAudio = null;
        }
      }

      const startTime = context.currentTime + 0.02;
      soundNotes.forEach(([frequency, delay, volume]) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, startTime + delay);
        gain.gain.setValueAtTime(0.0001, startTime + delay);
        gain.gain.exponentialRampToValueAtTime(volume, startTime + delay + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + delay + 0.09);
        oscillator.connect(gain);
        gain.connect(audioMasterGain);
        activeReactionSources.add(oscillator);
        oscillator.onended = () => activeReactionSources.delete(oscillator);
        oscillator.start(startTime + delay);
        oscillator.stop(startTime + delay + 0.1);
      });
      startAnimation();
      const soundDuration = Math.max(...soundNotes.map(([, delay]) => delay)) + 0.11;
      await new Promise((resolve) => window.setTimeout(resolve, soundDuration * 1000));
    })
    .catch(() => startAnimation());
  return reactionSoundQueue;
}

function stopReactionSound() {
  if (activeReactionAudio) {
    activeReactionAudio.pause();
    activeReactionAudio.currentTime = 0;
    activeReactionAudio = null;
  }
  activeReactionSources.forEach((source) => {
    try {
      source.stop();
    } catch {
      activeReactionSources.delete(source);
    }
  });
}

function closeReactionMenu(playerIndex) {
  const menu = reactionMenus[playerIndex];
  const trigger = document.querySelector(`[data-reaction-player="${PLAYERS[playerIndex].id}"]`);
  if (!menu || !trigger) return;

  menu.hidden = true;
  reactionEditModes[playerIndex] = false;
  trigger.setAttribute("aria-expanded", "false");
}

function closeOtherReactionMenus(activePlayerIndex = -1) {
  reactionMenus.forEach((_, playerIndex) => {
    if (playerIndex !== activePlayerIndex) closeReactionMenu(playerIndex);
  });
}

function renderReactionOptions(playerIndex) {
  const menu = reactionMenus[playerIndex];
  const optionsContainer = menu.querySelector(".reaction-options");
  const favoriteSet = playerReactionSets[playerIndex];
  const availableOptions = reactionEditModes[playerIndex]
    ? REACTION_OPTIONS
    : REACTION_OPTIONS.filter(({ emoji }) => favoriteSet.has(emoji));

  optionsContainer.replaceChildren();
  availableOptions.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reaction-option";
    button.textContent = option.emoji;
    button.title = option.label;
    button.setAttribute("aria-label", `${option.label} reaction`);
    button.setAttribute("aria-pressed", String(favoriteSet.has(option.emoji)));
    button.addEventListener("click", () => {
      if (reactionEditModes[playerIndex]) {
        if (favoriteSet.has(option.emoji)) {
          if (favoriteSet.size <= 1) return;
          favoriteSet.delete(option.emoji);
        } else {
          favoriteSet.add(option.emoji);
        }
        renderReactionOptions(playerIndex);
        return;
      }

      sendPlayerReaction(playerIndex, option);
    });
    optionsContainer.append(button);
  });

  menu.querySelector(".reaction-edit-button").textContent = reactionEditModes[playerIndex] ? "Done" : "Edit favorites";
  menu.querySelector(".reaction-menu-note").textContent = reactionEditModes[playerIndex]
    ? "Choose your favorite reactions"
    : "Tap a favorite to send it";
}

function buildReactionMenus() {
  PLAYERS.forEach((player, playerIndex) => {
    const row = document.querySelector(`.player-row[data-player="${player.id}"]`);
    const trigger = row.querySelector(".player-reaction-trigger");
    const menu = document.createElement("div");
    menu.className = "reaction-menu";
    menu.id = `${player.id}-reaction-menu`;
    menu.hidden = true;
    menu.setAttribute("aria-label", `${player.name} reaction menu`);

    const heading = document.createElement("div");
    heading.className = "reaction-menu-heading";
    const title = document.createElement("span");
    title.textContent = `${player.name} reactions`;
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "reaction-edit-button";
    editButton.addEventListener("click", () => {
      reactionEditModes[playerIndex] = !reactionEditModes[playerIndex];
      renderReactionOptions(playerIndex);
    });
    heading.append(title, editButton);

    const options = document.createElement("div");
    options.className = "reaction-options";
    const note = document.createElement("p");
    note.className = "reaction-menu-note";
    menu.append(heading, options, note);
    row.append(menu);
    reactionMenus[playerIndex] = menu;
    renderReactionOptions(playerIndex);

    trigger.setAttribute("aria-controls", menu.id);
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const shouldOpen = menu.hidden;
      closeOtherReactionMenus(playerIndex);
      menu.hidden = !shouldOpen;
      trigger.setAttribute("aria-expanded", String(shouldOpen));
      if (shouldOpen) renderReactionOptions(playerIndex);
    });
    menu.addEventListener("click", (event) => event.stopPropagation());
  });

  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".player-row")) closeOtherReactionMenus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeOtherReactionMenus();
  });
}

function sendPlayerReaction(playerIndex, option) {
  if (reactionCooldowns[playerIndex] || !playerReactionSets[playerIndex].has(option.emoji)) return;

  const player = PLAYERS[playerIndex];
  const trigger = document.querySelector(`[data-reaction-player="${player.id}"]`);
  const bubble = document.getElementById(`${player.id}-reaction`);
  closeReactionMenu(playerIndex);
  reactionCooldowns[playerIndex] = true;
  trigger.disabled = true;
  reactionCooldownTimers[playerIndex] = window.setTimeout(() => {
    reactionCooldowns[playerIndex] = false;
    trigger.disabled = false;
  }, 1500);

  clearTimeout(reactionHideTimers[playerIndex]);
  bubble.className = `base-reaction base-reaction--${player.id}`;
  bubble.replaceChildren();
  bubble.setAttribute("aria-label", `${player.name} sent ${option.label}`);
  bubble.hidden = true;

  const startReaction = () => {
    const symbol = document.createElement("span");
    symbol.className = "reaction-symbol";
    symbol.textContent = option.emoji;
    bubble.replaceChildren(symbol);
    bubble.className = `base-reaction base-reaction--${player.id} reaction-visible reaction-${option.animation}`;
    bubble.hidden = false;
    showGameEvent(option.emoji, `${player.name}: ${option.caption}`);
    reactionHideTimers[playerIndex] = window.setTimeout(() => {
      bubble.classList.add("reaction-fading");
      reactionHideTimers[playerIndex] = window.setTimeout(() => {
        bubble.hidden = true;
        bubble.className = `base-reaction base-reaction--${player.id}`;
        bubble.replaceChildren();
      }, 320);
    }, 2500);
  };

  playReactionSound(option.emoji, startReaction);
}

function diceTranslation(offset) {
  const operator = offset < 0 ? "-" : "+";
  return `calc(-50% ${operator} ${Math.abs(offset)}px)`;
}

function buildDice() {
  DICE_FACES.forEach(({ value, pips }) => {
    const face = document.createElement("span");
    face.className = `die-face die-face--${value}`;

    for (let pipIndex = 0; pipIndex < 9; pipIndex += 1) {
      const pip = document.createElement("span");
      pip.className = pips.includes(pipIndex) ? "die-pip die-pip--active" : "die-pip";
      face.append(pip);
    }

    diceCube.append(face);
  });
}

function animateDice(value) {
  const face = DICE_FACES.find((diceFace) => diceFace.value === value);
  const [rotationX, rotationY] = face.rotation;
  const boardBounds = board.getBoundingClientRect();
  const dieBounds = diceResult.getBoundingClientRect();
  const startOffsetX = dieBounds.left + dieBounds.width / 2 - (boardBounds.left + boardBounds.width / 2);
  const startOffsetY = dieBounds.top + dieBounds.height / 2 - (boardBounds.top + boardBounds.height / 2);
  const maxOffsetX = Math.max(0, (board.clientWidth - diceResult.offsetWidth) / 2 - 8);
  const maxOffsetY = Math.max(0, (board.clientHeight - diceResult.offsetHeight) / 2 - 8);
  const offsetX = Math.round((Math.random() * 2 - 1) * maxOffsetX);
  const offsetY = Math.round((Math.random() * 2 - 1) * maxOffsetY);

  diceSpin += 2;
  diceResult.style.setProperty("--dice-travel-x", `${offsetX}px`);
  diceResult.style.setProperty("--dice-travel-y", `${offsetY}px`);
  diceResult.style.setProperty("--dice-start-x", diceTranslation(startOffsetX - offsetX));
  diceResult.style.setProperty("--dice-start-y", diceTranslation(startOffsetY - offsetY));
  diceResult.style.left = `calc(50% + ${offsetX}px)`;
  diceResult.style.top = `calc(50% + ${offsetY}px)`;
  diceCube.style.transform = `rotateX(${rotationX + diceSpin * 360}deg) rotateY(${rotationY + diceSpin * 360}deg)`;
  diceResult.classList.remove("dice-moving");
  void diceResult.offsetWidth;
  isDiceAnimating = true;
  diceResult.classList.add("dice-moving");
  const animation = diceResult.getAnimations().find((item) => item.animationName === "dice-travel");
  if (!animation) {
    finishDiceAnimation();
    return null;
  }
  animation?.finished.then(finishDiceAnimation).catch(() => {});
  return animation;
}

function finishDiceAnimation() {
  if (!isDiceAnimating) return;
  stopDiceSound();
  diceResult.classList.remove("dice-moving");
  isDiceAnimating = false;
  renderGame();
}

function stopDiceAnimation() {
  if (!isDiceAnimating) return;

  const animation = diceResult.getAnimations().find((item) => item.animationName === "dice-travel");
  if (animation) animation.finish();
  finishDiceAnimation();
}

function buildBoard() {
  const trackIndexes = new Map(TRACK.map((coordinate, index) => [coordinateKey(...coordinate), index]));
  const homeLanes = new Map();
  const nestOwners = new Map();

  PLAYERS.forEach((player, playerIndex) => {
    player.home.forEach((coordinate, index) => homeLanes.set(coordinateKey(...coordinate), { playerIndex, index }));
    player.nests.forEach((coordinate, tokenIndex) => nestOwners.set(coordinateKey(...coordinate), { playerIndex, tokenIndex }));
  });

  for (let row = 0; row < 15; row += 1) {
    for (let column = 0; column < 15; column += 1) {
      const cell = document.createElement("div");
      const key = coordinateKey(row, column);
      cell.className = "board-cell";
      cell.setAttribute("role", "gridcell");
      cell.dataset.row = String(row);
      cell.dataset.column = String(column);

      if (row < 6 && column < 6) {
        cell.classList.add("base-area--red");
        if (row === 0) cell.classList.add("base-edge-top");
        if (row === 5) cell.classList.add("base-edge-bottom");
        if (column === 0) cell.classList.add("base-edge-left");
        if (column === 5) cell.classList.add("base-edge-right");
      }
      if (row < 6 && column > 8) {
        cell.classList.add("base-area--green");
        if (row === 0) cell.classList.add("base-edge-top");
        if (row === 5) cell.classList.add("base-edge-bottom");
        if (column === 9) cell.classList.add("base-edge-left");
        if (column === 14) cell.classList.add("base-edge-right");
      }
      if (row > 8 && column > 8) {
        cell.classList.add("base-area--yellow");
        if (row === 9) cell.classList.add("base-edge-top");
        if (row === 14) cell.classList.add("base-edge-bottom");
        if (column === 9) cell.classList.add("base-edge-left");
        if (column === 14) cell.classList.add("base-edge-right");
      }
      if (row > 8 && column < 6) {
        cell.classList.add("base-area--blue");
        if (row === 9) cell.classList.add("base-edge-top");
        if (row === 14) cell.classList.add("base-edge-bottom");
        if (column === 0) cell.classList.add("base-edge-left");
        if (column === 5) cell.classList.add("base-edge-right");
      }

      if (trackIndexes.has(key)) {
        const trackIndex = trackIndexes.get(key);
        cell.classList.add("track");
        if (SAFE_TRACK_INDEXES.has(trackIndex)) cell.classList.add("safe");
        const startPlayerIndex = playerIndexAtStart(trackIndex);
        if (startPlayerIndex !== -1) cell.classList.add(`track-start--${PLAYERS[startPlayerIndex].id}`);
      }

      const lane = homeLanes.get(key);
      if (lane) {
        cell.classList.add(`home-lane--${PLAYERS[lane.playerIndex].id}`);
        if (lane.index === 4) cell.classList.add("safe");
      }

      const nest = nestOwners.get(key);
      if (nest) {
        cell.classList.add("nest", `base-area--${PLAYERS[nest.playerIndex].id}`);
        cell.dataset.nestPlayer = String(nest.playerIndex);
        cell.dataset.nestToken = String(nest.tokenIndex);
      }

      if (row >= 6 && row <= 8 && column >= 6 && column <= 8) {
        cell.classList.add("center-piece");
        if (row === 7 && column === 7) {
          cell.classList.add("center-final");
        } else if (row === 6) {
          cell.classList.add("center-edge--green");
        } else if (row === 8) {
          cell.classList.add("center-edge--blue");
        } else if (column === 6) {
          cell.classList.add("center-edge--red");
        } else {
          cell.classList.add("center-edge--yellow");
        }
      }

      board.append(cell);
    }
  }
}

function createTokens() {
  return PLAYERS.map(() => Array.from({ length: 4 }, () => ({ progress: -1 })));
}

function startGame(isRestart = false) {
  clearTimeout(passTurnTimer);
  passTurnTimer = null;
  tokens = createTokens();
  currentPlayerIndex = 0;
  diceValue = null;
  lastDiceValue = null;
  gameStarted = true;
  gameOver = false;
  awaitingMove = false;
  message = isRestart ? "Game restarted. Red player's turn." : "Red player's turn. Roll the dice.";
  renderGame();
}

function getTrackIndex(player, progress) {
  return (player.start + progress) % TRACK.length;
}

function getTokenCoordinate(playerIndex, tokenIndex) {
  const token = tokens[playerIndex][tokenIndex];
  const player = PLAYERS[playerIndex];

  if (token.progress === -1) return player.nests[tokenIndex];
  if (token.progress <= 50) return TRACK[getTrackIndex(player, token.progress)];
  if (token.progress <= 55) return player.home[token.progress - 51];
  return [7, 7];
}

function calculatePlayerProgress(playerIndex) {
  const playerTokens = tokens[playerIndex] || [];
  if (playerTokens.length === 0) return 0;

  const totalProgress = playerTokens.reduce((sum, token) => sum + Math.max(0, Math.min(token.progress, 56)), 0);
  return Math.round((totalProgress / (playerTokens.length * 56)) * 100);
}

function getLegalTokenIndexes(playerIndex, roll) {
  return tokens[playerIndex]
    .map((token, tokenIndex) => ({ token, tokenIndex }))
    .filter(({ token }) => {
      if (token.progress === -1) return roll === 6;
      return token.progress < 56 && token.progress + roll <= 56;
    })
    .map(({ tokenIndex }) => tokenIndex);
}

function renderTokens() {
  const cells = Array.from(board.children);
  const cellByCoordinate = new Map(cells.map((cell) => [coordinateKey(Number(cell.dataset.row), Number(cell.dataset.column)), cell]));
  const tokenLocations = [];

  tokens.forEach((playerTokens, playerIndex) => {
    playerTokens.forEach((token, tokenIndex) => {
      const [row, column] = getTokenCoordinate(playerIndex, tokenIndex);
      tokenLocations.push({ playerIndex, tokenIndex, cell: cellByCoordinate.get(coordinateKey(row, column)) });
    });
  });

  cells.forEach((cell) => {
    cell.querySelectorAll(".token").forEach((token) => token.remove());
    cell.classList.remove("has-stack");
  });

  const legalTokens = awaitingMove ? getLegalTokenIndexes(currentPlayerIndex, diceValue) : [];
  const tokensPerCell = new Map();
  tokenLocations.forEach((location) => {
    tokensPerCell.set(location.cell, (tokensPerCell.get(location.cell) || 0) + 1);
  });

  tokenLocations.forEach(({ playerIndex, tokenIndex, cell }) => {
    const tokenButton = document.createElement("button");
    const player = PLAYERS[playerIndex];
    tokenButton.type = "button";
    tokenButton.className = `token token--${player.id}`;
    tokenButton.textContent = String(tokenIndex + 1);
    tokenButton.setAttribute("aria-label", `${player.name} token ${tokenIndex + 1}${tokens[playerIndex][tokenIndex].progress === 56 ? ", finished" : ""}`);
    tokenButton.title = `${player.name} token ${tokenIndex + 1}`;
    const isLegalMove = playerIndex === currentPlayerIndex && legalTokens.includes(tokenIndex);
    tokenButton.disabled = !gameStarted || gameOver || !awaitingMove || !isLegalMove || isDiceAnimating || isMovingToken;
    if (isLegalMove) tokenButton.classList.add("selectable");
    if (tokens[playerIndex][tokenIndex].isBeingCut) tokenButton.classList.add("token-cut");
    tokenButton.addEventListener("click", () => moveToken(playerIndex, tokenIndex));
    cell.append(tokenButton);
  });

  tokensPerCell.forEach((count, cell) => {
    if (count > 1) cell.classList.add("has-stack");
  });
}

function renderGame() {
  const player = PLAYERS[currentPlayerIndex];
  currentPlayerLabel.textContent = gameOver ? "Game complete" : gameStarted ? `${player.name} player's turn` : "Ready to play";
  turnDot.style.backgroundColor = gameStarted ? `var(--${player.id})` : "#aab1b4";
  gameMessage.textContent = message;
  diceResult.disabled = gameOver || awaitingMove || isMovingToken || isDiceAnimating || passTurnTimer !== null;
  diceResult.hidden = gameOver;
  diceResult.setAttribute("aria-label", lastDiceValue === null ? "Tap the die to roll" : `Die shows ${lastDiceValue}. Tap to roll`);
  startButton.disabled = gameStarted && !gameOver;
  restartButton.disabled = !gameStarted || isMovingToken || isDiceAnimating;

  document.querySelectorAll(".player-row").forEach((row, playerIndex) => {
    row.classList.toggle("active", gameStarted && !gameOver && playerIndex === currentPlayerIndex);
    const playerTokens = tokens[playerIndex] || [];
    const homeCount = playerTokens.filter((token) => token.progress === 56).length;
    const progressPercent = calculatePlayerProgress(playerIndex);
    const playerId = PLAYERS[playerIndex].id;
    const progressIndicator = document.getElementById(`${playerId}-base-progress`);
    document.getElementById(`${playerId}-progress`).textContent = `${progressPercent}%`;
    progressIndicator.setAttribute("aria-valuenow", String(progressPercent));
    progressIndicator.style.setProperty("--progress", `${progressPercent}%`);
    progressIndicator.dataset.closeToFinish = String(progressPercent >= 75 && progressPercent < 100);
    progressIndicator.dataset.complete = String(progressPercent === 100);
    document.getElementById(`${PLAYERS[playerIndex].id}-count`).textContent = `${homeCount} / 4 home`;
  });

  renderTokens();
}

function rollDice() {
  if (!gameStarted) startGame();
  if (gameOver || awaitingMove || isMovingToken || isDiceAnimating || passTurnTimer !== null) return;

  playDiceSound();
  showGameEvent("🎲", "Dice rolling");
  diceValue = Math.floor(Math.random() * 6) + 1;
  lastDiceValue = diceValue;
  const diceAnimation = animateDice(diceValue);
  const legalTokens = getLegalTokenIndexes(currentPlayerIndex, diceValue);
  message = `You rolled ${diceValue}.`;

  if (legalTokens.length === 0) {
    message += " No valid moves.";
    awaitingMove = false;
    const rolledSix = diceValue === 6;
    const passTurn = () => {
      if (!gameStarted || gameOver) return;
      passTurnTimer = window.setTimeout(() => {
        if (gameStarted && !gameOver) finishTurn(rolledSix);
      }, 900);
    };
    if (diceAnimation) diceAnimation.finished.then(passTurn).catch(() => {});
    else passTurn();
    renderGame();
    return;
  }

  const playerTokens = tokens[currentPlayerIndex];
  const allTokensTogether = playerTokens.every((token) => token.progress === playerTokens[0].progress);
  if (legalTokens.length === 1 || allTokensTogether) {
    awaitingMove = true;
    message += ` Moving token ${legalTokens[0] + 1} when the die stops.`;
    renderGame();
    const autoMove = () => moveToken(currentPlayerIndex, legalTokens[0], true);
    if (diceAnimation) diceAnimation.finished.then(autoMove).catch(() => {});
    else autoMove();
    return;
  }

  awaitingMove = true;
  message += " Choose a token.";
  renderGame();
}

async function moveToken(playerIndex, tokenIndex, automatic = false) {
  if (!gameStarted || gameOver || !awaitingMove || isDiceAnimating || isMovingToken || playerIndex !== currentPlayerIndex) return;

  const legalTokens = getLegalTokenIndexes(playerIndex, diceValue);
  if (!legalTokens.includes(tokenIndex)) {
    message = "Invalid move. Choose a highlighted token.";
    renderGame();
    return;
  }

  const player = PLAYERS[playerIndex];
  const token = tokens[playerIndex][tokenIndex];
  const rolledValue = diceValue;
  const previousProgress = token.progress;
  const progressSteps = token.progress === -1
    ? [0]
    : Array.from({ length: rolledValue }, (_, stepIndex) => token.progress + stepIndex + 1);

  isMovingToken = true;
  stopDiceSound();
  playMoveSound();
  showGameEvent(automatic ? "⚡🏃" : "🏃", `${player.name} token moving`);
  message = automatic
    ? `You rolled ${rolledValue}. ${player.name} token ${tokenIndex + 1} is moving.`
    : `${player.name} token ${tokenIndex + 1} is moving.`;

  for (const progress of progressSteps) {
    token.progress = progress;
    renderGame();
    await new Promise((resolve) => window.setTimeout(resolve, TOKEN_STEP_DELAY_MS));
  }

  stopMoveSound();
  const capturedTokens = await captureOpponents(playerIndex, token);
  isMovingToken = false;
  awaitingMove = false;

  const landedSafeSquare = token.progress >= 0
    && token.progress <= 50
    && SAFE_TRACK_INDEXES.has(getTrackIndex(player, token.progress));
  const enteredHomeLane = previousProgress <= 50 && token.progress > 50 && token.progress < 56;
  if (landedSafeSquare) {
    playSafeSound();
    showGameEvent("🛡️", `${player.name} reached a safe square`);
  } else if (token.progress === 56) {
    playHomeSound();
    showGameEvent("⭐", `${player.name} token reached finish`);
  } else if (enteredHomeLane) {
    playHomeSound();
    showGameEvent("🏠", `${player.name} entered the home lane`);
  }

  const moveMessage = token.progress === 56
    ? `${player.name} token ${tokenIndex + 1} reached home.`
    : `${player.name} moved token ${tokenIndex + 1}.`;
  message = automatic ? `You rolled ${rolledValue}. ${moveMessage}` : moveMessage;
  const capturedPlayers = [...new Set(capturedTokens.map(({ playerIndex: capturedPlayerIndex }) => PLAYERS[capturedPlayerIndex].name))];
  const captureMessage = capturedPlayers.length > 0 ? `${player.name} cut ${capturedPlayers.join(" and ")}!` : "";
  if (captureMessage) message += ` ${captureMessage}`;

  if (tokens[playerIndex].every((currentToken) => currentToken.progress === 56)) {
    gameOver = true;
    message = `${player.name} player wins!${captureMessage ? ` ${captureMessage}` : ""}`;
    playWinSound();
    showGameEvent("🎉🏆", `${player.name} wins!`);
    renderGame();
    return;
  }

  const rolledSix = diceValue === 6;
  diceValue = null;
  if (!rolledSix) currentPlayerIndex = (currentPlayerIndex + 1) % PLAYERS.length;
  message += rolledSix ? ` ${player.name} player's turn again.` : ` ${PLAYERS[currentPlayerIndex].name} player's turn.`;
  if (rolledSix) {
    playExtraTurnSound();
    showGameEvent(captureMessage ? "⭐✂️💥😱" : "⭐", `${player.name} gets another turn`);
  } else if (captureMessage) {
    showGameEvent("✂️💥😱", captureMessage);
  } else if (!landedSafeSquare && token.progress !== 56 && !enteredHomeLane) {
    showGameEvent("👏", `${player.name} made a good move`);
  }
  renderGame();
}

async function captureOpponents(playerIndex, movedToken) {
  if (movedToken.progress < 0 || movedToken.progress > 50) return [];

  const landingTrackIndex = getTrackIndex(PLAYERS[playerIndex], movedToken.progress);
  if (SAFE_TRACK_INDEXES.has(landingTrackIndex)) return [];

  const capturedTokens = [];
  tokens.forEach((playerTokens, opponentIndex) => {
    if (opponentIndex === playerIndex) return;
    playerTokens.forEach((opponentToken, tokenIndex) => {
      if (opponentToken.progress < 0 || opponentToken.progress > 50) return;
      const opponentTrackIndex = getTrackIndex(PLAYERS[opponentIndex], opponentToken.progress);
      if (opponentTrackIndex === landingTrackIndex) {
        capturedTokens.push({ token: opponentToken, playerIndex: opponentIndex, tokenIndex });
      }
    });
  });

  if (capturedTokens.length === 0) return capturedTokens;

  const capturedPlayers = [...new Set(capturedTokens.map(({ playerIndex: capturedPlayerIndex }) => PLAYERS[capturedPlayerIndex].name))];
  const capturedPlayerIndexes = [...new Set(capturedTokens.map(({ playerIndex: capturedPlayerIndex }) => capturedPlayerIndex))];
  capturedTokens.forEach(({ token }) => {
    token.progress = -1;
    token.isBeingCut = true;
  });
  message = `${PLAYERS[playerIndex].name} cut ${capturedPlayers.join(" and ")}!`;
  renderGame();
  playCaptureSound();
  showGameEvent("✂️💥😱", message);
  await new Promise((resolve) => window.setTimeout(resolve, CAPTURE_ANIMATION_MS));
  capturedTokens.forEach(({ token }) => {
    token.isBeingCut = false;
  });
  return capturedTokens;
}

function finishTurn(rolledSix) {
  passTurnTimer = null;
  diceValue = null;
  awaitingMove = false;
  if (!rolledSix) currentPlayerIndex = (currentPlayerIndex + 1) % PLAYERS.length;
  message = rolledSix
    ? `${PLAYERS[currentPlayerIndex].name} player's turn again.`
    : `${PLAYERS[currentPlayerIndex].name} player's turn.`;
  if (rolledSix) {
    playExtraTurnSound();
    showGameEvent("⭐", `${PLAYERS[currentPlayerIndex].name} gets another turn`);
  }
  renderGame();
}

function restartGame() {
  startGame(true);
}

buildBoard();
buildDice();
tokens = createTokens();
buildReactionMenus();
startButton.addEventListener("click", () => startGame());
restartButton.addEventListener("click", restartGame);
soundToggle.addEventListener("click", toggleGameSounds);
diceResult.addEventListener("click", rollDice);
updateSoundToggle();
renderGame();
