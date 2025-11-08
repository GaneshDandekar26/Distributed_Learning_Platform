import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "@/lib/auth";
import { Course, ChatMessage } from "@/types";
import { CourseCard } from "@/components/CourseCard";
import { WhiteboardWithChat } from "@/components/WhiteboardWithChat";
import { AIDoubtAgent } from "@/components/AIDoubtAgent";
import { StatusIndicator } from "@/components/StatusIndicator";
import { UserDebugInfo } from "@/components/UserDebugInfo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, BookOpen, MessageSquare, Presentation, Sparkles } from "lucide-react";
import { toast } from "sonner";

const StudentDashboard = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const [isOnline, setIsOnline] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  
  // Mock data
  const [courses] = useState<Course[]>([
    {
      id: "1",
      name: "Distributed Systems Fundamentals",
      description: "Learn about consistency models, replication, and fault tolerance",
      teacherId: "teacher1",
      enrolled: true,
    },
    {
      id: "2",
      name: "Advanced Consensus Algorithms",
      description: "Deep dive into Paxos, Raft, and Byzantine fault tolerance",
      teacherId: "teacher1",
      enrolled: true,
    },
    {
      id: "3",
      name: "Cloud Computing Architecture",
      description: "Design and implement scalable cloud-native applications",
      teacherId: "teacher2",
      enrolled: false,
    },
  ]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      courseId: "1",
      userId: "teacher1",
      userName: "Dr. Smith",
      userRole: "teacher",
      content: "Welcome to the course! Today we'll discuss vector clocks.",
      lamportTimestamp: 42,
      timestamp: new Date(Date.now() - 3600000),
    },
    {
      id: "2",
      courseId: "1",
      userId: "student2",
      userName: "Alice",
      userRole: "student",
      content: "Excited to learn about distributed systems!",
      lamportTimestamp: 43,
      timestamp: new Date(Date.now() - 1800000),
    },
  ]);

  useEffect(() => {
    console.log("Current user:", user);
    
    if (!user) {
      console.log("No user found, redirecting to login");
      navigate("/");
      return;
    }
    
    if (user.role !== "student") {
      console.log(`User role is ${user.role}, not student. Redirecting to login.`);
      toast.error("Access denied. Please login as a student.");
      authService.logout();
      navigate("/");
      return;
    }

    // Simulate connectivity check
    const interval = setInterval(() => {
      setIsOnline(Math.random() > 0.1);
    }, 5000);

    return () => clearInterval(interval);
  }, []); // Empty dependency array to prevent re-running

  const handleLogout = () => {
    authService.logout();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const handleEnroll = (courseId: string) => {
    toast.success("Enrolled in course successfully!");
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

  const enrolledCourses = courses.filter(c => c.enrolled);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Student Dashboard</h1>
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
        <div className="mb-6">
          <UserDebugInfo />
        </div>
        
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
            <TabsTrigger value="ai-doubt" className="gap-2">
              <Sparkles className="h-4 w-4" />
              AI Doubt Agent
            </TabsTrigger>
          </TabsList>

          <TabsContent value="courses" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Enrolled Courses</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {enrolledCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    enrolled={course.enrolled}
                    onOpen={setSelectedCourse}
                  />
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Available Courses</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {courses
                  .filter((c) => !c.enrolled)
                  .map((course) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      onEnroll={handleEnroll}
                    />
                  ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="whiteboard">
            <WhiteboardWithChat isReadOnly={true} />
          </TabsContent>
          
          <TabsContent value="ai-doubt">
            <div className="max-w-5xl mx-auto" style={{ height: '700px' }}>
              <AIDoubtAgent />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default StudentDashboard;
