import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerWithRangeProps {
  date: {
    from: Date | undefined
    to: Date | undefined
  }
  onDateChange: (date: { from: Date | undefined; to: Date | undefined }) => void
  className?: string
}

export function DatePickerWithRange({
  date,
  onDateChange,
  className,
}: DatePickerWithRangeProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id="date"
          variant={"outline"}
          className={cn(
            "h-9 px-3 py-2 justify-start text-left font-normal",
            !date?.from && !date?.to && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
          <span className="flex-1 truncate">
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "MMM d")} - {format(date.to, "MMM d")}
                </>
              ) : (
                format(date.from, "MMM d, yyyy")
              )
            ) : (
              "Date range"
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={5}>
        <div className="p-4">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from || new Date()}
            selected={date as DateRange}
            onSelect={(range: DateRange | undefined) => {
              onDateChange({
                from: range?.from,
                to: range?.to,
              })
            }}
            numberOfMonths={2}
            className="[--cell-size:2.75rem]"
            classNames={{
              months: "flex gap-6",
              month: "space-y-4",
              nav: "flex items-center gap-1 w-full absolute -top-1 inset-x-0 justify-between px-2",
              button_previous: "h-9 w-9 bg-transparent hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center rounded-md",
              button_next: "h-9 w-9 bg-transparent hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center rounded-md", 
              weekdays: "flex gap-1 mb-2",
              weekday: "text-muted-foreground rounded-md w-[2.75rem] font-medium text-sm",
              week: "flex gap-1",
              day_button: "h-[2.75rem] w-[2.75rem] text-sm font-normal",
              caption_label: "text-base font-medium",
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}