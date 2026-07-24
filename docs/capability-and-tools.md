# 阿福能力边界与工具参考

> 最后更新: 2026-07-24  
> 本文档描述阿福的完整能力边界、7 个工具、意图识别机制和各级降级策略。

---

## 一、身份定位

阿福（Alfred）是 **AI 协作管家**，不是万能执行者。

| 擅长（全力发挥） | 不擅长（推荐替代工具） |
|---|---|
| 把模糊想法追问成清晰目标 | 写代码 → 推荐 Claude / Cursor / Copilot |
| 发现遗漏的关键信息（约束、风险、边界） | 深度技术研究 → 推荐 ChatGPT / Perplexity |
| 整理结构化任务契约 | 执行系统命令 → 告诉用户怎么做 |
| 推荐合适的工具、方法和行动顺序 | 设计 UI → 推荐 Figma / Claude |
| 规范工作过程、避免踩坑 | 数据分析 → 推荐 ChatGPT Code Interpreter |
| 生成文档、计划书、README 等 Markdown 产物 | — |
| 存档会话、生成项目记忆摘要 | — |

---

## 二、工具全览（7 个）

### 2.1 按功能分类

```
┌────────────────────────────────────────────────────┐
│  知识读写                                          │
│  ├─ search_knowledge_base    读 PGVector        │
│  └─ add_to_knowledge_base    写 PGVector        │
│                                                    │
│  文档导出                                          │
│  ├─ export_markdown          轻量: 写了就导出    │
│  └─ save_project_memory      重量: LLM 合成摘要  │
│                                                    │
│  文件系统                                          │
│  ├─ write_file               写 data/exports/   │
│  └─ run_shell_preview        只读 Shell 预览    │
│                                                    │
│  代码执行                                          │
│  └─ python_exec              沙箱 Python        │
└────────────────────────────────────────────────────┘
```

### 2.2 逐一说明

#### `search_knowledge_base` — 知识库检索

| 属性 | 值 |
|---|---|
| 分类 | 知识读写（只读） |
| 功能 | PGVector 向量检索本地知识库（工作方法论、工具推荐、工程规范） |
| 返回 | 结构化 JSON：`{hit, results: [{rank, source_file, content_snippet, score}]}` |
| 触发场景 | 需要精确引用知识库内容；被动 RAG 不够；验证细节是否有记载 |
| 不触发 | 常识性问题；纯创意/头脑风暴；同一 query 本轮已搜过 |
| 对 Skill 可见 | ✅ 全部 Skill |

#### `add_to_knowledge_base` — 知识持久化

| 属性 | 值 |
|---|---|
| 分类 | 知识读写（只写） |
| 功能 | 将对话中提炼的有价值知识写入 PGVector，写入后可检索 |
| 触发场景 | 用户说"记下来"；提取出可复用知识（决策、约定、方法论） |
| 不触发 | 临时闲聊；隐私信息；< 30 字符碎片；与已有内容高度重复 |
| 对 Skill 可见 | ✅ 全部 Skill |
| 限制 | 依赖 RAG 服务初始化 |

#### `export_markdown` — 轻量文档导出

| 属性 | 值 |
|---|---|
| 分类 | 文档导出（轻量） |
| 功能 | 把 AI 自己写好的 Markdown 内容直接保存为 .md 并返回下载链接 |
| 工作流 | 1. 模型写出完整 Markdown → 2. 调用此工具 → 3. 用户点击下载 |
| 触发场景 | 用户要文档：README、计划书、会议纪要、技术方案；用户说"导出""下载""生成一份 xxx 文档" |
| 不触发 | 内容未写好；< 50 字符；用户要的是"存档会话" |
| 对标 | 轻量、秒级完成。与 `save_project_memory` 互补 |
| 对 Skill 可见 | ✅ 全部 Skill |

#### `save_project_memory` — 会话存档

| 属性 | 值 |
|---|---|
| 分类 | 文档导出（重量） |
| 功能 | 从当前会话的 L1(最近对话) + L2(滚动摘要) + L3(语义事实) + 任务契约，通过 LLM 合成为结构化项目记忆 .md |
| 输出 | 8 个板块：快速恢复、项目目标、任务契约、已确认决策、已放弃方案、当前进度、关键产物、关键实现信息 |
| 触发场景 | 用户说"保存当前对话""导出项目记忆""存下来下次继续"；工作告一段落 |
| 不触发 | 对话 < 3 轮；用户只要下载某份文档；随口说"记住这个" |
| 耗时 | ~5-10s（LLM json_object 模式合成） |
| 对 Skill 可见 | ✅ 全部 Skill |

#### `write_file` — 文件写入

