import { useState, useRef, useEffect } from "react";
import { useChatSocket } from "../hooks/useSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, Clock, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  room: string;
  username: string;
  userRole: string;
}

export const ChatPanel = ({ room, username, userRole }: ChatPanelProps) => {
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { messages, sendMessage, typingUsers, sendTyping, isConnected, serverId } = useChatSocket(room, username);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (newMessage.trim() && isConnected) {
      sendMessage(newMessage);
      setNewMessage("");
      setIsTyping(false);
      sendTyping(false);
    }
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);
    
    if (value && !isTyping) {
      setIsTyping(true);
      sendTyping(true);
    } else if (!value && isTyping) {
      setIsTyping(false);
      sendTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Real-Time Chat</h3>
            <p className="text-xs text-muted-foreground">
              Lamport Timestamps • {isConnected ? `Server: ${serverId}` : 'Disconnected'}
            </p>
          </div>
          {isConnected ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={message.id || index}
              className={cn(
                "flex flex-col gap-1 p-3 rounded-lg",
                message.username === username ? "bg-primary/10 ml-auto max-w-[80%]" : "bg-muted max-w-[80%]"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{message.username}</span>
                <Badge variant={message.username === username ? "default" : "secondary"} className="text-xs">
                  {message.username === username ? userRole : 'user'}
                </Badge>
              </div>
              <p className="text-sm">{message.message}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <Clock className="h-3 w-3" />
                <span>LT: {message.lamport_time}</span>
                <span>•</span>
                <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
          {typingUsers.length > 0 && (
            <div className="text-xs text-muted-foreground italic">
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your message..."
            className="flex-1"
            disabled={!isConnected}
          />
          <Button onClick={handleSend} size="icon" disabled={!isConnected || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
