import { useState, useEffect } from 'react';
import { Download, Filter, Share2, BarChart3, Clock, Coffee, Users } from 'lucide-react';
import { firebaseService } from '../lib/firebase';
import { getTotalHours, getToday } from '../lib/utils';

interface Employee {
  id: string;
  name: string;
  employment_type: string;
}

interface Task {
  id: string;
  name: string;
  department_id: string;
}

interface Department {
  id: string;
  name: string;
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
  duration_minutes: number | null;
  date: string;
  start_time: string;
  end_time: string;
  shift_id?: string;
  break_duration?: number;
}

interface GroupedSummaryRow {
  department_name: string;
  task_name: string;
  employees: {
    name: string;
    type: string;
    break_15: number;
    break_30: number;
  }[];
  total_entries: number;
  total_duration_minutes: number;
  total_break_minutes: number;
  dates: string[];
}

export default function Summary() {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [breaks, setBreaks] = useState<any[]>([]);

  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedEmploymentType, setSelectedEmploymentType] = useState('');
  const [dateFrom, setDateFrom] = useState(getToday());
  const [dateTo, setDateTo] = useState(getToday());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [emps, tsks, depts, shfts] = await Promise.all([
      firebaseService.getEmployees(),
      firebaseService.getTasks(),
      firebaseService.getDepartments(),
      firebaseService.getShifts(),
    ]);

    setEmployees(emps);
    setTasks(tsks);
    setDepartments(depts);
    setShifts(shfts);

    fetchTimeEntries();
  };

  const fetchTimeEntries = async () => {
    const entries = await firebaseService.getTimeEntriesByDateRange(dateFrom, dateTo);
    setTimeEntries(entries);

    const allBreaks = await firebaseService.getAllBreaks();
    setBreaks(allBreaks);
  };

  useEffect(() => {
    fetchTimeEntries();
  }, [dateFrom, dateTo]);

  const getFilteredData = () => {
    let filtered = timeEntries;

    if (selectedEmployee) {
      filtered = filtered.filter(e => e.employee_id === selectedEmployee);
    }

    if (selectedDepartment) {
      const deptTasks = tasks.filter(t => t.department_id === selectedDepartment);
      filtered = filtered.filter(e => deptTasks.some(t => t.id === e.task_id));
    }

    if (selectedShift) {
      filtered = filtered.filter(e => e.shift_id === selectedShift);
    }

    if (selectedEmploymentType) {
      const employeesByType = employees.filter(e => e.employment_type === selectedEmploymentType).map(e => e.id);
      filtered = filtered.filter(e => employeesByType.includes(e.employee_id));
    }

    return filtered;
  };

  const getUniqueDates = (dates: string[]): string[] => {
    return Array.from(new Set(dates)).sort();
  };

  const generateGroupedSummary = (): GroupedSummaryRow[] => {
    const filtered = getFilteredData();
    const summaryMap = new Map<string, GroupedSummaryRow>();

    filtered.forEach(entry => {
      const emp = employees.find(e => e.id === entry.employee_id);
      const task = tasks.find(t => t.id === entry.task_id);
      const dept = departments.find(d => d.id === task?.department_id);

      if (emp && task && dept) {
        const key = `${dept.id}-${task.id}`;
        const existing = summaryMap.get(key);

        const employeeBreaks = breaks.filter(b => b.entry_id === entry.id);
        const break_15 = employeeBreaks.filter(b => b.type === 'paid_15').length;
        const break_30 = employeeBreaks.filter(b => b.type === 'unpaid_30').length;

        if (existing) {
          const existingEmp = existing.employees.find(e => e.name === emp.name);
          if (existingEmp) {
            existingEmp.break_15 += break_15;
            existingEmp.break_30 += break_30;
          } else {
            existing.employees.push({
              name: emp.name,
              type: emp.employment_type,
              break_15,
              break_30,
            });
          }
          existing.total_duration_minutes += entry.duration_minutes || 0;
          existing.total_break_minutes += entry.break_duration || 0;
          existing.total_entries += 1;
          existing.dates.push(entry.date);
        } else {
          summaryMap.set(key, {
            department_name: dept.name,
            task_name: task.name,
            employees: [{
              name: emp.name,
              type: emp.employment_type,
              break_15,
              break_30,
            }],
            total_entries: 1,
            total_duration_minutes: entry.duration_minutes || 0,
            total_break_minutes: entry.break_duration || 0,
            dates: [entry.date],
          });
        }
      }
    });

    return Array.from(summaryMap.values()).sort((a, b) => {
      if (a.department_name !== b.department_name) {
        return a.department_name.localeCompare(b.department_name);
      }
      return a.task_name.localeCompare(b.task_name);
    });
  };

  const summary = generateGroupedSummary();
  const totalMinutes = summary.reduce((sum, row) => sum + row.total_duration_minutes, 0);
  const totalBreakMinutes = summary.reduce((sum, row) => sum + row.total_break_minutes, 0);
  const totalEntries = summary.reduce((sum, row) => sum + row.total_entries, 0);

  const exportToGoogleSheets = async () => {
    try {
      const uniqueDates = getUniqueDates(summary.flatMap(row => row.dates));

      const csvData = [
        ['Sortation Plan - Time Tracking Summary Report'],
        [`${dateFrom} to ${dateTo}`],
        [],
        ['Department / Task', 'Associates', 'Break Time (mins)', ...uniqueDates, 'Total Hours'],
      ];

      let totalWorkHours = 0;
      summary.forEach(row => {
        const taskHours = getTotalHours(row.total_duration_minutes);
        totalWorkHours += taskHours;
        const breakHours = row.total_break_minutes;

        csvData.push([
          row.task_name,
          row.employees.length.toString(),
          breakHours.toString(),
          ...uniqueDates.map(date => {
            const dateEntries = row.dates.filter(d => d === date).length;
            return dateEntries > 0 ? dateEntries.toString() : '';
          }),
          taskHours.toFixed(2),
        ]);
      });

      csvData.push([]);
      csvData.push(['TOTAL', '', totalBreakMinutes.toString(), '', '', totalWorkHours.toFixed(2)]);

      const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const encodedUri = encodeURIComponent(csv);

      const link = document.createElement('a');
      link.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodedUri);
      link.setAttribute('download', `sortation-plan-${dateFrom}-to-${dateTo}.csv`);
      link.click();

      const importUrl = `https://docs.google.com/spreadsheets/import?url=${encodedUri}&importFormat=csv`;

      window.open(importUrl, '_blank');

      setTimeout(() => {
        alert('Google Sheets export opened. Please sign in with your Google account to import the data. The file will be imported to your Google Drive.');
      }, 500);
    } catch (error) {
      console.error('Error exporting to Google Sheets:', error);
      alert('Failed to export to Google Sheets. Please try again.');
    }
  };

  const exportToExcel = () => {
    const uniqueDates = getUniqueDates(summary.flatMap(row => row.dates));
    const taskColors: Record<string, string> = {};
    const colorPalette = [
      'D4EDDA', 'E7F3FF', 'FCE4EC', 'F3E5F5', 'E0F2F1', 'FFF3E0',
      'F1F8E9', 'EDE7F6', 'E0F7FA', 'FFF9C4'
    ];

    summary.forEach((row, idx) => {
      taskColors[row.task_name] = colorPalette[idx % colorPalette.length];
    });

    const departmentRows: Record<string, typeof summary> = {};
    summary.forEach(row => {
      if (!departmentRows[row.department_name]) {
        departmentRows[row.department_name] = [];
      }
      departmentRows[row.department_name].push(row);
    });

    let overallTotalHours = 0;

    let html = `
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background-color: #4472C4; color: white; font-weight: bold; }
            .dept-header { background-color: #5B9BD5; color: white; font-weight: bold; }
            .dept-total { background-color: #4F81BD; color: white; font-weight: bold; }
            .grand-total { background-color: #203864; color: white; font-weight: bold; }
            .total { font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>Sortation Plan - Time Tracking Summary Report (${dateFrom} to ${dateTo})</h2>
          <table>
            <thead>
              <tr>
                <th>Department / Task</th>
                <th>Associates</th>
                <th>Break Time (mins)</th>
                <th>Notes</th>
                ${uniqueDates.map(date => `<th>${date}</th>`).join('')}
                <th>Total Hours</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(departmentRows).map(([deptName, deptSummary]) => {
                let deptTotalHours = 0;
                let deptTotalBreakMinutes = 0;
                const taskRows = deptSummary.map(row => {
                  const taskColor = taskColors[row.task_name];
                  const taskHours = getTotalHours(row.total_duration_minutes);
                  deptTotalHours += taskHours;
                  deptTotalBreakMinutes += row.total_break_minutes;
                  return `
                    <tr style="background-color: #${taskColor}">
                      <td class="total" style="padding-left: 24px;">${row.task_name}</td>
                      <td>${row.employees.length}</td>
                      <td>${row.total_break_minutes}</td>
                      <td>${row.employees.map(e => e.name).join(', ')}</td>
                      ${uniqueDates.map(date => {
                        const dateEntries = row.dates.filter(d => d === date).length;
                        return `<td style="text-align: center;">${dateEntries > 0 ? dateEntries : ''}</td>`;
                      }).join('')}
                      <td class="total">${taskHours.toFixed(2)}</td>
                    </tr>
                  `;
                }).join('');

                overallTotalHours += deptTotalHours;

                return `
                  <tr class="dept-header">
                    <td colspan="${4 + uniqueDates.length}" style="background-color: #5B9BD5; color: white; font-weight: bold;">${deptName}</td>
                    <td style="background-color: #5B9BD5; color: white; font-weight: bold;"></td>
                  </tr>
                  ${taskRows}
                  <tr class="dept-total">
                    <td colspan="${4 + uniqueDates.length}" style="text-align: right; padding-right: 16px;">Department Total:</td>
                    <td class="total" style="background-color: #4F81BD; color: white;">${deptTotalHours.toFixed(2)}</td>
                  </tr>
                `;
              }).join('')}
              <tr class="grand-total">
                <td colspan="${4 + uniqueDates.length}" style="text-align: right; padding-right: 16px;">OVERALL TOTAL:</td>
                <td style="background-color: #203864; color: white; font-weight: bold;">${overallTotalHours.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `time-tracking-${dateFrom}-to-${dateTo}.xls`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-8">
        <BarChart3 className="w-6 h-6 text-blue-400" />
        <h2 className="text-2xl font-bold text-white">Time Tracking Summary</h2>
      </div>

      <div className="bg-gradient-to-r from-slate-700/50 to-slate-800/50 rounded-lg p-6 mb-8 border border-slate-600/50">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Employee</label>
            <select
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 transition-all"
            >
              <option value="">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Department</label>
            <select
              value={selectedDepartment}
              onChange={e => setSelectedDepartment(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 transition-all"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Shift</label>
            <select
              value={selectedShift}
              onChange={e => setSelectedShift(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 transition-all"
            >
              <option value="">All Shifts</option>
              {shifts.map(shift => (
                <option key={shift.id} value={shift.id}>
                  {shift.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Employee Type</label>
            <select
              value={selectedEmploymentType}
              onChange={e => setSelectedEmploymentType(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 transition-all"
            >
              <option value="">All Types</option>
              {Array.from(new Set(employees.map(emp => emp.employment_type))).map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">&nbsp;</label>
            <button
              onClick={fetchTimeEntries}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white px-4 py-3 rounded-lg transition-all font-semibold transform hover:scale-105 active:scale-95"
            >
              <Filter className="w-4 h-4" />
              Apply Filters
            </button>
          </div>
        </div>
      </div>


      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <button
          onClick={exportToExcel}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white px-6 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 active:scale-95"
        >
          <Download className="w-5 h-5" />
          <span>Export Excel</span>
        </button>
        <button
          onClick={exportToGoogleSheets}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 active:scale-95"
        >
          <Share2 className="w-5 h-5" />
          <span>Google Sheets</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-500/20 rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Tasks</span>
          </div>
          <div className="text-3xl font-bold text-blue-300">{summary.length}</div>
        </div>
        <div className="bg-gradient-to-br from-slate-600/20 to-slate-500/20 rounded-lg p-4 border border-slate-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-slate-300" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Entries</span>
          </div>
          <div className="text-3xl font-bold text-slate-200">{totalEntries}</div>
        </div>
        <div className="bg-gradient-to-br from-green-600/20 to-green-500/20 rounded-lg p-4 border border-green-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-green-400" />
            <span className="text-xs font-semibold text-green-300 uppercase tracking-wider">Hours</span>
          </div>
          <div className="text-3xl font-bold text-green-300">{getTotalHours(totalMinutes).toFixed(2)}</div>
        </div>
        <div className="bg-gradient-to-br from-orange-600/20 to-orange-500/20 rounded-lg p-4 border border-orange-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Coffee className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-semibold text-orange-300 uppercase tracking-wider">Breaks</span>
          </div>
          <div className="text-3xl font-bold text-orange-300">{totalBreakMinutes}m</div>
        </div>
        <div className="bg-gradient-to-br from-amber-600/20 to-amber-500/20 rounded-lg p-4 border border-amber-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Staff</span>
          </div>
          <div className="text-3xl font-bold text-amber-300">
            {new Set(
              summary.flatMap(s => s.employees.map(e => e.name))
            ).size}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg overflow-hidden border border-slate-600 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-600">
                <th className="px-4 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-4 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Task</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Employees (Count)
                </th>
                <th className="px-4 py-4 text-right text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Entries
                </th>
                <th className="px-4 py-4 text-right text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Total Hours
                </th>
                <th className="px-4 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Dates</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Employee Breaks
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <BarChart3 className="w-8 h-8 text-slate-500" />
                      <span className="text-slate-400">No data to display</span>
                    </div>
                  </td>
                </tr>
              ) : (
                summary.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-600 hover:bg-slate-600/50 transition-all"
                  >
                    <td className="px-4 py-4 text-sm font-semibold text-slate-100">
                      {row.department_name}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-100 font-medium">{row.task_name}</td>
                    <td className="px-4 py-4 text-sm">
                      <div className="space-y-1.5">
                        {row.employees.map((emp, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-slate-200">{emp.name}</span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                emp.type === 'regular'
                                  ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                              }`}
                            >
                              {emp.type === 'regular' ? 'R' : 'T'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-right font-semibold text-blue-300">
                      {row.total_entries}
                    </td>
                    <td className="px-4 py-4 text-sm text-right font-bold text-green-300">
                      {getTotalHours(row.total_duration_minutes).toFixed(2)}h
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-400">
                      {getUniqueDates(row.dates).join(', ')}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="space-y-1">
                        {row.employees.map((emp, i) => (
                          <div key={i} className="text-xs text-slate-300">
                            <span className="font-medium">{emp.name}:</span>
                            {emp.break_15 > 0 && (
                              <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded inline-block">
                                15m×{emp.break_15}
                              </span>
                            )}
                            {emp.break_30 > 0 && (
                              <span className="ml-2 px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded inline-block">
                                30m×{emp.break_30}
                              </span>
                            )}
                            {emp.break_15 === 0 && emp.break_30 === 0 && (
                              <span className="ml-2 text-slate-500">No breaks</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
