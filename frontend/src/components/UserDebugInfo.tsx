import { authService } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const UserDebugInfo = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  if (!user) {
    return (
      <Card className="bg-destructive/10 border-destructive">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-semibold text-destructive">⚠️ No user logged in</span>
            </div>
            <Button size="sm" onClick={() => navigate("/")}>Go to Login</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleClearAndLogout = () => {
    localStorage.clear();
    authService.logout();
    toast.success("Logged out and cleared cache");
    navigate("/");
  };

  return (
    <Card className="bg-muted/50">
      <CardContent className="py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm">
                <span className="font-semibold">Logged in as:</span> {user.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Email: {user.email} • ID: {user.id}
              </p>
            </div>
            <Badge variant={
              user.role === 'teacher' ? 'default' : 
              user.role === 'student' ? 'secondary' : 
              'outline'
            }>
              {user.role.toUpperCase()}
            </Badge>
          </div>
          <Button size="sm" variant="outline" onClick={handleClearAndLogout}>
            Clear & Logout
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
