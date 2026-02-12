import { type User, type InsertUser, type TbrSnapshot, type InsertTbrSnapshot, tbrSnapshots } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createTbrSnapshot(snapshot: InsertTbrSnapshot): Promise<TbrSnapshot>;
  updateTbrSnapshot(id: number, snapshot: Partial<InsertTbrSnapshot>): Promise<TbrSnapshot>;
  getTbrSnapshotsByOrg(orgId: number): Promise<TbrSnapshot[]>;
  getFinalizedSnapshotsByOrg(orgId: number): Promise<TbrSnapshot[]>;
  getLatestTbrSnapshot(orgId: number): Promise<TbrSnapshot | undefined>;
  getPreviousTbrSnapshot(orgId: number): Promise<TbrSnapshot | undefined>;
  getDraftByOrg(orgId: number): Promise<TbrSnapshot | undefined>;
  getTbrSnapshotById(id: number): Promise<TbrSnapshot | undefined>;
  deleteTbrSnapshot(id: number): Promise<void>;
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
}

export const storage = new DatabaseStorage();
