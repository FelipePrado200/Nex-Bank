/**
 * Godoy Store catalog. This file is the source of truth for `npm run db:seed`.
 * Prices are in centavos (integers). The database is the source of truth at runtime.
 */

export type ProductCategory = "ELECTRONICS" | "HOME" | "FASHION" | "BOOKS";

export interface CatalogProduct {
  slug: string;
  name: string;
  description: string;
  category: ProductCategory;
  /** Key resolved to an icon on the client (see `components/store/ProductIcon.tsx`) */
  icon: string;
  priceCents: number;
  stock: number;
}

export const CATALOG: CatalogProduct[] = [
  // Eletrônicos
  {
    slug: "fone-bluetooth-aura",
    name: "Fone Bluetooth Aura",
    description: "Cancelamento de ruído ativo e 40 horas de bateria.",
    category: "ELECTRONICS",
    icon: "headphones",
    priceCents: 34990,
    stock: 40,
  },
  {
    slug: "teclado-mecanico-k75",
    name: "Teclado Mecânico K75",
    description: "Layout 75%, switches lineares e conexão sem fio.",
    category: "ELECTRONICS",
    icon: "keyboard",
    priceCents: 45900,
    stock: 25,
  },
  {
    slug: "mouse-sem-fio-glide",
    name: "Mouse Sem Fio Glide",
    description: "Sensor de 8.000 DPI e bateria que dura meses.",
    category: "ELECTRONICS",
    icon: "mouse",
    priceCents: 12990,
    stock: 60,
  },
  {
    slug: "caixa-de-som-nimbus",
    name: "Caixa de Som Nimbus",
    description: "À prova d'água, som estéreo e 12 horas de uso.",
    category: "ELECTRONICS",
    icon: "speaker",
    priceCents: 28990,
    stock: 30,
  },
  {
    slug: "smartwatch-pulse-2",
    name: "Smartwatch Pulse 2",
    description: "GPS integrado, monitor cardíaco e tela AMOLED.",
    category: "ELECTRONICS",
    icon: "watch",
    priceCents: 79900,
    stock: 3,
  },
  {
    slug: "camera-instantanea-foco",
    name: "Câmera Instantânea Foco",
    description: "Revele as fotos na hora, com flash automático.",
    category: "ELECTRONICS",
    icon: "camera",
    priceCents: 64900,
    stock: 0,
  },
  {
    slug: "console-portatil-arcade-go",
    name: "Console Portátil Arcade Go",
    description: "Tela de 7 polegadas e mais de 500 jogos clássicos.",
    category: "ELECTRONICS",
    icon: "gamepad",
    priceCents: 189900,
    stock: 10,
  },
  {
    slug: "notebook-orion-14",
    name: "Notebook Orion 14",
    description: "Tela de 14 polegadas, 16 GB de memória e SSD de 512 GB.",
    category: "ELECTRONICS",
    icon: "laptop",
    priceCents: 429900,
    stock: 5,
  },

  // Casa
  {
    slug: "luminaria-de-mesa-lume",
    name: "Luminária de Mesa Lume",
    description: "Três tons de luz e carregador sem fio na base.",
    category: "HOME",
    icon: "lamp",
    priceCents: 18990,
    stock: 35,
  },
  {
    slug: "caneca-termica-brasa",
    name: "Caneca Térmica Brasa",
    description: "Mantém a bebida quente por 6 horas. Capacidade de 450 ml.",
    category: "HOME",
    icon: "coffee",
    priceCents: 7990,
    stock: 80,
  },
  {
    slug: "poltrona-nuvem",
    name: "Poltrona Nuvem",
    description: "Estofado macio e estrutura de madeira maciça.",
    category: "HOME",
    icon: "armchair",
    priceCents: 89900,
    stock: 8,
  },

  // Moda
  {
    slug: "mochila-urbana-trilha-20",
    name: "Mochila Urbana Trilha 20 L",
    description: "Tecido resistente à água e bolso para notebook.",
    category: "FASHION",
    icon: "backpack",
    priceCents: 24990,
    stock: 45,
  },
  {
    slug: "camiseta-algodao-basica",
    name: "Camiseta Algodão Básica",
    description: "100% algodão, corte reto e toque macio.",
    category: "FASHION",
    icon: "shirt",
    priceCents: 6990,
    stock: 120,
  },
  {
    slug: "tenis-de-corrida-vento",
    name: "Tênis de Corrida Vento",
    description: "Amortecimento leve para os treinos do dia a dia.",
    category: "FASHION",
    icon: "footprints",
    priceCents: 39990,
    stock: 30,
  },
  {
    slug: "oculos-de-sol-mare",
    name: "Óculos de Sol Maré",
    description: "Lentes polarizadas com proteção UV400.",
    category: "FASHION",
    icon: "glasses",
    priceCents: 21990,
    stock: 40,
  },

  // Livros
  {
    slug: "livro-financas-sem-misterio",
    name: "Finanças sem Mistério",
    description: "Guia prático para organizar o dinheiro e sair das dívidas.",
    category: "BOOKS",
    icon: "book",
    priceCents: 5990,
    stock: 100,
  },
  {
    slug: "livro-programar-e-escolher",
    name: "Programar é Escolher",
    description: "As decisões de design que mantêm um sistema simples.",
    category: "BOOKS",
    icon: "book",
    priceCents: 7990,
    stock: 100,
  },
];
