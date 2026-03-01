import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import Navigation from './src/navigation';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { initializeSentry, SentryErrorBoundary } from './src/utils/sentry';
import { initializeRTL } from './src/i18n';
import { ThemeProvider } from './src/theme/ThemeProvider';

// Initialize Sentry early
initializeSentry();

export default function App() {
  useEffect(() => {
    // Initialize RTL layout based on saved language preference
    initializeRTL();
  }, []);

  return (
    <SentryErrorBoundary fallback={<ErrorBoundary level="app" />}>
      <GestureHandlerRootView style={styles.container}>
        <ThemeProvider>
          <ErrorBoundary level="app">
            <StatusBar style="light" />
            <Navigation />
          </ErrorBoundary>
        </ThemeProvider>
      </GestureHandlerRootView>
    </SentryErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
