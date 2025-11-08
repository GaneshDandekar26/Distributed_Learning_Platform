import { useEffect, useRef, useState } from "react";
import { useWhiteboardSocket, useChatSocket } from "@/hooks/useSocket";
import { authService } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Palette, Eraser, Trash2, Download, Send, MessageSquare, Wifi, WifiOff, Plus, LogIn, Users } from "lucide-react";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

interface WhiteboardWithChatProps {
  isReadOnly?: boolean;
}

interface Session {
  id: string;
  name: string;
  creator_name: string;
  participants_count: number;
}

export const WhiteboardWithChat = ({ isReadOnly = false }: WhiteboardWithChatProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(2);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [drawingPath, setDrawingPath] = useState<number[][]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  // Session management
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [sessionPassword, setSessionPassword] = useState("");
  const [joinSessionId, setJoinSessionId] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [availableSessions, setAvailableSessions] = useState<Session[]>([]);
  
  const user = authService.getCurrentUser();
  const username = user?.name || "Anonymous";
  const userId = user?.id || "anonymous";
  
  // Debug: Log current user
  useEffect(() => {
    console.log("WhiteboardWithChat - Current User:", { username, userId, fullUser: user });
  }, [username, userId, user]);
  
  // Socket connections - only connect when session is active
  const room = currentSession?.id || "";
  const { drawEvents, sendDrawEvent, isConnected: whiteboardConnected, serverId: whiteboardServer } = useWhiteboardSocket(room, username);
  const { messages, sendMessage, typingUsers, sendTyping, isConnected: chatConnected, serverId: chatServer } = useChatSocket(room, username);

  // Load available sessions
  useEffect(() => {
    if (!isReadOnly) return; // Only students need to see available sessions
    loadAvailableSessions();
  }, [isReadOnly]);

  const loadAvailableSessions = async () => {
    try {
      const response = await fetch(`${API_URL}/whiteboard/sessions?user_id=${userId}`);
      const data = await response.json();
      if (data.success) {
        setAvailableSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const createSession = async () => {
    if (!sessionName.trim()) {
      toast.error("Session name required");
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/whiteboard/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: sessionName,
          password: sessionPassword,
          user_id: userId,
          creator_name: username
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCurrentSession({
          id: data.session_id,
          name: sessionName,
          creator_name: username,
          participants_count: 1
        });
        setShowCreateDialog(false);
        setSessionName("");
        setSessionPassword("");
        toast.success(`Session created: ${data.session_id}`);
      } else {
        toast.error(data.message || "Failed to create session");
      }
    } catch (error) {
      console.error('Create session error:', error);
      toast.error("Network error");
    }
  };

  const joinSession = async (sessionId?: string) => {
    const idToJoin = sessionId || joinSessionId;
    
    if (!idToJoin.trim()) {
      toast.error("Session ID required");
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/whiteboard/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: idToJoin,
          password: joinPassword,
          user_id: userId
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCurrentSession({
          id: idToJoin,
          name: data.session_name || idToJoin,
          creator_name: data.creator_name || "Unknown",
          participants_count: 1
        });
        setShowJoinDialog(false);
        setJoinSessionId("");
        setJoinPassword("");
        toast.success(`Joined session: ${idToJoin}`);
      } else {
        toast.error(data.message || "Failed to join session");
      }
    } catch (error) {
      console.error('Join session error:', error);
      toast.error("Network error");
    }
  };

  const leaveSession = () => {
    setCurrentSession(null);
    toast.info("Left session");
  };

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Initialize canvas with proper dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container - use clientWidth/Height for accuracy
    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      // Reset canvas with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    updateCanvasSize();

    // Handle window resize
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Render incoming draw events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !drawEvents.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const latestEvent = drawEvents[drawEvents.length - 1];
    
    if (latestEvent.type === 'clear') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      toast.info('Canvas cleared by ' + (latestEvent.username || 'someone'));
      return;
    }

    const points = latestEvent.points;
    if (points && points.length > 0) {
      ctx.strokeStyle = latestEvent.color || '#000000';
      ctx.lineWidth = latestEvent.width || 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (points.length === 1) {
        ctx.beginPath();
        ctx.arc(points[0][0], points[0][1], ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i][0], points[i][1]);
        }
        
        ctx.stroke();
      }
    }
  }, [drawEvents]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isReadOnly) {
      toast.error("View-only mode");
      return;
    }
    
    if (!whiteboardConnected) {
      toast.error("Not connected");
      return;
    }
    
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setDrawingPath([[x, y]]);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isReadOnly) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setDrawingPath(prev => [...prev, [x, y]]);

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

  const stopDrawing = () => {
    if (!isDrawing) return;
    
    if (drawingPath.length > 0 && whiteboardConnected) {
      const color = tool === 'eraser' ? '#ffffff' : currentColor;
      
      sendDrawEvent({
        type: tool === 'eraser' ? 'erase' : 'draw',
        points: drawingPath,
        color: color,
        width: tool === 'eraser' ? 20 : lineWidth
      });
    }

    setIsDrawing(false);
    setDrawingPath([]);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!isReadOnly && whiteboardConnected) {
      sendDrawEvent({ type: 'clear' });
      toast.success('Canvas cleared');
    }
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    toast.success('Downloaded');
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    if (!chatConnected) {
      toast.error("Not connected");
      return;
    }
    
    sendMessage(chatMessage);
    setChatMessage("");
    setIsTyping(false);
    sendTyping(false);
  };

  const handleChatTyping = (value: string) => {
    setChatMessage(value);
    
    if (value && !isTyping && chatConnected) {
      setIsTyping(true);
      sendTyping(true);
    } else if (!value && isTyping) {
      setIsTyping(false);
      sendTyping(false);
    }
  };

  const colors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

  // Session Manager UI
  if (!currentSession) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-center">Whiteboard Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isReadOnly ? (
              // Teacher: Create Session
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">Create a new whiteboard session for your students</p>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <Button onClick={() => setShowCreateDialog(true)} size="lg" className="w-full max-w-md">
                    <Plus className="mr-2 h-5 w-5" />
                    Create New Session
                  </Button>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Whiteboard Session</DialogTitle>
                      <DialogDescription>Create a new session for collaborative whiteboard</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Session Name</Label>
                        <Input
                          value={sessionName}
                          onChange={(e) => setSessionName(e.target.value)}
                          placeholder="e.g., Math Class"
                        />
                      </div>
                      <div>
                        <Label>Password (optional)</Label>
                        <Input
                          type="password"
                          value={sessionPassword}
                          onChange={(e) => setSessionPassword(e.target.value)}
                          placeholder="Leave empty for no password"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                      <Button onClick={createSession}>Create Session</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              // Student: Join Session
              <div className="space-y-6">
                <div className="text-center space-y-4">
                  <p className="text-muted-foreground">Join a whiteboard session with Session ID</p>
                  <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
                    <Button onClick={() => setShowJoinDialog(true)} size="lg" className="w-full max-w-md">
                      <LogIn className="mr-2 h-5 w-5" />
                      Join Session
                    </Button>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Join Whiteboard Session</DialogTitle>
                        <DialogDescription>Enter the session ID provided by your teacher</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Session ID</Label>
                          <Input
                            value={joinSessionId}
                            onChange={(e) => setJoinSessionId(e.target.value)}
                            placeholder="Enter 8-character session ID"
                            maxLength={8}
                          />
                        </div>
                        <div>
                          <Label>Password (if required)</Label>
                          <Input
                            type="password"
                            value={joinPassword}
                            onChange={(e) => setJoinPassword(e.target.value)}
                            placeholder="Enter password"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowJoinDialog(false)}>Cancel</Button>
                        <Button onClick={() => joinSession()}>Join Session</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {availableSessions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Available Sessions</h3>
                    <div className="space-y-2">
                      {availableSessions.map((session) => (
                        <Card key={session.id} className="p-4 hover:bg-accent cursor-pointer transition-colors" onClick={() => {
                          setJoinSessionId(session.id);
                          setShowJoinDialog(true);
                        }}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{session.name}</p>
                              <p className="text-sm text-muted-foreground">by {session.creator_name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                <Users className="h-3 w-3 mr-1" />
                                {session.participants_count}
                              </Badge>
                              <Button size="sm" onClick={(e) => {
                                e.stopPropagation();
                                joinSession(session.id);
                              }}>
                                Join
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main Whiteboard & Chat UI (when session is active)
  return (
    <div className="space-y-4">
      {/* Session Header */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <p className="font-semibold">{currentSession.name}</p>
                <p className="text-xs text-muted-foreground">Session ID: {currentSession.id}</p>
              </div>
              <Badge variant={whiteboardConnected && chatConnected ? "default" : "destructive"}>
                {whiteboardConnected && chatConnected ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
                {whiteboardConnected && chatConnected ? "Connected" : "Connecting..."}
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={leaveSession}>Leave Session</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-4">
        {/* Whiteboard - Left Side (8 columns) */}
        <div className="col-span-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Collaborative Whiteboard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isReadOnly && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant={tool === 'pen' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTool('pen')}
                    disabled={!whiteboardConnected}
                  >
                    <Palette className="h-4 w-4 mr-2" />
                    Pen
                  </Button>
                  <Button
                    variant={tool === 'eraser' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTool('eraser')}
                    disabled={!whiteboardConnected}
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
                          disabled={!whiteboardConnected}
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
                        disabled={!whiteboardConnected}
                      />
                    </div>
                  )}
                  
                  <div className="flex-1" />
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearCanvas}
                    disabled={!whiteboardConnected}
                  >
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
                  View-only mode
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chat - Right Side (4 columns) */}
        <div className="col-span-4">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5" />
                Chat
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-4 pt-0 space-y-4">
              <ScrollArea className="flex-1 pr-4" style={{ height: '500px' }}>
                <div ref={chatScrollRef} className="space-y-3">
                  {messages.length === 0 && (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      No messages yet
                    </div>
                  )}
                  
                  {messages.map((msg, idx) => {
                    const isMyMessage = msg.username === username;
                    console.log(`Message ${idx}: sender="${msg.username}", current="${username}", isMyMessage=${isMyMessage}`);
                    return (
                      <div
                        key={`${msg.username}-${msg.lamport_time}-${idx}`}
                        className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] p-3 rounded-lg ${
                            isMyMessage
                              ? 'bg-primary text-primary-foreground rounded-br-none'
                              : 'bg-muted text-foreground rounded-bl-none'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1 gap-3">
                            <span className="text-xs font-semibold">
                              {isMyMessage ? 'You' : msg.username}
                            </span>
                            <span className="text-xs opacity-70">
                              {msg.lamport_time ? `#${msg.lamport_time}` : ''}
                            </span>
                          </div>
                          <p className="text-sm break-words">{msg.message}</p>
                        </div>
                      </div>
                    );
                  })}
                  
                  {typingUsers.length > 0 && typingUsers.filter(u => u !== username).length > 0 && (
                    <div className="flex justify-start">
                      <div className="text-xs text-muted-foreground italic px-2 py-1 bg-muted/50 rounded">
                        {typingUsers.filter(u => u !== username).join(', ')} typing...
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Input
                  value={chatMessage}
                  onChange={(e) => handleChatTyping(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={chatConnected ? "Type..." : "Connecting..."}
                  disabled={!chatConnected}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!chatConnected || !chatMessage.trim()}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
