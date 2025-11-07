import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "@/lib/auth";
import { SystemMetrics, ServerMetrics } from "@/types";
import { MetricsChart } from "@/components/MetricsChart";
import { LamportClockChart } from "@/components/LamportClockChart";
import { ServerStateTable } from "@/components/ServerStateTable";
import { ConsistencyPanel } from "@/components/ConsistencyPanel";
import { StatusIndicator } from "@/components/StatusIndicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LogOut, Activity, Server, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const MONITORING_URL = import.meta.env.VITE_MONITORING_URL || 'http://localhost:9000';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const [isOnline, setIsOnline] = useState(true);
  const [monitoringData, setMonitoringData] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);

  // Fetch monitoring data from backend
  useEffect(() => {
    const fetchMonitoringData = async () => {
      try {
        const [metricsRes, summaryRes] = await Promise.all([
          fetch(`${MONITORING_URL}/metrics`),
          fetch(`${MONITORING_URL}/summary`)
        ]);

        if (metricsRes.ok && summaryRes.ok) {
          const metricsData = await metricsRes.json();
          const summaryData = await summaryRes.json();
          
          setMonitoringData(metricsData);
          setSummary(summaryData);
          setIsOnline(true);
        } else {
          setIsOnline(false);
        }
      } catch (error) {
        console.error("Error fetching monitoring data:", error);
        setIsOnline(false);
      }
    };

    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, []);

  // Convert monitoring data to ServerMetrics format
  const servers: ServerMetrics[] = monitoringData ? Object.entries(monitoringData).map(([id, data]: [string, any]) => ({
    serverId: id.toUpperCase(),
    activeConnections: data.requests_count || 0,
    lamportClock: data.uptime || 0,
    coordinatorRole: id === 'app1' ? 'LEADER' : 'FOLLOWER',
    ftRole: data.status === 'healthy' ? 'PRIMARY' : 'BACKUP',
    isHealthy: data.status === 'healthy',
  })) : [];

  const metrics: SystemMetrics = {
    servers,
    consistency: {
      isConsistent: summary?.healthy_services === summary?.total_services,
      score: summary?.health_percentage || 0,
    },
    mapReduce: {
      status: isOnline ? "RUNNING" : "IDLE",
      progress: 67,
    },
    hdfs: {
      datanodeCount: summary?.total_services || 0,
    },
  };

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/");
      return;
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    await authService.logout();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const handleRefreshMonitoring = async () => {
    try {
      const [metricsRes, summaryRes] = await Promise.all([
        fetch(`${MONITORING_URL}/metrics`),
        fetch(`${MONITORING_URL}/summary`)
      ]);

      if (metricsRes.ok && summaryRes.ok) {
        const metricsData = await metricsRes.json();
        const summaryData = await summaryRes.json();
        
        setMonitoringData(metricsData);
        setSummary(summaryData);
        toast.success("Monitoring data refreshed");
      }
    } catch (error) {
      toast.error("Failed to refresh monitoring data");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Admin Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">Distributed Systems Monitoring</p>
          </div>
          <div className="flex items-center gap-4">
            <StatusIndicator online={isOnline} label="Gateway Status" />
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Monitoring Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.total_services || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Healthy Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{summary?.healthy_services || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Unhealthy Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{summary?.unhealthy_services || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Health Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.health_percentage?.toFixed(1) || 0}%</div>
              </CardContent>
            </Card>
          </div>

          {/* Server Control Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Server Control Panel
              </CardTitle>
              <CardDescription>
                Monitor and control distributed app servers. Stop containers to test fault tolerance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {monitoringData && Object.entries(monitoringData).map(([serverId, data]: [string, any]) => (
                  <div key={serverId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${data.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <h4 className="font-semibold">{serverId.toUpperCase()}</h4>
                        <p className="text-sm text-muted-foreground">
                          Status: {data.status} | Uptime: {Math.floor(data.uptime / 60)}m | Response: {data.response_time}ms
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={handleRefreshMonitoring}>
                        Refresh
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Test Fault Tolerance:</strong> Use <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded">docker stop dlh-app1</code> or 
                  <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded ml-1">docker stop dlh-app2</code> to simulate server failures and watch the load balancer redirect traffic.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Load Balancing Chart */}
          <MetricsChart servers={metrics.servers} />

          {/* Lamport Clock Visualization */}
          <LamportClockChart servers={metrics.servers} />

          {/* Server State Table */}
          <ServerStateTable servers={metrics.servers} />

          {/* Consistency & Analytics */}
          <ConsistencyPanel metrics={metrics} />
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
