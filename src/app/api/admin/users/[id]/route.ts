import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { ok, withErrorHandler, parseBody, getIp } from "@/lib/apiHelpers";
import { requireAdmin } from "@/lib/requireAdmin";

const schema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

/** PATCH /api/admin/users/[id] — suspend or reactivate a user */
export const PATCH = withErrorHandler(async (
  request: NextRequest,
  context?: { params: Record<string, string> }
) => {
  const { userId: adminId } = await requireAdmin(request);
  const targetId = context?.params.id ?? "";
  const { status } = await parseBody(request, schema);

  if (targetId === adminId) {
    throw new DomainError("Você não pode alterar o próprio status.", 400);
  }

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) throw new DomainError("Usuário não encontrado.", 404);

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { status },
    select: { id: true, status: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: "ADMIN_USER_STATUS",
      resourceId: targetId,
      ipAddress: getIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: JSON.stringify({ status }),
    },
  });

  return ok(updated);
});
