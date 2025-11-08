import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "@/lib/auth";
import { Course, ChatMessage } from "@/types";
import { CourseCard } from "@/components/CourseCard";
import { WhiteboardWithChat } from "@/components/WhiteboardWithChat";
import { StatusIndicator } from "@/components/StatusIndicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LogOut, BookOpen, MessageSquare, Presentation, Users } from "lucide-react";
import { toast } from "sonner";

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const [isOnline, setIsOnline] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string | null>("1");
  const [whiteboardLive, setWhiteboardLive] = useState(true);
  const [studentsConnected] = useState(12);

  const [courses] = useState<Course[]>([
    {
      id: "1",
      name: "Distributed Systems Fundamentals",
      description: "Learn about consistency models, replication, and fault tolerance",
      teacherId: user?.id || "",
    },
    {
      id: "2",
      name: "Advanced Consensus Algorithms",
      description: "Deep dive into Paxos, Raft, and Byzantine fault tolerance",
      teacherId: user?.id || "",
    },
  ]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      courseId: "1",
      userId: user?.id || "",
      userName: user?.name || "",
      userRole: "teacher",
      content: "Welcome to the course! Today we'll discuss vector clocks.",
      lamportTimestamp: 42,
      timestamp: new Date(Date.now() - 3600000),
    },
    {
      id: "2",
      courseId: "1",
      userId: "student1",
      userName: "Alice",
      userRole: "student",
      content: "Excited to learn about distributed systems!",
      lamportTimestamp: 43,
      timestamp: new Date(Date.now() - 1800000),
    },
  ]);

  useEffect(() => {
    if (!user || user.role !== "teacher") {
      navigate("/");
      return;
    }
  }, []); // Empty dependency array to prevent re-running

  const handleLogout = () => {
    authService.logout();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const handleSendMessage = (content: string) => {
    if (!selectedCourse || !user) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      courseId: selectedCourse,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      content,
      lamportTimestamp: messages.length > 0 ? Math.max(...messages.map(m => m.lamportTimestamp)) + 1 : 1,
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
            <p className="text-sm text-muted-foreground">Welcome back, {user?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <StatusIndicator online={isOnline} label="Gateway Status" />
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="courses" className="space-y-6">
          <TabsList>
            <TabsTrigger value="courses" className="gap-2">
              <BookOpen className="h-4 w-4" />
              My Courses
            </TabsTrigger>
            <TabsTrigger value="whiteboard" className="gap-2">
              <Presentation className="h-4 w-4" />
              Whiteboard & Chat
            </TabsTrigger>
            <TabsTrigger value="control" className="gap-2">
              <Users className="h-4 w-4" />
              Class Control
            </TabsTrigger>
          </TabsList>

          <TabsContent value="courses" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Managed Courses</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    enrolled={true}
                    onOpen={setSelectedCourse}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="whiteboard">
            <WhiteboardWithChat isReadOnly={false} />
          </TabsContent>

          <TabsContent value="control">
            <Card>
              <CardHeader>
                <CardTitle>Class Control Panel</CardTitle>
                <CardDescription>Manage live session settings and view participant stats</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="whiteboard-live">Whiteboard Live Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow real-time drawing broadcasts to all students
                    </p>
                  </div>
                  <Switch
                    id="whiteboard-live"
                    checked={whiteboardLive}
                    onCheckedChange={setWhiteboardLive}
                  />
                </div>

                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-2">Session Statistics</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Students Connected</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-primary">{studentsConnected}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Active Course</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg font-medium">
                          {courses.find((c) => c.id === selectedCourse)?.name || "None"}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default TeacherDashboard;
