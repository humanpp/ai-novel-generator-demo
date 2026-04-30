# v5/backend/app/services/chapter_service.py
# 章节服务

from flask import current_app
from ..models.models import (
    db, Novel, Chapter, ChapterOutline, EventOutline,
    ChapterVersion, ChapterEventMapping, CharacterLogicChain
)
from ..llm.client import LLMClient
from ..utils.encryption import decrypt_api_key
from ..utils.json_parser import parse_llm_json_response
from .model_service import get_default_model


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


def generate_chapter_outlines(novel, params):
    """生成章节细纲（流程A）"""
    try:
        total_chapters = params.get('total_chapters', 10)
        word_count_per_chapter = params.get('word_count_per_chapter', 3000)
        
        client = get_llm_client()
        
        # 获取大纲内容
        outline_content = novel.outline.content if novel.outline else ''
        
        prompt = f"""基于以下故事大纲，生成{total_chapters}章的章节细纲。

故事大纲：
{outline_content}

要求：
1. 每章目标字数：{word_count_per_chapter}字
2. 每章包含：情节要点、出场角色、关键事件
3. 章节之间要有连贯性
4. 节奏要有起伏

请严格按照以下JSON格式输出，不要添加任何其他文字：
[
  {{
    "chapter_no": 1,
    "title": "章节标题",
    "content": "章节细纲内容",
    "word_count": {word_count_per_chapter}
  }}
]"""
        
        response = client.complete(prompt)
        
        # 使用改进的JSON解析器
        chapters_data = parse_llm_json_response(response, default=[])
        
        if not chapters_data:
            current_app.logger.warning(f"LLM响应解析失败，原始响应: {response[:500]}")
        
        # 保存到数据库
        for ch_data in chapters_data:
            if not isinstance(ch_data, dict):
                continue
            outline = ChapterOutline(
                novel_id=novel.id,
                chapter_no=ch_data.get('chapter_no'),
                word_count=ch_data.get('word_count', word_count_per_chapter),
                content=ch_data.get('content', '')
            )
            db.session.add(outline)
        
        db.session.commit()
        
        return {
            'total_chapters': len(chapters_data),
            'message': '章节细纲生成成功'
        }
    except Exception as e:
        db.session.rollback()
        raise


def generate_single_chapter_outline(novel, chapter_no):
    """生成单章细纲（需要先有章节）"""
    try:
        client = get_llm_client()
        
        # 获取大纲内容
        outline_content = novel.outline.content if novel.outline else ''
        
        # 获取章节信息
        chapter = Chapter.query.filter_by(novel_id=novel.id, chapter_no=chapter_no).first()
        if not chapter:
            raise ValueError(f'章节{chapter_no}不存在')
        
        # 获取前后章节细纲（用于保持连贯性）
        prev_outline = ChapterOutline.query.filter_by(
            novel_id=novel.id, chapter_no=chapter_no - 1
        ).first()
        next_outline = ChapterOutline.query.filter_by(
            novel_id=novel.id, chapter_no=chapter_no + 1
        ).first()
        
        prompt = f"""基于以下故事大纲，生成第{chapter_no}章的详细章节细纲。

故事大纲：
{outline_content}

章节标题：{chapter.title}

前一章细纲（如有）：
{prev_outline.content if prev_outline else '无'}

后一章细纲（如有）：
{next_outline.content if next_outline else '无'}

要求：
1. 生成详细的章节细纲，包括情节要点、出场角色、关键事件
2. 与前后章节保持连贯性
3. 内容要具体，便于后续生成章节正文

请直接输出章节细纲内容，不需要JSON格式。"""
        
        response = client.complete(prompt)
        
        # 更新或创建章节细纲
        outline = ChapterOutline.query.filter_by(
            novel_id=novel.id, chapter_no=chapter_no
        ).first()
        
        if outline:
            outline.content = response
            outline.word_count = len(response)
        else:
            outline = ChapterOutline(
                novel_id=novel.id,
                chapter_no=chapter_no,
                content=response,
                word_count=len(response)
            )
            db.session.add(outline)
        
        db.session.commit()
        
        return {
            'chapter_no': chapter_no,
            'content': response,
            'word_count': len(response),
            'message': '章节细纲生成成功'
        }
    except Exception as e:
        db.session.rollback()
        raise


