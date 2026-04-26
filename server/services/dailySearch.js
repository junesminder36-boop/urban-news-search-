const axios = require("axios");
const cheerio = require("cheerio");

// ========== 行业日报关键词 ==========
const POLICY_KEYWORDS = [
  "老旧小区 改造 政策",
  "智慧物业 政策",
  "智慧城市 规划 政策",
  "物业管理 条例",
  "城市更新 政策",
];

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

// ========== 城市更新日报关键词 ==========
const CITY_POLICY_KEYWORDS = [
  "国务院 城市更新 政策",
  "住建部 城市更新 通知",
  "自然资源部 城市更新",
  "发改委 城市更新 规划",
];

const CITY_LOCAL_KEYWORDS = [
  "深圳 城市更新 政策",
  "广州 城市更新 改造",
  "北京 城市更新 项目",
  "上海 城市更新 规划",
  "成都 城市更新 案例",
  "杭州 城市更新 动态",
];

const CITY_PRACTICE_KEYWORDS = [
  "老旧小区改造 案例 成效",
  "城中村改造 项目 进展",
  "片区综合开发 城市更新",
  "历史街区保护 更新 活化",
  "微更新 口袋公园 社区",
];

const CITY_DIGITAL_KEYWORDS = [
  "城市更新 数字化 平台",
  "城市更新 CIM 数字孪生",
  "城市更新 智慧化 系统",
  "城市更新 大数据 运营",
];

// ========== 来源解析 ==========
function extractSourceFromUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function extractSourceFromText(text) {
  if (!text) return "";
  // 百度结果中的来源格式通常是 "site.com · 日期" 或 "site.com"
  const match = text.match(/^([^\s·|]+)/);
  return match ? match[1].replace(/^www\./, "").trim() : "";
}

// ========== 日期解析 ==========
function parseDateFromBaidu(dateText) {
  if (!dateText) return "";

  // 匹配 2026-04-24
  const fullDateMatch = dateText.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (fullDateMatch) {
    return new Date(`${fullDateMatch[1]}-${fullDateMatch[2].padStart(2, "0")}-${fullDateMatch[3].padStart(2, "0")}`).toISOString();
  }

  // 匹配 04-24
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

  return "";
}

