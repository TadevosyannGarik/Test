const Utils = (() => {
    const WORK_TYPES = {
        course: {
            title: "Курсовая работа",
            desc: "1–2 курс, 30–50 стр.",
        },
        diploma: {
            title: "Дипломная работа",
            desc: "4 курс, 60–80 стр.",
        },
        vkr: {
            title: "ВКР (бакалавриат)",
            desc: "4 курс, 60–90 стр.",
        },
        master: {
            title: "Магистерская диссертация",
            desc: "2 курс магистратуры",
        },
    };

    const WORK_TYPES_LIST = Object.keys(WORK_TYPES).map((id) => ({
        id,
        title: WORK_TYPES[id].title,
        desc: WORK_TYPES[id].desc,
    }));

    const WORK_STATUSES = {
        draft: { label: "Черновик", badge: "draft" },
        pending: { label: "На утверждении", badge: "pending" },
        active: { label: "В работе", badge: "active" },
        review: { label: "На проверке", badge: "review" },
        approved: { label: "Допущена", badge: "approved" },
        done: { label: "Защищена", badge: "done" },
        rejected: { label: "Отклонена", badge: "rejected" },
    };

    const TASK_COLS = [
        { id: "todo", title: "К выполнению" },
        { id: "progress", title: "В работе" },
        { id: "review", title: "На проверке" },
        { id: "done", title: "Готово" },
    ];

    function escapeHtml(str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
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

    function workTypeLabel(type) {
        return WORK_TYPES[type]?.title || type || "—";
    }

    function statusBadge(status) {
        const s = WORK_STATUSES[status] || WORK_STATUSES.draft;
        return `<span class="badge ${s.badge}">${s.label}</span>`;
    }

    function calcProgress(workId) {
        const stages = Storage.getStagesByWork(workId);
        if (stages.length === 0) return 0;
        const total = stages.reduce((s, x) => s + (x.weight || 1), 0);
        const done = stages
            .filter((s) => s.done)
            .reduce((s, x) => s + (x.weight || 1), 0);
        return total === 0 ? 0 : Math.round((done / total) * 100);
    }

    function buildFuzzyInputs(work, progressOverride) {
        if (!work) return null;

        const stages = Storage.getStagesByWork(work.id);
        const tasks = Storage.getTasksByWork(work.id);
        const comments = Storage.getCommentsByWork(work.id);

        const progress =
            typeof progressOverride === "number"
                ? progressOverride
                : calcProgress(work.id);

        const totalItems = stages.length + tasks.length;
        const doneItems =
            stages.filter((s) => s.done).length +
            tasks.filter((t) => t.col === "done").length;

        let activity;
        if (totalItems === 0) {
            activity = 5;
        } else {
            const ratio = doneItems / totalItems;
            const absoluteBonus = Math.min(doneItems / 10, 1);
            activity = Math.round((ratio * 0.7 + absoluteBonus * 0.3) * 10);
        }

        const hasDeadline = !!work.deadline;
        const days = hasDeadline ? Math.max(0, daysUntil(work.deadline)) : 30;

        return {
            progress,
            days,
            hasDeadline,
            activity,
            edits: comments.length,
            volume: progress,
            orig: typeof work.orig === "number" ? work.orig : null,
            supScore: typeof work.supScore === "number" ? work.supScore : null,
            gost: typeof work.gost === "number" ? work.gost : null,
        };
    }

    function safeFuzzyInfer(inputs) {
        if (!inputs) return null;
        if (typeof Fuzzy === "undefined") return null;

        const normalized = {
            progress: inputs.progress ?? 0,
            days: inputs.days ?? 30,
            activity: inputs.activity ?? 5,
            edits: inputs.edits ?? 0,
            volume: inputs.volume ?? 0,
            orig: inputs.orig ?? 65,
            supScore: inputs.supScore ?? 5,
            gost: inputs.gost ?? 70,
        };

        const res = Fuzzy.infer(normalized);
        res.hasData = {
            orig: inputs.orig !== null && inputs.orig !== undefined,
            supScore: inputs.supScore !== null && inputs.supScore !== undefined,
            gost: inputs.gost !== null && inputs.gost !== undefined,
        };
        res.hasAnyTeacherCheck =
            res.hasData.orig || res.hasData.supScore || res.hasData.gost;
        return res;
    }

    function emptyState(title, text, iconFn, actionHtml) {
        return `
      <div class="empty-state">
        ${iconFn ? iconFn({ cls: "icon icon-2xl" }) : SVG.folder({ cls: "icon icon-2xl" })}
        <h3>${escapeHtml(title)}</h3>
        ${text ? `<p>${escapeHtml(text)}</p>` : ""}
        ${actionHtml || ""}
      </div>
    `;
    }

    function renderComment(c) {
        const author = Storage.getUserById(c.authorId);
        return `
      <div class="comment">
        <div class="comment-head">
          <span class="comment-author">${escapeHtml(author?.fio || "Неизвестный")}</span>
          <span>${fmtDateTime(c.createdAt)}</span>
        </div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
      </div>
    `;
    }

    function renderStagesMini(workId, limit = 5) {
        const stages = Storage.getStagesByWork(workId);
        if (!stages.length) {
            return '<div class="empty" style="padding:16px;">Этапы не добавлены</div>';
        }
        const done = stages.filter((s) => s.done).length;
        return `
      <div style="font-size:12px;color:var(--txt-muted);margin-bottom:10px;">
        Выполнено ${done} из ${stages.length}
      </div>
      ${stages
          .slice(0, limit)
          .map(
              (s) => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;">
          <span style="color:var(--${s.done ? "ok" : "txt-soft"})">
            ${s.done ? SVG.check({ cls: "icon icon-xs" }) : "○"}
          </span>
          <span style="${s.done ? "text-decoration:line-through;opacity:.6;" : ""}">
            ${escapeHtml(s.name)}
          </span>
        </div>
      `,
          )
          .join("")}
    `;
    }

    function renderStagesMiniForTeacher(workId) {
        const stages = Storage.getStagesByWork(workId);
        if (stages.length === 0) return '<div class="empty">Этапов нет</div>';
        const done = stages.filter((s) => s.done).length;
        return `
      <div style="font-size:12px;color:var(--txt-muted);margin-bottom:8px;">
        Выполнено ${done} из ${stages.length}
      </div>
      ${stages
          .map(
              (s) => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;border-bottom:1px solid var(--line);">
          <span style="color:var(--${s.done ? "ok" : "txt-soft"})">
            ${s.done ? SVG.check({ cls: "icon icon-xs" }) : "○"}
          </span>
          <span style="${s.done ? "text-decoration:line-through;opacity:.6;" : ""}">
            ${escapeHtml(s.name)}
          </span>
          <span style="margin-left:auto;color:var(--txt-muted);font-size:11px;">вес ${s.weight || 1}</span>
        </div>
      `,
          )
          .join("")}
    `;
    }

    function isActiveStatus(status) {
        return status !== "done" && status !== "rejected";
    }

    function getActiveWorkForStudent(studentId, selectedWorkId) {
        const works = Storage.getWorksByStudent(studentId);
        const active = works.filter((w) => isActiveStatus(w.status));
        if (active.length === 0) return null;

        if (selectedWorkId) {
            const found = active.find((w) =>
                Storage.sameId(w.id, selectedWorkId),
            );
            if (found) return found;
        }

        active.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        return active[0];
    }

    function getArchivedWorksForStudent(studentId) {
        return Storage.getWorksByStudent(studentId).filter(
            (w) => !isActiveStatus(w.status),
        );
    }

    function progressClass(progress) {
        if (progress < 40) return "bad";
        if (progress < 70) return "warn";
        return "ok";
    }

    function riskClass(term) {
        return term === "high" ? "bad" : term === "med" ? "warn" : "ok";
    }

    function readyClass(term) {
        return term === "high" ? "ok" : term === "med" ? "warn" : "bad";
    }

    function ensureOwnerWork(work, user) {
        if (!work || !user) return false;
        if (user.role === "admin") return true;
        if (user.role === "teacher")
            return Storage.sameId(work.teacherId, user.id);
        if (user.role === "student")
            return Storage.sameId(work.studentId, user.id);
        return false;
    }

    return {
        WORK_TYPES,
        WORK_TYPES_LIST,
        WORK_STATUSES,
        TASK_COLS,

        escapeHtml,
        initials,
        workTypeLabel,
        statusBadge,
        progressClass,
        riskClass,
        readyClass,

        calcProgress,
        buildFuzzyInputs,
        safeFuzzyInfer,

        isActiveStatus,
        getActiveWorkForStudent,
        getArchivedWorksForStudent,
        ensureOwnerWork,

        emptyState,
        renderComment,
        renderStagesMini,
        renderStagesMiniForTeacher,
    };
})();
