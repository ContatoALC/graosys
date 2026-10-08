import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Controller, type Control, type FieldValues, type Path, type RegisterOptions } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Datas de negócio trafegam como "AAAA-MM-DD"; na tela, "dd/mm/aaaa". Nunca new Date("AAAA-MM-DD") (vira UTC).
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const BR_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function isoToDate(iso?: string | null): Date | undefined {
  const m = iso ? ISO_RE.exec(iso) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}

function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const isoToBr = (iso?: string | null) => {
  const m = iso ? ISO_RE.exec(iso) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

function brToIso(text: string): string | null {
  const m = BR_RE.exec(text);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getDate() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 ? dateToIso(d) : null;
}

// Digitação: só números, com as barras entrando sozinhas (dd/mm/aaaa).
function mask(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
}

export interface DatePickerProps {
  value?: string | null;
  onChange: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  title?: string;
  "aria-label"?: string;
}

// Date picker do shadcn com campo de texto: digita dd/mm/aaaa ou escolhe no calendário.
export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(function DatePicker(
  { value, onChange, onBlur, id, name, placeholder = "dd/mm/aaaa", disabled, invalid, className, title, ...rest },
  ref
) {
  const [text, setText] = React.useState(isoToBr(value));
  const [open, setOpen] = React.useState(false);
  const selected = isoToDate(value);

  // Valor mudou por fora (reset do formulário, calendário): reflete no texto.
  React.useEffect(() => {
    if (brToIso(text) !== (value || null)) setText(isoToBr(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function type(raw: string) {
    const next = mask(raw);
    setText(next);
    if (next === "") onChange("");
    else {
      const iso = brToIso(next);
      if (iso) onChange(iso);
    }
  }

  function pick(d: Date | undefined) {
    const iso = d ? dateToIso(d) : "";
    setText(isoToBr(iso));
    onChange(iso);
    setOpen(false);
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={ref}
        id={id}
        name={name}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        title={title}
        aria-label={rest["aria-label"]}
        aria-invalid={invalid || undefined}
        value={text}
        onChange={(e) => type(e.target.value)}
        onBlur={() => { if (text && !brToIso(text)) setText(isoToBr(value)); onBlur?.(); }}
        onKeyDown={(e) => { if (e.key === "ArrowDown" && e.altKey) setOpen(true); }}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background py-2 pl-3 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          invalid && "border-destructive"
        )}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
            aria-label="Abrir calendário"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={pick}
            defaultMonth={selected}
            captionLayout="dropdown"
            startMonth={new Date(2000, 0)}
            endMonth={new Date(2045, 11)}
            autoFocus
          />
          <div className="flex justify-between border-t p-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => pick(new Date())}>Hoje</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => pick(undefined)} disabled={!value}>Limpar</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});

// Atalho para formulários com react-hook-form (no lugar de <Input type="date" {...register(name)} />).
export function FormDatePicker<T extends FieldValues>({ control, name, rules, ...props }: {
  control: Control<T>;
  name: Path<T>;
  rules?: RegisterOptions<T, Path<T>>;
} & Omit<DatePickerProps, "value" | "onChange" | "onBlur" | "name">) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => (
        <DatePicker
          {...props}
          ref={field.ref}
          name={field.name}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          invalid={props.invalid ?? !!fieldState.error}
        />
      )}
    />
  );
}
