import type { Express, Request, Response } from "express";
import * as connectwise from "../services/connectwise";
import { insertTbrSnapshotSchema } from "@shared/schema";
import { storage } from "../storage";
import { log } from "../index";
import { requireAuth, requireEditor } from "../middleware/auth";

function buildSnapshotMetrics(body: any) {
  const { orgId, orgName, deviceHealth, security, tickets, mfaReport, licenseReport, roadmap: roadmapData } = body;
  const mfaCoveragePct = mfaReport?.totalUsers > 0
    ? Math.round((mfaReport.coveredCount / mfaReport.totalUsers) * 100)
    : null;
  return {
    orgId,
    orgName,
    totalDevices: deviceHealth?.totalDevices ?? 0,
    workstations: deviceHealth?.workstations ?? 0,
    servers: deviceHealth?.servers ?? 0,
    needsReplacementCount: deviceHealth?.needsReplacementCount ?? 0,
    patchCompliancePercent: deviceHealth?.patchCompliancePercent ?? 100,
    pendingPatchCount: deviceHealth?.pendingPatchCount ?? 0,
    eolOsCount: deviceHealth?.eolOsDevices?.length ?? 0,
    staleDeviceCount: deviceHealth?.staleDevices?.length ?? 0,
    totalIncidents: security?.totalIncidents ?? 0,
    pendingIncidents: security?.pendingIncidents ?? 0,
    activeAgents: security?.activeAgents ?? 0,
    satLearnerCount: security?.satLearnerCount ?? null,
    satTotalUsers: security?.satTotalUsers ?? null,
    totalTickets: tickets?.totalTickets ?? 0,
    oldOpenTicketCount: tickets?.oldOpenTickets?.length ?? 0,
    mfaTotalUsers: mfaReport?.totalUsers ?? null,
    mfaCoveredCount: mfaReport?.coveredCount ?? null,
    mfaCoveragePercent: mfaCoveragePct,
    licenseTotalWasted: licenseReport?.totalWasted ?? null,
    licenseMonthlyWaste: licenseReport?.totalMonthlyWaste ?? null,
    licenseAnnualWaste: licenseReport?.totalAnnualWaste ?? null,
    roadmapItemCount: roadmapData?.items?.length ?? 0,
    urgentItemCount: roadmapData?.items?.filter((i: any) => i.priority === "urgent").length ?? 0,
  };
}

