# Urban News Search

城市更新日报 AI 搜索站 — 聚合多源新闻，AI 生成摘要与日报。

## 项目结构

- `server/index.js` — Express 入口，服务静态文件
- `server/routes/api.js` — API 路由（搜索、日报、竞品、AI 总结）
- `server/services/search.js` — 多引擎聚合搜索（百度、搜狗、Bing、RSS、定向爬虫）
- `server/services/rssFeeds.js` — RSS 源抓取
- `server/services/targetedCrawler.js` — 各地政府网站定向爬取
- `server/services/aiSummary.js` — Kimi AI 摘要生成
- `server/services/dailySearch.js` — 日报生成
- `public/` — 前端静态文件（HTML/CSS/JS）

## 部署

- **平台**: Render (Node.js Web Service)
- **仓库**: `junesminder36-boop/urban-news-search-.git`
- **生产地址**: https://urban-news-search.onrender.com
- **构建命令**: `npm install`
- **启动命令**: `npm start`
- **环境变量**: `KIMI_API_KEY`（在 Render Dashboard 配置）

## 搜索逻辑

1. 同时并发：百度新闻、搜狗新闻、Bing 新闻、RSS 订阅、定向爬虫
2. 聚合去重 → 按日期过滤（近3天）→ 自动分类
3. 抓取正文 → Kimi AI 生成摘要与亮点
4. 返回分类结果 + AI 总结

## 日期过滤

所有搜索结果严格限制 **近3天**（凌晨0点起算）。`isValidResult` 同时过滤非中文内容（标题汉字少于3个直接丢弃）。

## 注意事项

- 百度链接会自动解析跳转，返回真实 URL
- 已移除 Yahoo 搜索（对中文关键词返回大量英文结果）
- 静态文件直接由 Express `express.static` 托管