// ========== URL 解析 ==========
async function resolveBaiduLink(baiduUrl) {
  try {
    const res = await axios.get(baiduUrl, {
      maxRedirects: 5,
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    // 跟随重定向后的最终URL
    const finalUrl = res.request?.res?.responseUrl || res.config?.url || baiduUrl;
    return finalUrl;
  } catch (err) {
    if (err.response) {
      const loc = err.response.headers && err.response.headers.location;
      if (loc) return loc;
      // 解析HTML中的跳转
      const html = err.response.data || "";
      const metaMatch = html.match(/http-equiv=["']refresh["'][^>]*url=([^"']+)/i);
      if (metaMatch) return metaMatch[1];
      const jsMatch = html.match(/URL=['"]([^'"]+)['"]/);
      if (jsMatch) return jsMatch[1];
      const windowLoc = html.match(/window\.location\.href\s*=\s*["']([^"']+)["']/);
      if (windowLoc) return windowLoc[1];
    }
    return baiduUrl;
  }
}

// ========== 内容过滤 ==========
function isValidResult(item) {
  const title = item.title || "";
  const url = item.link || "";
  const lowerTitle = title.toLowerCase();
  const lowerUrl = url.toLowerCase();

  // 标题太短
  if (title.length < 10) return false;

  // 过滤百度百科系列
  const baiduTrash = [
    "baike.baidu", "zhidao.baidu", "wenku.baidu", "jingyan.baidu",
    "tieba.baidu", "v.baidu", "haokan.baidu", "map.baidu",
  ];
  if (baiduTrash.some((d) => lowerUrl.includes(d))) return false;
  if (title.includes("百度百科") || title.includes("百度知道") || title.includes("百度文库") || title.includes("百度经验")) return false;

  // 过滤论坛/社区/博客/短视频
  const forumDomains = [
    "bbs.", "forum.", "club.", "zhihu.com/question", "jianshu.com",
    "csdn.net", "blog.csdn", "cnblogs.com", "weibo.com", "douyin.com",
    "bilibili.com", "xiaohongshu.com", "kuaishou.com",
  ];
  if (forumDomains.some((d) => lowerUrl.includes(d))) return false;

  // 过滤低质量门户文章
  const lowQualityDomains = [
    "sohu.com/a", "163.com/dy", "sina.com.cn", "ifeng.com",
  ];
  if (lowQualityDomains.some((d) => lowerUrl.includes(d))) {
    // 这些域名如果是企业官方发布可以保留，这里简单过滤
  }

  // 过滤假期/放假/节日信息
  const holidayKeywords = ["放假", "假期", "调休", "节假日", "年假", "五一", "国庆", "春节放假"];
  if (holidayKeywords.some((k) => lowerTitle.includes(k))) return false;

  // 过滤官网/首页/欢迎页
  const officialPatterns = ["官网", "首页", "欢迎您", "welcome", "官方网站", "进入官网", "官网入口", "主页"];
  if (officialPatterns.some((k) => lowerTitle.includes(k))) return false;

  // 过滤广告/招聘/电商/推广
  const adKeywords = [
    "招聘", "诚聘", "薪资", "加盟", "代理", "厂家", "批发", "价格", "多少钱",
    "怎么样", "好不好", "推荐", "排行榜", "十大", "电话", "地址",
    "官方旗舰店", "优惠券", "秒杀", "限时", "免费领", "点击领取",
    "诚招", "急聘", "高薪", "待遇", "五险一金", "双休",
    "广告", "推广", "培训", "课程", "试听", "报名", "名额有限",
    "优惠券", "折扣", "特价", "抢购", "买一送一",
  ];
  if (adKeywords.some((k) => lowerTitle.includes(k))) return false;

  // 过滤视频/图片/下载站
  const mediaDomains = [
    "video.", "v.qq.com", "youku.com", "iqiyi.com", "mgtv.com",
    "pan.baidu.com", "xunlei.com", "down.", "download.",
    "pptv.com", "le.com", "bilibili.com/video",
  ];
  if (mediaDomains.some((d) => lowerUrl.includes(d))) return false;

  // 过滤纯数字标题
  if (/^\d+$/.test(title.replace(/\s/g, ""))) return false;

  // 过滤无意义符号过多的标题
  if ((title.match(/[【\[\|｜《]/g) || []).length >= 2) return false;

  // 过滤问答类标题
  const questionPatterns = [/^什么是/, /^怎么/, /^如何/, /^为什么/, /\?$/];
  if (questionPatterns.some((p) => p.test(title))) return false;

  return true;
}

// ========== 质量评分 ==========
function scoreNews(item) {
  let score = 0;
  const title = item.title || "";
  const url = item.link || "";

  // 标题长度适中
  if (title.length >= 15 && title.length <= 45) score += 2;

  // 包含新闻特征词
  const newsWords = ["发布", "出台", "推进", "加快", "深化", "试点", "落地", "启动", "签约", "中标", "招标", "规划", "方案", "政策", "通知", "意见", "报告", "分析", "观察", "动态", "获批", "通过", "建成", "开工", "揭牌", "启动", "合作", "战略", "中标", "中标", "签约"];
  if (newsWords.some((w) => title.includes(w))) score += 3;

  // 来源是权威媒体或政府网站
  const trustedDomains = [
    "gov.cn", "mohurd.gov", "ndrc.gov", "people.com.cn", "xinhuanet",
    "thepaper.cn", "caixin.com", "yicai.com", "eeo.com.cn", "21jingji",
  ];
  if (trustedDomains.some((d) => url.includes(d))) score += 4;

  // 企业名称 = 企业动态，加分
  const entNames = ENTERPRISES.map((e) => e.name);
  if (entNames.some((name) => title.includes(name))) score += 2;

  // 有真实来源加分
  if (item.source && item.source !== "百度搜索" && item.source.length > 0) score += 1;

  return score;
}

// ========== 日期过滤 ==========
function filterByDate(items, days = 3) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return items.filter((item) => {
    if (!item.pubDate) return true; // 没有日期的保留，由其他逻辑处理
    const d = new Date(item.pubDate);
    return d >= cutoff;
  });
}

// ========== 百度搜索 ==========
async function searchBaidu(keyword, days = 3) {
  try {
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

      // 提取来源和日期信息
      const infoEl = $(el).find(".g, .c-color-gray2").first();
      const infoText = infoEl.text().trim();

      // 尝试提取来源
      let source = extractSourceFromText(infoText);
      if (!source && link) {
        source = extractSourceFromUrl(link);
      }

      // 提取日期
      const pubDate = parseDateFromBaidu(infoText);

      if (title && link) {
        results.push({
          title,
          link: link.startsWith("http") ? link : `https://www.baidu.com${link}`,
          abstract: abstract || "",
          source: source || "",
          pubDate,
        });
      }
    });

    const resolved = await Promise.all(
      results.map(async (r) => {
        const realUrl = await resolveBaiduLink(r.link);
        const realSource = extractSourceFromUrl(realUrl);
        return { ...r, link: realUrl, source: realSource || r.source };
      })
    );

    return resolved.filter(isValidResult).slice(0, 6);
  } catch (err) {
    console.error("百度搜索失败:", err.message);
    return [];
  }
}

