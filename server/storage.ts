import {
  type User, type InsertUser,
  type TbrSnapshot, type InsertTbrSnapshot, tbrSnapshots,
  type TbrSchedule, type InsertTbrSchedule, tbrSchedules,
  type TbrStaging, type InsertTbrStaging, tbrStaging,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, and, lte } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createTbrSnapshot(snapshot: InsertTbrSnapshot): Promise<TbrSnapshot>;
  updateTbrSnapshot(id: number, snapshot: Partial<InsertTbrSnapshot>): Promise<TbrSnapshot>;
  getTbrSnapshotsByOrg(orgId: number): Promise<TbrSnapshot[]>;
  getFinalizedSnapshotsByOrg(orgId: number): Promise<TbrSnapshot[]>;
  getAllFinalizedSnapshots(): Promise<TbrSnapshot[]>;
  getLatestTbrSnapshot(orgId: number): Promise<TbrSnapshot | undefined>;
  getPreviousTbrSnapshot(orgId: number): Promise<TbrSnapshot | undefined>;
  getDraftByOrg(orgId: number): Promise<TbrSnapshot | undefined>;
  getTbrSnapshotById(id: number): Promise<TbrSnapshot | undefined>;
  deleteTbrSnapshot(id: number): Promise<void>;
  getAllSchedules(): Promise<TbrSchedule[]>;
  getScheduleByOrg(orgId: number): Promise<TbrSchedule | undefined>;
  upsertSchedule(schedule: InsertTbrSchedule): Promise<TbrSchedule>;
  deleteSchedule(id: number): Promise<void>;
  getStagingByOrg(orgId: number): Promise<TbrStaging | undefined>;
  getAllStaging(): Promise<TbrStaging[]>;
  upsertStaging(staging: InsertTbrStaging): Promise<TbrStaging>;
  deleteStaging(id: number): Promise<void>;
  clearStagingByOrg(orgId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
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
        .set({ ...schedule, updatedAt: new Date() })
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
}

export const storage = new DatabaseStorage();
