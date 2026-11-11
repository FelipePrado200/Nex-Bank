import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withErrorHandler, requireAuth } from "@/lib/apiHelpers";
import { StoreService, serializeProduct } from "@/services/StoreService";

/** GET /api/store/products — active catalog with current stock */
export const GET = withErrorHandler(async (request: NextRequest) => {
  requireAuth(request);
  const products = await new StoreService(prisma).listProducts();
  return ok(products.map(serializeProduct));
});