export function registerTbrRoutes(app: Express) {
  app.post("/api/tbr/save-draft", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const { orgId, orgName, scheduleId, reviewDate } = req.body;
      if (!orgId || !orgName) {
        return res.status(400).json({ message: "Organization ID and name are required" });
      }

      const metrics = buildSnapshotMetrics(req.body);
      const fullData = {
        deviceHealth: req.body.deviceHealth || null,
        security: req.body.security || null,
        tickets: req.body.tickets || null,
        mfaReport: req.body.mfaReport || null,
        licenseReport: req.body.licenseReport || null,
        roadmap: req.body.roadmap || null,
        internalNotes: req.body.internalNotes || null,
        clientFeedback: req.body.clientFeedback || null,
        deviceUserInventory: req.body.deviceUserInventory || null,
      };

      const existingDraft = await storage.getDraftByOrg(orgId);

      if (existingDraft) {
        const result = await storage.updateTbrSnapshot(existingDraft.id, {
          ...metrics,
          status: "draft",
          fullData,
          scheduleId: scheduleId ? parseInt(scheduleId) : existingDraft.scheduleId,
          reviewDate: reviewDate || existingDraft.reviewDate || null,
        });
        log(`TBR draft updated for ${orgName} (orgId: ${orgId}), snapshot ID: ${result.id}`);
        res.json(result);
      } else {
        const snapshotData = {
          ...metrics,
          status: "draft",
          fullData,
          scheduleId: scheduleId ? parseInt(scheduleId) : null,
          reviewDate: reviewDate || null,
        };
        const parsed = insertTbrSnapshotSchema.safeParse(snapshotData);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid snapshot data", errors: parsed.error.flatten().fieldErrors });
        }
        const result = await storage.createTbrSnapshot(parsed.data);
        log(`TBR draft saved for ${orgName} (orgId: ${orgId}), snapshot ID: ${result.id}`);
        res.json(result);
      }
    } catch (err: any) {
      log(`TBR save draft error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tbr/drafts", requireAuth, async (_req: Request, res: Response) => {
    try {
      const drafts = await storage.getAllDrafts();
      res.json(drafts);
    } catch (err: any) {
      log(`Get all drafts error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tbr/draft/:orgId", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = parseInt(req.params.orgId as string);
      if (isNaN(orgId)) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }
      const draft = await storage.getDraftByOrg(orgId);
      res.json({ draft: draft || null });
    } catch (err: any) {
      log(`TBR draft load error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/tbr/draft/:id", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid draft ID" });
      }
      await storage.deleteTbrSnapshot(id);
      res.json({ success: true });
    } catch (err: any) {
      log(`TBR draft delete error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tbr/finalize", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const { orgId, orgName, scheduleId, reviewDate } = req.body;
      if (!orgId || !orgName) {
        return res.status(400).json({ message: "Organization ID and name are required" });
      }

      const metrics = buildSnapshotMetrics(req.body);
      const fullData = {
        deviceHealth: req.body.deviceHealth || null,
        security: req.body.security || null,
        tickets: req.body.tickets || null,
        mfaReport: req.body.mfaReport || null,
        licenseReport: req.body.licenseReport || null,
        roadmap: req.body.roadmap || null,
        internalNotes: req.body.internalNotes || null,
        clientFeedback: req.body.clientFeedback || null,
        deviceUserInventory: req.body.deviceUserInventory || null,
      };

      const existingDraft = await storage.getDraftByOrg(orgId);

      let result;
      if (existingDraft) {
        result = await storage.updateTbrSnapshot(existingDraft.id, {
          ...metrics,
          status: "finalized",
          fullData,
          scheduleId: scheduleId ? parseInt(scheduleId) : existingDraft.scheduleId,
          reviewDate: reviewDate || existingDraft.reviewDate || null,
        });
      } else {
        const snapshotData = {
          ...metrics,
          status: "finalized",
          fullData,
          scheduleId: scheduleId ? parseInt(scheduleId) : null,
          reviewDate: reviewDate || null,
        };
        const parsed = insertTbrSnapshotSchema.safeParse(snapshotData);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid snapshot data", errors: parsed.error.flatten().fieldErrors });
        }
        result = await storage.createTbrSnapshot(parsed.data);
      }

      if (result.scheduleId) {
        try {
          const schedule = await storage.getScheduleByOrg(orgId);
          if (schedule && schedule.id === result.scheduleId) {
            const now = new Date();
            const nextDate = new Date(now);
            nextDate.setMonth(nextDate.getMonth() + schedule.frequencyMonths);
            await storage.upsertSchedule({
              orgId: schedule.orgId,
              orgName: schedule.orgName,
              frequencyMonths: schedule.frequencyMonths,
              nextReviewDate: nextDate,
              lastReviewDate: now,
              notes: schedule.notes,
              reminderEmail: schedule.reminderEmail,
              leadEngineerEmail: schedule.leadEngineerEmail,
            });
            log(`Schedule ${schedule.id} updated: lastReviewDate=${now.toISOString()}, nextReviewDate=${nextDate.toISOString()}`);
          }
        } catch (schedErr: any) {
          log(`Warning: Failed to update schedule after finalization: ${schedErr.message}`);
        }
      }

      log(`TBR finalized for ${orgName} (orgId: ${orgId}), snapshot ID: ${result.id}, scheduleId: ${result.scheduleId || 'none'}`);
      res.json(result);
    } catch (err: any) {
      log(`TBR finalize error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/connectwise/ticket", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const { snapshotId, companyName, followUpTasks, tbrDate } = req.body;
      if (!companyName || !followUpTasks || !Array.isArray(followUpTasks) || followUpTasks.length === 0) {
        return res.status(400).json({ message: "companyName and followUpTasks are required" });
      }
      if (!connectwise.isConfigured()) {
        return res.status(503).json({ message: "ConnectWise is not configured" });
      }

      const result = await connectwise.createFollowUpTicket(companyName, followUpTasks, tbrDate || new Date().toISOString().split("T")[0]);

      if (snapshotId) {
        await storage.updateTbrSnapshot(snapshotId, { cwTicketId: result.ticketId });
        log(`Saved CW ticket #${result.ticketId} to snapshot ${snapshotId}`);
      }

      res.json(result);
    } catch (err: any) {
      log(`ConnectWise ticket creation error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tbr/unfinalize/:id", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid snapshot ID" });
      }
      const snapshot = await storage.getTbrSnapshotById(id);
      if (!snapshot) {
        return res.status(404).json({ message: "Snapshot not found" });
      }
      if (snapshot.status !== "finalized") {
        return res.status(400).json({ message: "Only finalized TBRs can be un-finalized" });
      }
      const existingDraft = await storage.getDraftByOrg(snapshot.orgId);
      if (existingDraft) {
        return res.status(409).json({ message: "A draft already exists for this client. Discard it first before un-finalizing a past review." });
      }
      const result = await storage.updateTbrSnapshot(id, { status: "draft" });
      log(`TBR un-finalized: snapshot ${id} for orgId ${snapshot.orgId}`);
      res.json(result);
    } catch (err: any) {
      log(`TBR un-finalize error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tbr/history/:orgId", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = parseInt(req.params.orgId as string);
      if (isNaN(orgId)) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }
      const snapshots = await storage.getFinalizedSnapshotsByOrg(orgId);
      res.json(snapshots);
    } catch (err: any) {
      log(`TBR history error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tbr/snapshot/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid snapshot ID" });
      }
      const snapshot = await storage.getTbrSnapshotById(id);
      if (!snapshot) {
        return res.status(404).json({ message: "Snapshot not found" });
      }
      res.json(snapshot);
    } catch (err: any) {
      log(`TBR snapshot error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tbr/latest/:orgId", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = parseInt(req.params.orgId as string);
      if (isNaN(orgId)) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }
      const latest = await storage.getLatestTbrSnapshot(orgId);
      const previous = await storage.getPreviousTbrSnapshot(orgId);
      res.json({ latest: latest || null, previous: previous || null });
    } catch (err: any) {
      log(`TBR latest error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tbr/all-finalized", requireAuth, async (_req: Request, res: Response) => {
    try {
      const snapshots = await storage.getAllFinalizedSnapshots();
      res.json(snapshots);
    } catch (err: any) {
      log(`All finalized snapshots error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });
}
