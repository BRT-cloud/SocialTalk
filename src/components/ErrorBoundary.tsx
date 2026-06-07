import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      let errorMessage = '알 수 없는 오류가 발생했습니다.';
      try {
        const parsed = JSON.parse(error?.message || '{}');
        if (parsed.error) errorMessage = parsed.error;
      } catch {
        errorMessage = error?.message || errorMessage;
      }

      return (
        <div className="min-h-[100dvh] bg-[#050505] flex items-center justify-center p-8 text-center font-sans">
          <div className="max-w-md space-y-8 relative">
            <div className="absolute -inset-4 bg-red-600/20 blur-3xl rounded-full" />
            <div className="relative space-y-6">
              <div className="w-20 h-20 bg-red-600/10 border border-red-600/50 rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(220,38,38,0.3)]">
                <span className="text-4xl font-black text-red-600">!</span>
              </div>
              <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">System Failure</h1>
              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-xl">
                <p className="text-red-400 text-sm font-mono break-all">
                  {errorMessage}
                </p>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-4 bg-red-600 text-white font-black rounded-2xl hover:bg-red-500 transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] uppercase tracking-widest italic"
              >
                시스템 재부팅 (Reboot)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
