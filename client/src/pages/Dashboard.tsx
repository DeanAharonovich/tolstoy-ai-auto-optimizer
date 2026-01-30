import { useState } from "react";
import { Link } from "wouter";
import { useTests } from "@/hooks/use-tests";
import { Plus, Search, Filter, ArrowRight, TrendingUp, Users, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateTestDialog } from "@/components/CreateTestDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { MetricCard } from "@/components/MetricCard";

export default function Dashboard() {
  const { data: tests, isLoading } = useTests();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setCreateOpen] = useState(false);

  const filteredTests = tests?.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.productName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Manage your video A/B tests and view performance.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 transition-all hover:-translate-y-0.5">
          <Plus className="w-4 h-4 mr-2" /> New Experiment
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard 
          label="Active Tests" 
          value={tests?.filter(t => t.status === 'running').length || 0} 
          icon={<Activity className="w-5 h-5" />}
        />
        <MetricCard 
          label="Total Reach" 
          value={(tests?.reduce((acc, t) => acc + t.targetPopulation, 0) || 0).toLocaleString()} 
          icon={<Users className="w-5 h-5" />}
        />
        <MetricCard 
          label="Total Conversion Uplift" 
          value={(() => {
            const totalUplift = tests?.reduce((acc, t) => {
              const uplift = parseFloat((t.conversionUplift || "+0%").replace(/[^0-9.-]/g, '')) || 0;
              return acc + uplift;
            }, 0) || 0;
            return `+${totalUplift.toFixed(1)}%`;
          })()} 
          icon={<TrendingUp className="w-5 h-5" />}
          trend={{ value: 30.8, isPositive: true }}
        />
        <MetricCard 
          label="Total Income Uplift" 
          value={(() => {
            const totalIncome = tests?.reduce((acc, t) => {
              const income = parseFloat((t.incomeUplift || "$0").replace(/[^0-9.-]/g, '')) || 0;
              return acc + income;
            }, 0) || 0;
            return `+$${totalIncome.toLocaleString()}`;
          })()} 
          icon={<TrendingUp className="w-5 h-5" />}
          trend={{ value: 5140, isPositive: true }}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-display font-semibold text-lg text-slate-900">Recent Experiments</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input 
                placeholder="Search tests..." 
                className="pl-9 w-full sm:w-64 bg-slate-50 border-transparent hover:bg-white hover:border-slate-200 focus:bg-white transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="shrink-0 text-slate-500 hover:text-indigo-600">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl bg-slate-50" />)}
            </div>
          ) : filteredTests?.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mb-4 text-indigo-600">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">No tests found</h3>
              <p className="text-slate-500 mt-1 max-w-sm mx-auto">
                Try adjusting your search or create a new experiment to get started.
              </p>
              <Button onClick={() => setCreateOpen(true)} variant="ghost" className="mt-2 text-indigo-600">
                Create new test
              </Button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Experiment Name</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Start Date</th>
                  <th className="text-right py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Gain</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredTests?.map((test) => (
                  <tr key={test.id} className="group hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6">
                      <Link href={`/tests/${test.id}`} className="block">
                        <span className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">{test.name}</span>
                      </Link>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-600">{test.productName}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${test.status === 'running' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-slate-100 text-slate-800'
                        }`}>
                        {test.status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />}
                        {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-500">
                      {test.startDate ? format(new Date(test.startDate), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="py-4 px-6 text-right font-medium text-emerald-600">
                      {test.totalGain || '—'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Link href={`/tests/${test.id}`} className="text-slate-300 hover:text-indigo-600 transition-colors">
                        <ArrowRight className="w-5 h-5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CreateTestDialog open={isCreateOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
