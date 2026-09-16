import React, { useState, useEffect } from 'react';
import { Layout, NavTab } from './components/Layout';
import { Overview } from './components/Overview';
import { DailyPlan } from './components/DailyPlan';
import { Tasks } from './components/Tasks';
import { LearningPaths } from './components/LearningPaths';
import { Patterns } from './components/Patterns';
import { ShapeMyDayModal } from './components/modals/ShapeMyDayModal';
import { TaskModal } from './components/modals/TaskModal';
import { GoalModal } from './components/modals/GoalModal';
import { HabitModal } from './components/modals/HabitModal';
import { WeeklyGoalModal } from './components/modals/WeeklyGoalModal';
import { FocusSessionModal } from './components/modals/FocusSessionModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { PasscodeGate } from './components/PasscodeGate';
import { api, Goal, Habit, QuestionnaireAnswers, ScheduleBlock, StatsResponse, Task, WeeklyGoal } from './services/api';
import confetti from 'canvas-confetti';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);

  // Modals & Flows
  const [isShapeMyDayOpen, setIsShapeMyDayOpen] = useState(false);
  const [shapeTargetDate, setShapeTargetDate] = useState<string | undefined>(undefined);
  const [selectedDailyPlanDate, setSelectedDailyPlanDate] = useState<string | undefined>(undefined);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [isWeeklyGoalModalOpen, setIsWeeklyGoalModalOpen] = useState(false);
  const [editingWeeklyGoal, setEditingWeeklyGoal] = useState<WeeklyGoal | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [focusSession, setFocusSession] = useState<{
    isOpen: boolean;
    taskTitle: string;
    durationMinutes: number;
    blockId?: string;
  }>({
    isOpen: false,
    taskTitle: '',
    durationMinutes: 60,
  });

  // Auth / Gate
  const [isLocked, setIsLocked] = useState(false);
  const [maxCapacityHours, setMaxCapacityHours] = useState(32);

  // Load all data
  const loadData = async () => {
    try {
      const health = await api.checkHealth();
      if (health.hasPasscode) {
        try {
          await api.getTasks();
        } catch {
          setIsLocked(true);
          return;
        }
      }

      const [tasksRes, habitsRes, weeklyRes, goalsRes, schedRes, statsRes] = await Promise.all([
        api.getTasks().catch(() => ({ success: true, tasks: [] })),
        api.getHabits().catch(() => ({ success: true, habits: [] })),
        api.getWeeklyGoals().catch(() => ({ success: true, weeklyGoals: [] })),
        api.getGoals().catch(() => ({ success: true, goals: [] })),
        api.getTodaySchedule().catch(() => ({ success: true, schedule: [] })),
        api.getStats().catch(() => ({ success: true, stats: null })),
      ]);

      if (tasksRes.tasks) setTasks(tasksRes.tasks);
      if (habitsRes.habits) setHabits(habitsRes.habits);
      if (weeklyRes.weeklyGoals) setWeeklyGoals(weeklyRes.weeklyGoals);
      if (goalsRes.goals) setGoals(goalsRes.goals);
      if (schedRes.schedule) setSchedule(schedRes.schedule);
      if (statsRes.stats) setStats(statsRes.stats);
    } catch (err) {
      console.error('Failed to load Luma data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers
  const handleToggleTaskStatus = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === 'done' ? 'pending' : 'done';

    if (newStatus === 'done') {
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
    }

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    setSchedule(prev => prev.map(s => s.task_id === taskId ? { ...s, status: newStatus } : s));

    try {
      await api.updateTask(taskId, { status: newStatus });
      const statsRes = await api.getStats();
      if (statsRes.stats) setStats(statsRes.stats);
    } catch (err) {
      console.error('Failed to toggle task:', err);
      loadData();
    }
  };

  const handleToggleScheduleStatus = async (scheduleId: string, dateStr?: string) => {
    const block = schedule.find(s => s.id === scheduleId);
    const newStatus = block ? (block.status === 'done' ? 'pending' : 'done') : 'done';

    if (newStatus === 'done') {
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
    }

    setSchedule(prev => prev.map(s => s.id === scheduleId ? { ...s, status: newStatus } : s));
    if (block && block.task_id) {
      setTasks(prev => prev.map(t => t.id === block.task_id ? { ...t, status: newStatus } : t));
    }

    try {
      await api.updateScheduleBlock(scheduleId, newStatus, dateStr);
      const statsRes = await api.getStats();
      if (statsRes.stats) setStats(statsRes.stats);
    } catch (err) {
      console.error('Failed to toggle schedule block in backend:', err);
    }
  };

  const handleCheckHabitStreak = async (habitId: string) => {
    try {
      const habit = habits.find(h => h.id === habitId);
      const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      const isDone = habit?.last_completed_date === todayIST;
      if (!isDone) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      }
      const res = await api.checkHabitStreak(habitId);
      if (res.habit) {
        setHabits(prev => prev.map(h => h.id === habitId ? res.habit : h));
      }
    } catch (err) {
      console.error('Failed to update habit streak:', err);
    }
  };

  const handleSaveHabit = async (habitData: Partial<Habit>) => {
    try {
      if (editingHabit) {
        const res = await api.updateHabit(editingHabit.id, habitData);
        if (res.habit) {
          setHabits(prev => prev.map(h => h.id === editingHabit.id ? res.habit : h));
        }
      } else {
        const res = await api.createHabit(habitData);
        if (res.habit) {
          setHabits(prev => [...prev, res.habit]);
        }
      }
      setIsHabitModalOpen(false);
      setEditingHabit(null);
      await loadData();
    } catch (err: any) {
      console.error('Failed to save habit:', err);
    }
  };

  const handleSaveWeeklyGoal = async (goalData: Partial<WeeklyGoal>) => {
    try {
      if (editingWeeklyGoal) {
        const res = await api.updateWeeklyGoal(editingWeeklyGoal.id, goalData);
        if (res.weeklyGoal) {
          setWeeklyGoals(prev => prev.map(w => w.id === editingWeeklyGoal.id ? res.weeklyGoal : w));
        }
      } else {
        const res = await api.createWeeklyGoal(goalData);
        if (res.weeklyGoal) {
          setWeeklyGoals(prev => [...prev, res.weeklyGoal]);
        }
      }
      setIsWeeklyGoalModalOpen(false);
      setEditingWeeklyGoal(null);
      await loadData();
    } catch (err: any) {
      console.error('Failed to save weekly goal:', err);
    }
  };

  const handleDeleteHabit = async (id: string) => {
    try {
      await api.deleteHabit(id);
      setHabits(prev => prev.filter(h => h.id !== id));
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete habit');
    }
  };

  const handleDeleteWeeklyGoal = async (id: string) => {
    try {
      await api.deleteWeeklyGoal(id);
      setWeeklyGoals(prev => prev.filter(wg => wg.id !== id));
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete weekly goal:', err);
    }
  };

  const handleIncrementWeeklyGoal = async (id: string, currentCompleted: number) => {
    const targetGoal = weeklyGoals.find(wg => wg.id === id);
    if (targetGoal && currentCompleted >= targetGoal.target_units) {
      return; // Already reached max target units
    }
    const nextCompleted = targetGoal ? Math.min(targetGoal.target_units, currentCompleted + 1) : currentCompleted + 1;
    confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
    try {
      const res = await api.updateWeeklyGoal(id, { completed_units: nextCompleted });
      if (res.weeklyGoal) {
        setWeeklyGoals(prev => prev.map(wg => wg.id === id ? res.weeklyGoal : wg));
      }
    } catch (err) {
      console.error('Failed to update weekly goal progress:', err);
    }
  };

  const handleQuickAddTodo = async (title: string) => {
    try {
      const res = await api.createTask({
        title,
        duration_minutes: 25,
        priority: 'MEDIUM',
        energy_level: 'light',
        category: 'Daily To-Do',
        column_bucket: 'now',
      });
      if (res.task) {
        setTasks(prev => [...prev, res.task]);
      }
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to add quick to-do');
    }
  };

  const handleToggleGoalTopic = async (goalId: string, topicId: string) => {
    // Optimistic local state update
    setGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g;
      const updatedSyllabus = (g.syllabus || []).map(t => {
        if (t.id === topicId) {
          const nextCovered = !(t.covered || t.status === 'COVERED');
          return {
            ...t,
            covered: nextCovered,
            status: (nextCovered ? 'COVERED' : 'NEXT UP') as any
          };
        }
        return t;
      });
      const coveredCount = updatedSyllabus.filter(t => t.covered || t.status === 'COVERED').length;
      const totalUnits = Math.max(g.total_units || 0, updatedSyllabus.length, 1);
      const coveredUnits = updatedSyllabus.length > 0
        ? (updatedSyllabus.length === totalUnits ? coveredCount : Math.round((coveredCount / updatedSyllabus.length) * totalUnits))
        : 0;
      return {
        ...g,
        syllabus: updatedSyllabus,
        total_units: totalUnits,
        covered_units: coveredUnits,
      };
    }));

    try {
      const res = await api.toggleGoalTopic(goalId, topicId);
      if (res.goal) {
        setGoals(prev => prev.map(g => g.id === goalId ? res.goal : g));
      }
    } catch (err) {
      console.error('Failed to toggle topic:', err);
      loadData();
    }
  };

  const handleShapeMyDaySubmit = async (answers: QuestionnaireAnswers, targetDate?: string) => {
    const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    if (targetDate && targetDate < todayIST) {
      alert('Past days cannot be shaped. Please choose today or an upcoming day.');
      return;
    }
    await api.submitQuestionnaire(answers);
    const res = await api.generateSchedule(answers, targetDate);
    if (res.schedule) {
      if (!targetDate || targetDate === todayIST) {
        setSchedule(res.schedule);
      }
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 } });
    }
    await loadData();
    setCurrentTab('daily');
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    try {
      if (editingTask) {
        const res = await api.updateTask(editingTask.id, taskData);
        if (res.task) {
          setTasks(prev => prev.map(t => t.id === editingTask.id ? res.task : t));
        }
      } else {
        const res = await api.createTask(taskData);
        if (res.task) {
          setTasks(prev => [...prev, res.task]);
        }
      }
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save task');
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await api.deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete task');
    }
  };

  const handleSaveGoal = async (goalData: Partial<Goal>) => {
    try {
      const res = await api.createGoal(goalData);
      if (res.goal) {
        setGoals(prev => [...prev, res.goal]);
      }
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create learning path');
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      await api.deleteGoal(id);
      setGoals(prev => {
        const remaining = prev.filter(g => g.id !== id);
        if (selectedGoalId === id) {
          setSelectedGoalId(remaining[0]?.id || '');
        }
        return remaining;
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete learning path');
    }
  };

  if (isLocked) {
    return <PasscodeGate onSuccess={() => { setIsLocked(false); loadData(); }} />;
  }

  const weeklyCapacityHours = stats?.weeklyCapacity ? stats.weeklyCapacity.currentHours : 0;

  return (
    <Layout
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      onOpenShapeMyDay={() => setIsShapeMyDayOpen(true)}
      onOpenSettings={() => setIsSettingsOpen(true)}
      weeklyCapacityHours={weeklyCapacityHours}
      maxCapacityHours={maxCapacityHours}
    >
      {/* View Switcher */}
      {currentTab === 'overview' && (
        <Overview
          schedule={schedule}
          habits={habits}
          goals={goals}
          weeklyGoals={weeklyGoals}
          tasks={tasks}
          stats={stats}
          onSelectTab={setCurrentTab}
          onSelectGoal={(goalId) => {
            setSelectedGoalId(goalId);
            setCurrentTab('learning');
          }}
          onSelectDay={(dateStr) => {
            setSelectedDailyPlanDate(dateStr);
            setCurrentTab('daily');
          }}
          onToggleScheduleStatus={handleToggleScheduleStatus}
          onToggleHabit={handleCheckHabitStreak}
          onOpenShapeMyDay={(targetDate) => {
            setShapeTargetDate(targetDate);
            setIsShapeMyDayOpen(true);
          }}
          onAddTask={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
          onAddWeeklyGoal={() => { setEditingWeeklyGoal(null); setIsWeeklyGoalModalOpen(true); }}
          onIncrementWeeklyGoal={handleIncrementWeeklyGoal}
        />
      )}

      {currentTab === 'daily' && (
        <DailyPlan
          schedule={schedule}
          habits={habits}
          goals={goals}
          stats={stats}
          initialDateStr={selectedDailyPlanDate}
          onToggleStatus={handleToggleScheduleStatus}
          onToggleHabit={handleCheckHabitStreak}
          onStartFocus={(taskTitle, durationMinutes, blockId) =>
            setFocusSession({ isOpen: true, taskTitle, durationMinutes, blockId })
          }
          onAdjustCapacity={() => setIsSettingsOpen(true)}
          onOpenShapeMyDay={(targetDate) => {
            const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
            if (targetDate && targetDate < todayIST) {
              return;
            }
            setShapeTargetDate(targetDate);
            setIsShapeMyDayOpen(true);
          }}
          onSelectGoal={(goalId) => {
            setSelectedGoalId(goalId);
            setCurrentTab('learning');
          }}
          onSelectTab={setCurrentTab}
        />
      )}

      {currentTab === 'tasks' && (
        <Tasks
          tasks={tasks}
          habits={habits}
          weeklyGoals={weeklyGoals}
          onAddTask={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
          onEditTask={(task) => { setEditingTask(task); setIsTaskModalOpen(true); }}
          onToggleStatus={handleToggleTaskStatus}
          onAddHabit={() => { setEditingHabit(null); setIsHabitModalOpen(true); }}
          onEditHabit={(habit) => { setEditingHabit(habit); setIsHabitModalOpen(true); }}
          onCheckHabitStreak={handleCheckHabitStreak}
          onDeleteHabit={handleDeleteHabit}
          onAddWeeklyGoal={() => { setEditingWeeklyGoal(null); setIsWeeklyGoalModalOpen(true); }}
          onEditWeeklyGoal={(goal) => { setEditingWeeklyGoal(goal); setIsWeeklyGoalModalOpen(true); }}
          onDeleteWeeklyGoal={handleDeleteWeeklyGoal}
          onQuickAddTodo={handleQuickAddTodo}
          onIncrementWeeklyGoal={handleIncrementWeeklyGoal}
          onOpenShapeMyDay={() => setIsShapeMyDayOpen(true)}
        />
      )}

      {currentTab === 'learning' && (
        <LearningPaths
          goals={goals}
          selectedGoalId={selectedGoalId}
          onSelectGoalId={setSelectedGoalId}
          onNewPath={() => setIsGoalModalOpen(true)}
          onToggleTopic={handleToggleGoalTopic}
          onDeletePath={handleDeleteGoal}
          onStartFocus={(taskTitle, durationMinutes) =>
            setFocusSession({ isOpen: true, taskTitle, durationMinutes })
          }
        />
      )}

      {currentTab === 'patterns' && (
        <Patterns
          stats={stats}
          onSelectTab={setCurrentTab}
          onOpenShapeMyDay={() => setIsShapeMyDayOpen(true)}
        />
      )}

      {/* Modals */}
      <ShapeMyDayModal
        isOpen={isShapeMyDayOpen}
        targetDate={shapeTargetDate}
        habits={habits}
        weeklyGoals={weeklyGoals}
        tasks={tasks}
        goals={goals}
        onClose={() => {
          setIsShapeMyDayOpen(false);
          setShapeTargetDate(undefined);
        }}
        onSubmit={handleShapeMyDaySubmit}
      />

      <TaskModal
        isOpen={isTaskModalOpen}
        task={editingTask}
        onClose={() => { setIsTaskModalOpen(false); setEditingTask(null); }}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />

      <GoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onSave={handleSaveGoal}
      />

      <HabitModal
        isOpen={isHabitModalOpen}
        habit={editingHabit}
        onClose={() => { setIsHabitModalOpen(false); setEditingHabit(null); }}
        onSave={handleSaveHabit}
      />

      <WeeklyGoalModal
        isOpen={isWeeklyGoalModalOpen}
        goal={editingWeeklyGoal}
        longTermGoals={goals}
        onClose={() => { setIsWeeklyGoalModalOpen(false); setEditingWeeklyGoal(null); }}
        onSave={handleSaveWeeklyGoal}
        onDelete={handleDeleteWeeklyGoal}
      />

      <FocusSessionModal
        isOpen={focusSession.isOpen}
        taskTitle={focusSession.taskTitle}
        durationMinutes={focusSession.durationMinutes}
        onClose={() => setFocusSession({ isOpen: false, taskTitle: '', durationMinutes: 60 })}
        onComplete={async () => {
          if (focusSession.blockId) {
            await handleToggleScheduleStatus(focusSession.blockId);
          }
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
          loadData();
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        maxCapacity={maxCapacityHours}
        onUpdateCapacity={setMaxCapacityHours}
      />
    </Layout>
  );
};

export default App;
