/* =========================================================
   MF EDITOR — визуальный редактор функций принадлежности
   Обновлено: усиленная валидация, санитизация,
   проверка синхронизации с Fuzzy.MF + автоочистка битых overrides
   ========================================================= */
const MFEditor = (() => {
    const STORAGE_KEY = "fp_mf_overrides";

    /* =========================================================
       ЭКРАНИРОВАНИЕ
       ========================================================= */
    function escapeHtml(str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

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

    /* Эталонные значения — ДОЛЖНЫ совпадать с fuzzy.js MF */
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

    let selectedVar = "progress";

    /* =========================================================
       ВАЛИДАЦИЯ
       ========================================================= */
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

    /* =========================================================
       OVERRIDES
       ========================================================= */
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

    /* =========================================================
       ПРОВЕРКА СИНХРОНИЗАЦИИ С fuzzy.js
       Возвращает true, если всё ок, иначе false
       ========================================================= */
    function checkSyncWithFuzzy(silent = false) {
        if (typeof Fuzzy === "undefined" || !Fuzzy.MF) return true;
        const issues = [];
        const testPoints = [0, 10, 25, 50, 75, 90, 100];

        for (const varName in DEFAULTS) {
            if (!Fuzzy.MF[varName]) {
                issues.push(`Fuzzy.MF.${varName} отсутствует`);
                continue;
            }
            for (const term in DEFAULTS[varName]) {
                if (typeof Fuzzy.MF[varName][term] !== "function") {
                    issues.push(`Fuzzy.MF.${varName}.${term} не функция`);
                    continue;
                }
                const [a, b, c] = DEFAULTS[varName][term];
                for (const x of testPoints) {
                    const expected = _trimf(x, a, b, c);
                    const actual = Fuzzy.MF[varName][term](x);
                    if (Math.abs(expected - actual) > 0.001) {
                        issues.push(
                            `Fuzzy.MF.${varName}.${term} ≠ DEFAULTS при x=${x} (${actual.toFixed(3)} vs ${expected.toFixed(3)})`,
                        );
                        break;
                    }
                }
            }
        }

        if (issues.length > 0) {
            if (!silent) {
                console.warn("[MFEditor] Расхождение DEFAULTS и Fuzzy.MF:");
                issues.forEach((i) => console.warn("  · " + i));
            }
            return false;
        }

        if (!silent) {
            console.log("[MFEditor] DEFAULTS и Fuzzy.MF синхронизированы ✓");
        }
        return true;
    }

    /* =========================================================
       РЕНДЕР
       ========================================================= */
    function render() {
        const overrides = getOverrides();
        const currentDef = JSON.parse(JSON.stringify(DEFAULTS[selectedVar]));
        if (overrides[selectedVar]) {
            for (const t in overrides[selectedVar]) {
                currentDef[t] = overrides[selectedVar][t];
            }
        }

        return `
      <div class="card">
        <div class="card-title">Редактор функций принадлежности</div>

        <p style="font-size:13px;color:var(--txt-muted);margin-bottom:20px;line-height:1.6;">
          Настройте треугольные функции принадлежности для каждой переменной.
          Изменения применяются мгновенно ко всем расчётам системы.
        </p>

        <div class="section-label">Переменная</div>
        <div class="mf-vars">
          ${Object.keys(DEFAULTS)
              .map(
                  (v) => `
            <div class="mf-var-card ${selectedVar === v ? "active" : ""}"
              onclick="MFEditor.selectVar('${v}')">
              <div class="mf-var-name">${escapeHtml(VAR_LABELS[v] || v)}</div>
              <div class="mf-var-terms">low / med / high</div>
            </div>
          `,
              )
              .join("")}
        </div>

        <div class="section-label" style="margin-top:24px;">
          Функции принадлежности для «${escapeHtml(VAR_LABELS[selectedVar] || selectedVar)}»
        </div>

        <div class="mf-canvas-wrap">
          <canvas id="mfCanvas"></canvas>
        </div>

        <div class="grid grid-3 mt-16">
          ${["low", "med", "high"]
              .map((t) => renderTermCard(t, currentDef[t]))
              .join("")}
        </div>

        <div style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap;">
          <button class="btn-ghost btn-sm" onclick="MFEditor.resetVar()">
            ${SVG.refresh({ cls: "icon icon-sm" })}
            <span>Сбросить переменную</span>
          </button>
          <button class="btn-ghost btn-sm btn-danger" onclick="MFEditor.resetAll()">
            ${SVG.trash({ cls: "icon icon-sm" })}
            <span>Сбросить все ФП</span>
          </button>
        </div>

        <div class="notice" style="margin-top:16px;font-size:12px;">
          ${SVG.info({ cls: "icon icon-xs" })}
          Значения: <b>a</b> — левая точка, <b>b</b> — вершина, <b>c</b> — правая точка.
          Все числа от 0 до 100, при этом <b>a ≤ b ≤ c</b>.
        </div>
      </div>
    `;
    }

    function renderTermCard(term, tri) {
        const colors = {
            low: "var(--ok)",
            med: "var(--warn)",
            high: "var(--bad)",
        };
        return `
      <div class="stat-card">
        <div class="stat-card-row">
          <span class="stat-card-label">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colors[term]};margin-right:6px;"></span>
            ${term}
          </span>
        </div>
        <div style="font-size:11px;color:var(--txt-muted);margin-bottom:8px;">
          Треугольник: (a=${tri[0]}, b=${tri[1]}, c=${tri[2]})
        </div>
        <div class="row-2" style="gap:6px;">
          <div>
            <label style="font-size:10px;color:var(--txt-muted);">a</label>
            <input type="number" value="${tri[0]}" min="0" max="100" step="1"
              onchange="MFEditor.updateTri('${term}', 0, +this.value)"
              style="width:100%;padding:5px 8px;font-size:12px;">
          </div>
          <div>
            <label style="font-size:10px;color:var(--txt-muted);">b</label>
            <input type="number" value="${tri[1]}" min="0" max="100" step="1"
              onchange="MFEditor.updateTri('${term}', 1, +this.value)"
              style="width:100%;padding:5px 8px;font-size:12px;">
          </div>
          <div>
            <label style="font-size:10px;color:var(--txt-muted);">c</label>
            <input type="number" value="${tri[2]}" min="0" max="100" step="1"
              onchange="MFEditor.updateTri('${term}', 2, +this.value)"
              style="width:100%;padding:5px 8px;font-size:12px;">
          </div>
        </div>
      </div>
    `;
    }

    /* =========================================================
       ДЕЙСТВИЯ
       ========================================================= */
    function selectVar(v) {
        if (!DEFAULTS[v]) return;
        selectedVar = v;
        renderView();
    }

    function updateTri(term, idx, val) {
        if (!["low", "med", "high"].includes(term)) return;
        if (![0, 1, 2].includes(idx)) return;

        const safeVal = clamp01(+val);

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

        renderView();
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

    /* =========================================================
       РЕНДЕР CANVAS
       ========================================================= */
    function renderView() {
        const root = document.getElementById("viewRoot");
        if (!root) return;
        root.innerHTML = `<div class="view active">${render()}</div>`;
        setTimeout(drawCanvas, 0);
    }

    function drawCanvas() {
        const canvas = document.getElementById("mfCanvas");
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.offsetWidth || 400;
        const cssH = canvas.offsetHeight || 240;

        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const w = cssW;
        const h = cssH;

        const cs = getComputedStyle(document.documentElement);
        const get = (n, f) => cs.getPropertyValue(n).trim() || f;
        const colorLine = get("--line", "#e4e4e7");
        const colorTxt = get("--txt-muted", "#71717a");
        const colorTxtSoft = get("--txt-soft", "#a1a1aa");
        const colors = {
            low: get("--ok", "#10b981"),
            med: get("--warn", "#f59e0b"),
            high: get("--bad", "#ef4444"),
        };

        ctx.clearRect(0, 0, w, h);

        ctx.strokeStyle = colorLine;
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const x = (w * i) / 10;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let i = 0; i <= 4; i++) {
            const y = (h * i) / 4;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        ctx.strokeStyle = colorTxtSoft;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, h - 1);
        ctx.lineTo(w, h - 1);
        ctx.moveTo(1, 0);
        ctx.lineTo(1, h);
        ctx.stroke();

        const overrides = getOverrides();
        const currentDef = JSON.parse(JSON.stringify(DEFAULTS[selectedVar]));
        if (overrides[selectedVar]) {
            for (const t in overrides[selectedVar]) {
                currentDef[t] = overrides[selectedVar][t];
            }
        }

        for (const term of ["low", "med", "high"]) {
            const [a, b, c] = sanitizeTriangle(currentDef[term]);
            const xA = (a / 100) * w;
            const xB = (b / 100) * w;
            const xC = (c / 100) * w;

            ctx.beginPath();
            ctx.moveTo(xA, h);
            ctx.lineTo(xB, 0);
            ctx.lineTo(xC, h);
            ctx.strokeStyle = colors[term];
            ctx.lineWidth = 2.5;
            ctx.lineJoin = "round";
            ctx.stroke();

            ctx.fillStyle = colors[term];

            ctx.beginPath();
            ctx.arc(xB, 0, 5, 0, Math.PI * 2);
            ctx.fill();

            const bottomY = h - 2;
            ctx.beginPath();
            ctx.arc(xA, bottomY, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(xC, bottomY, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = colors[term];
            ctx.font = "11px Inter, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(term, xB, 15);
        }

        ctx.fillStyle = colorTxt;
        ctx.font = "10px Inter, system-ui, sans-serif";
        ctx.textAlign = "left";
        for (let i = 0; i <= 10; i++) {
            ctx.fillText(i * 10, (w * i) / 10 + 3, h - 4);
        }
    }

    /* =========================================================
       ИНИЦИАЛИЗАЦИЯ
       1. Применяет overrides к Fuzzy.MF.
       2. Проверяет синхронизацию.
       3. Если что-то не так — автоочистка битых overrides.
       ========================================================= */
    function init() {
        applyOverrides();

        if (typeof Fuzzy === "undefined" || !Fuzzy.MF) {
            // Fuzzy ещё не загружен — ничего не делаем
            return;
        }

        const ok = checkSyncWithFuzzy(true);

        if (!ok) {
            console.warn(
                "[MFEditor] Обнаружено расхождение — автоочистка fp_mf_overrides",
            );
            Storage.remove(STORAGE_KEY);
            resetToDefaults();

            const stillBroken = !checkSyncWithFuzzy(true);
            if (stillBroken) {
                console.error(
                    "[MFEditor] Даже после сброса DEFAULTS не совпадают с Fuzzy.MF. Проверьте код fuzzy.js.",
                );
            } else {
                console.log(
                    "[MFEditor] Автоочистка выполнена, MF сброшены к DEFAULTS ✓",
                );
            }
        } else {
            checkSyncWithFuzzy(false);
        }
    }

    /* =========================================================
       ПУБЛИЧНЫЙ API
       ========================================================= */
    return {
        render,
        selectVar,
        updateTri,
        resetVar,
        resetAll,
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
