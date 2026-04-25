const express = require("express");
const router = express.Router();
const { searchAll } = require("../services/search");
const { batchFetch } = require("../services/crawler");
const { summarizeNews } = require("../services/aiSummary");
const { generateDailyReport } = require("../services/dailySearch");
const { generateCompetitorReport } = require("../services/competitorSearch");
const { generateInsights } = require("../services/dailyInsights");
const { ENTERPRISES } = require("../services/dailySearch");

router.get("/search", async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: "请输入搜索关键词" });
  }

  try {
    const results = await searchAll(q.trim());

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
    const articles = await batchFetch(urls);
    const aiResult = await summarizeNews(q.trim(), articles);

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
    const report = await generateDailyReport(q);
    const insights = await generateInsights(report.results, ENTERPRISES);

    res.json({
      ...report,
      insights,
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

module.exports = router;
