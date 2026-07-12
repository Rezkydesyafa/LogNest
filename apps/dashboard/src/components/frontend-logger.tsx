"use client";

import { useEffect } from "react";
import { initLogMindFrontend } from "@logmind/frontend-logger";

export function FrontendLogger() {
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_LOGMIND_CLIENT_KEY;
    const baseUrl = process.env.NEXT_PUBLIC_LOGMIND_API_URL;
    if (!apiKey || !baseUrl) return;
    const client = initLogMindFrontend({
      apiKey,
      serviceName: "frontend-dashboard",
      environment: process.env.NODE_ENV,
      endpoint: `${baseUrl}/logs/frontend`,
    });
    return () => client.destroy();
  }, []);
  return null;
}