// ========== 搜狗搜索 ==========
async function searchSogou(keyword, days = 3) {
  try {
    const tsn = days <= 1 ? 1 : days <= 7 ? 2 : 3;
    const url = `https://www.sogou.com/web?query=${encodeURIComponent(keyword)}&tsn=${tsn}`;
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      timeout: 10000,
    });
    const $ = cheerio.load(res.data);
    const results = [];
    $(".vrwrap, .rb").each((_, el) => {
      const titleEl = $(el).find("h3 a").first();
      const title = titleEl.text().trim();
      const link = titleEl.attr("href");
      const abstract = $(el).find(".str-text, .rb-text").text().trim();
      if (title && link) {
        results.push({ title, link, abstract: abstract || "", source: "", pubDate: "" });
      }
    });
    return results.slice(0, 6);
  } catch (err) {
    console.error("搜狗搜索失败:", err.message);
    return [];
  }
}

// ========== Bing 搜索 ==========
async function searchBing(keyword, days = 3) {
  try {
    const filters = days <= 1 ? "ex1%3a%22ez1%22" : "ex1%3a%22ez5%22";
    const url = `https://cn.bing.com/search?q=${encodeURIComponent(keyword)}&filters=${filters}&count=10`;
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      timeout: 10000,
    });
    const $ = cheerio.load(res.data);
    const results = [];
    $(".b_algo").each((_, el) => {
      const titleEl = $(el).find("h2 a").first();
      const title = titleEl.text().trim();
      const link = titleEl.attr("href");
      const abstract = $(el).find(".b_caption p").text().trim();
      if (title && link) {
        results.push({ title, link, abstract: abstract || "", source: "", pubDate: "" });
      }
    });
    return results.filter(isValidResult).slice(0, 6);
  } catch (err) {
    console.error("Bing搜索失败:", err.message);
    return [];
  }
}

