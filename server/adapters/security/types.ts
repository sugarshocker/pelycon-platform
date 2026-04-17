export interface SecurityAdapter {
  isConfigured(): boolean;
  getSecuritySummary(orgName: string): Promise<any>;
  getAgentHostnames(orgName: string): Promise<string[]>;
}
