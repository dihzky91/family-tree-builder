import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface DonutChartProps {
  data: { name: string; value: number; color: string }[];
  title: string;
  showLegend?: boolean;
}

export function DonutChart({ data, title, showLegend = true }: DonutChartProps) {
  const total = data.reduce((acc, item) => acc + item.value, 0);

  if (total === 0) {
    return (
      <div className="bg-card rounded-xl p-5 border border-border">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
          Tidak ada data
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-5 border border-border">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [`${value} (${((value / total) * 100).toFixed(1)}%)`, '']}
            />
            {showLegend && (
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
