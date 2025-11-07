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
import { LogOut, Activity } from "lucide-react";
import { toast } from "sonner";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const [isOnline, setIsOnline] = useState(true);

  // Mock metrics that update periodically
  const [metrics, setMetrics] = useState<SystemMetrics>({
    servers: [
      {
        serverId: "S1",
        activeConnections: 45,
        lamportClock: 1247,
        coordinatorRole: "LEADER",
        ftRole: "PRIMARY",
        isHealthy: true,
      },
      {
        serverId: "S2",
        activeConnections: 38,
        lamportClock: 1243,
        coordinatorRole: "FOLLOWER",
        ftRole: "BACKUP",
        isHealthy: true,
      },
      {
        serverId: "S3",
        activeConnections: 52,
        lamportClock: 1251,
        coordinatorRole: "FOLLOWER",
        ftRole: "BACKUP",
        isHealthy: true,
      },
      {
        serverId: "S4",
        activeConnections: 41,
        lamportClock: 1249,
        coordinatorRole: "FOLLOWER",
        ftRole: "PRIMARY",
        isHealthy: true,
      },
    ],
    consistency: {
      isConsistent: true,
      score: 98,
    },
    mapReduce: {
      status: "RUNNING",
      progress: 67,
    },
    hdfs: {
      datanodeCount: 8,
    },
  });

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/");
      return;
    }

    // Simulate real-time metrics updates
    const interval = setInterval(() => {
      setMetrics((prev) => ({
        ...prev,
        servers: prev.servers.map((server) => ({
          ...server,
          activeConnections: Math.max(
            20,
            Math.min(80, server.activeConnections + Math.floor(Math.random() * 10 - 5))
          ),
          lamportClock: server.lamportClock + Math.floor(Math.random() * 5 + 1),
        })),
        consistency: {
          ...prev.consistency,
          score: Math.max(90, Math.min(100, prev.consistency.score + Math.floor(Math.random() * 6 - 3))),
          isConsistent: Math.random() > 0.1,
        },
        mapReduce: {
          ...prev.mapReduce,
          progress:
            prev.mapReduce.status === "RUNNING"
              ? Math.min(100, prev.mapReduce.progress + Math.floor(Math.random() * 5))
              : 0,
          status:
            prev.mapReduce.progress >= 100
              ? "COMPLETED"
              : prev.mapReduce.status === "COMPLETED"
              ? "IDLE"
              : "RUNNING",
        },
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, [user, navigate]);

  const handleLogout = () => {
    authService.logout();
    toast.success("Logged out successfully");
    navigate("/");
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
