import { Course } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Check } from "lucide-react";

interface CourseCardProps {
  course: Course;
  onEnroll?: (courseId: string) => void;
  onOpen?: (courseId: string) => void;
  enrolled?: boolean;
}

export const CourseCard = ({ course, onEnroll, onOpen, enrolled }: CourseCardProps) => {
  return (
    <Card className="hover:border-primary transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{course.name}</CardTitle>
          </div>
          {enrolled && (
            <div className="flex items-center gap-1 text-xs text-success">
              <Check className="h-3 w-3" />
              <span>Enrolled</span>
            </div>
          )}
        </div>
        <CardDescription>{course.description}</CardDescription>
      </CardHeader>
      <CardFooter className="flex gap-2">
        {!enrolled && onEnroll && (
          <Button onClick={() => onEnroll(course.id)} size="sm">
            Enroll
          </Button>
        )}
        {enrolled && onOpen && (
          <Button onClick={() => onOpen(course.id)} variant="secondary" size="sm">
            Open Course
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
