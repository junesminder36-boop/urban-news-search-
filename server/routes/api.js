const express = require("express");
const router = express.Router();
const axios = require("axios");
const { searchAll } = require("../services/search");
const { batchFetch } = require("../services/crawler");
const { summarizeNews, summarizeArticles } = require("../services/aiSummary");
const { generateDailyReport, generateCityDailyReport, generateDailyMarkdown, generateCityDailyMarkdown } = require("../services/dailySearch");
const { generateCompetitorReport } = require("../services/competitorSearch");
const { generateInsights } = require("../services/dailyInsights");
const { ENTERPRISES } = require("../services/dailySearch");

const KIMI_API_URL = "https://api.moonshot.cn/v1/chat/completions";
const KIMI_API_KEY = process.env.KIMI_API_KEY || "";
const KIMI_MODEL = "moonshot-v1-8k";

const ROUTE_TIMEOUT = Number(process.env.ROUTE_TIMEOUT_MS || 55000);
const AI_TIMEOUT = Number(process.env.AI_TIMEOUT_MS || 18000);

async function withTimeout(promise, ms, label, fallback) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
      }),
    ]);
  } catch (err) {
    console.error(`${label} 超时/失败:`, err.message);
    if (fallback !== undefined) return fallback;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

router.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "urban-news-search",
    time: new Date().toISOString(),
  });
});

