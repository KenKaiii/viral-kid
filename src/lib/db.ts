/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ?? new (PrismaClient as any)({} as any);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
