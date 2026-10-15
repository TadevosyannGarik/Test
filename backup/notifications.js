/* =========================================================
   NOTIFICATIONS — система уведомлений
   ========================================================= */
const Notifications = (() => {
    const KEY = "fp_notifications";
    const MAX_PER_USER = 200;

    /* =========================================================
       ЧТЕНИЕ / ЗАПИСЬ
       ========================================================= */
    function getAll() {
        const list = Storage.get(KEY, []);
        return Array.isArray(list) ? list : [];
    }

    function setAll(list) {
        Storage.set(KEY, list);
    }

    /* =========================================================
       ДОБАВЛЕНИЕ
       ========================================================= */
    function add({ userId, type, title, text, link }) {
        if (!userId) return;

        const list = getAll();
        list.push({
            id: uid(),
            userId,
            type: type || "info",
            title: title || "",
            text: text || "",
            link: link || null,
            read: false,
            createdAt: Date.now(),
        });

        /* Ограничение на пользователя */
        const userNotifs = list.filter((n) => Storage.sameId(n.userId, userId));
        if (userNotifs.length > MAX_PER_USER) {
            const toRemove = userNotifs
                .sort((a, b) => a.createdAt - b.createdAt)
                .slice(0, userNotifs.length - MAX_PER_USER)
                .map((n) => n.id);
            const filtered = list.filter((n) => !toRemove.includes(n.id));
            setAll(filtered);
        } else {
            setAll(list);
        }

        if (typeof App !== "undefined" && App.refreshNotifications) {
            App.refreshNotifications();
        }
    }

    /* =========================================================
       ЧТЕНИЕ ДЛЯ ПОЛЬЗОВАТЕЛЯ
       ========================================================= */
    function getForUser(userId) {
        if (!userId) return [];
        return getAll()
            .filter((n) => Storage.sameId(n.userId, userId))
            .sort((a, b) => {
                if (a.read !== b.read) return a.read ? 1 : -1;
                return b.createdAt - a.createdAt;
            });
    }

    function unreadCount(userId) {
        if (!userId) return 0;
        return getAll().filter(
            (n) => Storage.sameId(n.userId, userId) && !n.read,
        ).length;
    }

    /* =========================================================
       ПОМЕТКИ
       ========================================================= */
    function markRead(id) {
        const list = getAll();
        const n = list.find((x) => Storage.sameId(x.id, id));
        if (!n) return;
        n.read = true;
        setAll(list);
    }

    function markAllRead(userId) {
        if (!userId) return;
        const list = getAll();
        list.forEach((n) => {
            if (Storage.sameId(n.userId, userId)) n.read = true;
        });
        setAll(list);
    }

    /* =========================================================
       УДАЛЕНИЕ
       ========================================================= */
    function deleteNotif(id) {
        const list = getAll().filter((n) => !Storage.sameId(n.id, id));
        setAll(list);
    }

    function clearAllForUser(userId) {
        if (!userId) return;
        const list = getAll().filter((n) => !Storage.sameId(n.userId, userId));
        setAll(list);
    }

    /* =========================================================
       ИКОНКА
       ========================================================= */
    function iconFor(type) {
        switch (type) {
            case "work":
                return SVG.folder({ cls: "icon icon-xs" });
            case "comment":
                return SVG.messageCircle({ cls: "icon icon-xs" });
            case "risk":
                return SVG.alertTriangle({ cls: "icon icon-xs" });
            case "approve":
                return SVG.check({ cls: "icon icon-xs" });
            case "reject":
                return SVG.x({ cls: "icon icon-xs" });
            default:
                return SVG.bell({ cls: "icon icon-xs" });
        }
    }

    /* =========================================================
       РЕНДЕР ПАНЕЛИ
       ========================================================= */
    function renderPanel(userId) {
        const list = getForUser(userId);
        const unread = unreadCount(userId);

        if (list.length === 0) {
            return `
        <div class="notif-panel" id="notifPanel">
          <div class="notif-panel-head">
            <h4>Уведомления</h4>
            <button onclick="Notifications.closePanel()" title="Закрыть">
              ${SVG.x({ cls: "icon icon-xs" })}
            </button>
          </div>
          <div class="notif-empty">
            ${SVG.bell({ cls: "icon icon-lg" })}
            <div style="margin-top:8px;">Уведомлений нет</div>
          </div>
        </div>
      `;
        }

        return `
      <div class="notif-panel" id="notifPanel">
        <div class="notif-panel-head">
          <h4>
            Уведомления
            ${unread > 0 ? `<span class="count-chip">${unread}</span>` : ""}
          </h4>
          <div style="display:flex;gap:8px;align-items:center;">
            ${unread > 0 ? `<button onclick="Notifications.markAll()" class="notif-action">Прочитать все</button>` : ""}
            <button onclick="Notifications.closePanel()" title="Закрыть" class="notif-close">
              ${SVG.x({ cls: "icon icon-xs" })}
            </button>
          </div>
        </div>
        <div class="notif-list">
          ${list.map((n) => renderItem(n)).join("")}
        </div>
      </div>
    `;
    }

    function renderItem(n) {
        return `
      <div class="notif-item ${n.read ? "" : "unread"}"
        onclick="Notifications.openItem(${n.id})">
        <div class="notif-item-head">
          <span class="notif-item-ico">${iconFor(n.type)}</span>
          <span class="notif-item-title">${escapeHtml(n.title)}</span>
        </div>
        ${n.text ? `<div class="notif-item-text">${escapeHtml(n.text)}</div>` : ""}
        <div class="notif-item-time">${fmtDateTime(n.createdAt)}</div>
      </div>
    `;
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    /* =========================================================
       УПРАВЛЕНИЕ
       ========================================================= */
    function closePanel() {
        const el = document.getElementById("notifPanel");
        if (el) el.remove();
    }

    function openItem(id) {
        markRead(id);
        const list = getAll();
        const n = list.find((x) => Storage.sameId(x.id, id));
        closePanel();

        if (typeof App !== "undefined") {
            if (App.refreshNotifications) App.refreshNotifications();
            if (n && n.link && n.link.view) {
                App.navigate(n.link.view, n.link.params);
            }
        }
    }

    function markAll() {
        const u = Auth.getUser();
        if (u) markAllRead(u.id);
        closePanel();
        if (typeof App !== "undefined" && App.refreshNotifications) {
            App.refreshNotifications();
        }
    }

    function toggle(userId) {
        const existing = document.getElementById("notifPanel");
        if (existing) {
            closePanel();
            return;
        }

        const html = renderPanel(userId);

        const bell = document.getElementById("notifBell");
        let host = null;

        if (bell) {
            host = bell.closest(".notif-wrap") || bell.parentElement;
        }

        if (!host) {
            const wrapper = document.createElement("div");
            wrapper.style.position = "fixed";
            wrapper.style.top = "56px";
            wrapper.style.right = "16px";
            wrapper.style.zIndex = "500";
            wrapper.innerHTML = html;
            document.body.appendChild(wrapper);
            return;
        }

        host.insertAdjacentHTML("beforeend", html);
    }

    /* =========================================================
       ПУБЛИЧНЫЙ API
       ========================================================= */
    return {
        add,
        getAll,
        getForUser,
        unreadCount,
        markRead,
        markAllRead,
        deleteNotif,
        clearAllForUser,
        renderPanel,
        closePanel,
        openItem,
        markAll,
        toggle,
    };
})();
