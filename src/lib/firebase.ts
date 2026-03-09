import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, update, remove } from 'firebase/database';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

if (
  !firebaseConfig.apiKey ||
  !firebaseConfig.projectId ||
  !firebaseConfig.databaseURL
) {
  throw new Error('Missing Firebase environment variables');
}

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

export const initializeFirebase = () => {
  return db;
};

export const firebaseService = {
  async getDepartments() {
    const snapshot = await get(ref(db, 'departments'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data).map(([id, value]: [string, any]) => ({
        id,
        ...value,
      }));
    }
    return [];
  },

  async addDepartment(name: string, description = '') {
    const id = Date.now().toString();
    await set(ref(db, `departments/${id}`), {
      name,
      description,
      created_at: new Date().toISOString(),
    });
    return { id, name, description };
  },

  async getEmployees() {
    const snapshot = await get(ref(db, 'employees'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data).map(([id, value]: [string, any]) => ({
        id,
        ...value,
      }));
    }
    return [];
  },

  async addEmployee(
    name: string,
    employmentType: string,
    departmentId?: string
  ) {
    const id = Date.now().toString();
    await set(ref(db, `employees/${id}`), {
      name,
      employment_type: employmentType,
      department_id: departmentId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return { id, name, employment_type: employmentType, department_id: departmentId || null };
  },

  async updateEmployee(
    id: string,
    updates: Partial<{ name: string; employment_type: string; department_id: string }>
  ) {
    await update(ref(db, `employees/${id}`), {
      ...updates,
      updated_at: new Date().toISOString(),
    });
  },

  async deleteEmployee(id: string) {
    await remove(ref(db, `employees/${id}`));
  },

  async getTasks() {
    const snapshot = await get(ref(db, 'tasks'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data).map(([id, value]: [string, any]) => ({
        id,
        ...value,
      }));
    }
    return [];
  },

  async addTask(name: string, departmentId: string) {
    const id = Date.now().toString();
    await set(ref(db, `tasks/${id}`), {
      name,
      department_id: departmentId,
      created_at: new Date().toISOString(),
    });
    return { id, name, department_id: departmentId };
  },

  async getTimeEntries(date?: string) {
    const snapshot = await get(ref(db, 'time_entries'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      let entries = Object.entries(data).map(([id, value]: [string, any]) => ({
        id,
        ...value,
      }));

      if (date) {
        entries = entries.filter((e: any) => e.date === date);
      }

      return entries.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    return [];
  },

  async addTimeEntry(
    employeeId: string,
    taskId: string,
    date: string,
    shiftId?: string
  ) {
    const id = Date.now().toString();
    const startTime = new Date().toISOString();
    const entryData: any = {
      employee_id: employeeId,
      task_id: taskId,
      start_time: startTime,
      end_time: null,
      duration_minutes: null,
      date,
      created_at: startTime,
      updated_at: startTime,
    };
    if (shiftId) {
      entryData.shift_id = shiftId;
    }
    await set(ref(db, `time_entries/${id}`), entryData);
    return {
      id,
      employee_id: employeeId,
      task_id: taskId,
      start_time: startTime,
      end_time: null,
      duration_minutes: null,
      date,
      shift_id: shiftId,
    };
  },

  async updateTimeEntry(
    id: string,
    updates: Partial<{
      end_time: string;
      duration_minutes: number;
      updated_at: string;
    }>
  ) {
    await update(ref(db, `time_entries/${id}`), {
      ...updates,
      updated_at: new Date().toISOString(),
    });
  },

  async getTimeEntriesByDateRange(dateFrom: string, dateTo: string) {
    const snapshot = await get(ref(db, 'time_entries'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      const entries = Object.entries(data).map(([id, value]: [string, any]) => ({
        id,
        ...value,
      }));

      return entries.filter((e: any) => {
        const entryDate = e.date;
        return entryDate >= dateFrom && entryDate <= dateTo && e.duration_minutes;
      });
    }
    return [];
  },

  async getShifts() {
    const snapshot = await get(ref(db, 'shifts'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data).map(([id, value]: [string, any]) => ({
        id,
        ...value,
      }));
    }
    return [];
  },

  async addShift(name: string, startTime: string, endTime: string) {
    const id = Date.now().toString();
    await set(ref(db, `shifts/${id}`), {
      name,
      start_time: startTime,
      end_time: endTime,
      created_at: new Date().toISOString(),
    });
    return { id, name, start_time: startTime, end_time: endTime };
  },

  async updateShift(id: string, updates: any) {
    await update(ref(db, `shifts/${id}`), {
      ...updates,
      updated_at: new Date().toISOString(),
    });
  },

  async deleteShift(id: string) {
    await remove(ref(db, `shifts/${id}`));
  },

  async getEmployeeShifts() {
    const snapshot = await get(ref(db, 'employee_shifts'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data).map(([id, value]: [string, any]) => ({
        id,
        ...value,
      }));
    }
    return [];
  },

  async addEmployeeShift(employeeId: string, shiftId: string, assignedDate: string) {
    const id = Date.now().toString();
    await set(ref(db, `employee_shifts/${id}`), {
      employee_id: employeeId,
      shift_id: shiftId,
      assigned_date: assignedDate,
      created_at: new Date().toISOString(),
    });
    return { id, employee_id: employeeId, shift_id: shiftId, assigned_date: assignedDate };
  },

  async deleteEmployeeShift(id: string) {
    await remove(ref(db, `employee_shifts/${id}`));
  },

  async getEmployeeShiftForDate(employeeId: string, date: string) {
    const snapshot = await get(ref(db, 'employee_shifts'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      const employeeShift = Object.entries(data).find(([, value]: [string, any]) =>
        value.employee_id === employeeId && value.assigned_date === date
      );
      if (employeeShift) {
        return {
          id: employeeShift[0],
          ...employeeShift[1],
        };
      }
    }
    return null;
  },

  async deleteTimeEntry(id: string) {
    await remove(ref(db, `time_entries/${id}`));
  },

  async hasActiveBreak(employeeId: string, date: string): Promise<boolean> {
    const snapshot = await get(ref(db, 'breaks'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      const breaks = Object.values(data) as any[];

      for (const brk of breaks) {
        const entry = await get(ref(db, `time_entries/${brk.entry_id}`));
        if (entry.exists()) {
          const entryData = entry.val();
          if (
            entryData.employee_id === employeeId &&
            entryData.date === date &&
            brk.end_time === null
          ) {
            return true;
          }
        }
      }
    }
    return false;
  },

  async addBreak(
    entryId: string,
    breakType: 'paid_15' | 'unpaid_30',
    startTime: string
  ) {
    const id = Date.now().toString();
    await set(ref(db, `breaks/${id}`), {
      entry_id: entryId,
      type: breakType,
      start_time: startTime,
      end_time: null,
      duration_minutes: null,
      created_at: startTime,
    });
    return {
      id,
      entry_id: entryId,
      type: breakType,
      start_time: startTime,
      end_time: null,
      duration_minutes: null,
    };
  },

  async updateBreak(
    id: string,
    updates: Partial<{
      end_time: string;
      duration_minutes: number;
    }>
  ) {
    await update(ref(db, `breaks/${id}`), {
      ...updates,
      updated_at: new Date().toISOString(),
    });
  },

  async deleteBreak(id: string) {
    await remove(ref(db, `breaks/${id}`));
  },

  async getBreaksByTimeEntry(entryId: string) {
    const snapshot = await get(ref(db, 'breaks'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      const breaks = Object.entries(data)
        .filter(([, value]: [string, any]) => value.entry_id === entryId)
        .map(([id, value]: [string, any]) => ({
          id,
          ...value,
        }));
      return breaks;
    }
    return [];
  },

  async getBreaksByEmployeeAndDate(employeeId: string, date: string) {
    const entries = await this.getTimeEntries(date);
    const employeeEntries = entries.filter((e: any) => e.employee_id === employeeId);

    const breaks: any[] = [];
    for (const entry of employeeEntries) {
      const entryBreaks = await this.getBreaksByTimeEntry(entry.id);
      breaks.push(...entryBreaks);
    }
    return breaks;
  },

  async getAllBreaks() {
    const snapshot = await get(ref(db, 'breaks'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.entries(data).map(([id, value]: [string, any]) => ({
        id,
        ...value,
      }));
    }
    return [];
  },
};

export type Database = any;

export const authService = {
  async signUp(email: string, password: string) {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return { user: result.user, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  },

  async signIn(email: string, password: string) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return { user: result.user, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  },

  async logout() {
    try {
      await signOut(auth);
      return { error: null };
    } catch (error: any) {
      return { error: error.message };
    }
  },

  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  },

  getCurrentUser() {
    return auth.currentUser;
  },
};
