import { PrismaClient } from "@prisma/client";
import { extendWithSoftDelete } from "./soft-delete-extension";

export function createPrisma() {
  const baseClient = new PrismaClient();
  return extendWithSoftDelete(baseClient);
}

export type AppPrismaClient = ReturnType<typeof createPrisma>;
