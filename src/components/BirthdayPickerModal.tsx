import React, { useState, useMemo } from 'react';
import { Cake, X, Check, Sparkles } from 'lucide-react';

interface BirthdayPickerModalProps {
  isOpen: boolean;
  value: string; // formatted date, e.g. "2002-08-15" or "15 Aug 2002"
  onConfirm: (formattedDob: string, isoDate: string) => void;
  onClose: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const BirthdayPickerModal: React.FC<BirthdayPickerModalProps> = ({
  isOpen,
  value,
  onConfirm,
  onClose,
}) => {
  const currentYear = new Date().getFullYear();
  const defaultYear = currentYear - 20;

  const initialParsed = useMemo(() => {
    if (!value) return { day: 15, month: 7, year: defaultYear }; // Aug 15
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return {
        day: parsed.getDate(),
        month: parsed.getMonth(),
        year: parsed.getFullYear()
      };
    }
    return { day: 15, month: 7, year: defaultYear };
  }, [value, defaultYear]);

  const [selectedDay, setSelectedDay] = useState<number>(initialParsed.day);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialParsed.month);
  const [selectedYear, setSelectedYear] = useState<number>(initialParsed.year);

  // Calculate days in selected month and year
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const safeDay = Math.min(selectedDay, daysInMonth);

  // Calculate age
  const calculatedAge = useMemo(() => {
    const today = new Date();
    let age = today.getFullYear() - selectedYear;
    const m = today.getMonth() - selectedMonth;
    if (m < 0 || (m === 0 && today.getDate() < safeDay)) {
      age--;
    }
    return Math.max(0, age);
  }, [selectedYear, selectedMonth, safeDay]);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear - 10; y >= 1940; y--) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  const handleSave = () => {
    const monthNum = String(selectedMonth + 1).padStart(2, '0');
    const dayNum = String(safeDay).padStart(2, '0');
    const isoDate = `${selectedYear}-${monthNum}-${dayNum}`;
    const readable = `${safeDay} ${MONTHS[selectedMonth].substring(0, 3)} ${selectedYear}`;
    onConfirm(readable, isoDate);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 select-none">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-sm bg-[#0c1222] border border-white/15 rounded-t-[28px] sm:rounded-[28px] p-5 shadow-2xl text-white">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center shadow-xs">
              <Cake className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-white">Select Birthday</h3>
              <p className="text-[11px] text-gray-400">Age is calculated automatically</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Age & Date Preview Card */}
        <div className="my-3.5 p-3 rounded-2xl bg-[#131b2e] border border-sky-400/25 flex items-center justify-between shadow-inner">
          <div className="space-y-0.5">
            <div className="text-[10px] uppercase tracking-wider text-sky-400 font-medium">
              Selected Date
            </div>
            <div className="text-sm font-semibold text-white">
              {safeDay} {MONTHS[selectedMonth]} {selectedYear}
            </div>
          </div>
          <div className="px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300 text-xs font-medium flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-sky-300" />
            <span>{calculatedAge} Years Old</span>
          </div>
        </div>

        {/* 3 Select Columns: Month, Day, Year */}
        <div className="grid grid-cols-3 gap-2 my-3">
          {/* Month Column */}
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-1 text-center">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full py-2.5 px-2 bg-[#141d33] border border-white/10 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-sky-400 text-center cursor-pointer"
            >
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx} className="bg-[#0c1222] text-white">
                  {m.substring(0, 3)}
                </option>
              ))}
            </select>
          </div>

          {/* Day Column */}
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-1 text-center">Day</label>
            <select
              value={safeDay}
              onChange={(e) => setSelectedDay(Number(e.target.value))}
              className="w-full py-2.5 px-2 bg-[#141d33] border border-white/10 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-sky-400 text-center cursor-pointer"
            >
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d} className="bg-[#0c1222] text-white">
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Year Column */}
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-1 text-center">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full py-2.5 px-2 bg-[#141d33] border border-white/10 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-sky-400 text-center cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y} className="bg-[#0c1222] text-white">
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Confirm</span>
          </button>
        </div>
      </div>
    </div>
  );
};
