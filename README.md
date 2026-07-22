# 阿福 — AI 协作管家

> **守在用户与智能体之间的 AI 协作管家。**
> 帮助你想清楚目标、适配合适能力、规范工作过程、记住项目结果。
>
> 从 [Portal/MakeItSpecific](https://github.com/yoiwerr/portal) 独立出来的完整项目。

---

## 产品定位

阿福不是替用户做所有事情的自动执行 Agent，而是**人与智能体之间的协作管家**。

其他 Agent 负责行动，阿福负责确保行动是对的。

### 四项核心能力

| 能力 | 一句话 |
|------|--------|
| 💡 **想清楚** | 目标不清晰时追问关键信息，形成任务契约 |
| 🤝 **选对人** | 根据任务特点推荐合适的模型、工具或 Agent |
| 🛡️ **看住过程** | 控制范围、规范节奏，高风险操作先确认 |
| 🧠 **记住结果** | 每次收尾生成项目交接卡，下次直接恢复上下文 |

完整产品规划见 [TODO.md](./TODO.md)。

---

## 快速开始

```bash
cd Alfred

# 1. 安装依赖
pip install -r requirements.txt

# 2. 配置环境变量
cp .env.example .env
vim .env   # 填入 LLM API Key + PostgreSQL 密码

# 3. 确保 PostgreSQL 可用（需要 pgvector 扩展）
# 本地已有 PG 实例直接复用，或 Docker 快速起一个：
# docker run -d --name alfred-pg \
#   -e POSTGRES_PASSWORD=yourpassword \
#   -e POSTGRES_DB=alfred \
#   -p 5432:5432 \
#   pgvector/pgvector:pg16

# 4. 启动
python app.py
# → http://localhost:8001
```

---

## 架构

```
Browser (SSE Token Streaming)
    │  POST /api/chat/stream?v=2
    ▼
FastAPI → LangGraph ReAct Agentic Loop
    │
    ├── Planner:  提取维度 + 判断完整度 → 追问 or 执行
    ├── Clarify:  动态追问补全信息
    ├── Execute:  ReAct Agent tool calling loop
    └── Reflect:  质量检查 + 自动重试 (最多2次)

存储层: PostgreSQL + PGVector（向量检索 + 会话 + 记忆 + 反馈）
```

---

## 项目目录

```
Alfred/
├── app.py              ← FastAPI 入口
├── config.py           ← 全局配置 (多 Provider)
├── pyproject.toml
├── requirements.txt
├── .env.example        ← 环境变量模板
├── TODO.md             ← 功能路线图
│
├── core/               ← Agent 引擎
│   ├── agent.py        ← Agent 编排器 (astream_events)
│   ├── graph.py        ← LangGraph V2 ReAct Loop
│   ├── llm_client.py   ← 多 Provider LLM 工厂
│   └── context_engine.py ← 三层上下文 (L1/L2/L3)
│
├── routers/            ← API 路由
│   ├── chat.py         ← 核心对话 (SSE 流式)
│   ├── sessions.py     ← 会话管理 + 导出
│   ├── knowledge.py    ← 知识库管理
│   ├── feedback.py     ← 用户反馈
│   └── files.py        ← 文件上传
│
├── services/           ← 数据服务
│   ├── rag_service.py     ← RAG (混合检索 + Rerank)
│   ├── vector_store.py    ← PGVector 向量存储
│   ├── session_store.py   ← PostgreSQL 会话持久化
│   └── md_export.py       ← Markdown 导入导出
│
├── tools/              ← Agent 工具集 (@tool)
│   └── search.py       ← search_kb / search_web / search_history
│
├── skills/             ← 三个 Skill (提示词工程/工作安排/信息留存)
├── prompts/            ← System Prompts (Planner/Executor/Reflector + Skill)
├── models/             ← Pydantic 数据模型
│
├── static/             ← 前端 (Vanilla JS + CSS)
│   ├── index.html
│   ├── css/style.css
│   └── js/chat.js      ← SSE token 流式渲染 + 反馈 + 交接卡
│
├── knowledge_base/     ← RAG 知识源 (.md)
├── docs/               ← 学习文档 + 产品规划
├── tests/              ← 测试
└── data/               ← 运行时数据 (自动创建)
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | FastAPI + LangGraph + LangChain |
| LLM | DashScope / DeepSeek / OpenAI / Local |
| 嵌入 | DashScope text-embedding-v4 (1024维) |
| 向量库 | PostgreSQL + PGVector |
| Rerank | 百炼 qwen3-rerank |
| 流式 | SSE (sse-starlette) |
| 会话 | PostgreSQL (与向量存储共用) |
| 前端 | Vanilla JS + CSS (零框架依赖) |

---

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/` | 首页 |
| `GET` | `/api/health` | 健康检查 |
| `POST` | `/api/chat/stream?v=2` | SSE 流式对话 |
| `GET` | `/api/sessions` | 会话列表 |
| `GET` | `/api/sessions/{id}` | 会话详情 |
| `GET` | `/api/sessions/{id}/export` | 导出 Markdown |
| `DELETE` | `/api/sessions/{id}` | 删除会话 |
| `POST` | `/api/feedback` | 提交反馈 |
| `GET` | `/api/feedback/stats` | 反馈统计 |
| `GET` | `/docs` | Swagger API 文档 |
