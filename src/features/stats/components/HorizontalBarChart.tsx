import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface HorizontalBarChartProps {
  data: { name: string; value: number }[];
  title: string;
  color?: string;
  showAllBars?: boolean;
}

export function HorizontalBarChart({ 
  data, 
  title, 
  color = 'hsl(var(--primary))',
  showAllBars = false 
}: HorizontalBarChartProps) {
  const displayData = showAllBars ? data : data.slice(0, 10);
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

  const height = Math.max(200, displayData.length * 35);

  return (
    <div className="bg-card rounded-xl p-5 border border-border">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={displayData} layout="vertical" margin={{ left: 0, right: 20 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [`${value} orang`, '']}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
              {displayData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
