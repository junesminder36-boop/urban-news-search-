const axios = require("axios");
const cheerio = require("cheerio");

function isValidResult(item) {
  const title = item.title || "";
  const url = item.link || "";
  const lowerTitle = title.toLowerCase();
  const lowerUrl = url.toLowerCase();

  if (title.length < 10) return false;

  const baiduTrash = [
    "baike.baidu", "zhidao.baidu", "wenku.baidu", "jingyan.baidu",
    "tieba.baidu", "v.baidu", "haokan.baidu", "map.baidu",
  ];
  if (baiduTrash.some((d) => lowerUrl.includes(d))) return false;
  if (/百度(百科|知道|文库|经验)/.test(title)) return false;

  const forumDomains = [
    "bbs.", "forum.", "club.", "zhihu.com/question", "jianshu.com",
    "csdn.net", "blog.csdn", "cnblogs.com", "weibo.com", "douyin.com",
    "bilibili.com", "xiaohongshu.com", "kuaishou.com",
  ];
  if (forumDomains.some((d) => lowerUrl.includes(d))) return false;

  const officialPatterns = ["官网", "首页", "欢迎您", "welcome", "官方网站", "进入官网", "官网入口", "主页"];
  if (officialPatterns.some((k) => lowerTitle.includes(k))) return false;

  const adKeywords = [
    "招聘", "诚聘", "薪资", "加盟", "代理", "厂家", "批发", "价格", "多少钱",
    "怎么样", "好不好", "推荐", "排行榜", "十大", "电话", "地址",
    "官方旗舰店", "优惠券", "秒杀", "限时", "免费领", "点击领取",
    "诚招", "急聘", "高薪", "待遇", "五险一金", "双休",
    "广告", "推广", "培训", "课程", "试听", "报名", "名额有限",
  ];
  if (adKeywords.some((k) => lowerTitle.includes(k))) return false;

  const mediaDomains = [
    "video.", "v.qq.com", "youku.com", "iqiyi.com", "mgtv.com",
    "pan.baidu.com", "xunlei.com", "down.", "download.",
  ];
  if (mediaDomains.some((d) => lowerUrl.includes(d))) return false;

  const holidayKeywords = ["放假", "假期", "调休", "节假日", "年假", "五一", "国庆", "春节放假"];
  if (holidayKeywords.some((k) => lowerTitle.includes(k))) return false;

  if (/^\d+$/.test(title.replace(/\s/g, ""))) return false;

  const questionPatterns = [/^什么是/, /^怎么/, /^如何/, /^为什么/, /\?$/];
  if (questionPatterns.some((p) => p.test(title))) return false;

  return true;
}

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
    return res.request?.res?.responseUrl || res.config?.url || baiduUrl;
  } catch (err) {
    if (err.response) {
      const loc = err.response.headers && err.response.headers.location;
      if (loc) return loc;
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

function extractSourceFromUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// 竞品公司列表
const COMPETITORS = [
  { name: "明源云", keywords: ["明源云", "明源云 产品", "明源云 合作", "明源云 中标"] },
  { name: "四格互联", keywords: ["四格互联", "四格互联 智慧物业", "四格互联 中标"] },
  { name: "一碑科技", keywords: ["一碑科技", "一碑科技 物业", "一碑科技 产品"] },
  { name: "极致科技", keywords: ["极致科技", "极致科技 物业", "极致科技 智慧社区"] },
  { name: "金蝶我家云", keywords: ["金蝶我家云", "我家云 物业", "金蝶 物业云"] },
  { name: "有赞", keywords: ["有赞 地产", "有赞 物业", "有赞 零售地产"] },
  { name: "微盟", keywords: ["微盟 地产", "微盟 物业", "微盟 智慧商业"] },
  { name: "万物云", keywords: ["万物云", "万物云 科技", "万物云 上市", "万物云 合作"] },
  { name: "高新兴", keywords: ["高新兴 智慧", "高新兴 物业", "高新兴 物联网"] },
  { name: "海康威视", keywords: ["海康威视 智慧园区", "海康威视 物业", "海康威视 AI"] },
  { name: "华为", keywords: ["华为 智慧城市", "华为 智慧园区", "华为 物业数字化"] },
  { name: "物联云仓", keywords: ["物联云仓", "物联云仓 仓储", "物联云仓 数字化"] },
  { name: "用友政务", keywords: ["用友政务", "用友 智慧城市", "用友 物业"] },
  { name: "天翼智慧家庭", keywords: ["天翼智慧家庭", "天翼 智慧社区", "天翼 物业"] },
];

// 动态分类关键词
const CATEGORY_KEYWORDS = {
  "产品发布": ["发布", "推出", "上线", "新品", "新版本", "升级", "迭代"],
  "重大合同": ["中标", "签约", "合同", "订单", "采购", "拿下", "中标公示"],
  "战略合作": ["合作", "战略", "联盟", "携手", "共建", "联手", "伙伴关系"],
  "融资": ["融资", "投资", "领投", "跟投", "A轮", "B轮", "C轮", "Pre-IPO", "天使轮", "种子轮", "亿元", "千万"],
  "上市": ["上市", "挂牌", "IPO", "招股书", "招股书", "港交所", "科创板", "创业板"],
  "高管变动": ["任命", "离职", "跳槽", "人事", "副总裁", "总经理", "CEO", "董事长", " CTO", "首席", "加盟"],
  "招标动态": ["招标", "投标", "采购", "询价", "竞标", "邀标", "比选"],
};

function getCategory(title) {
  const lower = title.toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) return cat;
  }
  return "企业动态";
}

