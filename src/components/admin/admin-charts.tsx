import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export function AdminCharts({
  byGender,
  byAgeGroup,
}: {
  byGender: Record<string, number> | undefined;
  byAgeGroup: Record<string, number> | undefined;
}) {
  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 font-semibold text-brand-primary">Gender Distribution</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={["Male", "Female", "Other", "Unspecified"]
                  .map((k) => ({ name: k, value: byGender?.[k] ?? 0 }))
                  .filter((d) => d.value > 0)}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                label
              >
                {["#1e40af", "#f97316", "#16a34a", "#94a3b8"].map((c, i) => (
                  <Cell key={i} fill={c} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 font-semibold text-brand-primary">Age Group Distribution</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={["Below 18", "18-35", "36-50", "Above 50"].map((k) => ({
                name: k,
                value: byAgeGroup?.[k] ?? 0,
              }))}
            >
              <XAxis dataKey="name" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="value" fill="#1e40af" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
