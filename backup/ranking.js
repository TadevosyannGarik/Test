/* =========================================================
   RANKING — рейтинги студентов и работ
   ========================================================= */
const Ranking = (() => {
    /* =========================================================
       ДАННЫЕ
       ========================================================= */
    function enrichAll(works) {
        const list = works || Storage.getWorks();
        return list.map((w) => ({
            w,
            student: Storage.getUserById(w.studentId),
            teacher: Storage.getUserById(w.teacherId),
            res: Fuzzy.infer(buildInputs(w)),
            progress: calcProgress(w.id),
        }));
    }

    function buildInputs(work) {
        const stages = Storage.getStagesByWork(work.id);
        const tasks = Storage.getTasksByWork(work.id);
        const comments = Storage.getCommentsByWork(work.id);

        let progress = 0;
        if (stages.length > 0) {
            const totalW = stages.reduce((s, x) => s + (x.weight || 1), 0);
            const doneW = stages
                .filter((s) => s.done)
                .reduce((s, x) => s + (x.weight || 1), 0);
            progress = totalW > 0 ? Math.round((doneW / totalW) * 100) : 0;
        }

        const totalItems = stages.length + tasks.length;
        const doneItems =
            stages.filter((s) => s.done).length +
            tasks.filter((t) => t.col === "done").length;
        const activity =
            totalItems === 0 ? 5 : Math.round((doneItems / totalItems) * 10);

        const days = work.deadline ? Math.max(0, daysUntil(work.deadline)) : 30;

        return {
            progress,
            days,
            activity,
            edits: comments.length,
            volume: progress,
            orig: work.orig || 65,
            supScore: work.supScore || 5,
            gost: work.gost || 70,
        };
    }

    function calcProgress(workId) {
        const stages = Storage.getStagesByWork(workId);
        if (stages.length === 0) return 0;
        const totalW = stages.reduce((s, x) => s + (x.weight || 1), 0);
        const doneW = stages
            .filter((s) => s.done)
            .reduce((s, x) => s + (x.weight || 1), 0);
        return totalW === 0 ? 0 : Math.round((doneW / totalW) * 100);
    }

    /* =========================================================
       РАБОТЫ ДЛЯ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
       ========================================================= */
    function getRelevantWorks() {
        const user = Auth.getUser();
        if (!user) return [];

        if (user.role === "student") return Storage.getWorksByStudent(user.id);
        if (user.role === "teacher") return Storage.getWorksByTeacher(user.id);
        return Storage.getWorks();
    }

    /* =========================================================
       TOP / BOTTOM
       ========================================================= */
    function topByRating(enriched, limit = 5) {
        return [...enriched]
            .sort((a, b) => b.res.rating.value - a.res.rating.value)
            .slice(0, limit);
    }

    function bottomByRating(enriched, limit = 5) {
        return [...enriched]
            .sort((a, b) => a.res.rating.value - b.res.rating.value)
            .slice(0, limit);
    }

    function topByProgress(enriched, limit = 5) {
        return [...enriched]
            .sort((a, b) => b.progress - a.progress)
            .slice(0, limit);
    }

    function topByRisk(enriched, limit = 5) {
        return [...enriched]
            .sort((a, b) => b.res.risk.value - a.res.risk.value)
            .slice(0, limit);
    }

    /* =========================================================
       ХЕЛПЕРЫ
       ========================================================= */
    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    /* =========================================================
       РЕНДЕР
       ========================================================= */
    function renderRankingSection() {
        const works = getRelevantWorks();

        if (works.length === 0) {
            return `
        <div class="card">
          <div class="empty-state">
            ${SVG.award({ cls: "icon icon-2xl" })}
            <h3>Нет данных для рейтинга</h3>
            <p>Рейтинги появятся, когда в системе будут работы.</p>
          </div>
        </div>
      `;
        }

        const enriched = enrichAll(works);

        const avgRating = Math.round(
            enriched.reduce((a, e) => a + e.res.rating.value, 0) /
                enriched.length,
        );
        const avgProgress = Math.round(
            enriched.reduce((a, e) => a + e.progress, 0) / enriched.length,
        );

        const top = topByRating(enriched, 5);
        const topIds = new Set(top.map((e) => e.w.id));

        const bottom = bottomByRating(enriched, enriched.length)
            .filter((e) => !topIds.has(e.w.id))
            .filter((e) => e.res.rating.value < 60)
            .slice(0, 5);

        return `
      <div class="card" style="margin-bottom:20px;">
        <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:13px;color:var(--txt-muted);">
          <div>Всего работ: <b style="color:var(--txt)">${works.length}</b></div>
          <div>Средний рейтинг: <b style="color:var(--txt)">${avgRating}</b></div>
          <div>Средний прогресс: <b style="color:var(--txt)">${avgProgress}%</b></div>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-head">
            <div class="card-title">
              ${SVG.award({ cls: "icon icon-sm" })}
              <span>Топ успевающих</span>
            </div>
          </div>
          ${
              top.length === 0
                  ? renderEmpty("Нет данных")
                  : top.map((e, i) => renderRankRow(e, i + 1)).join("")
          }
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title">
              ${SVG.alertTriangle({ cls: "icon icon-sm" })}
              <span>Требуют внимания</span>
            </div>
          </div>
          ${
              bottom.length === 0
                  ? renderEmpty("Все работы в норме")
                  : bottom
                        .map((e, i) => renderRankRow(e, i + 1, "low"))
                        .join("")
          }
        </div>
      </div>
    `;
    }

    function renderEmpty(text) {
        return `<div class="empty" style="padding:24px;">${text}</div>`;
    }

    function renderRankRow(e, idx, kind = "top") {
        const posCls =
            idx === 1
                ? "gold"
                : idx === 2
                  ? "silver"
                  : idx === 3
                    ? "bronze"
                    : "";

        const res = e.res;
        const riskCls = res.risk.term;
        const topic = e.w.topic || "";
        const topicShort = topic.length > 40 ? topic.slice(0, 40) + "…" : topic;
        const studentName = e.student?.fio || "—";

        return `
      <div class="rank-row" onclick="Ranking.openWork(${e.w.id})">
        <div class="rank-pos ${posCls}">${idx}</div>
        <div>
          <div style="font-weight:500;">${escapeHtml(studentName)}</div>
          <div style="font-size:11px;color:var(--txt-muted);">${escapeHtml(topicShort)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:600;color:var(--accent)">${res.rating.value.toFixed(0)}</div>
          <div style="font-size:10px;color:var(--txt-muted);">рейтинг</div>
        </div>
        <div style="text-align:right;">
          <span class="badge risk-${riskCls}" style="font-size:10px;">риск ${res.risk.value.toFixed(0)}</span>
        </div>
      </div>
    `;
    }

    /* =========================================================
       НАВИГАЦИЯ ПО РОЛИ
       ========================================================= */
    function openWork(workId) {
        const user = Auth.getUser();
        if (!user) return;

        if (user.role === "admin") {
            App.navigate("work-detail", { id: workId });
            return;
        }
        if (user.role === "teacher") {
            const work = Storage.getWorkById(workId);
            if (work)
                App.navigate("student-detail", { id: work.studentId, workId });
            return;
        }
        if (user.role === "student") {
            App.navigate("my-work");
        }
    }

    /* =========================================================
       ПУБЛИЧНЫЙ API
       ========================================================= */
    return {
        enrichAll,
        topByRating: (limit = 5) =>
            topByRating(enrichAll(getRelevantWorks()), limit),
        bottomByRating: (limit = 5) =>
            bottomByRating(enrichAll(getRelevantWorks()), limit),
        topByProgress: (limit = 5) =>
            topByProgress(enrichAll(getRelevantWorks()), limit),
        topByRisk: (limit = 5) =>
            topByRisk(enrichAll(getRelevantWorks()), limit),
        renderRankingSection,
        renderRankRow,
        openWork,
        getRelevantWorks,
    };
})();
