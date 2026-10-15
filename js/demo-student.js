/* =========================================================
   DEMO STUDENT — автодемонстрация функционала студента
   ========================================================= */
const DemoStudent = (() => {
    /* Состояние демонстрации */
    let state = {
        active: false,
        paused: false,
        stepIndex: 0,
        timeoutId: null,
        typingTimerId: null,
        steps: [],
    };

    /* =========================================================
     СЦЕНАРИЙ ДЕМОНСТРАЦИИ
     ========================================================= */
    function buildSteps() {
        return [
            {
                title: "Добро пожаловать в FuzzyProject",
                text: "Сейчас мы покажем все основные возможности системы для роли «Студент». Это займёт около минуты.",
                view: "dashboard",
                target: null,
                duration: 3500,
            },
            {
                title: "Дашборд — главный экран",
                text: "Здесь отображаются все ваши работы. Студент может вести несколько проектов одновременно — курсовую, дипломную, ВКР.",
                view: "dashboard",
                target: ".work-hero",
                duration: 4500,
            },
            {
                title: "Нечёткая оценка",
                text: "Для каждой работы система автоматически рассчитывает три показателя по алгоритму Мамдани: риск срыва сроков, готовность и рейтинг.",
                view: "dashboard",
                target: ".fuzzy-panel",
                duration: 5000,
            },
            {
                title: "Создание новой работы",
                text: "Раздел «Моя работа» позволяет вести проект: добавлять этапы, ставить задачи, загружать версии документа.",
                view: "my-work",
                target: ".card",
                duration: 4000,
            },
            {
                title: "Этапы работы",
                text: "Студент сам создаёт этапы под свою тему — например, «Глава 1», «Глава 2», «Заключение». Прогресс считается автоматически с учётом веса каждого этапа.",
                view: "my-work",
                target: "#stagesList",
                duration: 5000,
            },
            {
                title: "Канбан-доска задач",
                text: "Задачи распределяются по колонкам: «К выполнению», «В работе», «На проверке», «Готово». Просто перетаскивайте карточки мышью.",
                view: "my-work",
                target: ".kanban",
                duration: 5000,
            },
            {
                title: "Визуализация Мамдани",
                text: "Раздел «Мамдани» показывает весь путь нечёткого вывода: от фаззификации входных данных до дефаззификации через центр тяжести.",
                view: "mamdani",
                target: null,
                duration: 5000,
            },
            {
                title: "Пайплайн вывода",
                text: "Пять шагов: фаззификация, срабатывание правил, агрегация, дефаззификация и итоговый результат. Каждый шаг можно изучить подробно.",
                view: "mamdani",
                target: ".pipeline",
                duration: 5000,
            },
            {
                title: "Сработавшие правила",
                text: "Система показывает, какие правила активировались и с какой степенью истинности (μ). Это делает вывод полностью прозрачным — в отличие от нейросетей.",
                view: "mamdani",
                target: "#firedRules, #vizBody",
                duration: 6000,
            },
            {
                title: "Симулятор «Что если»",
                text: "Раздел «Симулятор» позволяет моделировать сценарии: например, что будет с риском, если студент повысит прогресс или снизит число правок.",
                view: "simulate",
                target: null,
                duration: 5000,
            },
            {
                title: "Проверка ГОСТа",
                text: "Студент загружает .docx-файл — система автоматически проверяет оформление по 8 пунктам: шрифт, поля, интервалы, нумерация страниц.",
                view: "docx",
                target: null,
                duration: 5000,
            },
            {
                title: "Заявки на консультации",
                text: "Студент может предложить руководителю удобное время для консультации — тот подтвердит или отклонит заявку.",
                view: "consultations",
                target: null,
                duration: 4500,
            },
            {
                title: "Статистика",
                text: "Раздел «Статистика» показывает прогресс по этапам в виде графиков: радар нечёткого профиля и диаграмма весов этапов.",
                view: "stats",
                target: null,
                duration: 5000,
            },
            {
                title: "Календарь",
                text: "Календарь с дедлайнами этапов, задач и датой защиты. Срочные события выделяются красным цветом.",
                view: "calendar",
                target: null,
                duration: 4500,
            },
            {
                title: "Завершённые работы",
                text: "После защиты работа уходит в архив. Здесь можно посмотреть итоговую оценку, этапы и скачать PDF-отчёт.",
                view: "archived",
                target: null,
                duration: 4500,
            },
            {
                title: "Профиль",
                text: "В профиле — все личные данные, факультет, группа, направление, а также список всех ваших работ.",
                view: "profile",
                target: null,
                duration: 4000,
            },
            {
                title: "Демонстрация завершена",
                text: "Вы увидели основные возможности системы для роли «Студент». Спасибо за внимание!",
                view: null,
                target: null,
                duration: 4000,
            },
        ];
    }

    /* =========================================================
     ЗАПУСК
     ========================================================= */
    function start() {
        if (state.active) return;

        state.steps = buildSteps();
        state.stepIndex = 0;
        state.active = true;
        state.paused = false;

        renderOverlay();
        runStep();
    }

    /* =========================================================
     ОВЕРЛЕЙ
     ========================================================= */
    function renderOverlay() {
        /* Убираем старое, если было */
        const old = document.getElementById("demoOverlay");
        if (old) old.remove();

        const overlay = document.createElement("div");
        overlay.id = "demoOverlay";
        overlay.className = "demo-overlay";
        overlay.innerHTML = `
      <div class="demo-backdrop"></div>
      <div class="demo-spotlight" id="demoSpotlight" style="display:none;"></div>
      <div class="demo-panel" id="demoPanel">
        <div class="demo-panel-head">
          <div class="demo-step-indicator">
            <span class="dot"></span>
            <span id="demoStepLabel">Шаг 1 из ${state.steps.length}</span>
          </div>
          <div class="demo-controls">
            <button class="demo-ctrl" id="demoPauseBtn" onclick="DemoStudent.togglePause()" title="Пауза">
              <svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            </button>
            <button class="demo-ctrl" onclick="DemoStudent.skip()" title="Пропустить шаг">
              <svg viewBox="0 0 24 24"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
            </button>
            <button class="demo-ctrl danger" onclick="DemoStudent.stop()" title="Остановить">
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div class="demo-action-title" id="demoTitle">—</div>
        <div class="demo-action-text" id="demoText"></div>
        <div class="demo-progress">
          <div class="demo-progress-fill" id="demoProgressFill" style="width:0%"></div>
        </div>
        <div class="demo-progress-info">
          <span>Автодемонстрация</span>
          <span id="demoStepProgress">0 / ${state.steps.length}</span>
        </div>
      </div>
    `;
        document.body.appendChild(overlay);

        /* Обработчик клика по подложке — остановка */
        overlay.querySelector(".demo-backdrop").addEventListener("click", stop);
    }

    /* =========================================================
     ВЫПОЛНЕНИЕ ШАГА
     ========================================================= */
    function runStep() {
        if (!state.active) return;
        if (state.stepIndex >= state.steps.length) {
            finish();
            return;
        }

        const step = state.steps[state.stepIndex];

        /* Обновляем индикатор */
        document.getElementById("demoStepLabel").textContent =
            `Шаг ${state.stepIndex + 1} из ${state.steps.length}`;
        document.getElementById("demoStepProgress").textContent =
            `${state.stepIndex + 1} / ${state.steps.length}`;

        /* Обновляем прогресс-бар */
        const pct = ((state.stepIndex + 1) / state.steps.length) * 100;
        document.getElementById("demoProgressFill").style.width = pct + "%";

        /* Заголовок */
        document.getElementById("demoTitle").textContent = step.title;

        /* Навигация в нужный раздел */
        if (step.view && App.getUser()) {
            const activeView = document.querySelector(".app-nav button.active");
            const currentView = activeView ? activeView.dataset.view : null;
            if (currentView !== step.view) {
                App.navigate(step.view);
            }
        }

        /* Тип пишущегося текста */
        typeText(step.text, () => {
            /* Подсветка после печати */
            if (step.target) {
                setTimeout(() => highlightTarget(step.target), 200);
            }

            /* Переход к следующему шагу */
            state.timeoutId = setTimeout(() => {
                if (state.paused) {
                    /* Если пауза — ждём */
                    waitWhilePaused(() => nextStep());
                } else {
                    nextStep();
                }
            }, step.duration);
        });
    }

    function nextStep() {
        if (!state.active) return;
        state.stepIndex++;
        runStep();
    }

    function waitWhilePaused(callback) {
        const check = () => {
            if (!state.active) return;
            if (state.paused) {
                setTimeout(check, 200);
            } else {
                callback();
            }
        };
        check();
    }

    /* =========================================================
     ЭФФЕКТ ПЕЧАТНОЙ МАШИНКИ
     ========================================================= */
    function typeText(text, callback) {
        const el = document.getElementById("demoText");
        if (!el) return;

        /* Отменяем предыдущую печать */
        if (state.typingTimerId) clearInterval(state.typingTimerId);

        el.innerHTML =
            '<span id="typedContent"></span><span class="cursor"></span>';
        const content = document.getElementById("typedContent");

        let i = 0;
        state.typingTimerId = setInterval(() => {
            if (!state.active) {
                clearInterval(state.typingTimerId);
                return;
            }
            if (state.paused) return;

            if (i < text.length) {
                content.textContent += text[i];
                i++;
            } else {
                clearInterval(state.typingTimerId);
                state.typingTimerId = null;
                if (callback) callback();
            }
        }, 25); /* Скорость печати */
    }

    /* =========================================================
     ПОДСВЕТКА ЭЛЕМЕНТА
     ========================================================= */
    function highlightTarget(selector) {
        const spot = document.getElementById("demoSpotlight");
        if (!spot) return;

        /* Может быть несколько селекторов через запятую */
        const selectors = selector.split(",").map((s) => s.trim());
        let el = null;
        for (const sel of selectors) {
            el = document.querySelector(sel);
            if (el) break;
        }

        if (!el) {
            spot.style.display = "none";
            return;
        }

        const rect = el.getBoundingClientRect();
        const pad = 8;

        spot.style.display = "block";
        spot.style.top = rect.top - pad + "px";
        spot.style.left = rect.left - pad + "px";
        spot.style.width = rect.width + pad * 2 + "px";
        spot.style.height = rect.height + pad * 2 + "px";

        /* Плавно скроллим к элементу */
        el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    /* =========================================================
     УПРАВЛЕНИЕ
     ========================================================= */
    function togglePause() {
        if (!state.active) return;
        state.paused = !state.paused;

        const btn = document.getElementById("demoPauseBtn");
        if (btn) {
            btn.innerHTML = state.paused
                ? '<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
                : '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
            btn.title = state.paused ? "Продолжить" : "Пауза";
        }
    }

    function skip() {
        if (!state.active) return;
        /* Отменяем таймеры и сразу идём дальше */
        if (state.timeoutId) clearTimeout(state.timeoutId);
        if (state.typingTimerId) clearInterval(state.typingTimerId);
        nextStep();
    }

    function stop() {
        state.active = false;
        state.paused = false;

        if (state.timeoutId) clearTimeout(state.timeoutId);
        if (state.typingTimerId) clearInterval(state.typingTimerId);

        const overlay = document.getElementById("demoOverlay");
        if (overlay) {
            overlay.style.opacity = "0";
            overlay.style.transition = "opacity 0.3s";
            setTimeout(() => overlay.remove(), 300);
        }

        const finishEl = document.getElementById("demoFinish");
        if (finishEl) finishEl.remove();

        App.toast("Демонстрация остановлена");
    }

    /* =========================================================
     ФИНАЛЬНЫЙ ЭКРАН
     ========================================================= */
    function finish() {
        state.active = false;

        const overlay = document.getElementById("demoOverlay");
        if (overlay) overlay.remove();

        const div = document.createElement("div");
        div.id = "demoFinish";
        div.className = "demo-finish";
        div.innerHTML = `
      <div class="demo-finish-card">
        <div class="demo-finish-icon">
          <svg viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div class="demo-finish-title">Демонстрация завершена</div>
        <div class="demo-finish-text">
          Вы увидели основные возможности системы для роли «Студент».<br>
          Хотите посмотреть функционал других ролей?
        </div>
        <div class="demo-finish-actions">
          <button class="btn-ghost" onclick="DemoStudent.stop()">
            Закрыть
          </button>
          <button class="btn-primary" onclick="DemoStudent.restart()">
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
    }

    function restart() {
        const finishEl = document.getElementById("demoFinish");
        if (finishEl) finishEl.remove();
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
        isActive: () => state.active,
    };
})();
