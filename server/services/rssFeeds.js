const Parser = require("rss-parser");
const parser = new Parser();

// 城市更新相关 RSS 源（按优先级排序）
const RSS_SOURCES = [
  {
    name: "中国政府网",
    url: "http://www.gov.cn/pushinfo/v150203/pushinfo.xml",
    category: "中央政策",
  },
  {
    name: "新华网时政",
    url: "http://www.news.cn/rss/politics.xml",
    category: "中央政策",
  },
  {
    name: "住建部",
    url: "https://www.mohurd.gov.cn/wjfb/index.html",
    category: "中央政策",
    isHTML: true,
  },
  {
    name: "澎湃新闻",
    url: "https://www.thepaper.cn/rssFeed_chosen.jsp",
    category: "行业观点",
  },
  {
    name: "财新网",
    url: "http://china.caixin.com/rss.xml",
    category: "行业观点",
  },
  {
    name: "第一财经",
    url: "https://www.yicai.com.cn/rss.xml",
    category: "行业观点",
  },
  {
    name: "新浪财经",
    url: "https://rss.sina.com.cn/news/china/focus15.xml",
    category: "行业观点",
  },
  {
    name: "21世纪经济报道",
    url: "https://m.21jingji.com/rss.php",
    category: "行业观点",
  },
  {
    name: "经济观察网",
    url: "https://www.eeo.com.cn/rss/eeo.xml",
    category: "行业观点",
  },
];

const axios = require("axios");
const cheerio = require("cheerio");

async function fetchRSSFeeds(query) {
  const allItems = [];
  const queryLower = query.toLowerCase();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  for (const source of RSS_SOURCES) {
    try {
      let items = [];

      if (source.isHTML) {
        // 对没有 RSS 的政府网站，直接爬取列表页
        items = await crawlHTMLList(source);
      } else {
        const feed = await parser.parseURL(source.url);
        items = feed.items.map((item) => ({
          title: item.title,
          link: item.link,
          abstract: item.contentSnippet || item.content || "",
          source: source.name,
          pubDate: item.pubDate || item.isoDate,
          category: source.category,
        }));
      }

      // 过滤关键词和时间
      const filtered = items.filter((item) => {
        const text = `${item.title} ${item.abstract}`.toLowerCase();
        const isMatch = text.includes(queryLower) ||
          ["城市更新", "旧改", "城中村", "棚改", "老旧小区", "城市改造", "有机更新", "微更新"].some((k) => text.includes(k));

        // 时间过滤（近7天）
        const itemDate = item.pubDate ? new Date(item.pubDate) : new Date();
        const isRecent = itemDate >= sevenDaysAgo;

        return isMatch && isRecent;
      });

      allItems.push(...filtered);
    } catch (err) {
      console.error(`RSS 获取失败 ${source.name}:`, err.message);
    }
  }

  return allItems
    .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
    .slice(0, 20);
}

async function crawlHTMLList(source) {
  try {
    const res = await axios.get(source.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      timeout: 10000,
    });
    const $ = cheerio.load(res.data);
    const items = [];

    // 政府网站常见列表结构
    $(".listBox li, .tableList tr, .news_list li, .zwgk_list li, .news li").each((_, el) => {
      const a = $(el).find("a").first();
      const title = a.text().trim();
      const link = a.attr("href");
      const date = $(el).find("span, .date, .time, td:last-child").first().text().trim();

      if (title && link) {
        items.push({
          title,
          link: link.startsWith("http") ? link : new URL(link, source.url).href,
          abstract: "",
          source: source.name,
          pubDate: parseDate(date),
          category: source.category,
        });
      }
    });

    return items.slice(0, 10);
  } catch (err) {
    console.error(`HTML 爬取失败 ${source.name}:`, err.message);
    return [];
  }
}

function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  // 尝试解析常见中文日期格式
  const match = dateStr.match(/(\d{4})[-年/](\d{1,2})[-月/](\d{1,2})/);
  if (match) {
    return new Date(`${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`).toISOString();
  }
  return new Date().toISOString();
}

module.exports = { fetchRSSFeeds };
