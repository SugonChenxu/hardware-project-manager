import React, { useEffect, useRef, useCallback, useState } from 'react';
import { DatePicker, Dropdown, Popconfirm, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import dayjs from 'dayjs';
import {
  DeleteOutlined,
  UndoOutlined,
  CalendarOutlined,
  UserOutlined,
  CaretRightOutlined,
  UnorderedListOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useProjectStore } from '../store/useProjectStore';
import { useTaskStore } from '../store/useTaskStore';
import { Task, TaskPriority, SubTask } from '../types';

const PRIORITY_DOT: Record<TaskPriority, { color: string; label: string }> = {
  urgent: { color: '#cf1322', label: '紧急' },
  high:   { color: '#ff4d4f', label: '高' },
  medium: { color: '#faad14', label: '中' },
  low:    { color: '#52c41a', label: '低' },
};

const PRIORITY_MENU_ITEMS: MenuProps['items'] = [
  { key: 'urgent', label: '🔴 紧急' },
  { key: 'high',   label: '🟠 高' },
  { key: 'medium', label: '🟡 中' },
  { key: 'low',    label: '🟢 低' },
];

const getTextColor = (priority: TaskPriority): string => {
  if (priority === 'urgent' || priority === 'high') return '#ff4d4f';
  return '#333';
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

// ────────────────────────────────────────────────────────────────────
//  单行任务组件
// ────────────────────────────────────────────────────────────────────
interface TaskRowProps {
  task: Task;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  onComplete: (task: Task) => void;
  onUndo: (task: Task) => void;
  onPriorityChange: (task: Task, p: TaskPriority) => void;
  onDateChange: (task: Task, d: string) => void;
  onAssigneeChange: (task: Task, v: string) => void;
  onTitleBlur: (id: string, e: React.FocusEvent<HTMLInputElement>) => void;
  onAddSubTask: (taskId: string, title: string) => void;
  onToggleSubTask: (taskId: string, subTaskId: string) => void;
  onRemoveSubTask: (taskId: string, subTaskId: string) => void;
  onDelete: (id: string) => void;
  topInputRef?: React.RefObject<HTMLInputElement>;
  done?: boolean;
}

const TaskRow: React.FC<TaskRowProps> = ({
  task, expanded, onToggleExpand,
  onComplete, onUndo, onPriorityChange,
  onDateChange, onAssigneeChange, onTitleBlur,
  onAddSubTask, onToggleSubTask, onRemoveSubTask, onDelete,
  topInputRef, done = false,
}) => {
  const hoverBg = done ? '#f6ffed' : '#f0f5ff';
  const subTasks = task.subTasks || [];
  const hasSubTasks = subTasks.length > 0;
  const subInputRef = useRef<HTMLInputElement>(null);

  // 展开后自动聚焦子任务输入框
  useEffect(() => {
    if (expanded && !done) {
      setTimeout(() => subInputRef.current?.focus(), 50);
    }
  }, [expanded, done]);

  const handleSubInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const val = e.currentTarget.value.trim();
    if (!val) return;
    onAddSubTask(task.id, val);
    e.currentTarget.value = '';
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '7px 12px',
          borderBottom: '1px solid #f5f5f5',
          transition: 'background 0.15s',
          gap: 8,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hoverBg; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        {/* 状态灯 */}
        {done ? (
          <span
            style={{
              width: 12, height: 12, borderRadius: '50%',
              background: PRIORITY_DOT[task.priority].color,
              flexShrink: 0, opacity: 0.35,
            }}
          />
        ) : (
          <Dropdown
            trigger={['click']}
            menu={{
              items: PRIORITY_MENU_ITEMS,
              onClick: ({ key }) => onPriorityChange(task, key as TaskPriority),
              selectable: true,
              defaultSelectedKeys: [task.priority],
              style: { minWidth: 120 },
            }}
            placement="bottomLeft"
          >
            <Tooltip title={`重要程度: ${PRIORITY_DOT[task.priority].label}（点击选择）`}>
              <span
                style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: PRIORITY_DOT[task.priority].color,
                  flexShrink: 0, cursor: 'pointer',
                  boxShadow: `0 0 4px ${PRIORITY_DOT[task.priority].color}40`,
                }}
              />
            </Tooltip>
          </Dropdown>
        )}

        {/* 展开/收起子任务按钮 */}
        {!done && (
          <Tooltip title={hasSubTasks ? `子任务 (${subTasks.filter((s) => !s.completed).length}/${subTasks.length})` : '添加子任务'}>
            <span
              onClick={() => onToggleExpand(task.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18, height: 18,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s',
                borderRadius: 3,
                position: 'relative',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#e6f4ff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {hasSubTasks ? (
                <UnorderedListOutlined style={{ fontSize: 13, color: '#1677ff' }} />
              ) : (
                <CaretRightOutlined
                  style={{
                    fontSize: 11,
                    color: '#bbb',
                    transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s',
                  }}
                />
              )}
            </span>
          </Tooltip>
        )}

        {/* 已完成任务的子任务标记 */}
        {done && hasSubTasks && (
          <Tooltip title={`子任务 ${subTasks.filter((s) => s.completed).length}/${subTasks.length} 已完成`}>
            <UnorderedListOutlined style={{ fontSize: 12, color: '#ccc', flexShrink: 0 }} />
          </Tooltip>
        )}

        {/* 任务标题 */}
        {done ? (
          <span
            style={{
              flex: 1, fontSize: 14, color: '#999',
              textDecoration: 'line-through', padding: '4px 0',
            }}
          >
            {task.title}
          </span>
        ) : (
          <input
            type="text"
            defaultValue={task.title}
            onBlur={(e) => onTitleBlur(task.id, e)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
                topInputRef?.current?.focus();
              }
            }}
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', fontSize: 14, padding: '4px 0',
              color: getTextColor(task.priority),
              fontWeight: task.priority === 'urgent' ? 600 : 400,
            }}
          />
        )}

        {/* 时间 */}
        {done ? (
          task.endDate && (
            <span style={{ fontSize: 12, color: '#bbb', flexShrink: 0, whiteSpace: 'nowrap' }}>
              <CalendarOutlined style={{ marginRight: 3 }} />
              {formatDate(task.endDate)}
            </span>
          )
        ) : (
          <DatePicker
            value={task.endDate ? dayjs(task.endDate) : null}
            onChange={(d) => onDateChange(task, d ? d.format('YYYY-MM-DD') : '')}
            placeholder=""
            format="M/D"
            size="small"
            allowClear={!!task.endDate}
            style={{ width: task.endDate ? 62 : 52 }}
            suffixIcon={
              <CalendarOutlined
                style={{ color: task.endDate ? '#1677ff' : '#ccc', fontSize: 13 }}
              />
            }
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* 责任人 */}
        {done ? (
          task.assignee && (
            <span style={{ fontSize: 12, color: '#bbb', flexShrink: 0, whiteSpace: 'nowrap' }}>
              <UserOutlined style={{ marginRight: 3 }} />
              {task.assignee}
            </span>
          )
        ) : (
          <Tooltip title="责任人">
            <label style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              <UserOutlined style={{ color: task.assignee ? '#1677ff' : '#ccc', fontSize: 13 }} />
              <input
                type="text"
                value={task.assignee || ''}
                onChange={(e) => onAssigneeChange(task, e.target.value)}
                placeholder="责任人"
                style={{
                  border: 'none', outline: 'none',
                  background: 'transparent', fontSize: 12,
                  color: task.assignee ? '#333' : '#bbb',
                  width: task.assignee ? Math.max(task.assignee.length * 14, 44) : 44,
                  minWidth: 44,
                }}
              />
            </label>
          </Tooltip>
        )}

        {/* 已完成：完成时间 */}
        {done && (
          <span style={{ fontSize: 12, color: '#bbb', flexShrink: 0, whiteSpace: 'nowrap' }}>
            ✓ {formatDate(task.completedAt)}
          </span>
        )}

        {/* 操作按钮 */}
        {done ? (
          <>
            <Tooltip title="撤销完成">
              <span onClick={() => onUndo(task)} className="task-action-btn" style={{ color: '#aaa' }}>
                <UndoOutlined />
              </span>
            </Tooltip>
            <Popconfirm title="确定删除？" onConfirm={() => onDelete(task.id)} okText="删除" cancelText="取消">
              <span className="task-action-btn" style={{ color: '#aaa' }}><DeleteOutlined /></span>
            </Popconfirm>
          </>
        ) : (
          <>
            <Tooltip title="标记完成">
              <span
                onClick={() => onComplete(task)}
                className="task-complete-btn"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, border: '2px solid #52c41a', borderRadius: 4,
                  cursor: 'pointer', flexShrink: 0, fontSize: 13,
                  color: 'transparent', transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#52c41a';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'transparent';
                }}
              >✓</span>
            </Tooltip>
            <Popconfirm title="确定删除此任务？" onConfirm={() => onDelete(task.id)} okText="删除" cancelText="取消">
              <span className="task-action-btn task-delete-btn" style={{ color: '#ccc' }}><DeleteOutlined /></span>
            </Popconfirm>
          </>
        )}
      </div>

      {/* 展开的子任务区域 */}
      {expanded && !done && (
        <div
          style={{
            padding: '4px 12px 8px 58px',
            borderBottom: '1px solid #f5f5f5',
            background: '#fafbfc',
          }}
        >
          {/* 已有子任务列表 */}
          {subTasks.map((st) => (
            <div
              key={st.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 0',
                gap: 8,
              }}
            >
              {/* 勾选框 */}
              <span
                onClick={() => onToggleSubTask(task.id, st.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 16, height: 16,
                  borderRadius: 3,
                  border: st.completed ? '1.5px solid #52c41a' : '1.5px solid #d9d9d9',
                  background: st.completed ? '#52c41a' : 'transparent',
                  cursor: 'pointer',
                  flexShrink: 0,
                  color: '#fff',
                  fontSize: 10,
                  transition: 'all 0.15s',
                }}
              >
                {st.completed ? '✓' : ''}
              </span>

              {/* 子任务文字 */}
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: st.completed ? '#bbb' : '#333',
                  textDecoration: st.completed ? 'line-through' : 'none',
                  padding: '2px 0',
                }}
              >
                {st.title}
              </span>

              {/* 删除子任务 */}
              <Popconfirm
                title="删除此子任务？"
                onConfirm={() => onRemoveSubTask(task.id, st.id)}
                okText="删除"
                cancelText="取消"
                placement="left"
              >
                <span
                  className="task-action-btn"
                  style={{ color: '#ccc', fontSize: 11 }}
                >
                  <DeleteOutlined />
                </span>
              </Popconfirm>
            </div>
          ))}

          {/* 子任务快速录入行 */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0', gap: 8 }}>
            <PlusOutlined style={{ fontSize: 11, color: '#bbb', flexShrink: 0 }} />
            <input
              ref={subInputRef}
              type="text"
              placeholder="输入子任务，回车添加..."
              onKeyDown={handleSubInputKeyDown}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 13,
                color: '#999',
                padding: '2px 0',
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};

