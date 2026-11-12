"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Search, SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, DataRow } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { CurrencyInput, Field, Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
// Notice is still used for inline formError and sendError
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatBRL } from "@/lib/money";
import { fadeUp } from "@/lib/motion";
import { uuid } from "@/lib/uuid";
import { useBankStore } from "@/store/bankStore";
import { useToast } from "@/components/ui/Toast";

interface AccountInfo {
  id: string;
  number: string;
  agency: string;
  holderName: string;
}

interface Recipient {
  accountId: string;
  holderName: string;
  agency: string;
  maskedNumber: string;
}

function initialsOf(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export default function TransfersPage() {
  const { accounts, fetchAccounts } = useBankStore();
  const [accountsReady, setAccountsReady] = useState(false);

  const [destNumber, setDestNumber] = useState("");
  const [destInfo, setDestInfo] = useState<AccountInfo | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");

  const [amountCents, setAmountCents] = useState("0");
  const [description, setDescription] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [formError, setFormError] = useState("");
  const toast = useToast();

  useEffect(() => {
    fetchAccounts().finally(() => setAccountsReady(true));
  }, [fetchAccounts]);

  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [recipientsError, setRecipientsError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setRecipientsLoading(true);
      setRecipientsError("");
      api
        .get<Recipient[]>(`/api/transfers/recipients?q=${encodeURIComponent(recipientQuery.trim())}`)
        .then(setRecipients)
        .catch((err) => setRecipientsError(errorMessage(err, "Não foi possível carregar os destinatários.")))
        .finally(() => setRecipientsLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [recipientQuery]);

  function pickRecipient(r: Recipient) {
    setDestNumber("");
    setLookupError("");
    setDestInfo({ id: r.accountId, holderName: r.holderName, agency: r.agency, number: r.maskedNumber });
  }

  const fromAccount = accounts[0];

  async function lookupAccount(e: React.FormEvent) {
    e.preventDefault();
    setLookupError("");
    setDestInfo(null);
    const number = destNumber.trim();
    if (!number) return;
    setLookupLoading(true);
    try {
      const info = await api.get<AccountInfo>(`/api/accounts/lookup?number=${encodeURIComponent(number)}`);
      setDestInfo(info);
    } catch (err) {
      setLookupError(errorMessage(err, "Conta não encontrada. Verifique o número."));
    } finally {
      setLookupLoading(false);
    }
  }

  function openConfirm(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSendError("");
    if (!destInfo) { setFormError("Busque a conta de destino primeiro."); return; }
    if (BigInt(amountCents) <= 0n) { setFormError("Informe um valor maior que zero."); return; }
    if (!fromAccount) { setFormError("Nenhuma conta de origem encontrada."); return; }
    if (destInfo.id === fromAccount.id) { setFormError("Você não pode transferir para a própria conta."); return; }
    setConfirmOpen(true);
  }

  async function sendTransfer() {
    if (!destInfo || !fromAccount) return;
    setSending(true);
    setSendError("");
    try {
      await api.post("/api/transfers", {
        idempotencyKey: uuid(),
        fromAccountId: fromAccount.id,
        toAccountId: destInfo.id,
        amountCents: amountCents,
        description: description.trim() || undefined,
      });
      setConfirmOpen(false);
      setDestInfo(null);
      setDestNumber("");
      setAmountCents("0");
      setDescription("");
      toast.success("Transferência realizada", `${formatBRL(amountCents)} enviados para ${destInfo.holderName}.`);
      fetchAccounts();
    } catch (err) {
      setSendError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Transferências"
        description="Envie dinheiro para outra conta usando o número da conta."
      />

      <div className="grid w-full gap-6 lg:grid-cols-2 lg:items-start">
      <motion.div {...fadeUp(0)} className="w-full">
        <Card className="p-6">
          <CardTitle>Destinatários disponíveis</CardTitle>
          <p className="mt-1 text-xs text-fg-subtle">Escolha um usuário para preencher o destino.</p>

          <div className="mt-4">
            <Input
              placeholder="Buscar por nome"
              aria-label="Buscar destinatário por nome"
              value={recipientQuery}
              onChange={(e) => setRecipientQuery(e.target.value)}
              autoComplete="off"
            />
          </div>

          <ul className="mt-4 flex max-h-[360px] flex-col gap-1 overflow-y-auto">
            {recipients.map((r) => {
              const selected = destInfo?.id === r.accountId;
              return (
                <li key={r.accountId}>
                  <button
                    type="button"
                    onClick={() => pickRecipient(r)}
                    aria-pressed={selected}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left",
                      "transition-colors duration-fast ease-standard",
                      selected ? "border-accent/50 bg-accent-soft" : "border-transparent hover:bg-surface-hover"
                    )}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bg text-xs font-semibold text-fg-muted">
                      {initialsOf(r.holderName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">{r.holderName}</span>
                      <span className="tnum block text-xs text-fg-subtle">
                        Ag. {r.agency} · {r.maskedNumber}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {recipientsLoading && recipients.length === 0 && (
            <p className="mt-4 text-sm text-fg-muted">Carregando…</p>
          )}
          {!recipientsLoading && recipientsError && (
            <Notice kind="danger">{recipientsError}</Notice>
          )}
          {!recipientsLoading && !recipientsError && recipients.length === 0 && (
            <p className="mt-4 text-sm text-fg-muted">Nenhum usuário encontrado.</p>
          )}
        </Card>
      </motion.div>

      <motion.div {...fadeUp(1)} className="w-full">
        <Card className="p-6">
          <CardTitle>Nova transferência</CardTitle>

          <form onSubmit={lookupAccount} className="mt-5 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-2sm font-medium text-fg">Conta de destino</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Número da conta"
                  value={destNumber}
                  onChange={(e) => {
                    setDestNumber(e.target.value);
                    setDestInfo(null);
                    setLookupError("");
                  }}
                  autoComplete="off"
                  className="flex-1"
                />
                <Button type="submit" variant="secondary" loading={lookupLoading} aria-label="Buscar conta">
                  <Search className="size-4" aria-hidden />
                </Button>
              </div>
              {lookupError && <p className="text-xs text-danger-text">{lookupError}</p>}
            </div>
          </form>

          {destInfo && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-3 rounded-lg border border-line bg-surface-raised px-4 py-3"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bg text-fg-muted">
                <ArrowRight className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{destInfo.holderName}</p>
                <p className="tnum text-xs text-fg-subtle">
                  Ag. {destInfo.agency} · Conta {destInfo.number}
                </p>
              </div>
            </motion.div>
          )}

          <form onSubmit={openConfirm} className="mt-5 flex flex-col gap-5">
            <Field label="Valor">
              {({ id, describedBy }) => (
                <CurrencyInput
                  id={id}
                  describedBy={describedBy}
                  valueCents={amountCents}
                  onChangeCents={setAmountCents}
                  disabled={!destInfo}
                />
              )}
            </Field>

            <Field label="Descrição" hint="Opcional — aparece no extrato dos dois lados.">
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={120}
                  placeholder="Ex.: Aluguel, Racha da pizza…"
                  disabled={!destInfo}
                />
              )}
            </Field>

            {formError && <Notice kind="danger">{formError}</Notice>}

            {!accountsReady ? null : !fromAccount ? (
              <Notice kind="danger">Nenhuma conta encontrada para debitar.</Notice>
            ) : (
              <div className="rounded-lg border border-line px-4">
                <DataRow label="Sua conta">
                  Ag. {fromAccount.agency} · {fromAccount.number}
                </DataRow>
                <DataRow label="Saldo disponível">{formatBRL(fromAccount.balance)}</DataRow>
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={!destInfo || !fromAccount}>
              <SendHorizonal className="size-4" aria-hidden />
              Continuar
            </Button>
          </form>
        </Card>
      </motion.div>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => !sending && setConfirmOpen(false)}
        title="Confirmar transferência"
        description="Revise os dados antes de enviar."
      >
        {destInfo && (
          <div className="flex flex-col gap-5">
            <dl className="divide-y divide-line rounded-lg border border-line px-4">
              <DataRow label="Para">{destInfo.holderName}</DataRow>
              <DataRow label="Conta destino">
                Ag. {destInfo.agency} · {destInfo.number}
              </DataRow>
              <DataRow label="Valor">{formatBRL(amountCents)}</DataRow>
              {description.trim() && (
                <DataRow label="Descrição">{description.trim()}</DataRow>
              )}
            </dl>

            {sendError && <Notice kind="danger">{sendError}</Notice>}

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={sending}>
                Cancelar
              </Button>
              <Button onClick={sendTransfer} loading={sending}>
                Confirmar transferência
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
