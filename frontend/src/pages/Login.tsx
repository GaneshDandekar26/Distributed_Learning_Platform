import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authService } from "@/lib/auth";
import { UserRole } from "@/types";
import { Network, GraduationCap, Users, Shield } from "lucide-react";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const user = await authService.login(email, password, role);
      toast.success(`Welcome back, ${user.name}!`);
      
      // Route based on role
      switch (user.role) {
        case "student":
          navigate("/student");
          break;
        case "teacher":
          navigate("/teacher");
          break;
        case "admin":
          navigate("/admin");
          break;
      }
    } catch (error) {
      toast.error("Login failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Network className="h-12 w-12 text-primary" />
            <h1 className="text-4xl font-bold text-gradient">Distributed LearnHub</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Real-time collaborative learning with distributed systems visualization
          </p>
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Choose your role and access the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              <Tabs value={role} onValueChange={(v) => setRole(v as UserRole)} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="student" className="gap-2">
                    <GraduationCap className="h-4 w-4" />
                    Student
                  </TabsTrigger>
                  <TabsTrigger value="teacher" className="gap-2">
                    <Users className="h-4 w-4" />
                    Teacher
                  </TabsTrigger>
                  <TabsTrigger value="admin" className="gap-2">
                    <Shield className="h-4 w-4" />
                    Admin
                  </TabsTrigger>
                </TabsList>
                
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </Tabs>

              <Button type="submit" className="w-full" size="lg">
                Sign In as {role.charAt(0).toUpperCase() + role.slice(1)}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Demo credentials: Any email/password with role selection</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
