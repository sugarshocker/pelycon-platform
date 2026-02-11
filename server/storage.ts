import { type User, type InsertUser, type TbrSnapshot, type InsertTbrSnapshot, tbrSnapshots } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createTbrSnapshot(snapshot: InsertTbrSnapshot): Promise<TbrSnapshot>;
  getTbrSnapshotsByOrg(orgId: number): Promise<TbrSnapshot[]>;
  getLatestTbrSnapshot(orgId: number): Promise<TbrSnapshot | undefined>;
  getPreviousTbrSnapshot(orgId: number): Promise<TbrSnapshot | undefined>;
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

  async getTbrSnapshotsByOrg(orgId: number): Promise<TbrSnapshot[]> {
    return db.select().from(tbrSnapshots).where(eq(tbrSnapshots.orgId, orgId)).orderBy(desc(tbrSnapshots.createdAt));
  }

  async getLatestTbrSnapshot(orgId: number): Promise<TbrSnapshot | undefined> {
    const results = await db.select().from(tbrSnapshots).where(eq(tbrSnapshots.orgId, orgId)).orderBy(desc(tbrSnapshots.createdAt)).limit(1);
    return results[0];
  }

  async getPreviousTbrSnapshot(orgId: number): Promise<TbrSnapshot | undefined> {
    const results = await db.select().from(tbrSnapshots).where(eq(tbrSnapshots.orgId, orgId)).orderBy(desc(tbrSnapshots.createdAt)).limit(2);
    return results[1];
  }
}

export const storage = new DatabaseStorage();
