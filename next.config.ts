import type { NextConfig } from "next";

/** Team logos are cached by the scraper in the Supabase `team-logos` bucket. */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            port: "",
            pathname: "/storage/v1/object/public/team-logos/**",
            // No `search`: logo URLs carry a `?v=` cache-buster.
          },
        ]
      : [],
  },
};

export default nextConfig;
