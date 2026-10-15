/* =========================================================
   ICONS — SVG-иллюстрации для пустых состояний
   ========================================================= */
const Icons = (() => {
    function svg(inner, opts = {}) {
        const c = opts.color || "#9aa3b0";
        return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${inner}
    </svg>`;
    }

    const noWorks = () =>
        svg(`
    <rect x="20" y="25" width="80" height="70" rx="8" />
    <path d="M35 45h50M35 58h40M35 71h30" />
    <circle cx="90" cy="90" r="18" fill="white" stroke="${"#9aa3b0"}"/>
    <path d="M90 80v10M90 96v.5" stroke-linecap="round"/>
  `);

    const noStudents = () =>
        svg(`
    <circle cx="60" cy="40" r="18" />
    <path d="M30 100c0-16 13-30 30-30s30 14 30 30" />
    <path d="M80 55l5 5 10-10" stroke="#16a34a"/>
  `);

    const noRequests = () =>
        svg(`
    <rect x="25" y="30" width="70" height="70" rx="8" />
    <path d="M25 50h70" />
    <path d="M45 20v20M75 20v20" />
    <circle cx="60" cy="75" r="12" stroke="#16a34a"/>
    <path d="M55 75l4 4 8-8" stroke="#16a34a"/>
  `);

    const noNotifications = () =>
        svg(`
    <path d="M40 45c0-11 9-20 20-20s20 9 20 20v18l8 12H32l8-12V45z" />
    <path d="M52 95a8 8 0 0016 0" />
  `);

    const noTasks = () =>
        svg(`
    <rect x="25" y="35" width="70" height="60" rx="6" />
    <path d="M25 55h70" />
    <path d="M45 70l4 4 8-8M45 82l4 4 8-8" stroke="#16a34a"/>
  `);

    const noStages = () =>
        svg(`
    <path d="M20 90h20V70h20V50h20V30h20" stroke-dasharray="4 4"/>
    <circle cx="30" cy="80" r="8"/>
    <circle cx="60" cy="60" r="8"/>
    <circle cx="90" cy="40" r="8"/>
  `);

    const noComments = () =>
        svg(`
    <path d="M25 30h70v50H55l-20 15v-15H25z" />
    <path d="M40 50h40M40 62h25" stroke="#9aa3b0"/>
  `);

    const noData = () =>
        svg(`
    <path d="M20 100V40l30-15 30 15v60" />
    <path d="M40 60h40M40 75h40M40 90h20" />
    <circle cx="90" cy="90" r="18" fill="white"/>
    <path d="M84 84l12 12M96 84l-12 12"/>
  `);

    const noConsultations = () =>
        svg(`
    <rect x="20" y="35" width="80" height="65" rx="8" />
    <path d="M20 55h80M45 25v20M75 25v20" />
    <circle cx="45" cy="75" r="6" stroke="#16a34a"/>
    <circle cx="75" cy="75" r="6"/>
  `);

    /* Универсальная обёртка */
    function empty(title, text, svgFn, action) {
        const svgContent = (svgFn || noData)();
        return `
      <div class="empty-state">
        ${svgContent}
        <h3>${title}</h3>
        ${text ? `<p>${text}</p>` : ""}
        ${action ? action : ""}
      </div>
    `;
    }

    return {
        noWorks,
        noStudents,
        noRequests,
        noNotifications,
        noTasks,
        noStages,
        noComments,
        noData,
        noConsultations,
        empty,
    };
})();