def regenerate_single_outline(novel, chapter_no):
    """重新生成单章细纲"""
    try:
        client = get_llm_client()
        
        # 获取大纲和相邻章节
        outline_content = novel.outline.content if novel.outline else ''
        
        # 获取前后章节
        prev_outline = ChapterOutline.query.filter_by(
            novel_id=novel.id, chapter_no=chapter_no - 1
        ).first()
        next_outline = ChapterOutline.query.filter_by(
            novel_id=novel.id, chapter_no=chapter_no + 1
        ).first()
        
        prompt = f"""重新生成第{chapter_no}章的章节细纲。

故事大纲：
{outline_content}

前一章细纲（如有）：
{prev_outline.content if prev_outline else '无'}

后一章细纲（如有）：
{next_outline.content if next_outline else '无'}

请生成详细的章节细纲，包括情节要点、出场角色、关键事件。"""
        
        response = client.complete(prompt)
        
        # 更新或创建
        outline = ChapterOutline.query.filter_by(
            novel_id=novel.id, chapter_no=chapter_no
        ).first()
        
        if outline:
            outline.content = response
        else:
            outline = ChapterOutline(
                novel_id=novel.id,
                chapter_no=chapter_no,
                content=response
            )
            db.session.add(outline)
        
        db.session.commit()
        
        return {
            'chapter_no': chapter_no,
            'content': response,
            'message': '章节细纲重新生成成功'
        }
    except Exception as e:
        db.session.rollback()
        raise


def generate_event_chain(novel):
    """生成事件链（流程B）"""
    try:
        client = get_llm_client()
        
        outline_content = novel.outline.content if novel.outline else ''
        
        prompt = f"""基于以下故事大纲，生成因果相连的事件链。

故事大纲：
{outline_content}

要求：
1. 事件之间要有明确的因果关系
2. 每个事件包含：标题、描述、前因、后果
3. 事件要推动故事发展
4. 避免逻辑矛盾

请严格按照以下JSON格式输出，不要添加任何其他文字：
[
  {{
    "event_no": 1,
    "title": "事件标题",
    "description": "事件描述",
    "cause": "前因",
    "effect": "后果",
    "related_characters": "关联角色"
  }}
]"""
        
        response = client.complete(prompt)
        
        # 使用改进的JSON解析器
        events_data = parse_llm_json_response(response, default=[])
        
        if not events_data:
            current_app.logger.warning(f"LLM响应解析失败，原始响应: {response[:500]}")
        
        # 保存到数据库
        for ev_data in events_data:
            if not isinstance(ev_data, dict):
                continue
            event = EventOutline(
                novel_id=novel.id,
                event_no=ev_data.get('event_no'),
                title=ev_data.get('title', ''),
                description=ev_data.get('description', ''),
                cause=ev_data.get('cause', ''),
                effect=ev_data.get('effect', ''),
                related_characters=ev_data.get('related_characters', '')
            )
            db.session.add(event)
        
        db.session.commit()
        
        return {
            'total_events': len(events_data),
            'message': '事件链生成成功'
        }
    except Exception as e:
        db.session.rollback()
        raise


