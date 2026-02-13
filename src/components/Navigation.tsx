"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Utensils, Weight, Dumbbell, LayoutDashboard, Footprints } from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/food", label: "Food", icon: Utensils },
  { href: "/weight", label: "Weight", icon: Weight },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/cardio", label: "Cardio", icon: Footprints },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/80 backdrop-blur-xl md:relative md:border-t-0 md:border-r md:bg-card">
      <div className="flex items-center justify-around md:flex-col md:justify-start md:gap-1 md:p-3 md:min-h-screen md:w-56">
        <div className="hidden md:block md:mb-6 md:px-3 md:pt-2">
          <h1 className="text-xl font-bold text-accent">calTrack</h1>
          <p className="text-xs text-foreground/40 mt-0.5">Track everything.</p>
        </div>
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors md:w-full ${
                active
                  ? "text-accent bg-accent/10"
                  : "text-foreground/50 hover:text-foreground hover:bg-card-hover"
              }`}
            >
              <Icon size={20} />
              <span className="hidden md:inline">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
