<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-5-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Three.js-R170-000000?style=for-the-badge&logo=three.js&logoColor=white" alt="Three.js" />
</p>

<h1 align="center">🏦 Nex Bank</h1>

<p align="center">
  <strong>Sistema bancário digital completo</strong> — conta, cartões virtuais, empréstimos, loja e extrato.<br/>
  Construído com Next.js 15, React 19, Prisma, Zustand e Three.js.
</p>

<p align="center">
  <em>⚠️ Projeto para fins de demonstração e portfólio. Não realize transações reais.</em>
</p>

---

## ✨ Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| 🔐 **Autenticação** | Registro e login com JWT (access + refresh tokens em cookies HttpOnly), middleware de proteção de rotas e audit log |
| 💳 **Cartões Virtuais** | Criação de cartões com bandeira (Visa, Mastercard, Elo), limite, cor e tema personalizáveis. PAN e CVV criptografados com **AES-256-GCM** |
| 🎨 **Cartão 3D Interativo** | Componente React Three Fiber com parallax, flip, PBR material, bloom e idle float — tudo sem download de HDRI |
| 💰 **Conta Corrente** | Saldo, cheque especial com barra de progresso, cópia de agência/conta e extrato completo |
| 🏦 **Empréstimos** | Simulação pela **Tabela Price** (PMT) com cálculo de CET via Newton-Raphson, contratação e pagamento de parcelas |
| 🛒 **Godoy Store** | Loja integrada com catálogo de produtos, carrinho, busca com filtro por categoria e pagamento via saldo ou cartão de crédito |
| 📊 **Extrato** | Histórico de todas as movimentações com tipo, valor, saldo após transação e data |
| 🔑 **Idempotência** | Chaves de idempotência para evitar operações duplicadas em transferências e compras |
| 📱 **Responsivo** | Layout adaptativo com sidebar no desktop e tab bar no mobile, animações Framer Motion |

---

## 🏗️ Arquitetura

```
src/
├── app/
│   ├── (dashboard)/          # Páginas protegidas (layout com sidebar)
│   │   ├── cards/            # Gerenciamento de cartões virtuais
│   │   ├── dashboard/        # Visão geral: saldo, cartão 3D, limites
│   │   ├── loans/            # Simulação e contratação de empréstimos
│   │   ├── store/            # Loja e histórico de pedidos
│   │   └── transactions/     # Extrato da conta
│   ├── api/                  # Route handlers (REST API)
│   │   ├── auth/             # Login, registro, logout, refresh
│   │   ├── accounts/         # Contas e transações
│   │   ├── cards/            # CRUD de cartões + reveal CVV
│   │   ├── loans/            # Simulação, contratação, pagamento
│   │   ├── invoices/         # Faturas de cartão
│   │   ├── store/            # Produtos e pedidos
│   │   ├── transfers/        # Transferências entre contas
│   │   └── cron/             # Jobs automáticos (fechar faturas, juros)
│   └── login/                # Tela de login/cadastro
├── components/
│   ├── 3d/                   # CreditCard3D (React Three Fiber)
│   ├── cards/                # CreateCardDialog
│   ├── store/                # ProductCard, CartDialog, Stepper
│   └── ui/                   # Design system (Button, Card, Dialog, Field...)
├── lib/                      # Utilitários
│   ├── crypto.ts             # AES-256-GCM (encrypt/decrypt PAN, CVV)
│   ├── jwt.ts                # Geração e verificação de tokens
│   ├── luhn.ts               # Algoritmo de Luhn para geração de PAN
│   ├── money.ts              # Formatação monetária (BRL)
│   └── rateLimit.ts          # Rate limiting por IP
├── services/                 # Regras de negócio
│   ├── AuthService.ts        # Registro, login, sessões
│   ├── CardService.ts        # Criação de cartões, criptografia
│   ├── InvoiceService.ts     # Ciclo de faturas
│   ├── LoanService.ts        # Tabela Price, PMT, CET, amortização
│   ├── StoreService.ts       # Catálogo, pedidos, pagamento
│   └── TransactionService.ts # Transferências, extrato
├── store/                    # Estado global (Zustand)
│   ├── bankStore.ts          # Contas, cartões, empréstimos
│   └── cartStore.ts          # Carrinho da loja
└── middleware.ts             # JWT auth guard (Edge Runtime)
```

