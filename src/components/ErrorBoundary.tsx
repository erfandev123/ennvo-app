/**
 * Ennvo Resilient Error Boundary with Native Crashlytics Bridge
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { bridge } from '../native/bridge';
import { RotateCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  screenName?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

const recentErrors = new Map<string, number>();

export const reportGlobalError = (message: string, stack?: string) => {
  const key = `${message}-${stack?.substring(0, 50)}`;
  const now = Date.now();
  const lastTime = recentErrors.get(key) || 0;

  if (now - lastTime < 10000) {
    return; // De-duplicate within 10 seconds
  }
  recentErrors.set(key, now);

  bridge.reportError(message, stack || '');
};

// Global window error listener setup
export const initGlobalErrorHandlers = () => {
  if (typeof window === 'undefined') return;

  window.onerror = (message, source, lineno, colno, error) => {
    const msg = typeof message === 'string' ? message : 'Unknown window error';
    const stack = error?.stack || `${source}:${lineno}:${colno}`;
    reportGlobalError(msg, stack);
    return false;
  };

  window.onunhandledrejection = (event) => {
    const reason = event.reason;
    const msg = typeof reason === 'string' ? reason : reason?.message || 'Unhandled Promise Rejection';
    const stack = reason?.stack || '';
    reportGlobalError(msg, stack);
  };
};

export class ErrorBoundary extends Component<Props, State> {
  public props: Props;
  public state: State = {
    hasError: false,
    errorMessage: '',
  };
  public setState!: (update: Partial<State> | ((prevState: State) => Partial<State>)) => void;

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message || 'Unexpected display error' };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const prefix = this.props.screenName ? `[${this.props.screenName}] ` : '';
    reportGlobalError(`${prefix}${error.message}`, errorInfo.componentStack || error.stack);
  }

  private handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 text-center min-h-[280px] w-full bg-white dark:bg-black rounded-2xl border border-gray-100 dark:border-white/10 m-auto">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500 mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
            {this.props.screenName ? `${this.props.screenName} hit a snag` : 'Something went wrong'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mb-4 line-clamp-2">
            {this.state.errorMessage || 'A minor interface issue occurred. Tap below to reload this section.'}
          </p>
          <button
            onClick={this.handleReload}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-semibold rounded-xl shadow-md active:scale-95 transition-transform cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Reload screen</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
