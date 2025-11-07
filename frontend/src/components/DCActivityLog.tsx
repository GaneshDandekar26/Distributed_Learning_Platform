import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Clock, Network, Shield } from "lucide-react";

interface DCEvent {
  id: string;
  timestamp: Date;
  type: 'RMI' | 'LAMPORT' | 'FAULT_TOLERANCE';
  serverId: string;
  message: string;
  details?: any;
}

interface DCActivityLogProps {
  servers: any[];
}

export const DCActivityLog = ({ servers }: DCActivityLogProps) => {
  const [events, setEvents] = useState<DCEvent[]>([]);
  const [prevServers, setPrevServers] = useState<any[]>([]);

  useEffect(() => {
    // Detect changes and create events
    const newEvents: DCEvent[] = [];

    servers.forEach((server, index) => {
      const prevServer = prevServers[index];
      
      if (prevServer) {
        // Detect Lamport Clock changes
        if (server.lamportClock !== prevServer.lamportClock) {
          newEvents.push({
            id: `lamport-${Date.now()}-${server.serverId}`,
            timestamp: new Date(),
            type: 'LAMPORT',
            serverId: server.serverId,
            message: `Clock incremented from ${prevServer.lamportClock} to ${server.lamportClock}`,
            details: { old: prevServer.lamportClock, new: server.lamportClock }
          });
        }

        // Detect Fault Tolerance role changes
        if (server.ftRole !== prevServer.ftRole) {
          newEvents.push({
            id: `ft-${Date.now()}-${server.serverId}`,
            timestamp: new Date(),
            type: 'FAULT_TOLERANCE',
            serverId: server.serverId,
            message: `Role changed from ${prevServer.ftRole} to ${server.ftRole}`,
            details: { old: prevServer.ftRole, new: server.ftRole }
          });
        }

        // Detect health changes (server failure/recovery)
        if (server.isHealthy !== prevServer.isHealthy) {
          const status = server.isHealthy ? 'recovered' : 'failed';
          newEvents.push({
            id: `health-${Date.now()}-${server.serverId}`,
            timestamp: new Date(),
            type: 'FAULT_TOLERANCE',
            serverId: server.serverId,
            message: `Server ${status}! ${server.isHealthy ? 'Back online' : 'Heartbeat lost'}`,
            details: { healthy: server.isHealthy }
          });
        }

        // Detect active connections changes (RMI activity indicator)
        if (server.activeConnections !== prevServer.activeConnections) {
          const diff = server.activeConnections - prevServer.activeConnections;
          if (diff > 0) {
            newEvents.push({
              id: `rmi-${Date.now()}-${server.serverId}`,
              timestamp: new Date(),
              type: 'RMI',
              serverId: server.serverId,
              message: `${diff} new request(s) processed via RMI`,
              details: { count: server.activeConnections }
            });
          }
        }
      }
    });

    if (newEvents.length > 0) {
      setEvents(prev => [...newEvents, ...prev].slice(0, 50)); // Keep last 50 events
    }

    setPrevServers(servers);
  }, [servers]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'RMI':
        return <Network className="h-4 w-4 text-blue-500" />;
      case 'LAMPORT':
        return <Clock className="h-4 w-4 text-green-500" />;
      case 'FAULT_TOLERANCE':
        return <Shield className="h-4 w-4 text-orange-500" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'RMI':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'LAMPORT':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'FAULT_TOLERANCE':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          DC Activity Log
        </CardTitle>
        <CardDescription>
          Real-time events from RMI calls, Lamport clock updates, and fault tolerance protocol
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Activity className="h-12 w-12 mb-2 opacity-20" />
              <p className="text-sm">Waiting for DC activity...</p>
              <p className="text-xs mt-1">Perform operations or kill servers to see events</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="mt-0.5">{getEventIcon(event.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={getEventColor(event.type)}>
                        {event.type}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground">
                        {event.serverId}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {event.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm">{event.message}</p>
                    {event.details && event.type === 'FAULT_TOLERANCE' && event.details.new === 'PRIMARY' && (
                      <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-950 rounded text-xs">
                        ⚠️ <strong>FAILOVER DETECTED:</strong> This server has been promoted to PRIMARY
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1 text-blue-600">
            <Network className="h-3 w-3" />
            <span>RMI: Remote method calls</span>
          </div>
          <div className="flex items-center gap-1 text-green-600">
            <Clock className="h-3 w-3" />
            <span>Lamport: Clock updates</span>
          </div>
          <div className="flex items-center gap-1 text-orange-600">
            <Shield className="h-3 w-3" />
            <span>FT: Role changes & failures</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
