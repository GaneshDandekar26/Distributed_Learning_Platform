import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eraser, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhiteboardCanvasProps {
  whiteboardId: string;
  isReadOnly?: boolean;
}

export const WhiteboardCanvas = ({ whiteboardId, isReadOnly = false }: WhiteboardCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#3b82f6");
  const [lineWidth, setLineWidth] = useState(3);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket for real-time whiteboard
    // In production: const socket = new WebSocket(`ws://localhost:5000/ws/whiteboard/${whiteboardId}`);
    // For demo, we'll simulate local drawing
    
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [whiteboardId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Set initial styles
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isReadOnly) return;
    
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isReadOnly) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();

    // Send to WebSocket in production
    // ws?.send(JSON.stringify({ type: 'draw', x, y, color, lineWidth }));
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#000000"];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">
          {isReadOnly ? "Whiteboard (View Only)" : "Interactive Whiteboard"}
        </h3>
        {!isReadOnly && (
          <div className="flex gap-2">
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-6 h-6 rounded border-2 transition-all",
                    color === c ? "border-primary scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={clearCanvas}>
              <Eraser className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className={cn(
          "w-full h-[400px] bg-background border rounded-lg",
          !isReadOnly && "cursor-crosshair"
        )}
      />
      
      {isReadOnly && (
        <p className="text-sm text-muted-foreground mt-2 text-center">
          Connected to live whiteboard session
        </p>
      )}
    </Card>
  );
};
