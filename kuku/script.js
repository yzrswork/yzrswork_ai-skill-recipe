(() => {
  "use strict";

  const TOTAL_QUESTIONS = 10;
  const STORAGE_KEY = "yzrs-kuku-best-v1";
  const FACTOR_MIN = 2;
  const FACTOR_MAX = 9;

  const elements = {
    quizPanel: document.querySelector("#quiz-panel"),
    finishPanel: document.querySelector("#finish-panel"),
    questionCount: document.querySelector("#question-count"),
    bestScore: document.querySelector("#best-score"),
    score: document.querySelector("#score"),
    progress: document.querySelector("#progress"),
    progressFill: document.querySelector("#progress-fill"),
    streakChip: document.querySelector("#streak-chip"),
    factorA: document.querySelector("#factor-a"),
    factorB: document.querySelector("#factor-b"),
    feedback: document.querySelector("#feedback"),
    answers: document.querySelector("#answers"),
    soundToggle: document.querySelector("#sound-toggle"),
    soundLabel: document.querySelector("#sound-label"),
    finishTitle: document.querySelector("#finish-title"),
    finishMessage: document.querySelector("#finish-message"),
    finishMedal: document.querySelector("#finish-medal"),
    finalScore: document.querySelector("#final-score"),
    finalStreak: document.querySelector("#final-streak"),
    bestMessage: document.querySelector("#best-message"),
    restartButton: document.querySelector("#restart-button"),
    confettiLayer: document.querySelector("#confetti-layer"),
  };

  const state = {
    deck: [],
    questionIndex: 0,
    attempts: 0,
    firstTryScore: 0,
    streak: 0,
    maxStreak: 0,
    locked: false,
    soundEnabled: false,
    audioContext: null,
    bestScore: readBestScore(),
  };

  function shuffle(items) {
    const result = [...items];

    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }

    return result;
  }

  function buildDeck() {
    const questions = [];

    for (let first = FACTOR_MIN; first <= FACTOR_MAX; first += 1) {
      for (let second = first; second <= FACTOR_MAX; second += 1) {
        const shouldFlip = first !== second && Math.random() >= 0.5;
        const displayedFirst = shouldFlip ? second : first;
        const displayedSecond = shouldFlip ? first : second;
        questions.push({
          first: displayedFirst,
          second: displayedSecond,
          answer: first * second,
        });
      }
    }

    return shuffle(questions).slice(0, TOTAL_QUESTIONS);
  }

  function buildChoices(question) {
    const { first, second, answer } = question;
    const candidates = shuffle([
      first * (second - 1),
      first * (second + 1),
      (first - 1) * second,
      (first + 1) * second,
      answer - first,
      answer + first,
      answer - second,
      answer + second,
      answer - 2,
      answer + 2,
      answer - 1,
      answer + 1,
    ]);

    const choices = [answer];

    for (const candidate of candidates) {
      if (candidate > 0 && candidate <= 81 && !choices.includes(candidate)) {
        choices.push(candidate);
      }

      if (choices.length === 3) {
        break;
      }
    }

    while (choices.length < 3) {
      const fallback = Math.floor(Math.random() * 80) + 1;
      if (!choices.includes(fallback)) {
        choices.push(fallback);
      }
    }

    return shuffle(choices);
  }

  function readBestScore() {
    try {
      const saved = Number.parseInt(window.localStorage.getItem(STORAGE_KEY) || "0", 10);
      return Number.isFinite(saved) ? Math.min(Math.max(saved, 0), TOTAL_QUESTIONS) : 0;
    } catch (_error) {
      return 0;
    }
  }

  function writeBestScore(score) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(score));
    } catch (_error) {
      // Safariのプライベートブラウズ等で保存できなくても、ゲームは続けられる。
    }
  }

  function setProgress(completed) {
    const safeCompleted = Math.min(Math.max(completed, 0), TOTAL_QUESTIONS);
    const percentage = (safeCompleted / TOTAL_QUESTIONS) * 100;
    elements.progressFill.style.width = `${percentage}%`;
    elements.progress.setAttribute("aria-valuenow", String(safeCompleted));
  }

  function updateStreak() {
    if (state.streak >= 2) {
      elements.streakChip.textContent = `${state.streak}もん れんぞく！`;
      elements.streakChip.classList.add("is-hot");
      return;
    }

    elements.streakChip.textContent = state.streak === 1 ? "いいスタート！" : "つぎで きめよう！";
    elements.streakChip.classList.remove("is-hot");
  }

  function setFeedback(message, kind = "neutral") {
    elements.feedback.textContent = message;
    elements.feedback.classList.toggle("is-correct", kind === "correct");
    elements.feedback.classList.toggle("is-wrong", kind === "wrong");
  }

  function renderQuestion() {
    const question = state.deck[state.questionIndex];
    state.attempts = 0;
    state.locked = false;

    elements.questionCount.textContent = `${state.questionIndex + 1} / ${TOTAL_QUESTIONS}`;
    elements.factorA.textContent = String(question.first);
    elements.factorB.textContent = String(question.second);
    elements.score.textContent = String(state.firstTryScore);
    setProgress(state.questionIndex);
    setFeedback("したから えらんでね");
    updateStreak();

    elements.answers.replaceChildren();

    for (const choice of buildChoices(question)) {
      const button = document.createElement("button");
      button.className = "answer-button";
      button.type = "button";
      button.textContent = String(choice);
      button.setAttribute("aria-label", `${choice}を選ぶ`);
      button.addEventListener("click", () => handleAnswer(button, choice));
      elements.answers.append(button);
    }
  }

  function handleAnswer(button, choice) {
    if (state.locked || button.disabled) {
      return;
    }

    const question = state.deck[state.questionIndex];
    state.attempts += 1;

    if (choice !== question.answer) {
      button.classList.add("is-wrong");
      button.disabled = true;
      state.streak = 0;
      updateStreak();
      setFeedback("おしい！ もういちど えらべるよ", "wrong");
      playTone("wrong");
      return;
    }

    state.locked = true;
    button.classList.add("is-correct");

    for (const answerButton of elements.answers.querySelectorAll("button")) {
      answerButton.disabled = true;
    }

    if (state.attempts === 1) {
      state.firstTryScore += 1;
      state.streak += 1;
      state.maxStreak = Math.max(state.maxStreak, state.streak);
      setFeedback(state.streak >= 3 ? `${state.streak}もん れんぞく せいかい！` : "せいかい！", "correct");
    } else {
      setFeedback("せいかい！ できたね！", "correct");
    }

    elements.score.textContent = String(state.firstTryScore);
    setProgress(state.questionIndex + 1);
    updateStreak();
    playTone("correct");
    burstConfetti();

    window.setTimeout(goToNextQuestion, 760);
  }

  function goToNextQuestion() {
    state.questionIndex += 1;

    if (state.questionIndex >= TOTAL_QUESTIONS) {
      showFinish();
      return;
    }

    renderQuestion();
  }

  function getResultCopy(score) {
    if (score === TOTAL_QUESTIONS) {
      return {
        title: "九九マスター！",
        message: "ぜんもん いっぱつせいかい。すごい！",
        medal: "10",
      };
    }

    if (score >= 7) {
      return {
        title: "だいせいこう！",
        message: "九九の力が ぐんぐん のびてる！",
        medal: "★",
      };
    }

    if (score >= 4) {
      return {
        title: "いいちょうし！",
        message: "できる もんだいが ふえてきた！",
        medal: "＋",
      };
    }

    return {
      title: "10もん できた！",
      message: "さいごまで ちょうせんできたね！",
      medal: "○",
    };
  }

  function showFinish() {
    const previousBest = state.bestScore;
    const result = getResultCopy(state.firstTryScore);

    state.bestScore = Math.max(state.bestScore, state.firstTryScore);
    writeBestScore(state.bestScore);

    elements.finishTitle.textContent = result.title;
    elements.finishMessage.textContent = result.message;
    elements.finishMedal.textContent = result.medal;
    elements.finalScore.textContent = String(state.firstTryScore);
    elements.finalStreak.textContent = String(state.maxStreak);
    elements.bestScore.textContent = String(state.bestScore);

    if (state.firstTryScore > previousBest) {
      elements.bestMessage.textContent = "じこベスト こうしん！";
    } else if (state.firstTryScore === previousBest && state.firstTryScore > 0) {
      elements.bestMessage.textContent = "じこベストと おなじ！";
    } else {
      elements.bestMessage.textContent = `じこベストは ${state.bestScore}もん！`;
    }

    elements.quizPanel.hidden = true;
    elements.finishPanel.hidden = false;
    elements.restartButton.focus({ preventScroll: true });
    burstConfetti(28);
  }

  function startRound() {
    state.deck = buildDeck();
    state.questionIndex = 0;
    state.attempts = 0;
    state.firstTryScore = 0;
    state.streak = 0;
    state.maxStreak = 0;
    state.locked = false;

    elements.bestScore.textContent = String(state.bestScore);
    elements.quizPanel.hidden = false;
    elements.finishPanel.hidden = true;
    renderQuestion();
  }

  function ensureAudioContext() {
    if (!state.audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        state.audioContext = new AudioContext();
      }
    }

    if (state.audioContext?.state === "suspended") {
      state.audioContext.resume().catch(() => {});
    }

    return state.audioContext;
  }

  function playNote(frequency, startDelay, duration, volume) {
    const context = ensureAudioContext();
    if (!context) {
      return;
    }

    const startAt = context.currentTime + startDelay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.03);
  }

  function playTone(kind) {
    if (!state.soundEnabled) {
      return;
    }

    if (kind === "correct") {
      playNote(523.25, 0, 0.16, 0.07);
      playNote(659.25, 0.12, 0.2, 0.06);
      return;
    }

    playNote(196, 0, 0.14, 0.045);
  }

  function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    elements.soundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
    elements.soundToggle.setAttribute(
      "aria-label",
      state.soundEnabled ? "効果音をオフにする" : "効果音をオンにする",
    );
    elements.soundLabel.textContent = state.soundEnabled ? "おと ON" : "おと OFF";

    if (state.soundEnabled) {
      ensureAudioContext();
      playNote(440, 0, 0.1, 0.04);
    }
  }

  function burstConfetti(amount = 16) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const colors = ["#f2bd4b", "#fff9ed", "#4c785c", "#d17956", "#7e3525"];

    for (let index = 0; index < amount; index += 1) {
      const piece = document.createElement("span");
      const angle = (Math.PI * 2 * index) / amount + (Math.random() - 0.5) * 0.45;
      const distance = 80 + Math.random() * 150;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;

      piece.className = "confetti-piece";
      piece.style.background = colors[index % colors.length];
      piece.style.setProperty("--confetti-x", `${x}px`);
      piece.style.setProperty("--confetti-y", `${y}px`);
      piece.style.setProperty("--confetti-r", `${Math.round(Math.random() * 540 - 270)}deg`);
      piece.style.animationDelay = `${Math.random() * 70}ms`;
      elements.confettiLayer.append(piece);
      window.setTimeout(() => piece.remove(), 900);
    }
  }

  elements.soundToggle.addEventListener("click", toggleSound);
  elements.restartButton.addEventListener("click", startRound);

  startRound();
})();
