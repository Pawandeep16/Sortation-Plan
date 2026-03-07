import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  get,
  query,
  orderByChild,
  onValue,
  update,
  remove,
  DatabaseReference,
} from 'firebase/database';

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
  !firebaseConfig.projectId
) {
  throw new Error('Missing Firebase environment variables');
}

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

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
    date: string
  ) {
    const id = Date.now().toString();
    const startTime = new Date().toISOString();
    await set(ref(db, `time_entries/${id}`), {
      employee_id: employeeId,
      task_id: taskId,
      start_time: startTime,
      end_time: null,
      duration_minutes: null,
      date,
      created_at: startTime,
      updated_at: startTime,
    });
    return {
      id,
      employee_id: employeeId,
      task_id: taskId,
      start_time: startTime,
      end_time: null,
      duration_minutes: null,
      date,
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
};

export type Database = any;
