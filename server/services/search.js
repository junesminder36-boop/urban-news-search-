const axios = require("axios");
const cheerio = require("cheerio");
const { fetchRSSFeeds } = require("./rssFeeds");
const { crawlTargetedSites } = require("./targetedCrawler");

async function searchBaiduNews(keyword) {
  try {
    const url = `https://www.baidu.com/s?wd=${encodeURIComponent(keyword + " 新闻")}&tn=news&rtt=4`;
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      timeout: 10000,
    });

    const $ = cheerio.load(res.data);
    const results = [];

    $(".result, .c-container").each((_, el) => {
      const titleEl = $(el).find("h3 a, .t a").first();
      const title = titleEl.text().trim();
      const link = titleEl.attr("href");
      const abstract = $(el).find(".c-abstract, [class*='abstract']").text().trim();
      const sourceAndDate = $(el).find(".g, [class*='source']").first().text().trim();

      let source = "百度新闻";
      let pubDate = "";

      // 尝试提取来源和日期
      const sourceMatch = sourceAndDate.match(/([^\s]+)\s+(\d{4}-\d{2}-\d{2})/);
      if (sourceMatch) {
        source = sourceMatch[1];
        pubDate = sourceMatch[2];
      }

      if (title && link) {
        results.push({
          title,
          link: link.startsWith("http") ? link : `https://www.baidu.com${link}`,
          abstract: abstract || "",
          source,
          pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        });
      }
    });

    return results.slice(0, 10);
  } catch (err) {
    console.error("百度新闻搜索失败:", err.message);
    return [];
  }
}

// 自动分类
function autoCategorize(item) {
  const title = (item.title || "").toLowerCase();
  const abstract = (item.abstract || "").toLowerCase();
  const source = (item.source || "").toLowerCase();
  const text = title + " " + abstract;

  // 中央政策
  const centralKeywords = ["国务院", "住建部", "自然资源部", "发改委", "财政部", "中央", " nationwide"];
  const centralSources = ["中国政府网", "住建部", "新华网时政", "自然资源部"];
  if (centralSources.some(s => source.includes(s.toLowerCase())) ||
      centralKeywords.some(k => text.includes(k))) {
    return "中央政策";
  }

  // 城市更新数字化
  const digitalKeywords = ["数字化", "智慧", "cim", "bim", "大数据", "信息平台", "智能", "数字孪生", "智慧城市", "科技赋能"];
  if (digitalKeywords.some(k => text.includes(k))) {
    return "城市更新数字化";
  }

  // 地方实践案例
  const practiceKeywords = ["案例", "实践", "经验", "探索", "模式", "试点", "示范", "样板", "典型", "成效", "成果", "项目落地", "实施"];
  if (practiceKeywords.some(k => text.includes(k))) {
    return "地方实践案例";
  }

  // 地方政策
  const localSources = ["市规划和自然资源", "市自然资源", "市住建局", "市规划和自然资源局", "市住房和城乡建设"];
  const localKeywords = ["印发", "出台", "发布", "通知", "意见", "方案", "规划", "办法", "规定", "细则", "条例", "指南", "标准"];
  if (localSources.some(s => source.includes(s.toLowerCase())) ||
      localKeywords.some(k => text.includes(k))) {
    return "地方政策";
  }

  // 行业观点
  const opinionSources = ["澎湃", "财新", "第一财经", "21世纪经济", "经济观察", "新浪", "界面", "搜狐", "腾讯", "网易"];
  const opinionKeywords = ["观点", "评论", "访谈", "专访", "分析", "解读", "观察", "思考", "探讨", "对话", "展望", "趋势"];
  if (opinionSources.some(s => source.includes(s.toLowerCase())) ||
      opinionKeywords.some(k => text.includes(k))) {
    return "行业观点";
  }

  // 默认：如果来源是地方政府，归为地方政策
  if (source.includes("市") || source.includes("区") || source.includes("县")) {
    return "地方政策";
  }

  return "行业观点";
}

async function searchAll(keyword) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [rssResults, targetedResults, baiduResults] = await Promise.all([
    fetchRSSFeeds(keyword).catch((e) => { console.error("RSS失败:", e.message); return []; }),
    crawlTargetedSites(keyword).catch((e) => { console.error("定向爬取失败:", e.message); return []; }),
    searchBaiduNews(keyword).catch((e) => { console.error("百度新闻失败:", e.message); return []; }),
  ]);

  // 合并所有来源
  const all = [...rssResults, ...targetedResults, ...baiduResults];

  // 去重（基于标题相似度）
  const seen = new Set();
  const unique = [];
  for (const item of all) {
    const key = item.title.slice(0, 20);
    if (seen.has(key)) continue;
    seen.add(key);

    // 自动分类（如果还没有分类）
    if (!item.category) {
      item.category = autoCategorize(item);
    }

    // 格式化日期
    if (item.pubDate) {
      try {
        item.pubDate = new Date(item.pubDate).toISOString();
      } catch {
        item.pubDate = new Date().toISOString();
      }
    } else {
      item.pubDate = new Date().toISOString();
    }

    unique.push(item);
  }

  // 按日期排序
  unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  return unique.slice(0, 30);
}

module.exports = { searchAll };
