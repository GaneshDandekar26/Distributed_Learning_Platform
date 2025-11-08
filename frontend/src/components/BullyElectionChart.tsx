/**
 * BullyElectionChart Component
 * Displays Bully Election status, current leader, election history, and server rankings
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Users, TrendingUp, Activity, Clock, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

const MONITORING_URL = 'http://localhost:9005';

interface ElectionStatus {
  server_id: string;
  server_rank: number;
  current_leader: string | null;
  is_leader: boolean;
  election_in_progress: boolean;
  election_history: ElectionEvent[];
}

interface ElectionEvent {
  timestamp: number;
  event_type: string;
  server: string;
  current_leader: string | null;
}

interface ElectionData {
  [key: string]: ElectionStatus;
}

const BullyElectionChart: React.FC = () => {
  const [electionData, setElectionData] = useState<ElectionData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLeader, setCurrentLeader] = useState<string | null>(null);
  const [electionHistory, setElectionHistory] = useState<ElectionEvent[]>([]);

  useEffect(() => {
    fetchElectionStatus();
    const interval = setInterval(fetchElectionStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchElectionStatus = async () => {
    try {
      const response = await fetch(`${MONITORING_URL}/election/status`);
      if (!response.ok) throw new Error('Failed to fetch election status');
      
      const data: ElectionData = await response.json();
      setElectionData(data);
      
      // Determine current leader
      const leader = Object.values(data).find(status => status.is_leader);
      setCurrentLeader(leader?.server_id || null);
      
      // Aggregate election history from all servers
      const allHistory: ElectionEvent[] = [];
      Object.values(data).forEach(status => {
        if (status.election_history) {
          allHistory.push(...status.election_history);
        }
      });
      
      // Sort by timestamp and remove duplicates
      const uniqueHistory = allHistory
        .sort((a, b) => b.timestamp - a.timestamp)
        .filter((event, index, self) => 
          index === self.findIndex(e => 
            e.timestamp === event.timestamp && e.event_type === event.event_type
          )
        )
        .slice(0, 10);
      
      setElectionHistory(uniqueHistory);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching election status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const getServerRankData = () => {
    return Object.entries(electionData).map(([serverId, status]) => ({
      name: serverId,
      rank: status.server_rank,
      isLeader: status.is_leader,
      fill: status.is_leader ? '#fbbf24' : '#3b82f6'
    })).sort((a, b) => b.rank - a.rank);
  };

  const getElectionHistoryData = () => {
    return electionHistory.slice(0, 8).map((event, index) => ({
      time: new Date(event.timestamp * 1000).toLocaleTimeString(),
      eventType: event.event_type,
      server: event.server,
      value: electionHistory.length - index
    }));
  };

  const getEventTypeColor = (eventType: string) => {
    const colors: { [key: string]: string } = {
      'ELECTION_INITIATED': 'bg-blue-500',
      'COORDINATOR_ANNOUNCED': 'bg-green-500',
      'BECAME_COORDINATOR': 'bg-yellow-500',
      'OK_RECEIVED': 'bg-purple-500'
    };
    return colors[eventType] || 'bg-gray-500';
  };

  const getEventTypeLabel = (eventType: string) => {
    const labels: { [key: string]: string } = {
      'ELECTION_INITIATED': 'Election Started',
      'COORDINATOR_ANNOUNCED': 'Leader Announced',
      'BECAME_COORDINATOR': 'Became Leader',
      'OK_RECEIVED': 'OK Response'
    };
    return labels[eventType] || eventType;
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Bully Election Status
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
            <Crown className="h-5 w-5" />
            Bully Election Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const serverRankData = getServerRankData();
  const historyData = getElectionHistoryData();
  const electionInProgress = Object.values(electionData).some(s => s.election_in_progress);

  return (
    <div className="space-y-4">
      {/* Current Leader Card */}
      <Card className="w-full bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-yellow-600" />
            Current Leader
          </CardTitle>
          <CardDescription>Elected via Bully Algorithm</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentLeader ? (
                <>
                  <Award className="h-12 w-12 text-yellow-600" />
                  <div>
                    <p className="text-3xl font-bold text-yellow-900">{currentLeader}</p>
                    <p className="text-sm text-yellow-700">
                      Rank: {electionData[currentLeader]?.server_rank || 'N/A'}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-yellow-700">No leader elected yet</p>
              )}
            </div>
            {electionInProgress && (
              <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                <Activity className="h-3 w-3 mr-1 animate-pulse" />
                Election in Progress
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Server Rankings */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Server Rankings
          </CardTitle>
          <CardDescription>Higher rank = higher priority in election</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={serverRankData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: 'Rank', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 border rounded shadow-lg">
                        <p className="font-bold">{data.name}</p>
                        <p>Rank: {data.rank}</p>
                        {data.isLeader && (
                          <Badge className="mt-1 bg-yellow-500">
                            <Crown className="h-3 w-3 mr-1" />
                            Current Leader
                          </Badge>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="rank" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Election History */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Election Events
          </CardTitle>
          <CardDescription>Last 10 election-related events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {electionHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No election events yet</p>
            ) : (
              electionHistory.map((event, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${getEventTypeColor(event.event_type)}`}></div>
                    <div>
                      <p className="font-medium text-sm">{getEventTypeLabel(event.event_type)}</p>
                      <p className="text-xs text-gray-600">
                        Server: <span className="font-mono">{event.server}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {new Date(event.timestamp * 1000).toLocaleTimeString()}
                    </p>
                    {event.current_leader && (
                      <p className="text-xs text-yellow-600 font-medium">
                        Leader: {event.current_leader}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Server Status Grid */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Server Election Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(electionData).map(([serverId, status]) => (
              <div
                key={serverId}
                className={`p-4 rounded-lg border-2 transition-all ${
                  status.is_leader
                    ? 'bg-yellow-50 border-yellow-400 shadow-lg'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg">{serverId}</h3>
                  {status.is_leader && (
                    <Crown className="h-5 w-5 text-yellow-600" />
                  )}
                </div>
                <div className="space-y-1 text-sm">
                  <p className="flex justify-between">
                    <span className="text-gray-600">Rank:</span>
                    <span className="font-bold">{status.server_rank}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <Badge
                      variant={status.is_leader ? 'default' : 'secondary'}
                      className={status.is_leader ? 'bg-yellow-500' : ''}
                    >
                      {status.is_leader ? 'LEADER' : 'FOLLOWER'}
                    </Badge>
                  </p>
                  {status.current_leader && (
                    <p className="flex justify-between">
                      <span className="text-gray-600">Knows Leader:</span>
                      <span className="font-mono text-xs">{status.current_leader}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BullyElectionChart;
