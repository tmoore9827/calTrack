import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "calTrack",
  description: "Track your calories, weight, and workouts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <div className="flex flex-col md:flex-row min-h-screen">
          <Navigation />
          <main className="flex-1 pb-20 md:pb-0 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
