import { withValidManifest } from "@coinbase/onchainkit/minikit";
import { minikitConfig } from "../../../minikit.config";

"baseBuilder"; {
    "ownerAddress"; "0x233ca9a1a717D5Defe4f56cD7015E48dE16798F7"
  }

export async function GET() {
  return Response.json(withValidManifest(minikitConfig));
}
