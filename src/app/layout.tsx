import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "ExploreTracks — Live Wildlife Cams & Animal Migration Tracker",
  description:
    "Explore live wildlife camera streams from explore.org and track real-time animal migration routes from Movebank on an interactive WebGIS map.",
  keywords: ["wildlife", "animal tracking", "WebGIS", "explore.org", "Movebank", "migration", "live cams"],
  icons: { icon: "/icon.png" },
  openGraph: {
    title: "ExploreTracks",
    description: "Live Wildlife Cams & Animal Migration Tracker",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${jakartaSans.variable} h-full`}>
      <body className="h-full bg-neutral-950 text-neutral-100 antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
