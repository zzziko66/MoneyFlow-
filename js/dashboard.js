(function () {
  "use strict";

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      if (r > w / 2) r = w / 2;
      if (r > h / 2) r = h / 2;
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      return this;
    };
  }

  function updateUserInfo() {
    const user = MF.getUser();
    const nameEl = document.getElementById("sidebarName");
    const avatarEl = document.getElementById("sidebarAvatar");
    if (nameEl) nameEl.textContent = user.nickname || "访客";
    if (avatarEl) avatarEl.textContent = (user.nickname || "访")[0];
  }

  function loadStats() {
    const tx = MF.getTransactions();
    const user = MF.getUser();
    const netWorth = MF.calcNetWorth(tx);
    const monthExpense = MF.calcMonthExpense(tx);
    const monthIncome = MF.calcMonthIncome(tx);
    const budgetRatio = MF.calcBudgetRatio(tx, user);

    const netWorthEl = document.getElementById("statNetWorth");
    const expenseEl = document.getElementById("statMonthExpense");
    const incomeEl = document.getElementById("statMonthIncome");
    const gaugeUsedEl = document.getElementById("gaugeUsed");
    const gaugeLimitEl = document.getElementById("gaugeLimit");

    if (netWorthEl) MF.animateNumber(netWorthEl, netWorth, 800);
    if (expenseEl) MF.animateNumber(expenseEl, monthExpense, 600);
    if (incomeEl) incomeEl.textContent = MF.formatCurrency(monthIncome, "income");
    if (gaugeUsedEl) gaugeUsedEl.textContent = MF.formatCurrency(monthExpense);
    if (gaugeLimitEl) gaugeLimitEl.textContent = MF.formatCurrency(user.budgetLimit);

    const thresholdEl = document.getElementById("gaugeThreshold");
    if (thresholdEl) {
      thresholdEl.style.left = (user.warningThreshold * 100) + "%";
    }

    MF.renderWaterGauge(
      document.getElementById("budgetGauge"),
      budgetRatio,
      user.warningThreshold
    );
  }

  var THEME_PALETTES = {
    default: ["#10B981", "#059669", "#047857", "#065F46", "#0284C7", "#6B7280"],
    amber:   ["#D97706", "#B45309", "#92400E", "#78350F", "#EA580C", "#A16207"],
    ocean:   ["#0EA5E9", "#0284C7", "#0369A1", "#075985", "#06B6D4", "#0891B2"],
    rose:    ["#E11D48", "#BE123C", "#9F1239", "#881337", "#F43F5E", "#FB7185"],
    violet:  ["#8B5CF6", "#7C3AED", "#6D28D9", "#5B21B6", "#A78BFA", "#C4B5FD"],
  };

  function getThemePalette() {
    var body = document.body;
    var theme = "default";
    body.className.split(" ").forEach(function (c) {
      if (c.indexOf("theme-") === 0) theme = c.slice(6);
    });
    return THEME_PALETTES[theme] || THEME_PALETTES.default;
  }

  function renderBreakdown() {
    var barCanvas = document.getElementById("breakdownBarChart");
    var pieCanvas = document.getElementById("breakdownPieChart");
    if (!barCanvas || !pieCanvas) return;

    var breakdown = MF.calcCategoryBreakdown();
    var palette = getThemePalette();

    if (breakdown.length === 0) {
      var msg = '<div class="empty-state" style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;"><span class="empty-state__icon">📊</span><p style="margin:8px 0 0;font-size:13px;color:var(--text-secondary);">本月暂无支出记录</p></div>';
      barCanvas.parentNode.innerHTML = msg;
      pieCanvas.parentNode.innerHTML = msg;
      return;
    }

    var dpr = window.devicePixelRatio || 1;

    /* — 条形图 — */
    var barWrap = barCanvas.parentNode;
    var bw = barWrap.clientWidth || 200;
    var bh = barWrap.clientHeight || 220;
    barCanvas.width = bw * dpr;
    barCanvas.height = bh * dpr;
    barCanvas.style.width = bw + "px";
    barCanvas.style.height = bh + "px";

    var bCtx = barCanvas.getContext("2d");
    bCtx.scale(dpr, dpr);

    var pad = { top: 12, bottom: 12, left: 56, right: 48 };
    var chartW = bw - pad.left - pad.right;
    var chartH = bh - pad.top - pad.bottom;
    var barCount = breakdown.length;
    var barGap = 6;
    var barH = Math.min(24, (chartH - barGap * (barCount - 1)) / barCount);
    var totalH = barCount * barH + (barCount - 1) * barGap;
    var startY = pad.top + (chartH - totalH) / 2;
    var maxAmount = breakdown[0].amount;

    breakdown.forEach(function (item, i) {
      var y = startY + i * (barH + barGap);
      var barW = Math.max(4, (item.amount / maxAmount) * chartW);
      var color = palette[i % palette.length];

      bCtx.fillStyle = "rgba(148,163,184,0.08)";
      bCtx.beginPath();
      bCtx.roundRect(pad.left, y, chartW, barH, 4);
      bCtx.fill();

      bCtx.fillStyle = color;
      bCtx.beginPath();
      bCtx.roundRect(pad.left, y, barW, barH, 4);
      bCtx.fill();

      bCtx.fillStyle = "#1E293B";
      bCtx.font = "11px system-ui, -apple-system, sans-serif";
      bCtx.textAlign = "right";
      bCtx.textBaseline = "middle";
      bCtx.fillText(item.icon + " " + item.category, pad.left - 6, y + barH / 2);

      bCtx.fillStyle = "rgba(255,255,255,0.9)";
      bCtx.font = "bold 10px system-ui, -apple-system, sans-serif";
      bCtx.textAlign = "right";
      bCtx.textBaseline = "middle";
      bCtx.fillText(item.pct.toFixed(1) + "%", pad.left + barW - 5, y + barH / 2);

      bCtx.fillStyle = "#475569";
      bCtx.font = "10px system-ui, -apple-system, sans-serif";
      bCtx.textAlign = "left";
      bCtx.fillText("¥" + item.amount.toFixed(0), pad.left + barW + 6, y + barH / 2);
    });

    /* — 环形图 — */
    var pieWrap = pieCanvas.parentNode;
    var pw = pieWrap.clientWidth || 180;
    var ph = pieWrap.clientHeight || 220;
    pieCanvas.width = pw * dpr;
    pieCanvas.height = ph * dpr;
    pieCanvas.style.width = pw + "px";
    pieCanvas.style.height = ph + "px";

    var pCtx = pieCanvas.getContext("2d");
    pCtx.scale(dpr, dpr);

    var cx = pw / 2;
    var cy = ph / 2;
    var radius = Math.min(cx, cy) - 12;

    var total = breakdown.reduce(function (s, item) { return s + item.amount; }, 0);
    var startAngle = -Math.PI / 2;

    breakdown.forEach(function (item, i) {
      var sliceAngle = (item.amount / total) * Math.PI * 2;
      var color = palette[i % palette.length];
      var endAngle = startAngle + sliceAngle;

      pCtx.beginPath();
      pCtx.moveTo(cx, cy);
      pCtx.arc(cx, cy, radius, startAngle, endAngle);
      pCtx.closePath();
      pCtx.fillStyle = color;
      pCtx.fill();

      pCtx.beginPath();
      pCtx.moveTo(cx, cy);
      pCtx.arc(cx, cy, radius, startAngle, endAngle);
      pCtx.lineTo(cx, cy);
      pCtx.strokeStyle = "#fff";
      pCtx.lineWidth = 2;
      pCtx.stroke();

      startAngle = endAngle;
    });

    pCtx.beginPath();
    pCtx.arc(cx, cy, radius * 0.42, 0, Math.PI * 2);
    pCtx.fillStyle = "#fff";
    pCtx.fill();

    pCtx.fillStyle = "#1E293B";
    pCtx.font = "bold 13px system-ui, -apple-system, sans-serif";
    pCtx.textAlign = "center";
    pCtx.textBaseline = "middle";
    pCtx.fillText("¥" + total.toFixed(0), cx, cy - 6);

    pCtx.fillStyle = "#64748B";
    pCtx.font = "10px system-ui, -apple-system, sans-serif";
    pCtx.fillText("总支出", cx, cy + 14);
  }

  function renderInsight() {
    const box = document.getElementById("insightBox");
    if (!box) return;

    const insight = MF.generateInsight();
    box.innerHTML = `
      <span class="insight-box__icon">${insight.icon}</span>
      ${insight.text}
    `;
  }

  /* — 记一笔弹窗 — */
  const overlay = document.getElementById("quickAddOverlay");
  const openBtn = document.getElementById("openQuickAdd");
  const closeBtn = document.getElementById("quickAddClose");

  function openModal() {
    overlay.classList.add("is-open");
    document.querySelectorAll(".type-btn").forEach((b) => b.classList.remove("is-active"));
    document.querySelector('.type-btn[data-type="expense"]').classList.add("is-active");
    activeType.current = "expense";
    refreshSelects();
  }

  function closeModal() {
    overlay.classList.remove("is-open");
  }

  function refreshSelects() {
    updateCategoriesByType();
    populateAccountSelect();
  }

  if (openBtn) openBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (overlay) overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) closeModal();
  });

  /* — 弹窗表单 — */
  const typeBtns = document.querySelectorAll(".type-btn");
  const categorySelect = document.getElementById("qaCategory");
  const accountSelect = document.getElementById("qaAccount");
  const activeType = { current: "expense" };

  typeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      typeBtns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      activeType.current = btn.dataset.type;
      updateCategoriesByType();
    });
  });

  function updateCategoriesByType() {
    const cats = activeType.current === "expense"
      ? MF.EXPENSE_CATEGORIES
      : MF.INCOME_CATEGORIES;

    categorySelect.innerHTML = cats
      .map((cat) => `<option value="${cat}">${MF.CATEGORY_ICONS[cat] || "📦"} ${cat}</option>`)
      .join("");
  }

  function populateAccountSelect() {
    const accounts = MF.getAccounts();
    accountSelect.innerHTML = accounts
      .map((acc) => `<option value="${acc.id}">${acc.icon} ${acc.name}</option>`)
      .join("");
  }

  /* — 提交 — */
  const submitBtn = document.getElementById("qaSubmit");
  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      const title = document.getElementById("qaTitle").value.trim();
      const amount = parseFloat(document.getElementById("qaAmount").value);
      const category = categorySelect.value;
      const account = accountSelect.value;

      if (!amount || amount <= 0) {
        MF.showToast("请输入有效的金额", "error");
        return;
      }

      MF.addTransaction({
        type: activeType.current,
        category,
        title: title || category,
        account,
        amount,
      });

      document.getElementById("qaTitle").value = "";
      document.getElementById("qaAmount").value = "";
      closeModal();

      const typeLabel = activeType.current === "expense" ? "支出" : "收入";
      MF.showToast(`${typeLabel}「${title || category}」${MF.formatCurrency(amount)} 已记录`, "success");

      loadStats();
      renderBreakdown();
      renderInsight();
    });
  }

  /* — 退出 — */
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    MF.logout();
  });

  /* — 初始化 — */
  document.addEventListener("DOMContentLoaded", () => {
    updateUserInfo();
    loadStats();
    renderBreakdown();
    renderInsight();

    document.addEventListener("click", function (e) {
      if (e.target.closest(".ft-card") || e.target.closest(".sidebar-theme-swatch")) {
        setTimeout(renderBreakdown, 80);
      }
    });
  });
})();
