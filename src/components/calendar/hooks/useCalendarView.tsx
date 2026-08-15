import { useState, useMemo, useCallback } from 'react';
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfDay,
  endOfWeek,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  format,
  isToday as dateIsToday
} from 'date-fns';

export type CalendarViewType = 'day' | 'week' | 'month';

export interface CalendarViewState {
  // View configuration
  viewType: CalendarViewType;
  currentDate: Date;
  dateRange: { start: Date; end: Date };

  // Navigation
  goToToday: () => void;
  goToPrevious: () => void;
  goToNext: () => void;
  setViewType: (type: CalendarViewType) => void;
  setCurrentDate: (date: Date) => void;

  // Utilities
  isToday: (date: Date) => boolean;
  formatDateRange: () => string;
}

export const useCalendarView = (initialView: CalendarViewType = 'week'): CalendarViewState => {
  const [viewType, setViewType] = useState<CalendarViewType>(initialView);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calculate date range based on view type
  const dateRange = useMemo(() => {
    switch (viewType) {
      case 'day':
        return {
          start: startOfDay(currentDate),
          end: endOfDay(currentDate)
        };
      case 'week':
        return {
          start: startOfWeek(currentDate, { weekStartsOn: 0 }),
          end: endOfWeek(currentDate, { weekStartsOn: 0 })
        };
      case 'month':
        return {
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate)
        };
      default:
        return { start: new Date(), end: new Date() };
    }
  }, [viewType, currentDate]);

  // Navigation functions
  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const goToPrevious = useCallback(() => {
    setCurrentDate(prev => {
      switch (viewType) {
        case 'day': return addDays(prev, -1);
        case 'week': return addWeeks(prev, -1);
        case 'month': return addMonths(prev, -1);
        default: return prev;
      }
    });
  }, [viewType]);

  const goToNext = useCallback(() => {
    setCurrentDate(prev => {
      switch (viewType) {
        case 'day': return addDays(prev, 1);
        case 'week': return addWeeks(prev, 1);
        case 'month': return addMonths(prev, 1);
        default: return prev;
      }
    });
  }, [viewType]);

  // Utility functions
  const isToday = useCallback((date: Date) => dateIsToday(date), []);

  const formatDateRange = useCallback(() => {
    switch (viewType) {
      case 'day':
        return format(currentDate, 'MMMM dd, yyyy');
      case 'week':
        return `${format(dateRange.start, 'MMM dd')} - ${format(dateRange.end, 'MMM dd, yyyy')}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      default:
        return '';
    }
  }, [viewType, currentDate, dateRange]);

  return {
    viewType,
    currentDate,
    dateRange,
    goToToday,
    goToPrevious,
    goToNext,
    setViewType,
    setCurrentDate,
    isToday,
    formatDateRange
  };
};