import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8001';

interface UseSocketOptions {
  namespace: '/chat' | '/whiteboard';
  room?: string;
  username?: string;
  autoConnect?: boolean;
}

export function useSocket(options: UseSocketOptions) {
  const { namespace, room, username, autoConnect = true } = options;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [serverId, setServerId] = useState<string>('');

  useEffect(() => {
    if (!autoConnect) return;

    const newSocket = io(`${SOCKET_URL}${namespace}`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log(`Connected to ${namespace}`);
      setIsConnected(true);

      if (room && username) {
        const joinEvent = namespace === '/chat' ? 'join_room' : 'join_whiteboard';
        newSocket.emit(joinEvent, { room, username });
      }
    });

    newSocket.on('disconnect', () => {
      console.log(`Disconnected from ${namespace}`);
      setIsConnected(false);
    });

    newSocket.on('connected', (data: any) => {
      console.log('Server info:', data);
      setServerId(data.server_id);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    return () => {
      if (room && username) {
        const leaveEvent = namespace === '/chat' ? 'leave_room' : 'leave_whiteboard';
        newSocket.emit(leaveEvent, { room, username });
      }
      newSocket.close();
    };
  }, [namespace, room, username, autoConnect]);

  const disconnect = useCallback(() => {
    if (socket) {
      if (room && username) {
        const leaveEvent = namespace === '/chat' ? 'leave_room' : 'leave_whiteboard';
        socket.emit(leaveEvent, { room, username });
      }
      socket.close();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket, namespace, room, username]);

  return {
    socket,
    isConnected,
    serverId,
    disconnect,
  };
}

export function useChatSocket(room: string, username: string) {
  const { socket, isConnected, serverId } = useSocket({
    namespace: '/chat',
    room,
    username,
  });

  const [messages, setMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('chat_message', (message: any) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('user_joined', (data: any) => {
      console.log(`${data.username} joined the chat`);
    });

    socket.on('user_left', (data: any) => {
      console.log(`${data.username} left the chat`);
    });

    socket.on('typing', (data: any) => {
      if (data.is_typing) {
        setTypingUsers((prev) => [...prev, data.username]);
      } else {
        setTypingUsers((prev) => prev.filter((u) => u !== data.username));
      }
    });

    return () => {
      socket.off('chat_message');
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('typing');
    };
  }, [socket]);

  const sendMessage = useCallback(
    (message: string) => {
      if (socket && isConnected) {
        socket.emit('chat_message', {
          room,
          message,
          username,
        });
      }
    },
    [socket, isConnected, room, username]
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (socket && isConnected) {
        socket.emit('typing', {
          room,
          username,
          is_typing: isTyping,
        });
      }
    },
    [socket, isConnected, room, username]
  );

  return {
    messages,
    sendMessage,
    typingUsers,
    sendTyping,
    isConnected,
    serverId,
  };
}

export function useWhiteboardSocket(room: string, username: string) {
  const { socket, isConnected, serverId } = useSocket({
    namespace: '/whiteboard',
    room,
    username,
  });

  const [drawEvents, setDrawEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('draw_event', (event: any) => {
      setDrawEvents((prev) => [...prev, event]);
    });

    socket.on('user_joined', (data: any) => {
      console.log(`${data.username} joined the whiteboard`);
    });

    socket.on('user_left', (data: any) => {
      console.log(`${data.username} left the whiteboard`);
    });

    return () => {
      socket.off('draw_event');
      socket.off('user_joined');
      socket.off('user_left');
    };
  }, [socket]);

  const sendDrawEvent = useCallback(
    (drawData: {
      type: 'draw' | 'erase' | 'clear';
      points?: number[][];
      color?: string;
      width?: number;
    }) => {
      if (socket && isConnected) {
        socket.emit('draw_event', {
          room,
          username,
          ...drawData,
        });
      }
    },
    [socket, isConnected, room, username]
  );

  const clearDrawEvents = useCallback(() => {
    setDrawEvents([]);
  }, []);

  return {
    drawEvents,
    sendDrawEvent,
    clearDrawEvents,
    isConnected,
    serverId,
  };
}
