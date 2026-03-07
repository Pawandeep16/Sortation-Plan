import { useState, useEffect } from 'react';
import { Play, Square } from 'lucide-react';
import { firebaseService } from '../lib/firebase';
import { formatDateTime, calculateDuration, formatDuration, getToday } from '../lib/utils';

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

interface TimeEntry {
  id: string;
  employee_id: string;
  task_id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  date: string;
}

interface ActiveTimer {
  timeEntryId: string;
  employeeId: string;
  taskId: string;
  startTime: Date;
  elapsedTime: number;
  employeeName: string;
  taskName: string;
}

export default function TaskTracker() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);

  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedTask, setSelectedTask] = useState('');
  const [activeTimers, setActiveTimers] = useState<Map<string, ActiveTimer>>(new Map());

  useEffect(() => {
    fetchData();
    recoverActiveTimers();
    const interval = setInterval(() => {
      setActiveTimers(prev => {
        const updated = new Map(prev);
        updated.forEach((timer, key) => {
          updated.set(key, { ...timer, elapsedTime: timer.elapsedTime + 1 });
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    const [emps, depts, tsk, entries] = await Promise.all([
      firebaseService.getEmployees(),
      firebaseService.getDepartments(),
      firebaseService.getTasks(),
      firebaseService.getTimeEntries(getToday()),
    ]);

    setEmployees(emps);
    setDepartments(depts);
    setTasks(tsk);
    setTimeEntries(entries);
  };

  const recoverActiveTimers = async () => {
    try {
      const stored = localStorage.getItem('activeTimers');
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

  const filteredTasks = selectedDepartment
    ? tasks.filter(t => t.department_id === selectedDepartment)
    : [];

  const handleStartTask = async () => {
    if (!selectedEmployee || !selectedTask) return;

    const emp = employees.find(e => e.id === selectedEmployee);
    const tsk = tasks.find(t => t.id === selectedTask);
    if (!emp || !tsk) return;

    const startTime = new Date();
    const entry = await firebaseService.addTimeEntry(selectedEmployee, selectedTask, getToday());

    const newTimer: ActiveTimer = {
      timeEntryId: entry.id,
      employeeId: selectedEmployee,
      taskId: selectedTask,
      startTime,
      elapsedTime: 0,
      employeeName: emp.name,
      taskName: tsk.name,
    };

    const updatedTimers = new Map(activeTimers);
    updatedTimers.set(entry.id, newTimer);
    setActiveTimers(updatedTimers);
    saveActiveTimersToStorage(updatedTimers);

    fetchData();
    setSelectedEmployee('');
    setSelectedTask('');
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

    const updatedTimers = new Map(activeTimers);
    updatedTimers.delete(timerId);
    setActiveTimers(updatedTimers);
    saveActiveTimersToStorage(updatedTimers);

    fetchData();
  };

  const getTodayEntries = () => {
    return timeEntries.filter(e => e.date === getToday());
  };

  const todayEntries = getTodayEntries();
  const activeTimersArray = Array.from(activeTimers.values());

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Employee</label>
          <select
            value={selectedEmployee}
            onChange={e => setSelectedEmployee(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Select an employee</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.employment_type})
              </option>
            ))}
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
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
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
            disabled={!selectedDepartment}
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
      </div>

      <div className="flex gap-4 mb-8">
        <button
          onClick={handleStartTask}
          disabled={!selectedEmployee || !selectedTask}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          <Play className="w-5 h-5" />
          Start Task
        </button>
      </div>

      {activeTimersArray.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-white mb-4">Active Timers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTimersArray.map(timer => (
              <div
                key={timer.timeEntryId}
                className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4 shadow-lg"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-white">{timer.employeeName}</div>
                    <div className="text-sm text-blue-100">{timer.taskName}</div>
                  </div>
                  <button
                    onClick={() => handleEndTask(timer.timeEntryId)}
                    className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-3xl font-bold text-white mb-2">
                  {formatDuration(Math.floor(timer.elapsedTime / 60))}
                </div>
                <div className="text-xs text-blue-100">
                  Started: {timer.startTime.toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      <div>
        <h3 className="text-lg font-bold text-white mb-4">Today's Time Entries</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-300">Employee</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-300">Task</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-300">Start</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-300">End</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-300">Duration</th>
              </tr>
            </thead>
            <tbody>
              {todayEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-slate-400">
                    No time entries for today
                  </td>
                </tr>
              ) : (
                todayEntries.map(entry => {
                  const emp = employees.find(e => e.id === entry.employee_id);
                  const task = tasks.find(t => t.id === entry.task_id);
                  return (
                    <tr key={entry.id} className="border-b border-slate-700 hover:bg-slate-700">
                      <td className="px-4 py-2 text-sm text-slate-100">{emp?.name}</td>
                      <td className="px-4 py-2 text-sm text-slate-100">{task?.name}</td>
                      <td className="px-4 py-2 text-sm text-slate-100">
                        {new Date(entry.start_time).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-100">
                        {entry.end_time ? new Date(entry.end_time).toLocaleTimeString() : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm font-semibold text-blue-400">
                        {entry.duration_minutes ? formatDuration(entry.duration_minutes) : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