| 属性 | 值 |
|---|---|
| 分类 | 文件系统（只写） |
| 功能 | 将内容写入 `data/exports/` 目录 |
| 安全 | 路径穿越拦截；后缀白名单（.md/.txt/.json/.csv/.py/.html/.css/.js）；默认不覆盖；单文件 ≤100KB |
| 触发场景 | 整理完文档落盘；产出项目计划导出；用户说"保存到文件" |
| 不触发 | 写系统文件；写二进制；覆盖已有文件（除非 `overwrite=True`）；写隐私信息 |
| 对 Skill 可见 | ❌ 仅 ALL_TOOLS 持有（预留工具，不分配给 Skill） |

#### `run_shell_preview` — 只读 Shell

| 属性 | 值 |
|---|---|
| 分类 | 文件系统（只读） |
| 功能 | 执行白名单 Shell 命令：`ls` / `cat` / `head` / `tail` / `wc` / `tree` / `git(log/status/branch/diff/show)` / `du` / `find` / `file` |
| 安全 | 命令白名单；禁止管道/重定向/分号/危险参数；超时 10s；输出截断 5000 字符 |
| 触发场景 | 需要查看项目结构、文件内容、Git 状态 |
| 不触发 | 大多数信息可从对话上下文推断 |
| 对 Skill 可见 | ❌ 仅 ALL_TOOLS 持有（预留） |

#### `python_exec` — 沙箱 Python

| 属性 | 值 |
|---|---|
| 分类 | 代码执行 |
| 功能 | 在隔离沙箱中执行 Python 代码，返回 stdout/stderr |
| 安全 | 需 `SANDBOX_ENABLED=true` 才启用；超时 30s；禁止文件写入/网络/系统命令；白名单内置函数和安全模块 |
| 触发场景 | 精确计算、格式转换（JSON/CSV/Markdown 互转）、数据验证 |
| 不触发 | 纯文本处理；需要文件系统/网络访问；不确定安全性 |
| 对 Skill 可见 | ❌ 仅 ALL_TOOLS 持有（预留） |

### 2.3 按 Skill 分配

| Skill | 可用工具 |
|---|---|
| `prompt_refiner` | search_knowledge_base, add_to_knowledge_base, save_project_memory, export_markdown |
| `work_arranger` | search_knowledge_base, add_to_knowledge_base, save_project_memory, export_markdown |
| `info_retention` | add_to_knowledge_base, search_knowledge_base, save_project_memory, export_markdown |
| `code_review` | search_knowledge_base, add_to_knowledge_base, save_project_memory, export_markdown |

> **设计原则**：每个 Skill 只暴露 4 个工具——检索 + 写入 + 两种导出。预留工具（write_file、run_shell_preview、python_exec）仅由 `ALL_TOOLS` 持有，不分配给 Skill，减少模型选择负担。

---

## 三、意图识别（Router）

### 3.1 两级路由

```
用户消息
  │
  ├─ module ≠ "auto"  →  跳过路由，直接使用用户指定模块
  │
  └─ module = "auto"  →  Router 介入:
        │
        ├─ L1: 同步规则分类 (route_intent_sync)
        │     └─ 关键词密度评分，零延迟，confidence=0.5
        │
        └─ L2: LLM 精判 (仅当规则置信度 < 0.8)
              └─ 一次轻量 model.invoke()，confidence=0.9
```

### 3.2 场景 → 模块映射

| 场景代码 | 场景含义 | 映射模块 | 触发关键词（规则版） |
|---|---|---|---|
| `prompt_optimize` | 写/改/优化提示词、生成文案、翻译、润色 | `prompt_refiner` | 提示词、prompt、文案、翻译、润色、改写 |
| `work_plan` | 规划项目、安排任务、排期、方案评估 | `work_arranger` | 安排、计划、项目、排期、任务、工作流、怎么做 |
| `info_organize` | 整理/保存/导出信息、总结对话、记录决策 | `info_retention` | 整理、保存、留存、总结、导出、记录 |
| `research` | 调研技术选型、对比方案、搜索资讯 | `work_arranger` | 调研、对比、选型、推荐、哪个好 |
| `code_help` | 审查代码、找 bug、写测试、重构建议 | `code_review` | 代码、bug、测试、重构、审查、review |
| `general` | 闲聊、问候、无法归类 | `prompt_refiner` | （以上都不匹配时） |

### 3.3 降级路径

```
LLM 调用失败
  → 场景代码回退到 "general"
  → 模块回退到 "prompt_refiner"（默认模块）

LLM 输出非标准场景代码
  → _clean_scene(): 直接匹配 → 模糊关键词匹配 → "general"

首次路由（无历史）
  → 规则版 route_intent_sync() 总是可用（纯 Python，不依赖网络/LLM）
```

