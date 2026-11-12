import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { DomainError } from "./errors";
import { requireAuth } from "./apiHelpers";

export async function requireAdmin(request: NextRequest): Promise<{ userId: string }> {
  const { userId } = requireAuth(request);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
  if (user?.role !== "ADMIN" || user.status !== "ACTIVE") {
    throw new DomainError("Acesso negado.", 403);
  }
  return { userId };
}
