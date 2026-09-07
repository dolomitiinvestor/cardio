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
      <div className="flex flex-col gap-2.5">
        {weeks.map((week) => (
          <div key={week[0].date} className="grid grid-cols-7">
            {week.map((day) => (
              <div key={day.date} className="flex items-center justify-center">
                <span
                  className={
                    day.isFuture
                      ? 'w-1.5 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800'
                      : day.hasActivity
                        ? 'w-3 h-3 rounded-full bg-neutral-900 dark:bg-neutral-50'
                        : 'w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700'
                  }
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
