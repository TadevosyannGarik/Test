/* =========================================================
   APP — запуск, навигация, рендер разделов, модалки, toast
   ========================================================= */
const App = (() => {
    let currentUser = null;
    let toastTimer = null;

    /* =========================================================
       НАВИГАЦИЯ — ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ

       Каждый пункт меню описывается один раз:
         id      — идентификатор (совпадает с ключом в VIEWS)
         icon    — функция-иконка из SVG
         label   — подпись для меню
         roles   — массив ролей, которым доступен пункт
         order   — порядок в меню (число; сортировка по возрастанию)

       Чтобы добавить новый пункт — просто добавь объект в NAV_ITEMS.
       Чтобы ограничить роль — допиши/убери её в roles.
       ========================================================= */
    const NAV_ITEMS = [
        // Общие для всех
        {
            id: "dashboard",
            icon: SVG.dashboard,
            label: "Дашборд",
            roles: ["student", "teacher", "admin"],
            order: 10,
        },

        // Студент
        {
            id: "my-work",
            icon: SVG.folder,
            label: "Моя работа",
            roles: ["student"],
            order: 20,
        },
        {
            id: "archived",
            icon: SVG.archive,
            label: "Завершённые",
            roles: ["student"],
            order: 30,
        },
        {
            id: "docx",
            icon: SVG.fileText,
            label: "ГОСТ",
            roles: ["student"],
            order: 60,
        },
        {
            id: "calendar",
            icon: SVG.calendar,
            label: "Календарь",
            roles: ["student"],
            order: 90,
        },
        {
            id: "activity",
            icon: SVG.log,
            label: "Активность",
            roles: ["student"],
            order: 100,
        },

        // Преподаватель
        {
            id: "requests",
            icon: SVG.clipboard,
            label: "Заявки",
            roles: ["teacher"],
            order: 20,
        },
        {
            id: "students",
            icon: SVG.users,
            label: "Студенты",
            roles: ["teacher"],
            order: 30,
        },
        {
            id: "review",
            icon: SVG.checkCircle,
            label: "Проверка",
            roles: ["teacher"],
            order: 40,
        },
        {
            id: "tasks-review",
            icon: SVG.check,
            label: "Задачи",
            roles: ["teacher"],
            order: 50,
        },
        {
            id: "rankings",
            icon: SVG.award,
            label: "Рейтинги",
            roles: ["teacher", "admin"],
            order: 70,
        },
        {
            id: "mfEditor",
            icon: SVG.settings,
            label: "Редактор ФП",
            roles: ["teacher", "admin"],
            order: 110,
        },
        {
            id: "rules",
            icon: SVG.settings,
            label: "Правила",
            roles: ["teacher", "admin"],
            order: 120,
        },

        // Админ
        {
            id: "users",
            icon: SVG.users,
            label: "Пользователи",
            roles: ["admin"],
            order: 20,
        },
        {
            id: "works",
            icon: SVG.folder,
            label: "Работы",
            roles: ["admin"],
            order: 30,
        },
        {
            id: "demo",
            icon: SVG.rocket,
            label: "Демо-данные",
            roles: ["admin"],
            order: 40,
        },
        {
            id: "audit",
            icon: SVG.log,
            label: "Аудит",
            roles: ["admin"],
            order: 80,
        },
        {
            id: "analytics",
            icon: SVG.trending,
            label: "Аналитика",
            roles: ["admin"],
            order: 90,
        },
        {
            id: "refs",
            icon: SVG.book,
            label: "Справочники",
            roles: ["admin"],
            order: 130,
        },
        {
            id: "settings",
            icon: SVG.settings,
            label: "Настройки",
            roles: ["admin"],
            order: 140,
        },

        // Общие (продолжение)
        {
            id: "mamdani",
            icon: SVG.brain,
            label: "Мамдани",
            roles: ["student", "teacher", "admin"],
            order: 50,
        },
        {
            id: "simulate",
            icon: SVG.sliders,
            label: "Симулятор",
            roles: ["student", "teacher", "admin"],
            order: 60,
        },
        {
            id: "consultations",
            icon: SVG.calendar,
            label: "Консультации",
            roles: ["student", "teacher", "admin"],
            order: 70,
        },
        {
            id: "stats",
            icon: SVG.trending,
            label: "Статистика",
            roles: ["student", "teacher"],
            order: 80,
        },
        {
            id: "profile",
            icon: SVG.user,
            label: "Профиль",
            roles: ["student", "teacher", "admin"],
            order: 999,
        },
    ];

    /**
     * Возвращает массив пунктов меню для заданной роли,
     * отсортированных по order.
     */
    function navItems(role) {
        if (!role) return [];
        return NAV_ITEMS.filter((it) => it.roles.includes(role)).sort(
            (a, b) => a.order - b.order,
        );
    }

    /* =========================================================
       МАППИНГ ДОЧЕРНИХ VIEW → РОДИТЕЛЬСКИМ ВКЛАДКАМ

       Используется для подсветки активной вкладки
       на детальных страницах (profile, work-detail, ...).
       ========================================================= */
    const VIEW_PARENT_MAP = {
        // Общие
        "create-work": "dashboard",
        "my-work": "dashboard",

        // Преподаватель
        "student-detail": "students",
        "request-detail": "requests",

        // Админ
        "teacher-profile": "users",
        "student-profile": "users",
        "work-detail": "works",
        "edit-work": "works",
    };

    function resolveActiveNavItem(viewId, role) {
        if (!viewId) return null;

        // 1. Если viewId сам является вкладкой — используем его
        const items = navItems(role);
        if (items.some((it) => it.id === viewId)) {
            return viewId;
        }

        // 2. Иначе — ищем в маппинге
        return VIEW_PARENT_MAP[viewId] || null;
    }

    /* =========================================================
       ХЕЛПЕРЫ
       ========================================================= */
    function roleName(r) {
        return r === "student"
            ? "Студент"
            : r === "teacher"
              ? "Преподаватель"
              : "Администратор";
    }

    function initials(fio) {
        if (!fio || typeof fio !== "string") return "?";
        const parts = fio.split(" ").filter(Boolean);
        if (parts.length === 0) return "?";
        return parts
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
    }

    /* =========================================================
       BOOT
       ========================================================= */
    function boot(user) {
        if (!user) return;

        if (user.blocked) {
            console.warn("[App] Пользователь заблокирован");
            if (typeof Auth !== "undefined" && Auth.logout) {
                Auth.logout();
            }
            return;
        }

        currentUser = user;

        const nameEl = document.getElementById("hUserName");
        const roleEl = document.getElementById("hUserRole");
        const avEl = document.getElementById("hAvatar");

        if (nameEl) nameEl.textContent = user.fio || "—";
        if (roleEl) roleEl.textContent = roleName(user.role);
        if (avEl) avEl.textContent = initials(user.fio);

        renderNav(user.role);
        navigate(defaultView(user.role));
        refreshNotifications();
    }

    function defaultView(role) {
        return "dashboard";
    }

    /* =========================================================
       РЕНДЕР НАВИГАЦИИ
       ========================================================= */
    function renderNav(role) {
        const nav = document.getElementById("mainNav");
        if (!nav) return;
        const items = navItems(role);

        let html = items
            .map(
                (it, i) => `
        <button data-view="${it.id}" class="${i === 0 ? "active" : ""}"
          onclick="App.navigate('${it.id}')">
          ${it.icon({ cls: "icon icon-sm" })}
          <span>${it.label}</span>
        </button>
      `,
            )
            .join("");

        if (role === "student") {
            html += `
        <button class="demo-launch-btn" onclick="DemoStudentLive.start()"
          title="Запустить автодемонстрацию функционала студента">
          <span class="pulse-dot"></span>
          ${SVG.play({ cls: "icon icon-sm" })}
          <span class="demo-btn-label">Демонстрация</span>
        </button>
      `;
        }

        nav.innerHTML = html;
    }

    /* =========================================================
       НАВИГАЦИЯ
       ========================================================= */
    function navigate(viewId, params) {
        if (!viewId) return;

        const nav = document.getElementById("mainNav");
        const hideNav = viewId === "create-work";
        if (nav) nav.style.display = hideNav ? "none" : "flex";

        const activeId = currentUser
            ? resolveActiveNavItem(viewId, currentUser.role)
            : viewId;

        document.querySelectorAll("#mainNav button").forEach((b) => {
            b.classList.toggle("active", b.dataset.view === activeId);
        });

        renderView(viewId, params);
        window.scrollTo(0, 0);
    }

    /**
     * Рендер раздела.
     * ВАЖНО: оборачиваем в <div class="view active"> для анимаций.
     */
    function renderView(viewId, params) {
        const root = document.getElementById("viewRoot");
        if (!root) return;

        if (!currentUser) {
            root.innerHTML = placeholder("Пользователь не авторизован");
            return;
        }

        let views = {};
        if (currentUser.role === "student" && typeof Student !== "undefined") {
            views = { ...Student.VIEWS };
        } else if (
            currentUser.role === "teacher" &&
            typeof Teacher !== "undefined"
        ) {
            views = { ...Teacher.VIEWS };
        } else if (
            currentUser.role === "admin" &&
            typeof Admin !== "undefined"
        ) {
            views = { ...Admin.VIEWS };
        }

        const fn = views[viewId];
        const afterFn = views[viewId + "_after"];

        if (fn) {
            try {
                root.innerHTML = `<div class="view active">${fn(params)}</div>`;
            } catch (err) {
                console.error("[App] Ошибка рендера раздела:", viewId, err);
                root.innerHTML = placeholder(
                    "Ошибка в разделе: " + viewId,
                    err.message,
                );
                return;
            }
            if (afterFn) {
                setTimeout(() => {
                    try {
                        afterFn(params);
                    } catch (err) {
                        console.error("[App] Ошибка _after:", viewId, err);
                        toast("Ошибка отрисовки: " + viewId);
                    }
                }, 0);
            }
        } else {
            root.innerHTML = `<div class="view active">${placeholder(
                "Раздел в разработке",
                `Раздел «${viewId}» ещё не реализован для вашей роли.`,
            )}</div>`;
        }
    }

    function placeholder(text, hint) {
        return `
      <div class="card">
        <div class="placeholder">
          <div class="placeholder-ico">${SVG.alertTriangle({ cls: "icon icon-2xl" })}</div>
          <div style="font-weight:500;margin-bottom:6px;">${text}</div>
          ${hint ? `<div style="font-size:12px;color:var(--txt-muted);">${hint}</div>` : ""}
        </div>
      </div>
    `;
    }

    /* =========================================================
       МОДАЛКИ
       ========================================================= */
    function openModal(html) {
        closeModal();
        const div = document.createElement("div");
        div.id = "modalHost";
        div.innerHTML = html;
        document.body.appendChild(div);

        const escHandler = (e) => {
            if (e.key === "Escape") {
                closeModal();
                document.removeEventListener("keydown", escHandler);
            }
        };
        document.addEventListener("keydown", escHandler);
    }

    function closeModal() {
        const el = document.getElementById("modalHost");
        if (el) el.remove();
    }

    /* =========================================================
       TOAST
       ========================================================= */
    function toast(msg) {
        const t = document.getElementById("toast");
        if (!t) return;
        t.textContent = msg;
        t.classList.add("show");
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
    }

    /* =========================================================
       УВЕДОМЛЕНИЯ
       ========================================================= */
    function refreshNotifications() {
        if (!currentUser) return;
        if (typeof Notifications === "undefined") return;

        try {
            const count = Notifications.unreadCount(currentUser.id);
            const el = document.getElementById("notifCount");
            const bell = document.getElementById("notifBell");
            if (!el || !bell) return;

            if (count > 0) {
                el.textContent = count > 9 ? "9+" : count;
                el.style.display = "";
                bell.classList.add("has-new");
            } else {
                el.style.display = "none";
                bell.classList.remove("has-new");
            }
        } catch (err) {
            console.warn("[App] refreshNotifications:", err);
        }
    }

    /* =========================================================
       ПУБЛИЧНЫЙ API
       ========================================================= */
    return {
        boot,
        navigate,
        openModal,
        closeModal,
        toast,
        refreshNotifications,
        getUser: () => currentUser,
        // Для отладки/расширения
        NAV_ITEMS,
        navItems,
        resolveActiveNavItem,
    };
})();

/* =========================================================
   ЗАПУСК
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
    if (typeof Auth === "undefined") {
        console.error("[App] Модуль Auth не загружен");
        return;
    }
    if (typeof Storage === "undefined") {
        console.error("[App] Модуль Storage не загружен");
        return;
    }

    Auth.seedDemo();
    Auth.pickRole("student");
    Auth.restoreSession();
});
