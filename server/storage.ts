import {
  type User, type InsertUser, users,
  type TbrSnapshot, type InsertTbrSnapshot, tbrSnapshots,
  type TbrSchedule, type InsertTbrSchedule, tbrSchedules,
  type TbrStaging, type InsertTbrStaging, tbrStaging,
  type ClientAccount, type InsertClientAccount, clientAccounts,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, lte, gte, isNull, isNotNull } from "drizzle-orm";

export interface IStorage {
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  getUserCount(): Promise<number>;
  createTbrSnapshot(snapshot: InsertTbrSnapshot): Promise<TbrSnapshot>;
  updateTbrSnapshot(id: number, snapshot: Partial<InsertTbrSnapshot>): Promise<TbrSnapshot>;
  getTbrSnapshotsByOrg(orgId: number): Promise<TbrSnapshot[]>;
  getFinalizedSnapshotsByOrg(orgId: number): Promise<TbrSnapshot[]>;
  getAllFinalizedSnapshots(): Promise<TbrSnapshot[]>;
  getLatestTbrSnapshot(orgId: number): Promise<TbrSnapshot | undefined>;
  getPreviousTbrSnapshot(orgId: number): Promise<TbrSnapshot | undefined>;
  getDraftByOrg(orgId: number): Promise<TbrSnapshot | undefined>;
  getAllDrafts(): Promise<TbrSnapshot[]>;
  getTbrSnapshotById(id: number): Promise<TbrSnapshot | undefined>;
  deleteTbrSnapshot(id: number): Promise<void>;
  getAllSchedules(): Promise<TbrSchedule[]>;
  getScheduleByOrg(orgId: number): Promise<TbrSchedule | undefined>;
  upsertSchedule(schedule: InsertTbrSchedule): Promise<TbrSchedule>;
  deleteSchedule(id: number): Promise<void>;
  getSchedulesDueForReminder(daysAhead: number): Promise<TbrSchedule[]>;
  markReminderSent(id: number): Promise<void>;
  getStagingByOrg(orgId: number): Promise<TbrStaging | undefined>;
  getAllStaging(): Promise<TbrStaging[]>;
  upsertStaging(staging: InsertTbrStaging): Promise<TbrStaging>;
  deleteStaging(id: number): Promise<void>;
  clearStagingByOrg(orgId: number): Promise<void>;
  getAllClientAccounts(): Promise<ClientAccount[]>;
  getClientAccountByCwId(cwCompanyId: number): Promise<ClientAccount | undefined>;
  upsertClientAccount(account: InsertClientAccount): Promise<ClientAccount>;
  updateClientAccountTier(id: number, tier: string): Promise<ClientAccount>;
  deleteClientAccount(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {

  async getUserById(id: number): Promise<User | undefined> {
    const results = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return results[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const results = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return results[0];
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.displayName);
  }

  async createUser(user: InsertUser): Promise<User> {
    const [result] = await db.insert(users).values({
      ...user,
      email: user.email.toLowerCase(),
    }).returning();
    return result;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User> {
    const updateData: Partial<InsertUser> = { ...data };
    if (updateData.email) updateData.email = updateData.email.toLowerCase();
    const [result] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return result;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getUserCount(): Promise<number> {
    const results = await db.select().from(users);
    return results.length;
  }

  async createTbrSnapshot(snapshot: InsertTbrSnapshot): Promise<TbrSnapshot> {
    const [result] = await db.insert(tbrSnapshots).values(snapshot).returning();
    return result;
  }

  async updateTbrSnapshot(id: number, snapshot: Partial<InsertTbrSnapshot>): Promise<TbrSnapshot> {
    const [result] = await db.update(tbrSnapshots)
      .set({ ...snapshot, updatedAt: new Date() })
      .where(eq(tbrSnapshots.id, id))
      .returning();
    return result;
  }

  async getTbrSnapshotsByOrg(orgId: number): Promise<TbrSnapshot[]> {
    return db.select().from(tbrSnapshots).where(eq(tbrSnapshots.orgId, orgId)).orderBy(desc(tbrSnapshots.createdAt));
  }

  async getFinalizedSnapshotsByOrg(orgId: number): Promise<TbrSnapshot[]> {
    return db.select().from(tbrSnapshots)
      .where(and(eq(tbrSnapshots.orgId, orgId), eq(tbrSnapshots.status, "finalized")))
      .orderBy(desc(tbrSnapshots.createdAt));
  }

  async getLatestTbrSnapshot(orgId: number): Promise<TbrSnapshot | undefined> {
    const results = await db.select().from(tbrSnapshots)
      .where(and(eq(tbrSnapshots.orgId, orgId), eq(tbrSnapshots.status, "finalized")))
      .orderBy(desc(tbrSnapshots.createdAt)).limit(1);
    return results[0];
  }

  async getPreviousTbrSnapshot(orgId: number): Promise<TbrSnapshot | undefined> {
    const results = await db.select().from(tbrSnapshots)
      .where(and(eq(tbrSnapshots.orgId, orgId), eq(tbrSnapshots.status, "finalized")))
      .orderBy(desc(tbrSnapshots.createdAt)).limit(2);
    return results[1];
  }

  async getDraftByOrg(orgId: number): Promise<TbrSnapshot | undefined> {
    const results = await db.select().from(tbrSnapshots)
      .where(and(eq(tbrSnapshots.orgId, orgId), eq(tbrSnapshots.status, "draft")))
      .orderBy(desc(tbrSnapshots.updatedAt)).limit(1);
    return results[0];
  }

  async getAllDrafts(): Promise<TbrSnapshot[]> {
    return db.select().from(tbrSnapshots)
      .where(eq(tbrSnapshots.status, "draft"))
      .orderBy(desc(tbrSnapshots.updatedAt));
  }

  async getTbrSnapshotById(id: number): Promise<TbrSnapshot | undefined> {
    const results = await db.select().from(tbrSnapshots)
      .where(eq(tbrSnapshots.id, id)).limit(1);
    return results[0];
  }

  async deleteTbrSnapshot(id: number): Promise<void> {
    await db.delete(tbrSnapshots).where(eq(tbrSnapshots.id, id));
  }

  async getAllFinalizedSnapshots(): Promise<TbrSnapshot[]> {
    return db.select().from(tbrSnapshots)
      .where(eq(tbrSnapshots.status, "finalized"))
      .orderBy(desc(tbrSnapshots.createdAt));
  }

  async getAllSchedules(): Promise<TbrSchedule[]> {
    return db.select().from(tbrSchedules).orderBy(tbrSchedules.orgName);
  }

  async getScheduleByOrg(orgId: number): Promise<TbrSchedule | undefined> {
    const results = await db.select().from(tbrSchedules)
      .where(eq(tbrSchedules.orgId, orgId)).limit(1);
    return results[0];
  }

  async upsertSchedule(schedule: InsertTbrSchedule): Promise<TbrSchedule> {
    const existing = await this.getScheduleByOrg(schedule.orgId);
    if (existing) {
      const [result] = await db.update(tbrSchedules)
        .set({ ...schedule, updatedAt: new Date(), reminderSentAt: null })
        .where(eq(tbrSchedules.id, existing.id))
        .returning();
      return result;
    }
    const [result] = await db.insert(tbrSchedules).values(schedule).returning();
    return result;
  }

  async deleteSchedule(id: number): Promise<void> {
    await db.delete(tbrSchedules).where(eq(tbrSchedules.id, id));
  }

  async getSchedulesDueForReminder(daysAhead: number): Promise<TbrSchedule[]> {
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + daysAhead);
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    return db.select().from(tbrSchedules).where(
      and(
        isNotNull(tbrSchedules.nextReviewDate),
        isNotNull(tbrSchedules.reminderEmail),
        gte(tbrSchedules.nextReviewDate, startOfDay),
        lte(tbrSchedules.nextReviewDate, endOfDay),
        isNull(tbrSchedules.reminderSentAt)
      )
    );
  }

  async markReminderSent(id: number): Promise<void> {
    await db.update(tbrSchedules)
      .set({ reminderSentAt: new Date() })
      .where(eq(tbrSchedules.id, id));
  }

  async getStagingByOrg(orgId: number): Promise<TbrStaging | undefined> {
    const results = await db.select().from(tbrStaging)
      .where(eq(tbrStaging.orgId, orgId)).limit(1);
    return results[0];
  }

  async getAllStaging(): Promise<TbrStaging[]> {
    return db.select().from(tbrStaging).orderBy(desc(tbrStaging.updatedAt));
  }

  async upsertStaging(staging: InsertTbrStaging): Promise<TbrStaging> {
    const existing = await this.getStagingByOrg(staging.orgId);
    if (existing) {
      const [result] = await db.update(tbrStaging)
        .set({ ...staging, updatedAt: new Date() })
        .where(eq(tbrStaging.id, existing.id))
        .returning();
      return result;
    }
    const [result] = await db.insert(tbrStaging).values(staging).returning();
    return result;
  }

  async deleteStaging(id: number): Promise<void> {
    await db.delete(tbrStaging).where(eq(tbrStaging.id, id));
  }

  async clearStagingByOrg(orgId: number): Promise<void> {
    await db.delete(tbrStaging).where(eq(tbrStaging.orgId, orgId));
  }

  async getAllClientAccounts(): Promise<ClientAccount[]> {
    return db.select().from(clientAccounts).orderBy(clientAccounts.companyName);
  }

  async getClientAccountByCwId(cwCompanyId: number): Promise<ClientAccount | undefined> {
    const results = await db.select().from(clientAccounts)
      .where(eq(clientAccounts.cwCompanyId, cwCompanyId)).limit(1);
    return results[0];
  }

  async upsertClientAccount(account: InsertClientAccount): Promise<ClientAccount> {
    const existing = await this.getClientAccountByCwId(account.cwCompanyId);
    if (existing) {
      const [result] = await db.update(clientAccounts)
        .set({ ...account, updatedAt: new Date(), tierOverride: existing.tierOverride })
        .where(eq(clientAccounts.id, existing.id))
        .returning();
      return result;
    }
    const [result] = await db.insert(clientAccounts).values(account).returning();
    return result;
  }

  async updateClientAccountTier(id: number, tier: string): Promise<ClientAccount> {
    const [result] = await db.update(clientAccounts)
      .set({ tierOverride: tier, updatedAt: new Date() })
      .where(eq(clientAccounts.id, id))
      .returning();
    return result;
  }

  async deleteClientAccount(id: number): Promise<void> {
    await db.delete(clientAccounts).where(eq(clientAccounts.id, id));
  }
}

export const storage = new DatabaseStorage();
