"use client";

import { useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { CurrencyInput, Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { DataRow } from "@/components/ui/Card";
import { api, errorMessage } from "@/lib/api";
import { formatBRL } from "@/lib/money";

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string;
  currentBalance: bigint;
  onDeposited: () => void;
}

export function DepositDialog({ open, onClose, accountId, currentBalance, onDeposited }: Props) {
  const [amountCents, setAmountCents] = useState("10000"); // R$ 100,00 default
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const amount = BigInt(amountCents || "0");
  const preview = currentBalance + amount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amount <= 0n) { setError("Informe um valor maior que zero."); return; }
    setError("");
    setLoading(true);
    try {
      await api.post(`/api/accounts/${accountId}/deposit`, { amountCents });
      onDeposited();
      onClose();
      setAmountCents("10000");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Depositar"
      description="Simule uma entrada de dinheiro na conta corrente."
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Field label="Valor do depósito" error={error}>
          {({ id, describedBy }) => (
            <CurrencyInput
              id={id}
              describedBy={describedBy}
              valueCents={amountCents}
              onChangeCents={(v) => { setAmountCents(v); setError(""); }}
            />
          )}
        </Field>

        <dl className="divide-y divide-line rounded-lg border border-line px-4">
          <DataRow label="Saldo atual">{formatBRL(currentBalance)}</DataRow>
          <DataRow label="Depósito">{formatBRL(amount)}</DataRow>
          <DataRow label="Saldo após">
            <span className="font-semibold text-success-text">{formatBRL(preview)}</span>
          </DataRow>
        </dl>

        {error && <Notice kind="danger">{error}</Notice>}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            <ArrowDownToLine className="size-4" aria-hidden />
            Confirmar depósito
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
