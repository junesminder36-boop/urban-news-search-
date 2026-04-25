const axios = require("axios");
const cheerio = require("cheerio");

// 政策法规关键词
const POLICY_KEYWORDS = [
  "老旧小区 改造 政策",
  "智慧物业 政策",
  "智慧城市 规划 政策",
  "物业管理 条例",
  "城市更新 政策",
];

// 行业要闻关键词
const INDUSTRY_KEYWORDS = [
  "物业数字化",
  "智慧社区",
  "地产科技",
  "物管行业",
  "数字孪生 城市",
  "智慧园区",
  "地产物业资产管理",
  "资产运营",
];

// 企业动态 - 头部房企/物企
const ENTERPRISES = [
  { name: "万科", keywords: ["万科 数字化", "万科 智慧社区", "万科 物业"] },
  { name: "碧桂园", keywords: ["碧桂园 服务", "碧桂园 数字化"] },
  { name: "龙湖", keywords: ["龙湖 智慧", "龙湖 物业", "龙湖 数字化"] },
  { name: "万物云", keywords: ["万物云", "万物云 上市", "万物云 科技"] },
  { name: "保利", keywords: ["保利 物业", "保利 数字化"] },
  { name: "绿城", keywords: ["绿城 服务", "绿城 智慧"] },
  { name: "中海", keywords: ["中海 物业", "中海 商业"] },
  { name: "华润", keywords: ["华润 万象生活", "华润 物业"] },
  { name: "招商蛇口", keywords: ["招商蛇口", "招商 物业"] },
  { name: "金地", keywords: ["金地 物业", "金地 智慧"] },
];

// 获取百度跳转链接的真实URL
async function resolveBaiduLink(baiduUrl) {
  try {
    const res = await axios.get(baiduUrl, {
      maxRedirects: 0,
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      validateStatus: (status) => status >= 200 && status < 400,
    });
    // 如果没有重定向，返回原始URL
    return res.request.res.responseUrl || baiduUrl;
  } catch (err) {
    // 捕获重定向响应
    if (err.response) {
      const loc = err.response.headers && err.response.headers.location;
      if (loc) return loc;
      // 尝试从响应数据中解析
      const match = err.response.data && err.response.data.match(/URL='([^']+)'/);
      if (match) return match[1];
    }
    return baiduUrl;
  }
}

// 过滤掉不实用的新闻
function isValidResult(item) {
  const title = item.title || "";
  const url = item.link || "";
  const lowerTitle = title.toLowerCase();
  const lowerUrl = url.toLowerCase();

  // 标题太短 = 广告或无意义内容
  if (title.length < 10) return false;

  // 过滤百度百科系列
  const baiduTrash = [
    "baike.baidu", "zhidao.baidu", "wenku.baidu", "jingyan.baidu",
    "tieba.baidu", "v.baidu", "haokan.baidu", "map.baidu",
  ];
  if (baiduTrash.some((d) => lowerUrl.includes(d))) return false;
  if (title.includes("百度百科") || title.includes("百度知道") || title.includes("百度文库")) return false;

  // 过滤论坛/社区/博客
  const forumDomains = [
    "bbs.", "forum.", "club.", "zhihu.com/question", "jianshu.com",
    "csdn.net", "blog.csdn", "cnblogs.com", "weibo.com", "douyin.com",
    "bilibili.com", "xiaohongshu.com", "sohu.com/a", "163.com/dy",
  ];
  if (forumDomains.some((d) => lowerUrl.includes(d))) return false;

  // 过滤电商/购物/广告
  const adKeywords = [
    "招聘", "诚聘", "薪资", "加盟", "代理", "厂家", "批发", "价格", "多少钱",
    "怎么样", "好不好", "推荐", "排行榜", "十大", "加盟", "电话", "地址",
    "官网", "官方旗舰店", "优惠券", "秒杀", "限时", "免费领", "点击领取",
  ];
  if (adKeywords.some((k) => lowerTitle.includes(k))) return false;

  // 过滤纯数字标题（通常是广告编号）
  if (/^\d+$/.test(title.replace(/\s/g, ""))) return false;

  // 过滤无意义符号过多的标题
  if ((title.match(/[【\[\|｜]/g) || []).length >= 2) return false;

  return true;
}

// 计算新闻质量分，优先保留高质量内容
function scoreNews(item) {
  let score = 0;
  const title = item.title || "";
  const url = item.link || "";

  // 标题长度适中
  if (title.length >= 15 && title.length <= 40) score += 2;

  // 包含新闻特征词
  const newsWords = ["发布", "出台", "推进", "加快", "深化", "试点", "落地", "启动", "签约", "中标", "招标", "规划", "方案", "政策", "通知", "意见", "报告", "分析", "观察", "动态"];
  if (newsWords.some((w) => title.includes(w))) score += 3;

  // 来源是权威媒体或政府网站
  const trustedDomains = [
    "gov.cn", "mohurd.gov", "ndrc.gov", "people.com.cn", "xinhuanet",
    "thepaper.cn", "caixin.com", "yicai.com", "eeo.com.cn", "21jingji",
    "sina.com.cn", "sohu.com", "qq.com", "ifeng.com", "china.com.cn",
  ];
  if (trustedDomains.some((d) => url.includes(d))) score += 3;

  // 企业名称 = 企业动态，加分
  const entNames = ENTERPRISES.map((e) => e.name);
  if (entNames.some((name) => title.includes(name))) score += 2;

  return score;
}

// 过滤指定天数内的新闻
function filterByDate(items, days = 3) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return items.filter((item) => {
    const d = new Date(item.pubDate || Date.now());
    return d >= cutoff;
  });
}

