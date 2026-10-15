/* =========================================================
   DEMO STUDENT LIVE — реальная автодемонстрация функционала студента
   Все действия выполняются по-настоящему: клики, ввод, создание.
   ========================================================= */
const DemoStudentLive = (() => {
    let state = {
        active: false,
        paused: false,
        skipRequested: false,
        stepIndex: 0,
        steps: [],
        timers: [],
        typingTimerId: null,
        createdWorkId: null,
        createdStageId: null,
        createdTaskId: null,
    };

    /* =========================================================
       УТИЛИТЫ
       ========================================================= */
    function sleep(ms, interruptible = true) {
        return new Promise((resolve) => {
            if (interruptible && state.skipRequested) {
                state.skipRequested = false;
                return resolve();
            }

            const id = setTimeout(() => {
                removeTimer(id);
                if (interruptible && state.skipRequested) {
                    state.skipRequested = false;
                }
                resolve();
            }, ms);

            state.timers.push({ id, resolve, interruptible });
        });
    }

    function removeTimer(id) {
        state.timers = state.timers.filter((t) => t.id !== id);
    }

    function interruptSleeps() {
        const timers = [...state.timers];
        state.timers = [];
        timers.forEach((t) => {
            clearTimeout(t.id);
            if (t.resolve) t.resolve();
        });
    }

    async function waitWhilePaused() {
        while (state.paused && state.active) {
            await new Promise((r) => setTimeout(r, 150));
        }
    }

    function log(msg) {
        console.log(`[ДЕМО] ${msg}`);
    }

    async function waitForElement(selector, maxWait = 4000) {
        const start = Date.now();
        while (Date.now() - start < maxWait) {
            if (!state.active) return null;
            const el = document.querySelector(selector);
            if (el) return el;
            await sleep(100, false);
        }
        return null;
    }

    async function moveCursorTo(element, offsetX = 14, offsetY = 14) {
        if (!element || !state.active) return;

        element.scrollIntoView({ behavior: "smooth", block: "center" });
        await sleep(450);
        await waitWhilePaused();

        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2 + offsetX - 19;
        const y = rect.top + rect.height / 2 + offsetY - 19;

        const cursor = document.getElementById("demoCursor");
        if (cursor) cursor.style.transform = `translate(${x}px, ${y}px)`;

        await sleep(900);
        await waitWhilePaused();
    }

    async function realClick(element) {
        if (!element || !state.active) return;

        element.classList.add("demo-target-highlight");

        const cursor = document.getElementById("demoCursor");
        if (cursor) cursor.classList.add("clicking");

        const rect = element.getBoundingClientRect();
        const ripple = document.createElement("div");
        ripple.className = "demo-click-ripple";
        ripple.style.left = rect.left + rect.width / 2 - 12 + "px";
        ripple.style.top = rect.top + rect.height / 2 - 12 + "px";
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 800);

        await sleep(200);

        try {
            element.click();
        } catch (e) {
            log(`Ошибка клика: ${e.message}`);
        }

        if (cursor) cursor.classList.remove("clicking");

        await sleep(400);

        setTimeout(
            () => element.classList.remove("demo-target-highlight"),
            1200,
        );

        await sleep(350);
        await waitWhilePaused();
    }

    async function typeIntoInput(input, text, speed = 18) {
        if (!input || !state.active) return;
        input.focus();
        input.value = "";

        for (let i = 0; i < text.length; i++) {
            if (!state.active || state.skipRequested) break;
            await waitWhilePaused();
            input.value += text[i];
            input.dispatchEvent(new Event("input", { bubbles: true }));
            await sleep(speed, false);
        }
        input.blur();
    }

    function typePanelText(text) {
        return new Promise((resolve) => {
            const el = document.getElementById("demoLiveText");
            if (!el) return resolve();

            if (state.typingTimerId) clearInterval(state.typingTimerId);

            el.innerHTML =
                '<span id="liveTypedContent"></span><span class="cursor"></span>';
            const content = document.getElementById("liveTypedContent");
            if (!content) return resolve();

            let i = 0;
            state.typingTimerId = setInterval(() => {
                if (!state.active) {
                    clearInterval(state.typingTimerId);
                    state.typingTimerId = null;
                    return resolve();
                }
                if (state.paused) return;
                if (state.skipRequested) {
                    content.textContent = text;
                    clearInterval(state.typingTimerId);
                    state.typingTimerId = null;
                    return resolve();
                }

                if (i < text.length) {
                    content.textContent += text[i];
                    i++;
                } else {
                    clearInterval(state.typingTimerId);
                    state.typingTimerId = null;
                    resolve();
                }
            }, 16);
        });
    }

    /* =========================================================
       СЦЕНАРИЙ
       ========================================================= */
    function buildSteps() {
        return [
            {
                title: "Приветствие",
                text: "Привет! Сейчас я покажу возможности системы для роли «Студент». Все действия будут реальными — система сама создаст работу, этапы, задачи и версии документа.",
                action: async () => {
                    App.navigate("dashboard");
                    await sleep(600);
                },
                wait: 2400,
            },
            {
                title: "Дашборд",
                text: "Это ваш главный экран. Здесь отображаются все ваши работы, их прогресс, а также результаты нечёткого вывода по каждому проекту.",
                action: async () => {
                    const nav = document.querySelector(
                        '.app-nav button[data-view="dashboard"]',
                    );
                    if (nav) {
                        await moveCursorTo(nav);
                        await realClick(nav);
                    }
                    await sleep(700);
                },
                wait: 2200,
            },
            {
                title: "Создание работы",
                text: "У студента нет работы — создам её прямо сейчас. Нажимаю «Создать работу».",
                condition: () => {
                    const u = Auth.getUser();
                    return u && Storage.getWorksByStudent(u.id).length === 0;
                },
                action: async () => {
                    const buttons = Array.from(
                        document.querySelectorAll("button"),
                    );
                    const createBtn = buttons.find(
                        (b) =>
                            b.textContent.trim().includes("Создать работу") &&
                            !b.classList.contains("demo-launch-btn"),
                    );
                    if (createBtn) {
                        await moveCursorTo(createBtn);
                        await realClick(createBtn);
                    } else {
                        App.navigate("create-work");
                    }
                    await sleep(900);
                },
                wait: 1800,
            },
            {
                title: "Заполняю тему работы",
                text: "Ввожу тему — она должна быть содержательной, минимум 10 символов.",
                condition: () => {
                    const u = Auth.getUser();
                    return u && Storage.getWorksByStudent(u.id).length === 0;
                },
                action: async () => {
                    const topicInput = await waitForElement("#w_topic");
                    if (!topicInput) return log("Поле #w_topic не найдено");
                    await moveCursorTo(topicInput);
                    await typeIntoInput(
                        topicInput,
                        "Информационная система управления проектами на основе нечёткой логики Мамдани",
                    );
                    log("Тема введена");
                    await sleep(300);
                },
                wait: 1000,
            },
            {
                title: "Аннотация и задачи",
                text: "Заполняю аннотацию — краткое описание работы. Его увидит руководитель при рассмотрении заявки.",
                condition: () => {
                    const u = Auth.getUser();
                    return u && Storage.getWorksByStudent(u.id).length === 0;
                },
                action: async () => {
                    const ann = document.getElementById("w_annotation");
                    if (ann) {
                        await moveCursorTo(ann);
                        await typeIntoInput(
                            ann,
                            "Разработка информационной системы с применением нечёткого логического вывода для оценки рисков и готовности студенческих работ.",
                        );
                    }
                    await sleep(250);

                    const goal = document.getElementById("w_goal");
                    if (goal) {
                        goal.value =
                            "Разработать ИС на основе алгоритма Мамдани";
                        goal.dispatchEvent(new Event("input"));
                    }

                    const tasks = document.getElementById("w_tasks");
                    if (tasks) {
                        tasks.value =
                            "Изучить предметную область\nСпроектировать архитектуру\nРеализовать прототип\nПровести тестирование";
                        tasks.dispatchEvent(new Event("input"));
                    }

                    const deadline = document.getElementById("w_deadline");
                    if (deadline) {
                        const d = new Date();
                        d.setDate(d.getDate() + 30);
                        deadline.value = d.toISOString().slice(0, 10);
                        deadline.dispatchEvent(new Event("input"));
                    }
                    await sleep(500);
                },
                wait: 1200,
            },
            {
                title: "Выбираю руководителя",
                text: "Кликом выбираю преподавателя. Система показывает его текущую загрузку — сколько работ он уже ведёт.",
                condition: () => {
                    const u = Auth.getUser();
                    return u && Storage.getWorksByStudent(u.id).length === 0;
                },
                action: async () => {
                    const teacher = await waitForElement(
                        "#teacherList .teacher-item",
                    );
                    if (!teacher) return log("Список преподавателей пуст");
                    await moveCursorTo(teacher);
                    await realClick(teacher);
                    log("Выбран руководитель");
                    await sleep(500);
                },
                wait: 1200,
            },
            {
                title: "Создаю работу",
                text: "Нажимаю «Создать работу» — она отправляется руководителю на утверждение. Работа реально появится в системе.",
                condition: () => {
                    const u = Auth.getUser();
                    return u && Storage.getWorksByStudent(u.id).length === 0;
                },
                action: async () => {
                    const buttons = Array.from(
                        document.querySelectorAll("button"),
                    );
                    const saveBtn = buttons.find(
                        (b) =>
                            b.textContent.trim().includes("Создать работу") &&
                            !b.classList.contains("demo-launch-btn"),
                    );

                    if (saveBtn) {
                        await moveCursorTo(saveBtn);
                        await realClick(saveBtn);
                        await sleep(1000);

                        const u = Auth.getUser();
                        const works = Storage.getWorksByStudent(u.id);
                        if (works.length > 0) {
                            state.createdWorkId = works[works.length - 1].id;
                            log(`✓ РАБОТА СОЗДАНА. ID: ${state.createdWorkId}`);
                        } else {
                            log("✗ Работа НЕ создана");
                        }
                    }
                    await sleep(700);
                },
                wait: 2200,
            },
            {
                title: "Раздел «Моя работа»",
                text: "Открываю страницу работы. Здесь студент управляет этапами, задачами и версиями документа.",
                action: async () => {
                    const nav = document.querySelector(
                        '.app-nav button[data-view="my-work"]',
                    );
                    if (nav) {
                        await moveCursorTo(nav);
                        await realClick(nav);
                    } else {
                        App.navigate("my-work");
                    }
                    await sleep(1000);
                },
                wait: 1800,
            },
            {
                title: "Добавляю этап работы",
                text: "Нажимаю «+ Добавить этап». Сейчас создам первый — «Глава 1. Теоретическая часть».",
                action: async () => {
                    await sleep(500);
                    const buttons = Array.from(
                        document.querySelectorAll("button"),
                    );
                    const addBtn = buttons.find((b) =>
                        b.textContent.includes("Добавить этап"),
                    );
                    if (addBtn) {
                        await moveCursorTo(addBtn);
                        await realClick(addBtn);
                        log("Модалка открыта");
                    } else {
                        log("Кнопка «Добавить этап» не найдена");
                    }
                    await sleep(700);
                },
                wait: 1800,
            },
            {
                title: "Заполняю этап",
                text: "Пишу название этапа, описание, дедлайн и вес. Вес влияет на общий прогресс работы.",
                action: async () => {
                    const nameInput = await waitForElement("#st_name");
                    if (nameInput) {
                        await moveCursorTo(nameInput);
                        await typeIntoInput(
                            nameInput,
                            "Глава 1. Теоретическая часть",
                        );
                    }

                    const desc = document.getElementById("st_desc");
                    if (desc) {
                        desc.value =
                            "Обзор литературы по теме, анализ существующих решений";
                        desc.dispatchEvent(new Event("input"));
                    }

                    const deadline = document.getElementById("st_deadline");
                    if (deadline) {
                        const d = new Date();
                        d.setDate(d.getDate() + 10);
                        deadline.value = d.toISOString().slice(0, 10);
                    }

                    const weight = document.getElementById("st_weight");
                    if (weight) weight.value = 2;

                    await sleep(500);
                },
                wait: 1200,
            },
            {
                title: "Сохраняю этап",
                text: "Нажимаю «Создать» — этап добавляется в работу. Прогресс работы пересчитывается автоматически.",
                action: async () => {
                    const modal = document.querySelector(".modal");
                    if (!modal) return log("Модалка не найдена");

                    const buttons = Array.from(
                        modal.querySelectorAll("button"),
                    );
                    const saveBtn = buttons.find((b) =>
                        b.textContent.trim().includes("Создать"),
                    );

                    if (saveBtn) {
                        await moveCursorTo(saveBtn);
                        await realClick(saveBtn);
                        await sleep(1000);

                        const u = Auth.getUser();
                        const works = Storage.getWorksByStudent(u.id);
                        const work = works[0];
                        const stages = Storage.getStagesByWork(work.id);
                        if (stages.length > 0) {
                            state.createdStageId = stages[stages.length - 1].id;
                            log(`✓ ЭТАП СОЗДАН. Всего: ${stages.length}`);
                        }
                    }
                    await sleep(700);
                },
                wait: 1800,
            },
            {
                title: "Отмечаю выполнение",
                text: "Кликом по кружку отмечаю этап выполненным. Прогресс сразу пересчитается.",
                action: async () => {
                    await sleep(500);
                    const check = await waitForElement(".stage-check");
                    if (check) {
                        await moveCursorTo(check);
                        await realClick(check);
                        log("Этап отмечен выполненным");
                    }
                    await sleep(1000);
                },
                wait: 1800,
            },
            {
                title: "Нечёткий вывод Мамдани",
                text: "Открываю раздел «Мамдани» — здесь видно, как работает ядро системы.",
                action: async () => {
                    const nav = document.querySelector(
                        '.app-nav button[data-view="mamdani"]',
                    );
                    if (nav) {
                        await moveCursorTo(nav);
                        await realClick(nav);
                    }
                    await sleep(1200);
                },
                wait: 2200,
            },
            {
                title: "Пайплайн вывода",
                text: "Пять этапов: фаззификация, применение правил, агрегация, дефаззификация и итоговый результат.",
                action: async () => {
                    const pipeline = document.querySelector(".pipeline");
                    if (pipeline) await moveCursorTo(pipeline);
                    await sleep(500);
                },
                wait: 2200,
            },
            {
                title: "Сработавшие правила",
                text: "Открываю вкладку правил. Видно, какие правила активировались и с какой силой.",
                action: async () => {
                    const tabs = Array.from(
                        document.querySelectorAll(".mamdani-tabs button"),
                    );
                    const rulesTab = tabs.find((t) =>
                        t.textContent.includes("Правила"),
                    );
                    if (rulesTab) {
                        await moveCursorTo(rulesTab);
                        await realClick(rulesTab);
                    }
                    await sleep(800);
                },
                wait: 2500,
            },
            {
                title: "Симулятор «Что если»",
                text: "Раздел «Симулятор» позволяет смоделировать сценарии. Подвину ползунок прогресса — риск изменится.",
                action: async () => {
                    const nav = document.querySelector(
                        '.app-nav button[data-view="simulate"]',
                    );
                    if (nav) {
                        await moveCursorTo(nav);
                        await realClick(nav);
                        await sleep(1200);
                    }

                    const slider = await waitForElement("#s_progress");
                    if (slider) {
                        await moveCursorTo(slider);
                        for (let v = +slider.value; v <= 85; v += 5) {
                            if (state.skipRequested) break;
                            slider.value = v;
                            slider.dispatchEvent(
                                new Event("input", { bubbles: true }),
                            );
                            await sleep(70, false);
                        }
                        log(`Ползунок = ${slider.value}`);
                    }
                    await sleep(1000);
                },
                wait: 2200,
            },
            {
                title: "Статистика",
                text: "Раздел «Статистика» показывает радар нечёткого профиля работы и графики прогресса по этапам.",
                action: async () => {
                    const nav = document.querySelector(
                        '.app-nav button[data-view="stats"]',
                    );
                    if (nav) {
                        await moveCursorTo(nav);
                        await realClick(nav);
                    }
                    await sleep(1500);
                },
                wait: 2200,
            },
            {
                title: "Календарь дедлайнов",
                text: "Календарь показывает все дедлайны: этапы, задачи и дату защиты работы.",
                action: async () => {
                    const nav = document.querySelector(
                        '.app-nav button[data-view="calendar"]',
                    );
                    if (nav) {
                        await moveCursorTo(nav);
                        await realClick(nav);
                    }
                    await sleep(1200);
                },
                wait: 2000,
            },
            {
                title: "Профиль студента",
                text: "В профиле — все личные данные и полный список работ студента.",
                action: async () => {
                    const avatar = document.querySelector(".app-avatar");
                    if (avatar) {
                        await moveCursorTo(avatar);
                        await realClick(avatar);
                    }
                    await sleep(1200);
                },
                wait: 2000,
            },
            {
                title: "Демонстрация завершена",
                text: "Всё, что вы увидели — реальные действия системы. Работа, этапы, отметки — всё создано по-настоящему. Спасибо за внимание!",
                action: async () => {},
                wait: 0,
                finish: true,
            },
        ];
    }

    /* =========================================================
       ЗАПУСК
       ========================================================= */
    async function start() {
        if (state.active) return;

        cleanup();

        state.steps = buildSteps();
        state.stepIndex = 0;
        state.active = true;
        state.paused = false;
        state.skipRequested = false;

        renderCursor();
        renderPanel();
        document.body.classList.add("demo-active");

        log("Демонстрация запущена");

        await runLoop();
    }

    async function runLoop() {
        App.navigate("dashboard");
        await sleep(800);

        for (let i = 0; i < state.steps.length; i++) {
            if (!state.active) return;
            state.stepIndex = i;
            const step = state.steps[i];

            state.skipRequested = false;

            if (step.condition && !step.condition()) continue;

            updatePanel(step, i);

            await typePanelText(step.text);
            await sleep(300);

            if (step.action) {
                try {
                    await step.action();
                } catch (err) {
                    console.warn("[ДЕМО] Ошибка в шаге:", err);
                }
            }

            if (step.finish) {
                showFinish();
                return;
            }

            if (step.wait) await sleep(step.wait);

            await waitWhilePaused();
        }

        showFinish();
    }

    /* =========================================================
       UI
       ========================================================= */
    function renderCursor() {
        if (document.getElementById("demoCursor")) return;
        const c = document.createElement("div");
        c.id = "demoCursor";
        c.style.transform = "translate(-100px, -100px)";
        c.innerHTML = `
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 2 L8 26 L14 20 L20 30 L24 28 L18 18 L26 18 Z"
          fill="#ffffff" stroke="#111111" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    `;
        document.body.appendChild(c);
    }

    function renderPanel() {
        if (document.getElementById("demoLivePanel")) return;
        const p = document.createElement("div");
        p.id = "demoLivePanel";
        p.className = "demo-live-panel";
        p.innerHTML = `
      <div class="demo-live-head">
        <div class="demo-live-step">
          <span class="live-dot"></span>
          <span id="demoLiveStepLabel">Шаг 1</span>
        </div>
        <div class="demo-live-controls">
          <button class="demo-live-ctrl" id="demoLivePause" onclick="DemoStudentLive.togglePause()" title="Пауза">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="6" y="4" width="4" height="16"/>
              <rect x="14" y="4" width="4" height="16"/>
            </svg>
          </button>
          <button class="demo-live-ctrl" onclick="DemoStudentLive.skip()" title="Пропустить шаг">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 4 15 12 5 20 5 4"/>
              <line x1="19" y1="5" x2="19" y2="19"/>
            </svg>
          </button>
          <button class="demo-live-ctrl danger" onclick="DemoStudentLive.stop()" title="Остановить">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="demo-live-title" id="demoLiveTitle">—</div>
      <div class="demo-live-text" id="demoLiveText"></div>
      <div class="demo-live-progress">
        <div class="demo-live-progress-fill" id="demoLiveProgress" style="width:0%"></div>
      </div>
      <div class="demo-live-counter">
        <span>Автодемонстрация · Студент</span>
        <span id="demoLiveCounter">0 / 0</span>
      </div>
    `;
        document.body.appendChild(p);
    }

    function updatePanel(step, index) {
        const total = state.steps.length;
        const stepEl = document.getElementById("demoLiveStepLabel");
        const titleEl = document.getElementById("demoLiveTitle");
        const counterEl = document.getElementById("demoLiveCounter");
        const progressEl = document.getElementById("demoLiveProgress");

        if (stepEl) stepEl.textContent = `Шаг ${index + 1}`;
        if (titleEl) titleEl.textContent = step.title;
        if (counterEl) counterEl.textContent = `${index + 1} / ${total}`;
        if (progressEl)
            progressEl.style.width = ((index + 1) / total) * 100 + "%";
    }

    /* =========================================================
       УПРАВЛЕНИЕ
       ========================================================= */
    function togglePause() {
        state.paused = !state.paused;
        const btn = document.getElementById("demoLivePause");
        if (btn) {
            btn.innerHTML = state.paused
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
        }
        App.toast(state.paused ? "Пауза" : "Продолжаю");
    }

    function skip() {
        state.skipRequested = true;
        interruptSleeps();
        state.paused = false;
        App.toast("Пропускаю шаг");
    }

    function stop() {
        state.active = false;
        state.paused = false;
        state.skipRequested = false;
        interruptSleeps();
        if (state.typingTimerId) clearInterval(state.typingTimerId);
        cleanup();
        App.toast("Демонстрация остановлена");
        log("Демонстрация остановлена пользователем");
    }

    function cleanup() {
        document.body.classList.remove("demo-active");
        ["demoCursor", "demoLivePanel", "demoLiveFinish"].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
        document.querySelectorAll(".demo-target-highlight").forEach((el) => {
            el.classList.remove("demo-target-highlight");
        });
        document
            .querySelectorAll(".demo-click-ripple")
            .forEach((el) => el.remove());
        state.timers = [];
    }

    /* =========================================================
       ФИНАЛ
       ========================================================= */
    function showFinish() {
        state.active = false;
        document.body.classList.remove("demo-active");

        const c = document.getElementById("demoCursor");
        const p = document.getElementById("demoLivePanel");
        if (c) c.remove();
        if (p) p.remove();

        const div = document.createElement("div");
        div.id = "demoLiveFinish";
        div.className = "demo-live-finish";
        div.innerHTML = `
      <div class="demo-live-finish-card">
        <div class="demo-live-finish-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div class="demo-live-finish-title">Демонстрация завершена</div>
        <div class="demo-live-finish-text">
          Все действия были реальными — работа, этапы и отметки созданы
          по-настоящему и сохранены в системе.<br>
          Можете проверить: раздел «Моя работа» содержит созданные данные.
        </div>
        <div class="demo-live-finish-actions">
          <button class="btn-ghost" onclick="DemoStudentLive.close()">Закрыть</button>
          <button class="btn-primary" onclick="DemoStudentLive.restart()">
            <svg viewBox="0 0 24 24" class="icon icon-sm" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            <span>Повторить</span>
          </button>
        </div>
      </div>
    `;
        document.body.appendChild(div);
        log("Демонстрация завершена");
    }

    function close() {
        cleanup();
    }

    function restart() {
        cleanup();
        start();
    }

    /* =========================================================
       ПУБЛИЧНЫЙ API
       ========================================================= */
    return {
        start,
        stop,
        skip,
        togglePause,
        restart,
        close,
        isActive: () => state.active,
    };
})();
