const Fuzzy = (() => {
    /* =========================================================
       ТРЕУГОЛЬНАЯ ФУНКЦИЯ ПРИНАДЛЕЖНОСТИ
       ========================================================= */
    function trimf(x, a, b, c) {
        if (typeof x !== "number" || isNaN(x)) return 0;

        // Точечная функция (единственная точка)
        if (a === b && b === c) {
            return x === a ? 1 : 0;
        }

        // Левый вырожденный: a === b (Z-shape)
        // 1 при x <= a, линейно спадает до 0 при x >= c
        if (a === b) {
            if (x <= a) return 1;
            if (x >= c) return 0;
            return (c - x) / (c - a);
        }

        // Правый вырожденный: b === c (S-shape)
        // 0 при x <= a, линейно растёт до 1 при x >= b
        if (b === c) {
            if (x <= a) return 0;
            if (x >= b) return 1;
            return (x - a) / (b - a);
        }

        // Обычный треугольник
        if (x <= a || x >= c) return 0;
        if (x === b) return 1;
        return x < b ? (x - a) / (b - a) : (c - x) / (c - b);
    }

    /* =========================================================
       ВХОДНЫЕ ПЕРЕМЕННЫЕ
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
       ВЫХОДНЫЕ ПЕРЕМЕННЫЕ
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

    /* =========================================================
       SUGENO
       ========================================================= */
    const SUGENO_OUTPUTS = {
        risk: { low: 20, med: 50, high: 85 },
        ready: { low: 20, med: 50, high: 85 },
        rating: { low: 20, med: 50, high: 85 },
    };

    const THRESHOLDS = { low: 40, high: 65 };

    /* =========================================================
       ПЕРЕМЕННЫЕ, ЗАВИСЯЩИЕ ОТ ПРОВЕРКИ РУКОВОДИТЕЛЯ
       ========================================================= */
    const TEACHER_DEPENDENT = ["orig", "supScore", "gost"];

    /* =========================================================
       БАЗА ПРАВИЛ (40 правил)
       ---------------------------------------------------------
       Risk:    14 правил (id 1-14)  — не зависят от проверки
       Ready:   12 правил (id 15-26) — используют orig/supScore/gost
       Ready:    4 правила (id 27-30) — «якорные», без проверки
       Rating:   8 правил (id 31-38) — используют orig/supScore/gost
       Rating:   2 правила (id 39-40) — «якорные», без проверки
       ========================================================= */
    function defaultRules() {
        return [
            /* ============ RISK: 18 правил ============ */

            /* --- HIGH --- */
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
                if: ["progress=med", "days=low"],
                then: "risk=high",
                enabled: true,
                desc: "Средний прогресс, но сроки поджимают — высокий риск",
            },
            {
                id: 5,
                if: ["activity=low", "days=low"],
                then: "risk=high",
                enabled: true,
                desc: "Низкая активность и мало дней — высокий риск",
            },
            {
                id: 6,
                if: ["progress=low", "days=med"],
                then: "risk=high",
                enabled: true,
                desc: "Низкий прогресс и средние сроки — высокий риск",
            },

            /* --- LOW --- */
            {
                id: 7,
                if: ["progress=high", "days=high"],
                then: "risk=low",
                enabled: true,
                desc: "Высокий прогресс и запас дней — низкий риск",
            },
            {
                id: 8,
                if: ["activity=high", "edits=low"],
                then: "risk=low",
                enabled: true,
                desc: "Активный студент и мало правок — низкий риск",
            },
            {
                id: 9,
                if: ["progress=high", "activity=high"],
                then: "risk=low",
                enabled: true,
                desc: "Высокий прогресс и высокая активность — низкий риск",
            },
            {
                id: 10,
                if: ["days=high", "edits=low"],
                then: "risk=low",
                enabled: true,
                desc: "Много времени и мало правок — низкий риск",
            },
            {
                id: 11,
                if: ["progress=high", "days=med"],
                then: "risk=low",
                enabled: true,
                desc: "Высокий прогресс и средние сроки — низкий риск",
            },
            {
                id: 12,
                if: ["progress=high", "edits=low"],
                then: "risk=low",
                enabled: true,
                desc: "Высокий прогресс и мало правок — низкий риск",
            },

            /* --- MED --- */
            {
                id: 13,
                if: ["progress=med", "days=med"],
                then: "risk=med",
                enabled: true,
                desc: "Средний прогресс и средние сроки — средний риск",
            },
            {
                id: 14,
                if: ["progress=med", "activity=med"],
                then: "risk=med",
                enabled: true,
                desc: "Средний прогресс и средняя активность — средний риск",
            },
            {
                id: 15,
                if: ["progress=med", "edits=med"],
                then: "risk=med",
                enabled: true,
                desc: "Средний прогресс и средние правки — средний риск",
            },
            {
                id: 16,
                if: ["days=med", "activity=med"],
                then: "risk=med",
                enabled: true,
                desc: "Средние сроки и средняя активность — средний риск",
            },
            {
                id: 17,
                if: ["progress=low", "activity=med"],
                then: "risk=med",
                enabled: true,
                desc: "Низкий прогресс, но активность средняя — средний риск",
            },
            {
                id: 18,
                if: ["progress=low", "days=high"],
                then: "risk=med",
                enabled: true,
                desc: "Низкий прогресс, но запас дней — средний риск",
            },

            /* ============ READY: 12 правил с проверкой ============ */
            {
                id: 19,
                if: ["volume=high", "orig=high", "gost=high"],
                then: "ready=high",
                enabled: true,
                desc: "Высокий объём, оригинальность и ГОСТ — высокая готовность",
            },
            {
                id: 20,
                if: ["supScore=high", "gost=high"],
                then: "ready=high",
                enabled: true,
                desc: "Высокая оценка и ГОСТ — высокая готовность",
            },
            {
                id: 21,
                if: ["orig=high", "supScore=high"],
                then: "ready=high",
                enabled: true,
                desc: "Высокая оригинальность и оценка — высокая готовность",
            },
            {
                id: 22,
                if: ["volume=high", "orig=high"],
                then: "ready=high",
                enabled: true,
                desc: "Высокий объём и оригинальность — высокая готовность",
            },

            {
                id: 23,
                if: ["volume=low", "orig=low"],
                then: "ready=low",
                enabled: true,
                desc: "Малый объём и низкая оригинальность — низкая готовность",
            },
            {
                id: 24,
                if: ["supScore=low"],
                then: "ready=low",
                enabled: true,
                desc: "Низкая оценка руководителя — низкая готовность",
            },
            {
                id: 25,
                if: ["gost=low"],
                then: "ready=low",
                enabled: true,
                desc: "Не соответствует ГОСТу — низкая готовность",
            },
            {
                id: 26,
                if: ["orig=low"],
                then: "ready=low",
                enabled: true,
                desc: "Низкая оригинальность — низкая готовность",
            },

            {
                id: 27,
                if: ["orig=med"],
                then: "ready=med",
                enabled: true,
                desc: "Средняя оригинальность — средняя готовность",
            },
            {
                id: 28,
                if: ["gost=med"],
                then: "ready=med",
                enabled: true,
                desc: "Частично соответствует ГОСТу — средняя готовность",
            },
            {
                id: 29,
                if: ["supScore=med"],
                then: "ready=med",
                enabled: true,
                desc: "Средняя оценка руководителя — средняя готовность",
            },
            {
                id: 30,
                if: ["volume=med", "orig=med"],
                then: "ready=med",
                enabled: true,
                desc: "Средний объём и оригинальность — средняя готовность",
            },

            /* ============ READY: 4 «якорных» правила ============ */
            /* Специально ослаблены: дают med, а не high, чтобы не перебивать */
            {
                id: 31,
                if: ["progress=high", "activity=high"],
                then: "ready=med",
                enabled: true,
                desc: "Высокий прогресс и активность — средняя готовность (без оценки)",
            },
            {
                id: 32,
                if: ["progress=high"],
                then: "ready=med",
                enabled: true,
                desc: "Высокий прогресс — средняя готовность (без оценки)",
            },
            {
                id: 33,
                if: ["progress=med"],
                then: "ready=med",
                enabled: true,
                desc: "Средний прогресс — средняя готовность",
            },
            {
                id: 34,
                if: ["progress=low"],
                then: "ready=low",
                enabled: true,
                desc: "Низкий прогресс — низкая готовность",
            },

            /* ============ RATING: 8 правил с проверкой ============ */
            {
                id: 35,
                if: ["progress=high", "supScore=high"],
                then: "rating=high",
                enabled: true,
                desc: "Высокий прогресс и высокая оценка — высокий рейтинг",
            },
            {
                id: 36,
                if: ["orig=high", "gost=high"],
                then: "rating=high",
                enabled: true,
                desc: "Высокая оригинальность и ГОСТ — высокий рейтинг",
            },
            {
                id: 37,
                if: ["supScore=high", "activity=high"],
                then: "rating=high",
                enabled: true,
                desc: "Высокая оценка и активность — высокий рейтинг",
            },

            {
                id: 38,
                if: ["supScore=low"],
                then: "rating=low",
                enabled: true,
                desc: "Низкая оценка руководителя — низкий рейтинг",
            },
            {
                id: 39,
                if: ["orig=low"],
                then: "rating=low",
                enabled: true,
                desc: "Низкая оригинальность — низкий рейтинг",
            },

            {
                id: 40,
                if: ["supScore=med"],
                then: "rating=med",
                enabled: true,
                desc: "Средняя оценка руководителя — средний рейтинг",
            },
            {
                id: 41,
                if: ["orig=med"],
                then: "rating=med",
                enabled: true,
                desc: "Средняя оригинальность — средний рейтинг",
            },
            {
                id: 42,
                if: ["gost=med"],
                then: "rating=med",
                enabled: true,
                desc: "Частично соответствует ГОСТу — средний рейтинг",
            },

            /* ============ RATING: 4 «якорных» правила ============ */
            /* Ослаблены до med, чтобы якорь не перебивал реальные данные */
            {
                id: 43,
                if: ["progress=high", "activity=high"],
                then: "rating=med",
                enabled: true,
                desc: "Высокий прогресс и активность — средний рейтинг (без оценки)",
            },
            {
                id: 44,
                if: ["progress=high"],
                then: "rating=med",
                enabled: true,
                desc: "Высокий прогресс — средний рейтинг (без оценки)",
            },
            {
                id: 45,
                if: ["progress=med"],
                then: "rating=med",
                enabled: true,
                desc: "Средний прогресс — средний рейтинг",
            },
            {
                id: 46,
                if: ["progress=low"],
                then: "rating=low",
                enabled: true,
                desc: "Низкий прогресс — низкий рейтинг",
            },
        ];
    }

    /* =========================================================
       ПРАВИЛА (с миграцией medium → med)
       ========================================================= */
    function getRules() {
        if (typeof Storage === "undefined") return defaultRules();
        const stored = Storage.getRules();
        if (!Array.isArray(stored)) return defaultRules();

        stored.forEach((r) => {
            if (r.then === "risk=medium") r.then = "risk=med";
            if (r.then === "ready=medium") r.then = "ready=med";
            if (r.then === "rating=medium") r.then = "rating=med";
        });

        return stored;
    }

    /* =========================================================
       СИЛА ПРАВИЛА
       ========================================================= */
    function ruleStrength(rule, inputs) {
        if (!rule || !Array.isArray(rule.if)) return 0;
        if (rule.if.length === 0) return 0;

        const vals = [];
        for (const c of rule.if) {
            const [v, t] = c.split("=");
            const mf = MF[v];
            if (!mf || !mf[t]) return 0;

            const val = inputs[v];

            if (val === null || val === undefined) {
                if (TEACHER_DEPENDENT.includes(v)) return 0;
                return 0;
            }

            if (typeof val !== "number" || isNaN(val)) return 0;

            vals.push(mf[t](val));
        }

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
       ДЕФАЗЗИФИКАЦИЯ
       ========================================================= */
    function defuzzify(outVar, acc) {
        const outMF = OUT[outVar];
        if (!outMF) return 0;

        let num = 0;
        let den = 0;
        const STEP = 0.5;

        for (let x = 0; x <= 100; x += STEP) {
            let mu = 0;
            for (const t of ["low", "med", "high"]) {
                const cut = Math.min(acc[t] || 0, outMF[t](x));
                if (cut > mu) mu = cut;
            }
            num += x * mu * STEP;
            den += mu * STEP;
        }

        if (den === 0) return 0;
        const result = num / den;
        return isNaN(result) ? 0 : result;
    }

    /* =========================================================
       КЛАССИФИКАЦИЯ
       ========================================================= */
    function classify(v) {
        if (typeof v !== "number" || isNaN(v)) return "low";
        return v < THRESHOLDS.low
            ? "low"
            : v < THRESHOLDS.high
              ? "med"
              : "high";
    }

    /* =========================================================
       ЯРЛЫКИ
       ========================================================= */
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
       НОРМАЛИЗАЦИЯ
       ========================================================= */
    function normalizeInputs(inputs) {
        return {
            progress: inputs.progress ?? 0,
            days: inputs.days ?? 30,
            activity: inputs.activity ?? 5,
            edits: inputs.edits ?? 0,
            volume: inputs.volume ?? 0,
            orig: inputs.orig ?? null,
            supScore: inputs.supScore ?? null,
            gost: inputs.gost ?? null,
        };
    }

    function emptyResult() {
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

    /* =========================================================
       МАМДАНИ
       ========================================================= */
    function infer(inputs) {
        if (!inputs || typeof inputs !== "object") return emptyResult();

        const normalized = normalizeInputs(inputs);
        const rules = getRules();

        const r = aggregate("risk", rules, normalized);
        const g = aggregate("ready", rules, normalized);
        const t = aggregate("rating", rules, normalized);

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
        if (!inputs || typeof inputs !== "object") return emptyResult();

        const normalized = normalizeInputs(inputs);
        const rules = getRules();

        function calc(outVar) {
            let num = 0;
            let den = 0;
            const fired = [];
            const outValues = SUGENO_OUTPUTS[outVar];

            for (const r of rules) {
                if (!r.enabled) continue;

                const [ov, ot] = r.then.split("=");
                if (ov !== outVar) continue;
                if (!(ot in outValues)) continue;

                const s = ruleStrength(r, normalized);
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
       ЧЁТКАЯ ФОРМУЛА
       ========================================================= */
    function crispInfer(inputs) {
        if (!inputs || typeof inputs !== "object") inputs = {};

        const clamp = (v) => Math.max(0, Math.min(100, v));

        const progress = inputs.progress || 0;
        const days = Math.min(inputs.days || 0, 60);
        const activity = inputs.activity || 0;
        const edits = Math.min(inputs.edits || 0, 20);
        const volume = inputs.volume || 0;
        const orig = inputs.orig ?? 65;
        const supScore = inputs.supScore ?? 5;
        const gost = inputs.gost ?? 70;

        const riskRaw =
            (100 - progress) * 0.35 +
            (60 - days) * 0.8 +
            (10 - activity) * 3 +
            edits * 1.5;

        const readyRaw =
            volume * 0.3 + orig * 0.25 + gost * 0.2 + supScore * 2.5;

        const ratingRaw =
            progress * 0.3 + activity * 4 + orig * 0.2 + supScore * 3;

        const rv = clamp(riskRaw);
        const gv = clamp(readyRaw);
        const tv = clamp(ratingRaw);

        return {
            risk: { value: rv, term: classify(rv) },
            ready: { value: gv, term: classify(gv) },
            rating: { value: tv, term: classify(tv) },
        };
    }

    /* =========================================================
       СЛОВАРИ
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
        if (typeof value !== "number" || isNaN(value)) {
            return { term: best, mu: 0 };
        }

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

    /* =========================================================
       ОБЪЯСНЕНИЕ
       ========================================================= */
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

    function explainRating(inputs, result) {
        if (!inputs || !result) return "";

        const term = result.rating.term;
        const word =
            term === "high" ? "высокий" : term === "med" ? "средний" : "низкий";

        const top = (result.rating.fired || [])
            .sort((a, b) => b.strength - a.strength)
            .slice(0, 3);

        let html = `<div class="explain">
      <p><b>Рейтинг ${word}</b> (${result.rating.value.toFixed(0)}/100).</p>`;

        if (top.length > 0) {
            html += `<p style="margin-top:10px;"><b>Определяющие правила:</b></p>
        <ul>${top
            .map(
                (f) =>
                    `<li>«${escapeHtml(f.rule.desc)}» — сила <b>${f.strength.toFixed(2)}</b></li>`,
            )
            .join("")}</ul>`;
        } else {
            html += `<p style="margin-top:10px;color:var(--txt-muted);">Рейтинг не сформирован — нет данных.</p>`;
        }

        html += `</div>`;
        return html;
    }

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
        explainRating,
        dominantTerm,
        classify,
        termLabel,
        recommendation,
        trimf,
    };
})();
