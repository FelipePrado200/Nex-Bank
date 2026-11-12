"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError, api, errorMessage } from "@/lib/api";
import { formatBRL } from "@/lib/money";
import { fadeUp } from "@/lib/motion";

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  taxIdMasked: string;
  status: string;
  role: string;
  createdAt: string;
  accountCount: number;
  totalBalance: string;
}

interface AdminData {
  stats: { totalUsers: number; activeUsers: number; totalBalance: string };
  users: AdminUser[];
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs text-fg-subtle">{label}</p>
      <p className="tnum mt-2 text-2xl font-semibold text-fg">{value}</p>
    </Card>
  );
}

export default function AdminPage() {
  const toast = useToast();
  const [meId, setMeId] = useState<string | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [target, setTarget] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    api.get<{ id: string }>("/api/me").then((me) => setMeId(me.id)).catch(() => setMeId(null));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      api
        .get<AdminData>(`/api/admin/users?q=${encodeURIComponent(query.trim())}`)
        .then((result) => {
          setData(result);
          setLoadError("");
          setForbidden(false);
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 403) setForbidden(true);
          else setLoadError(errorMessage(err, "Não foi possível carregar os usuários."));
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, reloadKey]);

  async function confirmToggle() {
    if (!target) return;
    const next = target.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setSaving(true);
    setActionError("");
    try {
      await api.patch(`/api/admin/users/${target.id}`, { status: next });
      toast.success(
        next === "ACTIVE" ? "Usuário reativado" : "Usuário suspenso",
        target.fullName
      );
      setTarget(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (forbidden) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Administração" description="Área restrita." />
        <Notice kind="danger">Acesso restrito a administradores.</Notice>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Administração"
        description="Visão geral da plataforma e controle de acesso dos usuários."
      />

      {data && (
        <motion.div {...fadeUp(0)} className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Usuários cadastrados" value={String(data.stats.totalUsers)} />
          <StatCard label="Usuários ativos" value={String(data.stats.activeUsers)} />
          <StatCard label="Saldo total em contas" value={formatBRL(data.stats.totalBalance)} />
        </motion.div>
      )}

      <motion.div {...fadeUp(1)} className="flex flex-col gap-4">
        <Card className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Usuários</CardTitle>
            <Input
              placeholder="Buscar por nome, e-mail ou CPF"
              aria-label="Buscar usuário"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              className="sm:max-w-xs"
            />
          </div>
        </Card>

        {loadError && <Notice kind="danger">{loadError}</Notice>}

        {loading && !data && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {data && data.users.length === 0 && (
          <Card className="p-6">
            <p className="text-sm text-fg-muted">Nenhum usuário encontrado.</p>
          </Card>
        )}

        {data?.users.map((u) => {
          const isSelf = u.id === meId;
          const suspended = u.status !== "ACTIVE";
          return (
            <Card key={u.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-fg">{u.fullName}</p>
                  <Badge tone={suspended ? "danger" : "success"}>
                    {suspended ? "Suspenso" : "Ativo"}
                  </Badge>
                  {u.role === "ADMIN" && <Badge tone="accent">Admin</Badge>}
                </div>
                <p className="mt-1 truncate text-xs text-fg-subtle">
                  {u.email} · CPF {u.taxIdMasked} · desde{" "}
                  {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>

              <div className="flex items-center justify-between gap-6 sm:justify-end">
                <div className="text-right">
                  <p className="tnum text-sm font-medium text-fg">{formatBRL(u.totalBalance)}</p>
                  <p className="text-xs text-fg-subtle">
                    {u.accountCount} {u.accountCount === 1 ? "conta" : "contas"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isSelf}
                  title={isSelf ? "Você não pode alterar o próprio status." : undefined}
                  onClick={() => {
                    setActionError("");
                    setTarget(u);
                  }}
                >
                  {suspended ? "Reativar" : "Suspender"}
                </Button>
              </div>
            </Card>
          );
        })}
      </motion.div>

      <Dialog
        open={target !== null}
        onClose={() => !saving && setTarget(null)}
        title={target?.status === "ACTIVE" ? "Suspender usuário" : "Reativar usuário"}
        description={target ? target.fullName : undefined}
      >
        {target && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-fg-muted">
              {target.status === "ACTIVE"
                ? "O usuário não consegue entrar nem renovar a sessão até ser reativado. As contas e o saldo são mantidos."
                : "O usuário volta a conseguir entrar na conta."}
            </p>

            {actionError && <Notice kind="danger">{actionError}</Notice>}

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setTarget(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={confirmToggle} loading={saving}>
                {target.status === "ACTIVE" ? "Suspender" : "Reativar"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
