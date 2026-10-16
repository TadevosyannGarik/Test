const Simulate = (() => {
    let workId = null;
    let currentWork = null;
    let baseCache = null;
    let baseRealInputs = null; // реальные данные работы (с null для orig/supScore/gost)

    const escapeHtml = Utils.escapeHtml;
    const emptyState = Utils.emptyState;

    const SLIDER_ICONS = {
        s_progress: SVG.trending,
        s_days: SVG.calendar,
        s_activity: SVG.activity,
        s_edits: SVG.edit,
        s_volume: SVG.book,
        s_orig: SVG.search,
        s_supScore: SVG.graduation,
        s_gost: SVG.fileText,
    };

    const SLIDER_LABELS = {
        s_progress: "Прогресс",
        s_days: "Дней до дедлайна",
        s_activity: "Активность",
        s_edits: "Число правок",
        s_volume: "Объём",
        s_orig: "Оригинальность",
        s_supScore: "Оценка руководителя",
        s_gost: "Соответствие ГОСТу",
    };

    const DEFAULTS = {
        orig: 65,
        supScore: 5,
        gost: 70,
    };

    function getUser() {
        return Auth.getUser();
    }

    function getAvailableWorks(user) {
        if (!user) return [];
        if (user.role === "student") return Storage.getWorksByStudent(user.id);
        if (user.role === "teacher") return Storage.getWorksByTeacher(user.id);
        return Storage.getWorks();
    }

    function getRealInputs(work) {
        if (!work) return null;
        const inputs = Utils.buildFuzzyInputs(work);
        if (!inputs) return null;
        return inputs; // с null для orig/supScore/gost
    }

    function getBaseInputs(work) {
        const real = getRealInputs(work);
        if (!real) return null;
        return {
            progress: real.progress ?? 0,
            days: real.days ?? 30,
            activity: real.activity ?? 5,
            edits: real.edits ?? 0,
            volume: real.volume ?? 0,
            orig: real.orig ?? DEFAULTS.orig,
            supScore: real.supScore ?? DEFAULTS.supScore,
            gost: real.gost ?? DEFAULTS.gost,
        };
    }

    function render(params) {
        const user = getUser();
        if (!user) return emptyState("Не авторизован", "", SVG.lock);

        const works = getAvailableWorks(user);
        if (works.length === 0) {
            return emptyState(
                "Нет работы",
                user.role === "student"
                    ? "Создайте работу, чтобы запустить симулятор."
                    : "Пока нет работ, по которым можно провести симуляцию.",
                SVG.folder,
            );
        }

        if (params?.workId) workId = params.workId;
        if (!workId || !works.find((w) => Storage.sameId(w.id, workId))) {
            workId = works[0].id;
        }

        currentWork = Storage.getWorkById(workId);
        if (!currentWork)
            return emptyState("Работа не найдена", "", SVG.folder);

        const base = getBaseInputs(currentWork);
        if (!base)
            return emptyState(
                "Не удалось собрать данные",
                "",
                SVG.alertTriangle,
            );

        baseCache = { ...base };
        baseRealInputs = getRealInputs(currentWork);
        const baseResult = Utils.safeFuzzyInfer(base);
        const currentResult = baseResult;

        return `
      <div class="sim-hero">
        <div class="sim-hero-icon">${SVG.sliders({ cls: "icon icon-xl" })}</div>
        <div class="sim-hero-body">
          <div class="sim-hero-title">Симулятор «Что если»</div>
          <div class="sim-hero-text">
            Данные взяты из вашей работы. Двигайте ползунки —
            результат <b>пересчитывается мгновенно</b>. Так можно
            понять, что будет, если вы ускоритесь или пропустите неделю.
          </div>
        </div>
      </div>

      <div class="sim-work">
        <div class="sim-work-info">
          <div class="sim-work-label">Работа</div>
          <div class="sim-work-topic">${escapeHtml(currentWork.topic)}</div>
        </div>
        <select onchange="Simulate.selectWork(this.value)" class="sim-select">
          ${works
              .map(
                  (w) => `
            <option value="${w.id}" ${Storage.sameId(w.id, workId) ? "selected" : ""}>
              ${escapeHtml(w.topic.slice(0, 60))}${w.topic.length > 60 ? "…" : ""}
            </option>
          `,
              )
              .join("")}
        </select>
      </div>

      ${renderWorkDataBlock()}
      ${renderScenarios()}

      <div class="sim-grid">
        <div class="sim-controls">
          <div class="sim-controls-title">
            ${SVG.sliders({ cls: "icon icon-sm" })}
            Что изменить
          </div>
          ${slider("s_progress", 0, 100, base.progress, "%")}
          ${slider("s_days", 0, 60, base.days, "")}
          ${slider("s_activity", 0, 10, base.activity, "")}
          ${slider("s_edits", 0, 20, base.edits, "")}
          ${slider("s_volume", 0, 100, base.volume, "%")}
          ${slider("s_orig", 0, 100, base.orig, "%")}
          ${slider("s_supScore", 0, 10, base.supScore, "")}
          ${slider("s_gost", 0, 100, base.gost, "%")}

          <button class="btn-ghost sim-reset" onclick="Simulate.reset()">
            ${SVG.refresh({ cls: "icon icon-sm" })}
            <span>Сбросить к данным работы</span>
          </button>
        </div>

        <div class="sim-result-panel">
          <div class="sim-result-title">
            ${SVG.target({ cls: "icon icon-sm" })}
            Результат
          </div>
          <div id="simResult">
            ${renderResult(base, baseResult, currentResult)}
          </div>
        </div>
      </div>
    `;
    }

    /* =========================================================
       БЛОК «ДАННЫЕ ИЗ РАБОТЫ»
       ========================================================= */
    function renderWorkDataBlock() {
        if (!baseRealInputs) return "";

        const real = baseRealInputs;

        const item = (lbl, val, unit) => {
            const isEmpty = val === null || val === undefined;
            return `
        <div class="swd-item ${isEmpty ? "empty" : ""}">
          <div class="swd-lbl">${escapeHtml(lbl)}</div>
          <div class="swd-val">
            ${isEmpty ? "—" : `${val}${unit || ""}`}
          </div>
        </div>
      `;
        };

        const hasEmpty = ["orig", "supScore", "gost"].some(
            (k) => real[k] === null || real[k] === undefined,
        );

        return `
      <div class="card sim-work-data">
        <div class="sim-work-data-head">
          <span class="sim-work-data-icon">
            ${SVG.folder({ cls: "icon icon-sm" })}
          </span>
          <span>Данные из вашей работы</span>
        </div>
        <div class="sim-work-data-grid">
          ${item("Прогресс", real.progress, "%")}
          ${item("Дней до дедлайна", real.days)}
          ${item("Активность", real.activity)}
          ${item("Правок", real.edits)}
          ${item("Объём", real.volume, "%")}
          ${item("Оригинальность", real.orig, "%")}
          ${item("Оценка рук.", real.supScore)}
          ${item("ГОСТ", real.gost, "%")}
        </div>
        ${
            hasEmpty
                ? `
          <div class="sim-work-data-note">
            ${SVG.info({ cls: "icon icon-xs" })}
            Прочерк — руководитель ещё не проверял этот показатель.
            Для симуляции подставлено среднее значение.
          </div>
        `
                : ""
        }
      </div>
    `;
    }

    /* =========================================================
       СЦЕНАРИИ
       ========================================================= */
    function renderScenarios() {
        return `
      <div class="sim-scenarios">
        <div class="sim-scenarios-label">
          ${SVG.zap({ cls: "icon icon-sm" })}
          Быстрые сценарии
        </div>
        <div class="sim-scenarios-grid">
          <button class="sim-scenario" onclick="Simulate.applyScenario('faster')">
            <div class="sim-scenario-icon">${SVG.trending({ cls: "icon" })}</div>
            <div class="sim-scenario-body">
              <div class="sim-scenario-title">Студент ускорится</div>
              <div class="sim-scenario-desc">Прогресс +20%, активность +3</div>
            </div>
          </button>
          <button class="sim-scenario" onclick="Simulate.applyScenario('miss')">
            <div class="sim-scenario-icon">${SVG.clock({ cls: "icon" })}</div>
            <div class="sim-scenario-body">
              <div class="sim-scenario-title">Пропустит неделю</div>
              <div class="sim-scenario-desc">Дней −7, активность −2</div>
            </div>
          </button>
          <button class="sim-scenario" onclick="Simulate.applyScenario('better')">
            <div class="sim-scenario-icon">${SVG.star({ cls: "icon" })}</div>
            <div class="sim-scenario-body">
              <div class="sim-scenario-title">Лучше оформит</div>
              <div class="sim-scenario-desc">ГОСТ +20%, оригинальность +10%</div>
            </div>
          </button>
        </div>
      </div>
    `;
    }

    /* =========================================================
       СЛАЙДЕР
       ========================================================= */
    function slider(id, min, max, val, unit) {
        const IconFn = SLIDER_ICONS[id];
        const label = SLIDER_LABELS[id];
        const key = id.replace("s_", "");
        const realVal = baseRealInputs ? baseRealInputs[key] : null;
        const isEmptyReal = realVal === null || realVal === undefined;
        const isChanged = !isEmptyReal && val !== realVal;

        const realHint = isEmptyReal
            ? `<span class="sim-slider-real empty">нет данных</span>`
            : isChanged
              ? `<span class="sim-slider-real">из работы: ${realVal}${unit}</span>`
              : "";

        return `
      <div class="sim-slider ${isChanged ? "changed" : ""} ${isEmptyReal ? "no-real" : ""}">
        <div class="sim-slider-head">
          <span class="sim-slider-label">
            ${IconFn ? IconFn({ cls: "icon icon-sm" }) : ""}
            ${escapeHtml(label)}
          </span>
          <span class="sim-slider-val" id="v_${id}">${val}${unit}</span>
        </div>
        <input type="range" id="${id}" min="${min}" max="${max}" value="${val}"
          oninput="Simulate.onChange()">
        ${realHint ? `<div class="sim-slider-foot">${realHint}</div>` : ""}
      </div>
    `;
    }

    /* =========================================================
       РЕЗУЛЬТАТ
       ========================================================= */
    function renderResult(inputs, baseResult, result) {
        if (!baseResult || !result) return "";

        const riskDiff = result.risk.value - baseResult.risk.value;
        const readyDiff = result.ready.value - baseResult.ready.value;
        const ratingDiff = result.rating.value - baseResult.rating.value;

        return `
      <div class="sim-metrics">
        ${renderMetricCard("Риск", result.risk, riskDiff, false)}
        ${renderMetricCard("Готовность", result.ready, readyDiff, true)}
        ${renderMetricCard("Рейтинг", result.rating, ratingDiff, true)}
      </div>

      <div class="sim-compare">
        <div class="sim-compare-title">
          ${SVG.barChart({ cls: "icon icon-sm" })}
          Сравнение: сейчас / в симуляции
        </div>
        ${diffRow("Риск", baseResult.risk.value, result.risk.value, riskDiff, false)}
        ${diffRow("Готовность", baseResult.ready.value, result.ready.value, readyDiff, true)}
        ${diffRow("Рейтинг", baseResult.rating.value, result.rating.value, ratingDiff, true)}
      </div>

      <div class="sim-comment ${getCommentClass(riskDiff)}">
        <div class="sim-comment-icon">
            ${getCommentIcon(riskDiff)}
        </div>
        <div class="sim-comment-text">
            ${escapeHtml(describeChange(inputs, riskDiff))}
        </div>
      </div>
    `;
    }

    function renderMetricCard(label, data, diff, higherIsBetter) {
        const term = data.term;
        const valueColor =
            label === "Риск" ? Utils.riskClass(term) : Utils.readyClass(term);

        const diffArrow = diff > 2 ? "up" : diff < -2 ? "down" : "";
        const diffClass =
            diffArrow === "up"
                ? higherIsBetter
                    ? "good"
                    : "bad"
                : diffArrow === "down"
                  ? higherIsBetter
                      ? "bad"
                      : "good"
                  : "";

        return `
      <div class="sim-metric">
        <div class="sim-metric-label">${escapeHtml(label)}</div>
        <div class="sim-metric-value" style="color:var(--${valueColor})">
          ${data.value.toFixed(0)}
        </div>
        <div class="sim-metric-term">${escapeHtml(Fuzzy.termLabel(term, label === "Риск" ? "risk" : label === "Готовность" ? "ready" : "rating"))}</div>
        ${
            diffArrow
                ? `
            <div class="sim-metric-diff ${diffClass}">
                ${diffArrow === "up" ? "▲" : "▼"} ${Math.abs(diff).toFixed(0)}
            </div>
        `
                : ""
        }
      </div>
    `;
    }

    function diffRow(label, before, after, diff, higherIsBetter) {
        const improved = higherIsBetter ? diff > 5 : diff < -5;
        const worsened = higherIsBetter ? diff < -5 : diff > 5;

        let cls = "";
        if (improved) cls = "better";
        else if (worsened) cls = "worse";

        const diffColor = improved ? "ok" : worsened ? "bad" : "txt-muted";
        const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "—";
        const arrowColor = improved ? "ok" : worsened ? "bad" : "txt-muted";

        return `
      <div class="sim-diff">
        <div class="sim-diff-label">${escapeHtml(label)}</div>
        <div class="sim-diff-before">${before.toFixed(0)}</div>
        <div class="sim-diff-arrow">${SVG.arrowRight({ cls: "icon icon-xs" })}</div>
        <div class="sim-diff-after ${cls}">${after.toFixed(0)}</div>
        <div class="sim-diff-delta" style="color:var(--${diffColor})">
          <span class="sim-diff-delta-arrow" style="color:var(--${arrowColor})">${arrow}</span>
          <span>${diff > 0 ? "+" : ""}${diff.toFixed(0)}</span>
        </div>
      </div>
    `;
    }

    function getCommentClass(riskDiff) {
        if (riskDiff > 5) return "worse";
        if (riskDiff < -5) return "better";
        return "neutral";
    }

    function getCommentIcon(riskDiff) {
        if (riskDiff > 5) return SVG.alertTriangle({ cls: "icon" });
        if (riskDiff < -5) return SVG.checkCircle({ cls: "icon" });
        return SVG.info({ cls: "icon" });
    }

    function describeChange(inputs, riskDiff) {
        if (!baseCache) return "—";

        const changes = [];
        const labels = {
            progress: "прогресс",
            days: "дни до дедлайна",
            activity: "активность",
            edits: "правки",
            volume: "объём",
            orig: "оригинальность",
            supScore: "оценка руководителя",
            gost: "соответствие ГОСТу",
        };

        for (const k of Object.keys(inputs)) {
            const diff = inputs[k] - (baseCache[k] ?? 0);
            if (Math.abs(diff) >= 1) {
                const sign = diff > 0 ? "+" : "";
                changes.push(`${labels[k] || k}: ${sign}${diff.toFixed(0)}`);
            }
        }

        if (changes.length === 0) {
            return "Изменений нет — значения совпадают с данными работы.";
        }

        let verdict = "";
        if (riskDiff > 5) verdict = "Риск вырос — стало хуже.";
        else if (riskDiff < -5) verdict = "Риск снизился — стало лучше.";
        else verdict = "Риск почти не изменился.";

        return `${verdict} Изменения: ${changes.join(", ")}.`;
    }

    /* =========================================================
       ОБРАБОТЧИКИ
       ========================================================= */
    function onChange() {
        const sliderIds = [
            "s_progress",
            "s_days",
            "s_activity",
            "s_edits",
            "s_volume",
            "s_orig",
            "s_supScore",
            "s_gost",
        ];
        const units = {
            s_progress: "%",
            s_days: "",
            s_activity: "",
            s_edits: "",
            s_volume: "%",
            s_orig: "%",
            s_supScore: "",
            s_gost: "%",
        };

        const inputs = {};
        sliderIds.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            const key = id.replace("s_", "");
            inputs[key] = +el.value;
            const lbl = document.getElementById("v_" + id);
            if (lbl) lbl.textContent = el.value + (units[id] || "");

            // Обновляем индикатор изменения
            const sliderEl = el.closest(".sim-slider");
            if (sliderEl && baseRealInputs) {
                const realVal = baseRealInputs[key];
                const isEmpty = realVal === null || realVal === undefined;
                const changed = !isEmpty && +el.value !== realVal;
                sliderEl.classList.toggle("changed", changed);

                // Обновляем «из работы: X»
                const foot = sliderEl.querySelector(".sim-slider-foot");
                if (foot) {
                    if (isEmpty) {
                        foot.innerHTML = `<span class="sim-slider-real empty">нет данных</span>`;
                    } else if (changed) {
                        foot.innerHTML = `<span class="sim-slider-real">из работы: ${realVal}${units[id] || ""}</span>`;
                    } else {
                        foot.innerHTML = "";
                    }
                }
            }
        });

        if (!baseCache && currentWork) {
            baseCache = getBaseInputs(currentWork);
        }
        if (!baseCache) return;

        const baseResult = Utils.safeFuzzyInfer(baseCache);
        const currentResult = Utils.safeFuzzyInfer(inputs);

        const box = document.getElementById("simResult");
        if (box) {
            box.innerHTML = renderResult(baseCache, baseResult, currentResult);
        }
    }

    function applyScenario(type) {
        if (!baseCache) return;

        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
        const s = { ...baseCache };

        if (type === "faster") {
            s.progress = clamp(s.progress + 20, 0, 100);
            s.volume = clamp(s.volume + 20, 0, 100);
            s.activity = clamp(s.activity + 3, 0, 10);
        } else if (type === "miss") {
            s.days = clamp(s.days - 7, 0, 60);
            s.activity = clamp(s.activity - 2, 0, 10);
        } else if (type === "better") {
            s.gost = clamp(s.gost + 20, 0, 100);
            s.orig = clamp(s.orig + 10, 0, 100);
        }

        const sliderIds = [
            "s_progress",
            "s_days",
            "s_activity",
            "s_edits",
            "s_volume",
            "s_orig",
            "s_supScore",
            "s_gost",
        ];
        const units = {
            s_progress: "%",
            s_volume: "%",
            s_orig: "%",
            s_gost: "%",
        };

        sliderIds.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            const key = id.replace("s_", "");
            el.value = s[key];
            const lbl = document.getElementById("v_" + id);
            if (lbl) lbl.textContent = s[key] + (units[id] || "");
        });

        onChange();

        const labels = {
            faster: "Сценарий: студент ускорился",
            miss: "Сценарий: пропуск недели",
            better: "Сценарий: лучшее оформление",
        };
        if (typeof App !== "undefined" && App.toast) {
            App.toast(labels[type] || "Сценарий применён");
        }
    }

    function reset() {
        if (!currentWork) return;
        baseCache = getBaseInputs(currentWork);
        if (!baseCache) return;

        const sliderIds = [
            "s_progress",
            "s_days",
            "s_activity",
            "s_edits",
            "s_volume",
            "s_orig",
            "s_supScore",
            "s_gost",
        ];
        const units = {
            s_progress: "%",
            s_volume: "%",
            s_orig: "%",
            s_gost: "%",
        };

        sliderIds.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            const key = id.replace("s_", "");
            el.value = baseCache[key];
            const lbl = document.getElementById("v_" + id);
            if (lbl) lbl.textContent = baseCache[key] + (units[id] || "");

            const sliderEl = el.closest(".sim-slider");
            if (sliderEl) sliderEl.classList.remove("changed");
            const foot = sliderEl?.querySelector(".sim-slider-foot");
            if (foot) foot.innerHTML = "";
        });

        onChange();
        if (typeof App !== "undefined" && App.toast) {
            App.toast("Значения сброшены к данным работы");
        }
    }

    function selectWork(id) {
        if (!id) return;
        workId = id;
        baseCache = null;
        baseRealInputs = null;
        renderView();
    }

    function renderView() {
        const root = document.getElementById("viewRoot");
        if (!root) return;
        root.innerHTML = `<div class="view active">${render()}</div>`;
    }

    return {
        render,
        onChange,
        reset,
        selectWork,
        applyScenario,
        renderView,
    };
})();
