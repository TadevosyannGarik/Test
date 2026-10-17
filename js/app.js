const App = (() => {
    let currentUser = null;
    let toastTimer = null;
    let _afterTimer = null;

    const NAV_ITEMS = [
        {
            id: "dashboard",
            icon: SVG.dashboard,
            label: "Дашборд",
            roles: ["student", "teacher", "admin"],
            order: 10,
        },
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
            id: "announcements",
            icon: SVG.bell,
            label: "Объявления",
            roles: ["student"],
            order: 15,
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
        {
            id: "announcements",
            icon: SVG.bell,
            label: "Объявления",
            roles: ["teacher"],
            order: 15,
        },
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
            id: "my-works",
            icon: SVG.folder,
            label: "Работы",
            roles: ["teacher"],
            order: 35,
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
            id: "rules",
            icon: SVG.settings,
            label: "Правила",
            roles: ["teacher", "admin"],
            order: 120,
        },
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
            id: "announcements",
            icon: SVG.bell,
            label: "Объявления",
            roles: ["admin"],
            order: 42,
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
        {
            id: "mamdani",
            icon: SVG.brain,
            label: "Мамдани",
            roles: ["student", "teacher"],
            order: 50,
        },
        {
            id: "simulate",
            icon: SVG.sliders,
            label: "Симулятор",
            roles: ["student", "teacher"],
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
        {
            id: "mfEditor",
            icon: SVG.settings,
            label: "Редактор ФП",
            roles: ["student"],
            order: 110,
        },
    ];

    function navItems(role) {
        if (!role) return [];
        return NAV_ITEMS.filter((it) => it.roles.includes(role)).sort(
            (a, b) => a.order - b.order,
        );
    }

    const VIEW_PARENT_MAP = {
        "create-work": "dashboard",
        "my-work": "dashboard",
        "student-detail": "students",
        "request-detail": "requests",
        "teacher-profile": "users",
        "student-profile": "users",
        "work-detail": "works",
        "edit-work": "works",
    };

    function resolveActiveNavItem(viewId, role) {
        if (!viewId) return null;
        const items = navItems(role);
        if (items.some((it) => it.id === viewId)) {
            return viewId;
        }
        return VIEW_PARENT_MAP[viewId] || null;
    }

    function roleName(r) {
        return r === "student"
            ? "Студент"
            : r === "teacher"
              ? "Преподаватель"
              : "Администратор";
    }

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
        if (avEl) avEl.textContent = Utils.initials(user.fio);

        renderNav(user.role);

        if (user.role === "admin") {
            document.body.classList.add("admin-layout");
            renderAdminSidebar(user);
        } else {
            document.body.classList.remove("admin-layout");
            const old = document.getElementById("adminSidebar");
            if (old) old.remove();
        }

        navigate(defaultView(user.role));
        refreshNotifications();
    }

    function defaultView(role) {
        return "dashboard";
    }

    function renderNav(role) {
        const nav = document.getElementById("mainNav");
        if (!nav) return;
        const items = navItems(role);
        const user = currentUser;

        let html = items
            .map((it, i) => {
                let badge = "";
                if (
                    it.id === "announcements" &&
                    user &&
                    typeof Announcements !== "undefined"
                ) {
                    const count = Announcements.unreadCount(user.id);
                    if (count > 0) {
                        badge = `<span class="nav-badge">${count > 9 ? "9+" : count}</span>`;
                    }
                }
                return `
        <button data-view="${it.id}" class="${i === 0 ? "active" : ""}"
          onclick="App.navigate('${it.id}')">
          ${it.icon({ cls: "icon icon-sm" })}
          <span>${it.label}</span>
          ${badge}
        </button>
      `;
            })
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

    function renderAdminSidebar(user) {
        let sb = document.getElementById("adminSidebar");
        if (!sb) {
            sb = document.createElement("aside");
            sb.id = "adminSidebar";
            sb.className = "admin-sidebar";
            document.body.appendChild(sb);
        }

        const users = Storage.getUsers();
        const works = Storage.getWorks();
        const consults =
            typeof Consult !== "undefined"
                ? (() => {
                      try {
                          return Consult.getAll();
                      } catch (e) {
                          return [];
                      }
                  })()
                : [];
        const announcements =
            typeof Announcements !== "undefined"
                ? (() => {
                      try {
                          return Announcements.getAll();
                      } catch (e) {
                          return [];
                      }
                  })()
                : [];
        const blocked = users.filter((u) => u.blocked);

        const activeWorks = works.filter(
            (w) => w.status === "active" || w.status === "review",
        );
        const pendingWorks = works.filter((w) => w.status === "pending");
        const highRisk = works.filter((w) => {
            try {
                const res = Utils.safeFuzzyInfer(Utils.buildFuzzyInputs(w));
                return res && res.risk.term === "high";
            } catch (e) {
                return false;
            }
        });
        const overdue = works.filter((w) => {
            if (!w.deadline) return false;
            if (w.status === "done" || w.status === "rejected") return false;
            return daysUntil(w.deadline) < 0;
        });
        const pendingConsults = consults.filter((c) => c.status === "pending");
        const activeAnnouncements = announcements.filter(
            (a) =>
                a.active !== false &&
                (!a.expiresAt || a.expiresAt > Date.now()),
        );

        const penalties =
            blocked.length * 5 +
            overdue.length * 3 +
            highRisk.length * 1 +
            pendingWorks.length * 0.5;
        const health = Math.max(0, Math.min(100, Math.round(100 - penalties)));
        const healthColor =
            health >= 75 ? "#10b981" : health >= 50 ? "#f59e0b" : "#ef4444";
        const healthDesc =
            health >= 75
                ? "Система работает отлично"
                : health >= 50
                  ? "Есть моменты, требующие внимания"
                  : "Требуется вмешательство";

        sb.innerHTML = `
        <div>
            <div class="side-section-title">Статистика</div>
            <div class="side-stats">
                <div class="side-stat" onclick="App.navigate('users')">
                    <div class="side-stat-label">Юзеры</div>
                    <div class="side-stat-value">${users.length}</div>
                    <div class="side-stat-sub">${blocked.length} блок.</div>
                </div>
                <div class="side-stat" onclick="App.navigate('works')">
                    <div class="side-stat-label">Работы</div>
                    <div class="side-stat-value">${works.length}</div>
                    <div class="side-stat-sub">${activeWorks.length} акт.</div>
                </div>
                <div class="side-stat" onclick="App.navigate('consultations')">
                    <div class="side-stat-label">Консульт.</div>
                    <div class="side-stat-value">${consults.length}</div>
                    <div class="side-stat-sub">${pendingConsults.length} ждут</div>
                </div>
                <div class="side-stat" onclick="App.navigate('announcements')">
                    <div class="side-stat-label">Объявл.</div>
                    <div class="side-stat-value">${announcements.length}</div>
                    <div class="side-stat-sub">${activeAnnouncements.length} акт.</div>
                </div>
            </div>
        </div>

        <div>
            <div class="side-section-title">Быстрые действия</div>
            <div class="side-actions">
                <div class="side-action" onclick="App.navigate('users')">
                    <div class="side-action-icon">${SVG.users({ cls: "icon" })}</div>
                    <span>Юзеры</span>
                </div>
                <div class="side-action" onclick="App.navigate('works')">
                    <div class="side-action-icon green">${SVG.folder({ cls: "icon" })}</div>
                    <span>Работы</span>
                </div>
                <div class="side-action" onclick="App.navigate('analytics')">
                    <div class="side-action-icon purple">${SVG.trending({ cls: "icon" })}</div>
                    <span>Аналитика</span>
                </div>
                <div class="side-action" onclick="App.navigate('demo')">
                    <div class="side-action-icon pink">${SVG.rocket({ cls: "icon" })}</div>
                    <span>Демо</span>
                </div>
            </div>
        </div>

        <div>
            <div class="side-section-title">Здоровье системы</div>
            <div class="side-health">
                <div class="side-health-head">
                    <div class="side-health-label">Общее</div>
                    <div class="side-health-value" style="color:${healthColor};">${health}%</div>
                </div>
                <div class="side-health-bar">
                    <div class="side-health-fill" style="width:${health}%;background:${healthColor};box-shadow:0 0 8px ${healthColor};"></div>
                </div>
                <div class="side-health-desc">${healthDesc}</div>
            </div>
        </div>

        <div>
            <div class="side-section-title">Навигация</div>
            <div class="side-links">
                <button class="side-link" onclick="App.navigate('audit')">
                    ${SVG.log({ cls: "icon" })}
                    <span>Аудит</span>
                </button>
                <button class="side-link" onclick="App.navigate('rules')">
                    ${SVG.settings({ cls: "icon" })}
                    <span>Правила</span>
                </button>
                <button class="side-link" onclick="App.navigate('rankings')">
                    ${SVG.award({ cls: "icon" })}
                    <span>Рейтинги</span>
                </button>
                <button class="side-link" onclick="App.navigate('refs')">
                    ${SVG.book({ cls: "icon" })}
                    <span>Справочники</span>
                </button>
                <button class="side-link" onclick="App.navigate('settings')">
                    ${SVG.settings({ cls: "icon" })}
                    <span>Настройки</span>
                </button>
                <button class="side-link" onclick="PdfReport.exportDepartment()">
                    ${SVG.fileText({ cls: "icon" })}
                    <span>Отчёт PDF</span>
                </button>
            </div>
        </div>
    `;
    }

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

        if (
            currentUser &&
            typeof Announcements !== "undefined" &&
            (currentUser.role === "student" || currentUser.role === "teacher")
        ) {
            renderNavBadges();
        }
    }

    function renderNavBadges() {
        if (!currentUser) return;
        if (typeof Announcements === "undefined") return;

        const btn = document.querySelector(
            '#mainNav button[data-view="announcements"]',
        );
        if (!btn) return;

        const old = btn.querySelector(".nav-badge");
        if (old) old.remove();

        const count = Announcements.unreadCount(currentUser.id);
        if (count > 0) {
            const badge = document.createElement("span");
            badge.className = "nav-badge";
            badge.textContent = count > 9 ? "9+" : String(count);
            btn.appendChild(badge);
        }
    }

    function renderView(viewId, params) {
        const root = document.getElementById("viewRoot");
        if (!root) return;

        if (!currentUser) {
            root.innerHTML = placeholder("Пользователь не авторизован");
            return;
        }

        if (typeof Charts !== "undefined" && Charts.destroyAll) {
            Charts.destroyAll();
        }
        if (_afterTimer) {
            clearTimeout(_afterTimer);
            _afterTimer = null;
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
                _afterTimer = setTimeout(() => {
                    _afterTimer = null;
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
          <div style="font-weight:500;margin-bottom:6px;">${Utils.escapeHtml(text)}</div>
          ${hint ? `<div style="font-size:12px;color:var(--txt-muted);">${Utils.escapeHtml(hint)}</div>` : ""}
        </div>
      </div>
    `;
    }

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

    function toast(msg) {
        const t = document.getElementById("toast");
        if (!t) return;
        t.textContent = msg;
        t.classList.add("show");
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
    }

    function refreshNotifications() {
        if (!currentUser) return;

        if (typeof Notifications !== "undefined") {
            try {
                const count = Notifications.unreadCount(currentUser.id);
                const el = document.getElementById("notifCount");
                const bell = document.getElementById("notifBell");
                if (el && bell) {
                    if (count > 0) {
                        el.textContent = count > 9 ? "9+" : count;
                        el.style.display = "";
                        bell.classList.add("has-new");
                    } else {
                        el.style.display = "none";
                        bell.classList.remove("has-new");
                    }
                }
            } catch (err) {
                console.warn("[App] refreshNotifications (notif):", err);
            }
        }

        try {
            if (
                (currentUser.role === "student" ||
                    currentUser.role === "teacher") &&
                typeof Announcements !== "undefined"
            ) {
                renderNavBadges();
            }
        } catch (err) {
            console.warn("[App] refreshNotifications (ann):", err);
        }
    }

    function resetUIState() {
        if (typeof Admin !== "undefined" && Admin.resetFilters) {
            try {
                Admin.resetFilters();
            } catch (e) {}
        }
        if (typeof Teacher !== "undefined" && Teacher.resetFilters) {
            try {
                Teacher.resetFilters();
            } catch (e) {}
        }
        if (typeof Student !== "undefined" && Student.clearSelectedWork) {
            try {
                Student.clearSelectedWork();
            } catch (e) {}
        }
        if (typeof MamdaniViz !== "undefined" && MamdaniViz.resetSelection) {
            try {
                MamdaniViz.resetSelection();
            } catch (e) {}
        }
        if (typeof Simulate !== "undefined" && Simulate.resetSelection) {
            try {
                Simulate.resetSelection();
            } catch (e) {}
        }
    }

    return {
        boot,
        navigate,
        openModal,
        closeModal,
        toast,
        refreshNotifications,
        resetUIState,
        getUser: () => currentUser,
        NAV_ITEMS,
        navItems,
        resolveActiveNavItem,
        renderAdminSidebar,
    };
})();

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

    const restored = Auth.restoreSession();
    if (!restored) {
        if (typeof Landing !== "undefined") {
            Landing.show();
        } else {
            Auth.showAuth("login");
        }
    }
});
