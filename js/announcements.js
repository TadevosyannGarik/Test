const Announcements = (() => {
    const KEY = "fp_announcements";
    const READ_KEY = "fp_announcements_read";

    const AUDIENCE_LABELS = {
        all: "Все пользователи",
        students: "Только студенты",
        teachers: "Только преподаватели",
        user: "Конкретный пользователь",
        group: "Конкретная группа",
    };

    const PRIORITY_LABELS = {
        normal: "Обычное",
        important: "Важное",
        urgent: "Срочное",
    };

    const escapeHtml =
        typeof Utils !== "undefined" && Utils.escapeHtml
            ? Utils.escapeHtml
            : (str) => {
                  if (str === null || str === undefined) return "";
                  return String(str)
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;");
              };

    /* ---------- Локальный emptyState с fallback ---------- */
    function localEmptyState(title, text, iconFn) {
        const icon = iconFn
            ? iconFn({ cls: "icon icon-2xl" })
            : typeof SVG !== "undefined" && SVG.bell
              ? SVG.bell({ cls: "icon icon-2xl" })
              : "";
        return `
      <div class="empty-state" style="padding:48px 24px;text-align:center;">
        ${icon}
        <h3 style="font-size:17px;font-weight:600;margin-bottom:8px;margin-top:12px;color:var(--txt);">
          ${escapeHtml(title || "")}
        </h3>
        ${text ? `<p style="color:var(--txt-muted);font-size:13px;max-width:400px;margin:0 auto;line-height:1.6;">${escapeHtml(text)}</p>` : ""}
      </div>
    `;
    }

    /* =========================================================
       БАЗОВЫЕ ОПЕРАЦИИ
       ========================================================= */
    function getAll() {
        const list = Storage.get(KEY, []);
        return Array.isArray(list) ? list : [];
    }

    function setAll(list) {
        Storage.set(KEY, Array.isArray(list) ? list : []);
    }

    function getActive() {
        const now = Date.now();
        return getAll()
            .filter((a) => a.active !== false)
            .filter((a) => !a.expiresAt || a.expiresAt > now)
            .sort((a, b) => {
                const priority = { urgent: 0, important: 1, normal: 2 };
                const pa = priority[a.priority] ?? 9;
                const pb = priority[b.priority] ?? 9;
                if (pa !== pb) return pa - pb;
                return (b.createdAt || 0) - (a.createdAt || 0);
            });
    }

    /* =========================================================
       ПРОЧИТАНО / НЕПРОЧИТАНО
       ========================================================= */
    function getReadMap() {
        const map = Storage.get(READ_KEY, {});
        return map && typeof map === "object" ? map : {};
    }

    function setReadMap(map) {
        Storage.set(READ_KEY, map && typeof map === "object" ? map : {});
    }

    function getReadIds(userId) {
        if (!userId) return [];
        const map = getReadMap();
        const key = String(userId);
        return Array.isArray(map[key]) ? map[key] : [];
    }

    function isRead(userId, annId) {
        return getReadIds(userId).some((id) => Storage.sameId(id, annId));
    }

    function markRead(userId, annId) {
        if (!userId || !annId) return;
        const map = getReadMap();
        const key = String(userId);
        const list = Array.isArray(map[key]) ? map[key] : [];
        if (!list.some((id) => Storage.sameId(id, annId))) {
            list.push(annId);
            map[key] = list;
            setReadMap(map);
        }
    }

    function markAllRead(userId) {
        if (!userId) return;
        const map = getReadMap();
        const key = String(userId);
        const allIds = getAll().map((a) => a.id);
        map[key] = allIds;
        setReadMap(map);
    }

    function unreadCount(userId) {
        if (!userId) return 0;
        const active = getForUserById(userId);
        const readIds = getReadIds(userId);
        return active.filter(
            (a) => !readIds.some((id) => Storage.sameId(id, a.id)),
        ).length;
    }

    /* =========================================================
       ФИЛЬТРАЦИЯ ПО ПОЛЬЗОВАТЕЛЮ
       ========================================================= */
    function matchesAudience(a, user) {
        if (!a || !user) return false;
        if (a.audience === "all") return true;
        if (a.audience === "students") return user.role === "student";
        if (a.audience === "teachers") return user.role === "teacher";
        if (a.audience === "user") return Storage.sameId(a.audienceId, user.id);
        if (a.audience === "group")
            return user.role === "student" && user.group === a.audienceId;
        return false;
    }

    function getForUser(user) {
        if (!user) return [];
        return getActive().filter((a) => matchesAudience(a, user));
    }

    function getForUserById(userId) {
        const user = Storage.getUserById(userId);
        if (!user) return [];
        return getActive().filter((a) => matchesAudience(a, user));
    }

    /* =========================================================
       СОЗДАНИЕ / УДАЛЕНИЕ
       ========================================================= */
    function add(data) {
        const list = getAll();
        const item = {
            id: uid(),
            title: (data.title || "").trim(),
            text: (data.text || "").trim(),
            audience: data.audience || "all",
            audienceId: data.audienceId || null,
            priority: data.priority || "normal",
            active: true,
            createdAt: Date.now(),
            expiresAt: data.expiresAt || null,
            authorId:
                (typeof Auth !== "undefined" && Auth.getUser()?.id) || null,
        };
        list.push(item);
        setAll(list);
        return item;
    }

    function remove(id) {
        const list = getAll().filter((a) => !Storage.sameId(a.id, id));
        setAll(list);
    }

    function toggleActive(id) {
        const list = getAll();
        const a = list.find((x) => Storage.sameId(x.id, id));
        if (a) {
            a.active = !a.active;
            setAll(list);
        }
    }

    /* =========================================================
       РЕНДЕР
       ========================================================= */
    function iconFor(priority) {
        if (typeof SVG === "undefined") return () => "";
        if (priority === "urgent") return SVG.alertTriangle;
        if (priority === "important") return SVG.info;
        return SVG.bell;
    }

    function renderCard(a, opts = {}) {
        const IconFn = iconFor(a.priority);
        const priorityLabel = PRIORITY_LABELS[a.priority] || "";
        const isUnread = opts.isUnread === true;

        return `
      <div class="ann-card ann-${a.priority} ${isUnread ? "unread" : ""}">
        <div class="ann-icon">
          ${IconFn({ cls: "icon icon-lg" })}
        </div>
        <div class="ann-body">
          <div class="ann-head">
            <div class="ann-title">
              ${isUnread ? '<span class="ann-unread-dot"></span>' : ""}
              ${escapeHtml(a.title)}
            </div>
            <div class="ann-priority ann-priority-${a.priority}">${priorityLabel}</div>
          </div>
          <div class="ann-text">${escapeHtml(a.text)}</div>
          <div class="ann-meta">
            ${fmtDateTime(a.createdAt)}
            ${a.expiresAt ? ` · действует до ${fmtDate(a.expiresAt)}` : ""}
          </div>
        </div>
      </div>
    `;
    }

    function renderBlock(user) {
        const list = getForUser(user);
        if (list.length === 0) return "";
        return `
      <div class="announcements-block">
        ${list
            .slice(0, 3)
            .map((a) =>
                renderCard(a, {
                    isUnread: !isRead(user.id, a.id),
                }),
            )
            .join("")}
        ${
            list.length > 3
                ? `<div class="ann-more">
                     <button class="btn-ghost btn-sm" onclick="App.navigate('announcements')">
                       Показать все (${list.length})
                     </button>
                   </div>`
                : ""
        }
      </div>
    `;
    }

    /**
     * Полная страница объявлений для пользователя.
     */
    function renderPage(user) {
        if (!user) {
            return '<div class="card"><div class="empty">Пользователь не найден</div></div>';
        }

        const list = getForUser(user);

        // Помечаем всё как прочитанное при открытии вкладки
        markAllRead(user.id);

        if (list.length === 0) {
            return `
        <div class="card">
          <div class="card-head">
            <div class="card-title" style="margin-bottom:0;">
              ${typeof SVG !== "undefined" && SVG.bell ? SVG.bell({ cls: "icon icon-sm" }) : ""}
              Объявления
            </div>
          </div>
          ${localEmptyState(
              "Объявлений пока нет",
              "Когда администратор опубликует объявление, оно появится здесь.",
              typeof SVG !== "undefined" ? SVG.bell : null,
          )}
        </div>
      `;
        }

        return `
      <div class="card">
        <div class="card-head">
          <div class="card-title" style="margin-bottom:0;">
            ${typeof SVG !== "undefined" && SVG.bell ? SVG.bell({ cls: "icon icon-sm" }) : ""}
            Объявления
            <span class="count-chip">${list.length}</span>
          </div>
        </div>

        <div class="announcements-block">
          ${list.map((a) => renderCard(a, { isUnread: false })).join("")}
        </div>
      </div>
    `;
    }

    function describeAudience(a) {
        if (a.audience === "user") {
            const u = Storage.getUserById(a.audienceId);
            return `Пользователь: ${u ? u.fio : "—"}`;
        }
        if (a.audience === "group") {
            return `Группа: ${a.audienceId || "—"}`;
        }
        return AUDIENCE_LABELS[a.audience] || a.audience;
    }

    return {
        getAll,
        getActive,
        getForUser,
        getForUserById,
        add,
        remove,
        toggleActive,
        isRead,
        markRead,
        markAllRead,
        unreadCount,
        renderBlock,
        renderCard,
        renderPage,
        describeAudience,
        AUDIENCE_LABELS,
        PRIORITY_LABELS,
    };
})();
