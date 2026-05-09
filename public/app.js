const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const dailyBtn = document.getElementById("dailyBtn");
const loading = document.getElementById("loading");
const results = document.getElementById("results");
const error = document.getElementById("error");
const summaryContent = document.getElementById("summaryContent");
const highlightsContent = document.getElementById("highlightsContent");
const newsList = document.getElementById("newsList");
const statsBar = document.getElementById("statsBar");
const categoryTabs = document.getElementById("categoryTabs");

let currentData = null;
let activeCategory = "all";

searchBtn?.addEventListener("click", doSearch);
searchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});

if (dailyBtn) {
  dailyBtn.addEventListener("click", doDaily);
}

categoryTabs?.addEventListener("click", (e) => {
  if (e.target.classList.contains("tab-btn")) {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");
    activeCategory = e.target.dataset.cat;
    renderNewsList();
  }
});

async function doSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  searchBtn.disabled = true;
  searchBtn.textContent = "搜索中";
  results.classList.add("hidden");
  error.classList.add("hidden");
  loading.classList.remove("hidden");

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await readApiJson(res);

    loading.classList.add("hidden");
    searchBtn.disabled = false;
    searchBtn.textContent = "搜索";

    if (data.error) {
      showError(data.error);
      return;
    }

    currentData = data;
    resetCategory();
    renderResults(data);
  } catch (err) {
    loading.classList.add("hidden");
    searchBtn.disabled = false;
    searchBtn.textContent = "搜索";
    showError(`请求失败: ${err.message}`);
  }
}

function resetCategory() {
  activeCategory = "all";
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  const allTab = document.querySelector('.tab-btn[data-cat="all"]');
  if (allTab) allTab.classList.add("active");
}

function renderResults(data) {
  results.classList.remove("hidden");

  const catCounts = [];
  if (data.categories) {
    for (const [cat, items] of Object.entries(data.categories)) {
      if (items.length > 0) {
        catCounts.push(`${cat}: ${items.length}条`);
      }
    }
  }
  if (statsBar) {
    statsBar.innerHTML = `<span>共找到 ${data.total || 0} 条新闻</span>` + catCounts.map((c) => `<span>${escapeHtml(c)}</span>`).join("");
  }

  if (summaryContent) {
    if (data.summary) {
      summaryContent.textContent = data.summary;
    } else {
      summaryContent.textContent = "暂无 AI 分析结果。";
    }
  }

  if (highlightsContent) {
    if (data.highlights && data.highlights.length > 0) {
      const ul = document.createElement("ul");
      data.highlights.forEach((h) => {
        const li = document.createElement("li");
        li.textContent = h;
        ul.appendChild(li);
      });
      highlightsContent.innerHTML = "<h3>关键要点</h3>";
      highlightsContent.appendChild(ul);
    } else if (data.raw) {
      highlightsContent.innerHTML = `<h3>AI 回复</h3><pre class="raw-response">${escapeHtml(data.raw)}</pre>`;
    } else {
      highlightsContent.innerHTML = '<h3>关键要点</h3><p class="empty-note">暂无要点</p>';
    }
  }

  const aiAssistantEl = document.getElementById("aiAssistant");
  if (aiAssistantEl) aiAssistantEl.classList.remove("hidden");
  const mdReport = document.getElementById("markdownReport");
  if (mdReport) mdReport.classList.add("hidden");

  renderNewsList();
}

function renderNewsList() {
  if (!currentData) return;

  let items = [];
  if (activeCategory === "all") {
    items = currentData.results || [];
  } else if (currentData.categories && currentData.categories[activeCategory]) {
    items = currentData.categories[activeCategory];
  }

  newsList.innerHTML = "";

  if (items.length === 0) {
    newsList.innerHTML = `<div class="empty-state">该分类下暂无新闻</div>`;
    return;
  }

  items.forEach((r) => {
    const card = document.createElement("a");
    card.className = "news-card";
    card.href = r.url;
    card.target = "_blank";
    card.rel = "noopener";

    const dateStr = r.pubDate ? formatDate(r.pubDate) : "";
    const catClass = `cat-${r.category || "行业观点"}`;

    card.innerHTML = `
      <div class="news-card-header">
        <h3>${escapeHtml(r.title)}</h3>
        <span class="news-category ${catClass}">${escapeHtml(r.category || "行业观点")}</span>
      </div>
      <p>${escapeHtml(r.abstract || "暂无摘要")}</p>
      <div class="news-meta">
        <span class="source">${escapeHtml(r.source || "未知来源")}</span>
        ${dateStr ? `<span class="date">${dateStr}</span>` : ""}
      </div>
    `;
    newsList.appendChild(card);
  });
}

function formatDate(isoDate) {
  if (!isoDate) return "";
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return "";
  }
}

function showError(msg) {
  error.textContent = msg;
  error.classList.remove("hidden");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function readApiJson(res) {
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    throw new Error(`接口返回 ${res.status}，请确认后端服务已连接`);
  }
  if (!contentType.includes("application/json")) {
    throw new Error("接口未返回 JSON，请确认当前不是纯静态预览环境");
  }
  return res.json();
}

/* ===== 日报缓存 ===== */
const CACHE_PREFIX = "youma_daily_";

function getDailyCacheKey() {
  const today = new Date().toISOString().slice(0, 10);
  const isCityPage = document.title.includes("城市更新");
  return `${CACHE_PREFIX}${isCityPage ? "city" : "industry"}_${today}`;
}

