import type { PSAAdapter } from "./types";
import { ConnectWiseAdapter } from "./connectwise";

export function createPSAAdapter(psaType: string, _config: any): PSAAdapter {
  switch (psaType) {
    case "connectwise":
      return new ConnectWiseAdapter();
    case "halopsa":
      throw new Error("HaloPSA adapter not yet implemented");
    default:
      throw new Error(`Unknown PSA type: ${psaType}`);
  }
}
