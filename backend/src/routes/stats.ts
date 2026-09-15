import { Hono } from 'hono';
import { Env, Task } from '../types';

export const statsRouter = new Hono<{ Bindings: Env }>();

// GET /api/stats
statsRouter.get('/', async (c) => {
  try {
    const { results: tasks } = await c.env.DB.prepare('SELECT * FROM tasks').all<Task>();
    const allTasks = tasks || [];

    // Check all schedules for historical pattern calculation
    const { results: allSchedules } = await c.env.DB.prepare(
      'SELECT id, date, generated_plan FROM schedules ORDER BY date ASC'
    ).all<any>();
    const scheduleRows = allSchedules || [];

    // Today's or latest schedule
    const latestSched = scheduleRows.length > 0 ? scheduleRows[scheduleRows.length - 1] : null;

    let focusMinutes = 0;
    let doneCount = 0;
    let totalCount = 0;
    let nextSession = '10:30';

    if (latestSched && latestSched.generated_plan) {
      try {
        const blocks: any[] = JSON.parse(latestSched.generated_plan);
        const activeBlocks = blocks.filter(b => b.type !== 'break');
        const doneBlocks = activeBlocks.filter(b => b.status === 'done');
        const nextPending = activeBlocks.find(b => b.status === 'pending');

        doneCount = doneBlocks.length;
        totalCount = activeBlocks.length;
        if (nextPending) {
          nextSession = nextPending.start_time;
        } else if (doneCount === totalCount && totalCount > 0) {
          nextSession = 'Complete';
        }

        focusMinutes = blocks
          .filter(b => b.type === 'deep_focus')
          .reduce((sum, b) => sum + (b.duration || 0), 0);
      } catch (e) {
        console.error('Failed to parse schedule plan in stats:', e);
      }
    }

    // If no schedule blocks found, check tasks table
    if (totalCount === 0) {
      doneCount = allTasks.filter(t => t.status === 'done').length;
      const pendingCount = allTasks.filter(t => t.status === 'pending').length;
      totalCount = doneCount + pendingCount;
      focusMinutes = allTasks
        .filter(t => t.energy_level === 'deep_focus')
        .reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
    }

    const hasAnyContent = allTasks.length > 0 || totalCount > 0 || scheduleRows.length > 0;
    const focusHours = Math.floor(focusMinutes / 60);
    const remainingMinutes = focusMinutes % 60;
    const focusFormatted = focusMinutes > 0 ? `${focusHours}h ${remainingMinutes}m` : '0h 0m';
    const rhythmRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
    const promisesFormatted = totalCount > 0 ? `${doneCount}/${totalCount}` : '0/0';

    if (!hasAnyContent) {
      nextSession = 'None scheduled';
    }

    // Dynamic Weekly Pattern (Mon - Sun of current week)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const distToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distToMonday);

    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const scheduleByDate = new Map<string, any[]>();
    for (const row of scheduleRows) {
      try {
        scheduleByDate.set(row.date, JSON.parse(row.generated_plan));
      } catch {}
    }

    let totalWeekFocusHours = 0;
    const weeklyPatternDays = dayLabels.map((dayLabel, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const dateStr = d.toISOString().split('T')[0];
      const dayBlocks = scheduleByDate.get(dateStr) || [];

      const dayFocusMins = dayBlocks
        .filter(b => b.type === 'deep_focus')
        .reduce((sum, b) => sum + (b.duration || 0), 0);
      const hrs = Math.round((dayFocusMins / 60) * 10) / 10;
      totalWeekFocusHours += hrs;

      return {
        day: dayLabel,
        heightPercent: Math.min(100, Math.round((hrs / 8) * 100)),
        hours: hrs
      };
    });

    // Dynamic Weekly Capacity
    const maxCapacityHours = 32;
    const currentCapHours = Math.round(totalWeekFocusHours > 0 ? totalWeekFocusHours : (focusMinutes / 60));
    const capPercentage = Math.min(100, Math.round((currentCapHours / maxCapacityHours) * 100));

    // Dynamic Time-of-Day Split (Morning vs Afternoon completion)
    let totalMorningDone = 0;
    let totalAfternoonDone = 0;
    for (const [, blocks] of scheduleByDate) {
      for (const b of blocks) {
        if (b.status === 'done' && b.type !== 'break') {
          const startH = parseInt((b.start_time || '12:00').split(':')[0], 10);
          if (startH < 12) totalMorningDone++;
          else totalAfternoonDone++;
        }
      }
    }
    const totalDoneAll = totalMorningDone + totalAfternoonDone;
    const morningPercent = totalDoneAll > 0 ? Math.round((totalMorningDone / totalDoneAll) * 100) : 50;
    const afternoonPercent = totalDoneAll > 0 ? (100 - morningPercent) : 50;

    // Dynamic Heatmap (Morning, Afternoon, Evening completion across the 7 days of the week)
    const computePeriodRates = (filterFn: (startH: number) => boolean) => {
      return dayLabels.map((_, idx) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + idx);
        const dateStr = d.toISOString().split('T')[0];
        const dayBlocks = (scheduleByDate.get(dateStr) || []).filter(b => {
          if (b.type === 'break') return false;
          const h = parseInt((b.start_time || '12:00').split(':')[0], 10);
          return filterFn(h);
        });
        if (dayBlocks.length === 0) return 0;
        const done = dayBlocks.filter(b => b.status === 'done').length;
        return Math.round((done / dayBlocks.length) * 100);
      });
    };

    const heatmap = [
      { period: 'Morning', days: computePeriodRates(h => h < 12) },
      { period: 'Afternoon', days: computePeriodRates(h => h >= 12 && h < 17) },
      { period: 'Evening', days: computePeriodRates(h => h >= 17) }
    ];

    // Dynamic Trend Points (Last up to 10 recorded schedule days)
    let trendPoints: Array<{ date: string; value: number }> = [];
    if (scheduleRows.length > 0) {
      trendPoints = scheduleRows.slice(-10).map((row: any) => {
        try {
          const blocks: any[] = JSON.parse(row.generated_plan);
          const active = blocks.filter(b => b.type !== 'break');
          const done = active.filter(b => b.status === 'done').length;
          const rate = active.length > 0 ? Math.round((done / active.length) * 100) : 0;
          const dObj = new Date(row.date);
          const label = isNaN(dObj.getTime())
            ? row.date
            : dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return { date: label, value: rate };
        } catch {
          return { date: row.date, value: 0 };
        }
      });
    } else {
      trendPoints = [{ date: 'Today', value: rhythmRate }];
    }

    // Dynamic Insight
    let insight = 'No focus blocks logged yet. Generate your daily plan or add tasks to build your personal rhythm analytics.';
    if (hasAnyContent) {
      if (totalMorningDone > totalAfternoonDone) {
        insight = `Morning focus blocks have a ${morningPercent}% completion rate. Keep your highest-weight priorities before lunch.`;
      } else if (totalAfternoonDone > totalMorningDone) {
        insight = `Afternoon momentum is strong (${afternoonPercent}%). Schedule your deep building sprints post-lunch.`;
      } else {
        insight = 'Your daily rhythm is balanced across morning and afternoon focus sessions. Maintain steady pacing.';
      }
    }

    return c.json({
      success: true,
      stats: {
        protectedFocus: {
          formatted: focusFormatted,
          difference: totalCount > 0 ? `+${focusMinutes}m planned today` : '0m',
          totalMinutes: focusMinutes
        },
        promisesKept: {
          formatted: promisesFormatted,
          nextSession,
          done: doneCount,
          total: totalCount
        },
        weeklyRhythm: {
          rate: rhythmRate,
          diff: rhythmRate > 0 ? `↑ ${rhythmRate}% completion rate` : '0%'
        },
        weeklyCapacity: {
          currentHours: currentCapHours,
          maxHours: maxCapacityHours,
          percentage: capPercentage
        },
        weeklyPatternDays,
        patterns: {
          morningPercent,
          afternoonPercent,
          insight,
          heatmap,
          trendPoints
        }
      }
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
