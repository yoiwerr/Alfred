"""
项目交接卡 API。

POST   /api/sessions/{id}/handover        — 生成交接卡 (返回 JSON)
GET    /api/sessions/{id}/handover/download — 下载交接卡文件 (JSON 或 MD)
POST   /api/sessions/import                — 上传交接卡恢复工作状态
"""

import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, Query
from fastapi.responses import PlainTextResponse, JSONResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["Handover"])

# Agent 实例由 app.py 注入
_agent = None


def set_agent(agent):
    global _agent
    _agent = agent


# ============================================================
# 生成交接卡
# ============================================================

@router.post("/{session_id}/handover")
async def generate_handover(session_id: str):
    """
    为指定会话生成项目交接卡。

    返回 JSON:
    {
      "meta": {...},
      "current_goal": "...",
      "completed": [...],
      "decisions": [...],
      "open_issues": [...],
      "next_steps": [...],
      "key_files": [...],
      "user_preferences": [...],
      "verify_next_time": [...]
    }
    """
    if _agent is None:
        raise HTTPException(status_code=503, detail="Agent 未初始化")

    session = _agent.sessions.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话不存在: {session_id}")

    # 获取该会话的契约
    contract = None
    if _agent.contract_store:
        row = _agent.contract_store.get_latest(session_id)
        if row:
            contract = row.get("contract", {})

    # 创建 HandoverService 并生成
    from services.handover_service import HandoverService
    svc = HandoverService(model=_agent.model)

    handover = await svc.generate(
        session_id=session_id,
        session_store=_agent.sessions,
        contract=contract,
    )

    return JSONResponse(content=handover)


# ============================================================
# 下载交接卡文件
# ============================================================

@router.get("/{session_id}/handover/download")
async def download_handover(
    session_id: str,
    frmt: str = Query(default="md", alias="format", description="md | json"),
):
    """
    下载交接卡文件。

    GET /api/sessions/{id}/handover/download?format=md  → .md 文件
    GET /api/sessions/{id}/handover/download?format=json → .json 文件
    """
    if _agent is None:
        raise HTTPException(status_code=503, detail="Agent 未初始化")

    session = _agent.sessions.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话不存在: {session_id}")

    contract = None
    if _agent.contract_store:
        row = _agent.contract_store.get_latest(session_id)
        if row:
            contract = row.get("contract", {})

    from services.handover_service import HandoverService
    svc = HandoverService(model=_agent.model)

    handover = await svc.generate(
        session_id=session_id,
        session_store=_agent.sessions,
        contract=contract,
    )

    session_title = (session.get("title") or "新对话").replace(" ", "_")[:30]

    if frmt == "json":
        content = HandoverService.to_json_str(handover)
        filename = f"alfred_handover_{session_id}_{session_title}.json"
        return PlainTextResponse(
            content=content,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    else:
        content = HandoverService.to_markdown(handover)
        filename = f"alfred_handover_{session_id}_{session_title}.md"
        return PlainTextResponse(
            content=content,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )


# ============================================================
# 导入交接卡
# ============================================================

@router.post("/import")
async def import_handover(
    file: UploadFile = File(...),
):
    """
    上传交接卡文件（.md 或 .json），解析后返回上下文注入文本。

    前端收到后可将此文本作为 extra_context 传入下一次对话。
    """
    if _agent is None:
        raise HTTPException(status_code=503, detail="Agent 未初始化")

    # 读取文件
    try:
        raw = await file.read()
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = raw.decode("gbk")
        except Exception:
            raise HTTPException(status_code=400, detail="无法解码文件，请使用 UTF-8 编码")

    if not text or len(text) < 20:
        raise HTTPException(status_code=400, detail="文件内容过短")

    # 解析
    from services.handover_service import HandoverService
    handover = HandoverService.parse_from_text(text)

    if not handover:
        raise HTTPException(status_code=400, detail="无法从文件中解析交接卡格式")

    # 转为上下文文本
    context_text = HandoverService.to_context_string(handover)

    logger.info(f"[Handover] 导入成功 session={handover.get('meta', {}).get('session_id', '?')}")

    return JSONResponse(content={
        "ok": True,
        "handover": handover,
        "context_text": context_text,
        "format": "json" if file.filename and file.filename.endswith(".json") else "markdown",
        "filename": file.filename,
    })