// ========== 多引擎聚合搜索 ==========
async function searchAllEngines(keyword, days = 3) {
  const [baidu, sogou, bing] = await Promise.all([
    searchBaidu(keyword, days).catch((e) => { console.error("百度失败:", e.message); return []; }),
    searchSogou(keyword, days).catch((e) => { console.error("搜狗失败:", e.message); return []; }),
    searchBing(keyword, days).catch((e) => { console.error("Bing失败:", e.message); return []; }),
  ]);
  const all = [...baidu, ...sogou, ...bing];
  const seen = new Set();
  return all.filter((item) => {
    const key = item.title.slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

// ========== 行业日报搜索 ==========
async function searchPolicyNews(days = 3) {
  const all = [];
  for (const kw of POLICY_KEYWORDS) {
    const results = await searchAllEngines(kw, days);
    all.push(...results);
  }
  return all;
}

async function searchIndustryNews(days = 3) {
  const all = [];
  for (const kw of INDUSTRY_KEYWORDS) {
    const results = await searchAllEngines(kw, days);
    all.push(...results);
  }
  return all;
}

async function searchEnterpriseNews(days = 3) {
  const all = [];
  for (const ent of ENTERPRISES) {
    for (const kw of ent.keywords) {
      const results = await searchAllEngines(kw, days);
      all.push(...results.map((r) => ({ ...r, enterprise: ent.name })));
    }
  }
  return all;
}

// ========== 城市更新日报搜索 ==========
async function searchCityPolicyNews(days = 3) {
  const all = [];
  for (const kw of CITY_POLICY_KEYWORDS) {
    const results = await searchAllEngines(kw, days);
    all.push(...results);
  }
  return all;
}

async function searchCityLocalNews(days = 3) {
  const all = [];
  for (const kw of CITY_LOCAL_KEYWORDS) {
    const results = await searchAllEngines(kw, days);
    all.push(...results);
  }
  return all;
}

async function searchCityPracticeNews(days = 3) {
  const all = [];
  for (const kw of CITY_PRACTICE_KEYWORDS) {
    const results = await searchAllEngines(kw, days);
    all.push(...results);
  }
  return all;
}

async function searchCityDigitalNews(days = 3) {
  const all = [];
  for (const kw of CITY_DIGITAL_KEYWORDS) {
    const results = await searchAllEngines(kw, days);
    all.push(...results);
  }
  return all;
}

// ========== 去重 ==========
function deduplicate(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.title.slice(0, 30);
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

// ========== 行业日报分类 ==========
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

// ========== 城市更新日报分类 ==========
function categorizeCityDaily(item) {
  const text = `${item.title} ${item.abstract}`.toLowerCase();

  // 中央政策
  if (text.includes("国务院") || text.includes("住建部") || text.includes("发改委") || text.includes("中央") || text.includes("自然资源部")) {
    if (text.includes("政策") || text.includes("通知") || text.includes("意见") || text.includes("规划") || text.includes("条例")) {
      return "中央政策";
    }
  }

  // 地方政策
  if (text.includes("省") || text.includes("市") || text.includes("区") || text.includes("印发") || text.includes("出台") || text.includes("发布")) {
    if (text.includes("政策") || text.includes("通知") || text.includes("意见") || text.includes("规划") || text.includes("方案")) {
      return "地方政策";
    }
  }

  // 地方实践案例
  if (text.includes("案例") || text.includes("成效") || text.includes("建成") || text.includes("开工") || text.includes("改造完成") || text.includes("亮相") || text.includes("启用")) {
    return "地方实践案例";
  }

  // 城市更新数字化
  if (text.includes("数字化") || text.includes("智慧") || text.includes("平台") || text.includes("系统") || text.includes("cim") || text.includes("数字孪生") || text.includes("大数据")) {
    return "城市更新数字化";
  }

  return "行业观点";
}

// ========== 格式化摘要 ==========
function formatAbstract(item) {
  if (item.abstract && item.abstract.trim().length > 0) {
    const abs = item.abstract.trim();
    return abs.slice(0, 60) + (abs.length > 60 ? "..." : "");
  }
  const title = item.title || "";
  return title.slice(0, 40) + (title.length > 40 ? "..." : "");
}

// ========== 生成行业日报 ==========
async function generateDailyReport(query, days = 3) {
  let [policyNews, industryNews, enterpriseNews] = await Promise.all([
    searchPolicyNews(days),
    searchIndustryNews(days),
    searchEnterpriseNews(days),
  ]);

  // 如果用户输入了关键词，额外搜索一次
  if (query && query.trim()) {
    const extra = await searchAllEngines(query.trim(), days);
    industryNews.push(...extra);
  }

  let all = [...policyNews, ...industryNews, ...enterpriseNews];

  // 按日期过滤
  all = filterByDate(all, days);

  // 去重 + 排序 + 限制10-15条
  all = deduplicate(all);
  all = sortByQuality(all);
  all = all.slice(0, 12);

  all.forEach((item) => {
    item.category = categorizeDaily(item);
    item.abstract = formatAbstract(item);
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
      source: r.source || "",
      pubDate: r.pubDate,
      category: r.category,
      enterprise: r.enterprise || null,
    })),
    date: new Date().toISOString().split("T")[0],
  };
}

// ========== 生成城市更新日报 ==========
async function generateCityDailyReport(query, days = 3) {
  let [policyNews, localNews, practiceNews, digitalNews] = await Promise.all([
    searchCityPolicyNews(days),
    searchCityLocalNews(days),
    searchCityPracticeNews(days),
    searchCityDigitalNews(days),
  ]);

  // 如果用户输入了关键词，额外搜索一次
  if (query && query.trim()) {
    const extra = await searchAllEngines(query.trim(), days);
    localNews.push(...extra);
  }

  let all = [...policyNews, ...localNews, ...practiceNews, ...digitalNews];

  // 按日期过滤
  all = filterByDate(all, days);

  // 去重 + 排序 + 限制10-15条
  all = deduplicate(all);
  all = sortByQuality(all);
  all = all.slice(0, 12);

  all.forEach((item) => {
    item.category = categorizeCityDaily(item);
    item.abstract = formatAbstract(item);
  });

  const categories = {
    "中央政策": [],
    "地方政策": [],
    "地方实践案例": [],
    "城市更新数字化": [],
    "行业观点": [],
  };

  all.forEach((item) => {
    if (categories[item.category]) {
      categories[item.category].push(item);
    } else {
      categories["行业观点"].push(item);
    }
  });

  return {
    total: all.length,
    categories,
    results: all.map((r) => ({
      title: r.title,
      url: r.link,
      abstract: r.abstract,
      source: r.source || "",
      pubDate: r.pubDate,
      category: r.category,
    })),
    date: new Date().toISOString().split("T")[0],
  };
}

module.exports = { generateDailyReport, generateCityDailyReport, ENTERPRISES };
