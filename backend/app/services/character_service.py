# v5/backend/app/services/character_service.py
# 角色服务

from flask import current_app
from ..models.models import db, Novel, Character
from ..llm.client import LLMClient
from ..utils.encryption import decrypt_api_key
from ..utils.json_parser import parse_llm_json_response
from .model_service import get_default_model
import json


def get_llm_client():
    """获取LLM客户端"""
    model = get_default_model()
    if not model:
        raise ValueError("未配置默认模型")
    
    api_key = decrypt_api_key(model.api_key) if model.api_key else ''
    
    config = {
        'base_url': model.base_url,
        'api_key': api_key,
        'model_name': model.model_name,
        'temperature': model.temperature,
        'max_tokens': model.max_tokens
    }
    return LLMClient(config)


def extract_characters_from_outline(novel):
    """从大纲/细纲/章节内容抽取角色"""
    try:
        client = get_llm_client()
        
        # 获取大纲内容
        outline_content = novel.outline.content if novel.outline else ''
        
        # 获取章节内容和细纲
        from ..models.models import Chapter, ChapterOutline, EventOutline
        
        chapters_content = ''
        outlines_content = ''
        
        if novel.workflow_mode == 'chapter':
            # 流程A：使用章节细纲和章节正文
            outlines = ChapterOutline.query.filter_by(novel_id=novel.id).all()
            outlines_content = '\n'.join([f"第{o.chapter_no}章细纲: {o.content}" for o in outlines if o.content])
            
            chapters = Chapter.query.filter_by(novel_id=novel.id).all()
            chapters_content = '\n'.join([f"第{c.chapter_no}章正文: {c.content[:2000] if c.content else '暂无'}" for c in chapters])
        else:
            # 流程B：使用事件链
            events = EventOutline.query.filter_by(novel_id=novel.id).all()
            outlines_content = '\n'.join([f"事件{e.event_no}: {e.title} - {e.description}" for e in events if e.description])
            
            chapters = Chapter.query.filter_by(novel_id=novel.id).all()
            chapters_content = '\n'.join([f"第{c.chapter_no}章正文: {c.content[:2000] if c.content else '暂无'}" for c in chapters])
        
        prompt = f"""请根据以下故事大纲、细纲和章节内容，提取所有出现的角色。

故事大纲：
{outline_content}

细纲/事件：
{outlines_content}

章节正文：
{chapters_content}

请严格按照以下JSON格式输出角色列表，不要添加任何其他文字：
[
  {{
    "name": "角色名",
    "gender": "性别",
    "personality": "性格描述",
    "background": "背景故事",
    "goal": "目标动机",
    "relations": [{{"target": "其他角色名", "relation": "关系描述"}}]
  }}
]

注意：
1. 提取所有在内容中出现的角色，包括主角、配角、反派等
2. 角色信息要根据内容推断，尽量详细完整
3. 关系要根据内容中的互动推断
4. 如果有多个来源的信息，请综合整理
5. 输出必须是有效的JSON格式"""
        
        response = client.complete(prompt)
        
        # 使用改进的JSON解析器
        characters_data = parse_llm_json_response(response, default=[])
        
        if not characters_data:
            current_app.logger.warning(f"LLM响应解析失败，原始响应: {response[:500]}")
        
        # 保存到数据库
        created_count = 0
        for char_data in characters_data:
            if not isinstance(char_data, dict):
                continue
                
            char_name = char_data.get('name', '').strip()
            if not char_name:
                continue
                
            # 检查是否已存在
            existing = Character.query.filter_by(
                novel_id=novel.id,
                name=char_name
            ).first()
            
            if not existing:
                # 处理relations字段
                relations = char_data.get('relations', [])
                if isinstance(relations, list):
                    relations_json = json.dumps(relations, ensure_ascii=False)
                else:
                    relations_json = '[]'
                
                character = Character(
                    novel_id=novel.id,
                    name=char_name,
                    gender=char_data.get('gender', ''),
                    personality=char_data.get('personality', ''),
                    background=char_data.get('background', ''),
                    goal=char_data.get('goal', ''),
                    relations=relations_json
                )
                db.session.add(character)
                created_count += 1
        
        db.session.commit()
        
        return {
            'total_characters': len(characters_data),
            'created_count': created_count,
            'message': '角色抽取成功'
        }
    except Exception as e:
        db.session.rollback()
        raise


