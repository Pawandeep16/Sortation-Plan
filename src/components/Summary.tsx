import { useState, useEffect } from 'react';
import { Download, Filter } from 'lucide-react';
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

interface TimeEntry {
  id: string;
  employee_id: string;
  task_id: string;
  duration_minutes: number | null;
  date: string;
  start_time: string;
  end_time: string;
}

interface GroupedSummaryRow {
  department_name: string;
  task_name: string;
  employees: {
    name: string;
    type: string;
  }[];
  total_entries: number;
  total_duration_minutes: number;
  dates: string[];
}

export default function Summary() {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [dateFrom, setDateFrom] = useState(getToday());
  const [dateTo, setDateTo] = useState(getToday());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [emps, tsks, depts] = await Promise.all([
      firebaseService.getEmployees(),
      firebaseService.getTasks(),
      firebaseService.getDepartments(),
    ]);

    setEmployees(emps);
    setTasks(tsks);
    setDepartments(depts);

    fetchTimeEntries();
  };

  const fetchTimeEntries = async () => {
    const entries = await firebaseService.getTimeEntriesByDateRange(dateFrom, dateTo);
    setTimeEntries(entries);
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

    return filtered;
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

        if (existing) {
          const employeeExists = existing.employees.some(e => e.name === emp.name);
          if (!employeeExists) {
            existing.employees.push({ name: emp.name, type: emp.employment_type });
          }
          existing.total_duration_minutes += entry.duration_minutes || 0;
          existing.total_entries += 1;
          existing.dates.push(entry.date);
        } else {
          summaryMap.set(key, {
            department_name: dept.name,
            task_name: task.name,
            employees: [{ name: emp.name, type: emp.employment_type }],
            total_entries: 1,
            total_duration_minutes: entry.duration_minutes || 0,
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
  const totalEntries = summary.reduce((sum, row) => sum + row.total_entries, 0);

  const exportToCSV = () => {
    const headers = [
      'Department',
      'Task',
      'Employees',
      'Employee Types',
      'Total Entries',
      'Total Hours',
      'Dates',
    ];
    const rows = summary.map(row => [
      row.department_name,
      row.task_name,
      row.employees.map(e => e.name).join(', '),
      row.employees.map(e => e.type).join(', '),
      row.total_entries,
      getTotalHours(row.total_duration_minutes).toFixed(2),
      row.dates.join('; '),
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `time-tracking-${dateFrom}-to-${dateTo}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const { jsPDF } = window as any;
    if (!jsPDF) {
      alert('PDF export not available. Please use CSV export.');
      return;
    }

    const pdf = new jsPDF();
    let yPos = 10;

    pdf.setFontSize(16);
    pdf.text('Time Tracking Summary Report', 10, yPos);
    yPos += 10;

    pdf.setFontSize(10);
    pdf.text(`From: ${dateFrom} | To: ${dateTo}`, 10, yPos);
    yPos += 8;

    const tableData = summary.map(row => [
      row.department_name,
      row.task_name,
      row.employees.map(e => e.name).join(', '),
      row.total_entries.toString(),
      getTotalHours(row.total_duration_minutes).toFixed(2),
    ]);

    pdf.autoTable({
      head: [['Department', 'Task', 'Employees', 'Entries', 'Hours']],
      body: tableData,
      startY: yPos,
      didDrawPage: (data: any) => {
        const pageSize = pdf.internal.pageSize;
        const pageHeight = pageSize.getHeight();
        const pageWidth = pageSize.getWidth();
        pdf.setDrawColor(200);
        pdf.line(10, pageHeight - 10, pageWidth - 10, pageHeight - 10);
      },
    });

    pdf.save(`time-tracking-${dateFrom}-to-${dateTo}.pdf`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Date From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Date To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Employee</label>
          <select
            value={selectedEmployee}
            onChange={e => setSelectedEmployee(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
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
          <label className="block text-sm font-medium text-slate-300 mb-2">Department</label>
          <select
            value={selectedDepartment}
            onChange={e => setSelectedDepartment(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
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
          <label className="block text-sm font-medium text-slate-300 mb-2">&nbsp;</label>
          <button
            onClick={fetchTimeEntries}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Filter className="w-4 h-4" />
            Apply
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          <Download className="w-5 h-5" />
          Export CSV
        </button>
        <button
          onClick={exportToPDF}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          <Download className="w-5 h-5" />
          Export PDF
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-700 rounded-lg p-4">
          <div className="text-sm text-slate-400">Total Tasks</div>
          <div className="text-2xl font-bold text-blue-400">{summary.length}</div>
        </div>
        <div className="bg-slate-700 rounded-lg p-4">
          <div className="text-sm text-slate-400">Total Entries</div>
          <div className="text-2xl font-bold text-purple-400">{totalEntries}</div>
        </div>
        <div className="bg-slate-700 rounded-lg p-4">
          <div className="text-sm text-slate-400">Total Hours</div>
          <div className="text-2xl font-bold text-green-400">{getTotalHours(totalMinutes).toFixed(2)}</div>
        </div>
        <div className="bg-slate-700 rounded-lg p-4">
          <div className="text-sm text-slate-400">Employees</div>
          <div className="text-2xl font-bold text-amber-400">
            {new Set(
              summary.flatMap(s => s.employees.map(e => e.name))
            ).size}
          </div>
        </div>
      </div>

      <div className="bg-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800 border-b border-slate-600">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Department
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Task</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Employees (Count)
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-300">
                  Entries
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-300">
                  Total Hours
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Dates</th>
              </tr>
            </thead>
            <tbody>
              {summary.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-slate-400">
                    No data to display
                  </td>
                </tr>
              ) : (
                summary.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-600 hover:bg-slate-600 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-semibold text-slate-100">
                      {row.department_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-100">{row.task_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-200">
                      <div className="space-y-1">
                        {row.employees.map((emp, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span>{emp.name}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                emp.type === 'regular'
                                  ? 'bg-green-600 text-white'
                                  : 'bg-amber-600 text-white'
                              }`}
                            >
                              {emp.type === 'regular' ? 'R' : 'T'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-blue-400">
                      {row.total_entries}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-green-400">
                      {getTotalHours(row.total_duration_minutes).toFixed(2)}h
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300 truncate">
                      {row.dates.join(', ')}
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
