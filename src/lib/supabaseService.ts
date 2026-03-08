import { supabase } from './supabase';

export const supabaseService = {
  async getDepartments() {
    const { data, error } = await supabase
      .from('departments')
      .select('*');
    if (error) throw error;
    return data || [];
  },

  async addDepartment(name: string, description = '') {
    const { data, error } = await supabase
      .from('departments')
      .insert([{ name, description }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getEmployees() {
    const { data, error } = await supabase
      .from('employees')
      .select('*');
    if (error) throw error;
    return data || [];
  },

  async addEmployee(
    name: string,
    employmentType: string,
    departmentId?: string
  ) {
    const { data, error } = await supabase
      .from('employees')
      .insert([{
        name,
        employment_type: employmentType,
        department_id: departmentId || null,
        is_active: true,
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateEmployee(
    id: string,
    updates: Partial<{ name: string; employment_type: string; department_id: string }>
  ) {
    const { data, error } = await supabase
      .from('employees')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteEmployee(id: string) {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*');
    if (error) throw error;
    return data || [];
  },

  async addTask(name: string, departmentId: string) {
    const { data, error } = await supabase
      .from('tasks')
      .insert([{ name, department_id: departmentId }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getTimeEntries(date?: string) {
    let query = supabase
      .from('time_entries')
      .select('*');

    if (date) {
      query = query.eq('entry_date', date);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data?.map((entry: any) => ({
      ...entry,
      date: entry.entry_date,
      duration_minutes: entry.duration_hours ? entry.duration_hours * 60 : null,
    })) || [];
  },

  async addTimeEntry(
    employeeId: string,
    taskId: string,
    date: string,
    shiftId?: string
  ) {
    const now = new Date().toISOString();
    const entryData: any = {
      employee_id: employeeId,
      task_id: taskId,
      start_time: now,
      end_time: null,
      duration_hours: null,
      entry_date: date,
      assignment_id: null,
    };
    if (shiftId) {
      entryData.shift_id = shiftId;
    }

    const { data, error } = await supabase
      .from('time_entries')
      .insert([entryData])
      .select()
      .single();
    if (error) throw error;

    return {
      ...data,
      date: data.entry_date,
      duration_minutes: null,
    };
  },

  async updateTimeEntry(
    id: string,
    updates: Partial<{
      end_time: string;
      duration_minutes: number;
    }>
  ) {
    const updateData: any = {};
    if (updates.end_time) {
      updateData.end_time = updates.end_time;
    }
    if (updates.duration_minutes !== undefined) {
      updateData.duration_hours = updates.duration_minutes / 60;
    }
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('time_entries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteTimeEntry(id: string) {
    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getTimeEntriesByDateRange(dateFrom: string, dateTo: string) {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .gte('entry_date', dateFrom)
      .lte('entry_date', dateTo)
      .not('duration_hours', 'is', null);

    if (error) throw error;
    return data?.map((entry: any) => ({
      ...entry,
      date: entry.entry_date,
      duration_minutes: entry.duration_hours ? entry.duration_hours * 60 : null,
    })) || [];
  },

  async getShifts() {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .order('name');
    if (error) throw error;
    return data?.map((shift: any) => ({
      id: shift.id,
      name: shift.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
    })) || [];
  },

  async addShift(name: string, startTime: string, endTime: string) {
    const { data, error } = await supabase
      .from('shifts')
      .insert([{ name, start_time: startTime, end_time: endTime }])
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      name: data.name,
      start_time: data.start_time,
      end_time: data.end_time,
    };
  },

  async updateShift(id: string, updates: any) {
    const { error } = await supabase
      .from('shifts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteShift(id: string) {
    const { error } = await supabase
      .from('shifts')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getEmployeeShifts() {
    const { data, error } = await supabase
      .from('employee_shifts')
      .select('*')
      .order('assigned_date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async addEmployeeShift(employeeId: string, shiftId: string, assignedDate: string) {
    const { data, error } = await supabase
      .from('employee_shifts')
      .insert([{
        employee_id: employeeId,
        shift_id: shiftId,
        assigned_date: assignedDate,
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteEmployeeShift(id: string) {
    const { error } = await supabase
      .from('employee_shifts')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
