export interface RMMOrganization {
  id: number;
  name: string;
}

export interface DeviceHealth {
  totalDevices: number;
  workstations: number;
  servers: number;
  patchCompliancePercent: number;
  pendingPatchCount: number;
  criticalAlerts: any[];
}

export interface RMMAdapter {
  isConfigured(): boolean;
  getOrganizations(): Promise<RMMOrganization[]>;
  getDeviceHealth(orgId: number): Promise<DeviceHealth>;
  getDeviceNamesWithLastSeen(orgId: number): Promise<Array<{ name: string; lastSeen: string | null }>>;
  getDeviceUserMapping(orgId: number): Promise<any[]>;
}
