import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Activity } from "lucide-react";

interface LoadBalancerMetrics {
  connections: {
    [key: string]: number;
  };
  total_requests: number;
}

interface ServerConnection {
  server: string;
  connections: number;
  percentage: number;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'];

const MONITORING_URL = import.meta.env.VITE_MONITORING_URL || 'http://localhost:9000';

export const LoadBalancerChart = () => {
  const [lbMetrics, setLbMetrics] = useState<LoadBalancerMetrics | null>(null);
  const [chartData, setChartData] = useState<ServerConnection[]>([]);

  useEffect(() => {
    const fetchLBMetrics = async () => {
      try {
        const response = await fetch(`${MONITORING_URL}/lb/connections`);
        if (response.ok) {
          const data = await response.json();
          setLbMetrics(data);

          // Transform data for chart
          const totalConns = Object.values(data.connections as Record<string, number>).reduce((a, b) => a + b, 0);
          
          const transformed: ServerConnection[] = Object.entries(data.connections).map(([server, connections]) => ({
            server: server.replace(':', ' Port '),
            connections: connections as number,
            percentage: totalConns > 0 ? Math.round(((connections as number) / totalConns) * 100) : 0
          }));

          setChartData(transformed);
        }
      } catch (error) {
        console.error("Error fetching load balancer metrics:", error);
      }
    };

    fetchLBMetrics();
    const interval = setInterval(fetchLBMetrics, 3000);

    return () => clearInterval(interval);
  }, []);

  const totalConnections = lbMetrics ? Object.values(lbMetrics.connections).reduce((a, b) => a + b, 0) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Load Balancer - Connection Distribution
        </CardTitle>
        <CardDescription>
          Least Connections Algorithm: Routes to server with minimum active connections
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Algorithm</div>
              <div className="text-xl font-bold text-blue-600">Least Connections</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Total Active Connections</div>
              <div className="text-xl font-bold">{totalConnections}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Total Requests Handled</div>
              <div className="text-xl font-bold">{lbMetrics?.total_requests || 0}</div>
            </div>
          </div>

          {/* Connection Distribution Chart */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-4">Current Connection Distribution</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="server" />
                <YAxis />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-semibold">{payload[0].payload.server}</p>
                          <p className="text-sm">
                            Connections: <span className="font-bold">{payload[0].value}</span>
                          </p>
                          <p className="text-sm">
                            Load: <span className="font-bold">{payload[0].payload.percentage}%</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="connections" name="Active Connections" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Connection Details Table */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-3">Server Load Distribution</h4>
            <div className="space-y-2">
              {chartData.map((server, index) => (
                <div key={server.server} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-mono text-sm">{server.server}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-semibold">{server.connections} connections</div>
                      <div className="text-xs text-muted-foreground">{server.percentage}% of total load</div>
                    </div>
                    {/* Load indicator bar */}
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-300"
                        style={{ 
                          width: `${server.percentage}%`,
                          backgroundColor: COLORS[index % COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Load Balancing Info */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <strong>How it works:</strong> Each request is routed to the server with the 
              <strong> fewest active connections</strong>. Connection count increments when a 
              client connects and decrements when it disconnects, ensuring optimal load distribution.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
