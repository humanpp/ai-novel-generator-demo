# v5/backend/app/routes/event_outlines.py
# 事件细纲API（流程B）

from flask import Blueprint, request
from ..models.models import db, Novel, EventOutline
from ..services.chapter_service import generate_event_chain, regenerate_single_event
from ..utils.response import success, error, created, not_found, bad_request, task_submitted
from ..utils.logger import get_logger
from .tasks import create_task

logger = get_logger(__name__)

event_outlines_bp = Blueprint('event_outlines', __name__)


@event_outlines_bp.route('/api/novels/<int:novel_id>/event-outlines/generate', methods=['POST'])
def generate_event_outlines(novel_id):
    """生成事件细纲"""
    try:
        novel = Novel.query.get(novel_id)
        if not novel:
            return not_found('项目不存在')
        
        logger.info(f'开始生成事件链: novel_id={novel_id}')
        
        # 定义异步任务函数
        def generate_task():
            novel_obj = db.session.get(Novel, novel_id)
            if not novel_obj:
                raise ValueError('项目不存在')
            return generate_event_chain(novel_obj)
        
        task_id = create_task('generate_event_chain', novel_id, generate_task)
        
        logger.info(f'事件链生成任务已提交: task_id={task_id}')
        return task_submitted(task_id, '事件链生成任务已提交')
    except Exception as e:
        logger.error(f'提交事件链生成任务失败: {e}')
        return error('提交事件链生成任务失败')


@event_outlines_bp.route('/api/novels/<int:novel_id>/event-outlines', methods=['GET'])
def list_event_outlines(novel_id):
    """获取事件细纲列表"""
    try:
        novel = Novel.query.get(novel_id)
        if not novel:
            return not_found('项目不存在')
        
        events = EventOutline.query.filter_by(novel_id=novel_id)\
            .order_by(EventOutline.event_no).all()
        
        logger.info(f'获取事件列表: novel_id={novel_id}, count={len(events)}')
        return success([{
            'id': e.id,
            'event_no': e.event_no,
            'title': e.title,
            'description': e.description,
            'cause': e.cause,
            'effect': e.effect,
            'related_characters': e.related_characters
        } for e in events])
    except Exception as e:
        logger.error(f'获取事件列表失败: {e}')
        return error('获取事件列表失败')


@event_outlines_bp.route('/api/novels/<int:novel_id>/event-outlines/<int:ev_no>', methods=['GET'])
def get_event_outline(novel_id, ev_no):
    """获取单个事件"""
    try:
        event = EventOutline.query.filter_by(novel_id=novel_id, event_no=ev_no).first()
        if not event:
            return not_found('事件不存在')
        
        logger.info(f'获取单个事件: novel_id={novel_id}, event_no={ev_no}')
        return success({
            'id': event.id,
            'event_no': event.event_no,
            'title': event.title,
            'description': event.description,
            'cause': event.cause,
            'effect': event.effect,
            'related_characters': event.related_characters
        })
    except Exception as e:
        logger.error(f'获取单个事件失败: {e}')
        return error('获取单个事件失败')


@event_outlines_bp.route('/api/novels/<int:novel_id>/event-outlines/<int:ev_no>', methods=['PUT'])
def update_event_outline(novel_id, ev_no):
    """更新事件"""
    try:
        event = EventOutline.query.filter_by(novel_id=novel_id, event_no=ev_no).first()
        if not event:
            return not_found('事件不存在')
        
        data = request.get_json()
        
        if 'title' in data:
            event.title = data['title']
        if 'description' in data:
            event.description = data['description']
        if 'cause' in data:
            event.cause = data['cause']
        if 'effect' in data:
            event.effect = data['effect']
        if 'related_characters' in data:
            event.related_characters = data['related_characters']
        
        db.session.commit()
        
        logger.info(f'事件更新成功: novel_id={novel_id}, event_no={ev_no}')
        return success(message='事件更新成功')
    except Exception as e:
        db.session.rollback()
        logger.error(f'更新事件失败: {e}')
        return error('更新事件失败')


@event_outlines_bp.route('/api/novels/<int:novel_id>/event-outlines/<int:ev_no>', methods=['DELETE'])
def delete_event_outline(novel_id, ev_no):
    """删除事件"""
    try:
        event = EventOutline.query.filter_by(novel_id=novel_id, event_no=ev_no).first()
        if not event:
            return not_found('事件不存在')
        
        db.session.delete(event)
        db.session.commit()
        
        logger.info(f'事件删除成功: novel_id={novel_id}, event_no={ev_no}')
        return success(message='事件删除成功')
    except Exception as e:
        db.session.rollback()
        logger.error(f'删除事件失败: {e}')
        return error('删除事件失败')


@event_outlines_bp.route('/api/novels/<int:novel_id>/event-outlines/<int:ev_no>/regenerate', methods=['POST'])
def regenerate_event_outline(novel_id, ev_no):
    """重新生成事件"""
    try:
        novel = Novel.query.get(novel_id)
        if not novel:
            return not_found('项目不存在')
        
        logger.info(f'开始重新生成事件: novel_id={novel_id}, event_no={ev_no}')
        
        # 定义异步任务函数
        def regenerate_task():
            novel_obj = db.session.get(Novel, novel_id)
            if not novel_obj:
                raise ValueError('项目不存在')
            return regenerate_single_event(novel_obj, ev_no)
        
        task_id = create_task('regenerate_event', novel_id, regenerate_task)
        
        logger.info(f'事件重新生成任务已提交: task_id={task_id}, event_no={ev_no}')
        return task_submitted(task_id, '事件重新生成任务已提交')
    except Exception as e:
        logger.error(f'提交事件重新生成任务失败: {e}')
        return error('提交事件重新生成任务失败')


@event_outlines_bp.route('/api/novels/<int:novel_id>/event-outlines/reorder', methods=['PUT'])
def reorder_event_outlines(novel_id):
    """批量更新事件顺序"""
    try:
        novel = Novel.query.get(novel_id)
        if not novel:
            return not_found('项目不存在')
        
        data = request.get_json()
        event_ids = data.get('event_ids', [])
        
        # 更新事件序号
        for order, event_id in enumerate(event_ids):
            event = EventOutline.query.get(event_id)
            if event and event.novel_id == novel_id:
                event.event_no = order + 1
        
        db.session.commit()
        
        logger.info(f'事件顺序更新成功: novel_id={novel_id}, count={len(event_ids)}')
        return success(message='事件顺序更新成功')
    except Exception as e:
        db.session.rollback()
        logger.error(f'更新事件顺序失败: {e}')
        return error('更新事件顺序失败')
