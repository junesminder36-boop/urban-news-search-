const axios = require("axios");
const cheerio = require("cheerio");
const { fetchRSSFeeds } = require("./rssFeeds");
const { crawlTargetedSites } = require("./targetedCrawler");

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

    const resolved = await Promise.all(
      results.map(async (r) => {
        const realUrl = await resolveBaiduLink(r.link);
        const realSource = extractSourceFromUrl(realUrl);
        return { ...r, link: realUrl, source: realSource || r.source };
      })
    );

    return resolved.filter(isValidResult).slice(0, 8);
  } catch (err) {
    console.error("百度新闻搜索失败:", err.message);
    return [];
  }
}

async function searchSogouNews(keyword) {
  try {
    const url = `https://www.sogou.com/web?query=${encodeURIComponent(keyword + " 新闻")}&tsn=2`;
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
    return results.filter(isValidResult).slice(0, 8);
  } catch (err) {
    console.error("搜狗新闻搜索失败:", err.message);
    return [];
  }
}

async function searchBingNews(keyword) {
  try {
    const url = `https://cn.bing.com/search?q=${encodeURIComponent(keyword + " 新闻")}&filters=ex1%3a%22ez5%22&count=10`;
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
    return results.filter(isValidResult).slice(0, 8);
  } catch (err) {
    console.error("Bing新闻搜索失败:", err.message);
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

  const [rssResults, targetedResults, baiduResults, sogouResults, bingResults] = await Promise.all([
    fetchRSSFeeds(keyword).catch((e) => { console.error("RSS失败:", e.message); return []; }),
    crawlTargetedSites(keyword).catch((e) => { console.error("定向爬取失败:", e.message); return []; }),
    searchBaiduNews(keyword).catch((e) => { console.error("百度新闻失败:", e.message); return []; }),
    searchSogouNews(keyword).catch((e) => { console.error("搜狗新闻失败:", e.message); return []; }),
    searchBingNews(keyword).catch((e) => { console.error("Bing新闻失败:", e.message); return []; }),
  ]);

  // 合并所有来源
  const all = [...rssResults, ...targetedResults, ...baiduResults, ...sogouResults, ...bingResults];

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