// ────────────────────────────────────────────────────────────────────
//  页面主体
// ────────────────────────────────────────────────────────────────────
const Tasks: React.FC = () => {
  const { currentProjectId } = useProjectStore();
  const { tasks, load, add, update, remove, addSubTask, toggleSubTask, removeSubTask } = useTaskStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => { load(); }, []);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const projectTasks = tasks.filter((t) => t.projectId === currentProjectId);
  const todoTasks = projectTasks.filter((t) => t.status === 'todo');
  const doneTasks = projectTasks.filter((t) => t.status === 'done');

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleAddTask = useCallback(() => {
    const title = inputRef.current?.value.trim();
    if (!title || !currentProjectId) return;
    add({
      title, description: '', status: 'todo', priority: 'medium',
      assignee: '', startDate: '', endDate: '',
      dependencies: [], textColor: '', completedAt: '',
      subTasks: [],
      projectId: currentProjectId,
    });
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  }, [currentProjectId, add]);

  const handleComplete     = (task: Task) => update(task.id, { status: 'done', completedAt: new Date().toISOString() });
  const handleUndo         = (task: Task) => update(task.id, { status: 'todo', completedAt: '' });
  const handlePriority     = (task: Task, p: TaskPriority) => update(task.id, { priority: p });
  const handleDate         = (task: Task, d: string) => update(task.id, { endDate: d });
  const handleAssignee     = (task: Task, v: string) => update(task.id, { assignee: v });
  const handleTitleBlur    = (id: string, e: React.FocusEvent<HTMLInputElement>) => {
    const t = e.target.value.trim();
    if (!t) remove(id); else update(id, { title: t });
  };

  const SectionHeader = ({ color, label, count }: { color: string; label: string; count: number }) => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, fontWeight: 600, fontSize: 14, color }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 8, display: 'inline-block' }} />
      {label} ({count})
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>每日待办</h2>
        <span style={{ fontSize: 13, color: '#999' }}>已完成 {doneTasks.length} 项</span>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* ── 待办 ── */}
        <div style={{ flex: 1 }}>
          <SectionHeader color="#1677ff" label="待办" count={todoTasks.length} />
          <div style={{ background: '#fafafa', borderRadius: 8, minHeight: 300 }}>

            {/* 快速录入行 */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f0f0f0', gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#faad14', opacity: 0.4, flexShrink: 0 }} />
              <span style={{ width: 18, flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                placeholder="输入任务，回车添加..."
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTask(); } }}
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, padding: '4px 0' }}
              />
            </div>

            {todoTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                expanded={expandedIds.has(task.id)}
                onToggleExpand={toggleExpand}
                topInputRef={inputRef}
                onComplete={handleComplete}
                onUndo={handleUndo}
                onPriorityChange={handlePriority}
                onDateChange={handleDate}
                onAssigneeChange={handleAssignee}
                onTitleBlur={handleTitleBlur}
                onAddSubTask={addSubTask}
                onToggleSubTask={toggleSubTask}
                onRemoveSubTask={removeSubTask}
                onDelete={remove}
              />
            ))}

            {todoTasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb', fontSize: 13 }}>
                暂无待办，在上方输入框直接添加
              </div>
            )}
          </div>
        </div>

        {/* ── 已完成 ── */}
        <div style={{ flex: 1 }}>
          <SectionHeader color="#52c41a" label="已完成" count={doneTasks.length} />
          <div style={{ background: '#fafafa', borderRadius: 8, minHeight: 300 }}>
            {doneTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                done
                expanded={false}
                onToggleExpand={toggleExpand}
                onComplete={handleComplete}
                onUndo={handleUndo}
                onPriorityChange={handlePriority}
                onDateChange={handleDate}
                onAssigneeChange={handleAssignee}
                onTitleBlur={handleTitleBlur}
                onAddSubTask={addSubTask}
                onToggleSubTask={toggleSubTask}
                onRemoveSubTask={removeSubTask}
                onDelete={remove}
              />
            ))}
            {doneTasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb', fontSize: 13 }}>
                暂无已完成任务
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .task-action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px; height: 22px;
          cursor: pointer;
          flex-shrink: 0;
          font-size: 13px;
          opacity: 0;
          transition: opacity 0.15s, color 0.15s;
        }
        .task-delete-btn { opacity: 0; }
        div:hover > .task-action-btn,
        div:hover > .task-delete-btn {
          opacity: 0.45;
        }
        .task-action-btn:hover { opacity: 1 !important; color: #1677ff !important; }
        .task-delete-btn:hover { opacity: 1 !important; color: #ff4d4f !important; }
        .ant-dropdown-menu-item-selected { background-color: #e6f4ff !important; }
      `}</style>
    </div>
  );
};

export default Tasks;