def regenerate_single_event(novel, event_no):
    """重新生成单个事件"""
    try:
        client = get_llm_client()
        
        # 获取大纲内容
        outline_content = novel.outline.content if novel.outline else ''
        
        # 获取相邻事件
        prev_event = EventOutline.query.filter_by(
            novel_id=novel.id, event_no=event_no - 1
        ).first()
        next_event = EventOutline.query.filter_by(
            novel_id=novel.id, event_no=event_no + 1
        ).first()
        
        # 获取当前事件
        current_event = EventOutline.query.filter_by(
            novel_id=novel.id, event_no=event_no
        ).first()
        
        prompt = f"""重新生成第{event_no}个事件。

故事大纲：
{outline_content}

前一事件（如有）：
{f"事件：{prev_event.title}\n{prev_event.description}" if prev_event else '无'}

后一事件（如有）：
{f"事件：{next_event.title}\n{next_event.description}" if next_event else '无'}

当前事件信息：
{f"标题：{current_event.title}\n描述：{current_event.description}" if current_event else '无'}

请生成一个详细的事件，包含：
1. 事件标题
2. 事件描述
3. 前因（导致此事件的原因）
4. 后果（此事件导致的结果）
5. 关联角色

请以JSON格式输出：
{{
    "title": "事件标题",
    "description": "事件描述",
    "cause": "前因",
    "effect": "后果",
    "related_characters": "关联角色"
}}"""
        
        response = client.complete(prompt)
        
        import json
        try:
            event_data = json.loads(response)
        except json.JSONDecodeError as e:
            current_app.logger.warning(f"LLM响应JSON解析失败: {e}")
            event_data = {
                'title': f'事件 {event_no}',
                'description': response,
                'cause': '',
                'effect': '',
                'related_characters': ''
            }
        
        # 更新或创建事件
        if current_event:
            current_event.title = event_data.get('title', current_event.title)
            current_event.description = event_data.get('description', current_event.description)
            current_event.cause = event_data.get('cause', current_event.cause)
            current_event.effect = event_data.get('effect', current_event.effect)
            current_event.related_characters = event_data.get('related_characters', current_event.related_characters)
        else:
            current_event = EventOutline(
                novel_id=novel.id,
                event_no=event_no,
                title=event_data.get('title', ''),
                description=event_data.get('description', ''),
                cause=event_data.get('cause', ''),
                effect=event_data.get('effect', ''),
                related_characters=event_data.get('related_characters', '')
            )
            db.session.add(current_event)
        
        db.session.commit()
        
        return {
            'event_no': event_no,
            'title': current_event.title,
            'description': current_event.description,
            'message': '事件重新生成成功'
        }
    except Exception as e:
        db.session.rollback()
        raise


