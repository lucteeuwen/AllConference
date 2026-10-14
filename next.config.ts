import type { NextConfig } from "next";

/** Team logos are cached by the scraper in the Supabase `team-logos` bucket. */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  images: {
    // Optimized images (the brand marks) rarely change, so transform them at
    // most once a month instead of every few hours.
    minimumCacheTTL: 2678400,
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
