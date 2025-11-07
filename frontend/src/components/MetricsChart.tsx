import { ServerMetrics } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface MetricsChartProps {
  servers: ServerMetrics[];
}

export const MetricsChart = ({ servers }: MetricsChartProps) => {
  const data = servers.map((server) => ({
    name: server.serverId,
    connections: server.activeConnections,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Server Load Distribution</CardTitle>
        <CardDescription>Least Connections Load Balancing</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" stroke="hsl(var(--foreground))" />
            <YAxis stroke="hsl(var(--foreground))" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Legend />
            <Bar dataKey="connections" fill="hsl(var(--primary))" name="Active Connections" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
