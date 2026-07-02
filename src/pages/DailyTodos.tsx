import React, { useEffect, useState } from 'react';
import { Card, Input, Button, Checkbox, DatePicker, Select, Tag, Empty, Space, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTodoStore } from '../store/useTodoStore';
import { useProjectStore } from '../store/useProjectStore';
import { formatDate } from '../utils/storage';

const DailyTodos: React.FC = () => {
  const { currentProjectId, projects } = useProjectStore();
  const { todos, load, add, toggle, remove } = useTodoStore();
  const [newTitle, setNewTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date().toISOString()));

  useEffect(() => {
    load();
  }, []);

  const dateTodos = todos.filter((t) => t.date === selectedDate);
  const activeTodos = dateTodos.filter((t) => !t.completed);
  const doneTodos = dateTodos.filter((t) => t.completed);

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    add({
      title: newTitle.trim(),
      completed: false,
      date: selectedDate,
      priority: 'medium',
      projectId: currentProjectId || undefined,
    });
    setNewTitle('');
  };

  const getPriorityTag = (priority: string) => {
    const map: Record<string, { color: string; label: string }> = {
      low: { color: '#8c8c8c', label: '低' },
      medium: { color: '#1677ff', label: '中' },
      high: { color: '#fa8c16', label: '高' },
      urgent: { color: '#f5222d', label: '紧急' },
    };
    const p = map[priority] || map.medium;
    return <Tag color={p.color} style={{ fontSize: 11 }}>{p.label}</Tag>;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>每日待办</h2>
        <DatePicker
          value={dayjs(selectedDate)}
          onChange={(d) => d && setSelectedDate(d.format('YYYY-MM-DD'))}
          allowClear={false}
        />
      </div>

      {/* Add new todo */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            placeholder="添加新的待办事项..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onPressEnter={handleAdd}
            style={{ flex: 1 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加
          </Button>
        </div>
      </Card>

      {/* Active todos */}
      <Card
        size="small"
        title={`待处理 (${activeTodos.length})`}
        style={{ marginBottom: 16 }}
      >
        {activeTodos.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待办" />
        ) : (
          activeTodos.map((todo) => (
            <div
              key={todo.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid #fafafa',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <Checkbox checked={false} onChange={() => toggle(todo.id)} />
                <span style={{ fontSize: 14 }}>{todo.title}</span>
                {getPriorityTag(todo.priority)}
                {todo.projectId && (
                  <Tag style={{ fontSize: 11 }}>
                    {projects.find((p) => p.id === todo.projectId)?.name || '未知项目'}
                  </Tag>
                )}
              </div>
              <Popconfirm title="确定删除？" onConfirm={() => remove(todo.id)}>
                <Button type="link" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
          ))
        )}
      </Card>

      {/* Completed todos */}
      {doneTodos.length > 0 && (
        <Card size="small" title={`已完成 (${doneTodos.length})`}>
          {doneTodos.map((todo) => (
            <div
              key={todo.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: '1px solid #fafafa',
                opacity: 0.6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <Checkbox checked onChange={() => toggle(todo.id)} />
                <span style={{ fontSize: 14, textDecoration: 'line-through' }}>{todo.title}</span>
              </div>
              <Popconfirm title="确定删除？" onConfirm={() => remove(todo.id)}>
                <Button type="link" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

export default DailyTodos;
