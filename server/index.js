const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.use("/api", apiRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 城市更新日报 AI 搜索已启动: http://localhost:${PORT}`);
  if (!process.env.KIMI_API_KEY) {
    console.log("⚠️  提示: 未设置 KIMI_API_KEY 环境变量，AI 总结功能将不可用");
    console.log("     设置方法: export KIMI_API_KEY=sk-xxx");
  }
});
