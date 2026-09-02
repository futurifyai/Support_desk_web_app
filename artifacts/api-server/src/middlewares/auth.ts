import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getSessionSecret } from "../config";

export interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; role: string; sessionVersion: number };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];

  if (!token) {
    res.status(401).json({ success: false, message: "No token provided" });
    return;
  }

  let secret: string;
  try {
    secret = getSessionSecret();
  } catch {
    res.status(500).json({ success: false, message: "Server misconfiguration" });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as { userId: string; email: string; role: string; sessionVersion?: number };
    const [user] = await db
      .select({ sessionVersion: usersTable.sessionVersion })
      .from(usersTable)
      .where(eq(usersTable.id, decoded.userId))
      .limit(1);
    // Tokens issued before session versioning are compatible while the stored
    // version remains zero. Once a password changes, the increment rejects
    // every previous token for that account.
    const tokenSessionVersion = decoded.sessionVersion ?? 0;
    if (!user || tokenSessionVersion !== user.sessionVersion) {
      res.status(401).json({ success: false, message: "Session expired. Please sign in again." });
      return;
    }
    req.user = { ...decoded, sessionVersion: tokenSessionVersion };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, message: "Token expired" });
    } else {
      res.status(401).json({ success: false, message: "Invalid token" });
    }
  }
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ success: false, message: "Admin access required" });
      return;
    }
    next();
  });
}
