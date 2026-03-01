import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'match';
  title: string;
  message?: string;
  imageUrl?: string;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  showMatchNotification: (userName: string, userPhoto?: string, onView?: () => void) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showMatchNotification = useCallback(
    (userName: string, userPhoto?: string, onView?: () => void) => {
      addToast({
        type: 'match',
        title: "It's a Match!",
        message: `You and ${userName} liked each other`,
        imageUrl: userPhoto,
        duration: 8000,
        action: onView
          ? {
              label: 'Say Hi',
              onPress: onView,
            }
          : undefined,
      });
    },
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ addToast, showMatchNotification }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </View>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const translateX = useRef(new Animated.Value(width)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      const timer = setTimeout(() => {
        dismissToast();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissToast = () => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: width,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onRemove(toast.id);
    });
  };

  const bgColor =
    toast.type === 'match'
      ? ['#e94560', '#ff6b9d']
      : toast.type === 'success'
      ? ['#4cd137', '#4cd137']
      : toast.type === 'error'
      ? ['#e74c3c', '#e74c3c']
      : ['#1a1a2e', '#1a1a2e'];

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: bgColor[0],
          transform: [{ translateX }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.toastContent}
        onPress={dismissToast}
        activeOpacity={0.9}
      >
        {toast.imageUrl && (
          <Image source={{ uri: toast.imageUrl }} style={styles.avatar} />
        )}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{toast.title}</Text>
          {toast.message && <Text style={styles.message}>{toast.message}</Text>}
          {toast.action && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                toast.action?.onPress();
                dismissToast();
              }}
            >
              <Text style={styles.actionText}>{toast.action.label}</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={dismissToast} style={styles.closeButton}>
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    right: 16,
    left: 16,
    zIndex: 9999,
  },
  toast: {
    marginBottom: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  actionButton: {
    marginTop: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  actionText: {
    color: '#e94560',
    fontWeight: '600',
    fontSize: 14,
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 24,
    lineHeight: 24,
  },
});

export default ToastProvider;
