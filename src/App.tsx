import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, App as AntApp, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Gantt from './pages/Gantt';
import BOM from './pages/BOM';
import MeetingNotes from './pages/MeetingNotes';
import WeeklyReport from './pages/WeeklyReport';
import CostEstimate from './pages/CostEstimate';
import BugTracker from './pages/BugTracker';
import PlanSchedule from './pages/PlanSchedule';

// 导入所有 store 的 load 函数
import { useProjectStore } from './store/useProjectStore';
import usePlanStore from './store/usePlanStore';
import { useTaskStore } from './store/useTaskStore';
import { useTodoStore } from './store/useTodoStore';
import { useBOMStore } from './store/useBOMStore';
import { useMeetingStore } from './store/useMeetingStore';
import { useBugStore } from './store/useBugStore';
import { useCostStore } from './store/useCostStore';
import { useMaterialStore } from './store/useMaterialStore';
import { useReportStore } from './store/useReportStore';
import useMeetingNoteStore from './store/useMeetingNoteStore';

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAllData = async () => {
      try {
        console.log('🚀 开始加载所有数据...');
        
        // 并行加载所有 store 数据
        const results = await Promise.allSettled([
          useProjectStore.getState().load(),
          usePlanStore.getState().load(),
          useTaskStore.getState().load(),
          useTodoStore.getState().load(),
          useBOMStore.getState().load(),
          useMeetingStore.getState().load(),
          useBugStore.getState().load(),
          useCostStore.getState().load(),
          useMaterialStore.getState().load(),
          useReportStore.getState().load(),
          useMeetingNoteStore.getState().load(),
        ]);

        // 检查是否有失败
        results.forEach((result, index) => {
          const names = ['projects', 'plans', 'tasks', 'todos', 'bom', 'meetings', 'bugs', 'costs', 'materials', 'reports', 'meetingNotes'];
          if (result.status === 'rejected') {
            console.error(`❌ ${names[index]} 加载失败:`, result.reason);
          } else {
            console.log(`✅ ${names[index]} 加载完成`);
          }
        });

        console.log('✅ 所有数据加载完成！');
        setLoading(false);
      } catch (error) {
        console.error('❌ 数据加载失败:', error);
        setLoading(false);
      }
    };

    loadAllData();
  }, []);

  // 加载中显示 spinner
  if (loading) {
    return (
      <ConfigProvider locale={zhCN}>
        <AntApp>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <Spin size="large" />
            <div style={{ fontSize: '16px', color: '#666' }}>正在加载数据...</div>
          </div>
        </AntApp>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="gantt" element={<Gantt />} />
              <Route path="bom" element={<BOM />} />
              <Route path="meetings" element={<MeetingNotes />} />
              <Route path="reports" element={<WeeklyReport />} />
              <Route path="costs" element={<CostEstimate />} />
              <Route path="bugs" element={<BugTracker />} />
              <Route path="plan" element={<PlanSchedule />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
