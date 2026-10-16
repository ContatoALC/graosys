import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { DayPicker, type DropdownProps } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Mês e ano no Select do shadcn, no lugar do <select> nativo do navegador que o react-day-picker usa.
function CalendarDropdown({ options, value, onChange, disabled, "aria-label": ariaLabel }: DropdownProps) {
  return (
    <Select
      value={value === undefined ? undefined : String(value)}
      disabled={disabled}
      onValueChange={(v) => onChange?.({ target: { value: v } } as React.ChangeEvent<HTMLSelectElement>)}
    >
      <SelectTrigger aria-label={ariaLabel} className="h-8 w-auto gap-1 px-2.5 font-medium capitalize">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options?.map((o) => (
          <SelectItem key={o.value} value={String(o.value)} disabled={o.disabled} className="capitalize">{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

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
        // A barra das setas ocupa a largura toda do cabeçalho: só as setas recebem clique, o resto vai para mês/ano.
        nav: "pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between",
        button_previous: cn(buttonVariants({ variant: "outline" }), "pointer-events-auto h-8 w-8 p-0"),
        button_next: cn(buttonVariants({ variant: "outline" }), "pointer-events-auto h-8 w-8 p-0"),
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
        Dropdown: CalendarDropdown,
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
