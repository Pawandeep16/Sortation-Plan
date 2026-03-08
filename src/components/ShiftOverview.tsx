import { useState, useEffect } from 'react';
import { Coffee, Play, Check, Trash2, Clock, Users } from 'lucide-react';
import { firebaseService } from '../lib/firebase';
import { getToday } from '../lib/utils';

interface Employee {
  id: string;
  name: string;
  employment_type: string;
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

interface EmployeeShiftData {
  employee: Employee;
  todayEntry: TimeEntry | null;
  breaks: BreakRecord[];
  activeTimer: boolean;
}

interface BreakRecord {
  id: string;
  entry_id: string;
  type: 'paid_15' | 'unpaid_30';
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
}

export default function ShiftOverview() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedShift, setSelectedShift] = useState(() => {
    return localStorage.getItem('selectedShift') || '';
  });
  const [shiftEmployees, setShiftEmployees] = useState<EmployeeShiftData[]>([]);
  const [breakElapsedTimes, setBreakElapsedTimes] = useState<Record<string, number>>({});
  const [shiftDataCache, setShiftDataCache] = useState<Record<string, EmployeeShiftData[]>>({});

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    localStorage.setItem('selectedShift', selectedShift);
    if (selectedShift) {
      if (shiftDataCache[selectedShift]) {
        setShiftEmployees(shiftDataCache[selectedShift]);
      } else {
        loadShiftEmployees();
      }
    }
  }, [selectedShift]);

  useEffect(() => {
    const interval = setInterval(() => {
      setBreakElapsedTimes(prev => {
        const updated = { ...prev };
        shiftEmployees.forEach(emp => {
          emp.breaks.forEach(brk => {
            if (brk.end_time === null && brk.start_time) {
              const key = brk.id;
              updated[key] = (updated[key] || 0) + 1;
            }
          });
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [shiftEmployees]);

  const fetchData = async () => {
    const [shfts, emps] = await Promise.all([
      firebaseService.getShifts(),
      firebaseService.getEmployees(),
    ]);
    setShifts(shfts);
    setEmployees(emps);
  };

  const loadShiftEmployees = async () => {
    let empList = employees;
    if (empList.length === 0) {
      empList = await firebaseService.getEmployees();
      setEmployees(empList);
    }

    const entries = await firebaseService.getTimeEntries(getToday());
    const shiftEntries = entries.filter(e => e.shift_id === selectedShift);
    const uniqueEmployeeIds = [...new Set(shiftEntries.map(e => e.employee_id))];

    const employeeShiftAssignments = (await Promise.all(
      uniqueEmployeeIds.map(async (empId) => {
        const emp = empList.find(e => e.id === empId);
        const entry = shiftEntries.find(e => e.employee_id === empId);
        let breaks: BreakRecord[] = [];

        if (entry) {
          const dbBreaks = await firebaseService.getBreaksByTimeEntry(entry.id);
          breaks = dbBreaks.map(b => ({
            id: b.id,
            entry_id: b.entry_id,
            type: b.type,
            start_time: b.start_time,
            end_time: b.end_time,
            duration_minutes: b.duration_minutes,
          }));
        }

        return emp ? {
          employee: emp,
          todayEntry: entry || null,
          breaks,
          activeTimer: !entry?.end_time && !breaks.some(b => b.end_time === null),
        } : null;
      })
    )).filter((item): item is EmployeeShiftData => item !== null);

    setShiftEmployees(employeeShiftAssignments);
    setShiftDataCache(prev => ({
      ...prev,
      [selectedShift]: employeeShiftAssignments,
    }));
  };

  const handleStartBreak = async (employeeId: string, breakType: 'paid_15' | 'unpaid_30') => {
    const emp = shiftEmployees.find(e => e.employee.id === employeeId);
    if (!emp || !emp.todayEntry) return;

    const breakCount = emp.breaks.filter(b => b.type === breakType).length;
    if (breakCount > 0) {
      alert(`Employee already has one ${breakType === 'paid_15' ? '15-minute paid' : '30-minute unpaid'} break.`);
      return;
    }

    const startTime = new Date().toISOString();

    if (emp.todayEntry.end_time === null) {
      const endTime = new Date();
      await firebaseService.updateTimeEntry(emp.todayEntry.id, {
        end_time: endTime.toISOString(),
        duration_minutes: Math.round(
          (endTime.getTime() - new Date(emp.todayEntry.start_time).getTime()) / 60000
        ),
      });
    }

    const newBreak = await firebaseService.addBreak(emp.todayEntry.id, breakType, startTime);

    const updatedEmployees = shiftEmployees.map(e =>
      e.employee.id === employeeId
        ? { ...e, breaks: [...e.breaks, newBreak], activeTimer: false }
        : e
    );
    setShiftEmployees(updatedEmployees);
    setShiftDataCache(prev => ({
      ...prev,
      [selectedShift]: updatedEmployees,
    }));

    window.dispatchEvent(new CustomEvent('breakStarted', { detail: { employeeId } }));
  };

  const handleEndBreak = async (employeeId: string, breakId: string) => {
    const endTime = new Date().toISOString();
    const emp = shiftEmployees.find(e => e.employee.id === employeeId);
    const breakToEnd = emp?.breaks.find(b => b.id === breakId);

    if (!breakToEnd || !breakToEnd.start_time) return;

    const durationMinutes = Math.round(
      (new Date(endTime).getTime() - new Date(breakToEnd.start_time).getTime()) / 60000
    );

    await firebaseService.updateBreak(breakId, {
      end_time: endTime,
      duration_minutes: durationMinutes,
    });

    const newEntry = await firebaseService.addTimeEntry(
      employeeId,
      emp!.todayEntry!.task_id,
      getToday(),
      selectedShift
    );

    const updatedEmployees = shiftEmployees.map(e =>
      e.employee.id === employeeId
        ? {
            ...e,
            breaks: e.breaks.map(b =>
              b.id === breakId
                ? {
                    ...b,
                    end_time: endTime,
                    duration_minutes: durationMinutes,
                  }
                : b
            ),
            todayEntry: newEntry,
            activeTimer: true,
          }
        : e
    );
    setShiftEmployees(updatedEmployees);
    setShiftDataCache(prev => ({
      ...prev,
      [selectedShift]: updatedEmployees,
    }));

    window.dispatchEvent(new CustomEvent('breakEnded', { detail: { employeeId } }));
  };

  const handleDeleteBreak = async (employeeId: string, breakId: string) => {
    await firebaseService.deleteBreak(breakId);

    const updatedEmployees = shiftEmployees.map(emp =>
      emp.employee.id === employeeId
        ? { ...emp, breaks: emp.breaks.filter(b => b.id !== breakId) }
        : emp
    );
    setShiftEmployees(updatedEmployees);
    setShiftDataCache(prev => ({
      ...prev,
      [selectedShift]: updatedEmployees,
    }));
  };

  const getTotalBreakDuration = (breaks: BreakRecord[]): number => {
    let total = 0;
    breaks.forEach(b => {
      if (b.end_time) {
        total += b.duration_minutes || 0;
      } else if (b.start_time) {
        total += Math.floor((breakElapsedTimes[b.id] || 0) / 60);
      }
    });
    return total;
  };

  const getBreakTypeLabel = (type: 'paid_15' | 'unpaid_30'): string => {
    return type === 'paid_15' ? '15 min (Paid)' : '30 min (Unpaid)';
  };

  const getBreakTypeColor = (type: 'paid_15' | 'unpaid_30'): string => {
    return type === 'paid_15' ? 'from-green-600 to-green-700' : 'from-orange-600 to-orange-700';
  };

  const isEmployeeOnBreak = (employeeId: string): boolean => {
    const emp = shiftEmployees.find(e => e.employee.id === employeeId);
    if (!emp) return false;
    return emp.breaks.some(b => b.end_time === null);
  };

  const selectedShiftData = shifts.find(s => s.id === selectedShift);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-300 mb-3">Select Shift</label>
            <select
              value={selectedShift}
              onChange={e => setSelectedShift(e.target.value)}
              className="w-full bg-gradient-to-r from-slate-700 to-slate-600 border border-slate-500 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 transition-all"
            >
              <option value="">Choose a shift to view employees</option>
              {shifts.map(shift => (
                <option key={shift.id} value={shift.id}>
                  {shift.name} ({shift.start_time} - {shift.end_time})
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedShiftData && (
          <div className="bg-gradient-to-r from-blue-600/20 to-blue-500/20 border border-blue-500/30 rounded-lg p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-blue-300">{selectedShiftData.name}</p>
              <p className="text-xs text-blue-200">{selectedShiftData.start_time} - {selectedShiftData.end_time}</p>
            </div>
          </div>
        )}
      </div>

      {selectedShift && shiftEmployees.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-blue-400" />
            <h3 className="text-xl font-bold text-white">
              {shiftEmployees.length} Employee{shiftEmployees.length !== 1 ? 's' : ''} on Shift
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {shiftEmployees.map(emp => (
              <div
                key={emp.employee.id}
                className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-6 border border-slate-600 hover:border-slate-500 transition-all hover:shadow-lg"
              >
                <div className="flex items-start justify-between mb-4 gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-lg font-bold text-white mb-1 truncate">{emp.employee.name}</h4>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                          emp.employee.employment_type === 'regular'
                            ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                        }`}
                      >
                        {emp.employee.employment_type === 'regular' ? 'Regular' : 'Temporary'}
                      </span>
                    </div>
                  </div>
                  {emp.activeTimer && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-full flex-shrink-0">
                      <div className="w-2 h-2 bg-green-100 rounded-full animate-pulse"></div>
                      Active
                    </div>
                  )}
                  {emp.breaks.some(b => b.end_time === null) && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-orange-600 text-white text-xs font-semibold rounded-full flex-shrink-0">
                      <div className="w-2 h-2 bg-orange-100 rounded-full animate-pulse"></div>
                      On Break
                    </div>
                  )}
                </div>

                {emp.todayEntry && (
                  <div className="mb-6 bg-slate-600/50 rounded-lg p-4 border border-slate-500/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <p className="text-xs font-semibold text-slate-300">Task Time</p>
                    </div>
                    <p className="text-sm text-slate-200 font-mono">
                      {new Date(emp.todayEntry.start_time).toLocaleTimeString()}
                      {emp.todayEntry.end_time && (
                        <span>
                          {' - '}
                          {new Date(emp.todayEntry.end_time).toLocaleTimeString()}
                        </span>
                      )}
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <h5 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-orange-400" />
                    Break Management
                  </h5>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      onClick={() => handleStartBreak(emp.employee.id, 'paid_15')}
                      disabled={emp.breaks.some(b => b.end_time === null)}
                      className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      <Play className="w-4 h-4 flex-shrink-0" />
                      <span className="hidden sm:inline">15m Paid</span>
                      <span className="sm:hidden">Paid</span>
                    </button>
                    <button
                      onClick={() => handleStartBreak(emp.employee.id, 'unpaid_30')}
                      disabled={emp.breaks.some(b => b.end_time === null)}
                      className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      <Play className="w-4 h-4 flex-shrink-0" />
                      <span className="hidden sm:inline">30m Unpaid</span>
                      <span className="sm:hidden">Unpaid</span>
                    </button>
                  </div>

                  {emp.breaks.length > 0 ? (
                    <div className="space-y-2">
                      {emp.breaks.map(brk => (
                        <div
                          key={brk.id}
                          className={`p-3 rounded-lg border transition-all ${
                            brk.end_time
                              ? 'bg-slate-600/50 border-slate-500/50'
                              : `bg-gradient-to-r ${getBreakTypeColor(brk.type)} border-${brk.type === 'paid_15' ? 'green' : 'orange'}-400`
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">
                                {getBreakTypeLabel(brk.type)}
                              </p>
                              <p className="text-xs text-slate-200 font-mono">
                                {brk.start_time && new Date(brk.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {brk.end_time && (
                                  <span>
                                    {' - '}
                                    {new Date(brk.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </p>
                              {brk.end_time ? (
                                <p className="text-xs text-slate-100 mt-1">
                                  Duration: <span className="font-bold">{brk.duration_minutes}m</span>
                                </p>
                              ) : (
                                <p className="text-xs text-slate-100 mt-1">
                                  Elapsed: <span className="font-bold">{Math.floor((breakElapsedTimes[brk.id] || 0) / 60)}m {(breakElapsedTimes[brk.id] || 0) % 60}s</span>
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              {!brk.end_time && (
                                <button
                                  onClick={() => handleEndBreak(emp.employee.id, brk.id)}
                                  className="text-white hover:text-green-300 bg-green-600/20 hover:bg-green-600/50 p-2 rounded transition-all"
                                  title="End break"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteBreak(emp.employee.id, brk.id)}
                                className="text-white hover:text-red-300 bg-red-600/20 hover:bg-red-600/50 p-2 rounded transition-all"
                                title="Delete break"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="mt-4 pt-4 border-t border-slate-500/50">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-300">Total Break Time:</p>
                          <p className="text-lg font-bold text-orange-400">{getTotalBreakDuration(emp.breaks)}m</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-600/30 rounded-lg p-4 text-center border border-dashed border-slate-500">
                      <Coffee className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">No breaks recorded yet</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : selectedShift ? (
        <div className="bg-slate-700/50 rounded-lg p-12 text-center border border-dashed border-slate-600">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No employees assigned to this shift for today</p>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-12 text-center border border-slate-600">
          <Coffee className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <p className="text-slate-300 text-lg font-semibold mb-2">Select a Shift</p>
          <p className="text-slate-400">Choose a shift above to view employees and manage breaks</p>
        </div>
      )}
    </div>
  );
}
