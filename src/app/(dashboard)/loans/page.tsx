"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calculator } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, DataRow } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { CurrencyInput, Field, Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, errorMessage } from "@/lib/api";
import { LOAN_STATUS } from "@/lib/labels";
import { formatBRL } from "@/lib/money";
import { EASE_OUT, fadeUp } from "@/lib/motion";
import { type Loan, useBankStore } from "@/store/bankStore";

interface SimResult {
  installmentAmountCents: string;
  totalPayableCents: string;
  totalInterestCents: string;
  cetPercent: number;
  monthlyRatePercent: number;
  firstDueDate: string;
  schedule: Array<{
    number: number;
    dueDate: string;
    totalDue: string;
    principalPortion: string;
    interestPortion: string;
    remainingBalance: string;
  }>;
}

interface Params {
  principalCents: string;
  annualRatePercent: number;
  termMonths: number;
}

const PREVIEW_ROWS = 6;

const dateShort = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const dateLong = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

function parseRate(raw: string): number {
  return Number(raw.trim().replace(",", "."));
}

export default function LoansPage() {
  const { loans, accounts, loaded, error, refreshAll, fetchLoans, fetchAccounts } = useBankStore();

  const [principalCents, setPrincipalCents] = useState("100000");
  const [rate, setRate] = useState("24,99");
  const [term, setTerm] = useState(12);
  const [fieldErrors, setFieldErrors] = useState<{ principal?: string; rate?: string }>({});

  const [sim, setSim] = useState<{ result: SimResult; params: Params } | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [taking, setTaking] = useState(false);
  const [takeError, setTakeError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const currentParams: Params = {
    principalCents,
    annualRatePercent: parseRate(rate),
    termMonths: term,
  };
  const stale =
    !!sim &&
    (sim.params.principalCents !== currentParams.principalCents ||
      sim.params.annualRatePercent !== currentParams.annualRatePercent ||
      sim.params.termMonths !== currentParams.termMonths);

  async function simulate(e: React.FormEvent) {
    e.preventDefault();
    setSimError("");
    setSuccess("");

    const found: typeof fieldErrors = {};
    if (BigInt(principalCents) <= 0n) found.principal = "Informe um valor maior que zero.";
    const r = currentParams.annualRatePercent;
    if (!Number.isFinite(r) || r <= 0 || r > 500) found.rate = "Informe uma taxa entre 0 e 500% ao ano.";
    setFieldErrors(found);
    if (Object.keys(found).length > 0) return;

    setSimLoading(true);
    try {
      const params = { ...currentParams };
      const result = await api.post<SimResult>("/api/loans/simulate", params);
      setSim({ result, params });
    } catch (err) {
      setSimError(errorMessage(err));
    } finally {
      setSimLoading(false);
    }
  }

  async function takeLoan() {
    if (!sim || !accounts[0]) return;
    setTaking(true);
    setTakeError("");
    try {
      await api.post("/api/loans", { accountId: accounts[0].id, ...sim.params });
      setConfirmOpen(false);
      setSim(null);
      setSuccess("Empréstimo contratado. O valor já foi creditado na sua conta.");
      await Promise.all([fetchLoans(), fetchAccounts()]);
    } catch (err) {
      setTakeError(errorMessage(err));
    } finally {
      setTaking(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Empréstimos" description="Simule pela Tabela Price e contrate com parcelas fixas." />

      {error && <Notice kind="danger">{error}</Notice>}
      {success && <Notice kind="success">{success}</Notice>}

      <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <motion.section {...fadeUp(0)} aria-label="Simulador">
          <Card className="p-6">
            <CardTitle>Simulador</CardTitle>
            <form onSubmit={simulate} noValidate className="mt-5 flex flex-col gap-5">
              <Field label="Valor do empréstimo" error={fieldErrors.principal}>
                {({ id, describedBy }) => (
                  <CurrencyInput
                    id={id}
                    describedBy={describedBy}
                    valueCents={principalCents}
                    onChangeCents={(v) => {
                      setPrincipalCents(v);
                      setFieldErrors((x) => ({ ...x, principal: undefined }));
                    }}
                  />
                )}
              </Field>

              <Field label="Taxa de juros ao ano" error={fieldErrors.rate}>
                {({ id, describedBy }) => (
                  <div className="relative">
                    <Input
                      id={id}
                      aria-describedby={describedBy}
                      aria-invalid={!!fieldErrors.rate}
                      inputMode="decimal"
                      autoComplete="off"
                      className="tnum pr-14"
                      value={rate}
                      onChange={(e) => {
                        setRate(e.target.value);
                        setFieldErrors((x) => ({ ...x, rate: undefined }));
                      }}
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-fg-subtle"
                    >
                      % a.a.
                    </span>
                  </div>
                )}
              </Field>

              <Field label="Prazo" hint="De 1 a 60 meses.">
                {({ id, describedBy }) => (
                  <div className="flex items-center gap-4">
                    <input
                      id={id}
                      type="range"
                      min={1}
                      max={60}
                      step={1}
                      value={term}
                      aria-describedby={describedBy}
                      onChange={(e) => setTerm(Number(e.target.value))}
                      className="h-10 flex-1 cursor-pointer accent-[rgb(var(--accent))]"
                    />
                    <output htmlFor={id} className="tnum w-20 text-right text-sm font-medium text-fg">
                      {term} {term === 1 ? "mês" : "meses"}
                    </output>
                  </div>
                )}
              </Field>

              {simError && <Notice kind="danger">{simError}</Notice>}

              <Button type="submit" size="lg" loading={simLoading} className="w-full">
                Simular
              </Button>
            </form>
          </Card>
        </motion.section>

        <motion.section {...fadeUp(1)} aria-label="Resultado da simulação" aria-live="polite">
          {sim ? (
            <SimulationResult
              result={sim.result}
              params={sim.params}
              stale={stale}
              onContract={() => {
                setTakeError("");
                setConfirmOpen(true);
              }}
            />
          ) : (
            <Card className="flex min-h-[280px] flex-col items-center justify-center gap-3 border-dashed px-6 py-12 text-center">
              <span className="grid size-10 place-items-center rounded-lg border border-line bg-bg text-fg-muted">
                <Calculator className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium text-fg">Veja quanto vai pagar por mês</p>
                <p className="mt-1 text-sm text-fg-muted">Ajuste valor, taxa e prazo e toque em Simular.</p>
              </div>
            </Card>
          )}
        </motion.section>
      </div>

      <section aria-label="Seus empréstimos">
        <h2 className="mb-4 text-lg font-semibold text-fg">Seus empréstimos</h2>
        {!loaded ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : loans.length === 0 ? (
          <Card className="px-6 py-8 text-center text-sm text-fg-muted">Você ainda não contratou nenhum empréstimo.</Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {loans.map((loan, i) => (
              <motion.li key={loan.id} {...fadeUp(i)}>
                <LoanItem loan={loan} />
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={confirmOpen}
        onClose={() => !taking && setConfirmOpen(false)}
        title="Confirmar contratação"
        description="O valor é creditado na sua conta corrente imediatamente."
      >
        {sim && (
          <div className="flex flex-col gap-5">
            <dl className="divide-y divide-line rounded-lg border border-line px-4">
              <DataRow label="Você recebe">{formatBRL(sim.params.principalCents)}</DataRow>
              <DataRow label="Parcelas">
                {sim.params.termMonths}x de {formatBRL(sim.result.installmentAmountCents)}
              </DataRow>
              <DataRow label="Total a pagar">{formatBRL(sim.result.totalPayableCents)}</DataRow>
              <DataRow label="CET">{sim.result.cetPercent.toFixed(2).replace(".", ",")}% a.a.</DataRow>
            </dl>

            {takeError && <Notice kind="danger">{takeError}</Notice>}

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={taking}>
                Cancelar
              </Button>
              <Button onClick={takeLoan} loading={taking}>
                Confirmar contratação
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function SimulationResult({
  result,
  params,
  stale,
  onContract,
}: {
  result: SimResult;
  params: Params;
  stale: boolean;
  onContract: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? result.schedule : result.schedule.slice(0, PREVIEW_ROWS);
  const hidden = result.schedule.length - PREVIEW_ROWS;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-fg-muted">Parcela mensal</p>
          <p className="tnum mt-1 text-2xl font-semibold text-fg">
            {params.termMonths}x de {formatBRL(result.installmentAmountCents)}
          </p>
        </div>
        {stale && <Badge tone="warning">Valores alterados. Simule de novo.</Badge>}
      </div>

      <dl className="mt-5 divide-y divide-line border-t border-line">
        <DataRow label="Total a pagar">{formatBRL(result.totalPayableCents)}</DataRow>
        <DataRow label="Total de juros">{formatBRL(result.totalInterestCents)}</DataRow>
        <DataRow label="Taxa mensal">{result.monthlyRatePercent.toFixed(4).replace(".", ",")}%</DataRow>
        <DataRow label="CET">{result.cetPercent.toFixed(2).replace(".", ",")}% a.a.</DataRow>
        <DataRow label="Primeiro vencimento">{dateLong(result.firstDueDate)}</DataRow>
      </dl>

      <div className="mt-6">
        <h3 className="text-2sm font-medium text-fg">Tabela de amortização</h3>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line">
          <div className={showAll ? "max-h-80 overflow-y-auto" : undefined}>
            <table className="tnum w-full min-w-[460px] text-2sm">
              <thead className="sticky top-0 bg-surface text-xs text-fg-subtle">
                <tr className="border-b border-line">
                  <th className="px-3 py-2 text-left font-medium">Nº</th>
                  <th className="px-3 py-2 text-left font-medium">Vencimento</th>
                  <th className="px-3 py-2 text-right font-medium">Amortização</th>
                  <th className="px-3 py-2 text-right font-medium">Juros</th>
                  <th className="px-3 py-2 text-right font-medium">Parcela</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.number} className="border-b border-line last:border-b-0">
                    <td className="px-3 py-2 text-fg-subtle">{row.number}</td>
                    <td className="px-3 py-2 text-fg-muted">{dateShort(row.dueDate)}</td>
                    <td className="px-3 py-2 text-right text-fg-muted">{formatBRL(row.principalPortion)}</td>
                    <td className="px-3 py-2 text-right text-warning-text">{formatBRL(row.interestPortion)}</td>
                    <td className="px-3 py-2 text-right font-medium text-fg">{formatBRL(row.totalDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-3 text-2sm font-medium text-accent-text transition-opacity duration-fast ease-standard hover:opacity-80"
          >
            {showAll ? "Mostrar menos" : `Mostrar todas as ${result.schedule.length} parcelas`}
          </button>
        )}
      </div>

      <Button size="lg" className="mt-6 w-full" onClick={onContract} disabled={stale}>
        Contratar empréstimo
      </Button>
    </Card>
  );
}

function LoanItem({ loan }: { loan: Loan }) {
  const status = LOAN_STATUS[loan.status] ?? { label: loan.status, tone: "neutral" as const };
  const total = loan.installments.length || loan.termMonths;
  const paid = loan.installments.filter((i) => i.status === "PAID").length;
  const overdue = loan.installments.filter((i) => i.status === "OVERDUE").length;
  const next = loan.installments.find((i) => i.status !== "PAID" && i.status !== "WAIVED");
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="tnum text-lg font-semibold text-fg">{formatBRL(loan.principalAmount)}</p>
          <p className="tnum mt-0.5 text-sm text-fg-muted">
            {loan.termMonths}x de {formatBRL(loan.installmentAmount)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {overdue > 0 && <Badge tone="danger">{overdue} em atraso</Badge>}
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
      </div>

      <div className="mt-5">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-raised"
          role="progressbar"
          aria-label="Parcelas pagas"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={paid}
        >
          <motion.div
            className="h-full rounded-full bg-success"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
          />
        </div>
        <div className="tnum mt-2 flex flex-wrap justify-between gap-x-4 text-xs text-fg-subtle">
          <span>
            {paid} de {total} parcelas pagas
          </span>
          {next && (
            <span>
              Próxima: {dateShort(next.dueDate)} · {formatBRL(next.totalDue)}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
