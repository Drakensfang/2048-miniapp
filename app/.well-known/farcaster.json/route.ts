import { NextResponse } from "next/server";
import { minikitConfig } from "../../../minikit.config";

export async function GET() {
  const response = NextResponse.json({
    accountAssociation: minikitConfig.accountAssociation,
    miniapp: minikitConfig.miniapp,
  });
  
  response.headers.set("Content-Type", "application/json");
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Cache-Control", "public, max-age=3600");
  
  return response;
}
