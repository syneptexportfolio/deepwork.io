import React, { useState, useEffect } from 'react';
import { Layout, NavTab } from './components/Layout';
import { Overview } from './components/Overview';
import { DailyPlan } from './components/DailyPlan';
import { Tasks } from './components/Tasks';
import { LearningPaths } from './components/LearningPaths';
import { ShapeMyDayModal } from './components/modals/ShapeMyDayModal';
import { TaskModal } from './components/modals/TaskModal';
import { GoalModal } from './components/modals/GoalModal';
import { HabitModal } from './components/modals/HabitModal';
import { WeeklyGoalModal } from './components/modals/WeeklyGoalModal';
import { FocusSessionModal } from './components/modals/FocusSessionModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { PasscodeGate } from './components/PasscodeGate';
import { api, Goal, Habit, QuestionnaireAnswers, ScheduleBlock, StatsResponse, Task, WeeklyGoal, isBreakOrRestBlock } from './services/api';
import confetti from 'canvas-confetti';

const getCachedJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(`luma_cache_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const setCachedJson = (key: string, data: any) => {
  try {
    localStorage.setItem(`luma_cache_${key}`, JSON.stringify(data));
  } catch {}
};

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [tasks, setTasks] = useState<Task[]>(() => getCachedJson<Task[]>('tasks', []));
  const [habits, setHabits] = useState<Habit[]>(() => getCachedJson<Habit[]>('habits', []));
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>(() => getCachedJson<WeeklyGoal[]>('weeklyGoals', []));
  const [goals, setGoals] = useState<Goal[]>(() => getCachedJson<Goal[]>('goals', []));
  const [selectedGoalId, setSelectedGoalId] = useState<string>(() => {
    const cached = getCachedJson<Goal[]>('goals', []);
    return cached[0]?.id || '';
  });
  const [schedule, setSchedule] = useState<ScheduleBlock[]>(() => getCachedJson<ScheduleBlock[]>('schedule', []));
  const [stats, setStats] = useState<StatsResponse | null>(() => getCachedJson<StatsResponse | null>('stats', null));

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
  const [toastMessage, setToastMessage] = useState<{ text: string; type?: 'info' | 'error' | 'success' } | null>(null);

  const showToast = (text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 4000);
  };

  const getTodayISTStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

  // Fast parallel load with cache write
  const loadData = async () => {
    try {
      const todayDateStr = getTodayISTStr();

      // Launch all initial requests in parallel
      const [healthRes, tasksRes, habitsRes, weeklyRes, goalsRes, schedRes, statsRes] = await Promise.all([
        api.checkHealth().catch(() => ({ status: 'error', hasPasscode: false })),
        api.getTasks(todayDateStr).catch((err: any) => {
          if (err?.message?.includes('401') || err?.message?.includes('Passcode')) {
            setIsLocked(true);
          }
          return { success: true, tasks: [] };
        }),
        api.getHabits().catch(() => ({ success: true, habits: [] })),
        api.getWeeklyGoals().catch(() => ({ success: true, weeklyGoals: [] })),
        api.getGoals().catch(() => ({ success: true, goals: [] })),
        api.getTodaySchedule().catch(() => ({ success: true, schedule: [] })),
        api.getStats().catch(() => ({ success: true, stats: null })),
      ]);

      if (healthRes.hasPasscode && tasksRes.tasks === undefined) {
        setIsLocked(true);
        return;
      }

      if (tasksRes.tasks) {
        setTasks(tasksRes.tasks);
        setCachedJson('tasks', tasksRes.tasks);
      }
      if (habitsRes.habits) {
        setHabits(habitsRes.habits);
        setCachedJson('habits', habitsRes.habits);
      }
      if (weeklyRes.weeklyGoals) {
        setWeeklyGoals(weeklyRes.weeklyGoals);
        setCachedJson('weeklyGoals', weeklyRes.weeklyGoals);
      }
      if (goalsRes.goals) {
        setGoals(goalsRes.goals);
        setCachedJson('goals', goalsRes.goals);
        if (!selectedGoalId && goalsRes.goals.length > 0) {
          setSelectedGoalId(goalsRes.goals[0].id);
        }
      }
      if (schedRes.schedule) {
        setSchedule(schedRes.schedule);
        setCachedJson('schedule', schedRes.schedule);
      }
      if (statsRes.stats) {
        setStats(statsRes.stats);
        setCachedJson('stats', statsRes.stats);
      }
    } catch (err) {
      console.error('Failed to load app data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers

  const handleToggleScheduleStatus = async (scheduleId: string, dateStr?: string) => {
    if (dateStr && dateStr < getTodayISTStr()) {
      showToast('Cannot modify tasks for past dates. Past schedules are archived.', 'error');
      return;
    }
    const block = schedule.find(s => s.id === scheduleId);
    if (block && isBreakOrRestBlock(block)) {
      return; // Never toggle or count breaks as tasks
    }
    const newStatus = block ? (block.status === 'done' ? 'pending' : 'done') : 'done';

    if (newStatus === 'done') {
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
    }

    setSchedule(prev => prev.map(s => s.id === scheduleId ? { ...s, status: newStatus } : s));
    if (block && block.task_id) {
      setTasks(prev => prev.map(t => t.id === block.task_id ? { ...t, status: newStatus } : t));
    } else if (block && block.title) {
      // Fallback: match by title if task_id was unassigned
      const bTitle = block.title.toLowerCase().trim();
      setTasks(prev => prev.map(t => t.title.toLowerCase().trim() === bTitle ? { ...t, status: newStatus } : t));
    }

    try {
      await api.updateScheduleBlock(scheduleId, newStatus, dateStr);
      api.getStats().then(statsRes => {
        if (statsRes?.stats) {
          setStats(statsRes.stats);
          setCachedJson('stats', statsRes.stats);
        }
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to toggle schedule block in backend:', err);
    }
  };

  const handleToggleTaskStatus = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === 'done' ? 'pending' : 'done';

    if (newStatus === 'done') {
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
    }

    // 1. Optimistic task update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    // 2. Bidirectional sync with active schedule
    const matchingBlock = schedule.find(s => s.task_id === taskId || s.title.toLowerCase().trim() === task.title.toLowerCase().trim());
    if (matchingBlock && matchingBlock.status !== newStatus && !isBreakOrRestBlock(matchingBlock)) {
      setSchedule(prev => prev.map(s => s.id === matchingBlock.id ? { ...s, status: newStatus } : s));
      api.updateScheduleBlock(matchingBlock.id, newStatus).catch(() => {});
    }

    try {
      await api.updateTask(taskId, { status: newStatus });
      api.getStats().then(statsRes => {
        if (statsRes?.stats) {
          setStats(statsRes.stats);
          setCachedJson('stats', statsRes.stats);
        }
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to toggle task status in backend:', err);
    }
  };

  const handleCheckHabitStreak = async (habitId: string) => {
    const todayIST = getTodayISTStr();
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const isCurrentlyDone = habit.last_completed_date === todayIST;
    const nextIsDone = !isCurrentlyDone;

    if (nextIsDone) {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    }

    // 1. Instant 0ms Optimistic UI feedback
    const optimisticHabit: Habit = {
      ...habit,
      last_completed_date: nextIsDone ? todayIST : undefined,
      streak_count: nextIsDone ? (habit.streak_count || 0) + 1 : Math.max(0, (habit.streak_count || 1) - 1),
    };

    setHabits(prev => prev.map(h => h.id === habitId ? optimisticHabit : h));

    // 2. Background server sync
    try {
      const res = await api.checkHabitStreak(habitId);
      if (res.habit) {
        setHabits(prev => prev.map(h => h.id === habitId ? res.habit : h));
      }
      api.getStats().then(s => {
        if (s?.stats) {
          setStats(s.stats);
          setCachedJson('stats', s.stats);
        }
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to update habit streak:', err);
      // Revert on error
      setHabits(prev => prev.map(h => h.id === habitId ? habit : h));
      showToast('Failed to update habit streak', 'error');
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
      // Instant modal close!
      setIsHabitModalOpen(false);
      setEditingHabit(null);
      api.getStats().then(s => { if (s?.stats) setStats(s.stats); }).catch(() => {});
    } catch (err: any) {
      console.error('Failed to save habit:', err);
      showToast(err.message || 'Failed to save habit', 'error');
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
      // Instant modal close!
      setIsWeeklyGoalModalOpen(false);
      setEditingWeeklyGoal(null);
      api.getStats().then(s => { if (s?.stats) setStats(s.stats); }).catch(() => {});
    } catch (err: any) {
      console.error('Failed to save weekly goal:', err);
      showToast(err.message || 'Failed to save weekly goal', 'error');
    }
  };

  const handleDeleteHabit = async (id: string) => {
    try {
      await api.deleteHabit(id);
      setHabits(prev => prev.filter(h => h.id !== id));
      api.getStats().then(s => { if (s?.stats) setStats(s.stats); }).catch(() => {});
    } catch (err: any) {
      showToast(err.message || 'Failed to delete habit', 'error');
    }
  };

  const handleDeleteWeeklyGoal = async (id: string) => {
    try {
      await api.deleteWeeklyGoal(id);
      setWeeklyGoals(prev => prev.filter(wg => wg.id !== id));
      api.getStats().then(s => { if (s?.stats) setStats(s.stats); }).catch(() => {});
    } catch (err: any) {
      console.error('Failed to delete weekly goal:', err);
      showToast(err.message || 'Failed to delete weekly goal', 'error');
    }
  };

  const handleCopyPreviousHabits = async () => {
    try {
      const res = await api.copyPreviousHabits();
      if (res.success) {
        await loadData();
      }
    } catch (err: any) {
      console.error('Failed to copy previous habits:', err);
    }
  };

  const handleCopyPreviousWeeklyGoals = async () => {
    try {
      const res = await api.copyPreviousWeeklyGoals();
      if (res.success) {
        await loadData();
      }
    } catch (err: any) {
      console.error('Failed to copy previous weekly goals:', err);
    }
  };

  const handleUpdateWeeklyGoalProgress = async (id: string, newUnits: number) => {
    const targetGoal = weeklyGoals.find(wg => wg.id === id);
    if (!targetGoal) return;

    const clampedUnits = Math.max(0, Math.min(targetGoal.target_units, newUnits));
    const wasAchieved = targetGoal.completed_units >= targetGoal.target_units;
    const nowAchieved = clampedUnits >= targetGoal.target_units;

    if (nowAchieved && !wasAchieved) {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    }

    // Optimistic local update across all pages
    setWeeklyGoals(prev => prev.map(wg => {
      if (wg.id !== id) return wg;
      const progressPercent = Math.min(100, Math.round((clampedUnits / Math.max(wg.target_units, 1)) * 100));
      return {
        ...wg,
        completed_units: clampedUnits,
        progressPercent,
      };
    }));

    try {
      const res = await api.updateWeeklyGoal(id, { completed_units: clampedUnits });
      if (res.weeklyGoal) {
        setWeeklyGoals(prev => prev.map(wg => wg.id === id ? res.weeklyGoal : wg));
      }
      const statsRes = await api.getStats().catch(() => null);
      if (statsRes?.stats) setStats(statsRes.stats);
    } catch (err) {
      console.error('Failed to update weekly goal progress:', err);
      await loadData();
    }
  };

  const handleIncrementWeeklyGoal = async (id: string, currentCompleted: number) => {
    await handleUpdateWeeklyGoalProgress(id, currentCompleted + 1);
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
        task_date: getTodayISTStr(),
      });
      if (res.task) {
        setTasks(prev => [res.task, ...prev]);
      }
      api.getStats().then(s => { if (s?.stats) setStats(s.stats); }).catch(() => {});
    } catch (err: any) {
      showToast(err.message || 'Failed to add quick to-do', 'error');
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
      showToast('Past days cannot be shaped. Please choose today or an upcoming day.', 'info');
      return;
    }
    await api.submitQuestionnaire(answers);
    const res = await api.generateSchedule(answers, targetDate);
    if (res.schedule) {
      if (!targetDate || targetDate === todayIST) {
        setSchedule(res.schedule);
        setCachedJson('schedule', res.schedule);
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
        const res = await api.createTask({
          ...taskData,
          task_date: taskData.task_date || getTodayISTStr(),
        });
        if (res.task) {
          setTasks(prev => [res.task, ...prev]);
        }
      }
      // Instant modal close!
      setIsTaskModalOpen(false);
      setEditingTask(null);
      api.getStats().then(s => { if (s?.stats) setStats(s.stats); }).catch(() => {});
    } catch (err: any) {
      showToast(err.message || 'Failed to save task', 'error');
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await api.deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      api.getStats().then(s => { if (s?.stats) setStats(s.stats); }).catch(() => {});
    } catch (err: any) {
      showToast(err.message || 'Failed to delete task', 'error');
    }
  };

  const handleSaveGoal = async (goalData: Partial<Goal>) => {
    try {
      const res = await api.createGoal(goalData);
      if (res.goal) {
        setGoals(prev => [...prev, res.goal]);
        if (!selectedGoalId) {
          setSelectedGoalId(res.goal.id);
        }
      }
      // Instant modal close!
      setIsGoalModalOpen(false);
      api.getStats().then(s => { if (s?.stats) setStats(s.stats); }).catch(() => {});
    } catch (err: any) {
      showToast(err.message || 'Failed to create learning path', 'error');
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
      api.getStats().then(s => { if (s?.stats) setStats(s.stats); }).catch(() => {});
    } catch (err: any) {
      showToast(err.message || 'Failed to delete learning path', 'error');
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
          weeklyGoals={weeklyGoals}
          goals={goals}
          tasks={tasks}
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
          onUpdateWeeklyGoalProgress={handleUpdateWeeklyGoalProgress}
          onTaskCreated={(newTask) => setTasks(prev => [newTask, ...prev])}
          onScheduleUpdated={(newSchedule, dateStr) => {
            const todayIST = getTodayISTStr();
            if (dateStr === todayIST) {
              setSchedule(newSchedule);
            }
          }}
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
          onDeleteHabit={handleDeleteHabit}
          onAddWeeklyGoal={() => { setEditingWeeklyGoal(null); setIsWeeklyGoalModalOpen(true); }}
          onEditWeeklyGoal={(goal) => { setEditingWeeklyGoal(goal); setIsWeeklyGoalModalOpen(true); }}
          onDeleteWeeklyGoal={handleDeleteWeeklyGoal}
          onQuickAddTodo={handleQuickAddTodo}
          onIncrementWeeklyGoal={handleIncrementWeeklyGoal}
          onUpdateWeeklyGoalProgress={handleUpdateWeeklyGoalProgress}
          onCopyPreviousHabits={handleCopyPreviousHabits}
          onCopyPreviousWeeklyGoals={handleCopyPreviousWeeklyGoals}
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

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#1d1f1d] border border-white/10 shadow-2xl text-white text-xs font-medium animate-fadeIn">
          <span className={`w-2 h-2 rounded-full ${toastMessage.type === 'error' ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]' : toastMessage.type === 'success' ? 'bg-luma-lime shadow-[0_0_8px_rgba(212,249,56,0.5)]' : 'bg-luma-purple'}`} />
          <span>{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-white/40 hover:text-white transition-colors cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>
      )}
    </Layout>
  );
};

export default App;
