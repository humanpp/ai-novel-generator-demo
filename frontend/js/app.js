// v5/frontend/js/app.js
// 主入口文件

const App = {
    // 初始化
    init() {
        console.log('AI小说生成器初始化...');
        
        // 初始化组件
        ProjectManager.init();
        StatsBar.init();
        
        // 绑定全局事件
        this.bindGlobalEvents();
        
        // 初始化步骤切换
        this.initSteps();
        
        // 初始化侧边栏状态
        this.initSidebar();
        
        // 更新模型指示器
        this.updateModelIndicator();
        
        console.log('初始化完成');
    },
    
    // 工具函数：HTML转义
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // 初始化侧边栏
    initSidebar() {
        const sidebar = document.getElementById('sidebar');
        const btnToggle = document.getElementById('btn-toggle-sidebar');
        
        if (sidebar && btnToggle) {
            // 根据侧边栏状态设置按钮位置
            this.updateSidebarToggleBtn();
        }
    },
    
    // 更新侧边栏切换按钮位置
    updateSidebarToggleBtn() {
        const sidebar = document.getElementById('sidebar');
        const btnToggle = document.getElementById('btn-toggle-sidebar');
        
        if (sidebar && btnToggle) {
            const icon = btnToggle.querySelector('i');
            if (sidebar.classList.contains('collapsed')) {
                btnToggle.style.left = '0';
                icon.className = 'bi bi-chevron-right';
            } else {
                btnToggle.style.left = 'var(--sidebar-width)';
                icon.className = 'bi bi-chevron-left';
            }
        }
    },
    
    // 跳转到项目管理
    goToProjects() {
        ProjectManager.backToList();
    },
    
    // 绑定全局事件
    bindGlobalEvents() {
        // 侧边栏切换
        const btnToggle = document.getElementById('btn-toggle-sidebar');
        if (btnToggle) {
            btnToggle.addEventListener('click', () => {
                const sidebar = document.getElementById('sidebar');
                sidebar.classList.toggle('collapsed');
                this.updateSidebarToggleBtn();
            });
        }
        
        // 大纲编辑按钮
        const btnOutline = document.getElementById('btn-outline-editor');
        if (btnOutline) {
            btnOutline.addEventListener('click', () => this.showOutlineEditor());
        }
        
        // 大纲版本按钮
        const btnOutlineVersions = document.getElementById('btn-outline-versions');
        if (btnOutlineVersions) {
            btnOutlineVersions.addEventListener('click', () => this.showOutlineVersions());
        }
        
        // 角色列表按钮
        const btnCharacters = document.getElementById('btn-characters');
        if (btnCharacters) {
            btnCharacters.addEventListener('click', () => this.showCharacters());
        }
        
        // 角色脑图按钮
        const btnMindmap = document.getElementById('btn-mindmap');
        if (btnMindmap) {
            btnMindmap.addEventListener('click', () => this.showMindmap());
        }
        
        // 导入按钮
        const btnImport = document.getElementById('btn-import');
        if (btnImport) {
            btnImport.addEventListener('click', () => this.showImport());
        }
        
        // 导出按钮
        const btnExport = document.getElementById('btn-export');
        if (btnExport) {
            btnExport.addEventListener('click', () => this.showExport());
        }
        
        // 添加章节按钮
        const btnAddChapter = document.getElementById('btn-add-chapter');
        if (btnAddChapter) {
            btnAddChapter.addEventListener('click', () => this.addChapter());
        }
        
        // 页面关闭前停止计时
        window.addEventListener('beforeunload', () => {
            StatsBar.stopWriting();
        });
    },
    
    // 初始化步骤
    initSteps() {
        const steps = document.querySelectorAll('.step');
        steps.forEach(step => {
            step.addEventListener('click', () => {
                const stepName = step.dataset.step;
                StateManager.set('currentStep', stepName);
                this.renderStep(stepName);
            });
        });
        
        // 订阅步骤变化
        StateManager.subscribe('currentStep', (step) => {
            this.updateStepsUI(step);
            this.renderStep(step);
        });
    },
    
    // 隐藏模态框
    hideModal() {
        const modalEl = document.getElementById('mainModal');
        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) {
                modal.hide();
            }
        }
        // 移除所有遮罩
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        // 移除body的modal-open类
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('padding-right');
        document.body.style.removeProperty('overflow');
    },
    
    // 更新步骤UI
    updateStepsUI(currentStep) {
        const steps = document.querySelectorAll('.step');
        const stepNames = ['outline', 'detail', 'characters', 'chapters'];
        const currentIndex = stepNames.indexOf(currentStep);
        
        steps.forEach((step, index) => {
            step.classList.remove('active', 'completed');
            if (index < currentIndex) {
                step.classList.add('completed');
            } else if (index === currentIndex) {
                step.classList.add('active');
            }
        });
    },
    
    // 显示大纲编辑器
    showOutlineEditor() {
        const project = StateManager.get('currentProject');
        if (!project) {
            alert('请先选择一个项目');
            return;
        }
        StateManager.set('currentStep', 'outline');
    },
    
    // 显示角色列表
    showCharacters() {
        const project = StateManager.get('currentProject');
        if (!project) {
            alert('请先选择一个项目');
            return;
        }
        StateManager.set('currentStep', 'characters');
    },
    
    // 渲染步骤内容
    renderStep(stepName) {
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        const container = document.getElementById('workspace-content');
        if (!container) return;
        
        switch (stepName) {
            case 'outline':
                this.renderOutlineStep(container, project);
                break;
            case 'detail':
                this.renderDetailStep(container, project);
                break;
            case 'characters':
                this.renderCharactersStep(container, project);
                break;
            case 'chapters':
                this.renderChaptersStep(container, project);
                break;
        }
    },
    
    // 渲染大纲步骤
    async renderOutlineStep(container, project) {
        const hasChapters = (StateManager.get('chapters') || []).length > 0;
        const isShort = project.format === 'short';
        
        container.innerHTML = `
            <div class="row g-3" style="height: 100%;">
                <div class="col-lg-5">
                    <div class="chat-container-modern" style="height: 100%;">
                        <div class="chat-header-modern">
                            <h5><i class="bi bi-chat-dots-fill"></i> AI大纲助手</h5>
                            <button class="btn-icon" onclick="App.clearChatHistory()" title="清空对话">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                        <div class="chat-messages-modern" id="outline-messages">
                            <div class="chat-message-modern assistant">
                                <div class="message-avatar">
                                    <i class="bi bi-stars"></i>
                                </div>
                                <div class="message-content">
                                    <div class="message-bubble-modern">
                                        <div class="md-content">
                                            <p>你好！我是AI大纲助手。请告诉我你想要创作什么样的故事，我会帮你生成精美的大纲。</p>
                                            <p>你可以描述：</p>
                                            <ul>
                                                <li>故事类型（玄幻、都市、科幻等）</li>
                                                <li>核心设定（世界观、主角能力等）</li>
                                                <li>情感走向（甜蜜、虐心、热血等）</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="chat-input-modern">
                            <textarea class="form-control-modern" id="outline-input" 
                                   placeholder="描述你的故事想法..."
                                   rows="1"
                                   oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"
                                   onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault(); App.sendOutlineMessage()}"></textarea>
                            <button class="btn-send" id="btn-send-outline" onclick="App.sendOutlineMessage()" title="发送">
                                <i class="bi bi-send-fill"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="col-lg-7">
                    <div class="outline-editor-modern" style="height: 100%;">
                        <div class="outline-header-modern">
                            <h5><i class="bi bi-file-earmark-text-fill"></i> 大纲预览</h5>
                            <div class="d-flex gap-2">
                                ${(isShort || hasChapters) ? `
                                    <button class="btn-modern" onclick="App.reverseOutline(${project.id})" title="从内容反推大纲">
                                        <i class="bi bi-magic"></i> AI反推
                                    </button>
                                ` : ''}
                                <button class="btn-modern success" onclick="App.acceptOutline()">
                                    <i class="bi bi-check-lg"></i> 采纳大纲
                                </button>
                                <button class="btn-modern secondary" onclick="App.editOutline()">
                                    <i class="bi bi-pencil-lg"></i> 编辑
                                </button>
                            </div>
                        </div>
                        <div class="outline-body-modern" id="outline-preview">
                            <div class="empty-state">
                                <div class="empty-icon">
                                    <i class="bi bi-file-earmark-richtext"></i>
                                </div>
                                <p>大纲将在这里显示</p>
                                <p class="text-muted">与AI对话后自动生成，或从章节细纲反推</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 加载现有大纲
        this.loadOutline(project.id);
        
        // 加载对话历史
        this.loadChatHistory(project.id);
    },
    
    // 渲染细纲/事件步骤
    renderDetailStep(container, project) {
        if (project.workflow_mode === 'chapter') {
            this.renderChapterOutlines(container, project);
        } else {
            this.renderEventOutlines(container, project);
        }
    },
    
    // 渲染章节细纲（现代化卡片，每章独立生成）
    async renderChapterOutlines(container, project) {
        container.innerHTML = `
            <div class="outline-editor-modern">
                <div class="outline-header-modern">
                    <h5><i class="bi bi-list-ol"></i> 章节细纲</h5>
                    <span class="text-muted small">为每章生成或反推细纲</span>
                </div>
                <div class="outline-body-modern" id="chapter-outlines-list">
                    <div class="text-center py-5">
                        <div class="loading-spinner large mx-auto mb-3"></div>
                        <p class="text-muted">加载中...</p>
                    </div>
                </div>
            </div>
        `;
        
        // 加载章节列表和细纲
        try {
            const [chaptersResult, outlinesResult] = await Promise.all([
                API.chapters.list(project.id),
                API.chapterOutlines.list(project.id)
            ]);
            
            const chapters = chaptersResult.data || [];
            const outlines = outlinesResult.data || [];
            
            const listContainer = document.getElementById('chapter-outlines-list');
            
            if (chapters.length === 0) {
                listContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">
                            <i class="bi bi-list-ul"></i>
                        </div>
                        <p>暂无章节</p>
                        <p class="text-muted">请先在左侧章节管理中添加章节</p>
                    </div>
                `;
                return;
            }
            
            // 创建章节细纲映射
            const outlineMap = {};
            outlines.forEach(o => {
                outlineMap[o.chapter_no] = o;
            });
            
            listContainer.innerHTML = `
                <div class="row g-3">
                    ${chapters.map(ch => {
                        const outline = outlineMap[ch.chapter_no];
                        const hasOutline = !!outline;
                        
                        return `
                            <div class="col-md-6">
                                <div class="card-modern ${hasOutline ? '' : 'no-outline'}">
                                    <div class="card-header-modern">
                                        <h6>${ch.title || `第${ch.chapter_no}章`}</h6>
                                        <div class="d-flex gap-2">
                                            ${hasOutline ? `
                                                <span class="badge-modern success">已生成</span>
                                            ` : `
                                                <button class="btn-modern primary btn-sm" onclick="App.generateSingleOutline(${ch.chapter_no})">
                                                    <i class="bi bi-stars"></i> AI生成
                                                </button>
                                                <button class="btn-modern btn-sm" onclick="App.reverseChapterOutline(${project.id}, ${ch.chapter_no})" title="从正文反推细纲">
                                                    <i class="bi bi-magic"></i> 反推
                                                </button>
                                            `}
                                        </div>
                                    </div>
                                    <div class="card-body-modern">
                                        ${hasOutline ? `
                                            <div class="outline-content-modern">
                                                ${MarkdownRenderer.render(outline.content || '暂无内容')}
                                            </div>
                                            <div class="mt-2 text-muted small">
                                                字数: ${outline.word_count || 0}
                                                <button class="btn-modern secondary btn-sm ms-2" onclick="App.generateSingleOutline(${ch.chapter_no})">
                                                    <i class="bi bi-arrow-clockwise"></i> 重新生成
                                                </button>
                                                <button class="btn-modern btn-sm ms-1" onclick="App.reverseChapterOutline(${project.id}, ${ch.chapter_no})" title="从正文反推细纲">
                                                    <i class="bi bi-magic"></i> 反推
                                                </button>
                                            </div>
                                        ` : `
                                            <div class="text-center text-muted py-3">
                                                <i class="bi bi-file-text fs-4"></i>
                                                <p class="mt-2 mb-0">点击上方按钮生成或反推细纲</p>
                                            </div>
                                        `}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } catch (error) {
            console.error('加载章节细纲失败:', error);
        }
    },
    
    // 生成单章细纲
    async generateSingleOutline(chapterNo) {
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        try {
            this.showToast(`正在生成第${chapterNo}章细纲...`, 'info');
            
            const result = await API.chapterOutlines.generateSingle(project.id, chapterNo);
            
            this.showToast(`第${chapterNo}章细纲生成成功`, 'success');
            
            // 刷新显示
            this.renderDetailStep(document.getElementById('workspace-content'), project);
        } catch (error) {
            this.showToast('生成失败: ' + error.message, 'error');
        }
    },
    
    // 渲染事件细纲（现代化卡片）
    async renderEventOutlines(container, project) {
        container.innerHTML = `
            <div class="outline-editor-modern">
                <div class="outline-header-modern">
                    <h5><i class="bi bi-diagram-3-fill"></i> 事件链</h5>
                    <button class="btn-modern primary" onclick="App.generateEventOutlines()">
                        <i class="bi bi-robot"></i> 生成事件链
                    </button>
                </div>
                <div class="outline-body-modern" id="event-outlines-list">
                    <div class="text-center py-5">
                        <div class="loading-spinner large mx-auto mb-3"></div>
                        <p class="text-muted">加载中...</p>
                    </div>
                </div>
            </div>
        `;
        
        // 加载事件细纲
        try {
            const result = await API.eventOutlines.list(project.id);
            const events = result.data || [];
            
            const listContainer = document.getElementById('event-outlines-list');
            if (events.length === 0) {
                listContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">
                            <i class="bi bi-diagram-3"></i>
                        </div>
                        <p>暂无事件链</p>
                        <p class="text-muted">点击上方按钮生成</p>
                    </div>
                `;
            } else {
                listContainer.innerHTML = `
                    <div class="row g-3">
                        ${events.map(e => `
                            <div class="col-md-6">
                                <div class="card-modern">
                                    <div class="card-header-modern">
                                        <span class="badge-modern primary">事件 ${e.event_no}</span>
                                        <h6 class="mb-0">${this.escapeHtml(e.title || '未命名')}</h6>
                                    </div>
                                    <div class="card-body-modern">
                                        <div class="outline-content-modern">
                                            <p><strong>描述：</strong>${this.escapeHtml(e.description || '暂无')}</p>
                                            <p><strong>前因：</strong>${this.escapeHtml(e.cause || '暂无')}</p>
                                            <p><strong>后果：</strong>${this.escapeHtml(e.effect || '暂无')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        } catch (error) {
            console.error('加载事件链失败:', error);
        }
    },
    
    // 渲染角色步骤（现代化卡片）
    async renderCharactersStep(container, project) {
        const chapters = StateManager.get('chapters') || [];
        
        container.innerHTML = `
            <div class="outline-editor-modern">
                <div class="outline-header-modern">
                    <h5><i class="bi bi-people-fill"></i> 角色管理</h5>
                    <div class="d-flex gap-2">
                        <button class="btn-modern" onclick="App.extractCharacters()">
                            <i class="bi bi-robot"></i> AI抽取
                        </button>
                        ${chapters.length > 0 ? `
                            <button class="btn-modern" onclick="App.reverseAllCharacters(${project.id})" title="从所有章节反推角色">
                                <i class="bi bi-magic"></i> 反推角色
                            </button>
                        ` : ''}
                        <button class="btn-modern primary" onclick="App.showCreateCharacter()">
                            <i class="bi bi-person-plus"></i> 添加角色
                        </button>
                        <button class="btn-modern" onclick="App.showMindmap()">
                            <i class="bi bi-diagram-3"></i> 关系脑图
                        </button>
                    </div>
                </div>
                <div class="outline-body-modern" id="characters-list">
                    <div class="text-center py-5">
                        <div class="loading-spinner large mx-auto mb-3"></div>
                        <p class="text-muted">加载中...</p>
                    </div>
                </div>
            </div>
        `;
        
        // 加载角色列表
        try {
            const result = await API.characters.list(project.id);
            const characters = result.data || [];
            
            StateManager.set('characters', characters);
            
            const listContainer = document.getElementById('characters-list');
            if (characters.length === 0) {
                listContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">
                            <i class="bi bi-people"></i>
                        </div>
                        <p>暂无角色</p>
                        <p class="text-muted">点击上方按钮添加或AI抽取</p>
                    </div>
                `;
            } else {
                listContainer.innerHTML = `
                    <div class="row g-3">
                        ${characters.map(c => `
                            <div class="col-md-6 col-lg-4">
                                <div class="card-modern" onclick="App.editCharacter(${c.id})" style="cursor: pointer;">
                                    <div class="card-body-modern">
                                        <div class="d-flex align-items-center mb-2">
                                            <div class="character-avatar-sm me-2">
                                                <i class="bi bi-person-fill"></i>
                                            </div>
                                            <div class="flex-grow-1">
                                                <h6 class="mb-0">${this.escapeHtml(c.name)}</h6>
                                                <span class="badge-modern ${c.gender === '女' ? '' : 'primary'}">
                                                    ${c.gender || '未知'}
                                                </span>
                                            </div>
                                        </div>
                                        ${c.personality ? `
                                            <p class="text-muted mb-2" style="font-size: 0.75rem;">
                                                ${this.escapeHtml(c.personality).substring(0, 60)}...
                                            </p>
                                        ` : ''}
                                        <div class="character-chapters">
                                            <span class="chapter-label">出场章节：</span>
                                            ${c.chapters && c.chapters.length > 0 ? 
                                                c.chapters.map(ch => `<span class="chapter-tag">第${ch.chapter_no}章</span>`).join('') 
                                                : '<span class="chapter-tag empty">未关联</span>'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        } catch (error) {
            console.error('加载角色失败:', error);
        }
    },
    
    // 渲染章节步骤（现代化编辑器）
    renderChaptersStep(container, project) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 4rem;">
                <div class="empty-icon">
                    <i class="bi bi-file-earmark-text"></i>
                </div>
                <p>请从左侧章节列表选择章节</p>
                <p class="text-muted">选择后即可查看和编辑章节内容</p>
            </div>
        `;
    },
    
    // 发送大纲消息
    async sendOutlineMessage() {
        const input = document.getElementById('outline-input');
        const message = input?.value.trim();
        if (!message) return;
        
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        // 添加用户消息到界面
        this.addChatMessage('user', message);
        input.value = '';
        input.style.height = 'auto';
        
        // 显示加载状态
        const btnSend = document.getElementById('btn-send-outline');
        if (btnSend) {
            btnSend.disabled = true;
            btnSend.innerHTML = '<div class="loading-spinner"></div>';
        }
        
        try {
            // 调用API
            const result = await API.outlines.chat(project.id, message);
            
            // 添加AI回复到界面
            this.addChatMessage('assistant', result.data.response);
        } catch (error) {
            this.addChatMessage('system', '错误: ' + error.message);
        } finally {
            // 恢复发送按钮
            if (btnSend) {
                btnSend.disabled = false;
                btnSend.innerHTML = '<i class="bi bi-send-fill"></i>';
            }
        }
    },
    
    // 添加聊天消息（支持Markdown渲染）
    addChatMessage(role, content) {
        const container = document.getElementById('outline-messages');
        if (!container) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message-modern ${role}`;
        
        const avatarIcon = role === 'user' ? 'bi-person-fill' : 'bi-stars';
        const avatarHtml = role === 'system' ? '<i class="bi bi-exclamation-triangle-fill"></i>' : `<i class="bi ${avatarIcon}"></i>`;
        
        // 渲染Markdown内容
        const contentHtml = role === 'system' 
            ? `<p class="text-danger">${this.escapeHtml(content)}</p>`
            : MarkdownRenderer.render(content);
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatarHtml}</div>
            <div class="message-content">
                <div class="message-bubble-modern">
                    <div class="md-content">${contentHtml}</div>
                </div>
            </div>
        `;
        
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    },
    
    // 清空对话历史
    clearChatHistory() {
        if (!confirm('确定要清空所有对话历史吗？')) return;
        
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        // 保留欢迎消息
        const container = document.getElementById('outline-messages');
        if (container) {
            container.innerHTML = `
                <div class="chat-message-modern assistant">
                    <div class="message-avatar">
                        <i class="bi bi-stars"></i>
                    </div>
                    <div class="message-content">
                        <div class="message-bubble-modern">
                            <div class="md-content">
                                <p>对话已清空。请告诉我你想要创作什么样的故事。</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    },
    
    // 加载大纲（支持Markdown渲染）
    async loadOutline(novelId) {
        try {
            const result = await API.outlines.get(novelId);
            const preview = document.getElementById('outline-preview');
            if (preview && result.data) {
                const content = result.data.content || '暂无内容';
                preview.innerHTML = `
                    <div class="outline-content-modern">
                        ${MarkdownRenderer.render(content)}
                    </div>
                    <div class="mt-3 pt-3 border-top border-secondary">
                        <span class="badge-modern">版本 ${result.data.version || 1}</span>
                        <span class="text-muted ms-2">${result.data.updated_at ? new Date(result.data.updated_at).toLocaleString('zh-CN') : ''}</span>
                    </div>
                `;
            }
        } catch (error) {
            console.error('加载大纲失败:', error);
        }
    },
    
    // 加载对话历史
    async loadChatHistory(novelId) {
        try {
            const result = await API.outlines.chatHistory(novelId);
            const history = result.data || [];
            
            history.forEach(msg => {
                this.addChatMessage(msg.role, msg.content);
            });
        } catch (error) {
            console.error('加载对话历史失败:', error);
        }
    },
    
    // 采纳大纲
    async acceptOutline() {
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        if (!confirm('确定要采纳当前对话中的大纲吗？')) return;
        
        try {
            await API.outlines.accept(project.id);
            await this.loadOutline(project.id);
            alert('大纲采纳成功！');
        } catch (error) {
            alert('采纳失败: ' + error.message);
        }
    },
    
    // 编辑大纲（现代化编辑框）
    editOutline() {
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        const preview = document.getElementById('outline-preview');
        if (!preview) return;
        
        // 提取纯文本内容用于编辑
        const contentDiv = preview.querySelector('.outline-content-modern');
        const currentContent = contentDiv ? contentDiv.textContent : '';
        
        preview.innerHTML = `
            <div class="outline-edit-area">
                <textarea class="form-control-modern" id="outline-edit-content" rows="20" 
                        placeholder="在这里编辑大纲内容，支持Markdown语法...">${this.escapeHtml(currentContent)}</textarea>
                <div class="mt-3 d-flex justify-content-end gap-2">
                    <button class="btn-modern secondary" onclick="App.loadOutline(${project.id})">
                        <i class="bi bi-x-lg"></i> 取消
                    </button>
                    <button class="btn-modern primary" onclick="App.saveOutline()">
                        <i class="bi bi-check-lg"></i> 保存
                    </button>
                </div>
            </div>
        `;
    },
    
    // 保存大纲
    async saveOutline() {
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        const content = document.getElementById('outline-edit-content')?.value;
        if (!content) return;
        
        try {
            await API.outlines.update(project.id, content);
            await this.loadOutline(project.id);
            alert('大纲保存成功！');
        } catch (error) {
            alert('保存失败: ' + error.message);
        }
    },
    
    // 生成事件链
    async generateEventOutlines() {
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        if (!confirm('确定要生成事件链吗？')) return;
        
        try {
            const result = await API.eventOutlines.generate(project.id);
            alert('事件链生成成功！');
            this.renderStep('detail');
        } catch (error) {
            alert('生成失败: ' + error.message);
        }
    },
    
    // 抽取角色（异步任务）
    async extractCharacters() {
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        if (!confirm('确定要从大纲和章节内容中AI抽取角色吗？')) return;
        
        try {
            this.showToast('正在抽取角色...', 'info');
            
            const result = await API.characters.extract(project.id);
            
            // 检查是否返回了task_id
            if (result.data && result.data.task_id) {
                // 创建loading遮罩
                const loadingId = 'loading-extract';
                document.body.insertAdjacentHTML('beforeend', `
                    <div id="${loadingId}" class="loading-overlay">
                        <div class="loading-box">
                            <div class="loading-spinner large"></div>
                            <p>正在抽取角色，请稍候...</p>
                        </div>
                    </div>
                `);
                
                try {
                    // 轮询任务状态
                    await API.pollTask(result.data.task_id, (task) => {
                        const msg = document.querySelector(`#${loadingId} p`);
                        if (msg) {
                            msg.textContent = `正在抽取角色... ${task.progress || 0}%`;
                        }
                    });
                } finally {
                    // 移除loading
                    const loading = document.getElementById(loadingId);
                    if (loading) loading.remove();
                }
            }
            
            this.showToast('角色抽取成功', 'success');
            this.renderStep('characters');
        } catch (error) {
            this.showToast('抽取失败: ' + error.message, 'error');
        }
    },
    
    // 显示创建角色（现代化表单）
    async showCreateCharacter() {
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        this.hideModal();
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('mainModal'));
        
        // 获取章节列表
        let chapters = [];
        try {
            const result = await API.chapters.list(project.id);
            chapters = result.data || [];
        } catch (error) {
            console.error('获取章节列表失败:', error);
        }
        
        document.getElementById('modal-title').innerHTML = '<i class="bi bi-person-plus-fill"></i> 添加角色';
        document.getElementById('modal-body').innerHTML = `
            <form class="model-form">
                <div class="form-section">
                    <div class="form-section-title">基本信息</div>
                    <div class="mb-3">
                        <label class="form-label-modern">角色名 <span class="text-danger">*</span></label>
                        <input type="text" class="form-control-modern" id="char-name" placeholder="请输入角色名" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label-modern">性别</label>
                        <div class="gender-options">
                            <label class="gender-option">
                                <input type="radio" name="char-gender" value="" checked>
                                <div class="gender-icon">❓</div>
                                <span>未知</span>
                            </label>
                            <label class="gender-option">
                                <input type="radio" name="char-gender" value="男">
                                <div class="gender-icon">👨</div>
                                <span>男</span>
                            </label>
                            <label class="gender-option">
                                <input type="radio" name="char-gender" value="女">
                                <div class="gender-icon">👩</div>
                                <span>女</span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="form-section">
                    <div class="form-section-title">角色详情</div>
                    <div class="mb-3">
                        <label class="form-label-modern">性格</label>
                        <textarea class="form-control-modern" id="char-personality" rows="2" placeholder="描述角色的性格特点..."></textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label-modern">背景故事</label>
                        <textarea class="form-control-modern" id="char-background" rows="2" placeholder="角色的背景经历..."></textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label-modern">目标动机</label>
                        <textarea class="form-control-modern" id="char-goal" rows="2" placeholder="角色追求的目标..."></textarea>
                    </div>
                </div>
                
                ${chapters.length > 0 ? `
                <div class="form-section">
                    <div class="form-section-title">出场章节</div>
                    <div class="chapter-checkboxes">
                        ${chapters.map(ch => `
                            <label class="checkbox-modern">
                                <input type="checkbox" name="char-chapters" value="${ch.id}">
                                <span class="checkbox-mark"></span>
                                <span>第${ch.chapter_no}章 ${ch.title || ''}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </form>
        `;
        document.getElementById('modal-footer').innerHTML = `
            <button type="button" class="btn-modern secondary" data-bs-dismiss="modal">取消</button>
            <button type="button" class="btn-modern primary" onclick="App.createCharacter()">
                <i class="bi bi-check-lg"></i> 创建角色
            </button>
        `;
        
        modal.show();
    },
    
    // 创建角色
    async createCharacter() {
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        const name = document.getElementById('char-name')?.value;
        if (!name) {
            this.showToast('请输入角色名', 'error');
            return;
        }
        
        // 获取选中的章节ID
        const chapterCheckboxes = document.querySelectorAll('input[name="char-chapters"]:checked');
        const chapterIds = Array.from(chapterCheckboxes).map(cb => parseInt(cb.value));
        
        try {
            await API.characters.create(project.id, {
                name,
                gender: document.querySelector('input[name="char-gender"]:checked')?.value || '',
                personality: document.getElementById('char-personality')?.value,
                background: document.getElementById('char-background')?.value,
                goal: document.getElementById('char-goal')?.value,
                chapter_ids: chapterIds
            });
            
            bootstrap.Modal.getInstance(document.getElementById('mainModal')).hide();
            this.showToast('角色创建成功', 'success');
            this.renderStep('characters');
        } catch (error) {
            this.showToast('创建失败: ' + error.message, 'error');
        }
    },
    
    // 编辑角色（现代化表单）
    async editCharacter(charId) {
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        try {
            const [charResult, chaptersResult] = await Promise.all([
                API.characters.get(project.id, charId),
                API.chapters.list(project.id)
            ]);
            
            const char = charResult.data;
            const chapters = chaptersResult.data || [];
            const charChapterIds = char.chapter_ids || [];
            
            this.hideModal();
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('mainModal'));
            
            document.getElementById('modal-title').innerHTML = '<i class="bi bi-person-lines-fill"></i> 编辑角色';
            document.getElementById('modal-body').innerHTML = `
                <form class="model-form">
                    <div class="form-section">
                        <div class="form-section-title">基本信息</div>
                        <div class="mb-3">
                            <label class="form-label-modern">角色名 <span class="text-danger">*</span></label>
                            <input type="text" class="form-control-modern" id="edit-char-name" value="${char.name}" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label-modern">性别</label>
                            <div class="gender-options">
                                <label class="gender-option ${!char.gender ? 'active' : ''}">
                                    <input type="radio" name="edit-char-gender" value="" ${!char.gender ? 'checked' : ''}>
                                    <div class="gender-icon">❓</div>
                                    <span>未知</span>
                                </label>
                                <label class="gender-option ${char.gender === '男' ? 'active' : ''}">
                                    <input type="radio" name="edit-char-gender" value="男" ${char.gender === '男' ? 'checked' : ''}>
                                    <div class="gender-icon">👨</div>
                                    <span>男</span>
                                </label>
                                <label class="gender-option ${char.gender === '女' ? 'active' : ''}">
                                    <input type="radio" name="edit-char-gender" value="女" ${char.gender === '女' ? 'checked' : ''}>
                                    <div class="gender-icon">👩</div>
                                    <span>女</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <div class="form-section-title">角色详情</div>
                        <div class="mb-3">
                            <label class="form-label-modern">性格</label>
                            <textarea class="form-control-modern" id="edit-char-personality" rows="2" placeholder="描述角色的性格特点...">${char.personality || ''}</textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label-modern">背景故事</label>
                            <textarea class="form-control-modern" id="edit-char-background" rows="2" placeholder="角色的背景经历...">${char.background || ''}</textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label-modern">目标动机</label>
                            <textarea class="form-control-modern" id="edit-char-goal" rows="2" placeholder="角色追求的目标...">${char.goal || ''}</textarea>
                        </div>
                    </div>
                    
                    ${chapters.length > 0 ? `
                    <div class="form-section">
                        <div class="form-section-title">出场章节</div>
                        <div class="chapter-checkboxes">
                            ${chapters.map(ch => `
                                <label class="checkbox-modern">
                                    <input type="checkbox" name="edit-char-chapters" value="${ch.id}" ${charChapterIds.includes(ch.id) ? 'checked' : ''}>
                                    <span class="checkbox-mark"></span>
                                    <span>第${ch.chapter_no}章 ${ch.title || ''}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </form>
            `;
            document.getElementById('modal-footer').innerHTML = `
                <button type="button" class="btn-modern danger me-auto" onclick="App.deleteCharacter(${charId})">
                    <i class="bi bi-trash"></i> 删除
                </button>
                <button type="button" class="btn-modern secondary" data-bs-dismiss="modal">取消</button>
                <button type="button" class="btn-modern primary" onclick="App.updateCharacter(${charId})">
                    <i class="bi bi-check-lg"></i> 保存
                </button>
            `;
            
            modal.show();
        } catch (error) {
            this.showToast('加载角色失败: ' + error.message, 'error');
        }
    },
    
    // 更新角色
    async updateCharacter(charId) {
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        // 获取选中的章节ID
        const chapterCheckboxes = document.querySelectorAll('input[name="edit-char-chapters"]:checked');
        const chapterIds = Array.from(chapterCheckboxes).map(cb => parseInt(cb.value));
        
        try {
            await API.characters.update(project.id, charId, {
                name: document.getElementById('edit-char-name')?.value,
                gender: document.querySelector('input[name="edit-char-gender"]:checked')?.value || '',
                personality: document.getElementById('edit-char-personality')?.value,
                background: document.getElementById('edit-char-background')?.value,
                goal: document.getElementById('edit-char-goal')?.value,
                chapter_ids: chapterIds
            });
            
            bootstrap.Modal.getInstance(document.getElementById('mainModal')).hide();
            this.showToast('角色更新成功', 'success');
            this.renderStep('characters');
        } catch (error) {
            this.showToast('更新失败: ' + error.message, 'error');
        }
    },
    
    // 删除角色
    async deleteCharacter(charId) {
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        if (!confirm('确定要删除这个角色吗？')) return;
        
        try {
            await API.characters.delete(project.id, charId);
            bootstrap.Modal.getInstance(document.getElementById('mainModal')).hide();
            this.showToast('角色删除成功', 'success');
            this.renderStep('characters');
        } catch (error) {
            this.showToast('删除失败: ' + error.message, 'error');
        }
    },
    
    // 显示脑图
    async showMindmap() {
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        this.hideModal();
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('mainModal'));
        
        document.getElementById('modal-title').textContent = '角色关系脑图';
        document.getElementById('modal-body').innerHTML = `
            <div id="mindmap-container" style="width: 100%; height: 500px;"></div>
        `;
        document.getElementById('modal-footer').innerHTML = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
        `;
        
        modal.show();
        
        // 加载脑图数据
        try {
            const result = await API.characters.mindmap(project.id);
            this.renderMindmap(result.data);
        } catch (error) {
            console.error('加载脑图失败:', error);
        }
    },
    
    // 渲染脑图
    renderMindmap(data) {
        const container = document.getElementById('mindmap-container');
        if (!container || !data) return;
        
        const chart = echarts.init(container);
        
        const option = {
            tooltip: {},
            series: [{
                type: 'graph',
                layout: 'force',
                data: data.nodes.map(node => ({
                    name: node.name,
                    symbolSize: 50,
                    itemStyle: {
                        color: node.gender === '女' ? '#ff6b6b' : '#4ecdc4'
                    }
                })),
                links: data.links.map(link => ({
                    source: data.nodes.find(n => n.id === link.source)?.name,
                    target: data.nodes.find(n => n.id === link.target)?.name,
                    label: {
                        show: true,
                        formatter: link.relation
                    }
                })),
                roam: true,
                label: {
                    show: true
                },
                force: {
                    repulsion: 200
                }
            }]
        };
        
        chart.setOption(option);
        
        // 移除旧的事件监听器（如果有）
        if (this._mindmapResizeHandler) {
            window.removeEventListener('resize', this._mindmapResizeHandler);
        }
        
        // 保存新的事件监听器引用
        this._mindmapResizeHandler = () => chart.resize();
        window.addEventListener('resize', this._mindmapResizeHandler);
    },
    
    // 显示导入（现代化界面）
    showImport() {
        const project = StateManager.get('currentProject');
        
        this.hideModal();
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('mainModal'));
        
        document.getElementById('modal-title').innerHTML = '<i class="bi bi-cloud-upload-fill"></i> 导入小说';
        document.getElementById('modal-body').innerHTML = `
            <div class="import-area">
                <div class="import-icon">
                    <i class="bi bi-file-earmark-text"></i>
                </div>
                <h5>拖拽文件到此处或点击选择</h5>
                <p class="text-muted">支持 TXT、DOCX 格式</p>
                ${project ? `<p class="text-muted small">将导入到项目：${this.escapeHtml(project.title)}</p>` : '<p class="text-muted small">将创建新项目</p>'}
                <input type="file" id="import-file" accept=".txt,.docx" style="display: none;">
                <button class="btn-modern primary mt-3" onclick="document.getElementById('import-file').click()">
                    <i class="bi bi-folder2-open"></i> 选择文件
                </button>
            </div>
        `;
        document.getElementById('modal-footer').innerHTML = `
            <button type="button" class="btn-modern secondary" data-bs-dismiss="modal">取消</button>
        `;
        
        // 文件选择事件
        document.getElementById('import-file')?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.uploadFile(e.target.files[0]);
            }
        });
        
        modal.show();
    },
    
    // 上传文件
    async uploadFile(file) {
        const project = StateManager.get('currentProject');
        
        try {
            this.showToast('正在导入...', 'info');
            
            const result = await API.imports.upload(file, project?.id);
            
            bootstrap.Modal.getInstance(document.getElementById('mainModal')).hide();
            
            // 获取项目ID
            const novelId = project?.id || result.data?.novel_id;
            
            // 如果是新项目，刷新项目列表
            if (!project) {
                await ProjectManager.loadProjects();
                if (novelId) {
                    await ProjectManager.selectProject(novelId);
                }
            } else {
                // 刷新章节列表
                await ProjectManager.loadChapters(project.id);
            }
            
            this.showToast('导入成功！已创建章节', 'success');
            
            // 显示反推选项
            if (novelId) {
                this.showReverseOptions(novelId);
            }
        } catch (error) {
            this.showToast('导入失败: ' + error.message, 'error');
        }
    },
    
    // 显示反推选项（根据小说格式区分）
    showReverseOptions(novelId) {
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        this.hideModal();
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('mainModal'));
        
        const isShort = project.format === 'short';
        
        document.getElementById('modal-title').innerHTML = '<i class="bi bi-magic"></i> AI反推';
        document.getElementById('modal-body').innerHTML = `
            <div class="reverse-options">
                <p class="mb-3">导入成功！是否使用AI反推以下内容？</p>
                <div class="reverse-cards">
                    ${isShort ? `
                        <!-- 短篇：可以直接反推大纲、细纲、角色 -->
                        <div class="reverse-card" onclick="App.reverseOutline(${novelId})">
                            <div class="reverse-icon">
                                <i class="bi bi-file-text"></i>
                            </div>
                            <h6>反推大纲</h6>
                            <p class="text-muted small">从正文反推故事大纲</p>
                        </div>
                        <div class="reverse-card" onclick="App.reverseChapterOutline(${novelId}, 1)">
                            <div class="reverse-icon">
                                <i class="bi bi-list-ol"></i>
                            </div>
                            <h6>反推细纲</h6>
                            <p class="text-muted small">从正文反推细纲</p>
                        </div>
                        <div class="reverse-card" onclick="App.reverseAllCharacters(${novelId})">
                            <div class="reverse-icon">
                                <i class="bi bi-people"></i>
                            </div>
                            <h6>反推角色</h6>
                            <p class="text-muted small">从正文反推角色信息</p>
                        </div>
                    ` : `
                        <!-- 长篇：大纲从细纲反推，细纲逐章反推，角色从章节反推 -->
                        <div class="reverse-card" onclick="App.reverseOutline(${novelId})">
                            <div class="reverse-icon">
                                <i class="bi bi-file-text"></i>
                            </div>
                            <h6>反推大纲</h6>
                            <p class="text-muted small">需要先有章节细纲</p>
                        </div>
                        <div class="reverse-card" onclick="App.reverseAllCharacters(${novelId})">
                            <div class="reverse-icon">
                                <i class="bi bi-people"></i>
                            </div>
                            <h6>反推角色</h6>
                            <p class="text-muted small">从所有章节提取角色</p>
                        </div>
                    `}
                </div>
                <p class="text-muted small mt-3">细纲需要在章节管理中逐章反推</p>
            </div>
        `;
        document.getElementById('modal-footer').innerHTML = `
            <button type="button" class="btn-modern secondary" data-bs-dismiss="modal">跳过</button>
        `;
        
        modal.show();
    },
    
    // 反推大纲
    async reverseOutline(novelId) {
        try {
            // 尝试关闭模态框（如果存在）
            try {
                const modal = bootstrap.Modal.getInstance(document.getElementById('mainModal'));
                if (modal) modal.hide();
            } catch (e) {}
            
            this.showToast('正在反推大纲...', 'info');
            
            await API.imports.reverseOutline(novelId);
            
            this.showToast('大纲反推成功', 'success');
            this.loadOutline(novelId);
        } catch (error) {
            this.showToast('反推失败: ' + error.message, 'error');
        }
    },
    
    // 反推单章细纲
    async reverseChapterOutline(novelId, chapterNo) {
        try {
            this.showToast(`正在反推第${chapterNo}章细纲...`, 'info');
            
            await API.imports.reverseChapterOutline(novelId, chapterNo);
            
            this.showToast(`第${chapterNo}章细纲反推成功`, 'success');
            
            // 刷新显示
            const project = StateManager.get('currentProject');
            if (project) {
                this.renderChapterOutlines(document.getElementById('workspace-content'), project);
            }
        } catch (error) {
            this.showToast('反推失败: ' + error.message, 'error');
        }
    },
    
    // 从单章反推角色
    async reverseCharactersFromChapter(novelId, chapterNo) {
        try {
            this.showToast(`正在从第${chapterNo}章反推角色...`, 'info');
            
            await API.imports.reverseCharactersFromChapter(novelId, chapterNo);
            
            this.showToast('角色反推成功', 'success');
        } catch (error) {
            this.showToast('反推失败: ' + error.message, 'error');
        }
    },
    
    // 从所有章节反推角色
    async reverseAllCharacters(novelId) {
        try {
            // 尝试关闭模态框（如果存在）
            try {
                const modal = bootstrap.Modal.getInstance(document.getElementById('mainModal'));
                if (modal) modal.hide();
            } catch (e) {}
            
            const chapters = StateManager.get('chapters') || [];
            if (chapters.length === 0) {
                this.showToast('没有章节可反推', 'error');
                return;
            }
            
            this.showToast('开始反推角色...', 'info');
            
            // 逐章反推
            for (const chapter of chapters) {
                await API.imports.reverseCharactersFromChapter(novelId, chapter.chapter_no);
            }
            
            this.showToast('角色反推完成', 'success');
            this.renderStep('characters');
        } catch (error) {
            this.showToast('反推失败: ' + error.message, 'error');
        }
    },
    
    // 显示导出（现代化界面）
    showExport() {
        const project = StateManager.get('currentProject');
        if (!project) {
            alert('请先选择一个项目');
            return;
        }
        
        this.hideModal();
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('mainModal'));
        
        document.getElementById('modal-title').innerHTML = '<i class="bi bi-cloud-download-fill"></i> 导出作品';
        document.getElementById('modal-body').innerHTML = `
            <div class="export-form">
                <div class="form-section">
                    <div class="form-section-title">导出设置</div>
                    <div class="mb-3">
                        <label class="form-label-modern">导出格式</label>
                        <div class="format-options">
                            <label class="format-option active">
                                <input type="radio" name="export-format" value="docx" checked>
                                <div class="format-icon">
                                    <i class="bi bi-file-earmark-word"></i>
                                </div>
                                <span>Word</span>
                            </label>
                            <label class="format-option">
                                <input type="radio" name="export-format" value="txt">
                                <div class="format-icon">
                                    <i class="bi bi-file-earmark-text"></i>
                                </div>
                                <span>TXT</span>
                            </label>
                            <label class="format-option">
                                <input type="radio" name="export-format" value="epub">
                                <div class="format-icon">
                                    <i class="bi bi-book"></i>
                                </div>
                                <span>EPUB</span>
                            </label>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label-modern">包含内容</label>
                        <div class="d-flex flex-column gap-2">
                            <label class="checkbox-modern">
                                <input type="checkbox" id="export-outline" checked>
                                <span class="checkbox-mark"></span>
                                <span>包含大纲</span>
                            </label>
                            <label class="checkbox-modern">
                                <input type="checkbox" id="export-characters" checked>
                                <span class="checkbox-mark"></span>
                                <span>包含角色介绍</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('modal-footer').innerHTML = `
            <button type="button" class="btn-modern secondary" data-bs-dismiss="modal">取消</button>
            <button type="button" class="btn-modern primary" onclick="App.exportNovel()">
                <i class="bi bi-download"></i> 导出
            </button>
        `;
        
        modal.show();
        
        // 格式选择事件
        document.querySelectorAll('.format-option').forEach(option => {
            option.addEventListener('click', function() {
                document.querySelectorAll('.format-option').forEach(o => o.classList.remove('active'));
                this.classList.add('active');
            });
        });
    },
    
    // 导出小说
    async exportNovel() {
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        const format = document.querySelector('input[name="export-format"]:checked')?.value || 'docx';
        const includeOutline = document.getElementById('export-outline')?.checked;
        const includeCharacters = document.getElementById('export-characters')?.checked;
        
        try {
            let result;
            const options = {
                include_outline: includeOutline,
                include_characters: includeCharacters
            };
            
            switch (format) {
                case 'docx':
                    result = await API.exports.docx(project.id, options);
                    break;
                case 'txt':
                    result = await API.exports.txt(project.id, options);
                    break;
                case 'epub':
                    result = await API.exports.epub(project.id, options);
                    break;
            }
            
            bootstrap.Modal.getInstance(document.getElementById('mainModal')).hide();
            
            // 下载文件
            if (result.data?.download_url) {
                window.open(result.data.download_url, '_blank');
            }
            
            // 使用toast替代alert
            this.showToast('导出成功', 'success');
        } catch (error) {
            this.showToast('导出失败: ' + error.message, 'error');
        }
    },
    
    // 显示提示消息
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.innerHTML = `
            <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(toast);
        
        // 触发动画
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // 自动移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    // 添加章节
    async addChapter() {
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        const chapters = StateManager.get('chapters') || [];
        const nextChapterNo = chapters.length + 1;
        
        const title = prompt('章节标题:', `第${nextChapterNo}章`);
        if (!title) return;
        
        try {
            await API.chapters.create(project.id, { 
                chapter_no: nextChapterNo, 
                title: title 
            });
            await ProjectManager.loadChapters(project.id);
            this.showToast('章节添加成功', 'success');
        } catch (error) {
            this.showToast('添加失败: ' + error.message, 'error');
        }
    },
    
    // 显示模型设置（现代化卡片布局）
    async showModelSettings() {
        // 确保关闭之前的模态框
        this.hideModal();
        
        const modalEl = document.getElementById('mainModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        
        document.getElementById('modal-title').innerHTML = '<i class="bi bi-cpu-fill"></i> 模型设置';
        document.getElementById('modal-body').innerHTML = `
            <div class="text-center py-4">
                <div class="loading-spinner large mx-auto mb-3"></div>
                <p class="text-muted">加载模型列表...</p>
            </div>
        `;
        document.getElementById('modal-footer').innerHTML = `
            <button type="button" class="btn-modern secondary" data-bs-dismiss="modal">关闭</button>
            <button type="button" class="btn-modern primary" onclick="App.showAddModel()">
                <i class="bi bi-plus-lg"></i> 添加模型
            </button>
        `;
        
        modal.show();
        
        // 加载模型列表
        try {
            const result = await API.models.list();
            const models = result.data || [];
            
            const container = document.getElementById('modal-body');
            
            if (models.length === 0) {
                container.innerHTML = `
                    <div class="empty-state py-4">
                        <div class="empty-icon">
                            <i class="bi bi-cpu"></i>
                        </div>
                        <p>暂无模型配置</p>
                        <p class="text-muted">点击下方按钮添加模型</p>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="model-grid">
                        ${models.map(m => `
                            <div class="model-card ${m.is_default ? 'active' : ''}" data-model-id="${m.id}">
                                <div class="model-card-header">
                                    <div class="model-info">
                                        <div class="model-icon">
                                            <i class="bi bi-cpu-fill"></i>
                                        </div>
                                        <div>
                                            <h6 class="model-name">${this.escapeHtml(m.name)}</h6>
                                            <span class="model-provider">${this.escapeHtml(m.provider || 'custom')}</span>
                                        </div>
                                    </div>
                                    ${m.is_default ? '<span class="badge-modern success">默认</span>' : ''}
                                </div>
                                <div class="model-card-body">
                                    <div class="model-detail">
                                        <span class="detail-label">模型</span>
                                        <span class="detail-value">${this.escapeHtml(m.model_name)}</span>
                                    </div>
                                    <div class="model-detail">
                                        <span class="detail-label">Temperature</span>
                                        <span class="detail-value">${m.temperature || 0.7}</span>
                                    </div>
                                    <div class="model-detail">
                                        <span class="detail-label">Max Tokens</span>
                                        <span class="detail-value">${m.max_tokens || 2048}</span>
                                    </div>
                                </div>
                                <div class="model-card-footer">
                                    <button class="btn-model-action" onclick="App.editModel(${m.id})" title="编辑">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    ${!m.is_default ? `
                                        <button class="btn-model-action primary" onclick="App.switchModel(${m.id})" title="设为默认">
                                            <i class="bi bi-check-circle"></i> 设为默认
                                        </button>
                                    ` : ''}
                                    ${!m.is_builtin ? `
                                        <button class="btn-model-action danger" onclick="App.deleteModel(${m.id})" title="删除">
                                            <i class="bi bi-trash"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        } catch (error) {
            console.error('加载模型列表失败:', error);
            container.innerHTML = `
                <div class="text-center py-4 text-danger">
                    <i class="bi bi-exclamation-triangle fs-1"></i>
                    <p class="mt-2">加载失败: ${error.message}</p>
                </div>
            `;
        }
    },
    
    // 显示添加模型（现代化表单）
    showAddModel() {
        document.getElementById('modal-title').innerHTML = '<i class="bi bi-plus-circle-fill"></i> 添加模型';
        document.getElementById('modal-body').innerHTML = `
            <form class="model-form">
                <div class="form-section">
                    <div class="form-section-title">基本信息</div>
                    <div class="mb-3">
                        <label class="form-label-modern">配置名称 <span class="text-danger">*</span></label>
                        <input type="text" class="form-control-modern" id="model-name" placeholder="如：我的本地模型">
                    </div>
                    <div class="mb-3">
                        <label class="form-label-modern">提供商（快速填充）</label>
                        <select class="form-select-modern" id="model-provider" onchange="App.onProviderChange()">
                            <option value="">手动配置</option>
                            <option value="lmstudio">🟣 LMStudio (localhost:1234)</option>
                            <option value="ollama">🟢 Ollama (localhost:11434)</option>
                            <option value="vllm">🔵 vLLM (localhost:8000)</option>
                            <option value="openai">⚡ OpenAI (api.openai.com)</option>
                        </select>
                        <div class="form-hint">选择后自动填充地址和密钥，也可手动修改</div>
                    </div>
                </div>
                
                <div class="form-section">
                    <div class="form-section-title">连接配置</div>
                    <div class="mb-3">
                        <label class="form-label-modern">Base URL <span class="text-danger">*</span></label>
                        <input type="text" class="form-control-modern" id="model-url" placeholder="http://localhost:1234/v1">
                        <div class="form-hint">支持格式: http://host:port 或 http://host:port/v1</div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label-modern">API Key</label>
                        <input type="password" class="form-control-modern" id="model-key" placeholder="本地模型可留空">
                        <div class="form-hint">本地模型通常不需要真实密钥</div>
                    </div>
                </div>
                
                <div class="form-section">
                    <div class="form-section-title">模型参数</div>
                    <div class="mb-3">
                        <label class="form-label-modern">模型名称 <span class="text-danger">*</span></label>
                        <input type="text" class="form-control-modern" id="model-model" placeholder="如: llama3, qwen2, deepseek-r1">
                        <div class="form-hint">必须与模型服务中加载的模型名称完全一致</div>
                    </div>
                    <div class="row g-3">
                        <div class="col-6">
                            <label class="form-label-modern">Temperature</label>
                            <input type="number" class="form-control-modern" id="model-temp" value="0.7" step="0.1" min="0" max="2">
                            <div class="form-hint">0-2，越高越发散</div>
                        </div>
                        <div class="col-6">
                            <label class="form-label-modern">Max Tokens</label>
                            <input type="number" class="form-control-modern" id="model-tokens" value="2048">
                            <div class="form-hint">最大生成长度</div>
                        </div>
                    </div>
                </div>
            </form>
        `;
        document.getElementById('modal-footer').innerHTML = `
            <button type="button" class="btn-modern secondary" onclick="App.showModelSettings()">
                <i class="bi bi-arrow-left"></i> 返回
            </button>
            <button type="button" class="btn-modern" onclick="App.testModel()">
                <i class="bi bi-lightning"></i> 测试连接
            </button>
            <button type="button" class="btn-modern primary" onclick="App.addModel()">
                <i class="bi bi-check-lg"></i> 添加模型
            </button>
        `;
    },
    
    // 提供商切换 - 自动填充
    onProviderChange() {
        const provider = document.getElementById('model-provider')?.value;
        const urlInput = document.getElementById('model-url');
        const keyInput = document.getElementById('model-key');
        const nameInput = document.getElementById('model-name');
        
        const presets = {
            'lmstudio': { url: 'http://localhost:1234/v1', key: 'lm-studio', name: 'LMStudio 本地模型' },
            'ollama': { url: 'http://localhost:11434/v1', key: 'ollama', name: 'Ollama 本地模型' },
            'vllm': { url: 'http://localhost:8000/v1', key: 'EMPTY', name: 'vLLM 本地模型' },
            'openai': { url: 'https://api.openai.com/v1', key: '', name: 'OpenAI' }
        };
        
        if (presets[provider]) {
            const preset = presets[provider];
            if (urlInput) urlInput.value = preset.url;
            if (keyInput) keyInput.value = preset.key;
            if (nameInput && !nameInput.value) nameInput.value = preset.name;
        }
    },
    
    // 添加模型
    async addModel() {
        const data = {
            name: document.getElementById('model-name')?.value,
            provider: document.getElementById('model-provider')?.value || 'custom',
            base_url: document.getElementById('model-url')?.value,
            api_key: document.getElementById('model-key')?.value,
            model_name: document.getElementById('model-model')?.value,
            temperature: parseFloat(document.getElementById('model-temp')?.value),
            max_tokens: parseInt(document.getElementById('model-tokens')?.value)
        };
        
        if (!data.name || !data.base_url || !data.model_name) {
            alert('请填写必填字段');
            return;
        }
        
        try {
            await API.models.create(data);
            alert('模型添加成功！');
            this.showModelSettings();
        } catch (error) {
            alert('添加失败: ' + error.message);
        }
    },
    
    // 测试模型
    async testModel() {
        const data = {
            base_url: document.getElementById('model-url')?.value,
            api_key: document.getElementById('model-key')?.value,
            model_name: document.getElementById('model-model')?.value
        };
        
        if (!data.base_url || !data.model_name) {
            alert('请填写Base URL和模型名称');
            return;
        }
        
        try {
            const result = await API.models.test(data);
            if (result.success) {
                alert('✅ ' + result.message);
            } else {
                alert('❌ ' + result.message);
            }
        } catch (error) {
            alert('❌ 测试失败: ' + error.message);
        }
    },
    
    // 编辑模型（现代化表单）
    async editModel(modelId) {
        try {
            // 获取模型列表，找到要编辑的模型
            const result = await API.models.list();
            const models = result.data || [];
            const model = models.find(m => m.id === modelId);
            
            if (!model) {
                alert('模型不存在');
                return;
            }
            
            const modalEl = document.getElementById('mainModal');
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            
            document.getElementById('modal-title').innerHTML = '<i class="bi bi-pencil-square"></i> 编辑模型';
            document.getElementById('modal-body').innerHTML = `
                <form class="model-form">
                    <div class="form-section">
                        <div class="form-section-title">基本信息</div>
                        <div class="mb-3">
                            <label class="form-label-modern">配置名称 <span class="text-danger">*</span></label>
                            <input type="text" class="form-control-modern" id="edit-model-name" value="${model.name}" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label-modern">提供商（快速填充）</label>
                            <select class="form-select-modern" id="edit-model-provider" onchange="App.onEditProviderChange()">
                                <option value="custom" ${model.provider === 'custom' ? 'selected' : ''}>手动配置</option>
                                <option value="lmstudio" ${model.provider === 'lmstudio' ? 'selected' : ''}>🟣 LMStudio</option>
                                <option value="ollama" ${model.provider === 'ollama' ? 'selected' : ''}>🟢 Ollama</option>
                                <option value="vllm" ${model.provider === 'vllm' ? 'selected' : ''}>🔵 vLLM</option>
                                <option value="openai" ${model.provider === 'openai' ? 'selected' : ''}>⚡ OpenAI</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <div class="form-section-title">连接配置</div>
                        <div class="mb-3">
                            <label class="form-label-modern">Base URL <span class="text-danger">*</span></label>
                            <input type="text" class="form-control-modern" id="edit-model-url" value="${model.base_url || ''}" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label-modern">API Key</label>
                            <input type="password" class="form-control-modern" id="edit-model-key" placeholder="留空表示不修改">
                            <div class="form-hint">当前值: ${model.api_key ? '••••••' : '未设置'}</div>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <div class="form-section-title">模型参数</div>
                        <div class="mb-3">
                            <label class="form-label-modern">模型名称 <span class="text-danger">*</span></label>
                            <input type="text" class="form-control-modern" id="edit-model-model" value="${model.model_name || ''}" required>
                        </div>
                        <div class="row g-3">
                            <div class="col-6">
                                <label class="form-label-modern">Temperature</label>
                                <input type="number" class="form-control-modern" id="edit-model-temp" value="${model.temperature || 0.7}" step="0.1" min="0" max="2">
                            </div>
                            <div class="col-6">
                                <label class="form-label-modern">Max Tokens</label>
                                <input type="number" class="form-control-modern" id="edit-model-tokens" value="${model.max_tokens || 2048}">
                            </div>
                        </div>
                        <div class="mt-3">
                            <label class="checkbox-modern">
                                <input type="checkbox" id="edit-model-default" ${model.is_default ? 'checked' : ''}>
                                <span class="checkbox-mark"></span>
                                <span>设为默认模型</span>
                            </label>
                        </div>
                    </div>
                </form>
            `;
            document.getElementById('modal-footer').innerHTML = `
                <button type="button" class="btn-modern danger me-auto" onclick="App.deleteModel(${modelId})">
                    <i class="bi bi-trash"></i> 删除
                </button>
                <button type="button" class="btn-modern secondary" data-bs-dismiss="modal">取消</button>
                <button type="button" class="btn-modern" onclick="App.testEditModel(${modelId})">
                    <i class="bi bi-lightning"></i> 测试连接
                </button>
                <button type="button" class="btn-modern primary" onclick="App.updateModel(${modelId})">
                    <i class="bi bi-check-lg"></i> 保存
                </button>
            `;
            
            modal.show();
        } catch (error) {
            alert('加载模型信息失败: ' + error.message);
        }
    },
    
    // 编辑表单 - 提供商切换
    onEditProviderChange() {
        const provider = document.getElementById('edit-model-provider')?.value;
        const urlInput = document.getElementById('edit-model-url');
        const keyInput = document.getElementById('edit-model-key');
        
        const presets = {
            'lmstudio': { url: 'http://localhost:1234/v1', key: 'lm-studio' },
            'ollama': { url: 'http://localhost:11434/v1', key: 'ollama' },
            'vllm': { url: 'http://localhost:8000/v1', key: 'EMPTY' },
            'openai': { url: 'https://api.openai.com/v1', key: '' }
        };
        
        if (presets[provider]) {
            const preset = presets[provider];
            if (urlInput) urlInput.value = preset.url;
            if (keyInput && preset.key) keyInput.value = preset.key;
        }
    },
    
    // 测试编辑中的模型连接
    async testEditModel(modelId) {
        const data = {
            id: modelId,
            base_url: document.getElementById('edit-model-url')?.value,
            api_key: document.getElementById('edit-model-key')?.value || '****',
            model_name: document.getElementById('edit-model-model')?.value
        };
        
        if (!data.base_url || !data.model_name) {
            alert('请填写Base URL和模型名称');
            return;
        }
        
        try {
            const result = await API.models.test(data);
            if (result.success) {
                alert('✅ ' + result.message);
            } else {
                alert('❌ ' + result.message);
            }
        } catch (error) {
            alert('❌ 测试失败: ' + error.message);
        }
    },
    
    // 更新模型
    async updateModel(modelId) {
        const data = {
            name: document.getElementById('edit-model-name')?.value,
            provider: document.getElementById('edit-model-provider')?.value,
            base_url: document.getElementById('edit-model-url')?.value,
            model_name: document.getElementById('edit-model-model')?.value,
            temperature: parseFloat(document.getElementById('edit-model-temp')?.value),
            max_tokens: parseInt(document.getElementById('edit-model-tokens')?.value),
            is_default: document.getElementById('edit-model-default')?.checked
        };
        
        // 只有当API Key有值时才更新
        const apiKey = document.getElementById('edit-model-key')?.value;
        if (apiKey) {
            data.api_key = apiKey;
        }
        
        if (!data.name || !data.base_url || !data.model_name) {
            alert('请填写必填字段');
            return;
        }
        
        try {
            await API.models.update(modelId, data);
            bootstrap.Modal.getInstance(document.getElementById('mainModal')).hide();
            alert('模型更新成功！');
            this.showModelSettings();
        } catch (error) {
            alert('更新失败: ' + error.message);
        }
    },
    
    // 删除模型
    async deleteModel(modelId) {
        if (!confirm('确定要删除这个模型配置吗？')) return;
        
        try {
            await API.models.delete(modelId);
            alert('删除成功！');
            this.showModelSettings();
        } catch (error) {
            alert('删除失败: ' + error.message);
        }
    },
    
    // 切换模型
    async switchModel(modelId) {
        try {
            await API.models.switch(modelId);
            this.showToast('模型切换成功', 'success');
            this.showModelSettings();
            
            // 更新导航栏显示
            this.updateModelIndicator();
        } catch (error) {
            this.showToast('切换失败: ' + error.message, 'error');
        }
    },
    
    // 更新模型指示器显示
    async updateModelIndicator() {
        try {
            const result = await API.models.currentDefault();
            const indicator = document.getElementById('current-model-name');
            if (!indicator) return;
            
            const model = result.data;
            const label = indicator.querySelector('.model-label');
            
            if (model) {
                label.textContent = model.name;
                indicator.classList.add('active');
                indicator.title = `${model.name} (${model.model_name})`;
            } else {
                label.textContent = '未配置模型';
                indicator.classList.remove('active');
                indicator.title = '点击配置模型';
            }
        } catch (error) {
            console.error('更新模型指示器失败:', error);
        }
    },
    
    // 显示大纲版本
    async showOutlineVersions() {
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        this.hideModal();
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('mainModal'));
        
        document.getElementById('modal-title').textContent = '大纲版本历史';
        document.getElementById('modal-body').innerHTML = `
            <div class="text-center py-3">
                <div class="loading-spinner"></div>
            </div>
        `;
        document.getElementById('modal-footer').innerHTML = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
        `;
        
        modal.show();
        
        try {
            const result = await API.outlines.versions(project.id);
            const versions = result.data || [];
            
            document.getElementById('modal-body').innerHTML = versions.length === 0 ? `
                <div class="text-center text-muted py-4">暂无版本历史</div>
            ` : `
                <div class="version-list">
                    ${versions.map(v => `
                        <div class="version-item" onclick="App.rollbackOutline(${v.version})">
                            <div class="d-flex justify-content-between">
                                <span class="version-number">版本 ${v.version}</span>
                                ${v.is_current ? '<span class="badge bg-primary">当前</span>' : ''}
                            </div>
                            <div class="text-muted small mt-1">${v.created_at ? new Date(v.created_at).toLocaleString('zh-CN') : '当前版本'}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            console.error('加载版本历史失败:', error);
        }
    },
    
    // 回滚大纲
    async rollbackOutline(version) {
        const project = StateManager.get('currentProject');
        if (!project) return;
        
        if (!confirm(`确定要回滚到版本 ${version} 吗？`)) return;
        
        try {
            await API.outlines.rollback(project.id, version);
            bootstrap.Modal.getInstance(document.getElementById('mainModal')).hide();
            alert('回滚成功！');
            this.loadOutline(project.id);
        } catch (error) {
            alert('回滚失败: ' + error.message);
        }
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// 导出
window.App = App;