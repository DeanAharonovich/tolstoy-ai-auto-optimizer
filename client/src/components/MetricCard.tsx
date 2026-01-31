import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  className?: string;
  valueClassName?: string;
}

export function MetricCard({ label, value, trend, icon, className, valueClassName }: MetricCardProps) {
  return (
    <div className={cn(
      "bg-white rounded-xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow", 
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <h3 className={cn("text-2xl font-bold mt-1 font-display text-slate-900", valueClassName)}>{value}</h3>
        </div>
        {icon && <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">{icon}</div>}
      </div>
      
      {trend && (
        <div className={cn(
          "flex items-center mt-3 text-xs font-medium px-2 py-1 rounded-full w-fit",
          trend.isPositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        )}>
          {trend.isPositive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
          {trend.value}%
        </div>
      )}
    </div>
  );
}
