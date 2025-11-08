/**
 * MessagingPanel Component
 * Displays inter-server messages with Lamport timestamps and message flow visualization
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, Send, ArrowRight, Clock, TrendingUp, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MONITORING_URL = 'http://localhost:9005';

interface Message {
  type: string;
  message_type: string;
  sender: string;
  content: string;
  lamport_time: number;
  timestamp: number;
  datetime: string;
  direction: string;
}

interface MessageStats {
  server_id: string;
  total_sent: number;
  total_received: number;
  total_messages: number;
  log_file: string;
}

interface MessagesData {
  [key: string]: {
    server_id: string;
    messages: Message[];
    count: number;
  };
}

interface StatsData {
  [key: string]: MessageStats;
}

const MessagingPanel: React.FC = () => {
  const [messagesData, setMessagesData] = useState<MessagesData>({});
  const [statsData, setStatsData] = useState<StatsData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<string>('all');

  useEffect(() => {
    fetchMessagingData();
    const interval = setInterval(fetchMessagingData, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchMessagingData = async () => {
    try {
      const [messagesResponse, statsResponse] = await Promise.all([
        fetch(`${MONITORING_URL}/messages/all`),
        fetch(`${MONITORING_URL}/messages/stats`)
      ]);

      if (!messagesResponse.ok || !statsResponse.ok) {
        throw new Error('Failed to fetch messaging data');
      }

      const messages: MessagesData = await messagesResponse.json();
      const stats: StatsData = await statsResponse.json();

      setMessagesData(messages);
      setStatsData(stats);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching messaging data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const getAllMessages = (): Message[] => {
    const allMessages: Message[] = [];
    Object.values(messagesData).forEach(data => {
      if (data.messages) {
        allMessages.push(...data.messages);
      }
    });
    
    // Sort by Lamport timestamp
    return allMessages.sort((a, b) => a.lamport_time - b.lamport_time);
  };

  const getFilteredMessages = (): Message[] => {
    if (selectedServer === 'all') {
      return getAllMessages();
    }
    const serverData = messagesData[selectedServer];
    return serverData?.messages || [];
  };

  const getMessageFlowData = () => {
    const flowMap: { [key: string]: number } = {};
    
    getAllMessages().forEach(msg => {
      const flow = msg.direction === 'sent' 
        ? `${msg.sender} → Other` 
        : `Other → ${msg.sender}`;
      flowMap[flow] = (flowMap[flow] || 0) + 1;
    });

    return Object.entries(flowMap).map(([flow, count]) => ({
      flow,
      count,
      fill: flow.includes('→') ? '#3b82f6' : '#8b5cf6'
    }));
  };

  const getStatsChartData = () => {
    return Object.entries(statsData).map(([serverId, stats]) => ({
      server: serverId,
      sent: stats.total_sent,
      received: stats.total_received,
      total: stats.total_messages
    }));
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Inter-Server Messaging
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
            <MessageSquare className="h-5 w-5" />
            Inter-Server Messaging
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const filteredMessages = getFilteredMessages();
  const flowData = getMessageFlowData();
  const statsChartData = getStatsChartData();

  return (
    <div className="space-y-4">
      {/* Message Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(statsData).map(([serverId, stats]) => (
          <Card key={serverId} className="bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {serverId}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Sent:</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    <Send className="h-3 w-3 mr-1" />
                    {stats.total_sent}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Received:</span>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    <ArrowRight className="h-3 w-3 mr-1" />
                    {stats.total_received}
                  </Badge>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm font-medium">Total:</span>
                  <span className="text-lg font-bold text-indigo-600">
                    {stats.total_messages}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Message Statistics Chart */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Message Distribution
          </CardTitle>
          <CardDescription>Sent vs Received messages per server</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={statsChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="server" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="sent" fill="#10b981" name="Sent" />
              <Bar dataKey="received" fill="#3b82f6" name="Received" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Message Timeline */}
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Message Timeline
              </CardTitle>
              <CardDescription>Messages ordered by Lamport timestamp</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchMessagingData}
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
              <select
                className="px-3 py-1 border rounded text-sm"
                value={selectedServer}
                onChange={(e) => setSelectedServer(e.target.value)}
              >
                <option value="all">All Servers</option>
                {Object.keys(messagesData).map(serverId => (
                  <option key={serverId} value={serverId}>{serverId}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredMessages.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No messages yet</p>
            ) : (
              filteredMessages.slice(-20).reverse().map((msg, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-l-4 transition-all ${
                    msg.direction === 'sent'
                      ? 'bg-green-50 border-green-500 ml-4'
                      : 'bg-blue-50 border-blue-500 mr-4'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {msg.direction === 'sent' ? (
                        <Send className="h-4 w-4 text-green-600" />
                      ) : (
                        <ArrowRight className="h-4 w-4 text-blue-600" />
                      )}
                      <span className="font-bold text-sm">
                        {msg.direction === 'sent' ? 'Sent by' : 'Received by'} {msg.sender}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {msg.message_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                        <Clock className="h-3 w-3 mr-1" />
                        L:{msg.lamport_time}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-2 pl-6">{msg.content}</p>
                  <div className="flex items-center justify-between pl-6">
                    <span className="text-xs text-gray-500">
                      {new Date(msg.timestamp * 1000).toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {msg.direction === 'sent' ? '→' : '←'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Message Flow Visualization */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Message Flow Patterns
          </CardTitle>
          <CardDescription>Communication patterns between servers</CardDescription>
        </CardHeader>
        <CardContent>
          {flowData.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No message flow data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={flowData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="flow" type="category" width={120} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Implementation Details */}
      <Card className="w-full bg-gray-50">
        <CardHeader>
          <CardTitle className="text-sm">Implementation Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <h4 className="font-bold mb-2">Features:</h4>
              <ul className="space-y-1 text-gray-700">
                <li>✓ Lamport clock synchronization</li>
                <li>✓ TCP-based reliable messaging</li>
                <li>✓ Message acknowledgment</li>
                <li>✓ Persistent logging to /logs</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-2">Ports:</h4>
              <ul className="space-y-1 text-gray-700">
                <li>Messaging Port: 9200</li>
                <li>Protocol: TCP/IP</li>
                <li>Format: Pickle serialization</li>
                <li>Logs: /logs/messages_*.json</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MessagingPanel;