def auto_map_events_to_chapters(novel):
    """自动映射事件到章节"""
    try:
        events = EventOutline.query.filter_by(novel_id=novel.id)\
            .order_by(EventOutline.event_no).all()
        
        if not events:
            return {'message': '没有事件可映射'}
        
        # 获取或创建章节
        chapters = Chapter.query.filter_by(novel_id=novel.id)\
            .order_by(Chapter.chapter_no).all()
        
        # 如果没有章节，根据事件数量创建
        if not chapters:
            # 假设每章包含2-3个事件
            chapter_count = max(1, len(events) // 2)
            for i in range(1, chapter_count + 1):
                chapter = Chapter(
                    novel_id=novel.id,
                    chapter_no=i,
                    title=f'第{i}章'
                )
                db.session.add(chapter)
            db.session.flush()
            chapters = Chapter.query.filter_by(novel_id=novel.id)\
                .order_by(Chapter.chapter_no).all()
        
        # 清除现有映射
        for chapter in chapters:
            ChapterEventMapping.query.filter_by(chapter_id=chapter.id).delete()
        
        # 平均分配事件到章节
        events_per_chapter = len(events) / len(chapters)
        for i, event in enumerate(events):
            chapter_idx = int(i / events_per_chapter)
            chapter_idx = min(chapter_idx, len(chapters) - 1)
            
            mapping = ChapterEventMapping(
                chapter_id=chapters[chapter_idx].id,
                event_id=event.id,
                sort_order=i
            )
            db.session.add(mapping)
        
        db.session.commit()
        
        return {
            'chapters_count': len(chapters),
            'events_count': len(events),
            'message': '事件映射完成'
        }
    except Exception as e:
        db.session.rollback()
        raise


def generate_chapter_content(novel, chapter_no):
    """生成章节正文"""
    try:
        client = get_llm_client()
        
        # 获取大纲
        outline_content = novel.outline.content if novel.outline else ''
        
        # 获取章节细纲或事件
        if novel.workflow_mode == 'chapter':
            # 流程A：使用章节细纲
            chapter_outline = ChapterOutline.query.filter_by(
                novel_id=novel.id, chapter_no=chapter_no
            ).first()
            detail_content = chapter_outline.content if chapter_outline else ''
        else:
            # 流程B：使用事件映射
            chapter = Chapter.query.filter_by(
                novel_id=novel.id, chapter_no=chapter_no
            ).first()
            
            if chapter:
                mappings = ChapterEventMapping.query.filter_by(
                    chapter_id=chapter.id
                ).order_by(ChapterEventMapping.sort_order).all()
                
                events = []
                for m in mappings:
                    event = EventOutline.query.get(m.event_id)
                    if event:
                        events.append(f"事件：{event.title}\n{event.description}")
                detail_content = '\n\n'.join(events)
            else:
                detail_content = ''
        
        # 获取角色逻辑链
        logic_chains = CharacterLogicChain.query.filter_by(
            novel_id=novel.id, chapter_no=chapter_no
        ).all()
        
        logic_content = ''
        for lc in logic_chains:
            logic_content += f"\n角色{lc.character_id}: 动机={lc.motivation}, 变化={lc.change}"
        
        prompt = f"""请根据以下信息生成第{chapter_no}章的小说正文。

故事大纲：
{outline_content}

章节细纲/事件：
{detail_content}

角色逻辑链：
{logic_content}

要求：
1. 文笔流畅，符合网文风格
2. 情节紧凑，节奏明快
3. 角色性格一致
4. 细节描写丰富
5. 章节结尾要有悬念或转折"""
        
        content = client.complete(prompt)
        
        # 保存或更新章节
        chapter = Chapter.query.filter_by(
            novel_id=novel.id, chapter_no=chapter_no
        ).first()
        
        if not chapter:
            chapter = Chapter(
                novel_id=novel.id,
                chapter_no=chapter_no,
                title=f'第{chapter_no}章',
                content=content,
                word_count=len(content)
            )
            db.session.add(chapter)
        else:
            # 保存旧版本
            if chapter.content:
                current_version = ChapterVersion.query.filter_by(
                    chapter_id=chapter.id
                ).order_by(ChapterVersion.version.desc()).first()
                
                new_version_num = (current_version.version + 1) if current_version else 1
                
                version = ChapterVersion(
                    chapter_id=chapter.id,
                    version=new_version_num,
                    content=chapter.content,
                    word_count=chapter.word_count
                )
                db.session.add(version)
            
            chapter.content = content
            chapter.word_count = len(content)
        
        db.session.commit()
        
        return {
            'chapter_no': chapter_no,
            'word_count': len(content),
            'message': '章节正文生成成功'
        }
    except Exception as e:
        db.session.rollback()
        raise


def batch_generate_chapters(novel, chapter_numbers):
    """批量生成章节"""
    from ..routes.tasks import create_task
    
    def generate_task():
        results = []
        for ch_no in chapter_numbers:
            try:
                result = generate_chapter_content(novel, ch_no)
                results.append(result)
            except Exception as e:
                results.append({
                    'chapter_no': ch_no,
                    'error': str(e)
                })
        return results
    
    task_id = create_task('batch_generate', novel.id, generate_task)
    
    return {
        'task_id': task_id,
        'chapter_count': len(chapter_numbers),
        'message': '批量生成任务已提交'
    }