async function searchBaidu(keyword, days = 7) {
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
      const dateText = $(el).find(".g, .c-color-gray2").first().text().trim();

      if (title && link && title.length >= 10) {
        results.push({
          title,
          link: link.startsWith("http") ? link : `https://www.baidu.com${link}`,
          abstract: abstract || "",
          source: "百度搜索",
          pubDate: parseDate(dateText),
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

    return resolved.filter(isValidResult).slice(0, 5);
  } catch (err) {
    console.error("百度搜索失败:", err.message);
    return [];
  }
}

async function searchSogou(keyword, days = 7) {
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
        results.push({ title, link, abstract: abstract || "", source: "", pubDate: new Date().toISOString() });
      }
    });
    return results.filter(isValidResult).slice(0, 5);
  } catch (err) {
    console.error("搜狗搜索失败:", err.message);
    return [];
  }
}

async function searchBing(keyword, days = 7) {
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
        results.push({ title, link, abstract: abstract || "", source: "", pubDate: new Date().toISOString() });
      }
    });
    return results.filter(isValidResult).slice(0, 5);
  } catch (err) {
    console.error("Bing搜索失败:", err.message);
    return [];
  }
}

async function searchAllEngines(keyword, days = 7) {
  const [baidu, sogou, bing] = await Promise.all([
    searchBaidu(keyword, days).catch(() => []),
    searchSogou(keyword, days).catch(() => []),
    searchBing(keyword, days).catch(() => []),
  ]);
  const all = [...baidu, ...sogou, ...bing];
  const seen = new Set();
  return all.filter((item) => {
    const key = item.title.slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function parseDate(dateText) {
  if (!dateText) return new Date().toISOString();

  const fullDateMatch = dateText.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (fullDateMatch) {
    return new Date(`${fullDateMatch[1]}-${fullDateMatch[2].padStart(2, "0")}-${fullDateMatch[3].padStart(2, "0")}`).toISOString();
  }

  const shortDateMatch = dateText.match(/(\d{1,2})-(\d{1,2})/);
  if (shortDateMatch) {
    const year = new Date().getFullYear();
    return new Date(`${year}-${shortDateMatch[1].padStart(2, "0")}-${shortDateMatch[2].padStart(2, "0")}`).toISOString();
  }

  const daysAgoMatch = dateText.match(/(\d+)\s*天前/);
  if (daysAgoMatch) {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(daysAgoMatch[1]));
    return d.toISOString();
  }

  const hoursAgoMatch = dateText.match(/(\d+)\s*小时前/);
  if (hoursAgoMatch) {
    const d = new Date();
    d.setHours(d.getHours() - parseInt(hoursAgoMatch[1]));
    return d.toISOString();
  }

  return new Date().toISOString();
}

function filterByDate(items, days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return items.filter((item) => {
    const d = new Date(item.pubDate || Date.now());
    return d >= cutoff;
  });
}

function deduplicate(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.title.slice(0, 25);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchCompetitorNews(competitors, days = 7) {
  const all = [];
  for (const comp of competitors) {
    for (const kw of comp.keywords) {
      const results = await searchAllEngines(kw, days);
      for (const r of results) {
        all.push({ ...r, competitor: comp.name });
      }
    }
  }
  return deduplicate(all);
}

async function generateCompetitorReport(selectedCompetitors, days = 7) {
  const competitors = selectedCompetitors && selectedCompetitors.length > 0
    ? COMPETITORS.filter((c) => selectedCompetitors.includes(c.name))
    : COMPETITORS;

  let items = await searchCompetitorNews(competitors, days);
  items = filterByDate(items, days);
  items = deduplicate(items);

  items.forEach((item) => {
    item.category = getCategory(item.title);
    if (!item.abstract || item.abstract.length === 0) {
      item.abstract = item.title.slice(0, 30) + "...";
    } else {
      item.abstract = item.abstract.slice(0, 40) + (item.abstract.length > 40 ? "..." : "");
    }
  });

  // 按分类分组
  const categories = {};
  for (const item of items) {
    if (!categories[item.category]) categories[item.category] = [];
    categories[item.category].push(item);
  }

  // 按竞品分组
  const byCompetitor = {};
  for (const item of items) {
    if (!byCompetitor[item.competitor]) byCompetitor[item.competitor] = [];
    byCompetitor[item.competitor].push(item);
  }

  return {
    total: items.length,
    categories,
    byCompetitor,
    results: items.map((r) => ({
      title: r.title,
      url: r.link,
      abstract: r.abstract,
      source: r.source,
      pubDate: r.pubDate,
      category: r.category,
      competitor: r.competitor,
    })),
    date: new Date().toISOString().split("T")[0],
  };
}

module.exports = { generateCompetitorReport, COMPETITORS };
