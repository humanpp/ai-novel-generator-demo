# v5/backend/app/routes/outlines.py
# 大纲相关API

from flask import Blueprint, request
from ..models.models import db, Novel, Outline, OutlineVersion
from ..services.outline_service import (
    generate_outline_dialogue,
    accept_outline_result,
    get_outline_content,
    update_outline_content,
    get_outline_versions,
    rollback_outline_version
)
from ..utils.response import success, error, not_found, bad_request
from ..utils.logger import get_logger
from datetime import datetime

logger = get_logger(__name__)

outlines_bp = Blueprint('outlines', __name__)

# 内存中的对话历史缓存（后续可持久化）
chat_sessions = {}


@outlines_bp.route('/api/novels/<int:novel_id>/outline/generate', methods=['POST'])
def generate_outline(novel_id):
    """开启AI对话生成大纲"""
    try:
        novel = Novel.query.get(novel_id)
        if not novel:
            return not_found('项目不存在')
        
        data = request.get_json()
        message = data.get('message', '')
        
        if not message:
            return bad_request('消息不能为空')
        
        # 获取或创建对话历史
        if novel_id not in chat_sessions:
            chat_sessions[novel_id] = []
        
        logger.info(f'开始生成大纲对话: novel_id={novel_id}')
        
        # 调用AI生成大纲
        ai_response = generate_outline_dialogue(novel, message, chat_sessions[novel_id])
        
        # 保存对话历史
        chat_sessions[novel_id].append({'role': 'user', 'content': message})
        chat_sessions[novel_id].append({'role': 'assistant', 'content': ai_response})
        
        logger.info(f'大纲对话生成成功: novel_id={novel_id}')
        return success({
            'response': ai_response,
            'session_id': novel_id
        })
    except Exception as e:
        logger.error(f'生成大纲对话失败: {e}')
        return error('生成大纲对话失败')


@outlines_bp.route('/api/novels/<int:novel_id>/outline/chat', methods=['POST'])
def chat_outline(novel_id):
    """大纲对话迭代"""
    try:
        novel = Novel.query.get(novel_id)
        if not novel:
            return not_found('项目不存在')
        
        data = request.get_json()
        message = data.get('message', '')
        
        if not message:
            return bad_request('消息不能为空')
        
        # 获取对话历史
        history = chat_sessions.get(novel_id, [])
        
        logger.info(f'大纲对话迭代: novel_id={novel_id}, history_count={len(history)}')
        
        # 调用AI
        ai_response = generate_outline_dialogue(novel, message, history)
        
        # 更新对话历史
        if novel_id not in chat_sessions:
            chat_sessions[novel_id] = []
        chat_sessions[novel_id].append({'role': 'user', 'content': message})
        chat_sessions[novel_id].append({'role': 'assistant', 'content': ai_response})
        
        logger.info(f'大纲对话迭代成功: novel_id={novel_id}')
        return success({
            'response': ai_response
        })
    except Exception as e:
        logger.error(f'大纲对话迭代失败: {e}')
        return error('大纲对话迭代失败')


@outlines_bp.route('/api/novels/<int:novel_id>/outline/accept', methods=['POST'])
def accept_outline(novel_id):
    """采纳当前对话结果"""
    try:
        novel = Novel.query.get(novel_id)
        if not novel:
            return not_found('项目不存在')
        
        # 获取最新的AI回复
        history = chat_sessions.get(novel_id, [])
        if not history:
            return bad_request('没有对话历史')
        
        # 找到最后一个AI回复
        ai_content = None
        for msg in reversed(history):
            if msg['role'] == 'assistant':
                ai_content = msg['content']
                break
        
        if not ai_content:
            return bad_request('没有AI生成的内容')
        
        logger.info(f'采纳大纲: novel_id={novel_id}')
        
        # 保存大纲
        accept_outline_result(novel, ai_content)
        
        # 清空对话历史
        chat_sessions[novel_id] = []
        
        logger.info(f'大纲采纳成功: novel_id={novel_id}')
        return success(message='大纲采纳成功')
    except Exception as e:
        logger.error(f'采纳大纲失败: {e}')
        return error('采纳大纲失败')


@outlines_bp.route('/api/novels/<int:novel_id>/outline', methods=['GET'])
def get_outline(novel_id):
    """获取大纲"""
    try:
        novel = Novel.query.get(novel_id)
        if not novel:
            return not_found('项目不存在')
        
        outline = Outline.query.filter_by(novel_id=novel_id).first()
        if not outline:
            logger.info(f'大纲尚未创建: novel_id={novel_id}')
            return success(None, '大纲尚未创建')
        
        logger.info(f'获取大纲: novel_id={novel_id}, version={outline.version}')
        return success({
            'id': outline.id,
            'content': outline.content,
            'version': outline.version
        })
    except Exception as e:
        logger.error(f'获取大纲失败: {e}')
        return error('获取大纲失败')


@outlines_bp.route('/api/novels/<int:novel_id>/outline', methods=['PUT'])
def update_outline(novel_id):
    """更新大纲（手动编辑）"""
    try:
        novel = Novel.query.get(novel_id)
        if not novel:
            return not_found('项目不存在')
        
        data = request.get_json()
        content = data.get('content', '')
        
        logger.info(f'更新大纲: novel_id={novel_id}')
        update_outline_content(novel, content)
        
        logger.info(f'大纲更新成功: novel_id={novel_id}')
        return success(message='大纲更新成功')
    except Exception as e:
        logger.error(f'更新大纲失败: {e}')
        return error('更新大纲失败')


@outlines_bp.route('/api/novels/<int:novel_id>/outline/versions', methods=['GET'])
def list_outline_versions(novel_id):
    """获取大纲版本列表"""
    try:
        novel = Novel.query.get(novel_id)
        if not novel:
            return not_found('项目不存在')
        
        versions = get_outline_versions(novel)
        
        logger.info(f'获取大纲版本列表: novel_id={novel_id}, count={len(versions)}')
        return success(versions)
    except Exception as e:
        logger.error(f'获取大纲版本列表失败: {e}')
        return error('获取大纲版本列表失败')


@outlines_bp.route('/api/novels/<int:novel_id>/outline/rollback', methods=['POST'])
def rollback_outline(novel_id):
    """回滚到指定版本"""
    try:
        novel = Novel.query.get(novel_id)
        if not novel:
            return not_found('项目不存在')
        
        data = request.get_json()
        version = data.get('version')
        
        if not version:
            return bad_request('版本号不能为空')
        
        logger.info(f'回滚大纲: novel_id={novel_id}, version={version}')
        rollback_outline_version(novel, version)
        
        logger.info(f'大纲回滚成功: novel_id={novel_id}, version={version}')
        return success(message=f'已回滚到版本 {version}')
    except Exception as e:
        logger.error(f'回滚大纲失败: {e}')
        return error('回滚大纲失败')


@outlines_bp.route('/api/novels/<int:novel_id>/outline/chat-history', methods=['GET'])
def get_outline_chat_history(novel_id):
    """获取对话历史"""
    try:
        novel = Novel.query.get(novel_id)
        if not novel:
            return not_found('项目不存在')
        
        history = chat_sessions.get(novel_id, [])
        
        logger.info(f'获取对话历史: novel_id={novel_id}, count={len(history)}')
        return success(history)
    except Exception as e:
        logger.error(f'获取对话历史失败: {e}')
        return error('获取对话历史失败')
