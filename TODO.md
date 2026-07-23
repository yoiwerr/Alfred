# 阿福 — 开发 TODO

> 基于 `docs/阿福` 产品规划。标记：`[x]` 已完成 / `[ ]` 待开发。

---

## 一、已完成 (2026-07-22)

### 1. 前端视觉
- [x] 黑金质感暗色主题 (Vanilla JS + CSS，零框架)
- [x] 顶部导航栏：阿福 Alfred + 状态点 + 读入项目记忆 / 下载记忆摘要按钮
- [x] 空状态：头像 + "晚上好，我是阿福。" + 3 个示例问题
- [x] 阿福消息：左侧圆形头像（金边发光）+ 名称 + 正文 + 复制按钮
- [x] 用户消息：右侧深灰气泡（无头像）
- [x] 输入区域：附件 icon + textarea + 暗金发送按钮 + 底部说明文字
- [x] 弹窗：读入项目记忆 / 下载记忆摘要（占位，各含"知道了"按钮）
- [x] 复制按钮：Clipboard API，hover 变金，点击显示"已复制"
- [x] 响应式布局 (max-width 960px)
- [x] 模拟对话：4 条静态示例消息展示对话效果
- [x] 项目交接卡按钮：点击 → SSE 流式生成 → 浏览器下载 .md

### 2. LangGraph Agentic Loop
- [x] **Router** 意图识别：双轨（规则快道 + LLM 精判），6 场景 → 4 Skill 映射
- [x] **Planner**：LLM JSON mode 提取维度 + 完整度评分 + 输出 execution_plan
- [x] **Clarify**：追问生成（模板兜底），最多 3 轮
- [x] **Execute**：ReAct Agent tool calling loop，并行 tool call，skill 兜底
- [x] **Checkpoint**：Planner 语义中枢持续介入 — 检查语义对齐/意图偏移/知识库忠实度/子问题覆盖度
- [x] **Reflector**：质量审核 — 完整性/准确性/实用性/格式规范，不通过回 Execute（最多 2 次）
- [x] SSE token 级流式输出

### 3. 三层记忆体系
- [x] **L1 滑动窗口**：最近 3 轮完整原文，零 LLM 调用，直接注入 Prompt
- [x] **L2 滚动摘要**：增量更新（旧摘要 + 本轮 → 新摘要），max 256 tokens
- [x] **L3 语义事实**：LLM 结构化提取（偏好/决策/约束/技术栈/目标 + 置信度）→ embedding → PGVector session_memory 持久化
- [x] **主题切换检测**：keyword 重叠率快检 → 零重叠判断换话题 → 重置 L2 + 清空 L3 内存
- [x] **L3 降级方案**：LLM 不可用 → 规则正则提取 → 内存字典后备
- [x] **L3 检索**：PGVector 语义召回（主）+ 内存关键词匹配（后备），similarity ≥ 0.5

### 4. RAG 管道 — V5 来源感知升级 (2026-07-23)

- [x] **来源元数据提取**：SourceParser 解析 frontmatter → source_title/source_url/repository/author/accessed_at/version_or_commit
- [x] **来源感知分块**：来源元数据 → 复制到每个子 Chunk；正文做语义分割，来源描述不参与
- [x] **Chunk Identity Chain**：document_id / parent_id / chunk_index / previous_chunk_id / next_chunk_id / source_refs
- [x] **多来源拆分**：一文档多来源 → SourceSplitter 按来源拆成独立 Document 后各自语义分割；精确到 Chunk 的 source_refs
- [x] **稠密检索文本**："source_title + entity_names + section_title + body" 组合 → embedding
- [x] **稀疏检索文本**：单独索引 repository + URL + author + 专有名称 → BM25 tsvector
- [x] **知识图谱**：knowledge_sources → knowledge_documents → knowledge_chunks → knowledge_claims 证据链
- [x] **邻接 Chunk 召回**：通过 prev/next_chunk_id 补充上下文

### 5. 幻觉检测与质量保障
- [x] **第一道防线**：Checkpoint — 知识库忠实度检查，`hallucination_detected` 字段
- [x] **第二道防线**：Reflector — 技术声明准确性检查，知识库参考对比
- [x] **第三道防线**：Prompt 层 — Executor SP 指令 "如未覆盖请明确说明，不要编造"

