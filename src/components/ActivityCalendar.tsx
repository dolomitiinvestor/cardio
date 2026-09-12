import type { CalendarWeek } from '../lib/stats';

interface ActivityCalendarProps {
  weeks: CalendarWeek[];
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function ActivityCalendar({ weeks }: ActivityCalendarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-7">
        {DAY_LABELS.map((label, i) => (
          <span
            key={i}
            className="text-center text-xs font-medium text-neutral-400 dark:text-neutral-500"
          >
            {label}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {weeks.map((week) => (
          <div key={week[0].date} className="grid grid-cols-7">
            {week.map((day) => (
              <div key={day.date} className="flex items-center justify-center">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium ${
                    day.isFuture
                      ? 'bg-neutral-50 text-neutral-300 dark:bg-neutral-900 dark:text-neutral-600'
                      : day.hasActivity
                        ? 'bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900'
                        : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                  } ${day.isToday ? 'ring-2 ring-green-500 ring-offset-1 ring-offset-white dark:ring-offset-neutral-900' : ''}`}
                >
                  {Number(day.date.slice(-2))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
