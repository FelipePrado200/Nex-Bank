"use client";

import { Suspense, lazy, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Landmark, ShieldCheck, WalletCards } from "lucide-react";
import { Brand } from "@/components/ui/Brand";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Segmented } from "@/components/ui/Segmented";
import { api, errorMessage } from "@/lib/api";
import { EASE_IN, EASE_OUT } from "@/lib/motion";
import { useMediaQuery } from "@/lib/useMediaQuery";

const CreditCard3D = lazy(() =>
  import("@/components/3d/CreditCard3D").then((m) => ({ default: m.CreditCard3D }))
);

type Mode = "login" | "register";

interface FormState {
  fullName: string;
  taxId: string; // digits only
  email: string;
  password: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

const FEATURES = [
  {
    icon: WalletCards,
    title: "Cartões virtuais",
    text: "Número e CVV gerados na hora, guardados com criptografia AES-256.",
  },
  {
    icon: Landmark,
    title: "Crédito transparente",
    text: "Simule empréstimos pela Tabela Price e veja o CET antes de contratar.",
  },
  {
    icon: ShieldCheck,
    title: "Acesso protegido",
    text: "Sessão com cookies HttpOnly e registro de auditoria em ações sensíveis.",
  },
] as const;

/**
 * Display card for the brand panel. It only mounts on wide screens, so phones never
 * download Three.js or create a WebGL context for something they can not see.
 */
function HeroCard() {
  const wide = useMediaQuery("(min-width: 1024px)");
  if (!wide) return null;
  return (
    <Suspense
      fallback={<div className="aspect-[1.586] w-full max-w-[580px] animate-pulse rounded-xl border border-line bg-surface-raised" />}
    >
      <CreditCard3D
        hideControls
        className="max-w-[580px]"
        lastFour="4821"
        holderName="MARIA SOUZA"
        expiryMonth={12}
        expiryYear={2031}
        color="#1c1e26"
        theme="dark"
        network="VISA"
        cardType="CREDIT"
      />
    </Suspense>
  );
}

function formatCpf(digits: string): string {
  const d = digits.slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function validate(mode: Mode, form: FormState): Errors {
  const errors: Errors = {};
  if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = "Informe um e-mail válido.";
  if (mode === "login") {
    if (!form.password) errors.password = "Informe sua senha.";
    return errors;
  }
  if (form.fullName.trim().length < 3) errors.fullName = "Informe seu nome completo.";
  if (form.taxId.length !== 11) errors.taxId = "O CPF deve ter 11 dígitos.";
  if (form.password.length < 8) errors.password = "A senha deve ter pelo menos 8 caracteres.";
  return errors;
}

function safeNextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState<FormState>({ fullName: "", taxId: "", email: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function switchMode(next: Mode) {
    setMode(next);
    setErrors({});
    setFormError("");
    setNotice("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setNotice("");

    const found = validate(mode, form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      if (mode === "login") {
        await api.post("/api/auth/login", { email: form.email, password: form.password }, { session: false });
        router.replace(safeNextPath());
        return;
      }
      await api.post(
        "/api/auth/register",
        {
          email: form.email,
          password: form.password,
          fullName: form.fullName.trim(),
          taxId: form.taxId,
        },
        { session: false }
      );
      setMode("login");
      setForm((f) => ({ ...f, fullName: "", taxId: "", password: "" }));
      setNotice("Conta criada. Entre com seu e-mail e senha.");
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(480px,560px)]">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-surface p-12 lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60 [background-image:radial-gradient(rgb(var(--line))_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
        />
        <Brand className="relative" />

        <div className="relative">
          <h2 className="max-w-md text-2xl font-semibold text-fg">Conta, cartões e crédito em um só lugar.</h2>
          <div className="mt-8">
            <HeroCard />
          </div>
        </div>

        <div className="relative">
          {/* Short screens: the card matters more than the list. */}
          <ul className="hidden gap-6 [@media(min-height:821px)]:grid xl:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-bg bg-gradient-to-b from-white/[0.05] to-transparent text-accent-text shadow-key">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium text-fg">{title}</p>
                  <p className="mt-0.5 text-xs text-fg-muted">{text}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-xs text-fg-subtle">
            Sistema bancário virtual para fins de demonstração. Não realize transações reais.
          </p>
        </div>
      </aside>

      <main className="flex min-h-dvh flex-col justify-center px-4 py-10 sm:px-10 lg:min-h-0">
        <motion.div
          className="mx-auto w-full max-w-[380px]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
        >
          <Brand className="mb-10 lg:hidden" />

          <h1 className="text-xl font-semibold text-fg">{isLogin ? "Entrar na sua conta" : "Criar conta"}</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {isLogin ? "Use seu e-mail e senha para continuar." : "Leva menos de um minuto."}
          </p>

          <Segmented
            className="mt-8"
            label="Modo de acesso"
            value={mode}
            onChange={switchMode}
            options={[
              { value: "login", label: "Entrar" },
              { value: "register", label: "Cadastrar" },
            ]}
          />

          <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
            {notice && <Notice kind="success">{notice}</Notice>}

            <AnimatePresence initial={false}>
              {!isLogin && (
                <motion.div
                  key="register-fields"
                  className="-mx-1 overflow-hidden px-1"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto", transition: { duration: 0.24, ease: EASE_OUT } }}
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.16, ease: EASE_IN } }}
                >
                  <div className="flex flex-col gap-4 pb-4">
                    <Field label="Nome completo" error={errors.fullName}>
                      {({ id, describedBy }) => (
                        <Input
                          id={id}
                          aria-describedby={describedBy}
                          aria-invalid={!!errors.fullName}
                          autoComplete="name"
                          placeholder="Maria Souza"
                          value={form.fullName}
                          onChange={(e) => update("fullName", e.target.value)}
                        />
                      )}
                    </Field>
                    <Field label="CPF" error={errors.taxId}>
                      {({ id, describedBy }) => (
                        <Input
                          id={id}
                          aria-describedby={describedBy}
                          aria-invalid={!!errors.taxId}
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="000.000.000-00"
                          value={formatCpf(form.taxId)}
                          onChange={(e) => update("taxId", e.target.value.replace(/\D/g, "").slice(0, 11))}
                        />
                      )}
                    </Field>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Field label="E-mail" error={errors.email}>
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  type="email"
                  aria-describedby={describedBy}
                  aria-invalid={!!errors.email}
                  autoComplete="email"
                  placeholder="voce@email.com"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              )}
            </Field>

            <Field label="Senha" error={errors.password} hint={isLogin ? undefined : "Mínimo de 8 caracteres."}>
              {({ id, describedBy }) => (
                <div className="relative">
                  <Input
                    id={id}
                    type={showPassword ? "text" : "password"}
                    aria-describedby={describedBy}
                    aria-invalid={!!errors.password}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    className="pr-11"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-fg-subtle transition-colors duration-fast ease-standard hover:text-fg"
                  >
                    {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  </button>
                </div>
              )}
            </Field>

            {formError && <Notice kind="danger">{formError}</Notice>}

            <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
              {isLogin ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <p className="mt-8 text-xs text-fg-subtle lg:hidden">
            Sistema bancário virtual para fins de demonstração. Não realize transações reais.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
