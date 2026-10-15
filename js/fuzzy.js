/* =========================================================
   FUZZY — нечёткая логика Мамдани
   Обновлено: точность defuzzify, обработка отсутствующих данных,
   экспорт THRESHOLDS
   ========================================================= */
const Fuzzy = (() => {
    /* =========================================================
       ТРЕУГОЛЬНАЯ ФП
       Корректная обработка границ и вырожденных случаев
       ========================================================= */
    function trimf(x, a, b, c) {
        if (typeof x !== "number" || isNaN(x)) return 0;

        /* Вырожденные случаи: a == b или b == c */
        if (x === a && a === b) return 1;
        if (x === c && b === c) return 1;

        /* Вне треугольника */
        if (x <= a || x >= c) return 0;

        /* Пик */
        if (x === b) return 1;

        /* Левый или правый склон */
        return x < b ? (x - a) / (b - a) : (c - x) / (c - b);
    }

    /* =========================================================
       ФУНКЦИИ ПРИНАДЛЕЖНОСТИ ВХОДОВ
       ========================================================= */
    const MF = {
        progress: {
            low: (x) => trimf(x, 0, 0, 50),
            med: (x) => trimf(x, 25, 50, 75),
            high: (x) => trimf(x, 50, 100, 100),
        },
        days: {
            low: (x) => trimf(x, 0, 0, 20),
            med: (x) => trimf(x, 10, 25, 40),
            high: (x) => trimf(x, 30, 60, 60),
        },
        activity: {
            low: (x) => trimf(x, 0, 0, 5),
            med: (x) => trimf(x, 3, 5, 8),
            high: (x) => trimf(x, 6, 10, 10),
        },
        edits: {
            low: (x) => trimf(x, 0, 0, 5),
            med: (x) => trimf(x, 3, 8, 13),
            high: (x) => trimf(x, 10, 20, 20),
        },
        volume: {
            low: (x) => trimf(x, 0, 0, 50),
            med: (x) => trimf(x, 30, 55, 80),
            high: (x) => trimf(x, 70, 100, 100),
        },
        orig: {
            low: (x) => trimf(x, 0, 0, 55),
            med: (x) => trimf(x, 40, 65, 85),
            high: (x) => trimf(x, 75, 100, 100),
        },
        supScore: {
            low: (x) => trimf(x, 0, 0, 5),
            med: (x) => trimf(x, 3, 5, 8),
            high: (x) => trimf(x, 6, 10, 10),
        },
        gost: {
            low: (x) => trimf(x, 0, 0, 60),
            med: (x) => trimf(x, 45, 70, 85),
            high: (x) => trimf(x, 75, 100, 100),
        },
    };

    /* =========================================================
       ВЫХОДНЫЕ ТЕРМЫ
       ========================================================= */
    const OUT = {
        risk: {
            low: (x) => trimf(x, 0, 0, 40),
            med: (x) => trimf(x, 30, 50, 70),
            high: (x) => trimf(x, 60, 100, 100),
        },
        ready: {
            low: (x) => trimf(x, 0, 0, 40),
            med: (x) => trimf(x, 30, 50, 70),
            high: (x) => trimf(x, 60, 100, 100),
        },
        rating: {
            low: (x) => trimf(x, 0, 0, 40),
            med: (x) => trimf(x, 30, 50, 70),
            high: (x) => trimf(x, 60, 100, 100),
        },
    };

    /* Синглтоны для Сугено */
    const SUGENO_OUTPUTS = {
        risk: { low: 20, med: 50, high: 85 },
        ready: { low: 20, med: 50, high: 85 },
        rating: { low: 20, med: 50, high: 85 },
    };

    /* Границы классификации */
    const THRESHOLDS = { low: 40, high: 65 };

    /* =========================================================
       ПРАВИЛА ПО УМОЛЧАНИЮ
       ========================================================= */
    function defaultRules() {
        return [
            {
                id: 1,
                if: ["progress=low", "days=low"],
                then: "risk=high",
                enabled: true,
                desc: "Низкий прогресс и мало дней — высокий риск",
            },
            {
                id: 2,
                if: ["progress=low", "activity=low"],
                then: "risk=high",
                enabled: true,
                desc: "Низкий прогресс и низкая активность — высокий риск",
            },
            {
                id: 3,
                if: ["edits=high"],
                then: "risk=high",
                enabled: true,
                desc: "Много правок — высокий риск",
            },
            {
                id: 4,
                if: ["progress=high", "days=high"],
                then: "risk=low",
                enabled: true,
                desc: "Высокий прогресс и запас дней — низкий риск",
            },
            {
                id: 5,
                if: ["activity=high", "edits=low"],
                then: "risk=low",
                enabled: true,
                desc: "Активный студент и мало правок — низкий риск",
            },
            {
                id: 6,
                if: ["progress=med"],
                then: "risk=med",
                enabled: true,
                desc: "Средний прогресс — средний риск",
            },
            {
                id: 7,
                if: ["volume=high", "orig=high", "gost=high"],
                then: "ready=high",
                enabled: true,
                desc: "Высокий объём, оригинальность и ГОСТ — высокая готовность",
            },
            {
                id: 8,
                if: ["volume=low", "orig=low"],
                then: "ready=low",
                enabled: true,
                desc: "Малый объём и низкая оригинальность — низкая готовность",
            },
            {
                id: 9,
                if: ["supScore=high", "gost=high"],
                then: "ready=high",
                enabled: true,
                desc: "Высокая оценка и ГОСТ — высокая готовность",
            },
            {
                id: 10,
                if: ["supScore=low"],
                then: "ready=low",
                enabled: true,
                desc: "Низкая оценка руководителя — низкая готовность",
            },
        ];
    }

    function getRules() {
        if (typeof Storage === "undefined") return defaultRules();
        const stored = Storage.getRules();
        if (!Array.isArray(stored)) return defaultRules();

        /* Починка bad-термов */
        stored.forEach((r) => {
            if (r.then === "risk=medium") r.then = "risk=med";
            if (r.then === "ready=medium") r.then = "ready=med";
            if (r.then === "rating=medium") r.then = "rating=med";
        });

        return stored;
    }

    /* =========================================================
       СТЕПЕНЬ ИСТИННОСТИ ПРАВИЛА
       ========================================================= */
    function ruleStrength(rule, inputs) {
        if (!rule || !Array.isArray(rule.if)) return 0;
        const vals = rule.if.map((c) => {
            const [v, t] = c.split("=");
            const mf = MF[v];
            if (!mf || !mf[t]) return 0;
            const val = inputs[v];
            if (typeof val !== "number" || isNaN(val)) return 0;
            return mf[t](val);
        });
        return vals.length === 0 ? 0 : Math.min(...vals);
    }

    /* =========================================================
       АГРЕГАЦИЯ
       ========================================================= */
    function aggregate(outVar, rules, inputs) {
        const acc = { low: 0, med: 0, high: 0 };
        const fired = [];
        for (const r of rules) {
            if (!r.enabled) continue;
            const [ov, ot] = r.then.split("=");
            if (ov !== outVar) continue;
            if (!(ot in acc)) continue;
            const s = ruleStrength(r, inputs);
            if (s > 0) {
                acc[ot] = Math.max(acc[ot], s);
                fired.push({ rule: r, strength: s });
            }
        }
        return { acc, fired };
    }

    /* =========================================================
       ДЕФАЗЗИФИКАЦИЯ (центр тяжести)
       Шаг интегрирования 0.25 — точнее
       ========================================================= */
    function defuzzify(outVar, acc) {
        const outMF = OUT[outVar];
        if (!outMF) return 0;

        let num = 0;
        let den = 0;
        const STEP = 0.25;

        for (let x = 0; x <= 100; x += STEP) {
            let mu = 0;
            for (const t of ["low", "med", "high"]) {
                mu = Math.max(mu, Math.min(acc[t], outMF[t](x)));
            }
            num += x * mu * STEP;
            den += mu * STEP;
        }
        return den === 0 ? 0 : num / den;
    }

    /* =========================================================
       КЛАССИФИКАЦИЯ И МЕТКИ
       ========================================================= */
    function classify(v) {
        return v < THRESHOLDS.low
            ? "low"
            : v < THRESHOLDS.high
              ? "med"
              : "high";
    }

    function termLabel(term, kind) {
        const map = {
            low: { risk: "низкий", ready: "низкая", rating: "низкий" },
            med: { risk: "средний", ready: "средняя", rating: "средний" },
            high: { risk: "высокий", ready: "высокая", rating: "высокий" },
        };
        const row = map[term] || map.med;
        return row[kind] || "—";
    }

    /* =========================================================
       ОСНОВНОЙ ВЫВОД
       ========================================================= */
    function infer(inputs) {
        if (!inputs || typeof inputs !== "object") {
            return {
                risk: {
                    value: 0,
                    term: "low",
                    fired: [],
                    acc: { low: 0, med: 0, high: 0 },
                },
                ready: {
                    value: 0,
                    term: "low",
                    fired: [],
                    acc: { low: 0, med: 0, high: 0 },
                },
                rating: {
                    value: 0,
                    term: "low",
                    fired: [],
                    acc: { low: 0, med: 0, high: 0 },
                },
            };
        }

        const rules = getRules();
        const r = aggregate("risk", rules, inputs);
        const g = aggregate("ready", rules, inputs);
        const t = aggregate("rating", rules, inputs);

        const rv = defuzzify("risk", r.acc);
        const gv = defuzzify("ready", g.acc);
        const tv = defuzzify("rating", t.acc);

        return {
            risk: { value: rv, term: classify(rv), fired: r.fired, acc: r.acc },
            ready: {
                value: gv,
                term: classify(gv),
                fired: g.fired,
                acc: g.acc,
            },
            rating: {
                value: tv,
                term: classify(tv),
                fired: t.fired,
                acc: t.acc,
            },
        };
    }

    /* =========================================================
       РЕКОМЕНДАЦИЯ
       ========================================================= */
    function recommendation(inputs, res) {
        if (!res) return "";
        let rec = "";
        if (res.risk.term === "high") {
            rec =
                "Риск высокий. Срочно свяжитесь с руководителем и пересмотрите план этапов.";
        } else if (res.risk.term === "med") {
            rec =
                "Средний риск. Рекомендуется промежуточная проверка и корректировка графика.";
        } else {
            rec = "Риск низкий. Придерживайтесь текущего плана.";
        }

        if (res.ready.term === "low") {
            rec +=
                " Готовность низкая: увеличьте объём, оригинальность и проверьте оформление по ГОСТу.";
        } else if (res.ready.term === "high") {
            rec += " Готовность высокая — можно готовиться к защите.";
        }

        return rec;
    }

    /* =========================================================
       СУГЕНО
       ========================================================= */
    function sugenoInfer(inputs) {
        if (!inputs || typeof inputs !== "object") {
            return {
                risk: { value: 0, term: "low", fired: [] },
                ready: { value: 0, term: "low", fired: [] },
                rating: { value: 0, term: "low", fired: [] },
            };
        }

        const rules = getRules();

        function calc(outVar) {
            let num = 0,
                den = 0;
            const fired = [];
            const outValues = SUGENO_OUTPUTS[outVar];

            for (const r of rules) {
                if (!r.enabled) continue;
                const [ov, ot] = r.then.split("=");
                if (ov !== outVar) continue;
                if (!(ot in outValues)) continue;

                const s = ruleStrength(r, inputs);
                if (s > 0) {
                    const z = outValues[ot];
                    num += s * z;
                    den += s;
                    fired.push({ rule: r, strength: s, value: z });
                }
            }
            return { value: den === 0 ? 0 : num / den, fired };
        }

        const r = calc("risk");
        const g = calc("ready");
        const t = calc("rating");

        return {
            risk: { value: r.value, term: classify(r.value), fired: r.fired },
            ready: { value: g.value, term: classify(g.value), fired: g.fired },
            rating: { value: t.value, term: classify(t.value), fired: t.fired },
        };
    }

    /* =========================================================
       ЧЁТКАЯ ФОРМУЛА (baseline для сравнения)
       ========================================================= */
    function crispInfer(inputs) {
        if (!inputs || typeof inputs !== "object") inputs = {};
        const clamp = (v) => Math.max(0, Math.min(100, v));

        const riskRaw =
            (100 - (inputs.progress || 0)) * 0.35 +
            (60 - Math.min(inputs.days || 0, 60)) * 0.8 +
            (10 - (inputs.activity || 0)) * 3 +
            Math.min(inputs.edits || 0, 20) * 1.5;

        const readyRaw =
            (inputs.volume || 0) * 0.3 +
            (inputs.orig || 0) * 0.25 +
            (inputs.gost || 0) * 0.2 +
            (inputs.supScore || 0) * 2.5;

        const ratingRaw =
            (inputs.progress || 0) * 0.3 +
            (inputs.activity || 0) * 4 +
            (inputs.orig || 0) * 0.2 +
            (inputs.supScore || 0) * 3;

        return {
            risk: { value: clamp(riskRaw), term: classify(clamp(riskRaw)) },
            ready: { value: clamp(readyRaw), term: classify(clamp(readyRaw)) },
            rating: {
                value: clamp(ratingRaw),
                term: classify(clamp(ratingRaw)),
            },
        };
    }

    /* =========================================================
       ОБЪЯСНЕНИЕ
       ========================================================= */
    const VAR_LABELS = {
        progress: { label: "Прогресс", unit: "%" },
        days: { label: "Дней до дедлайна", unit: "дн." },
        activity: { label: "Активность", unit: "" },
        edits: { label: "Правок", unit: "" },
        volume: { label: "Объём", unit: "%" },
        orig: { label: "Оригинальность", unit: "%" },
        supScore: { label: "Оценка руководителя", unit: "" },
        gost: { label: "Соответствие ГОСТу", unit: "%" },
    };

    const TERM_LABELS = {
        low: {
            progress: "низкий",
            days: "мало",
            activity: "низкая",
            edits: "мало",
            volume: "малый",
            orig: "низкая",
            supScore: "низкая",
            gost: "низкое",
        },
        med: {
            progress: "средний",
            days: "средне",
            activity: "средняя",
            edits: "средне",
            volume: "средний",
            orig: "средняя",
            supScore: "средняя",
            gost: "среднее",
        },
        high: {
            progress: "высокий",
            days: "много",
            activity: "высокая",
            edits: "много",
            volume: "большой",
            orig: "высокая",
            supScore: "высокая",
            gost: "высокое",
        },
    };

    function dominantTerm(varName, value) {
        let best = "med";
        let bestMu = 0;
        const mf = MF[varName];
        if (!mf) return { term: best, mu: 0 };

        for (const t of ["low", "med", "high"]) {
            const mu = mf[t] ? mf[t](value) : 0;
            if (mu > bestMu) {
                bestMu = mu;
                best = t;
            }
        }
        return { term: best, mu: bestMu };
    }

    function escapeHtml(str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function explain(inputs, result) {
        if (!inputs || !result) return "";
        const riskTerm = result.risk.term;
        const riskWord =
            riskTerm === "high"
                ? "высокий"
                : riskTerm === "med"
                  ? "средний"
                  : "низкий";
        const readyWord =
            result.ready.term === "high"
                ? "высокая"
                : result.ready.term === "med"
                  ? "средняя"
                  : "низкая";

        const intro =
            `<b>Риск ${riskWord}</b> (${result.risk.value.toFixed(0)}/100), ` +
            `<b>готовность ${readyWord}</b> (${result.ready.value.toFixed(0)}/100).`;

        const contributions = [];
        for (const varName of ["progress", "days", "activity", "edits"]) {
            const v = inputs[varName] ?? 0;
            const dt = dominantTerm(varName, v);
            const lbl = VAR_LABELS[varName].label.toLowerCase();
            const term = TERM_LABELS[dt.term][varName];
            const unit = VAR_LABELS[varName].unit;
            contributions.push(
                `${lbl} — <b>${term}</b> (${v}${unit ? " " + unit : ""})`,
            );
        }

        const riskFired = (result.risk.fired || [])
            .filter((f) => f.rule.then.startsWith("risk="))
            .sort((a, b) => b.strength - a.strength)
            .slice(0, 3);

        let rec;
        if (riskTerm === "high") {
            rec =
                "Требуется срочная консультация с руководителем и пересмотр плана этапов.";
        } else if (riskTerm === "med") {
            rec =
                "Рекомендуется промежуточная проверка прогресса и корректировка сроков.";
        } else {
            rec = "Можно придерживаться текущего плана.";
        }

        const cls =
            riskTerm === "high" ? "bad" : riskTerm === "med" ? "warn" : "ok";

        let html = `<div class="explain ${cls}">
      <p>${intro}</p>
      <p style="margin-top:10px;"><b>Ключевые факторы:</b></p>
      <ul>${contributions.map((c) => `<li>${c}</li>`).join("")}</ul>`;

        if (riskFired.length > 0) {
            html += `<p style="margin-top:10px;"><b>Сработавшие правила (риск):</b></p>
        <ul>${riskFired
            .map(
                (f) =>
                    `<li>Правило #${f.rule.id}: «${escapeHtml(f.rule.desc)}» — сила <b>${f.strength.toFixed(2)}</b></li>`,
            )
            .join("")}</ul>`;
        } else {
            html += `<p style="margin-top:10px;color:var(--txt-muted);">Ни одно правило риска не сработало напрямую.</p>`;
        }

        html += `<p style="margin-top:10px;"><b>Рекомендация:</b> ${rec}</p>
    </div>`;

        return html;
    }

    /* =========================================================
       ПУБЛИЧНЫЙ API
       ========================================================= */
    return {
        MF,
        OUT,
        SUGENO_OUTPUTS,
        THRESHOLDS,
        defaultRules,
        getRules,
        infer,
        sugenoInfer,
        crispInfer,
        explain,
        dominantTerm,
        classify,
        termLabel,
        recommendation,
        trimf,
    };
})();
