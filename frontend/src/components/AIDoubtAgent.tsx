import { useState, useRef, useEffect } from "react";
import { authService } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  Loader2, 
  Bot, 
  User, 
  Trash2,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

// Helper function to format markdown text to JSX
const formatMarkdownText = (text: string) => {
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  
  lines.forEach((line, index) => {
    let formattedLine = line;
    
    // Convert **bold** to <strong>
    formattedLine = formattedLine.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Convert *italic* to <em>
    formattedLine = formattedLine.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Check if it's a numbered list
    const numberedListMatch = formattedLine.match(/^(\d+)\.\s+(.+)/);
    if (numberedListMatch) {
      elements.push(
        <div key={index} className="ml-4 my-1">
          <strong>{numberedListMatch[1]}.</strong> <span dangerouslySetInnerHTML={{ __html: numberedListMatch[2] }} />
        </div>
      );
      return;
    }
    
    // Check if it's a bullet list
    const bulletListMatch = formattedLine.match(/^[•\-*]\s+(.+)/);
    if (bulletListMatch) {
      elements.push(
        <div key={index} className="ml-4 my-1">
          • <span dangerouslySetInnerHTML={{ __html: bulletListMatch[1] }} />
        </div>
      );
      return;
    }
    
    // Regular line
    if (formattedLine.trim()) {
      elements.push(
        <div key={index} dangerouslySetInnerHTML={{ __html: formattedLine }} className="my-1" />
      );
    } else {
      elements.push(<div key={index} className="h-2" />);
    }
  });
  
  return <div>{elements}</div>;
};

interface Message {
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

interface VoiceRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const AIDoubtAgent = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  
  const user = authService.getCurrentUser();
  const userId = user?.id || 'anonymous';

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition() as VoiceRecognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        toast.success("Speech captured: " + transcript.substring(0, 50) + "...");
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        toast.error(`Voice input error: ${event.error}`);
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }
    
    // Initialize speech synthesis
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
    
    return () => {
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startVoiceInput = () => {
    if (!recognitionRef.current) {
      toast.error("Voice input not supported in this browser");
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast.info("Listening... Speak now!");
      } catch (error) {
        console.error('Error starting recognition:', error);
        toast.error("Failed to start voice input");
      }
    }
  };

  const speakText = (text: string) => {
    if (!synthRef.current) {
      toast.error("Text-to-speech not supported in this browser");
      return;
    }
    
    if (isSpeaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => {
      setIsSpeaking(false);
      toast.error("Failed to speak text");
    };
    
    synthRef.current.speak(utterance);
    toast.info("Speaking answer...");
  };

  const sendQuestion = async () => {
    const question = inputText.trim();
    
    if (!question) {
      toast.error("Please enter a question");
      return;
    }
    
    // Add user message to chat
    const userMessage: Message = {
      role: 'user',
      content: question,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_URL}/api/doubt/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question,
          user_id: userId,
          conversation_id: conversationId
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        const aiMessage: Message = {
          role: 'ai',
          content: data.answer,
          timestamp: data.timestamp
        };
        
        setMessages(prev => [...prev, aiMessage]);
        setConversationId(data.conversation_id);
        toast.success("Answer received!");
      } else {
        toast.error(data.error || "Failed to get answer");
        
        // Add error message
        const errorMessage: Message = {
          role: 'ai',
          content: `Sorry, I couldn't process your question. ${data.error || 'Please try again.'}`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error asking question:', error);
      toast.error("Network error. Please check your connection.");
      
      const errorMessage: Message = {
        role: 'ai',
        content: "Sorry, I'm having trouble connecting. Please try again later.",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setConversationId(null);
    toast.success("Conversation cleared");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuestion();
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                AI Doubt Agent
                <Badge variant="secondary" className="text-xs">
                  <Bot className="h-3 w-3 mr-1" />
                  Powered by Gemini
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Ask me anything about DSA, OS, DBMS, CN, Maths, or Coding
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearConversation}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Chat Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mb-4">
                  <Sparkles className="h-10 w-10 text-purple-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Welcome to AI Doubt Agent!</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  I'm here to help you understand CS concepts better. Ask me anything about:
                </p>
                <div className="flex flex-wrap gap-2 mt-3 justify-center">
                  <Badge variant="outline">Data Structures</Badge>
                  <Badge variant="outline">Algorithms</Badge>
                  <Badge variant="outline">Operating Systems</Badge>
                  <Badge variant="outline">DBMS</Badge>
                  <Badge variant="outline">Computer Networks</Badge>
                  <Badge variant="outline">Mathematics</Badge>
                </div>
              </div>
            )}
            
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'ai' && (
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold">
                      {message.role === 'user' ? 'You' : 'AI Doubt Agent'}
                    </span>
                    {message.role === 'ai' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => speakText(message.content)}
                      >
                        <Volume2 className={`h-3 w-3 ${isSpeaking ? 'text-primary animate-pulse' : ''}`} />
                      </Button>
                    )}
                  </div>
                  <div className="text-sm break-words">
                    {message.role === 'ai' ? formatMarkdownText(message.content) : message.content}
                  </div>
                  <span className="text-xs opacity-70 mt-1 block">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                
                {message.role === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Button
              variant={isListening ? "default" : "outline"}
              size="icon"
              onClick={startVoiceInput}
              disabled={isLoading}
              className={isListening ? "animate-pulse" : ""}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your question or use voice input..."
              disabled={isLoading || isListening}
              className="flex-1"
            />
            
            <Button
              onClick={sendQuestion}
              disabled={isLoading || !inputText.trim() || isListening}
              className="px-6"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Press Enter to send • Click mic to use voice input • Click speaker to hear answer
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
