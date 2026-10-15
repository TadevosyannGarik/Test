/* =========================================================
   DEMO DATA — генерация тестовых данных для демонстрации
   ========================================================= */
const DemoData = (() => {
    /* =========================================================
       ДАННЫЕ ДЛЯ ГЕНЕРАЦИИ
       ========================================================= */
    const TEACHERS_DATA = [
        {
            fio: "Петров Пётр Петрович",
            email: "teacher@demo.ru",
            pass: "123456",
            department: "Кафедра информационных систем",
            position: "Доцент",
            degree: "к.т.н.",
            interests: "Нечёткая логика, искусственный интеллект",
            maxLoad: 8,
        },
        {
            fio: "Сидорова Елена Алексеевна",
            email: "sidorova@demo.ru",
            pass: "123456",
            department: "Кафедра информационных систем",
            position: "Профессор",
            degree: "д.т.н.",
            interests: "Машинное обучение, Big Data",
            maxLoad: 6,
        },
        {
            fio: "Козлов Дмитрий Владимирович",
            email: "kozlov@demo.ru",
            pass: "123456",
            department: "Кафедра прикладной математики",
            position: "Старший преподаватель",
            degree: "к.ф.-м.н.",
            interests: "Численные методы, оптимизация",
            maxLoad: 10,
        },
    ];

    const STUDENTS_DATA = [
        {
            fio: "Иванов Иван Иванович",
            group: "ПИ-21-1",
            course: 3,
            faculty: "ФИТ",
            direction: "Программная инженерия",
        },
        {
            fio: "Смирнова Анна Викторовна",
            group: "ПИ-21-1",
            course: 3,
            faculty: "ФИТ",
            direction: "Программная инженерия",
        },
        {
            fio: "Кузнецов Дмитрий Сергеевич",
            group: "ПИ-21-2",
            course: 3,
            faculty: "ФИТ",
            direction: "Программная инженерия",
        },
        {
            fio: "Орлова Мария Константиновна",
            group: "ПИ-21-2",
            course: 3,
            faculty: "ФИТ",
            direction: "Программная инженерия",
        },
        {
            fio: "Фёдоров Кирилл Николаевич",
            group: "ИВТ-22-1",
            course: 2,
            faculty: "ФИТ",
            direction: "Информатика и ВТ",
        },
        {
            fio: "Николаева Ольга Павловна",
            group: "ИВТ-22-1",
            course: 2,
            faculty: "ФИТ",
            direction: "Информатика и ВТ",
        },
        {
            fio: "Морозов Артём Юрьевич",
            group: "ПИ-20-1",
            course: 4,
            faculty: "ФИТ",
            direction: "Программная инженерия",
        },
        {
            fio: "Волкова Екатерина Дмитриевна",
            group: "ПИ-20-1",
            course: 4,
            faculty: "ФИТ",
            direction: "Программная инженерия",
        },
        {
            fio: "Лебедев Роман Андреевич",
            group: "ПМ-21-1",
            course: 3,
            faculty: "ФПМ",
            direction: "Прикладная математика",
        },
        {
            fio: "Соколова Виктория Максимовна",
            group: "ПМ-21-1",
            course: 3,
            faculty: "ФПМ",
            direction: "Прикладная математика",
        },
    ];

    const TOPICS = [
        "Информационная система управления проектами на основе нечёткой логики",
        "Нейросетевые методы в образовании",
        "Блокчейн-технологии в логистике",
        "Применение fuzzy-логики в оценке студентов",
        "Мобильное приложение для кампуса",
        "Аналитика Big Data в вузе",
        "Чат-бот для приёмной комиссии",
        "Система распознавания лиц в пропускном режиме",
        "Рекомендательная система для подбора курсов",
        "Автоматизация документооборота кафедры",
        "Мониторинг успеваемости студентов",
        "Веб-платформа для научных конференций",
        "Оптимизация расписания занятий",
        "Электронный журнал успеваемости",
        "Система поддержки принятия решений на основе Мамдани",
    ];

    const STAGE_NAMES = [
        "Обзор литературы",
        "Постановка задачи",
        "Проектирование архитектуры",
        "Разработка модуля 1",
        "Разработка модуля 2",
        "Тестирование",
        "Апробация",
        "Оформление по ГОСТу",
        "Подготовка презентации",
        "Предзащита",
    ];

    const TASK_NAMES = [
        "Изучить предметную область",
        "Составить план работы",
        "Согласовать ТЗ с руководителем",
        "Написать главу 1",
        "Написать главу 2",
        "Провести эксперимент",
        "Оформить результаты",
        "Подготовить слайды",
        "Написать аннотацию",
        "Проверить орфографию",
    ];

    const COMMENT_TEXTS = [
        "Отличная работа над главой! Продолжайте в том же духе.",
        "Нужно добавить больше примеров в раздел 2.3.",
        "Пересмотрите список литературы — не все источники актуальны.",
        "Хорошо структурировано, но не хватает выводов.",
        "Обратите внимание на оформление таблиц.",
        "Согласен с подходом, но стоит расширить методологию.",
        "Отличная защита на предзащите! Готовьтесь к финалу.",
        "Не забудьте про заключение — это важная часть.",
        "Оригинальность хорошая, но нужно увеличить объём.",
        "Приятно видеть такой прогресс. Продолжайте.",
    ];

    /* =========================================================
       УТИЛИТЫ
       ========================================================= */
    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }
    function randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function daysAgo(n) {
        return Date.now() - n * 86400000;
    }
    function daysAhead(n) {
        return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    }
    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /* =========================================================
       ГЕНЕРАЦИЯ
       ========================================================= */
    function generate() {
        const existingUsers = Storage.getUsers();
        if (existingUsers.length > 5) {
            if (
                !confirm(
                    `В системе уже ${existingUsers.length} пользователей. ` +
                        `Демо-данные добавятся к существующим. Продолжить?`,
                )
            )
                return;
        }

        App.toast("Генерация демо-данных...");

        /* =========================================================
           1. ПОЛЬЗОВАТЕЛИ
           ========================================================= */
        const users = [...existingUsers];
        const existingEmails = new Set(users.map((u) => u.email));

        const teachers = [];
        for (const t of TEACHERS_DATA) {
            if (existingEmails.has(t.email)) {
                const found = users.find((u) => u.email === t.email);
                if (found) teachers.push(found);
                continue;
            }
            const teacher = {
                id: uid(),
                role: "teacher",
                ...t,
                pass: hashPass(t.pass),
                createdAt: Date.now(),
            };
            users.push(teacher);
            teachers.push(teacher);
            existingEmails.add(t.email);
        }

        const students = [];
        for (let i = 0; i < STUDENTS_DATA.length; i++) {
            const s = STUDENTS_DATA[i];
            const email = `student${i + 1}@demo.ru`;
            if (existingEmails.has(email)) {
                const found = users.find((u) => u.email === email);
                if (found) students.push(found);
                continue;
            }
            const student = {
                id: uid(),
                role: "student",
                fio: s.fio,
                email,
                pass: hashPass("123456"),
                faculty: s.faculty,
                group: s.group,
                course: s.course,
                direction: s.direction,
                recordBook: `${s.course}${String(i + 1).padStart(3, "0")}`,
                createdAt: Date.now(),
            };
            users.push(student);
            students.push(student);
            existingEmails.add(email);
        }

        if (teachers.length === 0) {
            App.toast("Нет преподавателей для создания работ");
            return;
        }
        if (students.length === 0) {
            App.toast("Нет студентов для создания работ");
            return;
        }

        Storage.setUsers(users);

        /* =========================================================
           2. РАБОТЫ
           ========================================================= */
        const works = Storage.getWorks();
        const stages = Storage.getStages();
        const tasks = Storage.getTasks();
        const versions = Storage.getVersions();
        const comments = Storage.getComments();

        const statusPlan = [
            { status: "pending", count: 2 },
            { status: "active", count: 5 },
            { status: "review", count: 2 },
            { status: "approved", count: 2 },
            { status: "done", count: 3 },
            { status: "rejected", count: 1 },
        ];

        let topicIdx = 0;
        let globalIdx = 0;

        for (const plan of statusPlan) {
            for (let i = 0; i < plan.count; i++) {
                const student = students[globalIdx % students.length];
                const teacher = teachers[globalIdx % teachers.length];
                const topic = TOPICS[topicIdx % TOPICS.length];
                topicIdx++;
                globalIdx++;

                const createdAt = daysAgo(randInt(30, 90));
                const updatedAt = daysAgo(randInt(1, 15));
                const deadline = daysAhead(randInt(10, 60));

                const work = {
                    id: uid(),
                    studentId: student.id,
                    teacherId: teacher.id,
                    type: pick(["course", "diploma", "vkr", "master"]),
                    topic,
                    annotation:
                        `Работа посвящена исследованию в области «${topic.toLowerCase()}». ` +
                        `Рассматриваются современные подходы и предлагается авторское решение.`,
                    keywords: "нечёткая логика, управление, автоматизация",
                    goal: "Разработать и апробировать информационную систему.",
                    tasksText:
                        "1. Изучить предметную область\n" +
                        "2. Спроектировать систему\n" +
                        "3. Реализовать прототип\n" +
                        "4. Провести тестирование",
                    deadline,
                    status: plan.status,
                    createdAt,
                    updatedAt,
                };

                if (plan.status === "done") {
                    work.finalGrade = pick([3, 4, 4, 5, 5, 5]);
                    work.gradeComment = pick([
                        "Отличная защита, чёткие ответы на вопросы",
                        "Хорошая работа, но были замечания",
                        "Работа заслуживает высокой оценки",
                        "Уверенная защита, но не все вопросы раскрыты",
                    ]);
                    work.defendedAt = daysAgo(randInt(1, 30));
                }

                if (plan.status === "rejected") {
                    work.rejectReason = pick([
                        "Тема недостаточно раскрыта, требуется переработка",
                        "Слишком общая формулировка, нужна конкретика",
                        "Не соответствует направлению подготовки",
                    ]);
                }

                works.push(work);

                /* ---------- Этапы ---------- */
                if (
                    ["active", "review", "approved", "done"].includes(
                        plan.status,
                    )
                ) {
                    const stageCount = randInt(3, 5);
                    const stageNames = shuffle(STAGE_NAMES).slice(
                        0,
                        stageCount,
                    );

                    let doneUntil;
                    if (plan.status === "done") doneUntil = stageCount;
                    else if (plan.status === "approved")
                        doneUntil = stageCount - 1;
                    else if (plan.status === "review")
                        doneUntil = Math.floor(stageCount * 0.8);
                    else doneUntil = Math.floor(stageCount * Math.random());

                    for (let k = 0; k < stageCount; k++) {
                        const isDone = k < doneUntil;
                        stages.push({
                            id: uid(),
                            workId: work.id,
                            name: stageNames[k],
                            description: "",
                            deadline: daysAhead(randInt(5, 40)),
                            weight: randInt(1, 3),
                            order: k + 1,
                            done: isDone,
                            completedAt: isDone
                                ? daysAgo(randInt(1, 20))
                                : null,
                            createdAt,
                        });
                    }
                }

                /* ---------- Задачи ---------- */
                if (
                    ["active", "review", "approved", "done"].includes(
                        plan.status,
                    )
                ) {
                    const taskCount = randInt(4, 7);
                    const taskNames = shuffle(TASK_NAMES).slice(0, taskCount);

                    let cols;
                    if (plan.status === "done") {
                        cols = Array(taskCount).fill("done");
                    } else if (plan.status === "approved") {
                        cols = Array(taskCount).fill("done");
                        if (taskCount > 0) cols[0] = "review";
                    } else if (plan.status === "review") {
                        cols = Array(taskCount).fill("done");
                        if (taskCount > 0) cols[0] = "review";
                        if (taskCount > 1) cols[1] = "review";
                    } else if (plan.status === "active") {
                        cols = [
                            "done",
                            "done",
                            "progress",
                            "progress",
                            "todo",
                            "todo",
                            "review",
                        ].slice(0, taskCount);
                    } else {
                        cols = Array(taskCount).fill("todo");
                    }

                    for (let k = 0; k < taskCount; k++) {
                        tasks.push({
                            id: uid(),
                            workId: work.id,
                            title: taskNames[k],
                            col: cols[k] || "todo",
                            deadline:
                                Math.random() > 0.5
                                    ? daysAhead(randInt(3, 25))
                                    : null,
                            createdAt,
                            updatedAt,
                        });
                    }
                }

                /* ---------- Версии ---------- */
                if (
                    ["active", "review", "approved", "done"].includes(
                        plan.status,
                    )
                ) {
                    const vCount = randInt(1, 4);
                    for (let v = 0; v < vCount; v++) {
                        versions.push({
                            id: uid(),
                            workId: work.id,
                            version: `1.${v}`,
                            filename: `chapter_${v + 1}.docx`,
                            comment: pick([
                                "Добавлена глава " + (v + 1),
                                "Исправлены замечания",
                                "Расширено введение",
                                "Обновлена литература",
                                "Финальная версия",
                            ]),
                            createdAt: daysAgo(randInt(1, 30)),
                        });
                    }
                }

                /* ---------- Комментарии ---------- */
                if (
                    ["active", "review", "approved", "done"].includes(
                        plan.status,
                    )
                ) {
                    const cCount = randInt(2, 5);
                    for (let c = 0; c < cCount; c++) {
                        comments.push({
                            id: uid(),
                            workId: work.id,
                            authorId: teacher.id,
                            text: pick(COMMENT_TEXTS),
                            createdAt: daysAgo(randInt(1, 20)),
                            kind: "review",
                        });
                    }
                }
            }
        }

        Storage.setWorks(works);
        Storage.setStages(stages);
        Storage.setTasks(tasks);
        Storage.setVersions(versions);
        Storage.setComments(comments);

        /* =========================================================
           3. АУДИТ
           ========================================================= */
        const auditLog = Storage.get("fp_audit", []);
        for (let i = 0; i < 20; i++) {
            const u = pick(users);
            auditLog.push({
                id: uid(),
                userId: u.id,
                userFio: u.fio,
                userRole: u.role,
                action: pick([
                    "Создана работа",
                    "Утверждена заявка",
                    "Оценка выставлена",
                    "Работа защищена",
                    "Загружена версия",
                    "Добавлено замечание",
                ]),
                target: pick(TOPICS).slice(0, 40),
                details: "",
                type: pick(["info", "info", "positive"]),
                createdAt: daysAgo(randInt(1, 30)),
            });
        }
        Storage.set("fp_audit", auditLog);

        /* =========================================================
           4. УВЕДОМЛЕНИЯ
           ========================================================= */
        const notifs = Storage.get("fp_notifications", []);
        for (const s of students) {
            notifs.push({
                id: uid(),
                userId: s.id,
                type: "info",
                title: "Добро пожаловать в Meridian",
                text: "Система поможет вам вести работу над курсовой или дипломной.",
                read: false,
                createdAt: daysAgo(randInt(1, 10)),
            });
        }
        Storage.set("fp_notifications", notifs);

        /* =========================================================
           5. КОНСУЛЬТАЦИИ
           ========================================================= */
        const consults = Storage.get("fp_consults", []);
        const consultCount = Math.min(3, students.length);
        for (let i = 0; i < consultCount; i++) {
            const s = students[i];
            const teacher = teachers[i % teachers.length];
            if (!s || !teacher) continue;

            consults.push({
                id: uid(),
                studentId: s.id,
                teacherId: teacher.id,
                datetime: new Date(
                    Date.now() + randInt(1, 7) * 86400000,
                ).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                topic: pick([
                    "Обсуждение главы 2",
                    "Консультация по методологии",
                    "Предзащита",
                ]),
                comment: "Прошу помочь с текущими вопросами.",
                status: pick(["pending", "approved", "pending"]),
                response: "",
                createdAt: daysAgo(randInt(1, 10)),
                updatedAt: Date.now(),
            });
        }
        Storage.set("fp_consults", consults);

        /* =========================================================
           ИТОГ
           ========================================================= */
        App.toast(
            `Готово! ${students.length} студентов, ${teachers.length} преподавателей`,
        );

        if (typeof App.refreshNotifications === "function") {
            App.refreshNotifications();
        }

        setTimeout(() => {
            App.navigate("dashboard");
        }, 600);
    }

    /* =========================================================
       ОЧИСТКА
       ========================================================= */
    function clearAll() {
        if (
            !confirm(
                "Удалить ВСЕ данные?\n\n" +
                    "Это действие необратимо. Продолжить?",
            )
        )
            return;

        if (!confirm("Вы точно уверены? Все данные будут потеряны.")) return;

        Object.keys(localStorage).forEach((key) => {
            if (key.startsWith("fp_")) localStorage.removeItem(key);
        });

        location.reload();
    }

    /* =========================================================
       ПУБЛИЧНЫЙ API
       ========================================================= */
    return {
        generate,
        clearAll,
    };
})();
