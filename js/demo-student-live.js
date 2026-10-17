const DemoStudentLive = (() => {
    let state = {
        active: false,
        paused: false,
        skipRequested: false,
        stepIndex: 0,
        steps: [],
        timers: [],
        typingTimerId: null,
    };

    function sleep(ms, interruptible = true) {
        return new Promise((resolve) => {
            if (!state.active && interruptible) {
                return resolve();
            }
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
        console.log(`[Демо] ${msg}`);
    }

    async function waitForElement(selector, maxWait = 5000) {
        const start = Date.now();
        while (Date.now() - start < maxWait) {
            if (!state.active) return null;
            const el = document.querySelector(selector);
            if (el) return el;
            await sleep(100, false);
        }
        return null;
    }

    function findButton(text, root = document) {
        const buttons = Array.from(root.querySelectorAll("button"));
        return buttons.find((b) => b.textContent.trim().includes(text));
    }

    function findButtons(text, root = document) {
        const buttons = Array.from(root.querySelectorAll("button"));
        return buttons.filter((b) => b.textContent.trim().includes(text));
    }

    async function moveCursorTo(element, offsetX = 14, offsetY = 14) {
        if (!element || !state.active) return;

        const rect = element.getBoundingClientRect();
        const winH = window.innerHeight;
        const isOutside = rect.top < 100 || rect.bottom > winH - 100;

        if (isOutside) {
            element.scrollIntoView({
                behavior: "smooth",
                block: "center",
                inline: "nearest",
            });
            await sleep(900);
            await waitWhilePaused();
        }

        const cursor = document.getElementById("demoCursor");
        if (!cursor) return;

        const newRect = element.getBoundingClientRect();
        const targetX = newRect.left + newRect.width / 2 + offsetX - 13;
        const targetY = newRect.top + newRect.height / 2 + offsetY - 13;

        const startX = cursor._x ?? targetX;
        const startY = cursor._y ?? targetY;

        await new Promise((resolve) => {
            const duration = 800;
            const startTime = performance.now();

            function animate(now) {
                if (!state.active || state.skipRequested) {
                    cursor._x = targetX;
                    cursor._y = targetY;
                    cursor.style.transform = `translate(${targetX}px, ${targetY}px)`;
                    return resolve();
                }

                const elapsed = now - startTime;
                const t = Math.min(1, elapsed / duration);
                const ease =
                    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

                const x = startX + (targetX - startX) * ease;
                const y = startY + (targetY - startY) * ease;

                cursor.style.transform = `translate(${x}px, ${y}px)`;
                cursor._x = x;
                cursor._y = y;

                if (t < 1) {
                    requestAnimationFrame(animate);
                } else {
                    cursor._x = targetX;
                    cursor._y = targetY;
                    resolve();
                }
            }

            requestAnimationFrame(animate);
        });

        repositionPanel(newRect);

        await sleep(300);
        await waitWhilePaused();
    }

    function repositionPanel(targetRect) {
        const panel = document.getElementById("demoLivePanel");
        if (!panel) return;

        const winW = window.innerWidth;
        const winH = window.innerHeight;

        const cx = targetRect.left + targetRect.width / 2;
        const cy = targetRect.top + targetRect.height / 2;

        const isLeft = cx < winW * 0.33;
        const isRight = cx > winW * 0.66;
        const isTop = cy < winH * 0.33;
        const isBottom = cy > winH * 0.66;

        let pos;
        if (isLeft && isBottom) pos = "top-right";
        else if (isLeft && isTop) pos = "bottom-right";
        else if (isRight && isBottom) pos = "top-left";
        else if (isRight && isTop) pos = "bottom-left";
        else if (isLeft) pos = "top-right";
        else if (isRight) pos = "top-left";
        else if (isTop) pos = "bottom-right";
        else if (isBottom) pos = "top-right";
        else pos = "top-right";

        panel.classList.remove(
            "panel-pos-top-left",
            "panel-pos-top-right",
            "panel-pos-bottom-left",
            "panel-pos-bottom-right",
        );
        panel.classList.add(`panel-pos-${pos}`);
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
        setTimeout(() => ripple.remove(), 900);

        await sleep(250);
        if (!state.active) {
            if (cursor) cursor.classList.remove("clicking");
            return;
        }

        try {
            element.click();
        } catch (e) {
            log(`Ошибка клика: ${e.message}`);
        }

        if (cursor) cursor.classList.remove("clicking");

        await sleep(600);

        setTimeout(
            () => element.classList.remove("demo-target-highlight"),
            1200,
        );

        await sleep(400);
        await waitWhilePaused();
    }

    async function typeIntoInput(input, text, speed = 22) {
        if (!input || !state.active) return;

        input.classList.add("demo-typing");
        input.focus();

        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await sleep(300);

        for (let i = 0; i < text.length; i++) {
            if (!state.active || state.skipRequested) break;
            await waitWhilePaused();
            input.value += text[i];
            input.dispatchEvent(new Event("input", { bubbles: true }));
            await sleep(speed, false);
        }

        await sleep(400, true);
        input.classList.remove("demo-typing");
        input.blur();
    }

    async function simulateDragDrop(sourceEl, targetEl) {
        if (!sourceEl || !targetEl || !state.active) return;

        const targetRect = targetEl.getBoundingClientRect();
        const dataTransfer = new DataTransfer();

        await moveCursorTo(sourceEl);
        if (!state.active) return;

        const dragStartEvent = new DragEvent("dragstart", {
            bubbles: true,
            cancelable: true,
            dataTransfer,
        });
        sourceEl.dispatchEvent(dragStartEvent);

        sourceEl.classList.add("demo-dragging");
        await sleep(400);
        if (!state.active) {
            sourceEl.classList.remove("demo-dragging");
            return;
        }

        const cursor = document.getElementById("demoCursor");
        if (cursor) {
            const startX = cursor._x;
            const startY = cursor._y;
            const targetX = targetRect.left + targetRect.width / 2 - 13;
            const targetY = targetRect.top + targetRect.height / 2 - 13;

            await new Promise((resolve) => {
                const duration = 700;
                const startTime = performance.now();

                function animate(now) {
                    if (!state.active || state.skipRequested) {
                        cursor._x = targetX;
                        cursor._y = targetY;
                        cursor.style.transform = `translate(${targetX}px, ${targetY}px)`;
                        return resolve();
                    }

                    const elapsed = now - startTime;
                    const t = Math.min(1, elapsed / duration);
                    const ease =
                        t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

                    const x = startX + (targetX - startX) * ease;
                    const y = startY + (targetY - startY) * ease;

                    cursor.style.transform = `translate(${x}px, ${y}px)`;
                    cursor._x = x;
                    cursor._y = y;

                    if (t < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        cursor._x = targetX;
                        cursor._y = targetY;
                        resolve();
                    }
                }

                requestAnimationFrame(animate);
            });
        }

        if (!state.active) {
            sourceEl.classList.remove("demo-dragging");
            return;
        }

        const dragOverEvent = new DragEvent("dragover", {
            bubbles: true,
            cancelable: true,
            dataTransfer,
        });
        targetEl.dispatchEvent(dragOverEvent);
        targetEl.classList.add("drag-over");
        await sleep(500);
        if (!state.active) {
            targetEl.classList.remove("drag-over");
            sourceEl.classList.remove("demo-dragging");
            return;
        }

        const dropEvent = new DragEvent("drop", {
            bubbles: true,
            cancelable: true,
            dataTransfer,
        });
        targetEl.dispatchEvent(dropEvent);

        targetEl.classList.remove("drag-over");
        sourceEl.classList.remove("demo-dragging");

        await sleep(800);
        await waitWhilePaused();
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

    function buildSteps() {
        return [
            {
                title: "Добро пожаловать в Meridian",
                text: "Привет! Сейчас я покажу полный функционал роли «Студент»: от создания работы до статистики и профиля. Все действия реальные — система сама кликает, вводит текст и создаёт данные.",
                action: async () => {
                    App.navigate("dashboard");
                    await sleep(600);
                },
                wait: 2600,
            },

            {
                title: "Дашборд — главный экран",
                text: "Здесь видны все мои активные работы. У каждой — прогресс и три нечётких показателя: риск срыва, готовность, рейтинг.",
                action: async () => {
                    const nav = await waitForElement(
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
                text: "У студента нет работы. Нажму кнопку «Создать работу», чтобы перейти к форме создания.",
                condition: () => {
                    const u = Auth.getUser();
                    return u && Storage.getWorksByStudent(u.id).length === 0;
                },
                action: async () => {
                    await sleep(500);
                    const createBtn = findButton("Создать работу");
                    if (createBtn) {
                        await moveCursorTo(createBtn);
                        await realClick(createBtn);
                    } else {
                        App.navigate("create-work");
                    }
                    await sleep(900);
                },
                wait: 2000,
            },
            {
                title: "Выбираю тип работы",
                text: "Есть 4 типа: курсовая, дипломная, ВКР и магистерская. Выбираю «Курсовая работа».",
                condition: () => {
                    const u = Auth.getUser();
                    return u && Storage.getWorksByStudent(u.id).length === 0;
                },
                action: async () => {
                    const typeBtn = await waitForElement(
                        '#typePicker button[data-type="course"]',
                    );
                    if (typeBtn) {
                        await moveCursorTo(typeBtn);
                        await realClick(typeBtn);
                    }
                    await sleep(500);
                },
                wait: 1500,
            },
            {
                title: "Ввожу тему работы",
                text: "Ввожу тему: «Информационная система управления проектами на основе нечёткой логики Мамдани».",
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
                    await sleep(300);
                },
                wait: 1200,
            },
            {
                title: "Ввожу аннотацию",
                text: "Аннотация — краткое описание работы.",
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
                    await sleep(300);
                },
                wait: 1300,
            },
            {
                title: "Ввожу ключевые слова",
                text: "Ключевые слова помогут найти работу.",
                condition: () => {
                    const u = Auth.getUser();
                    return u && Storage.getWorksByStudent(u.id).length === 0;
                },
                action: async () => {
                    const kw = document.getElementById("w_keywords");
                    if (kw) {
                        await moveCursorTo(kw);
                        await typeIntoInput(
                            kw,
                            "нечёткая логика, Мамдани, управление проектами",
                        );
                    }
                    await sleep(300);
                },
                wait: 1300,
            },
            {
                title: "Ввожу цель работы",
                text: "Цель — что студент планирует достичь.",
                condition: () => {
                    const u = Auth.getUser();
                    return u && Storage.getWorksByStudent(u.id).length === 0;
                },
                action: async () => {
                    const goal = document.getElementById("w_goal");
                    if (goal) {
                        await moveCursorTo(goal);
                        await typeIntoInput(
                            goal,
                            "Разработать ИС на основе алгоритма Мамдани",
                        );
                    }
                    await sleep(300);
                },
                wait: 1300,
            },
            {
                title: "Выбираю дату защиты",
                text: "Указываю планируемую дату защиты — через 30 дней.",
                condition: () => {
                    const u = Auth.getUser();
                    return u && Storage.getWorksByStudent(u.id).length === 0;
                },
                action: async () => {
                    const deadline = document.getElementById("w_deadline");
                    if (deadline) {
                        await moveCursorTo(deadline);
                        const d = new Date();
                        d.setDate(d.getDate() + 30);
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, "0");
                        const day = String(d.getDate()).padStart(2, "0");
                        deadline.value = `${y}-${m}-${day}`;
                        deadline.dispatchEvent(new Event("input"));
                    }
                    await sleep(400);
                },
                wait: 1300,
            },
            {
                title: "Заполняю задачи",
                text: "Пишу список задач — по одной на строку.",
                condition: () => {
                    const u = Auth.getUser();
                    return u && Storage.getWorksByStudent(u.id).length === 0;
                },
                action: async () => {
                    const tasks = document.getElementById("w_tasks");
                    if (tasks) {
                        await moveCursorTo(tasks);
                        await typeIntoInput(
                            tasks,
                            "Изучить предметную область\nСпроектировать архитектуру\nРеализовать прототип\nПровести тестирование",
                        );
                    }
                    await sleep(400);
                },
                wait: 1500,
            },
            {
                title: "Выбираю руководителя",
                text: "Кликом выбираю преподавателя. Система показывает его загрузку.",
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
                    await sleep(500);
                },
                wait: 1500,
            },
            {
                title: "Создаю работу",
                text: "Нажимаю «Создать работу» — она отправляется руководителю на утверждение.",
                condition: () => {
                    const u = Auth.getUser();
                    return u && Storage.getWorksByStudent(u.id).length === 0;
                },
                action: async () => {
                    await sleep(500);
                    const saveBtn = findButton("Создать работу");
                    if (saveBtn) {
                        await moveCursorTo(saveBtn);
                        await realClick(saveBtn);
                        await sleep(1200);

                        const u = Auth.getUser();
                        const works = Storage.getWorksByStudent(u.id);
                        if (works.length > 0) {
                            log(`✓ РАБОТА СОЗДАНА`);
                        }
                    }
                    await sleep(700);
                },
                wait: 2400,
            },

            {
                title: "Раздел «Моя работа»",
                text: "Открываю страницу работы. Здесь студент управляет этапами, задачами и версиями документа.",
                action: async () => {
                    const nav = await waitForElement(
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
                wait: 2000,
            },
            {
                title: "Добавляю первый этап",
                text: "Нажимаю «Добавить этап». Создам этап «Глава 1. Теоретическая часть».",
                action: async () => {
                    await sleep(500);
                    const addBtn = findButton("Добавить этап");
                    if (addBtn) {
                        await moveCursorTo(addBtn);
                        await realClick(addBtn);
                    }
                    await sleep(700);
                },
                wait: 1800,
            },
            {
                title: "Заполняю название этапа",
                text: "Пишу название этапа.",
                action: async () => {
                    const nameInput = await waitForElement("#st_name");
                    if (nameInput) {
                        await moveCursorTo(nameInput);
                        await typeIntoInput(
                            nameInput,
                            "Глава 1. Теоретическая часть",
                        );
                    }
                    await sleep(400);
                },
                wait: 1300,
            },
            {
                title: "Заполняю описание этапа",
                text: "Описание — что нужно сделать.",
                action: async () => {
                    const desc = document.getElementById("st_desc");
                    if (desc) {
                        await moveCursorTo(desc);
                        await typeIntoInput(
                            desc,
                            "Обзор литературы, анализ существующих решений",
                        );
                    }
                    await sleep(400);
                },
                wait: 1300,
            },
            {
                title: "Указываю дедлайн этапа",
                text: "Дедлайн — через 10 дней.",
                action: async () => {
                    const deadline = document.getElementById("st_deadline");
                    if (deadline) {
                        await moveCursorTo(deadline);
                        const d = new Date();
                        d.setDate(d.getDate() + 10);
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, "0");
                        const day = String(d.getDate()).padStart(2, "0");
                        deadline.value = `${y}-${m}-${day}`;
                    }
                    await sleep(400);
                },
                wait: 1300,
            },
            {
                title: "Указываю вес этапа",
                text: "Вес влияет на общий прогресс. Ставлю 2.",
                action: async () => {
                    const weight = document.getElementById("st_weight");
                    if (weight) {
                        await moveCursorTo(weight);
                        weight.value = 2;
                    }
                    await sleep(400);
                },
                wait: 1300,
            },
            {
                title: "Сохраняю этап",
                text: "Нажимаю «Создать» — этап добавлен.",
                action: async () => {
                    const modal = document.querySelector(".modal");
                    if (!modal) return log("Модалка не найдена");
                    const saveBtn = findButton("Создать", modal);
                    if (saveBtn) {
                        await moveCursorTo(saveBtn);
                        await realClick(saveBtn);
                        await sleep(1000);
                    }
                    await sleep(700);
                },
                wait: 1800,
            },
            {
                title: "Отмечаю этап выполненным",
                text: "Кликом по кружку отмечаю этап выполненным.",
                action: async () => {
                    await sleep(500);
                    const check = await waitForElement(".stage-check");
                    if (check) {
                        await moveCursorTo(check);
                        await realClick(check);
                    }
                    await sleep(1000);
                },
                wait: 1800,
            },
            {
                title: "Добавляю задачу",
                text: "Нажимаю «Добавить задачу» — на канбан-доске появится новая карточка.",
                action: async () => {
                    await sleep(500);
                    const addBtn = findButton("Добавить задачу");
                    if (addBtn) {
                        await moveCursorTo(addBtn);
                        await realClick(addBtn);
                    }
                    await sleep(700);
                },
                wait: 1500,
            },
            {
                title: "Ввожу название задачи",
                text: "Пишу задачу: «Написать обзор литературы».",
                action: async () => {
                    const titleInput = await waitForElement("#tk_title");
                    if (titleInput) {
                        await moveCursorTo(titleInput);
                        await typeIntoInput(
                            titleInput,
                            "Написать обзор литературы",
                        );
                    }
                    await sleep(400);
                },
                wait: 1300,
            },
            {
                title: "Указываю дедлайн задачи",
                text: "Дедлайн через неделю.",
                action: async () => {
                    const deadline = document.getElementById("tk_deadline");
                    if (deadline) {
                        await moveCursorTo(deadline);
                        const d = new Date();
                        d.setDate(d.getDate() + 7);
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, "0");
                        const day = String(d.getDate()).padStart(2, "0");
                        deadline.value = `${y}-${m}-${day}`;
                    }
                    await sleep(400);
                },
                wait: 1300,
            },
            {
                title: "Сохраняю задачу",
                text: "Нажимаю «Создать» — задача попадёт в колонку «К выполнению».",
                action: async () => {
                    const modal = document.querySelector(".modal");
                    if (!modal) return;
                    const saveBtn = findButton("Создать", modal);
                    if (saveBtn) {
                        await moveCursorTo(saveBtn);
                        await realClick(saveBtn);
                        await sleep(1000);
                    }
                    await sleep(600);
                },
                wait: 1700,
            },

            {
                title: "Канбан-доска задач",
                text: "Задачи распределяются по 4 колонкам: «К выполнению», «В работе», «На проверке», «Готово». Студент перетаскивает карточки мышью.",
                action: async () => {
                    const kanban = await waitForElement(".kanban");
                    if (kanban) {
                        await moveCursorTo(kanban);
                    }
                    await sleep(1200);
                },
                wait: 2400,
            },
            {
                title: "Перетаскиваю в «В работе»",
                text: "Беру задачу из «К выполнению» и перетаскиваю в колонку «В работе». Студент начал работу над задачей.",
                action: async () => {
                    await sleep(500);
                    const todoCol = document.querySelector(
                        '.kanban-col[data-col="todo"]',
                    );
                    const progressCol = document.querySelector(
                        '.kanban-col[data-col="progress"]',
                    );
                    if (!todoCol || !progressCol)
                        return log("Колонки не найдены");

                    const card = todoCol.querySelector(".task-card");
                    if (!card) return log("Нет задач в todo");

                    await simulateDragDrop(card, progressCol);
                    log("✓ Задача перетащена в «В работе»");
                    await sleep(1000);
                },
                wait: 2800,
            },
            {
                title: "Перетаскиваю в «На проверке»",
                text: "Теперь перетаскиваю задачу в «На проверке» — руководитель получит уведомление и проверит её.",
                action: async () => {
                    await sleep(500);
                    const progressCol = document.querySelector(
                        '.kanban-col[data-col="progress"]',
                    );
                    const reviewCol = document.querySelector(
                        '.kanban-col[data-col="review"]',
                    );
                    if (!progressCol || !reviewCol)
                        return log("Колонки не найдены");

                    const card = progressCol.querySelector(".task-card");
                    if (!card) return log("Нет задач в progress");

                    await simulateDragDrop(card, reviewCol);
                    log("✓ Задача перетащена в «На проверке»");
                    await sleep(1000);
                },
                wait: 3000,
            },
            {
                title: "Ограничение: нельзя сразу в «Готово»",
                text: "А теперь покажу, что система не даёт перетащить задачу сразу в «Готово» — нужно сначала получить одобрение руководителя. Появится предупреждение.",
                action: async () => {
                    await sleep(500);
                    const todoCol = document.querySelector(
                        '.kanban-col[data-col="todo"]',
                    );
                    const doneCol = document.querySelector(
                        '.kanban-col[data-col="done"]',
                    );
                    if (!todoCol || !doneCol) return;

                    const card = todoCol.querySelector(".task-card");
                    if (!card) {
                        const progressCol = document.querySelector(
                            '.kanban-col[data-col="progress"]',
                        );
                        const c2 = progressCol?.querySelector(".task-card");
                        if (!c2) return log("Нет задач");
                        await simulateDragDrop(c2, doneCol);
                    } else {
                        await simulateDragDrop(card, doneCol);
                    }

                    log("✓ Показано ограничение: нельзя сразу в «Готово»");
                    await sleep(1500);
                },
                wait: 2800,
            },

            {
                title: "Загружаю версию документа",
                text: "Нажимаю «Загрузить версию» — добавлю первую версию документа.",
                action: async () => {
                    await sleep(500);
                    const addBtn = findButton("Загрузить версию");
                    if (addBtn) {
                        await moveCursorTo(addBtn);
                        await realClick(addBtn);
                    }
                    await sleep(700);
                },
                wait: 1500,
            },
            {
                title: "Ввожу номер версии",
                text: "По умолчанию 1.0 — оставлю так.",
                action: async () => {
                    const vInput = await waitForElement("#v_version");
                    if (vInput) {
                        await moveCursorTo(vInput);
                        await sleep(500);
                    }
                    await sleep(300);
                },
                wait: 1300,
            },
            {
                title: "Ввожу имя файла",
                text: "chapter1.docx",
                action: async () => {
                    const fnameInput = document.getElementById("v_filename");
                    if (fnameInput) {
                        await moveCursorTo(fnameInput);
                        await typeIntoInput(fnameInput, "chapter1.docx");
                    }
                    await sleep(400);
                },
                wait: 1300,
            },
            {
                title: "Комментарий к версии",
                text: "Что изменилось в этой версии.",
                action: async () => {
                    const comment = document.getElementById("v_comment");
                    if (comment) {
                        await moveCursorTo(comment);
                        await typeIntoInput(
                            comment,
                            "Первая версия главы 1. Обзор литературы.",
                        );
                    }
                    await sleep(400);
                },
                wait: 1300,
            },
            {
                title: "Сохраняю версию",
                text: "Нажимаю «Загрузить» — версия сохранена.",
                action: async () => {
                    const modal = document.querySelector(".modal");
                    if (!modal) return;
                    const saveBtn = findButton("Загрузить", modal);
                    if (saveBtn) {
                        await moveCursorTo(saveBtn);
                        await realClick(saveBtn);
                        await sleep(1000);
                    }
                    await sleep(600);
                },
                wait: 1800,
            },

            {
                title: "Проверка ГОСТа",
                text: "Открываю раздел «ГОСТ». Здесь загружается .docx для проверки оформления по 8 пунктам.",
                action: async () => {
                    const nav = await waitForElement(
                        '.app-nav button[data-view="docx"]',
                    );
                    if (nav) {
                        await moveCursorTo(nav);
                        await realClick(nav);
                    }
                    await sleep(1000);
                },
                wait: 2200,
            },
            {
                title: "Зона drag & drop",
                text: "Это зона загрузки файла. Проверяется: шрифт, поля, интервалы, отступы, нумерация, заголовки, литература.",
                action: async () => {
                    const drop = await waitForElement("#docxDrop");
                    if (drop) {
                        await moveCursorTo(drop);
                    }
                    await sleep(1000);
                },
                wait: 2600,
            },

            {
                title: "Консультации",
                text: "Открываю «Консультации» — здесь можно предложить руководителю время для встречи.",
                action: async () => {
                    const nav = await waitForElement(
                        '.app-nav button[data-view="consultations"]',
                    );
                    if (nav) {
                        await moveCursorTo(nav);
                        await realClick(nav);
                    }
                    await sleep(1200);
                },
                wait: 2400,
            },
            {
                title: "Нажимаю «Предложить слот»",
                text: "Откроется форма создания заявки.",
                action: async () => {
                    await sleep(500);
                    const addBtn = findButton("Предложить слот");
                    if (addBtn) {
                        await moveCursorTo(addBtn);
                        await realClick(addBtn);
                    }
                    await sleep(700);
                },
                wait: 1800,
            },
            {
                title: "Выбираю дату и время",
                text: "Указываю дату встречи — через 3 дня, 14:00.",
                action: async () => {
                    const dtInput = await waitForElement("#c_datetime");
                    if (dtInput) {
                        await moveCursorTo(dtInput);
                        const d = new Date();
                        d.setDate(d.getDate() + 3);
                        d.setHours(14, 0, 0, 0);
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, "0");
                        const day = String(d.getDate()).padStart(2, "0");
                        const hh = String(d.getHours()).padStart(2, "0");
                        const mm = String(d.getMinutes()).padStart(2, "0");
                        dtInput.value = `${y}-${m}-${day}T${hh}:${mm}`;
                        dtInput.dispatchEvent(new Event("input"));
                    }
                    await sleep(500);
                },
                wait: 1500,
            },
            {
                title: "Ввожу тему консультации",
                text: "Пишу: «Обсуждение главы 1».",
                action: async () => {
                    const topicInput = document.getElementById("c_topic");
                    if (topicInput) {
                        await moveCursorTo(topicInput);
                        await typeIntoInput(topicInput, "Обсуждение главы 1");
                    }
                    await sleep(400);
                },
                wait: 1300,
            },
            {
                title: "Отправляю заявку",
                text: "Нажимаю «Отправить» — руководитель получит уведомление.",
                action: async () => {
                    const modal = document.querySelector(".modal");
                    if (!modal) return;
                    const sendBtn = findButton("Отправить", modal);
                    if (sendBtn) {
                        await moveCursorTo(sendBtn);
                        await realClick(sendBtn);
                        await sleep(1000);
                    }
                    await sleep(600);
                },
                wait: 1800,
            },

            {
                title: "Статистика",
                text: "Открываю «Статистику». Здесь — радар нечёткого профиля, прогресс по этапам, итоговые показатели Мамдани.",
                action: async () => {
                    const nav = await waitForElement(
                        '.app-nav button[data-view="stats"]',
                    );
                    if (nav) {
                        await moveCursorTo(nav);
                        await realClick(nav);
                    }
                    await sleep(1500);
                },
                wait: 2600,
            },

            {
                title: "Мамдани — ядро системы",
                text: "Открываю «Мамдани». Здесь видно, как нечёткая логика приходит к результату.",
                action: async () => {
                    const nav = await waitForElement(
                        '.app-nav button[data-view="mamdani"]',
                    );
                    if (nav) {
                        await moveCursorTo(nav);
                        await realClick(nav);
                    }
                    await sleep(1500);
                },
                wait: 2400,
            },
            {
                title: "Баннер с вердиктом",
                text: "Сверху — баннер с вердиктом: «Работа идёт по плану» или «Высокий риск срыва».",
                action: async () => {
                    const hero = await waitForElement(".mamdani-hero-final");
                    if (hero) {
                        await moveCursorTo(hero);
                    }
                    await sleep(900);
                },
                wait: 2200,
            },
            {
                title: "Огромное число риска",
                text: "Крупное число — риск срыва. Рядом готовность и рейтинг.",
                action: async () => {
                    const main = await waitForElement(".mamdani-main");
                    if (main) {
                        await moveCursorTo(main);
                    }
                    await sleep(900);
                },
                wait: 2400,
            },
            {
                title: "Кнопка «Написать студенту»",
                text: "Это действие — можно быстро написать студенту. Покажу нажатие.",
                action: async () => {
                    const btn = await waitForElement(
                        ".mamdani-actions .action-btn",
                    );
                    if (btn) {
                        await moveCursorTo(btn);
                        await realClick(btn);
                    }
                    await sleep(1500);
                },
                wait: 2400,
            },
            {
                title: "Кнопка «Добавить комментарий»",
                text: "Нажимаю — откроется окно комментария.",
                action: async () => {
                    const buttons = document.querySelectorAll(
                        ".mamdani-actions .action-btn",
                    );
                    const btn = buttons[1];
                    if (btn) {
                        await moveCursorTo(btn);
                        await realClick(btn);
                    }
                    await sleep(1000);
                },
                wait: 2200,
            },
            {
                title: "Закрываю модалку",
                text: "Закрываю окно комментария.",
                action: async () => {
                    const close = await waitForElement(".modal-close");
                    if (close) {
                        await moveCursorTo(close);
                        await realClick(close);
                    }
                    await sleep(600);
                },
                wait: 1500,
            },
            {
                title: "Блок «Что делать сейчас»",
                text: "Блок с конкретными советами — например, «Ускорить темп работы».",
                action: async () => {
                    const todo = await waitForElement(".mamdani-todo");
                    if (todo) {
                        await moveCursorTo(todo);
                    }
                    await sleep(1000);
                },
                wait: 2200,
            },
            {
                title: "Блок «Почему такой результат»",
                text: "Четыре фактора, которые повлияли на результат.",
                action: async () => {
                    const factors = await waitForElement(".mamdani-factors");
                    if (factors) {
                        await moveCursorTo(factors);
                    }
                    await sleep(1000);
                },
                wait: 2400,
            },
            {
                title: "Таб «1. Фаззификация»",
                text: "Нажимаю вкладку «Фаззификация». Здесь видно, как каждое число превращается в степень уверенности.",
                action: async () => {
                    const tab = await waitForElement(
                        ".mamdani-tabs button:nth-child(2)",
                    );
                    if (tab) {
                        await moveCursorTo(tab);
                        await realClick(tab);
                    }
                    await sleep(1200);
                },
                wait: 2600,
            },
            {
                title: "Таб «2. Правила»",
                text: "Список сработавших правил: «ЕСЛИ прогресс низкий И дней мало → ТО риск высокий».",
                action: async () => {
                    const tab = await waitForElement(
                        ".mamdani-tabs button:nth-child(3)",
                    );
                    if (tab) {
                        await moveCursorTo(tab);
                        await realClick(tab);
                    }
                    await sleep(1200);
                },
                wait: 2800,
            },
            {
                title: "Таб «3. Агрегация»",
                text: "Объединение правил через оператор max. Ниже — график с итоговой функцией.",
                action: async () => {
                    const tab = await waitForElement(
                        ".mamdani-tabs button:nth-child(4)",
                    );
                    if (tab) {
                        await moveCursorTo(tab);
                        await realClick(tab);
                    }
                    await sleep(1500);
                },
                wait: 3000,
            },
            {
                title: "Таб «4. Дефаззификация»",
                text: "Итоговые числа риска, готовности, рейтинга. Ниже — график с красной линией центра тяжести.",
                action: async () => {
                    const tab = await waitForElement(
                        ".mamdani-tabs button:nth-child(5)",
                    );
                    if (tab) {
                        await moveCursorTo(tab);
                        await realClick(tab);
                    }
                    await sleep(1500);
                },
                wait: 3000,
            },
            {
                title: "Таб «Сравнение алгоритмов»",
                text: "Сравниваются три метода: Мамдани (наш выбор), Сугено и чёткая формула.",
                action: async () => {
                    const tab = await waitForElement(
                        ".mamdani-tabs button:nth-child(6)",
                    );
                    if (tab) {
                        await moveCursorTo(tab);
                        await realClick(tab);
                    }
                    await sleep(1500);
                },
                wait: 3000,
            },

            {
                title: "Симулятор «Что если»",
                text: "Открываю «Симулятор». Здесь можно моделировать сценарии.",
                action: async () => {
                    const nav = await waitForElement(
                        '.app-nav button[data-view="simulate"]',
                    );
                    if (nav) {
                        await moveCursorTo(nav);
                        await realClick(nav);
                    }
                    await sleep(1500);
                },
                wait: 2400,
            },
            {
                title: "Ползунок «Прогресс»",
                text: "Первый ползунок — прогресс. Сдвину до 80%.",
                action: async () => {
                    const slider = await waitForElement("#s_progress");
                    if (!slider) return;
                    await moveCursorTo(slider);
                    for (let v = +slider.value; v <= 80; v += 5) {
                        if (state.skipRequested || !state.active) break;
                        slider.value = v;
                        slider.dispatchEvent(
                            new Event("input", { bubbles: true }),
                        );
                        await sleep(100, false);
                    }
                    await sleep(800);
                },
                wait: 2400,
            },
            {
                title: "Ползунок «Дней до дедлайна»",
                text: "Второй ползунок — дни до дедлайна.",
                action: async () => {
                    const slider = await waitForElement("#s_days");
                    if (!slider) return;
                    await moveCursorTo(slider);
                    for (let v = +slider.value; v <= 45; v += 3) {
                        if (state.skipRequested || !state.active) break;
                        slider.value = v;
                        slider.dispatchEvent(
                            new Event("input", { bubbles: true }),
                        );
                        await sleep(100, false);
                    }
                    await sleep(800);
                },
                wait: 2400,
            },
            {
                title: "Ползунок «Активность»",
                text: "Активность студента — 7 из 10.",
                action: async () => {
                    const slider = await waitForElement("#s_activity");
                    if (!slider) return;
                    await moveCursorTo(slider);
                    slider.value = 7;
                    slider.dispatchEvent(new Event("input", { bubbles: true }));
                    await sleep(800);
                },
                wait: 2200,
            },
            {
                title: "Ползунок «Число правок»",
                text: "Сколько раз руководитель оставлял замечания.",
                action: async () => {
                    const slider = await waitForElement("#s_edits");
                    if (!slider) return;
                    await moveCursorTo(slider);
                    slider.value = 3;
                    slider.dispatchEvent(new Event("input", { bubbles: true }));
                    await sleep(800);
                },
                wait: 2200,
            },
            {
                title: "Ползунок «Объём»",
                text: "Объём работы — растёт вместе с прогрессом.",
                action: async () => {
                    const slider = await waitForElement("#s_volume");
                    if (!slider) return;
                    await moveCursorTo(slider);
                    for (let v = +slider.value; v <= 80; v += 5) {
                        if (state.skipRequested || !state.active) break;
                        slider.value = v;
                        slider.dispatchEvent(
                            new Event("input", { bubbles: true }),
                        );
                        await sleep(100, false);
                    }
                    await sleep(800);
                },
                wait: 2400,
            },
            {
                title: "Ползунок «Оригинальность»",
                text: "Оригинальность текста — 85%.",
                action: async () => {
                    const slider = await waitForElement("#s_orig");
                    if (!slider) return;
                    await moveCursorTo(slider);
                    slider.value = 85;
                    slider.dispatchEvent(new Event("input", { bubbles: true }));
                    await sleep(800);
                },
                wait: 2200,
            },
            {
                title: "Ползунок «Оценка руководителя»",
                text: "Оценка от руководителя — 8 из 10.",
                action: async () => {
                    const slider = await waitForElement("#s_supScore");
                    if (!slider) return;
                    await moveCursorTo(slider);
                    slider.value = 8;
                    slider.dispatchEvent(new Event("input", { bubbles: true }));
                    await sleep(800);
                },
                wait: 2200,
            },
            {
                title: "Ползунок «Соответствие ГОСТу»",
                text: "Последний ползунок — ГОСТ. Поставлю 90%.",
                action: async () => {
                    const slider = await waitForElement("#s_gost");
                    if (!slider) return;
                    await moveCursorTo(slider);
                    slider.value = 90;
                    slider.dispatchEvent(new Event("input", { bubbles: true }));
                    await sleep(800);
                },
                wait: 2200,
            },
            {
                title: "Сценарий «Студент ускорится»",
                text: "Проверю быстрый сценарий. Нажму — ползунки сдвинутся автоматически.",
                action: async () => {
                    await sleep(500);
                    const btn = findButton("Студент ускорится");
                    if (btn) {
                        await moveCursorTo(btn);
                        await realClick(btn);
                    }
                    await sleep(1500);
                },
                wait: 2600,
            },
            {
                title: "Сценарий «Пропустит неделю»",
                text: "А что если студент пропустит неделю? Нажму — риск вырастет.",
                action: async () => {
                    await sleep(500);
                    const btn = findButton("Пропустит неделю");
                    if (btn) {
                        await moveCursorTo(btn);
                        await realClick(btn);
                    }
                    await sleep(1500);
                },
                wait: 2600,
            },
            {
                title: "Сценарий «Лучше оформит»",
                text: "Третий сценарий — улучшение оформления.",
                action: async () => {
                    await sleep(500);
                    const btn = findButton("Лучше оформит");
                    if (btn) {
                        await moveCursorTo(btn);
                        await realClick(btn);
                    }
                    await sleep(1500);
                },
                wait: 2600,
            },
            {
                title: "Кнопка «Сбросить к исходным»",
                text: "Нажму «Сбросить» — ползунки вернутся к реальным значениям.",
                action: async () => {
                    await sleep(500);
                    const btn = findButton("Сбросить");
                    if (btn) {
                        await moveCursorTo(btn);
                        await realClick(btn);
                    }
                    await sleep(1000);
                },
                wait: 2200,
            },

            {
                title: "Календарь",
                text: "Открываю «Календарь» — здесь все дедлайны: этапы, задачи, дата защиты.",
                action: async () => {
                    const nav = await waitForElement(
                        '.app-nav button[data-view="calendar"]',
                    );
                    if (nav) {
                        await moveCursorTo(nav);
                        await realClick(nav);
                    }
                    await sleep(1300);
                },
                wait: 2400,
            },

            {
                title: "История активности",
                text: "Раздел «Активность» — хронология всех событий.",
                action: async () => {
                    const nav = await waitForElement(
                        '.app-nav button[data-view="activity"]',
                    );
                    if (nav) {
                        await moveCursorTo(nav);
                        await realClick(nav);
                    }
                    await sleep(1300);
                },
                wait: 2400,
            },

            {
                title: "Завершённые работы",
                text: "Раздел «Завершённые» — защищённые и отклонённые работы.",
                action: async () => {
                    const nav = await waitForElement(
                        '.app-nav button[data-view="archived"]',
                    );
                    if (nav) {
                        await moveCursorTo(nav);
                        await realClick(nav);
                    }
                    await sleep(1300);
                },
                wait: 2200,
            },

            {
                title: "Профиль студента",
                text: "Открываю «Профиль». Здесь личные данные и полный список работ.",
                action: async () => {
                    const avatar = await waitForElement(".app-avatar");
                    if (avatar) {
                        await moveCursorTo(avatar);
                        await realClick(avatar);
                    } else {
                        App.navigate("profile");
                    }
                    await sleep(1300);
                },
                wait: 2400,
            },

            {
                title: "Уведомления",
                text: "Кликну по колокольчику — здесь все важные события.",
                action: async () => {
                    const bell = await waitForElement("#notifBell");
                    if (bell) {
                        await moveCursorTo(bell);
                        await realClick(bell);
                    }
                    await sleep(1300);
                },
                wait: 2400,
            },
            {
                title: "Закрываю уведомления",
                text: "Закрываю панель.",
                action: async () => {
                    const close = await waitForElement(".notif-close");
                    if (close) {
                        await moveCursorTo(close);
                        await realClick(close);
                    }
                    await sleep(600);
                },
                wait: 1200,
            },

            {
                title: "Демонстрация завершена",
                text: "Всё, что вы увидели — реальные действия. Работа, этапы, задачи, версии, перетаскивания, консультация — всё создано по-настоящему. Спасибо за внимание!",
                action: async () => {},
                wait: 0,
                finish: true,
            },
        ];
    }

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
                    console.warn("[Демо] Ошибка в шаге:", err);
                }
            }

            if (!state.active) return;

            if (step.finish) {
                showFinish();
                return;
            }

            if (step.wait) await sleep(step.wait);

            await waitWhilePaused();
        }

        showFinish();
    }

    function renderCursor() {
        if (document.getElementById("demoCursor")) return;
        const c = document.createElement("div");
        c.id = "demoCursor";
        c.style.transform = "translate(-100px, -100px)";
        c._x = -100;
        c._y = -100;
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
        p.className = "demo-live-panel panel-pos-bottom-right";
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
        interruptSleeps();
        state.skipRequested = false;
        if (state.typingTimerId) {
            clearInterval(state.typingTimerId);
            state.typingTimerId = null;
        }
        cleanup();
        App.toast("Демонстрация остановлена");
        log("Демонстрация остановлена");
    }

    function cleanup() {
        interruptSleeps();
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
        document.querySelectorAll(".demo-typing").forEach((el) => {
            el.classList.remove("demo-typing");
        });
        document.querySelectorAll(".demo-dragging").forEach((el) => {
            el.classList.remove("demo-dragging");
        });
        document.querySelectorAll(".drag-over").forEach((el) => {
            el.classList.remove("drag-over");
        });
        state.timers = [];
    }

    function showFinish() {
        state.active = false;
        interruptSleeps();
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
          Все действия были реальными — работа, этапы, задачи, версии,
          перетаскивания в канбане и консультация — всё создано по-настоящему
          и сохранено в системе.<br>
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
        state.active = false;
        start();
    }

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