async function searchBaidu(keyword, days = 3) {
  try {
    // 百度时间过滤参数：gpc=stf=开始时间戳,结束时间戳|stftype=1
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - days * 24 * 60 * 60;
    const gpc = `stf=${startTime},${endTime}|stftype=1`;
    const url = `https://www.baidu.com/s?wd=${encodeURIComponent(keyword)}&gpc=${encodeURIComponent(gpc)}`;
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
      const dateText = $(el).find(".g, .c-color-gray2").first().text().trim();

      if (title && link) {
        results.push({
          title,
          link: link.startsWith("http") ? link : `https://www.baidu.com${link}`,
          abstract: abstract || "",
          source: "百度搜索",
          pubDate: parseDateFromBaidu(dateText),
        });
      }
    });

    // 过滤 + 解析真实URL
    const validResults = results.filter(isValidResult);

    // 解析真实URL（并行）
    const resolved = await Promise.all(
      validResults.map(async (r) => {
        const realUrl = await resolveBaiduLink(r.link);
        return { ...r, link: realUrl };
      })
    );

    return resolved.slice(0, 5);
  } catch (err) {
    console.error("百度搜索失败:", err.message);
    return [];
  }
}

function parseDateFromBaidu(dateText) {
  // 百度常见日期格式：2026-04-24、04-24、1天前、2小时前
  if (!dateText) return new Date().toISOString();

  // 匹配 2026-04-24 或 04-24
  const fullDateMatch = dateText.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (fullDateMatch) {
    return new Date(`${fullDateMatch[1]}-${fullDateMatch[2].padStart(2, "0")}-${fullDateMatch[3].padStart(2, "0")}`).toISOString();
  }

  const shortDateMatch = dateText.match(/(\d{1,2})-(\d{1,2})/);
  if (shortDateMatch) {
    const year = new Date().getFullYear();
    return new Date(`${year}-${shortDateMatch[1].padStart(2, "0")}-${shortDateMatch[2].padStart(2, "0")}`).toISOString();
  }

  // 匹配 X天前
  const daysAgoMatch = dateText.match(/(\d+)\s*天前/);
  if (daysAgoMatch) {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(daysAgoMatch[1]));
    return d.toISOString();
  }

  // 匹配 X小时前
  const hoursAgoMatch = dateText.match(/(\d+)\s*小时前/);
  if (hoursAgoMatch) {
    const d = new Date();
    d.setHours(d.getHours() - parseInt(hoursAgoMatch[1]));
    return d.toISOString();
  }

  return new Date().toISOString();
}

async function searchPolicyNews(days = 3) {
  const all = [];
  for (const kw of POLICY_KEYWORDS) {
    const results = await searchBaidu(kw, days);
    all.push(...results);
  }
  return deduplicate(all);
}

async function searchIndustryNews(days = 3) {
  const all = [];
  for (const kw of INDUSTRY_KEYWORDS) {
    const results = await searchBaidu(kw, days);
    all.push(...results);
  }
  return deduplicate(all);
}

async function searchEnterpriseNews(days = 3) {
  const all = [];
  for (const ent of ENTERPRISES) {
    for (const kw of ent.keywords) {
      const results = await searchBaidu(kw, days);
      all.push(...results.map((r) => ({ ...r, enterprise: ent.name })));
    }
  }
  return deduplicate(all);
}

function deduplicate(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.title.slice(0, 20);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortByQuality(items) {
  return items
    .map((item) => ({ ...item, _score: scoreNews(item) }))
    .sort((a, b) => b._score - a._score)
    .map((item) => {
      const { _score, ...rest } = item;
      return rest;
    });
}

function categorizeDaily(item) {
  const text = `${item.title} ${item.abstract}`.toLowerCase();

  if (text.includes("政策") || text.includes("通知") || text.includes("意见") || text.includes("条例") || text.includes("规划") || text.includes("办法") || text.includes("规定")) {
    return "政策法规速递";
  }

  const entNames = ENTERPRISES.map((e) => e.name);
  if (entNames.some((name) => text.includes(name.toLowerCase()))) {
    return "企业动态精选";
  }

  return "行业要闻精选";
}

async function generateDailyReport(query, days = 3) {
  let [policyNews, industryNews, enterpriseNews] = await Promise.all([
    searchPolicyNews(days),
    searchIndustryNews(days),
    searchEnterpriseNews(days),
  ]);

  // 如果用户输入了关键词，额外搜索一次（同样限制时间范围）
  if (query && query.trim()) {
    const extra = await searchBaidu(query.trim(), days);
    industryNews.push(...extra);
  }

  let all = [...policyNews, ...industryNews, ...enterpriseNews];

  // 按日期二次过滤，确保只保留近N天的新闻
  all = filterByDate(all, days);

  // 去重 + 按质量排序 + 限制15条
  all = deduplicate(all);
  all = sortByQuality(all);
  all = all.slice(0, 15);

  all.forEach((item) => {
    item.category = categorizeDaily(item);
    if (!item.abstract || item.abstract.length === 0) {
      item.abstract = item.title.slice(0, 20) + "...";
    } else {
      item.abstract = item.abstract.slice(0, 20) + (item.abstract.length > 20 ? "..." : "");
    }
  });

  const categories = {
    "政策法规速递": [],
    "行业要闻精选": [],
    "企业动态精选": [],
  };

  all.forEach((item) => {
    if (categories[item.category]) {
      categories[item.category].push(item);
    } else {
      categories["行业要闻精选"].push(item);
    }
  });

  return {
    total: all.length,
    categories,
    results: all.map((r) => ({
      title: r.title,
      url: r.link,
      abstract: r.abstract,
      source: r.source,
      pubDate: r.pubDate,
      category: r.category,
      enterprise: r.enterprise || null,
    })),
    date: new Date().toISOString().split("T")[0],
  };
}

module.exports = { generateDailyReport, ENTERPRISES };
