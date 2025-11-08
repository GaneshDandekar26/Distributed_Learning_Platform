import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Database, CheckCircle, XCircle, Clock, Activity, Shield, 
  GitBranch, TrendingUp, AlertTriangle, Zap 
} from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

interface ConsistencyStats {
  server_id: string;
  consistency_level: string;
  replication_mode: string;
  total_writes: number;
  successful_replications: number;
  failed_replications: number;
  success_rate: number;
  conflicts_resolved: number;
  average_replication_time_ms: number;
  quorum_achieved: number;
  quorum_failed: number;
  data_items: number;
  pending_operations: number;
  operation_history_size: number;
}

interface ConsistencyStatus {
  server_id: string;
  consistency_model: string;
  replication_strategy: string;
  statistics: ConsistencyStats;
  recent_operations: any[];
  current_sequence: number;
  quorum_size: number;
  total_replicas: number;
  timestamp: string;
  error?: string;
}

export const StrongConsistencyPanel = () => {
  const [consistencyData, setConsistencyData] = useState<Record<string, ConsistencyStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConsistencyData();
    const interval = setInterval(fetchConsistencyData, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchConsistencyData = async () => {
    try {
      const response = await fetch('http://localhost:9005/consistency/status/all');
      const data = await response.json();
      setConsistencyData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching consistency data:', error);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Activity className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading consistency data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const servers = Object.keys(consistencyData).filter(k => !consistencyData[k].error);
  
  // Aggregate statistics
  const totalWrites = servers.reduce((sum, s) => 
    sum + (consistencyData[s]?.statistics?.total_writes || 0), 0);
  const totalSuccessful = servers.reduce((sum, s) => 
    sum + (consistencyData[s]?.statistics?.successful_replications || 0), 0);
  const totalFailed = servers.reduce((sum, s) => 
    sum + (consistencyData[s]?.statistics?.failed_replications || 0), 0);
  const avgSuccessRate = servers.length > 0 
    ? servers.reduce((sum, s) => sum + (consistencyData[s]?.statistics?.success_rate || 0), 0) / servers.length 
    : 0;
  const avgReplicationTime = servers.length > 0
    ? servers.reduce((sum, s) => sum + (consistencyData[s]?.statistics?.average_replication_time_ms || 0), 0) / servers.length
    : 0;

  // Prepare chart data
  const serverStatsData = servers.map(server => ({
    name: server,
    writes: consistencyData[server]?.statistics?.total_writes || 0,
    successful: consistencyData[server]?.statistics?.successful_replications || 0,
    failed: consistencyData[server]?.statistics?.failed_replications || 0,
    successRate: consistencyData[server]?.statistics?.success_rate || 0,
    replicationTime: consistencyData[server]?.statistics?.average_replication_time_ms || 0
  }));

  const quorumData = servers.map(server => ({
    name: server,
    achieved: consistencyData[server]?.statistics?.quorum_achieved || 0,
    failed: consistencyData[server]?.statistics?.quorum_failed || 0
  }));

  const replicationSuccessData = [
    { name: 'Successful', value: totalSuccessful, color: '#10B981' },
    { name: 'Failed', value: totalFailed, color: '#EF4444' }
  ];

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consistency Model</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">STRONG</div>
            <p className="text-xs text-muted-foreground">Sequential Consistency</p>
            <Badge className="mt-2" variant="default">
              <Zap className="h-3 w-3 mr-1" />
              Synchronous 2PC
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgSuccessRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {totalSuccessful}/{totalWrites} replications
            </p>
            <Progress value={avgSuccessRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Replication Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgReplicationTime.toFixed(2)}ms</div>
            <p className="text-xs text-muted-foreground">
              {avgReplicationTime < 100 ? 'Excellent' : avgReplicationTime < 500 ? 'Good' : 'Acceptable'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Operations</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWrites}</div>
            <p className="text-xs text-muted-foreground">
              Across {servers.length} replicas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Visualization Tabs */}
      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="quorum">Quorum</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="servers">Servers</TabsTrigger>
        </TabsList>

        {/* Statistics Tab */}
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Replication Success vs Failure</CardTitle>
              <CardDescription>Distribution of replication outcomes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={replicationSuccessData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {replicationSuccessData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Successful Replications</span>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="text-3xl font-bold text-green-600">{totalSuccessful}</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Failed Replications</span>
                      <XCircle className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="text-3xl font-bold text-red-600">{totalFailed}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Server Replication Statistics</CardTitle>
              <CardDescription>Writes and success rates per server</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={serverStatsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="writes" fill="#8B5CF6" name="Total Writes" />
                  <Bar dataKey="successful" fill="#10B981" name="Successful" />
                  <Bar dataKey="failed" fill="#EF4444" name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quorum Tab */}
        <TabsContent value="quorum" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quorum Achievement</CardTitle>
              <CardDescription>Two-Phase Commit quorum status</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={quorumData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="achieved" fill="#10B981" name="Quorum Achieved" />
                  <Bar dataKey="failed" fill="#EF4444" name="Quorum Failed" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {servers.map(server => {
              const data = consistencyData[server];
              const quorumSize = data?.quorum_size || 0;
              const totalReplicas = data?.total_replicas || 0;
              const achieved = data?.statistics?.quorum_achieved || 0;
              const failed = data?.statistics?.quorum_failed || 0;
              const achievementRate = achieved + failed > 0 ? (achieved / (achieved + failed)) * 100 : 0;

              return (
                <Card key={server}>
                  <CardHeader>
                    <CardTitle className="text-lg">{server.toUpperCase()}</CardTitle>
                    <CardDescription>Quorum: {quorumSize}/{totalReplicas}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Achievement Rate</span>
                        <span className="font-bold">{achievementRate.toFixed(1)}%</span>
                      </div>
                      <Progress value={achievementRate} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-muted-foreground">Achieved</div>
                        <div className="text-lg font-bold text-green-600">{achieved}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Failed</div>
                        <div className="text-lg font-bold text-red-600">{failed}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Average Replication Time per Server</CardTitle>
              <CardDescription>Latency in milliseconds</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={serverStatsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="replicationTime" 
                    stroke="#8B5CF6" 
                    strokeWidth={2}
                    name="Replication Time (ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Success Rate Comparison</CardTitle>
              <CardDescription>Percentage of successful replications</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={serverStatsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="successRate" fill="#10B981" name="Success Rate (%)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Servers Tab */}
        <TabsContent value="servers" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {servers.map(server => {
              const data = consistencyData[server];
              const stats = data?.statistics;

              return (
                <Card key={server}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{server.toUpperCase()}</CardTitle>
                        <CardDescription>
                          {stats?.consistency_level} • {stats?.replication_mode}
                        </CardDescription>
                      </div>
                      <Badge variant={stats?.success_rate > 90 ? "default" : "destructive"}>
                        {stats?.success_rate.toFixed(1)}% Success
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Total Writes</div>
                        <div className="text-2xl font-bold">{stats?.total_writes || 0}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Data Items</div>
                        <div className="text-2xl font-bold">{stats?.data_items || 0}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Pending Ops</div>
                        <div className="text-2xl font-bold">{stats?.pending_operations || 0}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Conflicts</div>
                        <div className="text-2xl font-bold">{stats?.conflicts_resolved || 0}</div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Avg Replication Time:</span>
                        <span className="font-semibold">{stats?.average_replication_time_ms.toFixed(2)}ms</span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-2">
                        <span className="text-muted-foreground">Operation History:</span>
                        <span className="font-semibold">{stats?.operation_history_size || 0} ops</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
