const MFEditor = (() => {
    const STORAGE_KEY = "fp_mf_overrides";

    const escapeHtml = Utils.escapeHtml;

    const VAR_LABELS = {
        progress: "Прогресс",
        days: "Дни до дедлайна",
        activity: "Активность",
        edits: "Число правок",
        volume: "Объём",
        orig: "Оригинальность",
        supScore: "Оценка руководителя",
        gost: "Соответствие ГОСТу",
    };

    const VAR_DESCRIPTIONS = {
        progress:
            "Насколько студент продвинулся. 0% — ничего, 100% — всё готово.",
        days: "Сколько дней до дедлайна. 0 — просрочен, 60+ — запас большой.",
        activity: "Насколько студент активен — как часто работает.",
        edits: "Сколько раз руководитель оставлял правки. Много — плохой знак.",
        volume: "Объём текста. Мало — плохо, много — хорошо.",
        orig: "Оригинальность текста (антиплагиат). Низкая — плохо.",
        supScore: "Оценка руководителя от 0 до 10. Высокая — хорошо.",
        gost: "Соответствие оформления ГОСТу. Проверяется по .docx.",
    };

    const VAR_EXAMPLES = {
        progress: { low: "10%", med: "50%", high: "90%" },
        days: { low: "5 дн.", med: "25 дн.", high: "50 дн." },
        activity: { low: "2", med: "5", high: "9" },
        edits: { low: "1", med: "8", high: "18" },
        volume: { low: "20%", med: "55%", high: "95%" },
        orig: { low: "30%", med: "65%", high: "90%" },
        supScore: { low: "2", med: "5", high: "9" },
        gost: { low: "30%", med: "70%", high: "95%" },
    };

    const VAR_RANGE = {
        progress: { min: 0, max: 100, unit: "%" },
        days: { min: 0, max: 60, unit: "" },
        activity: { min: 0, max: 10, unit: "" },
        edits: { min: 0, max: 20, unit: "" },
        volume: { min: 0, max: 100, unit: "%" },
        orig: { min: 0, max: 100, unit: "%" },
        supScore: { min: 0, max: 10, unit: "" },
        gost: { min: 0, max: 100, unit: "%" },
    };

    const DEFAULTS = {
        progress: { low: [0, 0, 50], med: [25, 50, 75], high: [50, 100, 100] },
        days: { low: [0, 0, 20], med: [10, 25, 40], high: [30, 60, 60] },
        activity: { low: [0, 0, 5], med: [3, 5, 8], high: [6, 10, 10] },
        edits: { low: [0, 0, 5], med: [3, 8, 13], high: [10, 20, 20] },
        volume: { low: [0, 0, 50], med: [30, 55, 80], high: [70, 100, 100] },
        orig: { low: [0, 0, 55], med: [40, 65, 85], high: [75, 100, 100] },
        supScore: { low: [0, 0, 5], med: [3, 5, 8], high: [6, 10, 10] },
        gost: { low: [0, 0, 60], med: [45, 70, 85], high: [75, 100, 100] },
    };

    const PRESETS = {
        standard: {
            label: "Стандарт",
            desc: "Значения по умолчанию",
            data: null,
        },
        strict: {
            label: "Строгий",
            desc: "Высокие требования",
            data: {
                progress: {
                    low: [0, 0, 30],
                    med: [20, 50, 80],
                    high: [70, 100, 100],
                },
                orig: {
                    low: [0, 0, 70],
                    med: [60, 75, 90],
                    high: [85, 100, 100],
                },
                gost: {
                    low: [0, 0, 70],
                    med: [65, 80, 95],
                    high: [90, 100, 100],
                },
                supScore: { low: [0, 0, 6], med: [5, 7, 9], high: [8, 10, 10] },
            },
        },
        soft: {
            label: "Мягкий",
            desc: "Пониженные требования",
            data: {
                progress: {
                    low: [0, 0, 60],
                    med: [40, 60, 80],
                    high: [70, 100, 100],
                },
                orig: {
                    low: [0, 0, 40],
                    med: [30, 50, 70],
                    high: [60, 100, 100],
                },
                gost: {
                    low: [0, 0, 50],
                    med: [40, 60, 80],
                    high: [70, 100, 100],
                },
            },
        },
    };

    let selectedVar = "progress";
    let liveValue = 50;
    let chartInstance = null;

    function clamp01(v) {
        if (typeof v !== "number" || isNaN(v) || !isFinite(v)) return 0;
        return Math.max(0, Math.min(100, v));
    }

    function sanitizeTriangle(tri) {
        if (!Array.isArray(tri) || tri.length !== 3) return [0, 0, 0];
        let [a, b, c] = tri.map(clamp01);
        if (a > b) [a, b] = [b, a];
        if (b > c) [b, c] = [c, b];
        if (a > b) [a, b] = [b, a];
        return [a, b, c];
    }

    function sanitizeOverrides(obj) {
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
        const clean = {};
        for (const varName of Object.keys(obj)) {
            if (!DEFAULTS[varName]) continue;
            const terms = obj[varName];
            if (!terms || typeof terms !== "object") continue;
            clean[varName] = {};
            for (const term of Object.keys(terms)) {
                if (!DEFAULTS[varName][term]) continue;
                const tri = terms[term];
                if (!Array.isArray(tri) || tri.length !== 3) continue;
                clean[varName][term] = sanitizeTriangle(tri);
            }
            if (Object.keys(clean[varName]).length === 0) {
                delete clean[varName];
            }
        }
        return clean;
    }

    function getOverrides() {
        const raw = Storage.get(STORAGE_KEY, {});
        return sanitizeOverrides(raw);
    }

    function setOverrides(o) {
        const clean = sanitizeOverrides(o);
        Storage.set(STORAGE_KEY, clean);
        applyOverrides();
    }

    function _trimf(x, a, b, c) {
        if (typeof Fuzzy !== "undefined" && Fuzzy.trimf) {
            return Fuzzy.trimf(x, a, b, c);
        }
        if (typeof x !== "number" || isNaN(x)) return 0;
        if (x === a && a === b) return 1;
        if (x === c && b === c) return 1;
        if (x <= a || x >= c) return 0;
        if (x === b) return 1;
        return x < b ? (x - a) / (b - a) : (c - x) / (c - b);
    }

    function resetToDefaults() {
        if (typeof Fuzzy === "undefined" || !Fuzzy.MF) return;
        for (const v in DEFAULTS) {
            if (!Fuzzy.MF[v]) continue;
            for (const t in DEFAULTS[v]) {
                const [a, b, c] = DEFAULTS[v][t];
                Fuzzy.MF[v][t] = (x) => _trimf(x, a, b, c);
            }
        }
    }

    function applyOverrides() {
        if (typeof Fuzzy === "undefined" || !Fuzzy.MF) return;

        resetToDefaults();

        const overrides = getOverrides();
        for (const varName in overrides) {
            if (!Fuzzy.MF[varName]) continue;
            for (const term in overrides[varName]) {
                if (typeof Fuzzy.MF[varName][term] !== "function") continue;
                const tri = overrides[varName][term];
                if (!Array.isArray(tri) || tri.length !== 3) continue;
                const [a, b, c] = sanitizeTriangle(tri);
                Fuzzy.MF[varName][term] = (x) => _trimf(x, a, b, c);
            }
        }
    }

    function restoreVarDefaults(varName) {
        if (typeof Fuzzy === "undefined" || !Fuzzy.MF) return;
        if (!Fuzzy.MF[varName] || !DEFAULTS[varName]) return;
        for (const t in DEFAULTS[varName]) {
            const [a, b, c] = DEFAULTS[varName][t];
            Fuzzy.MF[varName][t] = (x) => _trimf(x, a, b, c);
        }
    }

    function getCurrentDef(varName) {
        const overrides = getOverrides();
        const def = JSON.parse(JSON.stringify(DEFAULTS[varName]));
        if (overrides[varName]) {
            for (const t in overrides[varName]) {
                def[t] = overrides[varName][t];
            }
        }
        return def;
    }

    function getMu(varName, term, x) {
        const def = getCurrentDef(varName);
        if (!def[term]) return 0;
        const [a, b, c] = def[term];
        return _trimf(x, a, b, c);
    }

    function scaleFrom100(varName, val100) {
        const range = VAR_RANGE[varName] || { min: 0, max: 100 };
        return Math.round((val100 / 100) * range.max);
    }

    function scaleTo100(varName, val) {
        const range = VAR_RANGE[varName] || { min: 0, max: 100 };
        return (val / range.max) * 100;
    }

    function render() {
        const currentDef = getCurrentDef(selectedVar);
        const range = VAR_RANGE[selectedVar] || { min: 0, max: 100, unit: "" };

        return `
      ${renderHero()}
      ${renderNotice()}
      ${renderPresets()}
      ${renderLiveExample()}
      ${renderLayout(currentDef, range)}
      ${renderVarsSelector()}
      ${renderHelp()}
    `;
    }

    function renderHero() {
        return `
      <div class="mf-hero">
        <div class="mf-hero-icon">${SVG.sliders({ cls: "icon icon-xl" })}</div>
        <div class="mf-hero-body">
          <div class="mf-hero-title">Редактор функций принадлежности</div>
          <div class="mf-hero-text">
            Настройте, <b>как система понимает</b> каждое значение.
            Например, что значит «высокий прогресс» — 70% или 90%.
            Изменения <b>сразу влияют</b> на все оценки.
          </div>
        </div>
      </div>
    `;
    }

    function renderNotice() {
        return `
      <div class="mf-notice">
        ${SVG.alertTriangle({ cls: "icon icon-sm" })}
        <span>Изменения применяются мгновенно. Если сомневаетесь — используйте <b>пресеты</b> или <b>сбросьте</b>.</span>
      </div>
    `;
    }

    function renderPresets() {
        return `
      <div class="mf-presets">
        <div class="mf-presets-label">
          ${SVG.star({ cls: "icon icon-sm" })}
          Быстрые пресеты
        </div>
        <div class="mf-presets-grid">
          ${Object.keys(PRESETS)
              .map(
                  (key) => `
            <button class="mf-preset" onclick="MFEditor.applyPreset('${key}')">
              <div class="mf-preset-title">${escapeHtml(PRESETS[key].label)}</div>
              <div class="mf-preset-desc">${escapeHtml(PRESETS[key].desc)}</div>
            </button>
          `,
              )
              .join("")}
        </div>
      </div>
    `;
    }

    function renderLiveExample() {
        const range = VAR_RANGE[selectedVar] || { min: 0, max: 100 };
        const realValue = scaleFrom100(selectedVar, liveValue);

        const muLow = getMu(selectedVar, "low", liveValue);
        const muMed = getMu(selectedVar, "med", liveValue);
        const muHigh = getMu(selectedVar, "high", liveValue);

        const maxMu = Math.max(muLow, muMed, muHigh);
        let dominant = "низкий";
        if (maxMu === muMed) dominant = "средний";
        if (maxMu === muHigh) dominant = "высокий";
        if (maxMu === 0) dominant = "никакой";

        return `
      <div class="mf-live">
        <div class="mf-live-title">
          ${SVG.target({ cls: "icon icon-sm" })}
          Тест на примере — что система думает об этом значении
        </div>
        <div class="mf-live-desc">
          Двигай ползунок — увидишь, <b>как система интерпретирует</b> это значение.
        </div>

        <div class="mf-live-slider">
          <div class="mf-live-slider-head">
            <span class="mf-live-slider-label">${escapeHtml(VAR_LABELS[selectedVar])}</span>
            <span class="mf-live-slider-val">${realValue}${range.unit}</span>
          </div>
          <input type="range" min="0" max="100" value="${liveValue}"
            oninput="MFEditor.onLiveChange(this.value)">
        </div>

        <div class="mf-live-result">
          <div class="mf-live-term ${muLow > 0.1 ? "active" : ""}">
            <div class="mf-live-term-label">Низкий</div>
            <div class="mf-live-term-mu">${muLow.toFixed(2)}</div>
            <div class="mf-live-term-bar">
              <div style="width:${muLow * 100}%;background:var(--ok)"></div>
            </div>
          </div>
          <div class="mf-live-term ${muMed > 0.1 ? "active" : ""}">
            <div class="mf-live-term-label">Средний</div>
            <div class="mf-live-term-mu">${muMed.toFixed(2)}</div>
            <div class="mf-live-term-bar">
              <div style="width:${muMed * 100}%;background:var(--warn)"></div>
            </div>
          </div>
          <div class="mf-live-term ${muHigh > 0.1 ? "active" : ""}">
            <div class="mf-live-term-label">Высокий</div>
            <div class="mf-live-term-mu">${muHigh.toFixed(2)}</div>
            <div class="mf-live-term-bar">
              <div style="width:${muHigh * 100}%;background:var(--bad)"></div>
            </div>
          </div>
        </div>

        <div class="mf-live-verdict">
          ${SVG.info({ cls: "icon icon-sm" })}
          <span>
            Система считает это значение <b>${dominant}</b>
            (μ = ${maxMu.toFixed(2)}).
            ${
                maxMu === 0
                    ? "Ни один терм не сработал — значение вне диапазонов."
                    : ""
            }
          </span>
        </div>
      </div>
    `;
    }

    function renderLayout(currentDef, range) {
        return `
      <div class="mf-layout">
        <div class="mf-chart-col">
          <div class="mf-chart-head">
            <div class="mf-chart-title">
              ${SVG.barChart({ cls: "icon icon-sm" })}
              График ФП: ${escapeHtml(VAR_LABELS[selectedVar])}
            </div>
          </div>
          <div class="mf-chart-desc">
            Три треугольника — три терма. Чем выше линия — тем сильнее уверенность.
            Красная точка — твоё значение из теста выше.
          </div>
          <div class="mf-canvas-wrap">
            <canvas id="mfChart"></canvas>
          </div>
          <div class="mf-chart-hints">
            ${["low", "med", "high"]
                .map((t) => {
                    const colors = {
                        low: "var(--ok)",
                        med: "var(--warn)",
                        high: "var(--bad)",
                    };
                    const labels = {
                        low: "Низкий",
                        med: "Средний",
                        high: "Высокий",
                    };
                    const example = VAR_EXAMPLES[selectedVar]?.[t] || "";
                    return `
                <div class="mf-chart-hint">
                  <span class="mf-hint-dot" style="background:${colors[t]}"></span>
                  <span class="mf-hint-label">${labels[t]}</span>
                  <span class="mf-hint-example">например, ${example}</span>
                </div>
              `;
                })
                .join("")}
          </div>
        </div>

        <div class="mf-controls-col">
          <div class="mf-var-info">
            <div class="mf-var-info-title">${escapeHtml(VAR_LABELS[selectedVar])}</div>
            <div class="mf-var-info-desc">${escapeHtml(VAR_DESCRIPTIONS[selectedVar] || "")}</div>
          </div>

          ${["low", "med", "high"]
              .map((t) => renderTermCard(t, currentDef[t], range))
              .join("")}

          <div class="mf-actions">
            <button class="btn-ghost mf-action" onclick="MFEditor.resetVar()">
              ${SVG.refresh({ cls: "icon icon-sm" })}
              <span>Сбросить переменную</span>
            </button>
            <button class="btn-ghost mf-action btn-danger" onclick="MFEditor.resetAll()">
              ${SVG.trash({ cls: "icon icon-sm" })}
              <span>Сбросить всё</span>
            </button>
          </div>
        </div>
      </div>
    `;
    }

    function renderTermCard(term, tri, range) {
        const colors = {
            low: "var(--ok)",
            med: "var(--warn)",
            high: "var(--bad)",
        };
        const labels = { low: "Низкий", med: "Средний", high: "Высокий" };
        const hints = {
            low: `Чем <b>меньше</b> значение, тем увереннее терм «${labels[term]}»`,
            med: `Среднее значение — вершина «${labels[term]}»`,
            high: `Чем <b>больше</b> значение, тем увереннее терм «${labels[term]}»`,
        };
        const example = VAR_EXAMPLES[selectedVar]?.[term] || "";

        return `
      <div class="mf-term-card">
        <div class="mf-term-head">
          <span class="mf-term-dot" style="background:${colors[term]}"></span>
          <span class="mf-term-name">${labels[term]}</span>
          <span class="mf-term-tri">(${tri[0]} · ${tri[1]} · ${tri[2]})</span>
        </div>
        <div class="mf-term-hint">${hints[term]} · например, <b>${example}</b></div>
        <div class="mf-term-inputs">
          <div class="mf-term-input">
            <label>Начало (a)</label>
            <input type="number" value="${tri[0]}" min="${range.min}" max="${range.max}" step="1"
              onchange="MFEditor.updateTri('${term}', 0, +this.value)">
          </div>
          <div class="mf-term-input">
            <label>Вершина (b)</label>
            <input type="number" value="${tri[1]}" min="${range.min}" max="${range.max}" step="1"
              onchange="MFEditor.updateTri('${term}', 1, +this.value)">
          </div>
          <div class="mf-term-input">
            <label>Конец (c)</label>
            <input type="number" value="${tri[2]}" min="${range.min}" max="${range.max}" step="1"
              onchange="MFEditor.updateTri('${term}', 2, +this.value)">
          </div>
        </div>
      </div>
    `;
    }

    function renderVarsSelector() {
        return `
      <div class="mf-vars-section">
        <div class="mf-vars-title">
          ${SVG.layers({ cls: "icon icon-sm" })}
          Выбрать переменную
        </div>
        <div class="mf-vars">
          ${Object.keys(DEFAULTS)
              .map(
                  (v) => `
            <button class="mf-var-card ${selectedVar === v ? "active" : ""}"
              onclick="MFEditor.selectVar('${v}')">
              <div class="mf-var-name">${escapeHtml(VAR_LABELS[v] || v)}</div>
              <div class="mf-var-terms">${renderMiniBars(v)}</div>
            </button>
          `,
              )
              .join("")}
        </div>
      </div>
    `;
    }

    function renderMiniBars(varName) {
        const def = getCurrentDef(varName);

        return `
      <div class="mf-mini-bars">
        ${["low", "med", "high"]
            .map((t) => {
                const [a, , c] = sanitizeTriangle(def[t]);
                const width = Math.max(15, c - a);
                const left = a;
                const color =
                    t === "low"
                        ? "var(--ok)"
                        : t === "med"
                          ? "var(--warn)"
                          : "var(--bad)";
                return `<span class="mf-mini-bar" style="left:${left}%;width:${width}%;background:${color}"></span>`;
            })
            .join("")}
      </div>
    `;
    }

    function renderHelp() {
        return `
      <div class="mf-help">
        <div class="mf-help-title">
          ${SVG.info({ cls: "icon icon-sm" })}
          Что такое функция принадлежности?
        </div>
        <div class="mf-help-text">
          Функция принадлежности (ФП) показывает, <b>насколько значение
          относится к какому-то терму</b>. Треугольник — простой способ
          её задать: <b>начало (a)</b> — где терм «заканчивается» слева,
          <b>вершина (b)</b> — «идеальное» значение, <b>конец (c)</b> — где
          терм «заканчивается» справа.<br><br>
          Например, для терма «средний» прогресс вершина на 50%: именно при 50%
          система уверена, что прогресс средний. При 25% — уже низкий, при 75% — высокий.
        </div>
      </div>
    `;
    }
    function selectVar(v) {
        if (!DEFAULTS[v]) return;
        selectedVar = v;

        const range = VAR_RANGE[v] || { min: 0, max: 100 };
        liveValue = 50;

        renderView();
    }

    function onLiveChange(val) {
        liveValue = +val;

        const liveBox = document.querySelector(".mf-live");
        if (liveBox) {
            liveBox.outerHTML = renderLiveExample();
        }

        drawChart();
    }

    function updateTri(term, idx, val) {
        if (!["low", "med", "high"].includes(term)) return;
        if (![0, 1, 2].includes(idx)) return;

        const range = VAR_RANGE[selectedVar] || { min: 0, max: 100 };
        const scale = 100 / range.max;
        const safeVal = clamp01(+val * scale);

        const overrides = getOverrides();
        if (!overrides[selectedVar]) {
            overrides[selectedVar] = JSON.parse(
                JSON.stringify(DEFAULTS[selectedVar]),
            );
        }

        overrides[selectedVar][term][idx] = safeVal;
        overrides[selectedVar][term] = sanitizeTriangle(
            overrides[selectedVar][term],
        );

        setOverrides(overrides);

        if (typeof Audit !== "undefined") {
            Audit.log(
                "Изменена ФП",
                `${VAR_LABELS[selectedVar] || selectedVar} · ${term}`,
                `[${overrides[selectedVar][term].join(", ")}]`,
                "info",
            );
        }

        const liveBox = document.querySelector(".mf-live");
        if (liveBox) {
            liveBox.outerHTML = renderLiveExample();
        }
        drawChart();
    }

    function applyPreset(key) {
        const preset = PRESETS[key];
        if (!preset) return;

        if (key === "standard") {
            Storage.remove(STORAGE_KEY);
            resetToDefaults();
            renderView();
            if (typeof App !== "undefined" && App.toast) {
                App.toast("Применён пресет: Стандарт");
            }
            if (typeof Audit !== "undefined") {
                Audit.log("Применён пресет ФП", "Стандарт", "", "warning");
            }
            return;
        }

        if (preset.data) {
            const overrides = getOverrides();
            for (const varName in preset.data) {
                overrides[varName] = JSON.parse(
                    JSON.stringify(preset.data[varName]),
                );
            }
            setOverrides(overrides);
            renderView();
            if (typeof App !== "undefined" && App.toast) {
                App.toast(`Применён пресет: ${preset.label}`);
            }
            if (typeof Audit !== "undefined") {
                Audit.log("Применён пресет ФП", preset.label, "", "info");
            }
        }
    }

    function resetVar() {
        const overrides = getOverrides();
        delete overrides[selectedVar];
        setOverrides(overrides);
        restoreVarDefaults(selectedVar);
        renderView();
        if (typeof App !== "undefined" && App.toast) {
            App.toast(`Сброшено: ${VAR_LABELS[selectedVar] || selectedVar}`);
        }
    }

    function resetAll() {
        if (
            !confirm(
                "Сбросить все функции принадлежности к значениям по умолчанию?",
            )
        )
            return;

        Storage.remove(STORAGE_KEY);
        resetToDefaults();
        renderView();
        if (typeof App !== "undefined" && App.toast) {
            App.toast("Все ФП сброшены к значениям по умолчанию");
        }

        if (typeof Audit !== "undefined") {
            Audit.log("Сброшены все ФП", "", "", "warning");
        }
    }

    function exportSettings() {
        const overrides = getOverrides();
        const data = {
            version: 1,
            exportedAt: new Date().toISOString(),
            overrides: overrides,
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `fuzzyproject_mf_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 500);

        if (typeof App !== "undefined" && App.toast) {
            App.toast("Настройки ФП экспортированы");
        }
    }

    function importSettings() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (!data || typeof data !== "object") {
                        throw new Error("Неверный формат");
                    }

                    if (data.overrides) {
                        setOverrides(data.overrides);
                    } else if (data.progress || data.days) {
                        setOverrides(data);
                    } else {
                        throw new Error("Нет поля overrides");
                    }

                    renderView();
                    if (typeof App !== "undefined" && App.toast) {
                        App.toast("Настройки ФП импортированы");
                    }
                    if (typeof Audit !== "undefined") {
                        Audit.log("Импорт ФП", file.name, "", "info");
                    }
                } catch (err) {
                    console.error(err);
                    if (typeof App !== "undefined" && App.toast) {
                        App.toast("Ошибка чтения файла");
                    }
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function drawChart() {
        if (typeof Chart === "undefined") return;

        const canvas = document.getElementById("mfChart");
        if (!canvas) return;

        if (chartInstance) {
            try {
                chartInstance.destroy();
            } catch (e) {}
            chartInstance = null;
        }

        const currentDef = getCurrentDef(selectedVar);
        const range = VAR_RANGE[selectedVar] || { min: 0, max: 100 };

        const x = Array.from({ length: 101 }, (_, i) => i);

        const dataLow = x.map((v) => {
            const [a, b, c] = sanitizeTriangle(currentDef.low);
            return _trimf(v, a, b, c);
        });
        const dataMed = x.map((v) => {
            const [a, b, c] = sanitizeTriangle(currentDef.med);
            return _trimf(v, a, b, c);
        });
        const dataHigh = x.map((v) => {
            const [a, b, c] = sanitizeTriangle(currentDef.high);
            return _trimf(v, a, b, c);
        });

        const liveMuLow = getMu(selectedVar, "low", liveValue);
        const liveMuMed = getMu(selectedVar, "med", liveValue);
        const liveMuHigh = getMu(selectedVar, "high", liveValue);

        const pointLow = x.map((v) => (v === liveValue ? liveMuLow : null));
        const pointMed = x.map((v) => (v === liveValue ? liveMuMed : null));
        const pointHigh = x.map((v) => (v === liveValue ? liveMuHigh : null));

        const cs = getComputedStyle(document.documentElement);
        const get = (n, f) => cs.getPropertyValue(n).trim() || f;
        const C = {
            ok: get("--ok", "#1f8a4c"),
            warn: get("--warn", "#c47f1a"),
            bad: get("--bad", "#c23a2f"),
            accent: get("--accent", "#111111"),
            purple: "#7c5cf0",
            txt: get("--txt-muted", "#71717a"),
            line: get("--line", "#ebebeb"),
        };

        chartInstance = new Chart(canvas, {
            type: "line",
            data: {
                labels: x,
                datasets: [
                    {
                        label: "Низкий",
                        data: dataLow,
                        borderColor: C.ok,
                        backgroundColor: C.ok + "20",
                        borderWidth: 2.5,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        fill: false,
                        tension: 0,
                    },
                    {
                        label: "Средний",
                        data: dataMed,
                        borderColor: C.warn,
                        backgroundColor: C.warn + "20",
                        borderWidth: 2.5,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        fill: false,
                        tension: 0,
                    },
                    {
                        label: "Высокий",
                        data: dataHigh,
                        borderColor: C.bad,
                        backgroundColor: C.bad + "20",
                        borderWidth: 2.5,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        fill: false,
                        tension: 0,
                    },
                    {
                        label: "Текущее значение",
                        data: pointLow,
                        borderColor: C.ok,
                        backgroundColor: C.ok,
                        borderWidth: 0,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        pointBorderColor: "#fff",
                        pointBorderWidth: 3,
                        showLine: false,
                    },
                    {
                        label: "_med_point",
                        data: pointMed,
                        borderColor: C.warn,
                        backgroundColor: C.warn,
                        borderWidth: 0,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        pointBorderColor: "#fff",
                        pointBorderWidth: 3,
                        showLine: false,
                    },
                    {
                        label: "_high_point",
                        data: pointHigh,
                        borderColor: C.bad,
                        backgroundColor: C.bad,
                        borderWidth: 0,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        pointBorderColor: "#fff",
                        pointBorderWidth: 3,
                        showLine: false,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 250 },
                interaction: {
                    mode: "nearest",
                    intersect: false,
                },
                plugins: {
                    legend: {
                        labels: {
                            color: C.txt,
                            font: { size: 11 },
                            boxWidth: 12,
                            usePointStyle: true,
                            filter: (item) => !item.text.startsWith("_"),
                        },
                    },
                    tooltip: {
                        backgroundColor: "#fff",
                        titleColor: C.txt,
                        bodyColor: C.txt,
                        borderColor: C.line,
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            title: (items) => {
                                const v = items[0].parsed.x;
                                const real = scaleFrom100(selectedVar, v);
                                const range = VAR_RANGE[selectedVar];
                                return `${VAR_LABELS[selectedVar]} = ${real}${range?.unit || ""}`;
                            },
                            label: (item) => {
                                if (item.dataset.label.startsWith("_"))
                                    return "";
                                return `${item.dataset.label}: μ = ${item.parsed.y.toFixed(2)}`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        type: "linear",
                        min: 0,
                        max: 100,
                        ticks: {
                            color: C.txt,
                            font: { size: 10 },
                            stepSize: 10,
                            callback: (v) => {
                                const real = scaleFrom100(selectedVar, v);
                                return real;
                            },
                        },
                        grid: { color: C.line, drawBorder: false },
                        title: {
                            display: true,
                            text: VAR_LABELS[selectedVar],
                            color: C.txt,
                            font: { size: 11 },
                        },
                    },
                    y: {
                        min: 0,
                        max: 1,
                        ticks: {
                            color: C.txt,
                            font: { size: 10 },
                            stepSize: 0.25,
                        },
                        grid: { color: C.line, drawBorder: false },
                        title: {
                            display: true,
                            text: "Уверенность (μ)",
                            color: C.txt,
                            font: { size: 11 },
                        },
                    },
                },
            },
        });
    }

    function renderView() {
        const root = document.getElementById("viewRoot");
        if (!root) return;
        root.innerHTML = `<div class="view active">${render()}</div>`;
        setTimeout(drawChart, 50);
    }

    function init() {
        applyOverrides();
    }

    return {
        render,
        selectVar,
        onLiveChange,
        updateTri,
        resetVar,
        resetAll,
        applyPreset,
        exportSettings,
        importSettings,
        renderView,
        applyOverrides,
        init,
        DEFAULTS,
        VAR_LABELS,
        getOverrides,
        setOverrides,
    };
})();

document.addEventListener("DOMContentLoaded", () => {
    MFEditor.init();
});
