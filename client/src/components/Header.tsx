import { Link, useLocation } from "wouter";
import { Sparkles, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
  const [location] = useLocation();

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutGrid },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group cursor-pointer">
          <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-all duration-300">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
            Tolstoy AI
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}>
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 ring-2 ring-white shadow-md flex items-center justify-center text-xs font-bold text-indigo-700">
            JS
          </div>
        </div>
      </div>
    </header>
  );
}
