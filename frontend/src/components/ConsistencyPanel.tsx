import { SystemMetrics } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Activity, Database } from "lucide-react";

interface ConsistencyPanelProps {
  metrics: SystemMetrics;
}

export const ConsistencyPanel = ({ metrics }: ConsistencyPanelProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Consistency & Analytics</CardTitle>
        <CardDescription>Distributed data consistency and processing status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Consistency Gauge */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {metrics.consistency.isConsistent ? (
                <CheckCircle className="h-5 w-5 text-success" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <span className="font-semibold">Data Consistency</span>
            </div>
            <Badge variant={metrics.consistency.isConsistent ? "default" : "destructive"}>
              {metrics.consistency.score}%
            </Badge>
          </div>
          <Progress value={metrics.consistency.score} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {metrics.consistency.isConsistent
              ? "All replicas are synchronized"
              : "Replication in progress"}
          </p>
        </div>

        {/* MapReduce Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span className="font-semibold">MapReduce Job</span>
            </div>
            <Badge
              variant={
                metrics.mapReduce.status === "RUNNING"
                  ? "default"
                  : metrics.mapReduce.status === "COMPLETED"
                  ? "secondary"
                  : "outline"
              }
            >
              {metrics.mapReduce.status}
            </Badge>
          </div>
          {metrics.mapReduce.status === "RUNNING" && (
            <>
              <Progress value={metrics.mapReduce.progress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Processing: {metrics.mapReduce.progress}%
              </p>
            </>
          )}
        </div>

        {/* HDFS Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-accent" />
              <span className="font-semibold">HDFS Datanodes</span>
            </div>
            <Badge variant="outline">{metrics.hdfs.datanodeCount} Active</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Distributed file system operational
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
