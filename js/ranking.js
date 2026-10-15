/* =========================================================
   RANKING — рейтинги студентов и работ
   Обновлено: Utils.* вместо дублирующих функций,
   синхронизация порогов с Fuzzy.THRESHOLDS
   ========================================================= */
const Ranking = (() => {
    /* Алиасы на Utils */
    const escapeHtml = Utils.escapeHtml;
    const calcProgress = Utils.calcProgress;
    const getUser = () => Auth.getUser();

    function getFuzzyResult(work, progressOverride) {
        return Utils.safeFuzzyInfer(
            Utils.buildFuzzyInputs(work, progressOverride),
        );
    }

    /* =========================================================
       ДАННЫЕ
       ========================================================= */
    function enrichAll(works) {
        const list = Array.isArray(works) ? works : Storage.getWorks();
        return list
            .map((w) => {
                const student = Storage.getUserById(w.studentId);
                const teacher = Storage.getUserById(w.teacherId);
                const res = getFuzzyResult(w);
                if (!res) return null;
                return {
                    w,
                    student,
                    teacher,
                    res,
                    progress: calcProgress(w.id),
                };
            })
            .filter(Boolean);
    }

    /* =========================================================
       РАБОТЫ ДЛЯ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
       ========================================================= */
    function getRelevantWorks() {
        const user = getUser();
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
       РЕНДЕР
       ========================================================= */
    function renderRankingSection() {
        const user = getUser();
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

        const avgRating = enriched.length
            ? Math.round(
                  enriched.reduce((a, e) => a + e.res.rating.value, 0) /
                      enriched.length,
              )
            : 0;
        const avgProgress = enriched.length
            ? Math.round(
                  enriched.reduce((a, e) => a + e.progress, 0) /
                      enriched.length,
              )
            : 0;

        const top = topByRating(enriched, 5);
        const topIds = new Set(top.map((e) => e.w.id));

        /* Порог «требуют внимания» синхронизирован с Fuzzy.THRESHOLDS.high */
        const threshold = Fuzzy.THRESHOLDS?.high ?? 65;

        const bottom = bottomByRating(enriched, enriched.length)
            .filter((e) => !topIds.has(e.w.id))
            .filter((e) => e.res.rating.value < threshold)
            .slice(0, 5);

        /* Заголовки зависят от роли */
        const topTitle =
            user?.role === "student"
                ? "Мои показатели"
                : user?.role === "teacher"
                  ? "Топ успевающих"
                  : "Топ работ";
        const bottomTitle =
            user?.role === "student" ? "Мои слабые места" : "Требуют внимания";

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
              <span>${topTitle}</span>
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
              <span>${bottomTitle}</span>
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
        return `<div class="empty" style="padding:24px;">${escapeHtml(text)}</div>`;
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
        const user = getUser();
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
