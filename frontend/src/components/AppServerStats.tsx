import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ServerMetrics } from "@/types";
import { Server, Cpu, Activity } from "lucide-react";

interface AppServerStatsProps {
  servers: ServerMetrics[];
}

export const AppServerStats = ({ servers }: AppServerStatsProps) => {
  const totalConnections = servers.reduce((sum, s) => sum + s.activeConnections, 0);
  const healthyServers = servers.filter(s => s.isHealthy).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          Application Server Statistics
        </CardTitle>
        <CardDescription>
          TCP socket server with thread-based client handling and Lamport clock synchronization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
              <div className="flex items-center gap-2 mb-2">
                <Server className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-muted-foreground">Healthy Servers</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {healthyServers} / {servers.length}
              </div>
            </div>
            
            <div className="p-4 border rounded-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">Total Active Connections</span>
              </div>
              <div className="text-2xl font-bold text-green-600">{totalConnections}</div>
            </div>
            
            <div className="p-4 border rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-muted-foreground">Load Distribution</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {healthyServers > 0 ? Math.round(totalConnections / healthyServers) : 0} avg
              </div>
            </div>
          </div>

          {/* Server Details Table */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Server className="h-4 w-4" />
              Server Details
            </h4>
            <div className="space-y-3">
              {servers.map((server) => (
                <div 
                  key={server.serverId} 
                  className={`p-4 border rounded-lg transition-all ${
                    server.isHealthy 
                      ? 'border-green-200 bg-green-50/50 dark:bg-green-950/20' 
                      : 'border-red-200 bg-red-50/50 dark:bg-red-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        server.isHealthy ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                      }`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-semibold text-base">{server.serverId}</h5>
                          {server.ftRole === 'PRIMARY' && (
                            <span className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded-full font-semibold">
                              PRIMARY
                            </span>
                          )}
                          {server.ftRole === 'BACKUP' && (
                            <span className="text-xs px-2 py-0.5 bg-gray-500 text-white rounded-full">
                              BACKUP
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Status: {server.isHealthy ? 'Healthy' : 'Down'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-6 text-right">
                      <div>
                        <div className="text-xs text-muted-foreground">Active Connections</div>
                        <div className="text-lg font-bold text-blue-600">
                          {server.activeConnections}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-xs text-muted-foreground">Lamport Clock</div>
                        <div className="text-lg font-bold text-purple-600">
                          {server.lamportClock}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-xs text-muted-foreground">TCP Port</div>
                        <div className="text-lg font-bold text-gray-600">
                          {parseInt(server.serverId.replace(/\D/g, '')) + 9000}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Connection Load Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Connection Load</span>
                      <span>
                        {totalConnections > 0 
                          ? Math.round((server.activeConnections / totalConnections) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                        style={{ 
                          width: totalConnections > 0 
                            ? `${(server.activeConnections / totalConnections) * 100}%`
                            : '0%'
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Implementation Details */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
            <h4 className="text-sm font-semibold mb-2">TCP Application Server Features</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span><strong>Thread-based handling:</strong> Each client connection spawns a dedicated thread for concurrent processing</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span><strong>Lamport clock sync:</strong> Increments logical clock on state-modifying requests (create, update, delete)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span><strong>RMI support:</strong> Handles Remote Method Invocation requests with timestamp acknowledgments</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span><strong>Docker compatible:</strong> Binds to 0.0.0.0 for container networking</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span><strong>Connection tracking:</strong> Real-time monitoring of active connections and total requests</span>
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