---

## 四、任务契约系统

### 4.1 契约字段

Planner (LLM json_object) 输出结构：

| 字段 | 说明 | 示例 |
|---|---|---|
| `goal` | 最终目标（一句话） | "为博客项目添加用户名+密码登录" |
| `scope.in` | 要做什么 | ["注册", "登录", "session 保持"] |
| `scope.out` | 不要做什么 | ["OAuth", "密码找回", "权限管理"] |
| `constraints` | 硬约束 | ["React+TS", "下周五前"] |
| `acceptance` | 验收标准 | ["密码错误不区分原因提示"] |
| `risks` | 风险边界 | ["涉及密码存储需确认方案"] |
| `deliverables` | 交付物 | `{format: "代码改动+PR", artifacts: [...]}` |
| `missing_fields` | 缺失字段 | ["scope.out", "acceptance"] |
| `confidence` | 完整度 0-1 | goal(30%) + scope(25%) + constraints(15%) + acceptance(10%) + risks(10%) + deliverables(10%) |

### 4.2 契约生命周期

```
Planner 生成 → 前端左侧栏实时渲染
  → 用户可确认（status=confirmed）
  → 用户可修改（增量更新，创建新版本）
  → Executor 执行时注入为"执行边界"
  → Checkpoint/Reflector 审核时作为"对照标准"
  → 存入 PostgreSQL (task_contracts 表) 版本历史
  → 新会话可从 contract_store.get_latest() 恢复
```

---

## 五、Graph 执行流程与降级

### 5.1 完整流程

```
START
  → router        (LLM)  意图识别 ←── 降级: 规则分类 + general 兜底
  → enrich        (纯数据) 查询词增强 ←── 无 LLM，不掉
  → rag           (纯数据) 知识库检索 ←── 服务不可用时返回空
  → planner       (LLM)  提取维度 + 生成契约 ←── 降级: _fallback_plan()
      ├─ 信息不足 → clarify (LLM) → END ←── 降级: 规则生成追问模板
      └─ 信息充足 → engineering_check (规则) → 
            ├─ 阻断 ──────────→ END (返回阻断消息)
            ├─ 触发多Agent ──→ multi_agent (多 LLM 并行) → reflect → END
            └─ 正常 ────────→ execute (ReAct, ≤10轮) → checkpoint (LLM)
                                  ├─ 偏离 → execute 重试 (≤1次)
                                  └─ 对齐 → reflect (LLM)
                                              ├─ 不合格 → execute 重试 (≤2次)
                                              └─ 合格 → END
```

### 5.2 各级降级总表

| 节点 | 正常路径 | 降级 | 降级触发条件 |
|---|---|---|---|
| Router | LLM 分类 (confidence=0.9) | 规则分类 (confidence=0.5) | LLM 调用失败 或 未被调用时 |
| Enrich | ContextEngine 预构建 enriched_query | 直接用原始消息 | ContextEngine 不可用 |
| RAG | PGVector 混合检索 + Rerank | 返回空字符串 | PGVector 异常、知识库为空 |
| Planner | LLM json_object 提取维度+契约 | `_fallback_plan()` 规则降级 | JSON 解析失败 / LLM 异常 |
| Clarify | LLM 自然语言追问 | `_generate_fallback_questions()` 模板兜底 | LLM 未生成追问 |
| Engineering Check | 规则匹配 + 内置触发器 | 返回空 (静默跳过) | 无场景触发 / advisor 初始化失败 |
| Multi-Agent | 三立场 LLM 并行 + 整合 | 返回错误消息文本 | LLM 全部失败 |
| Execute | ReAct Agent tool calling (≤10轮) | `_execute_legacy_skill()` 旧版 Agent | ReAct 异常 |
| Checkpoint | LLM 语义对齐检查 (score 0-10) | 默认通过 (aligned=true) | LLM 调用失败 / 超过重试上限 |
| Reflect | LLM 质量评分 (score 0-10) | 默认通过 (pass=true, score=7) | LLM 调用失败 / 超过重试上限 |
| Contract | TaskContract.from_planner_json() | 手动构建字典 | Pydantic 解析失败 |

### 5.3 重试上限

| 重试环 | 最大次数 | 失败后行为 |
|---|---|---|
| Checkpoint → Execute | 1 次 | 放弃纠正，进入 Reflect |
| Reflect → Execute | 2 次 | 放弃重试，返回 END |
| Planner 追问轮 | 3 轮 | 超过后进入 engineering_check → execute |

---

## 六、工程规范检查

### 6.1 三级输出

