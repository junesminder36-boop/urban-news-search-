const axios = require("axios");
const cheerio = require("cheerio");

async function fetchPageContent(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(res.data);

    // 移除脚本、样式、导航等无关内容
    $("script, style, nav, header, footer, aside, iframe, noscript").remove();

    // 提取标题
    const title = $("h1").first().text().trim() || $("title").text().trim();

    // 提取正文（优先 article、main、.content、#content 等）
    let content = "";
    const contentSelectors = [
      "article",
      "main",
      ".content",
      "#content",
      ".post-content",
      ".entry-content",
      ".article-content",
      ".detail-content",
    ];

    for (const selector of contentSelectors) {
      const text = $(selector).text().trim();
      if (text.length > content.length) {
        content = text;
      }
    }

    // 如果没找到，取 body 文本
    if (content.length === 0) {
      content = $("body").text().trim();
    }

    // 清理空白
    content = content.replace(/\s+/g, " ").slice(0, 3000);

    return { title, content, url };
  } catch (err) {
    console.error(`爬取失败 ${url}:`, err.message);
    return { title: "", content: "", url };
  }
}

async function batchFetch(urls) {
  const results = [];
  for (const url of urls) {
    const data = await fetchPageContent(url);
    if (data.content.length > 50) {
      results.push(data);
    }
  }
  return results;
}

module.exports = { fetchPageContent, batchFetch };
