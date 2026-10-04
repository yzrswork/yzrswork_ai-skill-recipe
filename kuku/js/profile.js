import { TITLE_BADGES } from './badges.js';
export function createProfileUI(save, persist, onModal = () => {}) {
  const state = { profile: save.profile, lastFocusedElement: null };
  const elements = {
    rankTitle: document.querySelector("#rank-title"),
    rankLevel: document.querySelector("#rank-level"),
    crystalTotal: document.querySelector("#crystal-total"),
    currentBadgeIcon: document.querySelector("#current-badge-icon"),
    badgeCount: document.querySelector("#badge-count"),
    badgeBookButton: document.querySelector("#badge-book-button"),
    rankProgress: document.querySelector("#rank-progress"),
    rankProgressFill: document.querySelector("#rank-progress-fill"),
    rankProgressLabel: document.querySelector("#rank-progress-label"),
    finishRankTitle: document.querySelector("#finish-rank-title"),
    finishRankLevel: document.querySelector("#finish-rank-level"),
    finishRankProgress: document.querySelector("#finish-rank-progress"),
    finishRankProgressFill: document.querySelector("#finish-rank-progress-fill"),
    finishRankProgressLabel: document.querySelector("#finish-rank-progress-label"),
    badgeBook: document.querySelector("#badge-book"),
    badgeBookBackdrop: document.querySelector("#badge-book-backdrop"),
    badgeBookClose: document.querySelector("#badge-book-close"),
    badgeBookGuide: document.querySelector("#badge-book-guide"),
    badgeBookCount: document.querySelector("#badge-book-count"),
    badgeNextMessage: document.querySelector("#badge-next-message"),
    badgeGrid: document.querySelector("#badge-grid"),
    mainBadgeCount: document.querySelector("#main-badge-count"),
    mainBadgeNext: document.querySelector("#main-badge-next"),
    mainBadgeGrid: document.querySelector("#main-badge-grid"),
    badgeUnlock: document.querySelector("#badge-unlock"),
  };

  function writeProgress() { persist(); }
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

  function renderBadgeBook() {
    const unlockedBadges = getUnlockedBadges();
    const selectedBadge = getSelectedBadge();
    const info = getRankProgress(state.profile.crystals);

    elements.badgeBookCount.textContent = String(unlockedBadges.length);
    elements.badgeNextMessage.textContent = info.next
      ? `つぎは「${info.next.title}」 あと ${info.remaining} ◇`
      : "20こ ぜんぶ あつまった！";
    if (elements.mainBadgeCount) elements.mainBadgeCount.textContent = String(unlockedBadges.length);
    if (elements.mainBadgeNext) elements.mainBadgeNext.textContent = info.next
      ? `つぎは「${info.next.title}」 あと ${info.remaining} ◇`
      : "20こ ぜんぶ あつまった！";
    const grids = [elements.badgeGrid, elements.mainBadgeGrid].filter(Boolean);
    for (const grid of grids) grid.replaceChildren();

    for (const badge of TITLE_BADGES) {
      const unlocked = badge.start <= state.profile.crystals;
      const selected = badge.id === selectedBadge.id;
      for (const grid of grids) {
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
        if (unlocked) card.addEventListener("click", () => selectBadge(badge.id));
        grid.append(card);
      }
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
    const activeGrid = elements.badgeBook.hidden ? elements.mainBadgeGrid : elements.badgeGrid;
    activeGrid?.querySelector(`[data-badge-id="${badge.id}"]`)?.focus({ preventScroll: true });
  }

  function setModalOpen(isOpen) {
    const hasOpenModal = isOpen || !elements.badgeBook.hidden || !elements.badgeUnlock.hidden;
    document.body.classList.toggle("is-modal-open", hasOpenModal);
  }

  function openBadgeBook() {
    if (!elements.badgeUnlock.hidden) {
      return;
    }

    // Safari touch clicks do not necessarily focus the opener.
    state.lastFocusedElement = elements.badgeBookButton;
    elements.badgeBookGuide.textContent = "あつめた バッジを おして、つけかえよう！";
    renderBadgeBook();
    onModal(true);
    elements.badgeBook.hidden = false;
    setModalOpen(true);
    elements.badgeBookClose.focus({ preventScroll: true });
  }

  function closeBadgeBook() {
    if (elements.badgeBook.hidden) {
      return;
    }

    elements.badgeBook.hidden = true;
    onModal(false);
    setModalOpen(false);

    if (state.lastFocusedElement?.focus) {
      state.lastFocusedElement.focus({ preventScroll: true });
    }
  }


  elements.badgeBookButton.addEventListener('click', openBadgeBook);
  elements.badgeBookBackdrop.addEventListener('click', closeBadgeBook);
  elements.badgeBookClose.addEventListener('click', closeBadgeBook);
  document.addEventListener('keydown', event => {
    if (elements.badgeBook.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeBadgeBook(); }
    if (event.key === 'Tab') {
      const buttons = [...elements.badgeBook.querySelectorAll('.badge-book-sheet button:not(:disabled)')];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  return { render: renderProfile, renderFinish: renderFinishProfile, renderBadges: renderBadgeBook };
}
