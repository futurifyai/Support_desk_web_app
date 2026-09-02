import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db, usersTable, passwordResetsTable } from "@workspace/db";
import { eq, and, gt, sql, type SQL } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { sendPasswordResetEmail } from "../lib/email";
import { writeAudit } from "../lib/audit";
import { getSessionSecret } from "../config";
import { createRateLimiter } from "../lib/rateLimit";

const router: IRouter = Router();
const loginLimiter = createRateLimiter({ namespace: "auth:login", windowMs: 15 * 60 * 1000, max: 10 });
const passwordResetLimiter = createRateLimiter({ namespace: "auth:password-reset", windowMs: 15 * 60 * 1000, max: 5 });

router.post("/auth/signup", (_req, res) => {
  res.status(403).json({
    success: false,
    message: "Account creation is admin-only. Contact your administrator.",
  });
});

router.post("/auth/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      res.status(400).json({ success: false, message: "Email and password required" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      res.status(404).json({ success: false, message: "No account with this email" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, message: "Incorrect password" });
      return;
    }

    const secret = getSessionSecret();
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, sessionVersion: user.sessionVersion },
      secret,
      { expiresIn: "7d" },
    );

    void writeAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: "login",
      resourceType: "user",
      resourceId: user.id,
    });

    res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      },
    });
  } catch (err) {
    req.log.error({ err }, "login error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

router.post("/auth/push-token", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { token } = req.body as { token?: string };
    if (!token) {
      res.status(400).json({ success: false, message: "Token required" });
      return;
    }
    await db.update(usersTable).set({ pushToken: token }).where(eq(usersTable.id, req.user!.userId));
    res.json({ success: true, message: "Push token registered" });
  } catch (err) {
    req.log.error({ err }, "registerPushToken error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// POST /auth/password-reset/request — account-enumeration-safe
router.post("/auth/password-reset/request", passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body as { email?: string };

    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      // Still 200 to prevent enumeration
      res.json({ success: true, message: "If that email is registered, a reset link has been sent" });
      return;
    }

    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    // Always return the same response regardless of whether user exists
    res.json({ success: true, message: "If that email is registered, a reset link has been sent" });

    if (!user) return;

    // Generate a secure token, store its hash
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetsTable).values({
      userId: user.id,
      tokenHash,
      expiresAt,
      used: false,
    });

    void writeAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: "password_reset_request",
      resourceType: "user",
      resourceId: user.id,
    });

    void sendPasswordResetEmail({ userEmail: user.email, resetToken: rawToken });
  } catch (err) {
    req.log.error({ err }, "passwordResetRequest error");
    // Already responded 200; no further action needed
  }
});

// POST /auth/password-reset/confirm
router.post("/auth/password-reset/confirm", async (req, res) => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };

    if (!token || typeof token !== "string" || token.length < 10) {
      res.status(400).json({ success: false, message: "Invalid or missing reset token" });
      return;
    }
    if (!password || password.length < 8) {
      res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
      return;
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const passwordHash = await bcrypt.hash(password, 10);
    const resetResult = await db.transaction(async (tx) => {
      // This conditional update is the reset-token claim. PostgreSQL locks the
      // matching row, so only one concurrent confirmation can claim it.
      const [claimed] = await tx
        .update(passwordResetsTable)
        .set({ used: true })
        .where(
          and(
            eq(passwordResetsTable.tokenHash, tokenHash),
            eq(passwordResetsTable.used, false),
            gt(passwordResetsTable.expiresAt, new Date()),
          ),
        )
        .returning({ userId: passwordResetsTable.userId });

      if (!claimed) return null;

      await tx
        .update(usersTable)
        .set({ passwordHash, sessionVersion: sql`${usersTable.sessionVersion} + 1` })
        .where(eq(usersTable.id, claimed.userId));

      // A successful recovery invalidates every other outstanding link too.
      await tx
        .update(passwordResetsTable)
        .set({ used: true })
        .where(and(eq(passwordResetsTable.userId, claimed.userId), eq(passwordResetsTable.used, false)));

      const [user] = await tx
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, claimed.userId))
        .limit(1);

      return { userId: claimed.userId, email: user?.email ?? null };
    });

    if (!resetResult) {
      res.status(400).json({ success: false, message: "Reset link is invalid or has expired" });
      return;
    }

    void writeAudit({
      actorId: resetResult.userId,
      actorEmail: resetResult.email,
      action: "password_reset_confirm",
      resourceType: "user",
      resourceId: resetResult.userId,
    });

    res.json({ success: true, message: "Password has been reset. You can now log in." });
  } catch (err) {
    req.log.error({ err }, "passwordResetConfirm error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// GET /auth/profile — get authenticated user's profile
router.get("/auth/profile", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    res.json({ success: true, message: "Profile fetched", data: user });
  } catch (err) {
    req.log.error({ err }, "getProfile error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// PATCH /auth/profile — update name and/or password
router.patch("/auth/profile", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body as {
      name?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    const updates: { name?: string; passwordHash?: string; sessionVersion?: SQL } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
        res.status(400).json({ success: false, message: "Name must be at least 2 characters" });
        return;
      }
      updates.name = name.trim();
    }

    if (newPassword !== undefined) {
      if (!currentPassword) {
        res.status(400).json({ success: false, message: "Current password is required to set a new password" });
        return;
      }
      if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 256) {
        res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
        return;
      }

      const [user] = await db
        .select({ passwordHash: usersTable.passwordHash })
        .from(usersTable)
        .where(eq(usersTable.id, req.user!.userId))
        .limit(1);

      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        res.status(401).json({ success: false, message: "Current password is incorrect" });
        return;
      }

      updates.passwordHash = await bcrypt.hash(newPassword, 10);
      updates.sessionVersion = sql`${usersTable.sessionVersion} + 1`;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, message: "No changes provided" });
      return;
    }

    await db.update(usersTable).set(updates).where(eq(usersTable.id, req.user!.userId));

    const [updated] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        sessionVersion: usersTable.sessionVersion,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.userId))
      .limit(1);

    void writeAudit({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      action: "profile_update",
      resourceType: "user",
      resourceId: req.user!.userId,
      meta: { changedFields: Object.keys(updates).filter(k => k !== "passwordHash").concat(updates.passwordHash ? ["password"] : []) },
    });

    const token = updates.passwordHash && updated
      ? jwt.sign(
          { userId: updated.id, email: updated.email, role: updated.role, sessionVersion: updated.sessionVersion },
          getSessionSecret(),
          { expiresIn: "7d" },
        )
      : undefined;
    res.json({ success: true, message: "Profile updated", data: updated ? { ...updated, token } : updated });
  } catch (err) {
    req.log.error({ err }, "updateProfile error");
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

export default router;
