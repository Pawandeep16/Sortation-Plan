import { useState, useEffect } from 'react';
import { Play, Square, CreditCard as Edit2, Trash2, Coffee, X, Check } from 'lucide-react';
import { firebaseService } from '../lib/firebase';
import { formatDateTime, calculateDuration, formatDuration, getToday } from '../lib/utils';
import { useBreakContext } from '../context/BreakContext';

interface Employee {
  id: string;
  name: string;
  employment_type: string;
}

interface Department {
  id: string;
  name: string;
}

interface Task {
  id: string;
  name: string;
  department_id: string;
}

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
}

interface TimeEntry {
  id: string;
  employee_id: string;
  task_id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  date: string;
  shift_id?: string;
  break_duration?: number;
}

interface Break {
  id: string;
  entry_id: string;
  type: 'paid_15' | 'unpaid_30';
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
}

interface ActiveTimer {
  timeEntryId: string;
  employeeId: string;
  taskId: string;
  startTime: Date;
  elapsedTime: number;
  employeeName: string;
  taskName: string;
  shiftName?: string;
  isBreak?: boolean;
  breakType?: 'paid_15' | 'unpaid_30';
}

export default function SortationPlan() {
  const { employeesOnBreak, isEmployeeOnBreak, setEmployeeOnBreak } = useBreakContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [allBreaks, setAllBreaks] = useState<Break[]>([]);

  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedTask, setSelectedTask] = useState('');
  const [selectedShift, setSelectedShift] = useState(() => {
    const stored = localStorage.getItem('taskTrackerSelectedShift') || '';
    return stored;
  });
  const [filterShift, setFilterShift] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterEmploymentType, setFilterEmploymentType] = useState<'all' | 'regular' | 'temporary'>('all');
  const [activeTimers, setActiveTimers] = useState<Map<string, ActiveTimer>>(new Map());
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ start_time: '', end_time: '', break_duration: 0 });
  const [breakCounters, setBreakCounters] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchData();
    recoverActiveTimers();
    const interval = setInterval(async () => {
      setActiveTimers(prev => {
        const updated = new Map(prev);
        updated.forEach((timer, key) => {
          updated.set(key, { ...timer, elapsedTime: timer.elapsedTime + 1 });
        });
        return updated;
      });

      setBreakCounters(prev => {
        const updated = { ...prev };
        const breaksToEnd = [];
        for (const key in updated) {
          if (updated[key] > 0) {
            updated[key] -= 1;
            if (updated[key] === 0) {
              breaksToEnd.push(key);
            }
          }
        }
        saveBreakCountersToStorage(updated);

        if (breaksToEnd.length > 0) {
          breaksToEnd.forEach(breakId => {
            const breakRecord = allBreaks.find(b => b.id === breakId);
            if (breakRecord && !breakRecord.end_time) {
              const endTime = new Date().toISOString();
              const durationMinutes = breakRecord.start_time ? calculateDuration(new Date(breakRecord.start_time), new Date()) : 0;
              firebaseService.updateBreak(breakId, {
                end_time: endTime,
                duration_minutes: durationMinutes,
              }).then(() => {
                fetchData();
              });
            }
          });
        }

        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [allBreaks]);

  useEffect(() => {
    localStorage.setItem('taskTrackerSelectedShift', selectedShift);
  }, [selectedShift]);

  useEffect(() => {
    const fetchEmployeeShift = async () => {
      if (selectedEmployee) {
        const employeeShift = await firebaseService.getEmployeeShiftForDate(selectedEmployee, getToday());
        if (employeeShift) {
          setSelectedShift(employeeShift.shift_id);
        } else {
          setSelectedShift('');
        }
      }
    };
    fetchEmployeeShift();
  }, [selectedEmployee]);

  useEffect(() => {
    const refreshData = async () => {
      const [shfts, empShifts] = await Promise.all([
        firebaseService.getShifts(),
        firebaseService.getEmployeeShifts(),
      ]);
      setShifts(shfts);
      if (selectedEmployee) {
        const empShift = empShifts.find(es => es.employee_id === selectedEmployee && es.assigned_date === getToday());
        if (empShift) {
          setSelectedShift(empShift.shift_id);
        }
      }
    };
    refreshData();
  }, [timeEntries, selectedEmployee]);

  const fetchData = async () => {
    const [emps, depts, tsk, shfts, entries, breaks] = await Promise.all([
      firebaseService.getEmployees(),
      firebaseService.getDepartments(),
      firebaseService.getTasks(),
      firebaseService.getShifts(),
      firebaseService.getTimeEntries(getToday()),
      firebaseService.getAllBreaks(),
    ]);

    setEmployees(emps);
    setDepartments(depts);
    setTasks(tsk);
    setShifts(shfts);
    setTimeEntries(entries);
    setAllBreaks(breaks);
  };

  const recoverActiveTimers = async () => {
    try {
      const stored = localStorage.getItem('activeTimers');
      const storedBreaks = localStorage.getItem('breakCounters');
      if (stored) {
        const timersData = JSON.parse(stored);
        const recovered = new Map<string, ActiveTimer>();

        for (const [key, timer]: [string, any] of Object.entries(timersData)) {
          const elapsed = Math.floor((Date.now() - new Date(timer.startTime).getTime()) / 1000);
          recovered.set(key, {
            ...timer,
            startTime: new Date(timer.startTime),
            elapsedTime: elapsed,
          });
        }

        setActiveTimers(recovered);
      }

      if (storedBreaks) {
        const breaksData = JSON.parse(storedBreaks);
        const recoveredCounters: Record<string, number> = {};

        for (const [breakId, data]: [string, any] of Object.entries(breaksData)) {
          const startTime = new Date(data.startTime).getTime();
          const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
          const remainingSeconds = Math.max(0, data.totalSeconds - elapsedSeconds);
          recoveredCounters[breakId] = remainingSeconds;
        }

        setBreakCounters(recoveredCounters);
      }
    } catch (error) {
      console.error('Error recovering timers:', error);
    }
  };

  const saveActiveTimersToStorage = (timers: Map<string, ActiveTimer>) => {
    const data = Object.fromEntries(
      Array.from(timers.entries()).map(([key, timer]) => [
        key,
        {
          ...timer,
          startTime: timer.startTime.toISOString(),
        },
      ])
    );
    localStorage.setItem('activeTimers', JSON.stringify(data));
  };

  const saveBreakCountersToStorage = (counters: Record<string, number>) => {
    const data: Record<string, any> = {};
    for (const [breakId, remaining] of Object.entries(counters)) {
      if (remaining > 0) {
        data[breakId] = {
          totalSeconds: remaining,
          startTime: new Date().toISOString(),
        };
      }
    }
    localStorage.setItem('breakCounters', JSON.stringify(data));
  };

  const getBreakTypeName = (type: 'paid_15' | 'unpaid_30'): string => {
    return type === 'paid_15' ? '15 minute break' : '30 min unpaid break';
  };

  const getBreaksForEntry = (entryId: string): Break[] => {
    return allBreaks.filter(b => b.entry_id === entryId);
  };

  const filteredTasks = selectedDepartment
    ? tasks.filter(t => t.department_id === selectedDepartment)
    : [];

  const handleStartTask = async () => {
    if (!selectedEmployee || !selectedTask) return;

    if (isEmployeeOnBreak(selectedEmployee)) {
      alert('This employee is currently on a break. End the break before starting a new task.');
      return;
    }

    const emp = employees.find(e => e.id === selectedEmployee);
    const tsk = tasks.find(t => t.id === selectedTask);
    const shift = selectedShift ? shifts.find(s => s.id === selectedShift) : null;
    if (!emp || !tsk) return;

    const startTime = new Date();
    const entry = await firebaseService.addTimeEntry(selectedEmployee, selectedTask, getToday(), selectedShift || undefined);

    const newTimer: ActiveTimer = {
      timeEntryId: entry.id,
      employeeId: selectedEmployee,
      taskId: selectedTask,
      startTime,
      elapsedTime: 0,
      employeeName: emp.name,
      taskName: tsk.name,
      shiftName: shift?.name,
      isBreak: false,
    };

    const updatedTimers = new Map(activeTimers);
    updatedTimers.set(entry.id, newTimer);
    setActiveTimers(updatedTimers);
    saveActiveTimersToStorage(updatedTimers);

    fetchData();
    setSelectedEmployee('');
    setSelectedTask('');
    setSelectedShift('');
    setSelectedDepartment('');
  };

  const handleEndTask = async (timerId: string) => {
    const timer = activeTimers.get(timerId);
    if (!timer) return;

    const endTime = new Date();
    const durationMinutes = calculateDuration(timer.startTime, endTime);

    await firebaseService.updateTimeEntry(timerId, {
      end_time: endTime.toISOString(),
      duration_minutes: durationMinutes,
    });

    setTimeEntries(prev =>
      prev.map(entry =>
        entry.id === timerId
          ? { ...entry, end_time: endTime.toISOString(), duration_minutes: durationMinutes }
          : entry
      )
    );

    const updatedTimers = new Map(activeTimers);
    updatedTimers.delete(timerId);
    setActiveTimers(updatedTimers);
    saveActiveTimersToStorage(updatedTimers);

    fetchData();
  };

  const handleStartBreak = async (employeeId: string, breakType: 'paid_15' | 'unpaid_30') => {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;

    const todayEntries = timeEntries.filter(e => e.employee_id === employeeId && e.date === getToday());
    const shiftEntries = selectedShift ? todayEntries.filter(e => e.shift_id === selectedShift) : todayEntries;

    if (shiftEntries.length === 0) {
      alert('Employee has no active task for this shift. Start a task first.');
      return;
    }

    const lastEntry = shiftEntries[shiftEntries.length - 1];
    const breaksForToday = allBreaks.filter(b => {
      const matchingEntry = todayEntries.find(e => e.id === b.entry_id);
      return matchingEntry !== undefined;
    });

    const paidBreakExists = breaksForToday.some(b => b.type === 'paid_15');
    const unpaidBreakExists = breaksForToday.some(b => b.type === 'unpaid_30');

    if (breakType === 'paid_15' && paidBreakExists) {
      alert('Employee already has a 15-minute paid break today. Only one paid break allowed per employee per day.');
      return;
    }

    if (breakType === 'unpaid_30' && unpaidBreakExists) {
      alert('Employee already has a 30-minute unpaid break today. Only one unpaid break allowed per employee per day.');
      return;
    }

    const endTime = new Date().toISOString();
    let updatedLastEntry = lastEntry;

    if (lastEntry.end_time === null) {
      const durationMinutes = calculateDuration(new Date(lastEntry.start_time), new Date());

      await firebaseService.updateTimeEntry(lastEntry.id, {
        end_time: endTime,
        duration_minutes: durationMinutes,
      });

      updatedLastEntry = { ...lastEntry, end_time: endTime, duration_minutes: durationMinutes };

      setTimeEntries(prev =>
        prev.map(entry =>
          entry.id === lastEntry.id
            ? updatedLastEntry
            : entry
        )
      );
    }

    const breakDuration = breakType === 'paid_15' ? 15 * 60 : 30 * 60;
    const startTime = new Date().toISOString();
    const newBreak = await firebaseService.addBreak(lastEntry.id, breakType, startTime);

    setBreakCounters(prev => {
      const updated = {
        ...prev,
        [newBreak.id]: breakDuration,
      };
      saveBreakCountersToStorage(updated);
      return updated;
    });

    setEmployeeOnBreak(employeeId, true);
    window.dispatchEvent(new CustomEvent('breakStarted', { detail: { employeeId } }));

    const shift = shifts.find(s => s.id === selectedShift);
    const newTimer: ActiveTimer = {
      timeEntryId: newBreak.id,
      employeeId: employeeId,
      taskId: 'break',
      startTime: new Date(),
      elapsedTime: 0,
      employeeName: emp.name,
      taskName: `${breakType === 'paid_15' ? '15 min Paid' : '30 min Unpaid'} Break`,
      shiftName: shift?.name,
      isBreak: true,
      breakType: breakType,
    };

    const updatedTimers = new Map(activeTimers);

    const employeeActiveTaskTimer = Array.from(activeTimers.entries()).find(
      ([_, timer]) => timer.employeeId === employeeId && !timer.isBreak
    );
    if (employeeActiveTaskTimer) {
      updatedTimers.delete(employeeActiveTaskTimer[0]);
    }

    updatedTimers.set(newBreak.id, newTimer);
    setActiveTimers(updatedTimers);
    saveActiveTimersToStorage(updatedTimers);

    setSelectedEmployee('');
    setSelectedTask('');
    setSelectedDepartment('');
    setSelectedShift('');

    setAllBreaks(prev => [...prev, newBreak]);
  };

  const handleEndBreak = async (breakId: string) => {
    const breakRecord = allBreaks.find(b => b.id === breakId);
    if (!breakRecord) return;

    const endTime = new Date().toISOString();
    const durationMinutes = breakRecord.start_time ? calculateDuration(new Date(breakRecord.start_time), new Date()) : 0;

    await firebaseService.updateBreak(breakId, {
      end_time: endTime,
      duration_minutes: durationMinutes,
    });

    setAllBreaks(prev =>
      prev.map(b =>
        b.id === breakId
          ? { ...b, end_time: endTime, duration_minutes: durationMinutes }
          : b
      )
    );

    const timer = activeTimers.get(breakId);
    if (timer) {
      const updatedTimers = new Map(activeTimers);
      updatedTimers.delete(breakId);
      setActiveTimers(updatedTimers);
      saveActiveTimersToStorage(updatedTimers);

      setBreakCounters(prev => {
        const updated = { ...prev };
        delete updated[breakId];
        saveBreakCountersToStorage(updated);
        return updated;
      });

      setEmployeeOnBreak(timer.employeeId, false);
      window.dispatchEvent(new CustomEvent('breakEnded', { detail: { employeeId: timer.employeeId } }));
    }

    fetchData();
  };

  const handleEditEntry = (entry: TimeEntry) => {
    const startDate = new Date(entry.start_time);
    const endDate = entry.end_time ? new Date(entry.end_time) : new Date();

    setEditingEntryId(entry.id);
    setEditForm({
      start_time: startDate.toISOString().slice(0, 16),
      end_time: entry.end_time ? endDate.toISOString().slice(0, 16) : '',
      break_duration: entry.break_duration || 0,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingEntryId) return;

    const startTime = new Date(editForm.start_time);
    const endTime = editForm.end_time ? new Date(editForm.end_time) : null;
    const durationMinutes = endTime ? calculateDuration(startTime, endTime) - editForm.break_duration : null;

    await firebaseService.updateTimeEntry(editingEntryId, {
      start_time: startTime.toISOString(),
      end_time: endTime?.toISOString() || null,
      duration_minutes: durationMinutes,
    });

    setEditingEntryId(null);
    fetchData();
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (confirm('Delete this time entry?')) {
      await firebaseService.deleteTimeEntry(entryId);
      fetchData();
    }
  };

  const getTodayEntries = () => {
    let filtered = timeEntries.filter(e => e.date === getToday());

    if (filterEmployee) {
      filtered = filtered.filter(e => e.employee_id === filterEmployee);
    }

    if (filterShift) {
      filtered = filtered.filter(e => e.shift_id === filterShift);
    }

    if (filterEmploymentType !== 'all') {
      const empIds = employees
        .filter(e => e.employment_type === filterEmploymentType)
        .map(e => e.id);
      filtered = filtered.filter(e => empIds.includes(e.employee_id));
    }

    return filtered.sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  };

  const getShiftName = (shiftId?: string) => {
    if (!shiftId) return '-';
    return shifts.find(s => s.id === shiftId)?.name || '-';
  };

  const todayEntries = getTodayEntries();
  const activeTimersArray = Array.from(activeTimers.values());

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Employee</label>
          <select
            value={selectedEmployee}
            onChange={e => {
              const newEmpId = e.target.value;
              setSelectedEmployee(newEmpId);
              if (!newEmpId || isEmployeeOnBreak(newEmpId)) {
                setSelectedDepartment('');
                setSelectedTask('');
              }
            }}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Select an employee</option>
            {employees.map(emp => {
              const isOnBreak = employeesOnBreak.has(emp.id);
              return (
                <option key={emp.id} value={emp.id} disabled={isOnBreak}>
                  {emp.name} ({emp.employment_type}) {isOnBreak ? '- On Break' : ''}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Department</label>
          <select
            value={selectedDepartment}
            onChange={e => {
              setSelectedDepartment(e.target.value);
              setSelectedTask('');
            }}
            disabled={selectedEmployee && isEmployeeOnBreak(selectedEmployee)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">Select a department</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Task</label>
          <select
            value={selectedTask}
            onChange={e => setSelectedTask(e.target.value)}
            disabled={!selectedDepartment || (selectedEmployee && isEmployeeOnBreak(selectedEmployee))}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">Select a task</option>
            {filteredTasks.map(task => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Shift (Optional)</label>
          <select
            value={selectedShift}
            onChange={e => setSelectedShift(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">No Shift</option>
            {shifts.map(shift => (
              <option key={shift.id} value={shift.id}>
                {shift.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-4 mb-8 items-center flex-wrap">
        <button
          onClick={handleStartTask}
          disabled={!selectedEmployee || !selectedTask || (selectedEmployee && isEmployeeOnBreak(selectedEmployee))}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          <Play className="w-5 h-5" />
          Start Task
        </button>
        <button
          onClick={() => {
            if (selectedEmployee && !isEmployeeOnBreak(selectedEmployee)) {
              handleStartBreak(selectedEmployee, 'paid_15');
            }
          }}
          disabled={!selectedEmployee || isEmployeeOnBreak(selectedEmployee)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          <Coffee className="w-5 h-5" />
          15m Paid Break
        </button>
        <button
          onClick={() => {
            if (selectedEmployee && !isEmployeeOnBreak(selectedEmployee)) {
              handleStartBreak(selectedEmployee, 'unpaid_30');
            }
          }}
          disabled={!selectedEmployee || isEmployeeOnBreak(selectedEmployee)}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          <Coffee className="w-5 h-5" />
          30m Unpaid Break
        </button>
        {selectedEmployee && isEmployeeOnBreak(selectedEmployee) && (
          <div className="bg-orange-600/20 border border-orange-500 text-orange-200 px-4 py-2 rounded-lg text-sm">
            Employee is on break. End break before selecting new task.
          </div>
        )}
      </div>

      {activeTimersArray.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-white mb-4">Active Tasks & Breaks</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTimersArray.map(timer => {
              const isBreak = timer.isBreak;
              const breakDuration = timer.breakType === 'paid_15' ? 900 : 1800;
              const timeRemaining = breakCounters[timer.timeEntryId] !== undefined ? breakCounters[timer.timeEntryId] : (isBreak ? breakDuration : null);
              const displayTime = isBreak && timeRemaining !== null ? timeRemaining : Math.floor(timer.elapsedTime / 60);
              const displayLabel = isBreak && timeRemaining !== null ? `${Math.floor(timeRemaining / 60)}m ${timeRemaining % 60}s` : formatDuration(displayTime);

              return (
                <div
                  key={timer.timeEntryId}
                  className={`rounded-lg p-4 shadow-lg ${isBreak ? 'bg-gradient-to-br from-orange-600 to-orange-700' : 'bg-gradient-to-br from-blue-600 to-blue-700'}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-white">{timer.employeeName}</div>
                      <div className="text-sm text-white/80">{timer.taskName}</div>
                      {timer.shiftName && <div className="text-xs text-white/70">{timer.shiftName}</div>}
                    </div>
                    <button
                      onClick={() => isBreak ? handleEndBreak(timer.timeEntryId) : handleEndTask(timer.timeEntryId)}
                      className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-3xl font-bold text-white mb-2">
                    {displayLabel}
                  </div>
                  <div className="text-xs text-white/70">
                    Started: {timer.startTime.toLocaleTimeString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Sortation Plan</h3>
          <div className="flex gap-4 flex-wrap">
            <select
              value={filterEmployee}
              onChange={e => setFilterEmployee(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
            <select
              value={filterEmploymentType}
              onChange={e => setFilterEmploymentType(e.target.value as 'all' | 'regular' | 'temporary')}
              className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Types</option>
              <option value="regular">Regular</option>
              <option value="temporary">Temporary</option>
            </select>
            <select
              value={filterShift}
              onChange={e => setFilterShift(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Shifts</option>
              {shifts.map(shift => (
                <option key={shift.id} value={shift.id}>
                  {shift.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-300">Employee</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-300">Task</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-300">Shift</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-300">Department</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-300">Start</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-300">End</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-300">Duration</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {todayEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-center text-slate-400">
                    No time entries for today
                  </td>
                </tr>
              ) : (
                <>
                  {todayEntries.map(entry => {
                    const emp = employees.find(e => e.id === entry.employee_id);
                    const task = tasks.find(t => t.id === entry.task_id);
                    const dept = departments.find(d => d.id === task?.department_id);
                    const isEditing = editingEntryId === entry.id;
                    const entryBreaks = getBreaksForEntry(entry.id);

                    return (
                      <tr key={entry.id} className={`border-b border-slate-700 ${isEditing ? 'bg-slate-600' : 'hover:bg-slate-700'}`}>
                        <td className="px-4 py-2 text-sm text-slate-100">{emp?.name}</td>
                        <td className="px-4 py-2 text-sm text-slate-100">{task?.name}</td>
                        <td className="px-4 py-2 text-sm text-slate-100">{getShiftName(entry.shift_id)}</td>
                        <td className="px-4 py-2 text-sm text-slate-100">{dept?.name || '-'}</td>
                        {isEditing ? (
                          <>
                            <td className="px-4 py-2">
                              <input
                                type="datetime-local"
                                value={editForm.start_time}
                                onChange={e => setEditForm({ ...editForm, start_time: e.target.value })}
                                className="bg-slate-700 border border-slate-500 rounded px-2 py-1 text-white text-sm"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="datetime-local"
                                value={editForm.end_time}
                                onChange={e => setEditForm({ ...editForm, end_time: e.target.value })}
                                className="bg-slate-700 border border-slate-500 rounded px-2 py-1 text-white text-sm"
                              />
                            </td>
                            <td className="px-4 py-2 text-sm text-slate-100">-</td>
                            <td className="px-4 py-2 text-sm flex gap-1">
                              <button
                                onClick={handleSaveEdit}
                                className="text-green-400 hover:text-green-300"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingEntryId(null)}
                                className="text-slate-400 hover:text-slate-300"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2 text-sm text-slate-100">
                              {new Date(entry.start_time).toLocaleTimeString()}
                            </td>
                            <td className="px-4 py-2 text-sm text-slate-100">
                              {entry.end_time ? new Date(entry.end_time).toLocaleTimeString() : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm font-semibold text-blue-400">
                              {entry.duration_minutes ? formatDuration(entry.duration_minutes) : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm flex gap-2">
                              <button
                                onClick={() => handleEditEntry(entry)}
                                className="text-blue-400 hover:text-blue-300"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteEntry(entry.id)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                  {todayEntries.flatMap(entry => {
                    const entryBreaks = getBreaksForEntry(entry.id);
                    const emp = employees.find(e => e.id === entry.employee_id);
                    return entryBreaks.map(brk => (
                      <tr key={`break-${brk.id}`} className="border-b border-slate-700 bg-slate-700/50">
                        <td className="px-4 py-2 text-sm text-slate-100 pl-8">{emp?.name}</td>
                        <td className="px-4 py-2 text-sm text-orange-400 font-semibold">{getBreakTypeName(brk.type)}</td>
                        <td className="px-4 py-2 text-sm text-slate-100">-</td>
                        <td className="px-4 py-2 text-sm text-slate-100">-</td>
                        <td className="px-4 py-2 text-sm text-slate-100">
                          {brk.start_time ? new Date(brk.start_time).toLocaleTimeString() : '-'}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-100">
                          {brk.end_time ? new Date(brk.end_time).toLocaleTimeString() : '-'}
                        </td>
                        <td className="px-4 py-2 text-sm font-semibold text-orange-400">
                          {brk.duration_minutes ? formatDuration(brk.duration_minutes) : '-'}
                        </td>
                        <td></td>
                      </tr>
                    ));
                  })}
                  <tr className="border-t-2 border-slate-600 bg-slate-800">
                    <td colSpan={6} className="px-4 py-3 text-sm font-bold text-slate-300">
                      Total Hours
                    </td>
                    <td colSpan={2} className="px-4 py-3 text-sm font-bold text-green-400">
                      {formatDuration(todayEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0))}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