router.get("/search", async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: "请输入搜索关键词" });
  }

  try {
    const results = await withTimeout(searchAll(q.trim()), ROUTE_TIMEOUT, "搜索聚合", []);

    const normalizedResults = results.map((r) => {
      const abstract = generateAbstract(r);
      return {
        title: r.title,
        url: r.link,
        abstract: abstract,
        source: r.source,
        pubDate: r.pubDate,
        category: r.category || "行业观点",
      };
    });

    const categories = {
      "中央政策": [],
      "地方政策": [],
      "地方实践案例": [],
      "城市更新数字化": [],
      "行业观点": [],
    };

    normalizedResults.forEach((r) => {
      const cat = r.category;
      if (categories[cat]) {
        categories[cat].push(r);
      } else {
        categories["行业观点"].push(r);
      }
    });

    const urls = normalizedResults.slice(0, 8).map((r) => r.url).filter(Boolean);
    const articles = await withTimeout(batchFetch(urls), 18000, "正文抓取", []);
    const aiResult = articles.length > 0
      ? await withTimeout(summarizeNews(q.trim(), articles), AI_TIMEOUT, "AI搜索总结", {
          summary: "AI 总结暂不可用，已返回新闻列表。",
          highlights: [],
          raw: "",
        })
      : { summary: "暂无可用于 AI 总结的正文内容，已返回搜索结果列表。", highlights: [], raw: "" };

    res.json({
      query: q.trim(),
      total: normalizedResults.length,
      categories,
      results: normalizedResults,
      summary: aiResult.summary,
      highlights: aiResult.highlights,
      raw: aiResult.raw,
    });
  } catch (err) {
    console.error("搜索接口错误:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/daily", async (req, res) => {
  try {
    const { q } = req.query;
    const report = await withTimeout(generateDailyReport(q), ROUTE_TIMEOUT, "行业日报抓取", {
      total: 0,
      categories: { "政策法规速递": [], "行业要闻精选": [], "企业动态精选": [] },
      results: [],
      date: new Date().toISOString().slice(0, 10),
      sourceStatus: [{ name: "行业日报抓取", status: "timeout", count: 0, error: "整体抓取超时" }],
    });

    // AI 为每条新闻生成精炼摘要
    const aiAbstracts = report.results.length > 0
      ? await withTimeout(summarizeArticles(report.results), AI_TIMEOUT, "AI新闻摘要", report.results.map((r) => r.abstract || ""))
      : [];
    report.results.forEach((r, i) => {
      if (aiAbstracts[i]) {
        r.abstract = aiAbstracts[i];
      }
    });
    Object.values(report.categories).forEach((catItems) => {
      catItems.forEach((item) => {
        const idx = report.results.findIndex((r) => r.url === item.url);
        if (idx >= 0 && aiAbstracts[idx]) {
          item.abstract = aiAbstracts[idx];
        }
      });
    });

    const insights = report.results.length > 0
      ? await withTimeout(generateInsights(report.results, ENTERPRISES), AI_TIMEOUT, "AI洞察", {})
      : {};

    const dailyReport = generateDailyMarkdown(report.results, report.date);

    // 将 insights 映射为 summary/highlights，让 app.js 统一渲染
    const summaryText = insights.trend
      ? `【趋势研判】${insights.trend}`
      : (dailyReport ? "日报已生成，点击下方按钮查看完整版。" : "暂无 AI 分析结果。");
    const highlightsList = [
      insights.keywords ? `关键词：${insights.keywords}` : "",
      insights.marketing ? `营销建议：${insights.marketing}` : "",
      insights.tomorrow ? `明日关注：${insights.tomorrow}` : "",
    ].filter(Boolean);

    res.json({
      ...report,
      summary: summaryText,
      highlights: highlightsList.length > 0 ? highlightsList : [],
      insights,
      dailyReport,
    });
  } catch (err) {
    console.error("日报接口错误:", err);
    res.status(500).json({ error: err.message });
  }
});

function generateAbstract(item) {
  if (item.abstract && item.abstract.trim().length > 0) {
    return item.abstract.trim().slice(0, 20) + (item.abstract.trim().length > 20 ? "..." : "");
  }
  const title = item.title || "";
  if (title.length <= 20) return title;
  return title.slice(0, 20) + "...";
}

router.get("/city-daily", async (req, res) => {
  try {
    const { q } = req.query;
    const report = await withTimeout(generateCityDailyReport(q), ROUTE_TIMEOUT, "城市更新日报抓取", {
      total: 0,
      categories: { "中央政策": [], "地方政策": [], "地方实践案例": [], "城市更新数字化": [], "行业观点": [] },
      results: [],
      keywords: [],
      date: new Date().toISOString().slice(0, 10),
      sourceStatus: [{ name: "城市更新日报抓取", status: "timeout", count: 0, error: "整体抓取超时" }],
    });

    // AI 为每条新闻生成精炼摘要
    const aiAbstracts = report.results.length > 0
      ? await withTimeout(summarizeArticles(report.results), AI_TIMEOUT, "AI新闻摘要", report.results.map((r) => r.abstract || ""))
      : [];
    report.results.forEach((r, i) => {
      if (aiAbstracts[i]) {
        r.abstract = aiAbstracts[i];
      }
    });
    Object.values(report.categories).forEach((catItems) => {
      catItems.forEach((item) => {
        const idx = report.results.findIndex((r) => r.url === item.url);
        if (idx >= 0 && aiAbstracts[idx]) {
          item.abstract = aiAbstracts[idx];
        }
      });
    });

    const cityDailySystemPrompt = `你是一位城市更新领域的新闻分析师。请根据提供的今日新闻素材，完成以下任务：
1. 撰写一段 80-120 字的综合摘要，凝练当日城市更新领域核心动向
2. 提炼 3-5 条关键要点，每条一句话
请用中文回答，格式如下：

【综合摘要】
...

【关键要点】
1. ...
2. ...
3. ...
`;

    const aiResult = report.results.length > 0
      ? await withTimeout(summarizeNews("城市更新日报", report.results, cityDailySystemPrompt), AI_TIMEOUT, "AI城市更新总结", {
          summary: "AI 总结暂不可用，已返回新闻列表。",
          highlights: [],
        })
      : { summary: "今日暂未抓取到城市更新新闻。", highlights: [] };
    const dailyReport = generateCityDailyMarkdown(report.results, report.date);

    res.json({
      ...report,
      summary: aiResult.summary,
      highlights: aiResult.highlights,
      dailyReport,
    });
  } catch (err) {
    console.error("城市更新日报接口错误:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/competitor", async (req, res) => {
  try {
    const { companies, days } = req.query;
    const selected = companies ? companies.split(",") : null;
    const dayCount = days ? parseInt(days) : 7;
    const report = await generateCompetitorReport(selected, dayCount);
    res.json(report);
  } catch (err) {
    console.error("竞品动态接口错误:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ===== AI 小助手聊天接口 ===== */
router.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "请输入消息" });
  }

  if (!KIMI_API_KEY) {
    return res.status(500).json({ error: "未配置 KIMI_API_KEY" });
  }

  try {
    const response = await axios.post(
      KIMI_API_URL,
      {
        model: KIMI_MODEL,
        messages: [
          {
            role: "system",
            content: `你是"优小码"，一个像素风格的通用AI智能体，具备Kimi的完整能力。你可以回答用户的任何问题，包括但不限于编程、写作、分析、翻译、数学、创意等。回答简洁专业，适当活泼可爱。当用户要求使用本站功能（如搜索、生成日报）时，你可以引导他使用对应的页面功能。`,
          },
          { role: "user", content: message.trim() },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${KIMI_API_KEY}`,
        },
        timeout: Number(process.env.AI_HTTP_TIMEOUT_MS || 18000),
      }
    );

    const reply = response.data.choices?.[0]?.message?.content || "抱歉，我暂时没反应过来，请再试一次~";
    res.json({ reply });
  } catch (err) {
    console.error("AI 聊天接口错误:", err.message);
    res.status(500).json({ error: `AI 服务暂时不可用: ${err.message}` });
  }
});

module.exports = router;
