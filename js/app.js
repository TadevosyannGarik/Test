/* =========================================================
   APP — запуск, навигация, рендер разделов, модалки, toast
   + Анимации переходов между разделами
   ========================================================= */
const App = (() => {
    let currentUser = null;
    let toastTimer = null;

    /* =========================================================
       НАВИГАЦИЯ ПО РОЛЯМ
       ========================================================= */
    function navItems(role) {
        if (role === "student") {
            return [
                { id: "dashboard", icon: SVG.dashboard, label: "Дашборд" },
                { id: "my-work", icon: SVG.folder, label: "Моя работа" },
                { id: "archived", icon: SVG.archive, label: "Завершённые" },
                { id: "mamdani", icon: SVG.brain, label: "Мамдани" },
                { id: "simulate", icon: SVG.sliders, label: "Симулятор" },
                { id: "docx", icon: SVG.fileText, label: "ГОСТ" },
                {
                    id: "consultations",
                    icon: SVG.calendar,
                    label: "Консультации",
                },
                { id: "stats", icon: SVG.trending, label: "Статистика" },
                { id: "calendar", icon: SVG.calendar, label: "Календарь" },
                { id: "activity", icon: SVG.log, label: "Активность" },
                { id: "profile", icon: SVG.user, label: "Профиль" },
            ];
        }

        if (role === "teacher") {
            return [
                { id: "dashboard", icon: SVG.dashboard, label: "Дашборд" },
                { id: "requests", icon: SVG.clipboard, label: "Заявки" },
                { id: "students", icon: SVG.users, label: "Студенты" },
                { id: "review", icon: SVG.checkCircle, label: "Проверка" },
                { id: "tasks-review", icon: SVG.check, label: "Задачи" },
                { id: "mamdani", icon: SVG.brain, label: "Мамдани" },
                { id: "simulate", icon: SVG.sliders, label: "Симулятор" },
                { id: "rankings", icon: SVG.award, label: "Рейтинги" },
                {
                    id: "consultations",
                    icon: SVG.calendar,
                    label: "Консультации",
                },
                { id: "stats", icon: SVG.trending, label: "Статистика" },
                { id: "mfEditor", icon: SVG.settings, label: "Редактор ФП" },
                { id: "rules", icon: SVG.settings, label: "Правила" },
                { id: "profile", icon: SVG.user, label: "Профиль" },
            ];
        }

        return [
            { id: "dashboard", icon: SVG.dashboard, label: "Дашборд" },
            { id: "users", icon: SVG.users, label: "Пользователи" },
            { id: "works", icon: SVG.folder, label: "Работы" },
            { id: "demo", icon: SVG.rocket, label: "Демо-данные" },
            { id: "mamdani", icon: SVG.brain, label: "Мамдани" },
            { id: "simulate", icon: SVG.sliders, label: "Симулятор" },
            { id: "rankings", icon: SVG.award, label: "Рейтинги" },
            {
                id: "consultations",
                icon: SVG.calendar,
                label: "Консультации",
            },
            { id: "audit", icon: SVG.log, label: "Аудит" },
            { id: "analytics", icon: SVG.trending, label: "Аналитика" },
            { id: "mfEditor", icon: SVG.settings, label: "Редактор ФП" },
            { id: "rules", icon: SVG.settings, label: "Правила" },
            { id: "refs", icon: SVG.book, label: "Справочники" },
            { id: "settings", icon: SVG.settings, label: "Настройки" },
            { id: "profile", icon: SVG.user, label: "Профиль" },
        ];
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
       НАВИГАЦИЯ
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

    function navigate(viewId, params) {
        if (!viewId) return;

        const nav = document.getElementById("mainNav");
        const hideNav = viewId === "create-work";
        if (nav) nav.style.display = hideNav ? "none" : "flex";

        document.querySelectorAll("#mainNav button").forEach((b) => {
            b.classList.toggle("active", b.dataset.view === viewId);
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
                /* ГЛАВНОЕ ИЗМЕНЕНИЕ — оборачиваем контент в .view.active */
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
