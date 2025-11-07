import { useEffect, useState } from "react";
import { ServerMetrics } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface LamportClockChartProps {
  servers: ServerMetrics[];
}

interface ClockData {
  time: number;
  [key: string]: number;
}

export const LamportClockChart = ({ servers }: LamportClockChartProps) => {
  const [history, setHistory] = useState<ClockData[]>([]);

  useEffect(() => {
    const newPoint: ClockData = {
      time: Date.now(),
    };

    servers.forEach((server) => {
      newPoint[server.serverId] = server.lamportClock;
    });

    setHistory((prev) => [...prev.slice(-20), newPoint]);
  }, [servers]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lamport Logical Clocks</CardTitle>
        <CardDescription>Real-time clock synchronization across servers</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="time"
              tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              stroke="hsl(var(--foreground))"
            />
            <YAxis stroke="hsl(var(--foreground))" />
            <Tooltip
              labelFormatter={(value) => new Date(value).toLocaleTimeString()}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Legend />
            {servers.map((server, index) => (
              <Line
                key={server.serverId}
                type="monotone"
                dataKey={server.serverId}
                stroke={`hsl(var(--chart-${(index % 5) + 1}))`}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
