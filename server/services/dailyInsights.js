const axios = require("axios");

const API_URL = "https://api.moonshot.cn/v1/chat/completions";
const API_KEY = process.env.KIMI_API_KEY || "";
const MODEL = "moonshot-v1-8k";

async function generateInsights(newsItems, enterprises) {
  if (!API_KEY) {
    return {
      keywords: "未配置 API Key",
      trend: "",
      marketing: "",
      tomorrow: "",
    };
  }

  const context = newsItems
    .slice(0, 10)
    .map((item, i) => `${i + 1}. 【${item.category}】${item.title}（来源：${item.source}）`)
    .join("\n");

  const systemPrompt = `你是优码智库的高级行业分析师，专注于不动产行业（地产、物业、园区、医院等）的研究。
请根据今日行业新闻，生成「优码今日洞察」日报，格式严格如下：

【关键词】
提炼3-5个今日核心关键词，用顿号分隔

【趋势研判】
基于今日新闻，分析行业趋势（100字左右）

【营销建议】
结合优码产品（不动产数字化管理平台、智慧物业系统、资产运营平台），给出具体的营销切入点（100字左右）

【明日关注】
建议明日重点关注的方向或事件（50字左右）

注意：
1. 分析要有深度，不要泛泛而谈
2. 营销建议要具体，体现优码产品的价值
3. 语言专业但不晦涩`;

  const userPrompt = `今日不动产行业新闻：\n\n${context}\n\n请生成「优码今日洞察」。`;

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
        timeout: 90000,
      }
    );

    const text = res.data.choices?.[0]?.message?.content || "";

    const keywordsMatch = text.match(/【关键词】\s*([\s\S]*?)(?=【趋势研判】|$)/);
    const trendMatch = text.match(/【趋势研判】\s*([\s\S]*?)(?=【营销建议】|$)/);
    const marketingMatch = text.match(/【营销建议】\s*([\s\S]*?)(?=【明日关注】|$)/);
    const tomorrowMatch = text.match(/【明日关注】\s*([\s\S]*?)$/);

    return {
      keywords: keywordsMatch ? keywordsMatch[1].trim() : "",
      trend: trendMatch ? trendMatch[1].trim() : "",
      marketing: marketingMatch ? marketingMatch[1].trim() : "",
      tomorrow: tomorrowMatch ? tomorrowMatch[1].trim() : "",
      raw: text,
    };
  } catch (err) {
    console.error("洞察生成失败:", err.message);
    return {
      keywords: "",
      trend: `生成失败: ${err.message}`,
      marketing: "",
      tomorrow: "",
      raw: "",
    };
  }
}

module.exports = { generateInsights };
