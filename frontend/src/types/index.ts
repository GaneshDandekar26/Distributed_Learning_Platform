export type UserRole = 'student' | 'teacher' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Course {
  id: string;
  name: string;
  description: string;
  teacherId: string;
  enrolled?: boolean;
}

export interface ChatMessage {
  id: string;
  courseId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  content: string;
  lamportTimestamp: number;
  timestamp: Date;
}

export interface ServerMetrics {
  serverId: string;
  activeConnections: number;
  lamportClock: number;
  coordinatorRole: 'LEADER' | 'FOLLOWER';
  ftRole: 'PRIMARY' | 'BACKUP';
  isHealthy: boolean;
}

export interface SystemMetrics {
  servers: ServerMetrics[];
  consistency: {
    isConsistent: boolean;
    score: number;
  };
  mapReduce: {
    status: 'RUNNING' | 'COMPLETED' | 'IDLE';
    progress: number;
  };
  hdfs: {
    datanodeCount: number;
  };
}

export interface WhiteboardPoint {
  x: number;
  y: number;
  color: string;
  size: number;
}

export interface WhiteboardStroke {
  id: string;
  points: WhiteboardPoint[];
  userId: string;
}
