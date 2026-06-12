const MF = (() => {
  const SESSION_KEY = "moneyflow_session";
  const USERS_KEY = "moneyflow_users";

  const DEFAULT_USER = {
    nickname: "",
    email: "",
    defaultAccount: "",
    budgetLimit: 3000,
    warningThreshold: 0.8,
    createdAt: new Date().toISOString().slice(0, 10),
  };

  const DEFAULT_ACCOUNTS = [
    { id: "wechat", name: "微信", icon: "💬" },
    { id: "alipay", name: "支付宝", icon: "🔵" },
    { id: "card", name: "银行卡", icon: "💳" },
    { id: "cash", name: "现金", icon: "💵" },
  ];

  const CATEGORY_ICONS = {
    "餐饮": "🍜", "交通": "🚌", "购物": "🛍️",
    "娱乐": "🎮", "居住": "🏠", "医疗": "🏥",
    "工资": "💰", "其他": "📦",
  };

  const EXPENSE_CATEGORIES = ["餐饮", "交通", "购物", "娱乐", "居住", "医疗"];
  const INCOME_CATEGORIES = ["工资", "其他"];

  /* — 日期工具 — */
  function isoOffset(daysAgo, hour, minute) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  }

  function isSameMonth(dateStr, ref) {
    if (!ref) ref = new Date()
    const d = new Date(dateStr);
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
  }

  function previousMonthRef(ref) {
    if (!ref) ref = new Date()
    const d = new Date(ref);
    d.setMonth(d.getMonth() - 1);
    return d;
  }

  function formatDateTime(dateStr) {
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /* — 金额格式化 — */
  function formatCurrency(amount, type) {
    const num = Number(amount) || 0;
    const formatted = "¥" + num.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (type === "expense") return "-" + formatted;
    if (type === "income") return "+" + formatted;
    return formatted;
  }

  /* — 用户会话管理 — */
  function getSession() {
    return localStorage.getItem(SESSION_KEY);
  }

  function setSession(email) {
    if (email) localStorage.setItem(SESSION_KEY, email);
    else localStorage.removeItem(SESSION_KEY);
  }

  function getUsers() {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function registerUser(email, password, nickname) {
    const users = getUsers();
    if (users[email]) return false;
    users[email] = { password, nickname };
    saveUsers(users);

    const data = {
      user: { ...DEFAULT_USER, nickname, email, createdAt: new Date().toISOString().slice(0, 10) },
      accounts: [...DEFAULT_ACCOUNTS],
      transactions: [],
    };

    localStorage.setItem("moneyflow_data_" + email, JSON.stringify(data));
    setSession(email);
    return true;
  }

  function loginUser(email, password) {
    const users = getUsers();
    if (!users[email] || users[email].password !== password) return false;
    setSession(email);
    return true;
  }

  function logout() {
    setSession(null);
    window.location.href = "index.html";
  }

  function isLoggedIn() {
    return !!getSession();
  }

  function getCurrentEmail() {
    return getSession();
  }

  /* — 用户数据读写 — */
  function getDataBlob() {
    const email = getSession();
    if (!email) return null;
    const raw = localStorage.getItem("moneyflow_data_" + email);
    return raw ? JSON.parse(raw) : null;
  }

  function saveDataBlob(blob) {
    const email = getSession();
    if (!email) return;
    localStorage.setItem("moneyflow_data_" + email, JSON.stringify(blob));
  }

  function ensureData() {
    const blob = getDataBlob();
    if (!blob) return null;
    if (!blob.transactions) blob.transactions = [];
    if (!blob.accounts) blob.accounts = [...DEFAULT_ACCOUNTS];
    if (!blob.user) blob.user = { ...DEFAULT_USER, email: getSession() };
    return blob;
  }

  function getUser() {
    const blob = ensureData();
    if (!blob) return { ...DEFAULT_USER };
    if (!blob.user.email) blob.user.email = getSession();
    return blob.user;
  }

  function saveUser(user) {
    const blob = ensureData();
    if (!blob) return;
    blob.user = user;
    saveDataBlob(blob);
  }

  function getAccounts() {
    const blob = ensureData();
    if (!blob) return [...DEFAULT_ACCOUNTS];
    return blob.accounts || [...DEFAULT_ACCOUNTS];
  }

  function saveAccounts(accounts) {
    const blob = ensureData();
    if (!blob) return;
    blob.accounts = accounts;
    saveDataBlob(blob);
  }

  function getTransactions() {
    const blob = ensureData();
    if (!blob) return [];
    const list = blob.transactions || [];
    return list.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
  }

  function saveTransactions(list) {
    const blob = ensureData();
    if (!blob) return;
    blob.transactions = list;
    saveDataBlob(blob);
  }

  function addTransaction({ type, category, title, account, amount, datetime }) {
    const list = getTransactions();
    const record = {
      id: "tx_" + Date.now(),
      type,
      category,
      title: title || category,
      account,
      amount: Number(amount),
      datetime: datetime || new Date().toISOString(),
    };
    list.unshift(record);
    saveTransactions(list);
    return record;
  }

  function deleteTransaction(id) {
    const list = getTransactions().filter((tx) => tx.id !== id);
    saveTransactions(list);
  }

  /* — 统计计算 — */
  function calcNetWorth(transactions) {
    if (!transactions) transactions = getTransactions()
    return transactions.reduce((sum, tx) => {
      return sum + (tx.type === "income" ? tx.amount : -tx.amount);
    }, 0);
  }

  function calcMonthExpense(transactions, ref) {
    if (!transactions) transactions = getTransactions()
    if (!ref) ref = new Date()
    return transactions
      .filter((tx) => tx.type === "expense" && isSameMonth(tx.datetime, ref))
      .reduce((sum, tx) => sum + tx.amount, 0);
  }

  function calcMonthIncome(transactions, ref) {
    if (!transactions) transactions = getTransactions()
    if (!ref) ref = new Date()
    return transactions
      .filter((tx) => tx.type === "income" && isSameMonth(tx.datetime, ref))
      .reduce((sum, tx) => sum + tx.amount, 0);
  }

  function calcBudgetRatio(transactions, user) {
    if (!transactions) transactions = getTransactions()
    if (!user) user = getUser()
    const expense = calcMonthExpense(transactions);
    const limit = user.budgetLimit || 1;
    return expense / limit;
  }

  function calcCategoryBreakdown(transactions, ref) {
    if (!transactions) transactions = getTransactions()
    if (!ref) ref = new Date()
    const monthExpenses = transactions.filter(
      (tx) => tx.type === "expense" && isSameMonth(tx.datetime, ref)
    );
    const total = monthExpenses.reduce((sum, tx) => sum + tx.amount, 0);

    const map = {};
    monthExpenses.forEach((tx) => {
      map[tx.category] = (map[tx.category] || 0) + tx.amount;
    });

    return Object.entries(map)
      .map(([category, amount]) => ({
        category,
        icon: CATEGORY_ICONS[category] || "📦",
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  function generateInsight() {
    const transactions = getTransactions();
    const user = getUser();
    if (transactions.length === 0) {
      return { icon: "👋", text: "开始记录你的收支数据吧，MoneyFlow 将为你提供个性化的理财建议。" };
    }

    const breakdown = calcCategoryBreakdown(transactions);
    const monthExpense = calcMonthExpense(transactions);
    const monthIncome = calcMonthIncome(transactions);
    const lastMonthExpense = calcMonthExpense(transactions, previousMonthRef());
    const netWorth = calcNetWorth(transactions);
    const budgetUsage = user.budgetLimit > 0 ? (monthExpense / user.budgetLimit) * 100 : 0;
    const topCategory = breakdown.length > 0 ? breakdown[0].category : null;
    const topCategoryRatio = breakdown.length > 0 ? breakdown[0].pct : 0;

    if (budgetUsage >= 90) {
      return {
        icon: "⚠️",
        text: `本月预算已使用 ${budgetUsage.toFixed(0)}%，距离预算上限已经很近。接下来建议优先考虑必要消费。`,
      };
    }

    if (lastMonthExpense > 0 && monthExpense > lastMonthExpense * 1.2) {
      const delta = (((monthExpense - lastMonthExpense) / lastMonthExpense) * 100).toFixed(0);
      return {
        icon: "📈",
        text: `本月支出环比增长 ${delta}%，请留意不必要的开支，合理规划剩余预算。`,
      };
    }

    if (topCategory === "餐饮" && topCategoryRatio >= 40) {
      return {
        icon: "🍜",
        text: `本月餐饮支出占比达到 ${topCategoryRatio.toFixed(0)}%，是最大的消费来源。或许可以适当减少外卖频率。`,
      };
    }

    return {
      icon: "✅",
      text: `当前预算使用率为 ${budgetUsage.toFixed(0)}%，整体消费控制良好。`,
    };
  }

  /* — 水位条渲染 — */
  function renderWaterGauge(gaugeEl, ratio, threshold) {
    if (!gaugeEl) return;
    if (threshold === undefined) threshold = getUser().warningThreshold;
    const fillEl = gaugeEl.querySelector(".water-gauge__fill");
    const statusEl = gaugeEl.querySelector(".water-gauge__status");
    const pct = Math.min(ratio, 1) * 100;

    gaugeEl.classList.remove("water-gauge--warning", "water-gauge--danger");

    let statusText = `预算健康 · 已用 ${(ratio * 100).toFixed(1)}%`;
    if (ratio >= 0.9) {
      gaugeEl.classList.add("water-gauge--danger");
      statusText = `⚠️ 严重超支！已用 ${(ratio * 100).toFixed(1)}%`;
    } else if (ratio >= threshold) {
      gaugeEl.classList.add("water-gauge--warning");
      statusText = `⚡ 接近预算上限 · 已用 ${(ratio * 100).toFixed(1)}%`;
    }

    if (fillEl) fillEl.style.width = pct + "%";
    if (statusEl) statusEl.textContent = statusText;
  }

  /* — 时钟 + 问候语 — */
  function getGreetingWord(hour) {
    if (hour < 6) return "夜深了";
    if (hour < 12) return "早上好";
    if (hour < 14) return "中午好";
    if (hour < 18) return "下午好";
    return "晚上好";
  }

  function tickClock() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");

    const timeEl = document.getElementById("clock-time");
    if (timeEl) {
      timeEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }

    const dateEl = document.getElementById("clock-date");
    if (dateEl) {
      const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
      dateEl.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weekdays[now.getDay()]}`;
    }

    const greetingEl = document.getElementById("greeting");
    if (greetingEl) {
      const user = getUser();
      const name = user.nickname || "访客";
      greetingEl.textContent = `${getGreetingWord(now.getHours())}，${name} 👋`;
    }
  }

  function initClock() {
    tickClock();
    setInterval(tickClock, 1000);
  }

  /* — 导航高亮 — */
  function highlightActiveNav() {
    const current = document.body.dataset.page;
    if (!current) return;
    document.querySelectorAll(".sidebar__link").forEach((link) => {
      if (link.dataset.page === current) {
        link.classList.add("is-active");
      } else {
        link.classList.remove("is-active");
      }
    });
  }

  /* — 页面初始化 — */
  document.addEventListener("DOMContentLoaded", () => {
    initClock();
    highlightActiveNav();
    initEditProfile();
    initBrandCopy();
    ThemeManager.init();
    initTiltCards();
  });

  /* — Toast 通知 — */
  function initToastContainer() {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(message, type) {
    const container = initToastContainer();
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = 'toast toast--' + (type || 'info');
    toast.innerHTML = `<span style="font-size:16px;font-weight:700;">${icons[type] || 'ℹ'}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast--slide-out');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  /* — 数字跳动动画 — */
  function animateNumber(el, target, duration) {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();
    const isFormatted = target !== undefined && target !== null;

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / (duration || 600), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (Number(target) - start) * eased);

      if (isFormatted) {
        el.textContent = formatCurrency(current);
      } else {
        el.textContent = current;
      }

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.classList.add('animate-count');
        setTimeout(() => el.classList.remove('animate-count'), 400);
      }
    }
    requestAnimationFrame(update);
  }

  /* — 编辑账户弹窗 — */
  let editProfileInited = false;

  function initEditProfile() {
    if (editProfileInited) return;
    editProfileInited = true;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'editProfileOverlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:460px;">
        <div class="modal__header">
          <h3>⚙️ 修改账户信息</h3>
          <button class="modal__close" id="epClose">✕</button>
        </div>
        <div class="field">
          <label for="epNickname">昵称</label>
          <input id="epNickname" type="text" placeholder="输入新昵称">
        </div>
        <div class="field">
          <label for="epBudget">每月预算上限</label>
          <input id="epBudget" type="number" min="500" step="100" placeholder="3000">
        </div>
        <div class="field">
          <label>预警阈值</label>
          <div class="ep-thresholds">
            <label class="ep-threshold">
              <input type="radio" name="epThreshold" value="0.6">
              <span class="ep-threshold__val">60%</span>
              <span class="ep-threshold__label">保守型</span>
            </label>
            <label class="ep-threshold">
              <input type="radio" name="epThreshold" value="0.8">
              <span class="ep-threshold__val">80%</span>
              <span class="ep-threshold__label">推荐</span>
            </label>
            <label class="ep-threshold">
              <input type="radio" name="epThreshold" value="0.9">
              <span class="ep-threshold__val">90%</span>
              <span class="ep-threshold__label">宽松型</span>
            </label>
          </div>
        </div>
        <div class="field">
          <label>支付方式管理</label>
          <div id="epAccountList" class="ep-account-list"></div>
        </div>
        <button class="btn btn--primary btn--block" id="epSubmit">保存修改</button>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelectorAll('.ep-threshold').forEach(card => {
      card.addEventListener('click', function () {
        overlay.querySelectorAll('.ep-threshold').forEach(c => c.classList.remove('is-active'));
        this.classList.add('is-active');
        this.querySelector('input[type="radio"]').checked = true;
      });
    });

    document.getElementById('epClose').addEventListener('click', closeEditProfile);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeEditProfile(); });
    document.getElementById('epSubmit').addEventListener('click', saveEditProfile);

    document.addEventListener('click', e => {
      const btn = e.target.closest('#editProfileBtn');
      if (btn) { e.preventDefault(); openEditProfile(); }
    });
  }

  function renderAccountList() {
    const container = document.getElementById('epAccountList');
    if (!container) return;
    const currentIds = getAccounts().map(a => a.id);

    container.innerHTML = DEFAULT_ACCOUNTS.map(acc => `
      <label class="ep-account-card" data-id="${acc.id}">
        <input type="checkbox" value="${acc.id}" ${currentIds.includes(acc.id) ? 'checked' : ''}>
        <span class="ep-account-card__check">✓</span>
        <span class="ep-account-card__icon">${acc.icon}</span>
        <span class="ep-account-card__name">${acc.name}</span>
      </label>
    `).join('');

    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', function () {
        const checked = container.querySelectorAll('input:checked');
        if (checked.length === 0) {
          showToast('至少选择一种支付方式', 'error');
          this.checked = true;
          return;
        }
        const ids = Array.from(checked).map(inp => inp.value);
        saveAccounts(DEFAULT_ACCOUNTS.filter(a => ids.includes(a.id)));
      });
    });
  }

  function openEditProfile() {
    const overlay = document.getElementById('editProfileOverlay');
    if (!overlay) return;
    const user = getUser();

    document.getElementById('epNickname').value = user.nickname || '';
    document.getElementById('epBudget').value = user.budgetLimit || 3000;

    const threshold = String(user.warningThreshold ?? 0.8);
    overlay.querySelectorAll('.ep-threshold').forEach(card => {
      const isActive = card.querySelector('input[type="radio"]').value === threshold;
      card.classList.toggle('is-active', isActive);
      if (isActive) card.querySelector('input[type="radio"]').checked = true;
    });

    renderAccountList();
    overlay.classList.add('is-open');
  }

  function closeEditProfile() {
    const overlay = document.getElementById('editProfileOverlay');
    if (overlay) overlay.classList.remove('is-open');
  }

  function saveEditProfile() {
    const nickname = document.getElementById('epNickname').value.trim();
    const budget = parseFloat(document.getElementById('epBudget').value);

    if (!nickname) { showToast('请输入昵称', 'error'); return; }
    if (!budget || budget < 500) { showToast('预算至少为 ¥500', 'error'); return; }

    const user = getUser();
    user.nickname = nickname;
    user.budgetLimit = budget;

    const checkedRadio = document.querySelector('#editProfileOverlay input[name="epThreshold"]:checked');
    if (checkedRadio) user.warningThreshold = parseFloat(checkedRadio.value);

    saveUser(user);
    closeEditProfile();
    showToast('✅ 账户信息已更新', 'success');
    setTimeout(() => location.reload(), 500);
  }

  /* — AI 品牌文案生成 — */
  const BRAND_COPY_PROMPT = `你是 MoneyFlow 的品牌文案设计师。

MoneyFlow 是一款面向年轻人的个人财务管理产品，帮助用户了解消费习惯、控制预算、建立健康的金钱观。

你的任务是根据用户当前财务数据生成简短、有温度、有传播感的动态文案。

品牌调性

风格参考：
- Notion
- Linear
- Apple
- 支付宝年度账单
- 小红书成长类博主

核心关键词：
- 克制
- 简洁
- 数据感
- 成长感
- 温暖
- 高级感

禁止出现：
- 暴富
- 发财
- 搞钱
- 韭菜
- 财富自由
- 理财大师
- 投资秘籍
- 鸡汤式说教

输出要求
1. 字数控制在20~50字
2. 像真实互联网产品中的提示文案
3. 不使用夸张营销语言
4. 优先使用数据进行表达
5. 保持积极但不说教
6. 每次输出3条候选文案，用 --- 分隔`;

  function getAIConfig() {
    const raw = localStorage.getItem("moneyflow_ai_config");
    return raw ? JSON.parse(raw) : { apiKey: "", provider: "mock", model: "deepseek-chat" };
  }

  const COPY_CACHE_PREFIX = "mf_copy_";
  let _copyPageId = Date.now();

  function getCopyCache(key) {
    try {
      const raw = localStorage.getItem(COPY_CACHE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function setCopyCache(key, data) {
    try {
      localStorage.setItem(COPY_CACHE_PREFIX + key, JSON.stringify(data));
    } catch (e) {}
  }

  function dataDigest() {
    const tx = getTransactions();
    const user = getUser();
    const lastTx = tx.length > 0 ? tx[0].datetime : "none";
    return `${_copyPageId}_${tx.length}_${lastTx}_${user.budgetLimit}_${user.warningThreshold}`;
  }

  const COPY_GENERATORS = {
    greeting: {
      label: "问候语",
      selector: "#greeting",
      buildPrompt(data) {
        const hour = new Date().getHours();
        const period = hour < 6 ? "凌晨" : hour < 12 ? "上午" : hour < 14 ? "中午" : hour < 18 ? "下午" : "晚上";
        return `当前时间：${period}，用户昵称：${data.nickname || "用户"}。
根据以上信息生成 3 条温暖的招呼语，包含时间感和成长感，每条不超过 15 字。用 --- 分隔。`;
      },
      mockFallback(data) {
        const hour = new Date().getHours();
        const name = data.nickname || "";
        const prefix = hour < 6 ? ["夜深了", "新的一天开始了", "早安"] :
                       hour < 12 ? ["早上好", "早安", "新的一天"] :
                       hour < 14 ? ["中午好", "午安", "午后时光"] :
                       hour < 18 ? ["下午好", "午后的阳光", "下午的时光"] :
                       ["晚上好", "夜幕降临", "晚安前的时光"];
        return prefix.map(p => `${p}，${name} ✦`).slice(0, 3);
      }
    },

    networthFootnote: {
      label: "净资产描述",
      selector: "#statNetWorthFootnote",
      buildPrompt(data) {
        return `用户净资产：¥${data.netWorth.toFixed(0)}。根据这个数据生成 3 条简洁克制的文案，体现成长感和数据感。每条 10-20 字。用 --- 分隔。`;
      },
      mockFallback(data) {
        const nw = data.netWorth;
        if (nw > 10000) return ["稳步积累中 📈", "距离目标又近了一步", "每一笔都是选择的结果"];
        if (nw > 0) return ["开始于一笔笔的记录", "积少成多的力量", "数字在说话 ✦"];
        return ["从第一笔记录开始", "慢慢建立起自己的节奏", "每一步都算数"];
      }
    },

    txEmpty: {
      label: "空状态提示",
      selector: "#txEmptyText",
      buildPrompt(data) {
        return `用户还没有任何收支记录。生成 3 条简洁温暖的文案，鼓励用户记录第一笔账。每条 15-30 字。用 --- 分隔。`;
      },
      mockFallback() {
        return [
          "每一笔大钱，都从小账开始。",
          "记录今天的支出，收获明天的清晰。",
          "现在就记下第一笔吧，数据会告诉你答案 ✦",
        ];
      }
    },

    userTagline: {
      label: "用户标签",
      selector: "#userTagline",
      buildPrompt(data) {
        return `生成 3 条短句（6 字以内），作为个人财务管理产品的用户头衔。风格简洁温暖，如"理财新手"、"记账达人"。用 --- 分隔。`;
      },
      mockFallback(data) {
        const tx = data.transactionCount || 0;
        if (tx > 50) return ["记账达人", "消费观察家", "预算管理师"];
        if (tx > 10) return ["进阶记录者", "理财探索家", "数据爱好者"];
        return ["理财新手", "记账初体验", "财富探索者"];
      }
    },

    quickAddSubtitle: {
      label: "记一笔副标题",
      selector: "#qaSubtitle",
      buildPrompt(data) {
        return `生成 3 条个人记账弹窗中的简短提示语，凸显「记账」功能属性，鼓励用户如实记录每一笔收支。每条 10~20 字，简洁温暖有行动感。用 --- 分隔。`;
      },
      mockFallback() {
        return [
          "如实记录，才能看清每一笔流向 📝",
          "记下此刻的支出，掌控未来的财务",
          "每一笔记录，都是对自己的诚实",
        ];
      }
    },
  };

  /* — AI API 调用 — */
  async function fetchAIForCopy(prompt) {
    const config = getAIConfig();
    if (!config.apiKey || config.provider === "mock") return null;

    const API_URL = "https://api.deepseek.com/v1/chat/completions";
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + config.apiKey,
        },
        body: JSON.stringify({
          model: config.model || "deepseek-chat",
          messages: [
            { role: "system", content: BRAND_COPY_PROMPT },
            { role: "user", content: prompt },
          ],
          max_tokens: 500,
          temperature: 0.8,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (e) {
      return null;
    }
  }

  function parseCandidates(text) {
    if (!text) return null;
    const parts = text.split(/---|———|\.\n|(?:\d+[\.\、])/).map(s => s.trim()).filter(s => s.length > 3);
    if (parts.length >= 3) return parts.slice(0, 3);
    const sentences = text.split(/[。！\n]/).map(s => s.trim()).filter(s => s.length > 3);
    if (sentences.length >= 3) return sentences.slice(0, 3);
    return null;
  }

  async function generateBrandCopy(contextKey) {
    const gen = COPY_GENERATORS[contextKey];
    if (!gen) return null;

    const transactions = getTransactions();
    const user = getUser();
    const breakdown = calcCategoryBreakdown(transactions);
    const data = {
      nickname: user.nickname,
      netWorth: calcNetWorth(transactions),
      monthExpense: calcMonthExpense(transactions),
      monthIncome: calcMonthIncome(transactions),
      budgetRatio: calcBudgetRatio(transactions, user),
      transactionCount: transactions.length,
      topCategory: breakdown.length > 0 ? breakdown[0].category : null,
    };

    const digest = dataDigest();
    const cached = getCopyCache(contextKey);
    if (cached && cached.digest === digest) return cached.candidates;

    let candidates = null;
    const aiResult = await fetchAIForCopy(gen.buildPrompt(data));
    if (aiResult) candidates = parseCandidates(aiResult);
    if (!candidates || candidates.length < 3) candidates = gen.mockFallback(data);

    while (candidates.length < 3) candidates.push(candidates[0]);

    setCopyCache(contextKey, { candidates, digest, timestamp: Date.now() });
    return candidates;
  }

  function applyCopy(contextKey, candidates) {
    const gen = COPY_GENERATORS[contextKey];
    if (!gen || !candidates || candidates.length < 3) return;

    let index = 0;
    const el = document.querySelector(gen.selector);
    if (!el) return;

    if (gen.html) {
      el.innerHTML = candidates[0];
    } else {
      el.textContent = candidates[0];
    }

    if (el.dataset.copyInited) return;
    el.dataset.copyInited = "1";

    const badge = document.createElement("span");
    badge.className = "copy-badge";
    badge.textContent = "AI ✦";
    badge.title = "点击切换候选文案";
    badge.style.cssText = `
      display:inline-flex;align-items:center;gap:2px;vertical-align:middle;
      margin-left:8px;padding:1px 7px;border-radius:99px;
      font-size:10px;font-weight:600;letter-spacing:0.3px;
      background:rgba(16,185,129,0.12);color:#059669;
      cursor:pointer;transition:all 0.15s;user-select:none;
      line-height:1.6;
    `;
    badge.addEventListener("mouseenter", () => {
      badge.style.background = "rgba(16,185,129,0.2)";
    });
    badge.addEventListener("mouseleave", () => {
      badge.style.background = "rgba(16,185,129,0.12)";
    });
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      index = (index + 1) % 3;
      if (gen.html) {
        el.innerHTML = candidates[index];
      } else {
        el.textContent = candidates[index];
      }
      badge.textContent = `AI ✦ ${index + 1}/3`;
    });

    el.parentNode?.insertBefore(badge, el.nextSibling);
  }

  async function initBrandCopy() {
    const ctx = document.body.dataset.page;

    const tasks = [];
    if (ctx === "dashboard") {
      tasks.push("greeting", "networthFootnote", "quickAddSubtitle");
    }
    tasks.push("userTagline");

    for (const key of tasks) {
      try {
        const candidates = await generateBrandCopy(key);
        if (candidates) applyCopy(key, candidates);
      } catch (e) {}
    }
  }

  /* — 3D 倾斜卡片 — */
  function initTiltCards() {
    var cards = document.querySelectorAll('.tilt-card');
    if (!cards.length) return;
    var MAX_TILT = 15;

    cards.forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        card.classList.remove('is-resetting');

        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;

        var xNorm = (x / rect.width - 0.5) * 2;
        var yNorm = (y / rect.height - 0.5) * 2;

        var rotateX = yNorm * -MAX_TILT;
        var rotateY = xNorm * MAX_TILT;

        card.style.transform = 'rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg)';
        card.style.setProperty('--glare-x', (x / rect.width) * 100 + '%');
        card.style.setProperty('--glare-y', (y / rect.height) * 100 + '%');
        card.style.setProperty('--glare-opacity', '1');
      });

      card.addEventListener('mouseleave', function () {
        card.classList.add('is-resetting');
        card.style.transform = 'rotateX(0deg) rotateY(0deg)';
        card.style.setProperty('--glare-opacity', '0');
      });
    });
  }

  const ThemeManager = {
    themes: ["default", "amber", "ocean", "rose", "violet"],

    themeInfo: {
      default: { name: "深林绿", desc: "翡翠绿主调 · 清爽自然", color: "#10B981" },
      amber: { name: "琥珀朝霞", desc: "暖橙色调 · 温馨舒适", color: "#D97706" },
      ocean: { name: "海洋蓝", desc: "天空蔚蓝 · 清新明快", color: "#0EA5E9" },
      rose: { name: "玫瑰粉", desc: "热情活力 · 鲜艳明媚", color: "#E11D48" },
      violet: { name: "紫罗兰", desc: "优雅紫色 · 浪漫神秘", color: "#8B5CF6" },
    },

    setTheme(themeName) {
      var self = this;
      self.themes.forEach(function (t) {
        document.body.classList.remove("theme-" + t);
      });
      document.body.classList.add("theme-" + themeName);
      localStorage.setItem("mf_theme", themeName);

      document.querySelectorAll(".sidebar-theme-swatch").forEach(function (el) {
        var isActive = el.dataset.theme === themeName;
        el.classList.toggle("is-active", isActive);
        var check = el.querySelector(".sidebar-theme-swatch__check");
        if (check) check.textContent = isActive ? "✓" : "";
      });
      document.querySelectorAll(".ft-card").forEach(function (el) {
        el.classList.toggle("is-active", el.dataset.theme === themeName);
      });
    },

    _buildFloatingUI: function () {
      var self = this;
      var existing = document.getElementById("floatingThemeWrap");
      if (existing) existing.remove();

      var saved = localStorage.getItem("mf_theme") || "default";

      var wrap = document.createElement("div");
      wrap.id = "floatingThemeWrap";

      var popup = document.createElement("div");
      popup.className = "modal-overlay";
      popup.id = "floatingThemePopup";

      var modal = document.createElement("div");
      modal.className = "modal";
      modal.style.maxWidth = "420px";
      modal.style.padding = "24px";

      var modalHeader = document.createElement("div");
      modalHeader.className = "modal__header";
      modalHeader.innerHTML = '<h3>🎨 切换主题</h3><button class="modal__close" id="ftClose">✕</button>';
      modal.appendChild(modalHeader);

      self.themes.forEach(function (t) {
        var info = self.themeInfo[t];
        var card = document.createElement("div");
        card.className = "ft-card" + (t === saved ? " is-active" : "");
        card.dataset.theme = t;

        var bar = document.createElement("div");
        bar.className = "ft-card__bar";
        bar.style.background = info.color;
        bar.title = info.name;
        card.appendChild(bar);

        var body = document.createElement("div");
        body.className = "ft-card__body";

        var nameEl = document.createElement("div");
        nameEl.className = "ft-card__name";
        nameEl.textContent = info.name;
        body.appendChild(nameEl);

        var descEl = document.createElement("div");
        descEl.className = "ft-card__desc";
        descEl.textContent = info.desc;
        body.appendChild(descEl);

        card.appendChild(body);
        modal.appendChild(card);
      });

      popup.appendChild(modal);
      wrap.appendChild(popup);
      document.body.appendChild(wrap);

      document.getElementById("ftClose").addEventListener("click", function () {
        popup.classList.remove("is-open");
      });

      popup.addEventListener("click", function (e) {
        if (e.target === popup) {
          popup.classList.remove("is-open");
        }
      });

      document.addEventListener("click", function (e) {
        var userWrap = document.querySelector(".sidebar__user-wrap");
        if (userWrap && !userWrap.contains(e.target)) {
          userWrap.classList.remove("is-open");
        }

        var card = e.target.closest(".ft-card");
        if (card && card.dataset.theme) {
          self.setTheme(card.dataset.theme);
          popup.classList.remove("is-open");
          return;
        }

        var switchBtn = e.target.closest("#themeSwitchBtn");
        if (switchBtn) {
          popup.classList.add("is-open");
          var uw = document.querySelector(".sidebar__user-wrap");
          if (uw) uw.classList.remove("is-open");
          return;
        }

        var userBtn = e.target.closest("#sidebarUserBtn");
        if (userBtn) {
          var uw = document.querySelector(".sidebar__user-wrap");
          if (uw) uw.classList.toggle("is-open");
          return;
        }

        var swatch = e.target.closest(".sidebar-theme-swatch");
        if (swatch && swatch.dataset.theme) {
          self.setTheme(swatch.dataset.theme);
          var userWrap2 = document.querySelector(".sidebar__user-wrap");
          if (userWrap2) userWrap2.classList.remove("is-open");
        }
      });
    },

    init: function () {
      var saved = localStorage.getItem("mf_theme") || "default";
      this.setTheme(saved);
      this._buildFloatingUI();
    },
  };

  return {
    CATEGORY_ICONS,
    EXPENSE_CATEGORIES,
    INCOME_CATEGORIES,
    DEFAULT_ACCOUNTS,

    getSession,
    isLoggedIn,
    getCurrentEmail,
    registerUser,
    loginUser,
    logout,

    getUser,
    saveUser,
    getAccounts,
    saveAccounts,
    getTransactions,
    saveTransactions,
    addTransaction,
    deleteTransaction,

    formatCurrency,
    formatDateTime,

    calcNetWorth,
    calcMonthExpense,
    calcMonthIncome,
    calcBudgetRatio,
    calcCategoryBreakdown,
    generateInsight,
    renderWaterGauge,

    initClock,
    highlightActiveNav,
    showToast,
    animateNumber,

    generateBrandCopy,
    initBrandCopy,
    getAIConfig,
  };
})();
