# v5/backend/app/services/outline_service.py
# 大纲服务

from flask import current_app
from ..models.models import db, Outline, OutlineVersion
from ..llm.client import LLMClient
from ..utils.encryption import decrypt_api_key


def get_llm_client():
    """获取LLM客户端"""
    from .model_service import get_default_model
    model = get_default_model()
    if not model:
        raise ValueError("未配置默认模型")
    
    # 解密API密钥
    api_key = decrypt_api_key(model.api_key) if model.api_key else ''
    
    config = {
        'base_url': model.base_url,
        'api_key': api_key,
        'model_name': model.model_name,
        'temperature': model.temperature,
        'max_tokens': model.max_tokens
    }
    return LLMClient(config)


def get_outline_system_prompt(genre, format_type):
    """获取大纲生成的系统提示词"""
    format_desc = "长篇小说" if format_type == "long" else "短篇小说"
    
    return f"""你是一位专业的{format_desc}大纲创作助手，擅长{genre}类型的故事创作。

你的任务是帮助作者构建一个完整、有深度的故事大纲。大纲应该包含：
1. 故事背景设定
2. 主要情节线
3. 关键转折点
4. 故事结局

请确保大纲：
- 逻辑连贯，前后呼应
- 有明确的起承转合
- 角色动机清晰
- 情节引人入胜

请用中文回复，使用Markdown格式。"""


def generate_outline_dialogue(novel, user_message, history_messages):
    """生成大纲对话"""
    try:
        client = get_llm_client()
        
        # 构建消息列表
        messages = [
            {"role": "system", "content": get_outline_system_prompt(novel.genre, novel.format)}
        ]
        
        # 添加历史消息
        for msg in history_messages:
            messages.append(msg)
        
        # 添加用户消息
        messages.append({"role": "user", "content": user_message})
        
        # 调用LLM
        response = client.chat(messages)
        
        return response
    except Exception as e:
        current_app.logger.error(f"生成大纲对话失败: {e}")
        raise


def accept_outline_result(novel, accepted_content):
    """采纳大纲结果"""
    try:
        outline = Outline.query.filter_by(novel_id=novel.id).first()
        
        if not outline:
            # 创建新大纲
            outline = Outline(novel_id=novel.id, content=accepted_content, version=1)
            db.session.add(outline)
        else:
            # 保存当前版本
            if outline.content:
                version = OutlineVersion(
                    outline_id=outline.id,
                    version=outline.version,
                    content=outline.content
                )
                db.session.add(version)
            
            # 更新大纲
            outline.content = accepted_content
            outline.version += 1
        
        db.session.commit()
        return outline
    except Exception as e:
        db.session.rollback()
        raise


def get_outline_content(novel):
    """获取大纲内容"""
    outline = Outline.query.filter_by(novel_id=novel.id).first()
    if outline:
        return {
            'id': outline.id,
            'content': outline.content,
            'version': outline.version
        }
    return None


def update_outline_content(novel, content):
    """更新大纲内容（手动编辑）"""
    try:
        outline = Outline.query.filter_by(novel_id=novel.id).first()
        
        if not outline:
            outline = Outline(novel_id=novel.id, content=content, version=1)
            db.session.add(outline)
        else:
            # 保存当前版本
            if outline.content:
                version = OutlineVersion(
                    outline_id=outline.id,
                    version=outline.version,
                    content=outline.content
                )
                db.session.add(version)
            
            outline.content = content
            outline.version += 1
        
        db.session.commit()
        return outline
    except Exception as e:
        db.session.rollback()
        raise


def get_outline_versions(novel):
    """获取大纲版本列表"""
    outline = Outline.query.filter_by(novel_id=novel.id).first()
    if not outline:
        return []
    
    versions = OutlineVersion.query.filter_by(outline_id=outline.id)\
        .order_by(OutlineVersion.version.desc()).all()
    
    # 添加当前版本
    result = [{
        'version': outline.version,
        'content': outline.content,
        'is_current': True,
        'created_at': None
    }]
    
    for v in versions:
        result.append({
            'version': v.version,
            'content': v.content,
            'is_current': False,
            'created_at': v.created_at.isoformat() if v.created_at else None
        })
    
    return result


def rollback_outline_version(novel, version_num):
    """回滚到指定版本"""
    try:
        outline = Outline.query.filter_by(novel_id=novel.id).first()
        if not outline:
            raise ValueError("大纲不存在")
        
        # 如果是当前版本，直接返回
        if outline.version == version_num:
            return outline
        
        # 查找指定版本
        if version_num < outline.version:
            # 从版本历史中查找
            version = OutlineVersion.query.filter_by(
                outline_id=outline.id,
                version=version_num
            ).first()
            
            if not version:
                raise ValueError(f"版本 {version_num} 不存在")
            
            # 保存当前版本
            current_version = OutlineVersion(
                outline_id=outline.id,
                version=outline.version,
                content=outline.content
            )
            db.session.add(current_version)
            
            # 回滚
            outline.content = version.content
            outline.version = version_num
        else:
            raise ValueError("无效的版本号")
        
        db.session.commit()
        return outline
    except Exception as e:
        db.session.rollback()
        raise