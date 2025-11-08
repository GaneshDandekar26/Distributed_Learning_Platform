import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "@/lib/auth";
import { SystemMetrics, ServerMetrics } from "@/types";
import { MetricsChart } from "@/components/MetricsChart";
import { LamportClockChart } from "@/components/LamportClockChart";
import { ServerStateTable } from "@/components/ServerStateTable";
import { ConsistencyPanel } from "@/components/ConsistencyPanel";
import { DCActivityLog } from "@/components/DCActivityLog";
import { StatusIndicator } from "@/components/StatusIndicator";
import { LoadBalancerChart } from "@/components/LoadBalancerChart";
import { AppServerStats } from "@/components/AppServerStats";
import BullyElectionChart from "@/components/BullyElectionChart";
import MessagingPanel from "@/components/MessagingPanel";
import FTRoleMonitor from "@/components/FTRoleMonitor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Activity, Server, AlertCircle, Crown, MessageSquare, Shield } from "lucide-react";
import { toast } from "sonner";

const MONITORING_URL = import.meta.env.VITE_MONITORING_URL || 'http://localhost:9005';

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
    lamportClock: data.lamport_time || 0,
    coordinatorRole: data.is_primary ? 'LEADER' : 'FOLLOWER',
    ftRole: data.role || 'BACKUP',
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
                        <h4 className="font-semibold flex items-center gap-2">
                          {serverId.toUpperCase()}
                          {data.role === 'PRIMARY' && (
                            <span className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded-full">PRIMARY</span>
                          )}
                          {data.role === 'BACKUP' && (
                            <span className="text-xs px-2 py-0.5 bg-gray-500 text-white rounded-full">BACKUP</span>
                          )}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Status: {data.status} | Uptime: {Math.floor(data.uptime / 60)}m | Response: {data.response_time}ms
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          🕐 Lamport: {data.lamport_time || 0} | 🔄 Requests: {data.requests_count || 0}
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

          {/* Load Balancer Connection Distribution */}
          <LoadBalancerChart />

          {/* Application Server Statistics */}
          <AppServerStats servers={metrics.servers} />

          {/* Distributed Computing Features Tabs */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced Distributed Computing Features</CardTitle>
              <CardDescription>
                Bully Election, Inter-Server Messaging, Fault Tolerance Roles, Lamport Clocks, and Consistency Models
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="election" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="election" className="flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    <span className="hidden sm:inline">Bully Election</span>
                    <span className="sm:hidden">Election</span>
                  </TabsTrigger>
                  <TabsTrigger value="messaging" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">Messaging</span>
                    <span className="sm:hidden">Msg</span>
                  </TabsTrigger>
                  <TabsTrigger value="ft" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline">FT Roles</span>
                    <span className="sm:hidden">FT</span>
                  </TabsTrigger>
                  <TabsTrigger value="lamport" className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    <span className="hidden sm:inline">Lamport</span>
                    <span className="sm:hidden">Clock</span>
                  </TabsTrigger>
                  <TabsTrigger value="servers" className="flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    <span className="hidden sm:inline">Servers</span>
                    <span className="sm:hidden">Srv</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="election" className="mt-6">
                  <BullyElectionChart />
                </TabsContent>

                <TabsContent value="messaging" className="mt-6">
                  <MessagingPanel />
                </TabsContent>

                <TabsContent value="ft" className="mt-6">
                  <FTRoleMonitor />
                </TabsContent>

                <TabsContent value="lamport" className="mt-6">
                  <LamportClockChart servers={metrics.servers} />
                </TabsContent>

                <TabsContent value="servers" className="mt-6">
                  <div className="space-y-6">
                    <ServerStateTable servers={metrics.servers} />
                    <DCActivityLog servers={metrics.servers} />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Load Balancing Chart */}
          <MetricsChart servers={metrics.servers} />

          {/* RMI & DC Metrics Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Distributed Computing Metrics</CardTitle>
              <CardDescription>
                RMI connectivity, Lamport clock synchronization, and fault tolerance status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    🔗 RMI Status
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Remote Method Invocation between servers
                  </p>
                  {servers.filter(s => s.isHealthy).length > 0 ? (
                    servers.filter(s => s.isHealthy).map(server => (
                      <div key={server.serverId} className="text-xs py-1 flex justify-between items-center">
                        <span className="font-mono">{server.serverId}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-green-600">✓ Active</span>
                          <span className="text-muted-foreground">({server.activeConnections} reqs)</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-red-500">No healthy servers</p>
                  )}
                  <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                    💡 Port 9001 (9101, 9201, 9301)
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    🕐 Lamport Clocks
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Logical clock synchronization
                  </p>
                  {servers.map(server => (
                    <div key={server.serverId} className="text-xs py-1 flex justify-between items-center">
                      <span className="font-mono">{server.serverId}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{server.lamportClock}</span>
                        {server.isHealthy ? (
                          <span className="text-green-500">⟳</span>
                        ) : (
                          <span className="text-red-500">⊗</span>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                    💡 Increments on every operation
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    🛡️ Fault Tolerance
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Heartbeat-based replication (2s interval)
                  </p>
                  {servers.map(server => (
                    <div key={server.serverId} className="text-xs py-1 flex justify-between items-center">
                      <span className="font-mono">{server.serverId}</span>
                      <div className="flex items-center gap-2">
                        {server.ftRole === 'PRIMARY' ? (
                          <span className="font-bold text-blue-600 flex items-center gap-1">
                            <span className="h-2 w-2 bg-blue-600 rounded-full animate-pulse"></span>
                            PRIMARY
                          </span>
                        ) : (
                          <span className="font-bold text-gray-600">BACKUP</span>
                        )}
                        {!server.isHealthy && <span className="text-red-500">⚠️</span>}
                      </div>
                    </div>
                  ))}
                  <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                    💡 Port 9002 (UDP) - Failover in 6s
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 rounded-md">
                <div className="text-sm text-green-900 dark:text-green-100">
                  <strong>✅ All DC Concepts Active:</strong> 
                  <span className="ml-2">Custom RMI</span>
                  <span className="ml-2">• Lamport Clock</span>
                  <span className="ml-2">• Heartbeat FT</span>
                  <span className="ml-2 text-xs">({servers.filter(s => s.isHealthy).length}/{servers.length} servers healthy)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Consistency & Analytics */}
          <ConsistencyPanel metrics={metrics} />
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
