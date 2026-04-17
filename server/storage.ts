import {
  type User, type InsertUser, users,
  type TbrSnapshot, type InsertTbrSnapshot, tbrSnapshots,
  type TbrSchedule, type InsertTbrSchedule, tbrSchedules,
  type TbrStaging, type InsertTbrStaging, tbrStaging,
  type ClientAccount, type InsertClientAccount, clientAccounts,
  type ArOnlyClient, type InsertArOnlyClient, arOnlyClients,
  type ClientMapping, type InsertClientMapping, clientMapping,
  type DropsuiteAccount, dropsuiteAccounts,
  type Tenant, tenants,
  type Client, type InsertClient, clients,
  type Announcement, type InsertAnnouncement, announcements,
  appSettings,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, lte, gte, gt, isNull, isNotNull, or } from "drizzle-orm";

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
  getAllArOnlyClients(): Promise<ArOnlyClient[]>;
  upsertArOnlyClient(client: InsertArOnlyClient): Promise<ArOnlyClient>;
  deleteArOnlyClient(id: number): Promise<void>;
  updateClientStackCompliance(id: number, stackCompliance: any): Promise<ClientAccount>;
  updateClientTbrInvite(id: number, invitedAt: Date | null): Promise<ClientAccount>;
  getAllClientMappings(): Promise<ClientMapping[]>;
  getClientMappingByCwId(cwCompanyId: number): Promise<ClientMapping | undefined>;
  upsertClientMapping(data: InsertClientMapping): Promise<ClientMapping>;
  getAllDropsuiteAccounts(): Promise<DropsuiteAccount[]>;
  upsertDropsuiteAccount(userId: string, companyName: string): Promise<void>;
  getAppSetting(key: string): Promise<string | null>;
  setAppSetting(key: string, value: string): Promise<void>;
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

  async getPortalUsersByClientId(clientId: number): Promise<User[]> {
    return db.select().from(users).where(eq(users.clientId, clientId));
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

  async getAllArOnlyClients(): Promise<ArOnlyClient[]> {
    return db.select().from(arOnlyClients);
  }

  async upsertArOnlyClient(client: InsertArOnlyClient): Promise<ArOnlyClient> {
    const existing = await db.select().from(arOnlyClients).where(eq(arOnlyClients.cwCompanyId, client.cwCompanyId)).limit(1);
    if (existing[0]) {
      const [result] = await db.update(arOnlyClients)
        .set({ ...client, updatedAt: new Date() })
        .where(eq(arOnlyClients.id, existing[0].id))
        .returning();
      return result;
    }
    const [result] = await db.insert(arOnlyClients).values(client).returning();
    return result;
  }

  async deleteArOnlyClient(id: number): Promise<void> {
    await db.delete(arOnlyClients).where(eq(arOnlyClients.id, id));
  }

  async updateClientStackCompliance(id: number, stackCompliance: any): Promise<ClientAccount> {
    const [result] = await db.update(clientAccounts)
      .set({ stackCompliance, updatedAt: new Date() })
      .where(eq(clientAccounts.id, id))
      .returning();
    return result;
  }

  async updateClientTbrInvite(id: number, invitedAt: Date | null): Promise<ClientAccount> {
    const [result] = await db.update(clientAccounts)
      .set({ tbrInvitedAt: invitedAt, updatedAt: new Date() })
      .where(eq(clientAccounts.id, id))
      .returning();
    return result;
  }

  async getAllClientMappings(): Promise<ClientMapping[]> {
    return db.select().from(clientMapping).orderBy(clientMapping.companyName);
  }

  async getClientMappingByCwId(cwCompanyId: number): Promise<ClientMapping | undefined> {
    const results = await db.select().from(clientMapping).where(eq(clientMapping.cwCompanyId, cwCompanyId)).limit(1);
    return results[0];
  }

  async upsertClientMapping(data: InsertClientMapping): Promise<ClientMapping> {
    const existing = await this.getClientMappingByCwId(data.cwCompanyId);
    if (existing) {
      const [result] = await db.update(clientMapping)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(clientMapping.id, existing.id))
        .returning();
      return result;
    }
    const [result] = await db.insert(clientMapping).values(data).returning();
    return result;
  }

  async getAllDropsuiteAccounts(): Promise<DropsuiteAccount[]> {
    return db.select().from(dropsuiteAccounts).orderBy(dropsuiteAccounts.companyName);
  }

  async upsertDropsuiteAccount(userId: string, companyName: string): Promise<void> {
    await db.insert(dropsuiteAccounts)
      .values({ userId, companyName, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: dropsuiteAccounts.userId,
        set: { companyName, updatedAt: new Date() },
      });
  }

  async getAppSetting(key: string): Promise<string | null> {
    const results = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    return results[0]?.value ?? null;
  }

  async setAppSetting(key: string, value: string): Promise<void> {
    await db.insert(appSettings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: new Date() },
      });
  }

  async getTenantById(id: number): Promise<Tenant | null> {
    const results = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return results[0] ?? null;
  }

  // ── Client (portal) CRUD ────────────────────────────────────────────────

  async getClientById(id: number): Promise<Client | null> {
    const results = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    return results[0] ?? null;
  }

  async getClientByPsaId(tenantId: number, psaCompanyId: number): Promise<Client | null> {
    const results = await db.select().from(clients)
      .where(and(eq(clients.tenantId, tenantId), eq(clients.psaCompanyId, psaCompanyId)))
      .limit(1);
    return results[0] ?? null;
  }

  async getAllClientsByTenant(tenantId: number): Promise<Client[]> {
    return db.select().from(clients).where(eq(clients.tenantId, tenantId));
  }

  async updateClient(id: number, data: Partial<InsertClient>): Promise<Client> {
    const [result] = await db.update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return result;
  }

  // ── Announcement CRUD ───────────────────────────────────────────────────

  async getAllAnnouncements(tenantId: number): Promise<Announcement[]> {
    return db.select().from(announcements)
      .where(eq(announcements.tenantId, tenantId))
      .orderBy(desc(announcements.createdAt));
  }

  async getPublishedAnnouncements(tenantId: number, clientId?: number | null): Promise<Announcement[]> {
    const now = new Date();
    return db.select().from(announcements)
      .where(and(
        eq(announcements.tenantId, tenantId),
        lte(announcements.publishedAt, now),
        or(isNull(announcements.expiresAt), gt(announcements.expiresAt, now)),
        or(isNull(announcements.clientId), ...(clientId != null ? [eq(announcements.clientId, clientId)] : [])),
      ))
      .orderBy(desc(announcements.publishedAt));
  }

  async createAnnouncement(data: InsertAnnouncement): Promise<Announcement> {
    const [result] = await db.insert(announcements).values(data).returning();
    return result;
  }

  async updateAnnouncement(id: number, data: Partial<InsertAnnouncement>): Promise<Announcement> {
    const [result] = await db.update(announcements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(announcements.id, id))
      .returning();
    return result;
  }

  async deleteAnnouncement(id: number): Promise<void> {
    await db.delete(announcements).where(eq(announcements.id, id));
  }
}

export const storage = new DatabaseStorage();
