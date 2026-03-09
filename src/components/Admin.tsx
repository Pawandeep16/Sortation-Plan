import { useState, useEffect } from 'react';
import { Plus, Trash2, CreditCard as Edit2, Check, X, AlertTriangle } from 'lucide-react';
import { firebaseService } from '../lib/firebase';
import { getToday } from '../lib/utils';

interface Employee {
  id: string;
  name: string;
  employment_type: string;
  department_id: string | null;
}

interface Department {
  id: string;
  name: string;
  description?: string;
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

interface EmployeeShift {
  id: string;
  employee_id: string;
  shift_id: string;
  assigned_date: string;
}

export default function Admin() {
  const [activeSection, setActiveSection] = useState<'employees' | 'departments' | 'tasks' | 'shifts' | 'employee-shifts' | 'cleanup'>('employees');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employeeShifts, setEmployeeShifts] = useState<EmployeeShift[]>([]);

  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    employment_type: 'regular' as const,
    department_id: '',
    shift_ids: [] as string[],
  });

  const [showDepartmentForm, setShowDepartmentForm] = useState(false);
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [departmentForm, setDepartmentForm] = useState({
    name: '',
    description: '',
  });

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({
    name: '',
    department_id: '',
  });

  const [showShiftForm, setShowShiftForm] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftForm, setShiftForm] = useState({
    name: '',
    start_time: '09:00',
    end_time: '17:00',
  });

  const [showEmployeeShiftForm, setShowEmployeeShiftForm] = useState(false);
  const [employeeShiftForm, setEmployeeShiftForm] = useState({
    employee_id: '',
    shift_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });

  const [cleanupDateFrom, setCleanupDateFrom] = useState(getToday());
  const [cleanupDateTo, setCleanupDateTo] = useState(getToday());
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [cleanupPasscode, setCleanupPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [emps, depts, tsks, shfts, empShfts] = await Promise.all([
      firebaseService.getEmployees(),
      firebaseService.getDepartments(),
      firebaseService.getTasks(),
      firebaseService.getShifts(),
      firebaseService.getEmployeeShifts(),
    ]);

    setEmployees(emps);
    setDepartments(depts);
    setTasks(tsks);
    setShifts(shfts);
    setEmployeeShifts(empShfts);
  };

  const handleAddEmployee = async () => {
    if (!employeeForm.name.trim()) return;

    if (editingEmployeeId) {
      await firebaseService.updateEmployee(editingEmployeeId, {
        name: employeeForm.name,
        employment_type: employeeForm.employment_type,
        department_id: employeeForm.department_id,
      });
      setEmployees(
        employees.map(e =>
          e.id === editingEmployeeId
            ? { ...e, ...employeeForm, department_id: employeeForm.department_id || null }
            : e
        )
      );
    } else {
      const emp = await firebaseService.addEmployee(
        employeeForm.name,
        employeeForm.employment_type,
        employeeForm.department_id
      );
      setEmployees([...employees, emp]);

      const assignedDate = new Date().toISOString().split('T')[0];
      for (const shiftId of employeeForm.shift_ids) {
        const empShift = await firebaseService.addEmployeeShift(
          emp.id,
          shiftId,
          assignedDate
        );
        setEmployeeShifts([...employeeShifts, empShift]);
      }
    }
    resetEmployeeForm();
  };

  const handleDeleteEmployee = async (id: string) => {
    if (confirm('Are you sure you want to delete this employee?')) {
      await firebaseService.deleteEmployee(id);
      setEmployees(employees.filter(e => e.id !== id));
    }
  };

  const resetEmployeeForm = () => {
    setEmployeeForm({ name: '', employment_type: 'regular', department_id: '', shift_ids: [] });
    setEditingEmployeeId(null);
    setShowEmployeeForm(false);
  };

  const handleAddDepartment = async () => {
    if (!departmentForm.name.trim()) return;

    if (editingDepartmentId) {
      setDepartments(
        departments.map(d => (d.id === editingDepartmentId ? { ...d, ...departmentForm } : d))
      );
    } else {
      const dept = await firebaseService.addDepartment(
        departmentForm.name,
        departmentForm.description
      );
      setDepartments([...departments, dept]);
    }
    resetDepartmentForm();
  };

  const handleDeleteDepartment = async (id: string) => {
    if (confirm('Are you sure? This will affect all related tasks.')) {
      setDepartments(departments.filter(d => d.id !== id));
      setTasks(tasks.filter(t => t.department_id !== id));
    }
  };

  const resetDepartmentForm = () => {
    setDepartmentForm({ name: '', description: '' });
    setEditingDepartmentId(null);
    setShowDepartmentForm(false);
  };

  const handleAddTask = async () => {
    if (!taskForm.name.trim() || !taskForm.department_id) return;

    if (editingTaskId) {
      const updatedTask = {
        id: editingTaskId,
        name: taskForm.name,
        department_id: taskForm.department_id,
      };
      setTasks(tasks.map(t => (t.id === editingTaskId ? updatedTask : t)));
    } else {
      const task = await firebaseService.addTask(
        taskForm.name,
        taskForm.department_id
      );
      setTasks([...tasks, task]);
    }
    resetTaskForm();
  };

  const handleDeleteTask = async (id: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      setTasks(tasks.filter(t => t.id !== id));
    }
  };

  const resetTaskForm = () => {
    setTaskForm({ name: '', department_id: '' });
    setEditingTaskId(null);
    setShowTaskForm(false);
  };

  const handleAddShift = async () => {
    if (!shiftForm.name.trim()) return;

    if (editingShiftId) {
      await firebaseService.updateShift(editingShiftId, shiftForm);
      setShifts(
        shifts.map(s =>
          s.id === editingShiftId
            ? { ...s, ...shiftForm }
            : s
        )
      );
    } else {
      const shift = await firebaseService.addShift(
        shiftForm.name,
        shiftForm.start_time,
        shiftForm.end_time
      );
      setShifts([...shifts, shift]);
    }
    resetShiftForm();
  };

  const handleDeleteShift = async (id: string) => {
    if (confirm('Are you sure you want to delete this shift?')) {
      await firebaseService.deleteShift(id);
      setShifts(shifts.filter(s => s.id !== id));
    }
  };

  const resetShiftForm = () => {
    setShiftForm({ name: '', start_time: '09:00', end_time: '17:00' });
    setEditingShiftId(null);
    setShowShiftForm(false);
  };

  const handleAddEmployeeShift = async () => {
    if (!employeeShiftForm.employee_id || !employeeShiftForm.shift_id || !employeeShiftForm.start_date || !employeeShiftForm.end_date) return;

    if (new Date(employeeShiftForm.start_date) > new Date(employeeShiftForm.end_date)) {
      alert('End date must be after start date');
      return;
    }

    const currentDate = new Date(employeeShiftForm.start_date);
    const endDate = new Date(employeeShiftForm.end_date);
    const newShifts: any[] = [];

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const empShift = await firebaseService.addEmployeeShift(
        employeeShiftForm.employee_id,
        employeeShiftForm.shift_id,
        dateStr
      );
      newShifts.push(empShift);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    setEmployeeShifts([...employeeShifts, ...newShifts]);
    resetEmployeeShiftForm();
  };

  const handleDeleteEmployeeShift = async (id: string) => {
    if (confirm('Remove this shift assignment?')) {
      await firebaseService.deleteEmployeeShift(id);
      setEmployeeShifts(employeeShifts.filter(es => es.id !== id));
    }
  };

  const resetEmployeeShiftForm = () => {
    setEmployeeShiftForm({
      employee_id: '',
      shift_id: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
    });
    setShowEmployeeShiftForm(false);
  };

  const handleCleanupDatabase = async () => {
    const correctPasscode = import.meta.env.VITE_CLEANUP_PASSCODE || 'sortation2024';

    if (cleanupPasscode !== correctPasscode) {
      setPasscodeError('Invalid passcode. Please try again.');
      return;
    }

    try {
      const allEntries = await firebaseService.getTimeEntriesByDateRange(cleanupDateFrom, cleanupDateTo);
      const deletedCount = allEntries.length;

      await Promise.all(
        allEntries.map(entry => firebaseService.deleteTimeEntry(entry.id))
      );

      setShowCleanupConfirm(false);
      setCleanupPasscode('');
      setPasscodeError('');
      alert(`Successfully deleted ${deletedCount} time entries from ${cleanupDateFrom} to ${cleanupDateTo}`);
      fetchData();
    } catch (error) {
      alert('Error cleaning database: ' + error);
    }
  };

  const getEmploymentTypeBadge = (type: string) => {
    return type === 'regular' ? (
      <span className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-full">
        Regular
      </span>
    ) : (
      <span className="px-3 py-1 bg-amber-600 text-white text-xs font-semibold rounded-full">
        Temporary
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <button
          onClick={() => setActiveSection('employees')}
          className={`p-3 rounded-lg font-semibold transition-all ${
            activeSection === 'employees'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Employees
        </button>
        <button
          onClick={() => setActiveSection('departments')}
          className={`p-3 rounded-lg font-semibold transition-all ${
            activeSection === 'departments'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Departments
        </button>
        <button
          onClick={() => setActiveSection('tasks')}
          className={`p-3 rounded-lg font-semibold transition-all ${
            activeSection === 'tasks'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Tasks
        </button>
        <button
          onClick={() => setActiveSection('shifts')}
          className={`p-3 rounded-lg font-semibold transition-all ${
            activeSection === 'shifts'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Shifts
        </button>
        <button
          onClick={() => setActiveSection('employee-shifts')}
          className={`p-3 rounded-lg font-semibold transition-all ${
            activeSection === 'employee-shifts'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Employee Shifts
        </button>
        <button
          onClick={() => setActiveSection('cleanup')}
          className={`p-3 rounded-lg font-semibold transition-all ${
            activeSection === 'cleanup'
              ? 'bg-red-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Cleanup
        </button>
      </div>

      {activeSection === 'employees' && (
        <div>
          <div className="mb-6">
            <button
              onClick={() => {
                resetEmployeeForm();
                setShowEmployeeForm(true);
              }}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Employee
            </button>
          </div>

          {showEmployeeForm && (
            <div className="bg-slate-700 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">
                {editingEmployeeId ? 'Edit Employee' : 'Add New Employee'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Employee name"
                  value={employeeForm.name}
                  onChange={e => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                  className="bg-slate-600 border border-slate-500 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
                <select
                  value={employeeForm.employment_type}
                  onChange={e =>
                    setEmployeeForm({
                      ...employeeForm,
                      employment_type: e.target.value as 'regular' | 'temporary',
                    })
                  }
                  className="bg-slate-600 border border-slate-500 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="regular">Regular</option>
                  <option value="temporary">Temporary</option>
                </select>
                <select
                  value={employeeForm.department_id}
                  onChange={e => setEmployeeForm({ ...employeeForm, department_id: e.target.value })}
                  className="bg-slate-600 border border-slate-500 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">No Department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              {!editingEmployeeId && (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Assign Shifts (Optional)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {shifts.map(shift => (
                      <label key={shift.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={employeeForm.shift_ids.includes(shift.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setEmployeeForm({
                                ...employeeForm,
                                shift_ids: [...employeeForm.shift_ids, shift.id],
                              });
                            } else {
                              setEmployeeForm({
                                ...employeeForm,
                                shift_ids: employeeForm.shift_ids.filter(id => id !== shift.id),
                              });
                            }
                          }}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <span className="text-sm text-slate-300">
                          {shift.name} ({shift.start_time} - {shift.end_time})
                        </span>
                      </label>
                    ))}
                  </div>
                  {shifts.length === 0 && (
                    <p className="text-sm text-slate-400">No shifts available. Create shifts first.</p>
                  )}
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAddEmployee}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  <Check className="w-5 h-5" />
                  {editingEmployeeId ? 'Update' : 'Add'}
                </button>
                <button
                  onClick={resetEmployeeForm}
                  className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                    Department
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-slate-400">
                      No employees yet
                    </td>
                  </tr>
                ) : (
                  employees.map(emp => {
                    const dept = departments.find(d => d.id === emp.department_id);
                    return (
                      <tr key={emp.id} className="border-b border-slate-700 hover:bg-slate-700">
                        <td className="px-4 py-3 text-sm text-slate-100 font-medium">{emp.name}</td>
                        <td className="px-4 py-3 text-sm">{getEmploymentTypeBadge(emp.employment_type)}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{dept?.name || '-'}</td>
                        <td className="px-4 py-3 text-sm flex gap-2">
                          <button
                            onClick={() => {
                              setEmployeeForm({
                                name: emp.name,
                                employment_type: emp.employment_type as 'regular' | 'temporary',
                                department_id: emp.department_id || '',
                              });
                              setEditingEmployeeId(emp.id);
                              setShowEmployeeForm(true);
                            }}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(emp.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'departments' && (
        <div>
          <div className="mb-6">
            <button
              onClick={() => {
                resetDepartmentForm();
                setShowDepartmentForm(true);
              }}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Department
            </button>
          </div>

          {showDepartmentForm && (
            <div className="bg-slate-700 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">
                {editingDepartmentId ? 'Edit Department' : 'Add New Department'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Department name"
                  value={departmentForm.name}
                  onChange={e => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                  className="bg-slate-600 border border-slate-500 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={departmentForm.description}
                  onChange={e =>
                    setDepartmentForm({ ...departmentForm, description: e.target.value })
                  }
                  className="bg-slate-600 border border-slate-500 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAddDepartment}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  <Check className="w-5 h-5" />
                  {editingDepartmentId ? 'Update' : 'Add'}
                </button>
                <button
                  onClick={resetDepartmentForm}
                  className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {departments.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-slate-400">
                      No departments yet
                    </td>
                  </tr>
                ) : (
                  departments.map(dept => (
                    <tr key={dept.id} className="border-b border-slate-700 hover:bg-slate-700">
                      <td className="px-4 py-3 text-sm text-slate-100 font-medium">{dept.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{dept.description || '-'}</td>
                      <td className="px-4 py-3 text-sm flex gap-2">
                        <button
                          onClick={() => {
                            setDepartmentForm({
                              name: dept.name,
                              description: dept.description || '',
                            });
                            setEditingDepartmentId(dept.id);
                            setShowDepartmentForm(true);
                          }}
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDepartment(dept.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'tasks' && (
        <div>
          <div className="mb-6">
            <button
              onClick={() => {
                resetTaskForm();
                setShowTaskForm(true);
              }}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Task
            </button>
          </div>

          {showTaskForm && (
            <div className="bg-slate-700 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">
                {editingTaskId ? 'Edit Task' : 'Add New Task'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Task name"
                  value={taskForm.name}
                  onChange={e => setTaskForm({ ...taskForm, name: e.target.value })}
                  className="bg-slate-600 border border-slate-500 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
                <select
                  value={taskForm.department_id}
                  onChange={e => setTaskForm({ ...taskForm, department_id: e.target.value })}
                  className="bg-slate-600 border border-slate-500 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAddTask}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  <Check className="w-5 h-5" />
                  {editingTaskId ? 'Update' : 'Add'}
                </button>
                <button
                  onClick={resetTaskForm}
                  className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                    Department
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-slate-400">
                      No tasks yet
                    </td>
                  </tr>
                ) : (
                  tasks.map(task => {
                    const dept = departments.find(d => d.id === task.department_id);
                    return (
                      <tr key={task.id} className="border-b border-slate-700 hover:bg-slate-700">
                        <td className="px-4 py-3 text-sm text-slate-100 font-medium">{task.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{dept?.name || '-'}</td>
                        <td className="px-4 py-3 text-sm flex gap-2">
                          <button
                            onClick={() => {
                              setTaskForm({
                                name: task.name,
                                department_id: task.department_id,
                              });
                              setEditingTaskId(task.id);
                              setShowTaskForm(true);
                            }}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'shifts' && (
        <div>
          <div className="mb-6">
            <button
              onClick={() => {
                resetShiftForm();
                setShowShiftForm(true);
              }}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Shift
            </button>
          </div>

          {showShiftForm && (
            <div className="bg-slate-700 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">
                {editingShiftId ? 'Edit Shift' : 'Add New Shift'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Shift name (e.g., Morning)"
                  value={shiftForm.name}
                  onChange={e => setShiftForm({ ...shiftForm, name: e.target.value })}
                  className="bg-slate-600 border border-slate-500 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
                <input
                  type="time"
                  value={shiftForm.start_time}
                  onChange={e => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                  className="bg-slate-600 border border-slate-500 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
                <input
                  type="time"
                  value={shiftForm.end_time}
                  onChange={e => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                  className="bg-slate-600 border border-slate-500 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAddShift}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  <Check className="w-5 h-5" />
                  {editingShiftId ? 'Update' : 'Add'}
                </button>
                <button
                  onClick={resetShiftForm}
                  className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Start Time</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">End Time</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shifts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-slate-400">
                      No shifts yet
                    </td>
                  </tr>
                ) : (
                  shifts.map(shift => (
                    <tr key={shift.id} className="border-b border-slate-700 hover:bg-slate-700">
                      <td className="px-4 py-3 text-sm text-slate-100 font-medium">{shift.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{shift.start_time}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{shift.end_time}</td>
                      <td className="px-4 py-3 text-sm flex gap-2">
                        <button
                          onClick={() => {
                            setShiftForm({
                              name: shift.name,
                              start_time: shift.start_time,
                              end_time: shift.end_time,
                            });
                            setEditingShiftId(shift.id);
                            setShowShiftForm(true);
                          }}
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteShift(shift.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'employee-shifts' && (
        <div>
          <div className="mb-6">
            <button
              onClick={() => {
                resetEmployeeShiftForm();
                setShowEmployeeShiftForm(true);
              }}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              <Plus className="w-5 h-5" />
              Assign Shift
            </button>
          </div>

          {showEmployeeShiftForm && (
            <div className="bg-slate-700 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">Assign Shift to Employee</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <select
                  value={employeeShiftForm.employee_id}
                  onChange={e => setEmployeeShiftForm({ ...employeeShiftForm, employee_id: e.target.value })}
                  className="bg-slate-600 border border-slate-500 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
                <select
                  value={employeeShiftForm.shift_id}
                  onChange={e => setEmployeeShiftForm({ ...employeeShiftForm, shift_id: e.target.value })}
                  className="bg-slate-600 border border-slate-500 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select Shift</option>
                  {shifts.map(shift => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name} ({shift.start_time} - {shift.end_time})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={employeeShiftForm.start_date}
                    onChange={e => setEmployeeShiftForm({ ...employeeShiftForm, start_date: e.target.value })}
                    className="w-full bg-slate-600 border border-slate-500 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">End Date</label>
                  <input
                    type="date"
                    value={employeeShiftForm.end_date}
                    onChange={e => setEmployeeShiftForm({ ...employeeShiftForm, end_date: e.target.value })}
                    className="w-full bg-slate-600 border border-slate-500 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAddEmployeeShift}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  <Check className="w-5 h-5" />
                  Assign for Date Range
                </button>
                <button
                  onClick={resetEmployeeShiftForm}
                  className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Employee</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Shift</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">From Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">To Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employeeShifts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-center text-slate-400">
                      No shift assignments yet
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const groupedShifts = new Map<string, typeof employeeShifts>();
                    employeeShifts.forEach(es => {
                      const key = `${es.employee_id}-${es.shift_id}`;
                      if (!groupedShifts.has(key)) {
                        groupedShifts.set(key, []);
                      }
                      groupedShifts.get(key)!.push(es);
                    });

                    return Array.from(groupedShifts.entries()).map(([key, shifts]) => {
                      const sortedShifts = [...shifts].sort((a, b) =>
                        new Date(a.assigned_date).getTime() - new Date(b.assigned_date).getTime()
                      );
                      const firstShift = sortedShifts[0];
                      const lastShift = sortedShifts[sortedShifts.length - 1];
                      const emp = employees.find(e => e.id === firstShift.employee_id);
                      const shift = shifts.find(s => s.id === firstShift.shift_id);

                      return (
                        <tr key={key} className="border-b border-slate-700 hover:bg-slate-700">
                          <td className="px-4 py-3 text-sm text-slate-100 font-medium">{emp?.name}</td>
                          <td className="px-4 py-3 text-sm text-slate-300">
                            {shift?.name} ({shift?.start_time} - {shift?.end_time})
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-300">{firstShift.assigned_date}</td>
                          <td className="px-4 py-3 text-sm text-slate-300">{lastShift.assigned_date}</td>
                          <td className="px-4 py-3 text-sm flex gap-2">
                            <button
                              onClick={() => {
                                if (confirm('Remove this entire shift assignment?')) {
                                  sortedShifts.forEach(s => {
                                    firebaseService.deleteEmployeeShift(s.id);
                                  });
                                  setEmployeeShifts(employeeShifts.filter(es => !sortedShifts.find(s => s.id === es.id)));
                                }
                              }}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'cleanup' && (
        <div>
          <div className="bg-red-900 border border-red-700 rounded-lg p-6 mb-6">
            <div className="flex gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Database Cleanup</h3>
                <p className="text-red-200 text-sm mb-4">
                  This will permanently delete all time entries within the selected date range. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="bg-red-800 rounded-lg p-4 mb-6">
              <h4 className="text-white font-semibold mb-4">Select Date Range</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-red-200 mb-2">From Date</label>
                  <input
                    type="date"
                    value={cleanupDateFrom}
                    onChange={e => setCleanupDateFrom(e.target.value)}
                    className="w-full bg-red-700 border border-red-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-200 mb-2">To Date</label>
                  <input
                    type="date"
                    value={cleanupDateTo}
                    onChange={e => setCleanupDateTo(e.target.value)}
                    className="w-full bg-red-700 border border-red-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <button
                onClick={() => setShowCleanupConfirm(true)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                Delete Data in Range
              </button>
            </div>

            {showCleanupConfirm && (
              <div className="bg-red-950 border border-red-700 rounded-lg p-4">
                <p className="text-white mb-4 font-semibold">
                  Are you sure you want to delete all time entries from {cleanupDateFrom} to {cleanupDateTo}?
                </p>
                <p className="text-red-200 text-sm mb-4">This cannot be undone.</p>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-red-200 mb-2">
                    Enter Passcode to Confirm
                  </label>
                  <input
                    type="password"
                    value={cleanupPasscode}
                    onChange={e => {
                      setCleanupPasscode(e.target.value);
                      setPasscodeError('');
                    }}
                    placeholder="Enter passcode"
                    className="w-full bg-red-700 border border-red-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                  />
                  {passcodeError && (
                    <p className="text-red-300 text-sm mt-2">{passcodeError}</p>
                  )}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleCleanupDatabase}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                  >
                    <Check className="w-5 h-5" />
                    Yes, Delete All
                  </button>
                  <button
                    onClick={() => {
                      setShowCleanupConfirm(false);
                      setCleanupPasscode('');
                      setPasscodeError('');
                    }}
                    className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                  >
                    <X className="w-5 h-5" />
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
