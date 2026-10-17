const Landing = (() => {
    let inited = false;

    function show() {
        const landing = document.getElementById("landingScreen");
        const auth = document.getElementById("authScreen");
        const app = document.getElementById("app");

        if (landing) landing.style.display = "flex";
        if (auth) auth.style.display = "none";
        if (app) app.style.display = "none";

        if (!inited) {
            inited = true;
            initSliders();
            initCounters();
            initScrollReveal();
            pickRole("student");
        }
    }

    function hide() {
        const landing = document.getElementById("landingScreen");
        if (landing) landing.style.display = "none";
    }

    function pickRole(role) {
        document.querySelectorAll(".landing-role-tabs button").forEach((b) => {
            b.classList.toggle("active", b.dataset.role === role);
        });
        renderRole(role);
    }

    function renderRole(role) {
        const box = document.getElementById("landingRoleContent");
        if (!box) return;

        const data = {
            student: {
                title: "Студенту",
                features: [
                    "Создание и ведение курсовой или диплома",
                    "Канбан-доска: этапы, задачи, дедлайны",
                    "Загрузка версий и проверка ГОСТ (.docx)",
                    "Запись на консультации к руководителю",
                    "Персональный нечёткий профиль и статистика",
                    "Календарь дедлайнов и история активности",
                ],
                role: "student",
                cta: "Войти как студент",
            },
            teacher: {
                title: "Преподавателю",
                features: [
                    "Заявки от студентов на руководство",
                    "Проверка работ, задач и версий документов",
                    "Оценка оригинальности и соответствия ГОСТ",
                    "Рейтинги и нагрузка по студентам",
                    "Аналитика по группе с графиками",
                    "Консультации: подтверждение и перенос",
                ],
                role: "teacher",
                cta: "Войти как преподаватель",
            },
            admin: {
                title: "Администратору",
                features: [
                    "Управление пользователями и ролями",
                    "Полная аналитика по кафедрам и группам",
                    "Редактор правил нечёткого вывода",
                    "Настройка функций принадлежности (ФП)",
                    "Справочники, объявления, уведомления",
                    "Экспорт отчётов PDF и CSV, резервные копии",
                ],
                role: "admin",
                cta: "Войти как администратор",
            },
        };

        const r = data[role];
        if (!r) return;

        box.innerHTML = `
            <div class="role-content-title">${r.title}</div>
            <ul class="role-content-list">
                ${r.features.map((f) => `<li>${f}</li>`).join("")}
            </ul>
            <button class="btn-primary" onclick="Auth.demoLogin('${r.role}')">
                ${r.cta}
            </button>
        `;
    }

    function initSliders() {
        const progress = document.getElementById("demoProgress");
        const days = document.getElementById("demoDays");
        const activity = document.getElementById("demoActivity");
        if (!progress || !days || !activity) return;

        const update = () => {
            const p = +progress.value;
            const d = +days.value;
            const a = +activity.value;

            const pv = document.getElementById("demoProgressVal");
            const dv = document.getElementById("demoDaysVal");
            const av = document.getElementById("demoActivityVal");
            if (pv) pv.textContent = p + "%";
            if (dv) dv.textContent = d;
            if (av) av.textContent = a;

            if (typeof Utils === "undefined" || !Utils.safeFuzzyInfer) return;

            const inputs = {
                progress: p,
                days: d,
                activity: a,
                edits: 0,
                volume: p,
                orig: null,
                supScore: null,
                gost: null,
            };

            const res = Utils.safeFuzzyInfer(inputs);
            if (!res) return;

            updateResult("demoRisk", res.risk, true);
            updateResult("demoReady", res.ready, false);
            updateResult("demoRating", res.rating, false);
        };

        progress.oninput = update;
        days.oninput = update;
        activity.oninput = update;
        update();
    }

    function updateResult(prefix, data, higherIsBad) {
        const card = document.getElementById(prefix + "Card");
        const val = document.getElementById(prefix + "Val");
        const term = document.getElementById(prefix + "Term");
        if (!card || !val || !term) return;

        val.textContent = data.value.toFixed(0);

        const label =
            data.term === "low"
                ? "низкий"
                : data.term === "med"
                  ? "средний"
                  : "высокий";
        term.textContent = label;

        let color;
        if (higherIsBad) {
            color =
                data.term === "high"
                    ? "bad"
                    : data.term === "med"
                      ? "warn"
                      : "ok";
        } else {
            color =
                data.term === "high"
                    ? "ok"
                    : data.term === "med"
                      ? "warn"
                      : "bad";
        }

        card.className = "demo-result-card demo-card-" + color;
        val.style.color = "var(--" + color + ")";
    }

    function initCounters() {
        const stats = document.querySelectorAll("[data-count]");
        stats.forEach((el) => {
            const target = +el.dataset.count;
            if (!target) return;
            let current = 0;
            const step = Math.max(1, target / 30);
            const timer = setInterval(() => {
                current += step;
                if (current >= target) {
                    el.textContent = target;
                    clearInterval(timer);
                } else {
                    el.textContent = Math.floor(current);
                }
            }, 30);
        });
    }

    function initScrollReveal() {
        const sections = document.querySelectorAll(".landing-section");
        if (!("IntersectionObserver" in window)) {
            sections.forEach((s) => s.classList.add("revealed"));
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("revealed");
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12 },
        );

        sections.forEach((s) => observer.observe(s));
    }

    return {
        show,
        hide,
        pickRole,
    };
})();
