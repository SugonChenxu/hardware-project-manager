import React, { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Tag, Tooltip, Button, Space, Select } from 'antd';
import dayjs from 'dayjs';
import minMax from 'dayjs/plugin/minMax';
dayjs.extend(minMax);
import { useProjectStore } from '../store/useProjectStore';
import { useTaskStore } from '../store/useTaskStore';
import { Task, TaskStatus } from '../types';

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: '#d9d9d9',
  in_progress: '#1677ff',
  review: '#faad14',
  done: '#52c41a',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '待办',
  in_progress: '进行中',
  review: '审核中',
  done: '已完成',
};

const Gantt: React.FC = () => {
  const { currentProjectId } = useProjectStore();
  const { tasks, load } = useTaskStore();
  const [zoomDays, setZoomDays] = useState(90); // days to show

  useEffect(() => {
    load();
  }, []);

  const projectTasks = tasks.filter((t) => t.projectId === currentProjectId);

  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (projectTasks.length === 0) {
      const today = dayjs();
      return { minDate: today, maxDate: today.add(zoomDays, 'day'), totalDays: zoomDays };
    }

    const dates = projectTasks.flatMap((t) => [
      t.startDate ? dayjs(t.startDate) : null,
      t.endDate ? dayjs(t.endDate) : null,
    ]).filter(Boolean) as dayjs.Dayjs[];

    const min = dates.length > 0 ? dayjs.min(dates)!.subtract(7, 'day') : dayjs();
    const adjustedMax = min.add(zoomDays, 'day');
    return { minDate: min, maxDate: adjustedMax, totalDays: zoomDays };
  }, [projectTasks, zoomDays]);

  const dayWidth = Math.max(24, 800 / totalDays);

  const getBarStyle = (task: Task) => {
    if (!task.startDate || !task.endDate) return null;
    const start = dayjs(task.startDate);
    const end = dayjs(task.endDate);
    const left = start.diff(minDate, 'day');
    const width = Math.max(2, end.diff(start, 'day') + 1);
    return {
      left: left * dayWidth,
      width: width * dayWidth,
      backgroundColor: STATUS_COLORS[task.status],
    };
  };

  const todayOffset = dayjs().diff(minDate, 'day') * dayWidth;

  // Generate month labels
  const monthLabels: { label: string; offset: number; width: number }[] = [];
  if (projectTasks.length > 0 || true) {
    let current = minDate.startOf('month');
    while (current.isBefore(maxDate)) {
      const monthEnd = current.endOf('month');
      const visibleEnd = monthEnd.isAfter(maxDate) ? maxDate : monthEnd;
      monthLabels.push({
        label: current.format('YYYY年M月'),
        offset: Math.max(0, current.diff(minDate, 'day')) * dayWidth,
        width: visibleEnd.diff(current, 'day') * dayWidth,
      });
      current = current.add(1, 'month');
    }
  }

  // Day markers
  const days: { label: string; offset: number }[] = [];
  for (let i = 0; i <= totalDays; i++) {
    const d = minDate.add(i, 'day');
    days.push({ label: d.format('D'), offset: i * dayWidth });
  }

  if (projectTasks.length === 0) {
    return (
      <div>
        <h2 style={{ marginBottom: 16 }}>甘特图</h2>
        <Empty description="暂无任务数据，请先在任务管理中创建任务" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>甘特图</h2>
        <Space>
          <Select
            value={zoomDays}
            onChange={setZoomDays}
            style={{ width: 120 }}
            options={[
              { label: '30天', value: 30 },
              { label: '60天', value: 60 },
              { label: '90天', value: 90 },
              { label: '180天', value: 180 },
            ]}
          />
        </Space>
      </div>

      <Card size="small" styles={{ body: { padding: 0, overflow: 'auto' } }}>
        <div style={{ minWidth: totalDays * dayWidth + 200 }}>
          {/* Timeline header */}
          <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ width: 200, minWidth: 200, padding: '8px 12px', fontWeight: 600, borderRight: '1px solid #f0f0f0', background: '#fafafa' }}>
              任务
            </div>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {/* Month labels */}
              <div style={{ height: 24, position: 'relative', borderBottom: '1px solid #e8e8e8' }}>
                {monthLabels.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: m.offset,
                      width: m.width,
                      textAlign: 'center',
                      fontSize: 12,
                      fontWeight: 500,
                      lineHeight: '24px',
                      borderRight: '1px solid #e8e8e8',
                      color: '#666',
                    }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
              {/* Day labels */}
              <div style={{ height: 20, position: 'relative', borderBottom: '1px solid #f0f0f0' }}>
                {days.filter((_, i) => i % 7 === 0 || i === totalDays).map((d, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: d.offset,
                      fontSize: 10,
                      textAlign: 'center',
                      width: dayWidth * 7,
                      color: '#999',
                      lineHeight: '20px',
                    }}
                  >
                    {minDate.add(Math.floor(d.offset / dayWidth), 'day').format('M/D')}
                  </div>
                ))}
                {/* Today line at header */}
                {todayOffset > 0 && todayOffset < totalDays * dayWidth && (
                  <div
                    style={{
                      position: 'absolute',
                      left: todayOffset,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      background: '#f5222d',
                      zIndex: 2,
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Task rows */}
          {projectTasks.map((task) => {
            const bar = getBarStyle(task);
            return (
              <div key={task.id} style={{ display: 'flex', borderBottom: '1px solid #fafafa' }}>
                <div
                  style={{
                    width: 200,
                    minWidth: 200,
                    padding: '6px 12px',
                    borderRight: '1px solid #f0f0f0',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Tag color={STATUS_COLORS[task.status]} style={{ fontSize: 10, lineHeight: '18px', margin: 0 }}>
                    {STATUS_LABELS[task.status]}
                  </Tag>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {task.title}
                  </span>
                </div>
                <div style={{ flex: 1, height: 32, position: 'relative' }}>
                  {/* Today line */}
                  {todayOffset > 0 && todayOffset < totalDays * dayWidth && (
                    <div
                      style={{
                        position: 'absolute',
                        left: todayOffset,
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: '#f5222d',
                        opacity: 0.3,
                        zIndex: 1,
                      }}
                    />
                  )}
                  {/* Grid lines */}
                  {days.filter((_, i) => i % 7 === 0).map((d, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        left: d.offset,
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: '#f5f5f5',
                      }}
                    />
                  ))}
                  {/* Task bar */}
                  {bar && (
                    <Tooltip
                      title={`${task.title}: ${task.startDate} ~ ${task.endDate}`}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: 6,
                          height: 20,
                          borderRadius: 4,
                          ...bar,
                          minWidth: 4,
                          cursor: 'pointer',
                          transition: 'opacity 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: 4,
                          fontSize: 10,
                          color: '#fff',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '0.8'; }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
                      >
                        {bar.width > 40 ? task.title : ''}
                      </div>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Legend */}
      <div style={{ marginTop: 12, display: 'flex', gap: 16, alignItems: 'center', fontSize: 12, color: '#666' }}>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <span key={key}>
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: 3,
                background: STATUS_COLORS[key as TaskStatus],
                marginRight: 4,
                verticalAlign: 'middle',
              }}
            />
            {label}
          </span>
        ))}
        <span style={{ marginLeft: 8 }}>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 2,
              background: '#f5222d',
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />
          今日
        </span>
      </div>
    </div>
  );
};

export default Gantt;
