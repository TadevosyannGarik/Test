const DemoData = (() => {
    const TEACHERS_DATA = [
        {
            fio: "Петров Пётр Петрович",
            email: "teacher@demo.ru",
            department: "Кафедра информационных систем",
            degree: "к.т.н.",
            maxLoad: 8,
        },
        {
            fio: "Иванова Мария Сергеевна",
            email: "ivanova@demo.ru",
            department: "Кафедра информационных систем",
            degree: "д.т.н.",
            maxLoad: 7,
        },
        {
            fio: "Кузнецов Александр Сергеевич",
            email: "kuznetsov@demo.ru",
            department: "Кафедра программной инженерии",
            degree: "д.т.н.",
            maxLoad: 7,
        },
        {
            fio: "Смирнова Ольга Владимировна",
            email: "smirnova@demo.ru",
            department: "Кафедра программной инженерии",
            degree: "к.т.н.",
            maxLoad: 8,
        },
        {
            fio: "Соколов Дмитрий Андреевич",
            email: "sokolov@demo.ru",
            department: "Кафедра прикладной математики",
            degree: "д.ф.-м.н.",
            maxLoad: 7,
        },
        {
            fio: "Новиков Сергей Владимирович",
            email: "novikov@demo.ru",
            department: "Кафедра информационных систем",
            degree: "—",
            maxLoad: 9,
        },
        {
            fio: "Морозов Андрей Петрович",
            email: "morozov@demo.ru",
            department: "Кафедра кибербезопасности",
            degree: "д.т.н.",
            maxLoad: 7,
        },
        {
            fio: "Фёдорова Татьяна Сергеевна",
            email: "fedorova@demo.ru",
            department: "Кафедра программной инженерии",
            degree: "к.т.н.",
            maxLoad: 8,
        },
    ];

    const STUDENT_LAST_NAMES = [
        "Абрамов",
        "Авдеев",
        "Агеев",
        "Аксёнов",
        "Александров",
        "Алексеев",
        "Андреев",
        "Анисимов",
        "Антонов",
        "Артемьев",
        "Афанасьев",
        "Баранов",
        "Белов",
        "Беляев",
        "Бирюков",
        "Блинов",
        "Богданов",
        "Большаков",
        "Борисов",
        "Брагин",
        "Быков",
        "Васильев",
        "Веселов",
        "Виноградов",
        "Власов",
        "Волков",
        "Воробьёв",
        "Воронов",
        "Гаврилов",
        "Галкин",
        "Герасимов",
        "Гладков",
        "Голубев",
        "Горбунов",
        "Гордеев",
        "Горшков",
        "Григорьев",
        "Громов",
        "Гусев",
        "Давыдов",
        "Данилов",
        "Дементьев",
        "Денисов",
        "Дмитриев",
        "Долгов",
        "Дроздов",
        "Дьяконов",
        "Евдокимов",
        "Егоров",
        "Ежов",
        "Емельянов",
        "Ерёмин",
        "Ершов",
        "Ефимов",
        "Жданов",
        "Жуков",
        "Журавлёв",
        "Зайцев",
        "Захаров",
        "Зимин",
        "Зуев",
        "Иванов",
        "Игнатов",
        "Ильин",
        "Исаев",
        "Кабанов",
        "Казаков",
        "Калинин",
        "Капустин",
        "Карасёв",
        "Карпов",
        "Кириллов",
        "Ковалёв",
        "Козлов",
        "Колесников",
        "Комаров",
        "Кондратьев",
        "Кононов",
        "Королёв",
        "Костин",
        "Котов",
        "Кошелев",
        "Крылов",
        "Кудрявцев",
        "Кузнецов",
        "Кузьмин",
        "Кулагин",
        "Куликов",
        "Лаврентьев",
        "Лазарев",
        "Лебедев",
        "Лобанов",
        "Логинов",
        "Лукьянов",
        "Макаров",
        "Максимов",
        "Мамонтов",
        "Маркин",
        "Маслов",
        "Матвеев",
        "Медведев",
        "Мельников",
        "Миронов",
        "Михайлов",
        "Морозов",
        "Муравьёв",
        "Мухин",
        "Назаров",
        "Наумов",
        "Некрасов",
        "Никитин",
        "Николаев",
        "Новиков",
        "Носков",
        "Овчинников",
        "Одинцов",
        "Орехов",
        "Орлов",
        "Осипов",
        "Павлов",
        "Панов",
        "Пантелеев",
        "Панфилов",
        "Пахомов",
        "Петров",
        "Петухов",
        "Пирогов",
        "Платонов",
        "Поляков",
        "Попов",
        "Потапов",
        "Прохоров",
        "Родионов",
        "Рожков",
        "Романов",
        "Русаков",
        "Рыбаков",
        "Рябов",
        "Савельев",
        "Савин",
        "Сазонов",
        "Самойлов",
        "Сафонов",
        "Селезнёв",
        "Семёнов",
        "Сергеев",
        "Сидоров",
        "Симонов",
        "Скворцов",
        "Смирнов",
        "Соболев",
        "Соколов",
        "Соловьёв",
        "Сорокин",
        "Степанов",
        "Стрелков",
        "Субботин",
        "Суворов",
        "Суханов",
        "Тарасов",
        "Терентьев",
        "Тимофеев",
        "Титов",
        "Тихонов",
        "Токарев",
        "Трофимов",
        "Уваров",
        "Ульянов",
        "Фадеев",
        "Фёдоров",
        "Филиппов",
        "Фомин",
        "Фролов",
        "Харитонов",
        "Хохлов",
        "Царёв",
        "Цветков",
        "Чернов",
        "Чистяков",
        "Шаповалов",
        "Шаров",
        "Шевелёв",
        "Шестаков",
        "Шилов",
        "Ширяев",
        "Шишкин",
        "Щербаков",
        "Щукин",
        "Юдин",
        "Юрьев",
        "Яковлев",
        "Якушев",
        "Яшин",
    ];

    const MALE_FIRST = [
        "Александр",
        "Алексей",
        "Андрей",
        "Антон",
        "Аркадий",
        "Арсений",
        "Артём",
        "Артур",
        "Богдан",
        "Борис",
        "Вадим",
        "Валентин",
        "Валерий",
        "Василий",
        "Виктор",
        "Виталий",
        "Владимир",
        "Владислав",
        "Вячеслав",
        "Геннадий",
        "Георгий",
        "Глеб",
        "Григорий",
        "Даниил",
        "Денис",
        "Дмитрий",
        "Евгений",
        "Егор",
        "Иван",
        "Игорь",
        "Илья",
        "Кирилл",
        "Константин",
        "Лев",
        "Леонид",
        "Максим",
        "Марк",
        "Матвей",
        "Михаил",
        "Никита",
        "Николай",
        "Олег",
        "Павел",
        "Пётр",
        "Роман",
        "Руслан",
        "Сергей",
        "Станислав",
        "Степан",
        "Тимофей",
        "Тимур",
        "Фёдор",
        "Эдуард",
        "Юрий",
        "Ярослав",
    ];

    const FEMALE_FIRST = [
        "Александра",
        "Алина",
        "Алиса",
        "Анастасия",
        "Ангелина",
        "Анна",
        "Антонина",
        "Валентина",
        "Валерия",
        "Варвара",
        "Вера",
        "Вероника",
        "Виктория",
        "Галина",
        "Дарья",
        "Диана",
        "Ева",
        "Евгения",
        "Екатерина",
        "Елена",
        "Елизавета",
        "Жанна",
        "Злата",
        "Инна",
        "Ирина",
        "Карина",
        "Кира",
        "Кристина",
        "Ксения",
        "Лариса",
        "Лидия",
        "Любовь",
        "Людмила",
        "Маргарита",
        "Марина",
        "Мария",
        "Надежда",
        "Наталья",
        "Ника",
        "Нина",
        "Оксана",
        "Олеся",
        "Ольга",
        "Полина",
        "Раиса",
        "Регина",
        "Римма",
        "Светлана",
        "Серафима",
        "София",
        "Тамара",
        "Татьяна",
        "Ульяна",
        "Юлия",
        "Яна",
    ];

    const MALE_MIDDLE = [
        "Александрович",
        "Алексеевич",
        "Андреевич",
        "Антонович",
        "Аркадьевич",
        "Арсеньевич",
        "Артёмович",
        "Артурович",
        "Богданович",
        "Борисович",
        "Вадимович",
        "Валентинович",
        "Валерьевич",
        "Васильевич",
        "Викторович",
        "Витальевич",
        "Владимирович",
        "Владиславович",
        "Вячеславович",
        "Геннадьевич",
        "Георгиевич",
        "Глебович",
        "Григорьевич",
        "Данилович",
        "Денисович",
        "Дмитриевич",
        "Евгеньевич",
        "Егорович",
        "Иванович",
        "Игоревич",
        "Ильич",
        "Кириллович",
        "Константинович",
        "Леонидович",
        "Максимович",
        "Маркович",
        "Матвеевич",
        "Михайлович",
        "Никитич",
        "Николаевич",
        "Олегович",
        "Павлович",
        "Петрович",
        "Романович",
        "Русланович",
        "Сергеевич",
        "Станиславович",
        "Степанович",
        "Тимофеевич",
        "Тимурович",
        "Фёдорович",
        "Эдуардович",
        "Юрьевич",
        "Ярославович",
    ];

    const FEMALE_MIDDLE = [
        "Александровна",
        "Алексеевна",
        "Андреевна",
        "Антоновна",
        "Аркадьевна",
        "Арсеньевна",
        "Артёмовна",
        "Артуровна",
        "Богдановна",
        "Борисовна",
        "Вадимовна",
        "Валентиновна",
        "Валерьевна",
        "Васильевна",
        "Викторовна",
        "Витальевна",
        "Владимировна",
        "Владиславовна",
        "Вячеславовна",
        "Геннадьевна",
        "Георгиевна",
        "Глебовна",
        "Григорьевна",
        "Даниловна",
        "Денисовна",
        "Дмитриевна",
        "Евгеньевна",
        "Егоровна",
        "Ивановна",
        "Игоревна",
        "Ильинична",
        "Кирилловна",
        "Константиновна",
        "Леонидовна",
        "Максимовна",
        "Марковна",
        "Матвеевна",
        "Михайловна",
        "Никитична",
        "Николаевна",
        "Олеговна",
        "Павловна",
        "Петровна",
        "Романовна",
        "Руслановна",
        "Сергеевна",
        "Станиславовна",
        "Степановна",
        "Тимофеевна",
        "Тимуровна",
        "Фёдоровна",
        "Эдуардовна",
        "Юрьевна",
        "Ярославовна",
    ];

    const GROUPS = [
        {
            group: "ПИ-21-1",
            course: 3,
            faculty: "ФИТ",
            direction: "Программная инженерия",
        },
        {
            group: "ПИ-21-2",
            course: 3,
            faculty: "ФИТ",
            direction: "Программная инженерия",
        },
        {
            group: "ПИ-22-1",
            course: 2,
            faculty: "ФИТ",
            direction: "Программная инженерия",
        },
        {
            group: "ПИ-22-2",
            course: 2,
            faculty: "ФИТ",
            direction: "Программная инженерия",
        },
        {
            group: "ПИ-20-1",
            course: 4,
            faculty: "ФИТ",
            direction: "Программная инженерия",
        },
        {
            group: "ИВТ-21-1",
            course: 3,
            faculty: "ФИТ",
            direction: "Информатика и вычислительная техника",
        },
        {
            group: "ИВТ-22-1",
            course: 2,
            faculty: "ФИТ",
            direction: "Информатика и вычислительная техника",
        },
        {
            group: "ИС-21-1",
            course: 3,
            faculty: "ФИТ",
            direction: "Информационные системы",
        },
        {
            group: "ИС-22-1",
            course: 2,
            faculty: "ФИТ",
            direction: "Информационные системы",
        },
        {
            group: "ПМ-21-1",
            course: 3,
            faculty: "ФПМ",
            direction: "Прикладная математика",
        },
        {
            group: "ПМ-22-1",
            course: 2,
            faculty: "ФПМ",
            direction: "Прикладная математика",
        },
        {
            group: "КБ-21-1",
            course: 3,
            faculty: "ФИТ",
            direction: "Кибербезопасность",
        },
        {
            group: "КБ-22-1",
            course: 2,
            faculty: "ФИТ",
            direction: "Кибербезопасность",
        },
    ];

    const TOPICS = [
        "Информационная система управления проектами на основе нечёткой логики",
        "Нейросетевые методы в образовании",
        "Блокчейн-технологии в логистике",
        "Применение нечёткой логики в оценке студентов",
        "Мобильное приложение для кампуса",
        "Аналитика больших данных в вузе",
        "Чат-бот для приёмной комиссии",
        "Система распознавания лиц в пропускном режиме",
        "Рекомендательная система для подбора курсов",
        "Автоматизация документооборота кафедры",
        "Мониторинг успеваемости студентов",
        "Веб-платформа для научных конференций",
        "Оптимизация расписания занятий",
        "Электронный журнал успеваемости",
        "Система поддержки принятия решений на основе Мамдани",
        "Разработка REST API для образовательной платформы",
        "Веб-приложение для учёта научных публикаций",
        "Система контроля версий студенческих работ",
        "Автоматическая проверка оригинальности текстов",
        "Платформа для онлайн-тестирования студентов",
        "Микросервисная архитектура для вузовских систем",
        "Система прогнозирования успеваемости на ML",
        "Приложение для учёта посещаемости с QR-кодами",
        "Виртуальный ассистент для студентов на NLP",
        "Система анализа качества образования",
        "Веб-сервис для обмена учебными материалами",
        "Интерактивная карта кампуса с AR",
        "Система управления научными грантами",
        "Платформа для peer-review студенческих работ",
        "Автоматизация формирования отчётов кафедры",
        "Приложение для совместной работы над проектами",
        "Система мониторинга нагрузки преподавателей",
        "База знаний с поиском на основе графов",
        "Инструмент для визуализации учебных планов",
        "Система генерации тестовых заданий",
        "Платформа для студенческих стартапов",
        "Онлайн-портфолио студентов и выпускников",
        "Система управления научными конференциями",
        "Приложение для трекинга практик и стажировок",
        "Интеграционная шина для вузовских систем",
        "Сервис анализа отзывов о преподавателях",
        "Платформа для геймификации обучения",
        "Система документооборота приёмной комиссии",
        "Инструмент для планирования учебной нагрузки",
        "Приложение для учёта внеучебной деятельности",
        "Система поддержки инклюзивного образования",
        "Платформа для наставничества «студент-студент»",
        "Сервис анализа эффективности курсов",
        "Система дистанционного прокторинга",
        "Платформа для научных коллабораций",
        "Веб-приложение для учёта стипендий",
        "Система автоматического реферирования текстов",
        "Инструмент для визуализации успеваемости",
        "Сервис подбора научного руководителя",
        "Платформа для обмена опытом преподавателей",
        "Система учёта публикационной активности",
        "Приложение для организации студенческих олимпиад",
        "Платформа для проектного обучения",
        "Сервис мониторинга качества онлайн-курсов",
        "Система управления академической мобильностью",
        "Инструмент анализа рынка труда для студентов",
        "Электронная библиотека учебных материалов",
        "Система проверки на антиплагиат",
        "Приложение для учёта научных достижений",
        "Веб-сервис для организации практик",
        "Система прогнозирования отсева студентов",
        "Платформа для интерактивных лекций",
        "Мобильный кампус с навигацией",
        "Система анкетирования и опросов",
        "Автоматизированная система расписания",
        "Сервис для поиска научных статей",
        "Платформа для обмена задачами между студентами",
        "Система учёта лабораторных работ",
        "Приложение для организации дедлайнов",
        "Веб-платформа для портфолио преподавателей",
        "Система электронного голосования в вузе",
        "Приложение для учёта спортивных достижений",
        "Платформа для организации дней открытых дверей",
        "Система управления научными лабораториями",
        "Сервис рекомендаций научных статей",
        "Приложение для отслеживания психологического климата",
    ];

    const STAGE_NAMES = [
        "Обзор литературы",
        "Постановка задачи",
        "Анализ предметной области",
        "Проектирование архитектуры",
        "Разработка модуля 1",
        "Разработка модуля 2",
        "Разработка модуля 3",
        "Интеграция компонентов",
        "Тестирование",
        "Отладка",
        "Апробация",
        "Оптимизация",
        "Оформление по ГОСТу",
        "Подготовка презентации",
        "Написание аннотации",
        "Предзащита",
        "Финальная доработка",
        "Рецензирование",
    ];

    const TASK_NAMES = [
        "Изучить предметную область",
        "Составить план работы",
        "Согласовать ТЗ с руководителем",
        "Написать главу 1",
        "Написать главу 2",
        "Написать главу 3",
        "Провести эксперимент",
        "Оформить результаты",
        "Подготовить слайды",
        "Написать аннотацию",
        "Проверить орфографию",
        "Подготовить обзор литературы",
        "Описать методологию",
        "Построить UML-диаграммы",
        "Настроить CI/CD",
        "Провести код-ревью",
        "Подготовить демо-версию",
        "Провести юзабилити-тест",
        "Написать документацию",
        "Собрать обратную связь",
        "Провести нагрузочное тестирование",
        "Описать архитектуру системы",
        "Подготовить диаграммы последовательности",
        "Провести сравнительный анализ",
        "Оформить библиографию",
        "Подготовить приложение",
        "Проверить с руководителем",
        "Устранить замечания",
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
        "Раздел 1.2 требует больше ссылок на источники.",
        "Отличный анализ! Добавьте сравнительную таблицу.",
        "Графики хорошие, но подписи мелкие.",
        "Стоит добавить блок-схему алгоритма.",
        "Проверьте единообразие терминологии.",
        "Хорошая динамика, но отставание по срокам.",
        "Рекомендую добавить раздел о практической значимости.",
        "Обратите внимание на оформление формул.",
        "Уникальность текста в норме — продолжайте.",
        "Финальная версия выглядит профессионально.",
        "Стоит добавить больше практических примеров.",
        "Раздел 3.1 нужно расширить.",
        "Хорошая идея, но обоснование слабовато.",
        "Проверьте ссылки на источники — некоторые некорректны.",
        "Добавьте сравнительную таблицу существующих решений.",
    ];

    const CONSULT_TOPICS = [
        "Обсуждение главы 1",
        "Обсуждение главы 2",
        "Обсуждение главы 3",
        "Уточнение методологии",
        "Предзащита работы",
        "Разбор замечаний руководителя",
        "План дальнейших действий",
        "Проверка практической части",
        "Обсуждение результатов эксперимента",
        "Подготовка к защите",
        "Промежуточный контроль",
        "Обсуждение архитектуры системы",
        "Проверка оформления ГОСТ",
        "Утверждение темы работы",
        "Финальная консультация перед защитой",
    ];

    const CONSULT_COMMENTS = [
        "Прошу помочь с текущими вопросами.",
        "Есть несколько вопросов по методологии.",
        "Хочу обсудить результаты эксперимента.",
        "Нужна консультация по оформлению.",
        "Возникли сложности с реализацией.",
        "Хочу уточнить дальнейший план.",
        "Нужно согласовать архитектуру.",
        "Есть вопросы по литературе.",
        "Требуется проверка промежуточных результатов.",
        "Прошу оценить текущий прогресс.",
    ];

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
    function daysAgoStr(n) {
        return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    }
    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    function pickMany(arr, count) {
        return shuffle(arr).slice(0, count);
    }

    function makeUniqueNames(count) {
        const used = new Set();
        const result = [];
        let attempts = 0;
        const maxAttempts = count * 30;

        while (result.length < count && attempts < maxAttempts) {
            attempts++;
            const isMale = Math.random() < 0.55;
            const first = isMale ? pick(MALE_FIRST) : pick(FEMALE_FIRST);
            const middle = isMale ? pick(MALE_MIDDLE) : pick(FEMALE_MIDDLE);
            const baseLast = pick(STUDENT_LAST_NAMES);
            const last = isMale ? baseLast : baseLast + "а";
            const fio = `${last} ${first} ${middle}`;
            if (used.has(fio)) continue;
            used.add(fio);
            result.push(fio);
        }
        return result;
    }

    function generate() {
        const existingUsers = Storage.getUsers();

        if (existingUsers.length > 15) {
            if (
                !confirm(
                    `В системе уже ${existingUsers.length} пользователей. ` +
                        `Демо-данные добавятся к существующим. Продолжить?`,
                )
            )
                return;
        }

        App.toast("Генерация демо-данных...");

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
                fio: t.fio,
                email: t.email,
                pass: hashPass("123456"),
                department: t.department,
                degree: t.degree,
                maxLoad: t.maxLoad,
                blocked: false,
                createdAt: daysAgo(randInt(300, 400)),
            };
            users.push(teacher);
            teachers.push(teacher);
            existingEmails.add(t.email);
        }

        const STUDENT_COUNT = 35;
        const studentNames = makeUniqueNames(STUDENT_COUNT);

        const students = [];
        for (let i = 0; i < studentNames.length; i++) {
            const fio = studentNames[i];
            const email = `student${i + 1}@demo.ru`;
            if (existingEmails.has(email)) {
                const found = users.find((u) => u.email === email);
                if (found) students.push(found);
                continue;
            }
            const g = GROUPS[i % GROUPS.length];
            const student = {
                id: uid(),
                role: "student",
                fio,
                email,
                pass: hashPass("123456"),
                faculty: g.faculty,
                group: g.group,
                course: g.course,
                blocked: false,
                createdAt: daysAgo(randInt(200, 400)),
            };
            users.push(student);
            students.push(student);
            existingEmails.add(email);
        }

        if (teachers.length === 0 || students.length === 0) {
            App.toast("Не удалось создать пользователей");
            return;
        }

        Storage.setUsers(users);

        const works = Storage.getWorks();
        const stages = Storage.getStages();
        const tasks = Storage.getTasks();
        const versions = Storage.getVersions();
        const comments = Storage.getComments();

        const statusPlan = [
            { status: "pending", count: 5 },
            { status: "active", count: 20 },
            { status: "review", count: 10 },
            { status: "approved", count: 7 },
            { status: "done", count: 22 },
            { status: "rejected", count: 6 },
        ];

        let topicIdx = 0;
        let globalIdx = 0;
        const activeWorks = [];

        for (const plan of statusPlan) {
            for (let i = 0; i < plan.count; i++) {
                const student = students[globalIdx % students.length];
                const teacher = teachers[globalIdx % teachers.length];
                const topic = TOPICS[topicIdx % TOPICS.length];
                topicIdx++;
                globalIdx++;

                const createdAt = daysAgo(randInt(30, 380));
                const updatedAt = daysAgo(randInt(0, 20));

                let deadline;
                if (plan.status === "done" || plan.status === "rejected") {
                    deadline = daysAgoStr(randInt(30, 200));
                } else if (Math.random() < 0.15) {
                    deadline = daysAgoStr(randInt(1, 15));
                } else if (Math.random() < 0.25) {
                    deadline = daysAhead(randInt(1, 5));
                } else {
                    deadline = daysAhead(randInt(10, 120));
                }

                const work = {
                    id: uid(),
                    studentId: student.id,
                    teacherId: teacher.id,
                    type: pick(["course", "diploma", "vkr", "master"]),
                    topic,
                    description:
                        `Работа посвящена исследованию в области «${topic.toLowerCase()}». ` +
                        `Рассматриваются современные подходы и предлагается авторское решение.`,
                    deadline,
                    status: plan.status,
                    createdAt,
                    updatedAt,
                };

                if (plan.status === "done") {
                    work.finalGrade = pick([3, 4, 4, 4, 5, 5, 5, 5]);
                    work.gradeComment = pick([
                        "Отличная защита, чёткие ответы на вопросы",
                        "Хорошая работа, но были замечания",
                        "Работа заслуживает высокой оценки",
                        "Уверенная защита, но не все вопросы раскрыты",
                        "Прекрасная презентация и глубокий анализ",
                        "Есть небольшие недочёты, но в целом отлично",
                    ]);
                    work.defendedAt = daysAgo(randInt(1, 180));
                }

                if (plan.status === "rejected") {
                    work.rejectReason = pick([
                        "Тема недостаточно раскрыта, требуется переработка",
                        "Слишком общая формулировка, нужна конкретика",
                        "Не соответствует направлению подготовки",
                        "Дублирование с другой работой",
                    ]);
                }

                if (["review", "approved", "done"].includes(plan.status)) {
                    work.supScore = randInt(4, 10);
                    work.orig = randInt(45, 95);
                    work.gost = randInt(50, 100);
                }

                works.push(work);

                if (["active", "review"].includes(plan.status)) {
                    activeWorks.push(work);
                }

                if (
                    ["active", "review", "approved", "done"].includes(
                        plan.status,
                    )
                ) {
                    const stageCount = randInt(5, 10);
                    const stageNames = pickMany(STAGE_NAMES, stageCount);

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
                            description: isDone ? "Выполнено в срок" : "",
                            deadline: daysAhead(randInt(-10, 60)),
                            weight: randInt(1, 4),
                            order: k + 1,
                            done: isDone,
                            completedAt: isDone
                                ? daysAgo(randInt(1, 60))
                                : null,
                            createdAt,
                        });
                    }
                }

                if (
                    ["active", "review", "approved", "done"].includes(
                        plan.status,
                    )
                ) {
                    const taskCount = randInt(5, 12);
                    const taskNames = pickMany(TASK_NAMES, taskCount);

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
                            "done",
                            "progress",
                            "progress",
                            "todo",
                            "todo",
                            "review",
                            "todo",
                            "done",
                        ].slice(0, taskCount);
                    } else {
                        cols = Array(taskCount).fill("todo");
                    }

                    for (let k = 0; k < taskCount; k++) {
                        const col = cols[k] || "todo";
                        const task = {
                            id: uid(),
                            workId: work.id,
                            title: taskNames[k],
                            col,
                            deadline:
                                Math.random() > 0.4
                                    ? daysAhead(randInt(-5, 30))
                                    : null,
                            createdAt,
                            updatedAt,
                        };
                        if (col === "done" && Math.random() > 0.5) {
                            task.reviewedBy = teacher.id;
                            task.reviewedAt = daysAgo(randInt(1, 20));
                            task.reviewStatus = "approved";
                        }
                        tasks.push(task);
                    }
                }

                if (
                    ["active", "review", "approved", "done"].includes(
                        plan.status,
                    )
                ) {
                    const vCount = randInt(2, 7);
                    for (let v = 0; v < vCount; v++) {
                        versions.push({
                            id: uid(),
                            workId: work.id,
                            version: `1.${v}`,
                            filename: `chapter_${v + 1}.docx`,
                            comment: pick([
                                `Добавлена глава ${v + 1}`,
                                "Исправлены замечания руководителя",
                                "Расширено введение",
                                "Обновлён список литературы",
                                "Доработана практическая часть",
                                "Финальная версия главы",
                                "Добавлены примеры и иллюстрации",
                                "Уточнены выводы",
                            ]),
                            createdAt: daysAgo(randInt(1, 90)),
                        });
                    }
                }

                if (
                    ["active", "review", "approved", "done"].includes(
                        plan.status,
                    )
                ) {
                    const cCount = randInt(3, 10);
                    for (let c = 0; c < cCount; c++) {
                        comments.push({
                            id: uid(),
                            workId: work.id,
                            authorId: teacher.id,
                            text: pick(COMMENT_TEXTS),
                            createdAt: daysAgo(randInt(1, 60)),
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

        const auditLog = Storage.get("fp_audit", []);
        const auditActions = [
            "Создана работа",
            "Утверждена заявка",
            "Оценка выставлена",
            "Работа защищена",
            "Загружена версия",
            "Добавлено замечание",
            "Создан пользователь",
            "Пользователь заблокирован",
            "Работа отправлена на проверку",
            "Задача одобрена",
            "Задача возвращена",
            "Консультация подтверждена",
            "Экспорт PDF",
            "Проверка ГОСТа",
            "Изменена ФП",
            "Вход в систему",
            "Загружен файл",
            "Обновлён профиль",
        ];

        for (let i = 0; i < 80; i++) {
            const u = pick(users);
            auditLog.push({
                id: uid(),
                userId: u.id,
                userFio: u.fio,
                userRole: u.role,
                action: pick(auditActions),
                target: pick(TOPICS).slice(0, 50),
                details: Math.random() > 0.7 ? "Автоматическая запись" : "",
                type: pick([
                    "info",
                    "info",
                    "info",
                    "positive",
                    "positive",
                    "warning",
                    "negative",
                ]),
                createdAt: daysAgo(randInt(1, 365)),
            });
        }
        Storage.set("fp_audit", auditLog);

        const notifs = Storage.get("fp_notifications", []);

        const activeUserIds = new Set();
        works.forEach((w) => {
            activeUserIds.add(String(w.studentId));
            activeUserIds.add(String(w.teacherId));
        });

        for (const id of activeUserIds) {
            const u = users.find((x) => String(x.id) === id);
            if (!u) continue;
            notifs.push({
                id: uid(),
                userId: u.id,
                type: "info",
                title: "Добро пожаловать в Meridian",
                text: "Система поможет вам вести работу над курсовой или дипломной.",
                read: Math.random() > 0.5,
                createdAt: daysAgo(randInt(30, 200)),
            });
        }

        works
            .filter((w) => w.status === "pending")
            .forEach((w) => {
                notifs.push({
                    id: uid(),
                    userId: w.teacherId,
                    type: "info",
                    title: "Новая заявка на руководство",
                    text: `«${w.topic.slice(0, 60)}»`,
                    read: false,
                    link: { view: "requests" },
                    createdAt: daysAgo(randInt(1, 20)),
                });
            });

        works
            .filter((w) => w.status === "review")
            .forEach((w) => {
                notifs.push({
                    id: uid(),
                    userId: w.studentId,
                    type: "info",
                    title: "Работа на проверке",
                    text: `«${w.topic.slice(0, 60)}» — руководитель проверяет`,
                    read: Math.random() > 0.5,
                    link: { view: "my-work" },
                    createdAt: daysAgo(randInt(1, 15)),
                });
            });

        Storage.set("fp_notifications", notifs);

        const consults = Storage.get("fp_consults", []);
        const statuses = ["pending", "approved", "done", "rejected"];

        for (let i = 0; i < 15; i++) {
            const work = pick(activeWorks);
            if (!work) continue;

            const datetime = new Date(
                Date.now() +
                    randInt(-15, 30) * 86400000 +
                    randInt(0, 12) * 3600000,
            ).toLocaleString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });

            const status = pick(statuses);

            consults.push({
                id: uid(),
                studentId: work.studentId,
                teacherId: work.teacherId,
                datetime,
                topic: pick(CONSULT_TOPICS),
                comment: pick(CONSULT_COMMENTS),
                status,
                proposedBy: "student",
                response:
                    status === "rejected"
                        ? pick([
                              "Занят в это время",
                              "Перенесём на другую неделю",
                              "К сожалению, не смогу",
                          ])
                        : status === "approved"
                          ? "Подтверждаю, встретимся в назначенное время."
                          : "",
                createdAt: daysAgo(randInt(1, 30)),
                updatedAt: daysAgo(randInt(0, 5)),
            });
        }
        Storage.set("fp_consults", consults);

        const refs = Storage.get("fp_refs", null);
        if (!refs) {
            Storage.set("fp_refs", {
                faculties: ["ФИТ", "ФПМ", "ФЭН", "ГФ", "ФМО"],
                departments: [
                    "Кафедра информационных систем",
                    "Кафедра программной инженерии",
                    "Кафедра прикладной математики",
                    "Кафедра кибербезопасности",
                    "Кафедра математического моделирования",
                ],
                groups: [
                    "ПИ-21-1",
                    "ПИ-21-2",
                    "ПИ-22-1",
                    "ПИ-22-2",
                    "ПИ-20-1",
                    "ИВТ-21-1",
                    "ИВТ-22-1",
                    "ИС-21-1",
                    "ИС-22-1",
                    "ПМ-21-1",
                    "ПМ-22-1",
                    "КБ-21-1",
                    "КБ-22-1",
                ],
                directions: [
                    "Программная инженерия",
                    "Информационные системы",
                    "Информатика и вычислительная техника",
                    "Прикладная математика",
                    "Кибербезопасность",
                ],
            });
        }

        const settings = Storage.get("fp_settings", null);
        if (!settings) {
            Storage.set("fp_settings", {
                systemName: "Meridian",
                academicYear: "2024/2025",
                defaultDeadlineDays: 30,
                notifyBeforeDays: 3,
            });
        }

        App.toast(
            `Готово! ${students.length} студентов, ${teachers.length} преподавателей, ${works.length} работ`,
        );

        if (typeof App.refreshNotifications === "function") {
            App.refreshNotifications();
        }

        setTimeout(() => {
            App.navigate("dashboard");
        }, 800);
    }

    function clearAll() {
        if (
            !confirm(
                "Удалить ВСЕ данные?\n\nЭто действие необратимо. Продолжить?",
            )
        )
            return;
        if (!confirm("Вы точно уверены? Все данные будут потеряны.")) return;

        Object.keys(localStorage).forEach((key) => {
            if (key.startsWith("fp_")) localStorage.removeItem(key);
        });

        location.reload();
    }

    return {
        generate,
        clearAll,
    };
})();
