import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

// Calendário do shadcn (react-day-picker v9) com as cores do tema: dia selecionado em preto, hoje em cinza.
function Calendar({ className, classNames, showOutsideDays = true, ...props }: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      locale={ptBR}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: "relative",
        months: "flex flex-col gap-4",
        month: "space-y-3",
        month_caption: "flex h-9 items-center justify-center",
        caption_label: "flex items-center gap-1 text-sm font-medium",
        dropdowns: "flex items-center gap-2 text-sm font-medium",
        dropdown_root: "relative inline-flex items-center rounded-md border border-input px-2 py-1 focus-within:ring-2 focus-within:ring-ring",
        dropdown: "absolute inset-0 cursor-pointer opacity-0",
        nav: "absolute inset-x-3 top-3 flex items-center justify-between",
        button_previous: cn(buttonVariants({ variant: "outline" }), "h-8 w-8 p-0"),
        button_next: cn(buttonVariants({ variant: "outline" }), "h-8 w-8 p-0"),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-[0.8rem] font-normal capitalize text-muted-foreground",
        week: "mt-1 flex w-full",
        day: "h-9 w-9 p-0 text-center text-sm",
        day_button: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
        selected: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground",
        today: "[&>button]:bg-accent [&>button]:font-semibold",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: c }) =>
          orientation === "left" ? <ChevronLeft className={cn("h-4 w-4", c)} />
            : orientation === "right" ? <ChevronRight className={cn("h-4 w-4", c)} />
            : <ChevronDown className={cn("h-3.5 w-3.5", c)} />,
      }}
      {...props}
    />
  );
}

export { Calendar };