---

## 🔒 Segurança

- **Senhas** hasheadas com `bcryptjs`
- **PAN e CVV** criptografados com **AES-256-GCM** (chave de 256 bits via `ENCRYPTION_KEY`)
- **JWT** com access token (15min) + refresh token (7d) em cookies `HttpOnly`, `Secure`, `SameSite`
- **Middleware Edge** protege rotas de dashboard e API, injetando `x-user-id` nos headers
- **Rate limiting** por IP em endpoints sensíveis
- **Audit log** para ações críticas (login, criação de cartão, transferências)
- **Chaves de idempotência** para prevenir operações duplicadas
- **Validação** com `zod` em todos os inputs da API

---

## 🚀 Começando

### Pré-requisitos

- **Node.js** 18+
- **npm** ou **pnpm**

### Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/FelipePrado200/Nex-Bank.git
cd Nex-Bank

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas chaves (veja instruções abaixo)

# 4. Gere o Prisma Client e aplique as migrations
npm run db:generate
npm run db:push

# 5. Popule o catálogo da loja
npm run db:seed

# 6. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse **http://localhost:3000** 🎉

### Variáveis de Ambiente

| Variável | Descrição | Como gerar |
|----------|-----------|------------|
| `DATABASE_URL` | Connection string do banco (SQLite padrão) | Já configurada para SQLite |
| `JWT_SECRET` | Segredo para assinar tokens JWT | `openssl rand -base64 64` |
| `ENCRYPTION_KEY` | Chave AES-256 (64 chars hex = 32 bytes) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CRON_SECRET` | Segredo para endpoints de cron | Qualquer string aleatória |
| `NEXT_PUBLIC_APP_URL` | URL da aplicação | `http://localhost:3000` |

---

## 🛠️ Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia o servidor de desenvolvimento (Turbopack) |
| `npm run build` | Build de produção |
| `npm run start` | Inicia o servidor de produção |
| `npm run db:generate` | Gera o Prisma Client |
| `npm run db:push` | Aplica o schema no banco |
| `npm run db:migrate` | Cria e aplica migrations |
| `npm run db:studio` | Abre o Prisma Studio (GUI do banco) |
| `npm run db:seed` | Popula o catálogo da Godoy Store |

---

## 🧮 Detalhes Técnicos

### Tabela Price (Empréstimos)

O sistema de empréstimos implementa a **Tabela Price** com parcela fixa:

$$PMT = PV \times \frac{i \times (1+i)^n}{(1+i)^n - 1}$$

Onde:
- **PV** = valor presente (principal)
- **i** = taxa de juros mensal (convertida de anual via juros compostos)
- **n** = número de parcelas

O **CET** (Custo Efetivo Total) é calculado via **Newton-Raphson** (IRR dos fluxos de caixa), anualizado por juros compostos.

### Cartão 3D

O componente `CreditCard3D` usa **React Three Fiber** para renderizar um cartão interativo:

- **Canvas Textures**: frente e verso pintados em `<canvas>` 2D e mapeados como texturas
- **PBR Material**: `meshPhysicalMaterial` com metalness, roughness, clearcoat e emissive
- **Procedural Studio**: iluminação por `Lightformer` — sem download de HDRI
- **Bloom**: pós-processamento para brilhos (mais intenso no tema "neon")
- **Parallax**: acompanha o ponteiro com damping independente de framerate
- **Acessibilidade**: respeita `prefers-reduced-motion`

---

## 📚 Tech Stack

| Camada | Tecnologia |
|--------|------------|
| **Framework** | Next.js 15 (App Router, Turbopack) |
| **UI** | React 19, Tailwind CSS 3, Framer Motion |
| **3D** | React Three Fiber, Drei, Three.js R170 |
| **Estado** | Zustand 5 |
| **Banco de Dados** | Prisma 5 + SQLite (dev) / PostgreSQL (prod) |
| **Autenticação** | JWT (jose) + bcryptjs |
| **Criptografia** | AES-256-GCM (Node.js crypto) |
| **Validação** | Zod |
| **Ícones** | Lucide React |
| **Linguagem** | TypeScript 5 |

---

## 📄 Licença

Este projeto é de código aberto para fins educacionais e de portfólio.

---

<p align="center">
  Feito com ☕ por <a href="https://github.com/FelipePrado200">Felipe Prado</a>
</p>
