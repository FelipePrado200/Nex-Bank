"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { CurrencyInput, Field, Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Segmented } from "@/components/ui/Segmented";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";

type Network = "MASTERCARD" | "VISA" | "ELO";
type Theme = "dark" | "neon" | "light";

const COLORS = [
  { value: "#1a1a2e", label: "Meia-noite" },
  { value: "#0b3d2e", label: "Floresta" },
  { value: "#3b1d4a", label: "Ameixa" },
  { value: "#4a1d1d", label: "Vinho" },
  { value: "#1f2937", label: "Grafite" },
  { value: "#0c4a6e", label: "Oceano" },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string;
  onCreated: () => void;
}

export function CreateCardDialog({ open, onClose, accountId, onCreated }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Novo cartão virtual"
      description="O número e o CVV são gerados agora e guardados com criptografia."
    >
      <CreateCardForm accountId={accountId} onClose={onClose} onCreated={onCreated} />
    </Dialog>
  );
}

function CreateCardForm({ accountId, onClose, onCreated }: Omit<Props, "open">) {
  const [holderName, setHolderName] = useState("");
  const [network, setNetwork] = useState<Network>("MASTERCARD");
  const [limitCents, setLimitCents] = useState("500000");
  const [theme, setTheme] = useState<Theme>("dark");
  const [color, setColor] = useState<string>(COLORS[0].value);
  const [errors, setErrors] = useState<{ holderName?: string; limit?: string }>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    const found: typeof errors = {};
    if (holderName.trim().length < 3) found.holderName = "Informe o nome como aparece no cartão.";
    if (BigInt(limitCents) < 100n) found.limit = "O limite deve ser de pelo menos R$ 1,00.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      await api.post("/api/cards", {
        accountId,
        holderName: holderName.trim(),
        network,
        creditLimitCents: limitCents,
        color,
        theme,
      });
      onCreated();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <Field
        label="Nome no cartão"
        error={errors.holderName}
        hint={errors.holderName ? undefined : "Até 26 caracteres."}
      >
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={!!errors.holderName}
            autoComplete="cc-name"
            maxLength={26}
            placeholder="MARIA SOUZA"
            value={holderName}
            onChange={(e) => {
              setHolderName(e.target.value);
              if (errors.holderName) setErrors((x) => ({ ...x, holderName: undefined }));
            }}
          />
        )}
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-2sm font-medium text-fg">Bandeira</span>
        <Segmented
          label="Bandeira"
          value={network}
          onChange={setNetwork}
          options={[
            { value: "MASTERCARD", label: "Mastercard" },
            { value: "VISA", label: "Visa" },
            { value: "ELO", label: "Elo" },
          ]}
        />
      </div>

      <Field label="Limite de crédito" error={errors.limit}>
        {({ id, describedBy }) => (
          <CurrencyInput
            id={id}
            describedBy={describedBy}
            valueCents={limitCents}
            onChangeCents={(v) => {
              setLimitCents(v);
              if (errors.limit) setErrors((x) => ({ ...x, limit: undefined }));
            }}
          />
        )}
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-2sm font-medium text-fg">Acabamento</span>
        <Segmented
          label="Acabamento"
          value={theme}
          onChange={setTheme}
          options={[
            { value: "dark", label: "Escuro" },
            { value: "neon", label: "Neon" },
            { value: "light", label: "Claro" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-2sm font-medium text-fg">Cor</span>
        <div role="radiogroup" aria-label="Cor do cartão" className="flex flex-wrap gap-3">
          {COLORS.map((c) => {
            const selected = c.value === color;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={c.label}
                title={c.label}
                onClick={() => setColor(c.value)}
                style={{ backgroundColor: c.value }}
                className={cn(
                  "grid size-9 place-items-center rounded-full border border-white/15",
                  "transition-[box-shadow,transform] duration-fast ease-standard active:scale-95",
                  selected && "ring-2 ring-accent-text ring-offset-2 ring-offset-surface"
                )}
              >
                {selected && <Check className="size-4 text-white" aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>

      {formError && <Notice kind="danger">{formError}</Notice>}

      <div className="mt-1 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading} disabled={!accountId}>
          Criar cartão
        </Button>
      </div>
    </form>
  );
}
