/**
 * AuthService.ts
 * User registration, login, token refresh, and logout.
 *
 * Password hashing: bcryptjs (cost factor 12).
 * Tokens: JWT via jose — stored as HttpOnly cookies (see jwt.ts).
 * Sessions are tracked in the DB for refresh-token rotation and revocation.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { encrypt } from "@/lib/crypto";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/lib/jwt";

const BCRYPT_ROUNDS = 12;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  taxId: string;   // CPF — will be encrypted
  phone?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

// ─────────────────────────────────────────────
// AuthService
// ─────────────────────────────────────────────

export class AuthService {
  constructor(private readonly db: PrismaClient) {}

  // ───────────────────────────────────────────
  // Register
  // ───────────────────────────────────────────

  async register(input: RegisterInput): Promise<{ userId: string }> {
    const { email, password, fullName, taxId, phone } = input;

    // Check for existing email
    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) throw new Error("E-mail já cadastrado.");

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Encrypt sensitive PII
    const encryptedTaxId = encrypt(taxId.replace(/\D/g, "")); // strip formatting
    const encryptedPhone = phone ? encrypt(phone) : undefined;

    const user = await this.db.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        fullName,
        taxId: encryptedTaxId,
        phone: encryptedPhone,
      },
    });

    // Create default checking account
    await this.db.account.create({
      data: {
        userId: user.id,
        type: "CHECKING",
        number: this.generateAccountNumber(),
        balance: 0n,
        overdraftLimit: 50000n, // R$ 500.00 default cheque especial
        overdraftRate: 0.0082,  // 0.82% daily
      },
    });

    return { userId: user.id };
  }

  // ───────────────────────────────────────────
  // Login
  // ───────────────────────────────────────────

  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<TokenPair> {
    const user = await this.db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) throw new Error("Credenciais inválidas.");
    if (user.status !== "ACTIVE") throw new Error("Conta suspensa ou encerrada.");

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) throw new Error("Credenciais inválidas.");

    const tokens = await this.createSession(user.id, user.email, ipAddress, userAgent);

    // Audit log
    await this.db.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        ipAddress,
        userAgent,
      },
    });

    return tokens;
  }

  // ───────────────────────────────────────────
  // Refresh token rotation
  // ───────────────────────────────────────────

  async refresh(
    rawRefreshToken: string,
    ipAddress?: string
  ): Promise<TokenPair> {
    let payload;
    try {
      payload = await verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new Error("Token inválido ou expirado.");
    }

    // Find and validate session
    const session = await this.db.userSession.findUnique({
      where: { jti: payload.jti },
      include: { user: true },
    });

    if (!session || session.revokedAt || new Date() > session.expiresAt) {
      throw new Error("Sessão inválida ou expirada.");
    }
    if (session.user.status !== "ACTIVE") {
      throw new Error("Conta suspensa.");
    }

    // Revoke old session (rotation)
    await this.db.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    // Issue new token pair
    return this.createSession(
      session.userId,
      session.user.email,
      ipAddress
    );
  }

  // ───────────────────────────────────────────
  // Logout
  // ───────────────────────────────────────────

  async logout(jti: string, userId: string): Promise<void> {
    await this.db.userSession.updateMany({
      where: { jti, userId },
      data: { revokedAt: new Date() },
    });

    await this.db.auditLog.create({
      data: { userId, action: "LOGOUT" },
    });
  }

  // ───────────────────────────────────────────
  // Private: create session + sign tokens
  // ───────────────────────────────────────────

  private async createSession(
    userId: string,
    email: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<TokenPair> {
    const jti = randomUUID();
    const sessionId = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken({ sub: userId, jti, email }),
      signRefreshToken({ sub: userId, jti, sessionId }),
    ]);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.db.userSession.create({
      data: {
        userId,
        jti,
        refreshToken: encrypt(refreshToken), // store encrypted
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    return { accessToken, refreshToken, sessionId };
  }

  // ───────────────────────────────────────────
  // Private: account number generator
  // ───────────────────────────────────────────

  private generateAccountNumber(): string {
    // Format: YYYYMMDD + 4 random digits
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(Math.random() * 9000 + 1000);
    return `${dateStr}${random}`;
  }
}
