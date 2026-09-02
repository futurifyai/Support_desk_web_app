import { z } from "zod/v4";

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const createAdminUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(256),
}).strict();

export const createUserProductSchema = z.object({
  productName: z.string().trim().min(2).max(120),
  startDate: dateInput.nullable().optional(),
  endDate: dateInput.nullable().optional(),
}).strict();

export const updateUserProductSchema = z.object({
  productName: z.string().trim().min(2).max(120).optional(),
  startDate: dateInput.nullable().optional(),
  endDate: dateInput.nullable().optional(),
  status: z.enum(["approved", "disapproved"]).optional(),
}).strict().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);

export function parseProductDate(value: string | null | undefined, endOfDay = false): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatValidationError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request";
}

export function validateProductDateRange(startDate: Date | null, endDate: Date | null): string | null {
  if (startDate && endDate && endDate <= startDate) return "End date must be after the start date";
  return null;
}