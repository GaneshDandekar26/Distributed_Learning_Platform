import { ServerMetrics } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Crown, Shield } from "lucide-react";

interface ServerStateTableProps {
  servers: ServerMetrics[];
}

export const ServerStateTable = ({ servers }: ServerStateTableProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Server State & Roles</CardTitle>
        <CardDescription>Bully Election & Fault Tolerance Status</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Server ID</TableHead>
              <TableHead>Coordinator Role</TableHead>
              <TableHead>FT Role</TableHead>
              <TableHead>Health</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {servers.map((server) => (
              <TableRow key={server.serverId}>
                <TableCell className="font-medium">{server.serverId}</TableCell>
                <TableCell>
                  <Badge variant={server.coordinatorRole === "LEADER" ? "default" : "secondary"} className="gap-1">
                    {server.coordinatorRole === "LEADER" && <Crown className="h-3 w-3" />}
                    {server.coordinatorRole}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={server.ftRole === "PRIMARY" ? "default" : "outline"} className="gap-1">
                    {server.ftRole === "PRIMARY" && <Shield className="h-3 w-3" />}
                    {server.ftRole}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        server.isHealthy ? "bg-success" : "bg-destructive"
                      }`}
                    />
                    <span className="text-sm">{server.isHealthy ? "Healthy" : "Unhealthy"}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