### 6. 工具体系
- [x] 5 个工具：`search_knowledge_base` / `add_to_knowledge_base` / `python_exec` / `run_shell_preview` / `write_file`
- [x] Skill → 工具映射（每个 Skill 只暴露需要的工具子集）
- [x] 调用优先级链
- [x] 三层防循环（Prompt 约束 / 硬计数器 10 轮 / 模式检测）
- [x] 工具 docstring 三段式（用途/不要用/参数返回）

### 7. 日志与 Badcase
- [x] RotatingFileHandler + StreamHandler 双写
- [x] 关键日志埋点：Router / Planner / Execute / Checkpoint / ContextEngine / RAG / Memory / Agent
- [x] Feedback 系统：前端 👎 按钮 → PostgreSQL feedback 表 → 统计 API
- [x] 自动 Badcase 信号：Checkpoint aligned=false / Reflector pass=false / 异常日志

### 8. 基础设施
- [x] FastAPI + LangGraph + LangChain
- [x] 多 Provider LLM (DashScope / DeepSeek / OpenAI / Local)
- [x] PostgreSQL + PGVector (6 张表：sessions / messages / feedback / domain_knowledge / session_memory / user_profile)
- [x] Docker Compose 自包含部署
- [x] uv 项目管理
- [x] Git 仓库 (github.com/yoiwerr/Alfred)
- [x] 交互流程图文档 (`docs/交互流程图.md`)

---

## 二、待开发：阶段一 — 核心能力升级

### 1. 想清楚：任务澄清 → 任务契约

- [x] **TaskContract Pydantic 模型**：7 字段 + Scope/Permissions 子模型 + from_planner_json 兼容
- [x] **Planner 升级**：输出 TaskContract JSON，替代 `dimensions` dict，missing_fields 驱动 Clarify
- [x] **Clarify 追问对齐**：contract-based 追问生成（_generate_contract_questions），按风险优先级排序
- [x] **契约确认 UI**：左侧边栏渲染卡片，确认调用后端 API，修改支持内联编辑（makeEditable/saveContractEdits）
- [x] **契约版本管理**：ContractStore 支持版本历史（INSERT 新行保留旧版本），get_history 追溯
- [x] **跨会话契约恢复**：process_message_stream 加载上次契约注入 extra_context

### 2. ~~选对人：能力建议与协作路由~~ → 已移除

> 能力卡片不再作为独立系统。推荐外部工具的能力已整合到工程规范的工程知识卡片中，按场景触发而非维护独立卡片库。

### 3. 看住过程：工程规范与安全辅助

- [x] **动态规范引擎**：按任务节点触发的知识补充能力，不是固定模块
  - 场景检测 → 知识检索 → 三级输出（建议/确认/阻断）
  - 6 个内置工程场景：Git 提交安全、Python 依赖管理、数据库操作、API 凭证、部署发布、文件系统操作
  - 知识卡片存储在 `knowledge_base/engineering/`，通过 RAG 检索
  - 新增 `engineering_check` 节点插入 Planner → Execute 之间
  - **建议级**：注入执行上下文，不打断任务
  - **确认级**：注入确认问题，Executor 需在继续前检查
  - **阻断级**：暂停执行，返回处理步骤
  - 原则：平时不过度打扰，关键节点及时补充
- [x] **Checkpoint 节点**：语义对齐检查（已有，持续强化）
- [x] **高风险操作确认**：工程阻断级自动拦截
- [x] **产物一致性检查**：Reflector 增加 contract 合规性维度

### 4. 记住结果：项目交接卡

- [x] **交接卡按钮**：前端 UI（已完成）
- [x] **交接卡 API**：`POST /api/sessions/{id}/handover`
  - LLM 生成结构化交接卡：当前目标 / 已完成事项 / 已确认决策 / 未解决问题 / 下一步行动 / 关键文件 / 新发现的用户偏好 / 下次需验证的信息
  - 双格式支持：JSON（机器可读，用于恢复）+ Markdown（人类可读，用于存档）
  - `GET /api/sessions/{id}/handover/download?format=md|json` — 浏览器下载
  - `POST /api/sessions/import` — 上传交接卡文件恢复上下文
  - 规则降级：LLM 不可用时从对话记录提取关键字段
- [x] **上下文快照自动生成**：会话完成时自动触发交接卡（与手动触发共享逻辑）
- [x] **快照对比**：导入交接卡后自动生成上下文摘要，注入下一次对话

---

## 三、开发中：阶段二 — 记忆体系重构

### 三层记忆（精简版）

不再维护能力卡片体系。三层记忆的职责是：

