(() => {
  "use strict";

  const TOTAL_QUESTIONS = 10;
  const STORAGE_KEY = "yzrs-kuku-best-v1";
  const PROGRESS_STORAGE_KEY = "yzrs-kuku-progress-v1";
  const FACTOR_MIN = 2;
  const FACTOR_MAX = 9;
  const ANSWER_REVEAL_MS = 920;

  const TITLE_BADGES = [
    { id: "first-step", level: 1, title: "はじめの いっぽ", start: 0, symbol: "badge-sprout", tone: "#79a866", accent: "#31563f" },
    { id: "idea-rookie", level: 2, title: "ひらめき ルーキー", start: 6, symbol: "badge-spark", tone: "#f2bd4b", accent: "#a6482f" },
    { id: "answer-finder", level: 3, title: "こたえ みつけ", start: 14, symbol: "badge-key", tone: "#d17956", accent: "#7e3525" },
    { id: "crystal-picker", level: 4, title: "クリスタル ひろい", start: 24, symbol: "badge-crystal", tone: "#70a9b7", accent: "#315b68" },
    { id: "streak-star", level: 5, title: "れんぞく スター", start: 36, symbol: "badge-flame", tone: "#e8834f", accent: "#8b3129" },
    { id: "chest-finder", level: 6, title: "たからばこ はっけん", start: 50, symbol: "badge-chest", tone: "#e8a93b", accent: "#81511c" },
    { id: "tower-fighter", level: 7, title: "とうのぼり せんし", start: 66, symbol: "badge-tower", tone: "#c57858", accent: "#713425" },
    { id: "kuku-wizard", level: 8, title: "九九の まほうつかい", start: 84, symbol: "badge-wand", tone: "#8c78bd", accent: "#4d3b7b" },
    { id: "idea-knight", level: 9, title: "ひらめき ナイト", start: 105, symbol: "badge-shield", tone: "#6f9aa8", accent: "#315563" },
    { id: "terracotta-guard", level: 10, title: "テラコッタ ガード", start: 128, symbol: "badge-brick", tone: "#bc5b3d", accent: "#652d21" },
    { id: "multiply-ranger", level: 11, title: "かけざん レンジャー", start: 154, symbol: "badge-arrow", tone: "#5f9c72", accent: "#31563f" },
    { id: "crystal-master", level: 12, title: "クリスタル マスター", start: 182, symbol: "badge-gem", tone: "#5aa7b9", accent: "#245d70" },
    { id: "kuku-hero", level: 13, title: "九九の ゆうしゃ", start: 212, symbol: "badge-sword", tone: "#da6d4b", accent: "#713425" },
    { id: "tower-challenger", level: 14, title: "とうの しれんしゃ", start: 245, symbol: "badge-flag", tone: "#d99246", accent: "#78501f" },
    { id: "star-collector", level: 15, title: "ほしの コレクター", start: 280, symbol: "badge-stars", tone: "#e8b83e", accent: "#8e5a18" },
    { id: "kuku-expert", level: 16, title: "九九の たつじん", start: 318, symbol: "badge-scroll", tone: "#a77955", accent: "#5c3b27" },
    { id: "crown-hunter", level: 17, title: "おうかん ハンター", start: 358, symbol: "badge-crown", tone: "#e1aa2f", accent: "#81511c" },
    { id: "terracotta-hero", level: 18, title: "テラコッタ ヒーロー", start: 400, symbol: "badge-wings", tone: "#c76348", accent: "#652d21" },
    { id: "kuku-legend", level: 19, title: "九九の でんせつ", start: 445, symbol: "badge-comet", tone: "#8b76bd", accent: "#47356e" },
    { id: "tower-king", level: 20, title: "とうの おうさま", start: 500, symbol: "badge-castle", tone: "#d49a29", accent: "#6f4616" },
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
    currentBadgeIcon: document.querySelector("#current-badge-icon"),
    badgeCount: document.querySelector("#badge-count"),
    badgeBookButton: document.querySelector("#badge-book-button"),
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
    badgeBook: document.querySelector("#badge-book"),
    badgeBookBackdrop: document.querySelector("#badge-book-backdrop"),
    badgeBookClose: document.querySelector("#badge-book-close"),
    badgeBookGuide: document.querySelector("#badge-book-guide"),
    badgeBookCount: document.querySelector("#badge-book-count"),
    badgeNextMessage: document.querySelector("#badge-next-message"),
    badgeGrid: document.querySelector("#badge-grid"),
    badgeUnlock: document.querySelector("#badge-unlock"),
    badgeUnlockIcon: document.querySelector("#badge-unlock-icon"),
    badgeUnlockTitle: document.querySelector("#badge-unlock-title"),
    badgeUnlockClose: document.querySelector("#badge-unlock-close"),
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
    badgeUnlockTimer: null,
    pendingBadgeAdvance: false,
    lastFocusedElement: null,
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
      const selectedBadge = typeof saved?.selectedBadge === "string" ? saved.selectedBadge : "";
      return {
        crystals: Number.isFinite(crystals) ? Math.max(0, crystals) : 0,
        selectedBadge,
      };
    } catch (_error) {
      return { crystals: 0, selectedBadge: "" };
    }
  }

  function writeProgress() {
    try {
      window.localStorage.setItem(
        PROGRESS_STORAGE_KEY,
        JSON.stringify({
          crystals: state.profile.crystals,
          selectedBadge: state.profile.selectedBadge,
        }),
      );
    } catch (_error) {
      // 保存できない環境でも、現在のラウンドと画面表示は続けられる。
    }
  }

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function getBadgeById(badgeId) {
    return TITLE_BADGES.find((badge) => badge.id === badgeId) || null;
  }

  function getUnlockedBadges(crystals = state.profile.crystals) {
    const safeCrystals = Math.max(0, Math.floor(crystals));
    return TITLE_BADGES.filter((badge) => badge.start <= safeCrystals);
  }

  function getSelectedBadge() {
    const selected = getBadgeById(state.profile.selectedBadge);

    if (selected && selected.start <= state.profile.crystals) {
      return selected;
    }

    return getUnlockedBadges().at(-1) || TITLE_BADGES[0];
  }

  function createSvgElement(name, attributes = {}) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);

    for (const [attribute, value] of Object.entries(attributes)) {
      element.setAttribute(attribute, String(value));
    }

    return element;
  }

  function createBadgeGraphic(badge, locked = false) {
    const svg = createSvgElement("svg", {
      viewBox: "0 0 80 88",
      focusable: "false",
      "aria-hidden": "true",
    });
    svg.classList.add("title-badge-svg");
    svg.classList.toggle("is-locked", locked);
    svg.style.setProperty("--badge-tone", badge.tone);
    svg.style.setProperty("--badge-accent", badge.accent);
    svg.style.setProperty("--badge-disc", "#fff9ed");

    const leftRibbon = createSvgElement("path", {
      d: "M22 62 14 84 34 74Z",
      class: "badge-ribbon",
    });
    const rightRibbon = createSvgElement("path", {
      d: "M58 62 66 84 46 74Z",
      class: "badge-ribbon",
    });
    const rim = createSvgElement("circle", {
      cx: 40,
      cy: 38,
      r: 32,
      class: "badge-rim",
    });
    const disc = createSvgElement("circle", {
      cx: 40,
      cy: 38,
      r: 24,
      class: "badge-disc",
    });
    const use = createSvgElement("use", {
      href: `#${badge.symbol}`,
      x: 18,
      y: 16,
      width: 44,
      height: 44,
      class: "badge-glyph",
    });

    svg.append(leftRibbon, rightRibbon, rim, disc, use);
    return svg;
  }

  function getRankProgress(crystals) {
    const safeCrystals = Math.max(0, Math.floor(crystals));
    let current = TITLE_BADGES[0];
    let next = TITLE_BADGES[1];

    for (let index = 1; index < TITLE_BADGES.length; index += 1) {
      if (safeCrystals < TITLE_BADGES[index].start) {
        next = TITLE_BADGES[index];
        break;
      }

      current = TITLE_BADGES[index];
      next = TITLE_BADGES[index + 1] || null;
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
    label.textContent = info.next ? `あと ${info.remaining} ◇` : "ぜんぶ GET！";
  }

  function renderProfile() {
    const info = getRankProgress(state.profile.crystals);
    const selectedBadge = getSelectedBadge();
    const unlockedCount = getUnlockedBadges().length;

    state.profile.selectedBadge = selectedBadge.id;
    elements.rankTitle.textContent = selectedBadge.title;
    elements.rankLevel.textContent = String(info.current.level);
    elements.crystalTotal.textContent = String(state.profile.crystals);
    elements.badgeCount.textContent = `${unlockedCount} / ${TITLE_BADGES.length}`;
    elements.currentBadgeIcon.replaceChildren(createBadgeGraphic(selectedBadge));
    renderRankProgress(
      elements.rankProgress,
      elements.rankProgressFill,
      elements.rankProgressLabel,
      info,
    );
  }

  function renderFinishProfile() {
    const info = getRankProgress(state.profile.crystals);
    const selectedBadge = getSelectedBadge();

    elements.finishRankTitle.textContent = selectedBadge.title;
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
    const before = state.profile.crystals;

    state.profile.crystals += safeAmount;
    const newlyUnlocked = TITLE_BADGES.filter(
      (badge) => badge.start > before && badge.start <= state.profile.crystals,
    ).at(-1) || null;

    if (newlyUnlocked) {
      state.profile.selectedBadge = newlyUnlocked.id;
    }

    writeProgress();
    renderProfile();
    return newlyUnlocked;
  }

  function renderBadgeBook() {
    const unlockedBadges = getUnlockedBadges();
    const selectedBadge = getSelectedBadge();
    const info = getRankProgress(state.profile.crystals);

    elements.badgeBookCount.textContent = String(unlockedBadges.length);
    elements.badgeNextMessage.textContent = info.next
      ? `つぎは「${info.next.title}」 あと ${info.remaining} ◇`
      : "20こ ぜんぶ あつまった！";
    elements.badgeGrid.replaceChildren();

    for (const badge of TITLE_BADGES) {
      const unlocked = badge.start <= state.profile.crystals;
      const selected = badge.id === selectedBadge.id;
      const card = document.createElement("button");
      const graphic = document.createElement("span");
      const title = document.createElement("strong");
      const condition = document.createElement("span");

      card.className = "badge-card";
      card.type = "button";
      card.classList.toggle("is-locked", !unlocked);
      card.classList.toggle("is-selected", selected);
      card.disabled = !unlocked;
      card.dataset.badgeId = badge.id;
      card.setAttribute(
        "aria-label",
        unlocked
          ? `${badge.title}${selected ? "、いま つけている バッジ" : "を つける"}`
          : `${badge.title}、${badge.start}クリスタルで ひらく`,
      );

      graphic.className = "badge-card-graphic";
      graphic.append(createBadgeGraphic(badge, !unlocked));
      title.className = "badge-card-title";
      title.textContent = badge.title;
      condition.className = "badge-card-condition";
      condition.textContent = selected
        ? "つけてる！"
        : unlocked
          ? "つける"
          : `${badge.start} ◇`;

      card.append(graphic, title, condition);
      if (unlocked) {
        card.addEventListener("click", () => selectBadge(badge.id));
      }
      elements.badgeGrid.append(card);
    }
  }

  function selectBadge(badgeId) {
    const badge = getBadgeById(badgeId);

    if (!badge || badge.start > state.profile.crystals) {
      return;
    }

    state.profile.selectedBadge = badge.id;
    writeProgress();
    renderProfile();
    renderFinishProfile();
    elements.badgeBookGuide.textContent = `「${badge.title}」を つけたよ！`;
    renderBadgeBook();
  }

  function setModalOpen(isOpen) {
    const hasOpenModal = isOpen || !elements.badgeBook.hidden || !elements.badgeUnlock.hidden;
    document.body.classList.toggle("is-modal-open", hasOpenModal);
  }

  function openBadgeBook() {
    if (!elements.badgeUnlock.hidden || (state.locked && !elements.quizPanel.hidden)) {
      return;
    }

    state.lastFocusedElement = document.activeElement;
    elements.badgeBookGuide.textContent = "あつめた バッジを おして、つけかえよう！";
    renderBadgeBook();
    elements.badgeBook.hidden = false;
    setModalOpen(true);
    elements.badgeBookClose.focus({ preventScroll: true });
  }

  function closeBadgeBook() {
    if (elements.badgeBook.hidden) {
      return;
    }

    elements.badgeBook.hidden = true;
    setModalOpen(false);

    if (state.lastFocusedElement?.focus) {
      state.lastFocusedElement.focus({ preventScroll: true });
    }
  }

  function showBadgeUnlock(badge) {
    state.lastFocusedElement = document.activeElement;
    elements.badgeUnlockTitle.textContent = badge.title;
    elements.badgeUnlockIcon.replaceChildren(createBadgeGraphic(badge));
    elements.badgeUnlock.hidden = false;
    setModalOpen(true);
    elements.badgeUnlockClose.focus({ preventScroll: true });
    burstConfetti(34);
    playTone("badge");

    if (state.badgeUnlockTimer) {
      window.clearTimeout(state.badgeUnlockTimer);
    }

    state.badgeUnlockTimer = window.setTimeout(() => closeBadgeUnlock(true), 2100);
  }

  function closeBadgeUnlock(shouldAdvance = true) {
    if (state.badgeUnlockTimer) {
      window.clearTimeout(state.badgeUnlockTimer);
      state.badgeUnlockTimer = null;
    }

    elements.badgeUnlock.hidden = true;
    setModalOpen(false);
    hideReward();

    if (shouldAdvance && state.pendingBadgeAdvance) {
      state.pendingBadgeAdvance = false;
      goToNextQuestion();
    }
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
    const unlockedBadge = addCrystals(crystals);
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

    if (unlockedBadge) {
      state.pendingBadgeAdvance = true;
      elements.rewardMilestone.textContent = milestone
        ? `${milestone.label}ボーナス +${milestone.crystals} ・ NEWバッジ！`
        : "NEWバッジ かいほう！";
      state.advanceTimer = window.setTimeout(() => {
        state.advanceTimer = null;
        showBadgeUnlock(unlockedBadge);
      }, 520);
    } else {
      state.advanceTimer = window.setTimeout(() => {
        state.advanceTimer = null;
        goToNextQuestion();
      }, ANSWER_REVEAL_MS);
    }
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
        message: rankUp ? "バッジが ふえた！ ぜんもん いっぱつせいかい。" : "ぜんもん いっぱつせいかい。すごい！",
      };
    }

    if (score >= 8) {
      return {
        title: "だいせいこう！",
        message: rankUp ? "バッジが ふえた！ 九九の力が ぐんぐん のびてる！" : "九九の力が ぐんぐん のびてる！",
      };
    }

    if (score >= 5) {
      return {
        title: "いいちょうし！",
        message: rankUp ? "バッジが ふえた！ できる もんだいが ふえてきた！" : "できる もんだいが ふえてきた！",
      };
    }

    return {
      title: "10もん できた！",
      message: rankUp ? "バッジが ふえた！ さいごまで ちょうせんできたね！" : "さいごまで ちょうせんできたね！",
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

    closeBadgeUnlock(false);
    elements.badgeBook.hidden = true;
    state.pendingBadgeAdvance = false;
    setModalOpen(false);
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

    if (kind === "badge") {
      playNote(523.25, 0, 0.18, 0.055);
      playNote(659.25, 0.11, 0.2, 0.055);
      playNote(783.99, 0.22, 0.22, 0.06);
      playNote(1046.5, 0.35, 0.32, 0.06);
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
  elements.badgeBookButton.addEventListener("click", openBadgeBook);
  elements.badgeBookBackdrop.addEventListener("click", closeBadgeBook);
  elements.badgeBookClose.addEventListener("click", closeBadgeBook);
  elements.badgeUnlockClose.addEventListener("click", () => closeBadgeUnlock(true));
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (!elements.badgeBook.hidden) {
      closeBadgeBook();
    }
  });

  renderProfile();
  startRound();
})();