function loadDailyCache() {
  try {
    return JSON.parse(localStorage.getItem(getDailyCacheKey()));
  } catch {
    return null;
  }
}

function saveDailyCache(data) {
  localStorage.setItem(getDailyCacheKey(), JSON.stringify(data));
}

function clearDailyCache() {
  localStorage.removeItem(getDailyCacheKey());
}

async function doDaily(force = false) {
  if (!dailyBtn) return;

  if (!force) {
    const cached = loadDailyCache();
    if (cached && cached.results && cached.results.length > 0) {
      currentData = cached;
      resetCategory();
      renderResults(cached);
      return;
    }
  }

  if (dailyBtn) {
    dailyBtn.disabled = true;
    dailyBtn.textContent = "生成中";
  }
  results.classList.add("hidden");
  const mdReport = document.getElementById("markdownReport");
  const aiAssistant = document.getElementById("aiAssistant");
  if (mdReport) mdReport.classList.add("hidden");
  if (aiAssistant) aiAssistant.classList.add("hidden");
  error.classList.add("hidden");
  loading.classList.remove("hidden");

  try {
    const isCityPage = document.title.includes("城市更新");
    const apiUrl = isCityPage ? "/api/city-daily" : "/api/daily";
    const res = await fetch(apiUrl);
    const data = await readApiJson(res);

    loading.classList.add("hidden");
    if (dailyBtn) {
      dailyBtn.disabled = false;
      dailyBtn.textContent = "一键生成今日新闻";
    }

    if (data.error) {
      showError(data.error);
      return;
    }

    currentData = data;
    saveDailyCache(data);
    resetCategory();
    renderResults(data);
  } catch (err) {
    loading.classList.add("hidden");
    if (dailyBtn) {
      dailyBtn.disabled = false;
      dailyBtn.textContent = "一键生成今日新闻";
    }
    showError(`请求失败: ${err.message}`);
  }
}

// 复制日报功能
function copyDailyContent() {
  if (!currentData || !currentData.results) {
    showToast("请先生成日报");
    return;
  }

  // 优先使用后端生成的 Markdown 日报模板
  if (currentData.dailyReport) {
    navigator.clipboard.writeText(currentData.dailyReport).then(() => {
      showToast("日报内容已复制");
    }).catch(() => {
      showToast("复制失败，请手动复制");
    });
    return;
  }

  const dateStr = new Date().toLocaleDateString("zh-CN");
  const title = document.title.includes("城市更新") ? "城市更新日报" : "行业日报";
  let text = `${title} (${dateStr})\n\n`;

  const items = currentData.results || [];
  items.forEach((r, i) => {
    const date = r.pubDate ? formatDate(r.pubDate) : "";
    text += `${i + 1}. [${r.category || "新闻"}] ${r.title}\n`;
    if (r.abstract) text += `   ${r.abstract}\n`;
    if (r.source) text += `   来源: ${r.source}`;
    if (date) text += ` | ${date}`;
    text += `\n   链接: ${r.url}\n\n`;
  });

  navigator.clipboard.writeText(text).then(() => {
    showToast("日报内容已复制");
  }).catch(() => {
    showToast("复制失败，请手动复制");
  });
}

// 绑定复制按钮
const copyBtn = document.getElementById("copyBtn");
if (copyBtn) {
  copyBtn.addEventListener("click", copyDailyContent);
}

function showToast(message) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

const initialQuery = new URLSearchParams(location.search).get("q");
if (initialQuery && searchInput) {
  searchInput.value = initialQuery;
  doSearch();
}

/* 刷新按钮 */
const refreshBtn = document.getElementById("refreshBtn");
if (refreshBtn) {
  refreshBtn.addEventListener("click", () => {
    clearDailyCache();
    doDaily(true);
  });
}

/* ===== Markdown 日报展示 ===== */
function showMarkdownReport() {
  if (!currentData || !currentData.dailyReport) {
    showToast("请先生成今日新闻");
    return;
  }
  const mdReport = document.getElementById("markdownReport");
  const mdContent = document.getElementById("markdownContent");
  if (mdReport && mdContent) {
    mdContent.textContent = currentData.dailyReport;
    mdReport.classList.remove("hidden");
    mdReport.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function copyMarkdownReport() {
  if (!currentData || !currentData.dailyReport) {
    showToast("请先生成日报");
    return;
  }
  navigator.clipboard.writeText(currentData.dailyReport).then(() => {
    showToast("日报已复制");
  }).catch(() => {
    showToast("复制失败，请手动复制");
  });
}

/* 绑定新按钮 */
const generateReportBtn = document.getElementById("generateReportBtn");
if (generateReportBtn) {
  generateReportBtn.addEventListener("click", showMarkdownReport);
}

const copyMarkdownBtn = document.getElementById("copyMarkdownBtn");
if (copyMarkdownBtn) {
  copyMarkdownBtn.addEventListener("click", copyMarkdownReport);
}

/* ===== 缓存恢复（含 bfcache 处理） ===== */
function tryRestoreFromCache() {
  const cached = loadDailyCache();
  if (cached && cached.results && cached.results.length > 0) {
    currentData = cached;
    resetCategory();
    renderResults(cached);
    return true;
  }
  return false;
}

// 页面首次加载
(function restoreDailyOnLoad() {
  tryRestoreFromCache();
})();

// 从浏览器 bfcache 恢复时（前进/后退）
window.addEventListener("pageshow", (e) => {
  if (e.persisted) {
    tryRestoreFromCache();
  }
});