def generate_character_logic_chains(novel):
    """生成角色逻辑链"""
    try:
        client = get_llm_client()
        
        # 获取大纲内容
        outline_content = novel.outline.content if novel.outline else ''
        
        # 获取角色列表
        characters = Character.query.filter_by(novel_id=novel.id).all()
        if not characters:
            return {'message': '没有角色，请先抽取角色'}
        
        # 获取章节细纲或事件
        detail_content = ''
        if novel.workflow_mode == 'chapter':
            from ..models.models import ChapterOutline
            outlines = ChapterOutline.query.filter_by(novel_id=novel.id).all()
            detail_content = '\n'.join([f"第{o.chapter_no}章: {o.content}" for o in outlines if o.content])
        else:
            from ..models.models import EventOutline
            events = EventOutline.query.filter_by(novel_id=novel.id).all()
            detail_content = '\n'.join([f"事件{e.event_no}: {e.title} - {e.description}" for e in events if e.description])
        
        # 构建角色信息
        characters_info = '\n'.join([
            f"- {c.name}: {c.personality or '未知性格'}, 背景: {c.background or '无'}, 目标: {c.goal or '无'}"
            for c in characters
        ])
        
        prompt = f"""请根据以下故事大纲、细纲/事件和角色信息，为每个角色生成逻辑链。

故事大纲：
{outline_content}

细纲/事件：
{detail_content}

角色列表：
{characters_info}

请为每个角色生成在每个章节/事件中的逻辑链，包括：
1. 动机（为什么这样做）
2. 变化（角色如何成长/改变）

请严格按照以下JSON格式输出，不要添加任何其他文字：
[
  {{
    "character_name": "角色名",
    "chapter_no": 1,
    "motivation": "角色在这一章的动机",
    "change": "角色在这一章的变化"
  }}
]

注意：
1. 每个角色在每个章节都应该有逻辑链
2. 动机要符合角色性格和目标
3. 变化要合理，体现角色成长"""
        
        response = client.complete(prompt)
        
        # 使用改进的JSON解析器
        logic_data = parse_llm_json_response(response, default=[])
        
        if not logic_data:
            current_app.logger.warning(f"LLM响应解析失败，原始响应: {response[:500]}")
        
        # 创建角色名到ID的映射
        char_map = {c.name: c.id for c in characters}
        
        # 保存到数据库
        created_count = 0
        for item in logic_data:
            if not isinstance(item, dict):
                continue
            char_name = item.get('character_name')
            if char_name in char_map:
                # 检查是否已存在
                existing = CharacterLogicChain.query.filter_by(
                    novel_id=novel.id,
                    character_id=char_map[char_name],
                    chapter_no=item.get('chapter_no')
                ).first()
                
                if not existing:
                    logic = CharacterLogicChain(
                        novel_id=novel.id,
                        character_id=char_map[char_name],
                        chapter_no=item.get('chapter_no'),
                        motivation=item.get('motivation', ''),
                        change=item.get('change', ''),
                        content=f"动机: {item.get('motivation', '')}\n变化: {item.get('change', '')}"
                    )
                    db.session.add(logic)
                    created_count += 1
        
        db.session.commit()
        
        return {
            'total_items': len(logic_data),
            'created_count': created_count,
            'message': '角色逻辑链生成成功'
        }
    except Exception as e:
        db.session.rollback()
        raise


def generate_mindmap_data(novel):
    """生成脑图数据"""
    try:
        characters = Character.query.filter_by(novel_id=novel.id).all()
        
        nodes = []
        links = []
        
        for char in characters:
            # 添加节点
            nodes.append({
                'id': str(char.id),
                'name': char.name,
                'gender': char.gender,
                'personality': char.personality[:50] if char.personality else ''
            })
            
            # 解析关系
            if char.relations:
                try:
                    relations = json.loads(char.relations)
                    for rel in relations:
                        target_name = rel.get('target')
                        # 查找目标角色
                        target_char = Character.query.filter_by(
                            novel_id=novel.id,
                            name=target_name
                        ).first()
                        
                        if target_char:
                            links.append({
                                'source': str(char.id),
                                'target': str(target_char.id),
                                'relation': rel.get('relation', '')
                            })
                except json.JSONDecodeError:
                    pass
        
        return {
            'nodes': nodes,
            'links': links
        }
    except Exception as e:
        raise