| 层 | 名称 | 存什么 | 生命周期 | 当前 | 待做 |
|----|------|--------|---------|------|------|
| **L1** | 工作记忆 | 最近 3 轮原文 + 结构化字段（当前目标/阶段/待决问题/方案） | 单会话，任务结束自动清理 | 已有基础实现 | 增加结构化字段，任务闭环后压缩归档 |
| **L2** | 心智模型 | 用户偏好/技术栈/决策历史/沟通习惯 + 项目背景/架构/约束 | 跨会话持久化，长期演进 | L2 摘要 + L3 事实两个独立系统 | 合并为统一心智模型，每条事实带 source/confidence/updated_at |
| **L3** | 知识库 | 工程最佳实践/工具文档/领域知识 → RAG 检索 | 永久，版本管理 | V5 来源感知 RAG 已完成 | 扩充工程知识卡片，持续维护 |

### 待做：工作记忆结构化

- [ ] **结构化工作区**：将 L1 从纯窗口升级为结构化容器
  - `current_goal`: 当前任务目标（从 TaskContract 同步）
  - `current_phase`: 当前阶段（clarify / execute / review）
  - `pending_decisions`: 待用户决定的选项列表
  - `active_alternatives`: 正在对比的方案及其优缺点
  - 字段随图节点流转自动更新
- [ ] **任务闭环清理**：task_complete 时触发
  - 工作记忆 → 提取关键决策 → 写入心智模型
  - 工作记忆 → 提取待验证项 → 写入交接卡
  - 清理工作区，下个任务从空开始

### 待做：心智模型可信度与衰减

- [ ] **合并 L2 + L3**：将滚动摘要（L2）和语义事实（L3）合并为统一的心智模型
  - L2 摘要转为心智模型中的 `recent_context` 字段（压缩的最近会话脉络）
  - L3 事实转为心智模型中的原子条目，每条带完整元数据
- [ ] **每条事实增加元数据字段**：
  ```json
  {
    "fact": "用户偏好黑金暗色主题",
    "category": "preference | decision | constraint | tech_stack | project | habit",
    "source": "session_id 或 'inferred'",
    "confidence": 0.85,
    "created_at": "2026-07-20T...",
    "updated_at": "2026-07-23T...",
    "needs_verify": false,
    "verified_count": 3
  }
  ```
- [ ] **知识衰减机制**：
  - 超过 30 天未确认 → `needs_verify = true`，标注 ⚠️
  - 下次对话时轻量确认（"你之前偏好 X，现在还适用吗？"）
  - 确认后刷新 `updated_at` 和 `verified_count`
  - 用户明确否定的旧事实 → 软删除（`confidence = 0`，保留但不再召回）
- [ ] **用户偏好补充字段**：
  - `disliked_interactions`: 不希望 AI 做的交互方式（如"不要频繁追问"、"不要用 emoji"）
  - `trust_threshold`: 什么级别的操作可以直接做 vs 必须确认
  - `communication_style`: 简洁/详细/代码优先/先解释再给代码

### 待做：知识库扩充

- [ ] **工程知识卡片**：当前 4 张（git_security / python_deps / data_safety / api_credentials），持续扩充
  - 新增：代码审查 / 技术选型 / 团队协作 / CI/CD
- [ ] **工具/平台使用指南**：按来源感知 RAG 格式导入
  - 格式：source_title + source_url + 正文语义分块
  - 每条知识可追溯到原始出处
- [ ] **领域知识组织**：不再按 capability_card / best_practice / faq 分类
  - 按主题目录组织：`knowledge_base/engineering/` `knowledge_base/tools/` `knowledge_base/patterns/`
  - RAG 的 source_type 字段区分知识来源类型

---

## 四、已完成 (2026-07-23) — 阶段三：多 Agent 协作

### 多立场对比

- [x] **三立场 Agent Panel**：实用派/稳健派/创新派，并行运行
- [x] **阿福整合**：结构化对比输出（共识/分歧/代价/决策/推荐）
- [x] **触发规则**：仅用户明确要求 或 需求不明确但要求输出时触发
- [x] **对比渲染 UI**：对比卡片组件，高亮分歧点

### 协作路由

- [x] **交接材料自动生成**：交接卡可导出为 Markdown/JSON，作为外部 Agent 输入
- [ ] **外部 Agent 接入**（远期）：预留 Webhook/API 接口，让外部 Agent 回报结果

---

*最后更新: 2026-07-23*
