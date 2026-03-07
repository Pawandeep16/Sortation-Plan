import { useState, useEffect } from 'react';
import { Plus, Trash2, CreditCard as Edit2, Check, X } from 'lucide-react';
import { firebaseService } from '../lib/firebase';

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

export default function Admin() {
  const [activeSection, setActiveSection] = useState<'employees' | 'departments' | 'tasks'>('employees');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    employment_type: 'regular' as const,
    department_id: '',
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [emps, depts, tsks] = await Promise.all([
      firebaseService.getEmployees(),
      firebaseService.getDepartments(),
      firebaseService.getTasks(),
    ]);

    setEmployees(emps);
    setDepartments(depts);
    setTasks(tsks);
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
    setEmployeeForm({ name: '', employment_type: 'regular', department_id: '' });
    setEditingEmployeeId(null);
    setShowEmployeeForm(false);
  };

  const handleAddDepartment = async () => {
    if (!departmentForm.name.trim()) return;

    if (editingDepartmentId) {
      // Update department
      const updatedDept = {
        ...departmentForm,
        id: editingDepartmentId,
      };
      setDepartments(
        departments.map(d => (d.id === editingDepartmentId ? updatedDept : d))
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
      // Note: In a real app, you'd handle cascading deletes
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
    </div>
  );
}
