import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  courseId: string;
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  currentUserId: string;
}

export const ChatPanel = ({ courseId, messages, onSendMessage, currentUserId }: ChatPanelProps) => {
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage("");
    }
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Discussion & Chat</h3>
        <p className="text-sm text-muted-foreground">Real-time with Lamport Timestamps</p>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex flex-col gap-1 p-3 rounded-lg",
                message.userId === currentUserId ? "bg-primary/10 ml-auto max-w-[80%]" : "bg-muted max-w-[80%]"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{message.userName}</span>
                <Badge variant={message.userRole === "teacher" ? "default" : "secondary"} className="text-xs">
                  {message.userRole}
                </Badge>
              </div>
              <p className="text-sm">{message.content}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <Clock className="h-3 w-3" />
                <span>LT: {message.lamportTimestamp}</span>
                <span>•</span>
                <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your message..."
            className="flex-1"
          />
          <Button onClick={handleSend} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
