import * as React from "react";
import { Controller, type Control, type FieldValues, type Path, type RegisterOptions } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Select do shadcn com uma lista de opções, no lugar do <select> nativo do navegador.
// O Radix não aceita opção com valor "": aqui "" vira um valor interno e volta como "" no onValueChange,
// então "Todos", "Não informar", "Sem acesso" etc. continuam funcionando como antes.
const EMPTY = "__vazio__";

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SimpleSelectProps {
  value?: string | null;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  title?: string;
  onBlur?: () => void;
  "aria-label"?: string;
}

const toInner = (v: string) => (v === "" ? EMPTY : v);

export const SimpleSelect = React.forwardRef<HTMLButtonElement, SimpleSelectProps>(function SimpleSelect(
  { value, onValueChange, options, placeholder, id, disabled, invalid, className, title, onBlur, ...rest },
  ref
) {
  const current = value ?? "";
  const hasEmpty = options.some((o) => o.value === "");
  // Valor vazio sem opção vazia: mostra o placeholder.
  const inner = current === "" && !hasEmpty ? "" : toInner(current);
  return (
    <Select value={inner} disabled={disabled} onValueChange={(v) => onValueChange(v === EMPTY ? "" : v)} onOpenChange={(open) => !open && onBlur?.()}>
      <SelectTrigger ref={ref} id={id} title={title} aria-label={rest["aria-label"]} aria-invalid={invalid || undefined} className={cn(invalid && "border-destructive", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {options.map((o) => (
          <SelectItem key={o.value} value={toInner(o.value)} disabled={o.disabled}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

// Atalho para formulários com react-hook-form (no lugar de <select {...register(name)}>).
export function FormSelect<T extends FieldValues>({ control, name, rules, onValueChange, ...props }: {
  control: Control<T>;
  name: Path<T>;
  rules?: RegisterOptions<T, Path<T>>;
  onValueChange?: (value: string) => void;
} & Omit<SimpleSelectProps, "value" | "onValueChange" | "onBlur">) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => (
        <SimpleSelect
          {...props}
          ref={field.ref}
          value={field.value}
          onValueChange={(v) => { field.onChange(v); onValueChange?.(v); }}
          onBlur={field.onBlur}
          invalid={props.invalid ?? !!fieldState.error}
        />
      )}
    />
  );
}
