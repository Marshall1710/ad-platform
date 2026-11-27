import type { NextConfig } from "next";

const config: NextConfig = {
  agentRules: false,
  serverExternalPackages: ['sharp'],
};

export default config;
