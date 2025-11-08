/**
 * FTRoleMonitor Component
 * Displays Fault Tolerance roles, PRIMARY/BACKUP status, and failover events
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Activity, AlertTriangle, CheckCircle, Server, Zap } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const MONITORING_URL = 'http://localhost:9005';

interface FTRole {
  role: string;
  is_primary: boolean;
  status: string;
  error?: string;
}

interface FTRolesData {
  [key: string]: FTRole;
}

interface ElectionStatus {
  server_id: string;
  server_rank: number;
  current_leader: string | null;
  is_leader: boolean;
}

interface ElectionData {
  [key: string]: ElectionStatus;
}

interface ServerMetrics {
  status: string;
  lamport_time: number;
  role: string;
  is_primary: boolean;
}

const COLORS = {
  PRIMARY: '#10b981',
  BACKUP: '#3b82f6',
  UNKNOWN: '#6b7280'
};

const FTRoleMonitor: React.FC = () => {
  const [ftRoles, setFtRoles] = useState<FTRolesData>({});
  const [electionData, setElectionData] = useState<ElectionData>({});
  const [metricsData, setMetricsData] = useState<{ [key: string]: ServerMetrics }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFTData();
    const interval = setInterval(fetchFTData, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchFTData = async () => {
    try {
      const [rolesResponse, electionResponse, metricsResponse] = await Promise.all([
        fetch(`${MONITORING_URL}/ft/roles`),
        fetch(`${MONITORING_URL}/election/status`),
        fetch(`${MONITORING_URL}/metrics`)
      ]);

      if (!rolesResponse.ok || !electionResponse.ok || !metricsResponse.ok) {
        throw new Error('Failed to fetch FT data');
      }

      const roles: FTRolesData = await rolesResponse.json();
      const election: ElectionData = await electionResponse.json();
      const metrics = await metricsResponse.json();

      setFtRoles(roles);
      setElectionData(election);
      setMetricsData(metrics);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching FT data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const getRoleDistribution = () => {
    const distribution: { [key: string]: number } = {
      PRIMARY: 0,
      BACKUP: 0,
      UNKNOWN: 0
    };

    Object.values(ftRoles).forEach(role => {
      const roleType = role.role || 'UNKNOWN';
      distribution[roleType] = (distribution[roleType] || 0) + 1;
    });

    return Object.entries(distribution)
      .filter(([_, count]) => count > 0)
      .map(([role, count]) => ({
        name: role,
        value: count,
        fill: COLORS[role as keyof typeof COLORS] || COLORS.UNKNOWN
      }));
  };

  const getHealthyServersCount = () => {
    return Object.values(metricsData).filter(m => m.status === 'healthy').length;
  };

  const getTotalServers = () => {
    return Object.keys(ftRoles).length;
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Fault Tolerance Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Shield className="h-5 w-5" />
            Fault Tolerance Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const roleDistribution = getRoleDistribution();
  const healthyCount = getHealthyServersCount();
  const totalCount = getTotalServers();
  const primaryServer = Object.entries(ftRoles).find(([_, role]) => role.is_primary)?.[0];

  return (
    <div className="space-y-4">
      {/* FT Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Primary Server
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              {primaryServer ? (
                <>
                  <p className="text-3xl font-bold text-green-700">{primaryServer}</p>
                  <Badge className="mt-2 bg-green-600">
                    <Shield className="h-3 w-3 mr-1" />
                    ACTIVE PRIMARY
                  </Badge>
                </>
              ) : (
                <p className="text-gray-500">No primary server</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-600" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-700">
                {healthyCount}/{totalCount}
              </p>
              <p className="text-sm text-blue-600 mt-1">Healthy Servers</p>
              <Badge
                variant="outline"
                className={`mt-2 ${
                  healthyCount === totalCount
                    ? 'bg-green-100 text-green-800 border-green-300'
                    : 'bg-yellow-100 text-yellow-800 border-yellow-300'
                }`}
              >
                {healthyCount === totalCount ? 'All Systems Operational' : 'Degraded'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-600" />
              Failover Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-700">
                <Zap className="inline h-8 w-8" />
              </p>
              <p className="text-sm text-purple-600 mt-1">Ready</p>
              <Badge variant="outline" className="mt-2 bg-purple-100 text-purple-800 border-purple-300">
                Automatic Failover Enabled
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role Distribution Chart */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Distribution
          </CardTitle>
          <CardDescription>PRIMARY vs BACKUP servers</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={roleDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {roleDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Server Details Grid */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Server FT Status
          </CardTitle>
          <CardDescription>Detailed fault tolerance status for each server</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(ftRoles).map(([serverId, role]) => {
              const election = electionData[serverId];
              const metrics = metricsData[serverId];
              const isHealthy = metrics?.status === 'healthy';

              return (
                <div
                  key={serverId}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    role.is_primary
                      ? 'bg-green-50 border-green-400 shadow-lg'
                      : 'bg-blue-50 border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-lg">{serverId}</h3>
                    {isHealthy ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    )}
                  </div>

                  <div className="space-y-2">
                    {/* FT Role */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">FT Role:</span>
                      <Badge
                        className={
                          role.is_primary
                            ? 'bg-green-600'
                            : 'bg-blue-600'
                        }
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        {role.role}
                      </Badge>
                    </div>

                    {/* Election Status */}
                    {election && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Is Leader:</span>
                        <Badge variant={election.is_leader ? 'default' : 'outline'}>
                          {election.is_leader ? '👑 Yes' : 'No'}
                        </Badge>
                      </div>
                    )}

                    {/* Server Rank */}
                    {election && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Rank:</span>
                        <span className="font-bold">{election.server_rank}</span>
                      </div>
                    )}

                    {/* Health Status */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Health:</span>
                      <Badge
                        variant="outline"
                        className={
                          isHealthy
                            ? 'bg-green-100 text-green-800 border-green-300'
                            : 'bg-red-100 text-red-800 border-red-300'
                        }
                      >
                        {role.status || 'unknown'}
                      </Badge>
                    </div>

                    {/* Lamport Clock */}
                    {metrics && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-xs text-gray-600">Lamport Time:</span>
                        <span className="text-xs font-mono font-bold">
                          {metrics.lamport_time}
                        </span>
                      </div>
                    )}
                  </div>

                  {role.error && (
                    <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-700">
                      <AlertTriangle className="inline h-3 w-3 mr-1" />
                      {role.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Failover Mechanism Details */}
      <Card className="w-full bg-gray-50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Failover Mechanism
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <h4 className="font-bold mb-2">Heartbeat Protocol:</h4>
              <ul className="space-y-1 text-gray-700">
                <li>✓ PRIMARY sends heartbeats every 2s</li>
                <li>✓ BACKUP monitors heartbeats via UDP</li>
                <li>✓ 3 missed heartbeats trigger failover</li>
                <li>✓ Port: 9002 (UDP)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-2">Bully Election:</h4>
              <ul className="space-y-1 text-gray-700">
                <li>✓ Triggered on PRIMARY failure</li>
                <li>✓ Highest rank becomes leader</li>
                <li>✓ UDP-based election messages</li>
                <li>✓ Port: 9100 (UDP)</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Current Configuration:</strong> {primaryServer} is PRIMARY, 
              all others are BACKUP. On PRIMARY failure, BACKUP with highest rank 
              automatically promotes to PRIMARY via Bully Election.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FTRoleMonitor;
