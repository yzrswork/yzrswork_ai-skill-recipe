(() => {
  "use strict";

  const TOTAL_QUESTIONS = 10;
  const STORAGE_KEY = "yzrs-kuku-best-v1";
  const PROGRESS_STORAGE_KEY = "yzrs-kuku-progress-v1";
  const FACTOR_MIN = 2;
  const FACTOR_MAX = 9;
  const ANSWER_REVEAL_MS = 920;

  const RANKS = [
    { level: 1, title: "塔のぼり見習い", start: 0 },
    { level: 2, title: "石だんランナー", start: 10 },
    { level: 3, title: "九九の探検家", start: 25 },
    { level: 4, title: "テラコッタ騎士", start: 45 },
    { level: 5, title: "塔の守り人", start: 70 },
    { level: 6, title: "九九の王さま", start: 100 },
  ];

  const MILESTONE_REWARDS = {
    5: { label: "宝箱", crystals: 3 },
    10: { label: "王冠", crystals: 5 },
  };

  const elements = {
    quizPanel: document.querySelector("#quiz-panel"),
    finishPanel: document.querySelector("#finish-panel"),
    questionCount: document.querySelector("#question-count"),
    bestScore: document.querySelector("#best-score"),
    score: document.querySelector("#score"),
    progress: document.querySelector("#progress"),
    progressFill: document.querySelector("#progress-fill"),
    towerPath: document.querySelector("#tower-path"),
    streakChip: document.querySelector("#streak-chip"),
    factorA: document.querySelector("#factor-a"),
    factorB: document.querySelector("#factor-b"),
    problemArea: document.querySelector(".problem-area"),
    feedback: document.querySelector("#feedback"),
    answers: document.querySelector("#answers"),
    rewardBanner: document.querySelector("#reward-banner"),
    rewardKicker: document.querySelector("#reward-kicker"),
    rewardCopy: document.querySelector("#reward-copy"),
    rewardCrystals: document.querySelector("#reward-crystals"),
    rewardMilestone: document.querySelector("#reward-milestone"),
    soundToggle: document.querySelector("#sound-toggle"),
    soundLabel: document.querySelector("#sound-label"),
    rankTitle: document.querySelector("#rank-title"),
    rankLevel: document.querySelector("#rank-level"),
    crystalTotal: document.querySelector("#crystal-total"),
    rankProgress: document.querySelector("#rank-progress"),
    rankProgressFill: document.querySelector("#rank-progress-fill"),
    rankProgressLabel: document.querySelector("#rank-progress-label"),
    finishTitle: document.querySelector("#finish-title"),
    finishMessage: document.querySelector("#finish-message"),
    finishMedal: document.querySelector("#finish-medal"),
    finishStars: document.querySelectorAll(".finish-star"),
    finalScore: document.querySelector("#final-score"),
    finalStreak: document.querySelector("#final-streak"),
    finalCrystals: document.querySelector("#final-crystals"),
    finalTotalCrystals: document.querySelector("#final-total-crystals"),
    finishRankTitle: document.querySelector("#finish-rank-title"),
    finishRankLevel: document.querySelector("#finish-rank-level"),
    finishRankProgress: document.querySelector("#finish-rank-progress"),
    finishRankProgressFill: document.querySelector("#finish-rank-progress-fill"),
    finishRankProgressLabel: document.querySelector("#finish-rank-progress-label"),
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
    roundCrystals: 0,
    roundStartCrystals: 0,
    locked: false,
    soundEnabled: false,
    audioContext: null,
    advanceTimer: null,
    rewardTimer: null,
    bestScore: readBestScore(),
    profile: readProgress(),
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

  function readProgress() {
    try {
      const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      const crystals = Number.parseInt(saved?.crystals, 10);
      return {
        crystals: Number.isFinite(crystals) ? Math.max(0, crystals) : 0,
      };
    } catch (_error) {
      return { crystals: 0 };
    }
  }

  function writeProgress() {
    try {
      window.localStorage.setItem(
        PROGRESS_STORAGE_KEY,
        JSON.stringify({ crystals: state.profile.crystals }),
      );
    } catch (_error) {
      // 保存できない環境でも、現在のラウンドと画面表示は続けられる。
    }
  }

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function getRankProgress(crystals) {
    const safeCrystals = Math.max(0, Math.floor(crystals));
    let current = RANKS[0];
    let next = RANKS[1];

    for (let index = 1; index < RANKS.length; index += 1) {
      if (safeCrystals < RANKS[index].start) {
        next = RANKS[index];
        break;
      }

      current = RANKS[index];
      next = RANKS[index + 1] || null;
    }

    const span = next ? next.start - current.start : 1;
    const withinRank = next ? safeCrystals - current.start : 1;
    const percentage = next ? clamp((withinRank / span) * 100, 0, 100) : 100;

    return {
      current,
      next,
      span,
      withinRank,
      percentage,
      remaining: next ? Math.max(0, next.start - safeCrystals) : 0,
    };
  }

  function renderRankProgress(progressBar, fill, label, info) {
    if (!progressBar || !fill || !label) {
      return;
    }

    fill.style.width = `${info.percentage}%`;
    progressBar.setAttribute("aria-valuemax", String(info.span));
    progressBar.setAttribute("aria-valuenow", String(info.withinRank));
    label.textContent = info.next ? `つぎまで ${info.remaining}` : "さいこうランク！";
  }

  function renderProfile() {
    const info = getRankProgress(state.profile.crystals);

    elements.rankTitle.textContent = info.current.title;
    elements.rankLevel.textContent = String(info.current.level);
    elements.crystalTotal.textContent = String(state.profile.crystals);
    renderRankProgress(
      elements.rankProgress,
      elements.rankProgressFill,
      elements.rankProgressLabel,
      info,
    );
  }

  function renderFinishProfile() {
    const info = getRankProgress(state.profile.crystals);

    elements.finishRankTitle.textContent = info.current.title;
    elements.finishRankLevel.textContent = String(info.current.level);
    renderRankProgress(
      elements.finishRankProgress,
      elements.finishRankProgressFill,
      elements.finishRankProgressLabel,
      info,
    );
  }

  function addCrystals(amount) {
    const safeAmount = Math.max(0, Math.floor(amount));

    state.profile.crystals += safeAmount;
    writeProgress();
    renderProfile();
  }

  function setProgress(completed) {
    const safeCompleted = clamp(completed, 0, TOTAL_QUESTIONS);
    const percentage = (safeCompleted / TOTAL_QUESTIONS) * 100;
    elements.progressFill.style.width = `${percentage}%`;
    elements.progress.setAttribute("aria-valuenow", String(safeCompleted));
  }

  function updateTowerPath(completed) {
    const safeCompleted = clamp(completed, 0, TOTAL_QUESTIONS);
    const currentStep = safeCompleted < TOTAL_QUESTIONS ? safeCompleted + 1 : 0;

    for (const node of elements.towerPath.querySelectorAll(".tower-node")) {
      const step = Number.parseInt(node.dataset.step || "0", 10);
      const isComplete = step > 0 && step <= safeCompleted;
      const isCurrent = step === currentStep;

      node.classList.toggle("is-complete", isComplete);
      node.classList.toggle("is-current", isCurrent);
      node.setAttribute(
        "aria-label",
        `${step}もんめ${isComplete ? " クリア" : isCurrent ? " いまここ" : " これから"}`,
      );

      if (isCurrent) {
        node.setAttribute("aria-current", "step");
      } else {
        node.removeAttribute("aria-current");
      }
    }
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

  function getFirstTryCopy(streak) {
    if (streak >= 5) {
      return { kicker: "TOWER GLOW", copy: `${streak}もん れんぞく！` };
    }

    if (streak >= 3) {
      return { kicker: "GREAT STREAK", copy: `${streak}もん れんぞく せいかい！` };
    }

    if (streak === 2) {
      return { kicker: "NICE FLOW", copy: "2もん れんぞく！" };
    }

    return { kicker: "PERFECT", copy: "せいかい！" };
  }

  function hideReward() {
    if (state.rewardTimer) {
      window.clearTimeout(state.rewardTimer);
      state.rewardTimer = null;
    }

    elements.rewardBanner.classList.remove("is-visible");
    elements.rewardBanner.hidden = true;
  }

  function showReward(firstTry, crystals, milestone) {
    const copy = firstTry
      ? getFirstTryCopy(state.streak)
      : { kicker: "NICE RECOVER", copy: "ナイスリカバー！" };

    elements.rewardKicker.textContent = copy.kicker;
    elements.rewardCopy.textContent = copy.copy;
    elements.rewardCrystals.textContent = `+${crystals} クリスタル`;
    elements.rewardMilestone.textContent = milestone
      ? `${milestone.label}ボーナス +${milestone.crystals}`
      : "";
    elements.rewardBanner.hidden = false;
    elements.rewardBanner.classList.remove("is-visible");
    void elements.rewardBanner.offsetWidth;
    elements.rewardBanner.classList.add("is-visible");

    if (state.rewardTimer) {
      window.clearTimeout(state.rewardTimer);
    }

    state.rewardTimer = window.setTimeout(() => {
      elements.rewardBanner.classList.remove("is-visible");
      elements.rewardBanner.hidden = true;
      state.rewardTimer = null;
    }, ANSWER_REVEAL_MS);
  }

  function triggerCorrectImpact() {
    elements.quizPanel.classList.remove("is-correct-impact");
    elements.problemArea.classList.remove("is-correct-impact");
    void elements.quizPanel.offsetWidth;
    elements.quizPanel.classList.add("is-correct-impact");
    elements.problemArea.classList.add("is-correct-impact");

    window.setTimeout(() => {
      elements.quizPanel.classList.remove("is-correct-impact");
      elements.problemArea.classList.remove("is-correct-impact");
    }, ANSWER_REVEAL_MS);
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
    updateTowerPath(state.questionIndex);
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

    const firstTry = state.attempts === 1;
    const questionNumber = state.questionIndex + 1;
    const milestone = MILESTONE_REWARDS[questionNumber] || null;
    const crystals = (firstTry ? 2 : 1) + (milestone?.crystals || 0);

    state.locked = true;
    button.classList.add("is-correct");

    for (const answerButton of elements.answers.querySelectorAll("button")) {
      answerButton.disabled = true;
    }

    if (firstTry) {
      state.firstTryScore += 1;
      state.streak += 1;
      state.maxStreak = Math.max(state.maxStreak, state.streak);
      setFeedback(
        state.streak >= 3 ? `${state.streak}もん れんぞく せいかい！` : "せいかい！",
        "correct",
      );
    } else {
      setFeedback("せいかい！ できたね！", "correct");
    }

    state.roundCrystals += crystals;
    addCrystals(crystals);
    elements.score.textContent = String(state.firstTryScore);
    setProgress(questionNumber);
    updateTowerPath(questionNumber);
    updateStreak();
    showReward(firstTry, crystals, milestone);
    triggerCorrectImpact();
    playTone("correct", firstTry);
    burstConfetti(firstTry ? 24 : 18);

    if (state.advanceTimer) {
      window.clearTimeout(state.advanceTimer);
    }

    state.advanceTimer = window.setTimeout(() => {
      state.advanceTimer = null;
      goToNextQuestion();
    }, ANSWER_REVEAL_MS);
  }

  function goToNextQuestion() {
    state.questionIndex += 1;

    if (state.questionIndex >= TOTAL_QUESTIONS) {
      showFinish();
      return;
    }

    renderQuestion();
  }

  function getResultCopy(score, rankUp) {
    if (score === TOTAL_QUESTIONS) {
      return {
        title: "九九の塔を制覇！",
        message: rankUp ? "ランクアップ！ ぜんもん いっぱつせいかい。" : "ぜんもん いっぱつせいかい。すごい！",
      };
    }

    if (score >= 8) {
      return {
        title: "だいせいこう！",
        message: rankUp ? "ランクアップ！ 九九の力が ぐんぐん のびてる！" : "九九の力が ぐんぐん のびてる！",
      };
    }

    if (score >= 5) {
      return {
        title: "いいちょうし！",
        message: rankUp ? "ランクアップ！ できる もんだいが ふえてきた！" : "できる もんだいが ふえてきた！",
      };
    }

    return {
      title: "10もん できた！",
      message: rankUp ? "ランクアップ！ さいごまで ちょうせんできたね！" : "さいごまで ちょうせんできたね！",
    };
  }

  function renderStars(score) {
    const starCount = score >= 8 ? 3 : score >= 5 ? 2 : 1;

    elements.finishStars.forEach((star, index) => {
      star.classList.toggle("is-filled", index < starCount);
    });
    elements.finishMedal.setAttribute("aria-label", `${starCount}つ星のクリアメダル`);
  }

  function showFinish() {
    const previousBest = state.bestScore;
    const previousRank = getRankProgress(state.roundStartCrystals).current;
    const currentRank = getRankProgress(state.profile.crystals).current;
    const result = getResultCopy(state.firstTryScore, currentRank.level > previousRank.level);

    state.bestScore = Math.max(state.bestScore, state.firstTryScore);
    writeBestScore(state.bestScore);

    elements.finishTitle.textContent = result.title;
    elements.finishMessage.textContent = result.message;
    elements.finalScore.textContent = String(state.firstTryScore);
    elements.finalStreak.textContent = String(state.maxStreak);
    elements.finalCrystals.textContent = String(state.roundCrystals);
    elements.finalTotalCrystals.textContent = String(state.profile.crystals);
    elements.bestScore.textContent = String(state.bestScore);
    renderStars(state.firstTryScore);
    renderFinishProfile();

    if (state.firstTryScore > previousBest) {
      elements.bestMessage.textContent = "じこベスト こうしん！";
    } else if (state.firstTryScore === previousBest && state.firstTryScore > 0) {
      elements.bestMessage.textContent = "じこベストと おなじ！";
    } else {
      elements.bestMessage.textContent = `じこベストは ${state.bestScore}もん！`;
    }

    hideReward();
    updateTowerPath(TOTAL_QUESTIONS);
    elements.quizPanel.hidden = true;
    elements.finishPanel.hidden = false;
    elements.restartButton.focus({ preventScroll: true });
    burstConfetti(34);
  }

  function startRound() {
    if (state.advanceTimer) {
      window.clearTimeout(state.advanceTimer);
      state.advanceTimer = null;
    }

    hideReward();
    elements.confettiLayer.replaceChildren();
    state.deck = buildDeck();
    state.questionIndex = 0;
    state.attempts = 0;
    state.firstTryScore = 0;
    state.streak = 0;
    state.maxStreak = 0;
    state.roundCrystals = 0;
    state.roundStartCrystals = state.profile.crystals;
    state.locked = false;

    elements.bestScore.textContent = String(state.bestScore);
    elements.quizPanel.hidden = false;
    elements.finishPanel.hidden = true;
    renderProfile();
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

  function playTone(kind, firstTry = false) {
    if (!state.soundEnabled) {
      return;
    }

    if (kind === "correct") {
      playNote(523.25, 0, 0.17, 0.065);
      playNote(659.25, 0.1, 0.2, 0.06);
      playNote(firstTry ? 783.99 : 698.46, 0.21, firstTry ? 0.26 : 0.2, firstTry ? 0.065 : 0.05);
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

  function prefersReducedMotion() {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  }

  function burstConfetti(amount = 20) {
    if (prefersReducedMotion()) {
      return;
    }

    const colors = ["#f2bd4b", "#fff9ed", "#4c785c", "#d17956", "#7e3525"];
    const safeAmount = clamp(amount, 0, 34);

    for (let index = 0; index < safeAmount; index += 1) {
      const piece = document.createElement("span");
      const angle = (Math.PI * 2 * index) / safeAmount + (Math.random() - 0.5) * 0.45;
      const distance = 78 + Math.random() * 112;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;

      piece.className = "confetti-piece";
      if (index % 3 === 0) {
        piece.classList.add("is-round");
      }
      piece.style.background = colors[index % colors.length];
      piece.style.setProperty("--confetti-x", `${x}px`);
      piece.style.setProperty("--confetti-y", `${y}px`);
      piece.style.setProperty("--confetti-r", `${Math.round(Math.random() * 540 - 270)}deg`);
      piece.style.setProperty("--confetti-scale", `${0.75 + Math.random() * 0.55}`);
      piece.style.animationDelay = `${Math.random() * 70}ms`;
      elements.confettiLayer.append(piece);
      window.setTimeout(() => piece.remove(), 900);
    }
  }

  elements.soundToggle.addEventListener("click", toggleSound);
  elements.restartButton.addEventListener("click", startRound);

  renderProfile();
  startRound();
})();
