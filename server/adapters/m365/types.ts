export interface M365Tenant {
  id: string;
  domain: string;
  displayName: string;
}

export interface M365Adapter {
  isConfigured(): boolean;
  getTenants(): Promise<M365Tenant[]>;
  getClientStack(tenantId: string): Promise<any>;
}
