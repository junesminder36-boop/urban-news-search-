const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
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

searchBtn.addEventListener("click", doSearch);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});

categoryTabs.addEventListener("click", (e) => {
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
  searchBtn.textContent = "搜索中...";
  results.classList.add("hidden");
  error.classList.add("hidden");
  loading.classList.remove("hidden");

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    loading.classList.add("hidden");
    searchBtn.disabled = false;
    searchBtn.textContent = "🔍 搜索";

    if (data.error) {
      showError(data.error);
      return;
    }

    currentData = data;
    renderResults(data);
  } catch (err) {
    loading.classList.add("hidden");
    searchBtn.disabled = false;
    searchBtn.textContent = "🔍 搜索";
    showError(`请求失败: ${err.message}`);
  }
}

function renderResults(data) {
  results.classList.remove("hidden");

  // 统计栏
  const catCounts = [];
  if (data.categories) {
    for (const [cat, items] of Object.entries(data.categories)) {
      if (items.length > 0) {
        catCounts.push(`${cat}: ${items.length}条`);
      }
    }
  }
  statsBar.innerHTML = `<span>共找到 ${data.total || 0} 条新闻</span>` + catCounts.map((c) => `<span>${c}</span>`).join("");

  // AI 摘要
  if (data.summary) {
    summaryContent.textContent = data.summary;
  } else {
    summaryContent.textContent = "暂无 AI 分析结果。";
  }

  // 关键要点
  if (data.highlights && data.highlights.length > 0) {
    const ul = document.createElement("ul");
    data.highlights.forEach((h) => {
      const li = document.createElement("li");
      li.textContent = h;
      ul.appendChild(li);
    });
    highlightsContent.innerHTML = "<h3>📌 关键要点</h3>";
    highlightsContent.appendChild(ul);
  } else if (data.raw) {
    highlightsContent.innerHTML = `<h3>📌 AI 回复</h3><pre style="white-space:pre-wrap;font-size:13px;line-height:1.6;color:#555;">${escapeHtml(data.raw)}</pre>`;
  } else {
    highlightsContent.innerHTML = '<h3>📌 关键要点</h3><p style="color:#999;">暂无要点</p>';
  }

  // 新闻列表
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
    newsList.innerHTML = `<p style="color:#fff;text-align:center;padding:40px;">该分类下暂无新闻</p>`;
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
        ${dateStr ? `<span class="date">📅 ${dateStr}</span>` : ""}
      </div>
    `;
    newsList.appendChild(card);
  });
}

function formatDate(isoDate) {
  try {
    const d = new Date(isoDate);
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
