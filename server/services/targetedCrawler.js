const axios = require("axios");
const cheerio = require("cheerio");

// 各地政府网站爬虫配置
const TARGET_SITES = [
  {
    name: "深圳市规划和自然资源局",
    url: "https://pnrs.sz.gov.cn/",
    listPath: "/zwgk/zcwj/zcjd/content/post_",
    extract: async () => {
      try {
        const res = await axios.get("https://pnrs.sz.gov.cn/zwgk/zcwj/zcjd/", {
          headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000,
        });
        const $ = cheerio.load(res.data);
        const items = [];
        $(".news_list li, .zwgk_list li, .list li").each((_, el) => {
          const a = $(el).find("a").first();
          const title = a.text().trim();
          const link = a.attr("href");
          const date = $(el).find("span").first().text().trim();
          if (title && link) {
            items.push({ title, link: link.startsWith("http") ? link : `https://pnrs.sz.gov.cn${link}`, abstract: "", source: "深圳市规划和自然资源局", pubDate: parseGovDate(date), category: "地方政策" });
          }
        });
        return items.slice(0, 8);
      } catch (e) { console.error("深圳规自局失败:", e.message); return []; }
    },
  },
  {
    name: "广州市规划和自然资源局",
    url: "https://ghzyj.gz.gov.cn/",
    extract: async () => {
      try {
        const res = await axios.get("https://ghzyj.gz.gov.cn/zwgk/zcwj/zcjd/", {
          headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000,
        });
        const $ = cheerio.load(res.data);
        const items = [];
        $(".news_list li, .zwgk_list li").each((_, el) => {
          const a = $(el).find("a").first();
          const title = a.text().trim();
          const link = a.attr("href");
          const date = $(el).find("span").first().text().trim();
          if (title && link) {
            items.push({ title, link: link.startsWith("http") ? link : `https://ghzyj.gz.gov.cn${link}`, abstract: "", source: "广州市规划和自然资源局", pubDate: parseGovDate(date), category: "地方政策" });
          }
        });
        return items.slice(0, 8);
      } catch (e) { console.error("广州规自局失败:", e.message); return []; }
    },
  },
  {
    name: "上海市规划和自然资源局",
    url: "https://ghzyj.sh.gov.cn/",
    extract: async () => {
      try {
        const res = await axios.get("https://ghzyj.sh.gov.cn/", {
          headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000,
        });
        const $ = cheerio.load(res.data);
        const items = [];
        $(".news_list li, .zwgk_list li, .list li").each((_, el) => {
          const a = $(el).find("a").first();
          const title = a.text().trim();
          const link = a.attr("href");
          const date = $(el).find("span").first().text().trim();
          if (title && link) {
            items.push({ title, link: link.startsWith("http") ? link : `https://ghzyj.sh.gov.cn${link}`, abstract: "", source: "上海市规划和自然资源局", pubDate: parseGovDate(date), category: "地方政策" });
          }
        });
        return items.slice(0, 8);
      } catch (e) { console.error("上海规自局失败:", e.message); return []; }
    },
  },
  {
    name: "北京市规划和自然资源委员会",
    url: "https://ghzzzyw.beijing.gov.cn/",
    extract: async () => {
      try {
        const res = await axios.get("https://ghzzzyw.beijing.gov.cn/", {
          headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000,
        });
        const $ = cheerio.load(res.data);
        const items = [];
        $(".news_list li, .zwgk_list li").each((_, el) => {
          const a = $(el).find("a").first();
          const title = a.text().trim();
          const link = a.attr("href");
          const date = $(el).find("span").first().text().trim();
          if (title && link) {
            items.push({ title, link: link.startsWith("http") ? link : `https://ghzzzyw.beijing.gov.cn${link}`, abstract: "", source: "北京市规划和自然资源委员会", pubDate: parseGovDate(date), category: "地方政策" });
          }
        });
        return items.slice(0, 8);
      } catch (e) { console.error("北京规自委失败:", e.message); return []; }
    },
  },
  {
    name: "杭州市规划和自然资源局",
    url: "https://ghzy.hangzhou.gov.cn/",
    extract: async () => {
      try {
        const res = await axios.get("https://ghzy.hangzhou.gov.cn/col/col1228926380/index.html", {
          headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000,
        });
        const $ = cheerio.load(res.data);
        const items = [];
        $(".news_list li, .zwgk_list li").each((_, el) => {
          const a = $(el).find("a").first();
          const title = a.text().trim();
          const link = a.attr("href");
          const date = $(el).find("span").first().text().trim();
          if (title && link) {
            items.push({ title, link: link.startsWith("http") ? link : `https://ghzy.hangzhou.gov.cn${link}`, abstract: "", source: "杭州市规划和自然资源局", pubDate: parseGovDate(date), category: "地方政策" });
          }
        });
        return items.slice(0, 8);
      } catch (e) { console.error("杭州规自局失败:", e.message); return []; }
    },
  },
  {
    name: "成都市规划和自然资源局",
    url: "https://mpnr.chengdu.gov.cn/",
    extract: async () => {
      try {
        const res = await axios.get("https://mpnr.chengdu.gov.cn/", {
          headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000,
        });
        const $ = cheerio.load(res.data);
        const items = [];
        $(".news_list li, .zwgk_list li").each((_, el) => {
          const a = $(el).find("a").first();
          const title = a.text().trim();
          const link = a.attr("href");
          const date = $(el).find("span").first().text().trim();
          if (title && link) {
            items.push({ title, link: link.startsWith("http") ? link : `https://mpnr.chengdu.gov.cn${link}`, abstract: "", source: "成都市规划和自然资源局", pubDate: parseGovDate(date), category: "地方政策" });
          }
        });
        return items.slice(0, 8);
      } catch (e) { console.error("成都规自局失败:", e.message); return []; }
    },
  },
  {
    name: "武汉市自然资源和规划局",
    url: "https://gh.wuhan.gov.cn/",
    extract: async () => {
      try {
        const res = await axios.get("https://gh.wuhan.gov.cn/", {
          headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000,
        });
        const $ = cheerio.load(res.data);
        const items = [];
        $(".news_list li, .zwgk_list li").each((_, el) => {
          const a = $(el).find("a").first();
          const title = a.text().trim();
          const link = a.attr("href");
          const date = $(el).find("span").first().text().trim();
          if (title && link) {
            items.push({ title, link: link.startsWith("http") ? link : `https://gh.wuhan.gov.cn${link}`, abstract: "", source: "武汉市自然资源和规划局", pubDate: parseGovDate(date), category: "地方政策" });
          }
        });
        return items.slice(0, 8);
      } catch (e) { console.error("武汉规自局失败:", e.message); return []; }
    },
  },
  {
    name: "住建部",
    url: "https://www.mohurd.gov.cn/",
    extract: async () => {
      try {
        const res = await axios.get("https://www.mohurd.gov.cn/wjfb/", {
          headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000,
        });
        const $ = cheerio.load(res.data);
        const items = [];
        $(".news_list li, .zwgk_list li, .tableList tr").each((_, el) => {
          const a = $(el).find("a").first();
          const title = a.text().trim();
          const link = a.attr("href");
          const date = $(el).find("span, .date").first().text().trim();
          if (title && link) {
            items.push({ title, link: link.startsWith("http") ? link : `https://www.mohurd.gov.cn${link}`, abstract: "", source: "住建部", pubDate: parseGovDate(date), category: "中央政策" });
          }
        });
        return items.slice(0, 10);
      } catch (e) { console.error("住建部失败:", e.message); return []; }
    },
  },
];

function parseGovDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  const match = dateStr.match(/(\d{4})[-年/](\d{1,2})[-月/](\d{1,2})/);
  if (match) {
    return new Date(`${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`).toISOString();
  }
  return new Date().toISOString();
}

async function crawlTargetedSites(query) {
  const allItems = [];
  const queryLower = query.toLowerCase();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  for (const site of TARGET_SITES) {
    try {
      const items = await site.extract();
      const filtered = items.filter((item) => {
        const text = `${item.title} ${item.abstract}`.toLowerCase();
        const isMatch = text.includes(queryLower) ||
          ["城市更新", "旧改", "城中村", "棚改", "老旧小区", "城市改造", "有机更新", "微更新"].some((k) => text.includes(k));
        const itemDate = item.pubDate ? new Date(item.pubDate) : new Date();
        return isMatch && itemDate >= sevenDaysAgo;
      });
      allItems.push(...filtered);
    } catch (err) {
      console.error(`定向爬取失败 ${site.name}:`, err.message);
    }
  }

  return allItems;
}

module.exports = { crawlTargetedSites };
