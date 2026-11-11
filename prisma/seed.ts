/**
 * Seeds the Godoy Store catalog.
 *
 *   npm run db:seed                 → create/update products, keep current stock
 *   npm run db:seed -- --reset-stock → also put stock back to the catalog values
 */

import { PrismaClient } from "@prisma/client";
import { CATALOG } from "../src/lib/storeCatalog";

const prisma = new PrismaClient();

async function main() {
  const resetStock = process.argv.includes("--reset-stock");

  for (const p of CATALOG) {
    const data = {
      name: p.name,
      description: p.description,
      category: p.category,
      icon: p.icon,
      priceCents: BigInt(p.priceCents),
      isActive: true,
    };

    await prisma.product.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, ...data, stock: p.stock },
      update: resetStock ? { ...data, stock: p.stock } : data,
    });
  }

  const count = await prisma.product.count();
  console.log(
    `Godoy Store: ${CATALOG.length} produtos sincronizados (${count} no banco)${resetStock ? ", estoque reiniciado" : ""}.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
