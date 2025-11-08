import { useEffect, useRef, useState } from "react";
import { useWhiteboardSocket } from "@/hooks/useSocket";
import { authService } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Palette, Eraser, Trash2, Download, Users, Lock, Unlock, Plus, LogIn } from "lucide-react";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

interface WhiteboardCanvasProps {
  isReadOnly?: boolean;
}

interface WhiteboardSession {
  id: string;
  name: string;
  creator_name: string;
  created_at: string;
  participants_count: number;
  is_creator: boolean;
  is_active: boolean;
}

export const WhiteboardCanvas = ({ isReadOnly = false }: WhiteboardCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(2);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  
  const [currentSession, setCurrentSession] = useState<WhiteboardSession | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [sessionPassword, setSessionPassword] = useState("");
  const [joinSessionId, setJoinSessionId] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [userSessions, setUserSessions] = useState<WhiteboardSession[]>([]);
  
  const user = authService.getCurrentUser();
  const room = currentSession?.id || "";
  const username = user?.name || "Anonymous";
  
  const { drawEvents, sendDrawEvent, isConnected, serverId } = useWhiteboardSocket(room, username);

  const fetchUserSessions = async () => {
    try {
      const response = await fetch(`${API_URL}/whiteboard/sessions?user_id=${user?.id}`);
      const data = await response.json();
      if (data.success) {
        setUserSessions(data.sessions);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserSessions();
    }
  }, []);

  const createSession = async () => {
    if (!sessionName || !sessionPassword || !user) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/whiteboard/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sessionName,
          password: sessionPassword,
          creator_id: user.id,
          creator_name: user.name
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success("Whiteboard session created!");
        setCurrentSession({
          ...data.session,
          participants_count: 1,
          is_creator: true,
          is_active: true
        });
        setShowCreateDialog(false);
        setSessionName("");
        setSessionPassword("");
        fetchUserSessions();
      } else {
        toast.error(data.error || "Failed to create session");
      }
    } catch (error) {
      toast.error("Failed to create session");
      console.error(error);
    }
  };

  const joinSession = async () => {
    if (!joinSessionId || !joinPassword || !user) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/whiteboard/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: joinSessionId,
          password: joinPassword,
          user_id: user.id,
          username: user.name
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success("Joined whiteboard session!");
        setCurrentSession({
          ...data.session,
          is_creator: false,
          is_active: true
        });
        setShowJoinDialog(false);
        setJoinSessionId("");
        setJoinPassword("");
        fetchUserSessions();
      } else {
        toast.error(data.error || "Failed to join session");
      }
    } catch (error) {
      toast.error("Failed to join session");
      console.error(error);
    }
  };

  const selectSession = (session: WhiteboardSession) => {
    setCurrentSession(session);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [currentSession]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !drawEvents.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const latestEvent = drawEvents[drawEvents.length - 1];
    
    if (latestEvent.type === 'clear') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const points = latestEvent.points;
    if (points && points.length > 1) {
      ctx.strokeStyle = latestEvent.color;
      ctx.lineWidth = latestEvent.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      
      ctx.stroke();
    }
  }, [drawEvents]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isReadOnly || !currentSession) return;
    
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isReadOnly || !currentSession) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const color = tool === 'eraser' ? '#ffffff' : currentColor;
    ctx.strokeStyle = color;
    ctx.lineWidth = tool === 'eraser' ? 20 : lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentSession) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    const color = tool === 'eraser' ? '#ffffff' : currentColor;
    sendDrawEvent({
      type: tool === 'eraser' ? 'erase' : 'draw',
      points: [[endX, endY]],
      color: color,
      width: tool === 'eraser' ? 20 : lineWidth
    });

    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (currentSession && !isReadOnly) {
      sendDrawEvent({
        type: 'clear'
      });
    }
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `whiteboard-${currentSession?.name || 'drawing'}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const colors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

  return (
    <div className="space-y-4">
      {!currentSession && (
        <Card>
          <CardHeader>
            <CardTitle>Whiteboard Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button className="flex-1">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Session
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Whiteboard Session</DialogTitle>
                    <DialogDescription>
                      Create a new whiteboard session with a password for secure collaboration
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="session-name">Session Name</Label>
                      <Input
                        id="session-name"
                        value={sessionName}
                        onChange={(e) => setSessionName(e.target.value)}
                        placeholder="e.g., Math Class Session"
                      />
                    </div>
                    <div>
                      <Label htmlFor="session-password">Password</Label>
                      <Input
                        id="session-password"
                        type="password"
                        value={sessionPassword}
                        onChange={(e) => setSessionPassword(e.target.value)}
                        placeholder="Secure password"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={createSession}>Create</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-1">
                    <LogIn className="h-4 w-4 mr-2" />
                    Join Session
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Join Whiteboard Session</DialogTitle>
                    <DialogDescription>
                      Enter the session ID and password to join
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="join-session-id">Session ID</Label>
                      <Input
                        id="join-session-id"
                        value={joinSessionId}
                        onChange={(e) => setJoinSessionId(e.target.value)}
                        placeholder="e.g., abc123"
                      />
                    </div>
                    <div>
                      <Label htmlFor="join-password">Password</Label>
                      <Input
                        id="join-password"
                        type="password"
                        value={joinPassword}
                        onChange={(e) => setJoinPassword(e.target.value)}
                        placeholder="Session password"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={joinSession}>Join</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {userSessions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Your Sessions</h4>
                <div className="space-y-2">
                  {userSessions.map((session) => (
                    <Button
                      key={session.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => selectSession(session)}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="text-left">
                          <div className="font-medium">{session.name}</div>
                          <div className="text-xs text-muted-foreground">
                            ID: {session.id} • {session.is_creator ? 'Creator' : 'Participant'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            <Users className="h-3 w-3 mr-1" />
                            {session.participants_count}
                          </Badge>
                          {session.is_active ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="destructive">Closed</Badge>
                          )}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {currentSession && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {currentSession.name}
                  {isConnected ? (
                    <Badge variant="default" className="text-xs">
                      <Unlock className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">
                      <Lock className="h-3 w-3 mr-1" />
                      Disconnected
                    </Badge>
                  )}
                </CardTitle>
                <div className="text-xs text-muted-foreground mt-1">
                  Session ID: <span className="font-mono font-semibold">{currentSession.id}</span> • 
                  Server: {serverId || 'N/A'} • 
                  Lamport Clock Ordering
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentSession(null)}>
                Exit Session
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isReadOnly && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={tool === 'pen' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTool('pen')}
                >
                  <Palette className="h-4 w-4 mr-2" />
                  Pen
                </Button>
                <Button
                  variant={tool === 'eraser' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTool('eraser')}
                >
                  <Eraser className="h-4 w-4 mr-2" />
                  Eraser
                </Button>
                
                {tool === 'pen' && (
                  <div className="flex gap-1 border rounded p-1">
                    {colors.map((color) => (
                      <button
                        key={color}
                        className={`w-6 h-6 rounded border-2 ${
                          currentColor === color ? 'border-primary' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setCurrentColor(color)}
                      />
                    ))}
                  </div>
                )}
                
                {tool === 'pen' && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Width:</Label>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={lineWidth}
                      onChange={(e) => setLineWidth(Number(e.target.value))}
                      className="w-16 h-8"
                    />
                  </div>
                )}
                
                <div className="flex-1" />
                
                <Button variant="outline" size="sm" onClick={clearCanvas}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
                <Button variant="outline" size="sm" onClick={downloadCanvas}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden bg-white" style={{ height: '600px' }}>
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>

            {isReadOnly && (
              <div className="text-center text-sm text-muted-foreground">
                View-only mode - Drawing is disabled
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