| 级别 | 模式 | 行为 | 示例场景 |
|---|---|---|---|
| 1 — 建议 | `suggestion` | 注入执行上下文，不打断 | Python 依赖管理建议 |
| 2 — 确认 | `confirm` | 生成确认问题，暂停执行 | Git 公开提交前检查密钥 |
| 3 — 阻断 | `block` | 硬阻断，返回阻断消息到 END | 代码中硬编码 API 密钥 |

### 6.2 内置检测场景

| 场景 | 级别 | 触发关键词 |
|---|---|---|
| API 密钥与凭证管理 | 3 — 阻断 | api key, token, 密钥, 密码, secret, 硬编码 |
| 数据库操作与数据安全 | 2 — 确认 | 数据库, 删除, drop, delete, 迁移, migration |
| 文件写入与系统操作 | 2 — 确认 | 写文件, 删除文件, rm, sudo, chmod |
| 公开提交 Git 仓库 | 2 — 确认 | github, git, push, 提交, 开源, 公开 |
| 部署与发布 | 2 — 确认 | 部署, deploy, 发布, 上线, 生产环境 |
| Python 项目依赖管理 | 1 — 建议 | python, pip, 依赖, requirements, venv |

---

## 七、三层上下文

| 层 | 内容 | 更新方式 | 存储 |
|---|---|---|---|
| L1 原始窗口 | 最近 3 轮完整原文 | 每次对话自动轮替 | 直接从 messages 表读取 |
| L2 滚动摘要 | 全部历史的增量压缩版 | 每轮后 LLM 增量更新「旧摘要+本轮→新摘要」 | 内存 `_running_summary`，话题切换时重置 |
| L3 语义事实 | 偏好/决策/约束原子句 | 每轮后 LLM 提取 → embedding → PGVector（主）或内存字典（后备） | PGVector `session_memory` 表 |

### 7.1 话题切换检测

| 条件 | 判定 |
|---|---|
| 轮数 ≤ 4 | 不检测（仍在澄清需求） |
| 关键词零重叠 | 切换，重置 L2 + L3 |
| 重叠率 ≥ 30% | 同一话题 |
| 0 < 重叠率 < 30% | 保守处理，不重置（未来可加 LLM 精检） |

### 7.2 Query 增强策略

| Query 长度 | 策略 |
|---|---|
| ≥ 80 字符 | 不加任何上下文，保护原始语义 |
| 30-80 字符 | 加 L3 事实 + 已确认维度 |
| < 30 字符 | 多源组合：L3 + 维度 + L2 + 上轮摘要（检测话题切换后不注入） |

---

## 八、记忆系统

### 8.1 会话开始时

```
1. SessionMemory.retrieve(message, top_k=3)
   → PGVector 向量检索相似历史会话摘要
2. UserProfile.format_for_context()
   → PGVector 检索用户画像事实
3. 拼接为 memory_context → 注入 agent._build_initial_state() 的 extra_context
```

### 8.2 会话结束时

```
1. SessionMemory.summarize_and_store(session_id, messages, module)
   → 自动摘要整段对话 → 存入 PGVector
2. UserProfile.update_from_summary(summary_data)
   → 从摘要中提取新偏好 → 更新画像
```

---

## 九、快速参考：用户说 X → AI 用 Y

| 用户说 | AI 做什么 | 用什么工具 |
|---|---|---|
| "帮我写一份 README" | 用模型知识写好 Markdown → 导出 | `export_markdown` |
| "导出为 md / 下载文档" | 同上 | `export_markdown` |
| "保存这次对话 / 存档项目" | LLM 从上下文合成记忆摘要 | `save_project_memory` |
| "帮我改这个提示词" | 分析需求 → 追问 → 生成 2-3 个版本 | prompt_refiner Skill |
| "这个项目怎么规划" | 拆解任务 → 排期 → 推荐工具 | work_arranger Skill |
| "帮我整理这些信息" | 结构化 → 提取关键决策 → 留存 | info_retention Skill |
| "帮我看看这段代码" | 正确性/安全性/可读性审查 | code_review Skill |
| "查知识库里怎么说" | 向量检索 → 返回结构化结果 | `search_knowledge_base` |
| "记住这个" | 写入 PGVector 知识库 | `add_to_knowledge_base` |
| "记下来"（随口说） | 只记录偏好/决策事实 | `add_to_knowledge_base` |
| "帮我算个数 / 转换格式" | 沙箱 Python 执行 | `python_exec`（需启用） |
| "看看项目文件结构" | 执行白名单 Shell 命令 | `run_shell_preview`（预留） |
| "保存到文件" | 写入 data/exports/ | `write_file`（预留） |
