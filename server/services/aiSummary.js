const axios = require("axios");

const API_URL = "https://api.moonshot.cn/v1/chat/completions";
const API_KEY = process.env.KIMI_API_KEY || "";
const MODEL = "moonshot-v1-8k";

async function summarizeNews(query, articles, customSystemPrompt) {
  if (!API_KEY) {
    return {
      summary: "未配置 Kimi API Key，请在 .env 文件中设置 KIMI_API_KEY。",
      highlights: [],
      raw: "",
    };
  }

  const context = articles
    .slice(0, 8)
    .map((a, i) => `文章${i + 1}：《${a.title}》\n来源：${a.source || a.url}\n摘要：${(a.content || a.abstract || "").slice(0, 400)}`)
    .join("\n\n---\n\n");

  const systemPrompt = customSystemPrompt || `你是一位城市更新领域的新闻分析师。请根据用户的问题和提供的文章，完成以下任务：
1. 撰写一段 200-300 字的综合摘要
2. 提炼 3-5 条关键要点
3. 标注每条信息的主要来源
请用中文回答，格式如下：

【综合摘要】
...

【关键要点】
1. ...（来源：xxx）
2. ...（来源：xxx）
...

【参考来源】
- 文章标题（来源网站）`;

  const userPrompt = `用户问题：${query}\n\n相关文章：\n\n${context}`;

  try {
    const res = await axios.post(
      API_URL,
      {
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2048,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        timeout: Number(process.env.AI_HTTP_TIMEOUT_MS || 18000),
      }
    );

    const text = res.data.choices?.[0]?.message?.content || "";

    const summaryMatch = text.match(/【综合摘要】\s*([\s\S]*?)(?=【关键要点】|$)/);
    const highlightsMatch = text.match(/【关键要点】\s*([\s\S]*?)(?=【参考来源】|$)/);

    return {
      summary: summaryMatch ? summaryMatch[1].trim() : text.slice(0, 300),
      highlights: highlightsMatch
        ? highlightsMatch[1]
            .trim()
            .split("\n")
            .filter((l) => l.trim().match(/^\d+\./))
            .map((l) => l.replace(/^\d+\.\s*/, "").trim())
        : [],
      raw: text,
    };
  } catch (err) {
    console.error("AI 总结失败:", err.message);
    return {
      summary: `❌ AI 总结失败: ${err.message}`,
      highlights: [],
      raw: "",
    };
  }
}

async function summarizeArticles(articles) {
  if (!API_KEY || articles.length === 0) {
    return articles.map((a) => a.abstract || "");
  }

  const context = articles
    .map((a, i) => `${i + 1}. 《${a.title}》\n   原始摘要：${(a.abstract || "").slice(0, 120)}`)
    .join("\n\n");

  const systemPrompt = `你是一位城市更新领域资深新闻编辑。请根据提供的新闻标题和原始摘要，为每条新闻撰写一段 60-80 字的核心摘要。

要求：
1. 摘要必须是对新闻核心内容的提炼总结，突出政策意义、实践亮点或行业影响
2. 不要简单重复标题或引用原文开头
3. 语言简洁专业，适合行业日报使用
4. 严格按编号返回，每条一行`;

  const userPrompt = `请为以下新闻各写一段 60-80 字摘要：\n\n${context}\n\n请严格按以下格式返回（只输出摘要，不要解释）：\n1. [摘要内容]\n2. [摘要内容]\n...`;

  try {
    const res = await axios.post(
      API_URL,
      {
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 2048,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        timeout: Number(process.env.AI_HTTP_TIMEOUT_MS || 18000),
      }
    );

    const text = res.data.choices?.[0]?.message?.content || "";

    const summaries = [];
    const lines = text.split("\n");
    for (const line of lines) {
      const match = line.match(/^\d+\.\s*(.+)/);
      if (match) {
        summaries.push(match[1].trim());
      }
    }

    while (summaries.length < articles.length) {
      summaries.push(articles[summaries.length]?.abstract || "");
    }

    return summaries.slice(0, articles.length);
  } catch (err) {
    console.error("AI 摘要生成失败:", err.message);
    return articles.map((a) => a.abstract || "");
  }
}

module.exports = { summarizeNews, summarizeArticles };
