import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { firebaseService } from '../lib/firebase';
import { getToday } from '../lib/utils';

interface BreakContextType {
  employeesOnBreak: Set<string>;
  isEmployeeOnBreak: (employeeId: string) => boolean;
  setEmployeeOnBreak: (employeeId: string, onBreak: boolean) => void;
}

const BreakContext = createContext<BreakContextType | null>(null);

export function BreakProvider({ children }: { children: ReactNode }) {
  const [employeesOnBreak, setEmployeesOnBreak] = useState<Set<string>>(new Set());

  useEffect(() => {
    const initializeBreakState = async () => {
      try {
        const employees = await firebaseService.getEmployees();
        const onBreak = new Set<string>();

        for (const emp of employees) {
          const hasBreak = await firebaseService.hasActiveBreak(emp.id, getToday());
          if (hasBreak) {
            onBreak.add(emp.id);
          }
        }
        setEmployeesOnBreak(onBreak);
      } catch (error) {
        console.error('Failed to initialize break state:', error);
      }
    };

    initializeBreakState();
  }, []);

  useEffect(() => {
    const handleBreakStarted = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { employeeId } = customEvent.detail;
      setEmployeesOnBreak(prev => new Set([...prev, employeeId]));
    };

    const handleBreakEnded = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { employeeId } = customEvent.detail;
      setEmployeesOnBreak(prev => {
        const updated = new Set(prev);
        updated.delete(employeeId);
        return updated;
      });
    };

    window.addEventListener('breakStarted', handleBreakStarted);
    window.addEventListener('breakEnded', handleBreakEnded);

    return () => {
      window.removeEventListener('breakStarted', handleBreakStarted);
      window.removeEventListener('breakEnded', handleBreakEnded);
    };
  }, []);

  const isEmployeeOnBreak = (employeeId: string) => {
    return employeesOnBreak.has(employeeId);
  };

  const setEmployeeOnBreak = (employeeId: string, onBreak: boolean) => {
    setEmployeesOnBreak(prev => {
      const updated = new Set(prev);
      if (onBreak) {
        updated.add(employeeId);
      } else {
        updated.delete(employeeId);
      }
      return updated;
    });
  };

  return (
    <BreakContext.Provider value={{ employeesOnBreak, isEmployeeOnBreak, setEmployeeOnBreak }}>
      {children}
    </BreakContext.Provider>
  );
}

export function useBreakContext() {
  const context = useContext(BreakContext);
  if (!context) {
    return {
      employeesOnBreak: new Set<string>(),
      isEmployeeOnBreak: () => false,
      setEmployeeOnBreak: () => {},
    };
  }
  return context;
}
