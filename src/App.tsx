import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Upload, 
  Lock, 
  Unlock, 
  Eye, 
  Download, 
  CheckCircle, 
  XCircle, 
  Activity, 
  Bell, 
  Copy, 
  LogOut, 
  User,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  FileText,
  FileLock,
  FileWarning,
  Loader2,
  AlertTriangle,
  Terminal,
  Trash2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Share2,
  FileUp,
  History,
  LockKeyhole,
  ScanText,
  UserCheck,
  CheckCircle2,
  Clock,
  Smartphone,
  Monitor,
  Zap,
  Globe,
  MoreVertical,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { nanoid } from 'nanoid';
import { apiRequest } from './lib/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- TYPES ---
interface User {
  id: string;
  email: string;
}

interface FileRef {
  id: string;
  original_name: string;
  size: number;
  mimetype: string;
  share_id: string;
  created_at: string;
  pending_requests: number;
}

interface AccessRequest {
  id: string;
  file_id: string;
  file_name: string;
  requester_email: string;
  status: 'pending' | 'approved' | 'denied';
  browser_info: string;
  device_info: string;
  created_at: string;
}

// --- COMPONENTS ---

// Anti-screenshot and security styles
const SecurityStyles = () => (
  <style>{`
    @media print {
      body { display: none !important; }
    }
    .unselectable {
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      -khtml-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }
    .secure-blur {
      filter: blur(20px);
      pointer-events: none;
    }
  `}</style>
);

const SecureViewer = ({ url, mimetype, originalName }: { url: string, mimetype: string, originalName?: string }) => {
  const [screenshotDetected, setScreenshotDetected] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

    setLoading(true);
    setError(null);
    setBlobUrl(null);
    setTextContent(null);

    const initSecureSession = async () => {
      try {
        console.log(`[RAKSHAK] INITIALIZING SECURE SESSION: ${mimetype} | URL: ${url}`);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        console.log(`[RAKSHAK] FETCH STATUS: ${res.status}`);

        if (res.status === 403) throw new Error('SECURE SESSION UNAUTHORIZED: WAIT FOR OWNER SIGNOFF');
        if (res.status === 410) throw new Error('SECURE LINK CONSUMED OR EXPIRED');
        
        if (!res.ok) {
          let errorMsg = `Secure handshake failed (${res.status})`;
          try {
            const errData = await res.json();
            errorMsg = errData.error || errorMsg;
          } catch (e) {}
          throw new Error(errorMsg);
        }
        
        const blob = await res.blob();
        console.log(`[RAKSHAK] DATA STREAM RECEIVED: ${blob.size} bytes`);
        if (!mounted) return;

        const type = mimetype.toLowerCase();
        if (type.startsWith('text/') || type.includes('json') || type.includes('javascript') || type.includes('xml') || type.includes('csv') || type.includes('markdown') || type === 'application/x-typescript') {
          const text = await blob.text();
          setTextContent(text || ' ');
          setLoading(false);
        } else if (type.startsWith('image/') || type.includes('pdf') || type.startsWith('video/') || type.includes('office') || type.includes('word') || type.includes('excel') || type.includes('powerpoint') || type.includes('document') || type.includes('presentation') || type.includes('sheet')) {
          const objectUrl = URL.createObjectURL(blob);
          blobUrlRef.current = objectUrl;
          setBlobUrl(objectUrl);
          setLoading(false);
        } else {
          // Fallback check
          try {
            const text = await blob.text();
            if (text.includes('\0') || (text.match(/[^\x20-\x7E\r\n\t]/g) || []).length > (text.length * 0.3)) {
               throw new Error('Binary content detected');
            }
            setTextContent(text || ' ');
          } catch (e) {
            console.log("[RAKSHAK] FALLBACK TO BLOB PREVIEW FOR TYPE:", mimetype);
            if (blob.size > 0) {
              const objectUrl = URL.createObjectURL(blob);
              blobUrlRef.current = objectUrl;
              setBlobUrl(objectUrl);
            } else {
              setError('SECURE NODE CONTAINS NO DATA PAYLOAD');
            }
          }
          setLoading(false);
        }
      } catch (e: any) {
        console.error('[RAKSHAK] SESSION FAILURE:', e);
        if (mounted) {
          setError(e.message || 'SECURE SESSION FAILED');
          setLoading(false);
        }
      }
    };

    initSecureSession();

    return () => {
      mounted = false;
      controller.abort();
      clearTimeout(timeoutId);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [url, mimetype]);



  useEffect(() => {
    // Aggressive Screen Capture Protection
    const handleKeydown = (e: KeyboardEvent) => {
      const forbiddenKeys = ['PrintScreen', 'F12', 'F11'];
      const isMacScreenshot = e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5');
      const isPrint = (e.ctrlKey || e.metaKey) && e.key === 'p';
      const isSave = (e.ctrlKey || e.metaKey) && e.key === 's';
      const isInspect = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C');
      const isCopy = (e.ctrlKey || e.metaKey) && e.key === 'c';

      if (
        forbiddenKeys.includes(e.key) || 
        isMacScreenshot || 
        isPrint || 
        isSave || 
        isInspect ||
        isCopy
      ) {
        e.preventDefault();
        e.stopPropagation();
        setScreenshotDetected(true);
        // Instant clipboard clear
        navigator.clipboard.writeText('RAKSHAK_SECURITY_VO_LOGGED').catch(() => {});
        setTimeout(() => setScreenshotDetected(false), 5000);
        return false;
      }
    };

    window.addEventListener('keydown', handleKeydown, true);
    window.addEventListener('contextmenu', (e) => e.preventDefault(), true);
    document.addEventListener('visibilitychange', () => {
    });

    return () => {
      window.removeEventListener('keydown', handleKeydown, true);
      window.removeEventListener('contextmenu', (e) => e.preventDefault(), true);
    };
  }, []);

  return (
    <div className="relative w-full h-full glass rounded-2xl overflow-hidden unselectable border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-[#050507]">

      {/* Anti-screenshot flickering overlay */}
      <div className="absolute inset-0 z-[70] pointer-events-none opacity-[0.02] bg-white animate-pulse mix-blend-overlay" />
      {/* Dynamic Watermark Overlay */}
      <div className="absolute inset-0 z-[60] pointer-events-none opacity-[0.03] overflow-hidden">
        <motion.div 
          animate={{ 
            x: [0, 100, 0, -100, 0],
            y: [0, 50, 0, -50, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute inset-[-100%] flex items-center justify-center flex-wrap gap-20 p-20"
        >
          {[...Array(50)].map((_, i) => (
            <div key={i} className="rotate-[-25deg] whitespace-nowrap font-mono text-[10px] font-black text-white uppercase tracking-widest">
              RAKSHAK SECURE NODE · {Math.random().toString(36).substring(7).toUpperCase()} · NO CAPTURE
            </div>
          ))}
        </motion.div>
      </div>

      <AnimatePresence>
        {screenshotDetected && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[200] bg-red-600 flex flex-col items-center justify-center text-white p-12 text-center"
          >
            <ShieldAlert className="w-32 h-32 mb-8 animate-bounce" />
            <h2 className="text-5xl font-black mb-6 uppercase italic tracking-tighter underline decoration-black decoration-8 underline-offset-8">SECURITY BREACH</h2>
            <p className="text-2xl font-bold uppercase tracking-[0.2em] text-white/90 mb-10">SCREEN CAPTURE DETECTED & NEUTRALIZED</p>
            <div className="bg-black/30 p-6 rounded-lg font-mono text-left max-w-md w-full border border-white/10">
              <div className="text-cyber-bright space-y-1 text-xs">
                <p>{">"} TRACING_SOURCE... DONE</p>
                <p>{">"} LOGGING_EVENT_8842... DONE</p>
                <p>{">"} REFRESH_HANDSHAKE_REQUIRED</p>
              </div>
            </div>
            <button 
              onClick={() => setScreenshotDetected(false)}
              className="mt-12 px-10 py-4 bg-white text-black font-black uppercase tracking-[0.4em] hover:bg-black hover:text-white transition-all transform active:scale-95"
            >
              Acknowledge & Reset
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn("w-full h-full relative transition-all duration-1000")}>
        {!loading && !error && (
           <motion.div
             initial={{ top: "-10%" }}
             animate={{ top: "110%" }}
             transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
             className="absolute left-0 right-0 h-1 bg-cyber-bright/20 shadow-[0_0_20px_rgba(16,185,129,0.3)] z-30 pointer-events-none"
           />
        )}
        
        <div className="absolute inset-0 z-20 pointer-events-none grid grid-cols-4 grid-rows-4 opacity-[0.04]">
          {[...Array(16)].map((_, i) => (
            <div key={i} className="flex items-center justify-center border border-white/5 rotate-[-25deg] overflow-hidden">
              <span className="text-[8px] font-mono text-white whitespace-nowrap tracking-tighter uppercase font-black">INTERNAL USE ONLY · NO REPRODUCTION</span>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-6 bg-[#08080c]">
            <div className="relative">
              <Loader2 className="w-16 h-16 text-cyber-bright animate-spin" />
              <Activity className="w-6 h-6 text-cyber-bright absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-[10px] font-black text-cyber-bright uppercase tracking-[0.4em] animate-pulse">Establishing Secure Tunnel</p>
              <p className="text-white/20 text-[8px] font-mono uppercase">Verifying Node Integrity {Math.random().toString(16).substring(2,8)}</p>
            </div>
          </div>
        ) : error ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-12 bg-red-500/5 text-center">
            <ShieldX className="w-16 h-16 text-red-500 mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]" />
            <h4 className="text-lg font-bold text-red-500 uppercase italic tracking-widest mb-2">Cryptographic Handshake Denied</h4>
            <p className="text-white/40 text-[10px] uppercase font-mono max-w-sm mx-auto">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()} className="mt-8">
              <RefreshCw className="w-3.5 h-3.5 mr-2" /> REINITIALIZE NODE
            </Button>
          </div>
        ) : mimetype.startsWith('image/') ? (
          <img 
            src={url} 
            className="w-full h-full object-contain pointer-events-none select-none" 
            draggable={false} 
          />
        ) : (mimetype.includes('pdf') || mimetype.includes('office') || mimetype.includes('document') || mimetype.includes('word') || mimetype.includes('excel') || mimetype.includes('sheet') || mimetype.includes('presentation')) ? (
          <div className="w-full h-full relative">
            <iframe 
              src={`${url}#toolbar=0&navpanes=0&scrollbar=0`} 
              className="w-full h-full border-none select-none filter contrast-125 brightness-90 relative z-10"
              title="Secure Document Viewer"
            />
            {/* Mobile Fallback: Direct interaction button if iframe fails or feels blocked */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
               <FileWarning className="w-12 h-12 text-white/5" />
            </div>
          </div>
        ) : mimetype.startsWith('video/') ? (
          <video 
            src={url} 
            className="w-full h-full object-contain" 
            controls 
            controlsList="nodownload noplaybackrate noremoteplayback" 
            disablePictureInPicture
          />
        ) : textContent !== null ? (
          <div className="w-full h-full p-12 overflow-auto font-mono text-[11px] text-emerald-500/90 leading-relaxed whitespace-pre-wrap">
             <div className="relative p-8 rounded-lg bg-black/60 border border-emerald-500/10 shadow-inner">
                <div className="absolute top-2 right-4 flex gap-1 opacity-20">
                   <div className="w-1 h-1 rounded-full bg-emerald-500" />
                   <div className="w-1 h-1 rounded-full bg-emerald-500" />
                   <div className="w-1 h-1 rounded-full bg-emerald-500" />
                </div>
                {textContent || <span className="opacity-30 italic">Target node contains empty data payload</span>}
             </div>
          </div>
        ) : blobUrl ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-12 bg-black/90">
            <ShieldAlert className="w-16 h-16 text-cyber-bright/40 mb-6" />
            <p className="text-white font-bold uppercase tracking-widest text-[11px] mb-4 text-center">Protected Content Host</p>
            <p className="text-white/40 text-[9px] uppercase tracking-widest mb-8 text-center max-w-[320px] leading-relaxed">
              Format restricted for automatic rendering in secure memory. 
              The decrypted payload is loaded but cannot be displayed via standard browser protocols.
            </p>
            <div className="px-8 py-3 rounded border border-white/10 bg-white/5 font-mono text-[8px] text-white/40 uppercase">
              Type: {mimetype}
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-12 bg-black select-none pointer-events-none">
            <div className="text-center group-hover:scale-110 transition-transform duration-700">
               <FileWarning className="w-16 h-16 text-white/5 mx-auto mb-6" />
               <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.4em] italic mb-4">Payload Format Restricted</p>
               <p className="text-white/10 text-[8px] font-mono leading-relaxed max-w-[280px] mx-auto uppercase mb-8">
                 Automatic preview restricted for this format to prevent execution in volatile memory.
               </p>
            </div>
          </div>
        )}
        
        {/* Anti-Screenshot Overlay */}
        <div className="absolute inset-0 pointer-events-none z-50 opacity-[0.03] animate-pulse bg-white mix-blend-overlay print:hidden" />
      </div>
    </div>
  );
};

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost', size?: 'sm' | 'md' | 'lg' | 'icon' }>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-cyber-bright text-black hover:bg-emerald-400 cyber-glow shadow-[0_0_15px_rgba(16,185,129,0.2)] active:scale-95 transition-all',
      secondary: 'bg-white/5 text-white hover:bg-white/10 border border-white/10 active:scale-95 transition-all',
      danger: 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 active:scale-95 transition-all',
      ghost: 'bg-transparent text-white/40 hover:text-white transition-all',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-6 py-2.5 text-sm',
      lg: 'px-8 py-4 text-base font-bold',
      icon: 'p-2',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'cyber-button rounded-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer touch-manipulation active:brightness-125',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full bg-white/[0.03] border border-white/10 rounded-sm px-4 py-3 text-white focus:outline-none focus:border-cyber-bright/50 transition-all placeholder:text-white/20',
        className
      )}
      {...props}
    />
  )
);

export default function App() {
  const [view, setView] = useState<'landing' | 'dashboard' | 'shared'>('landing');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareId, setShareId] = useState<string | null>(null);

  useEffect(() => {
    // Check if we are on a share link
    const path = window.location.pathname;
    if (path.startsWith('/file/')) {
      const parts = path.split('/');
      const id = parts[parts.indexOf('file') + 1];
      if (id) {
        setShareId(id);
        setView('shared');
      }
    } else if (path !== '/' && !path.startsWith('/api')) {
        window.history.pushState({}, '', '/');
    }

    // Check auth
    const token = localStorage.getItem('rakshak_token');
    if (token) {
      try {
        const userData = JSON.parse(localStorage.getItem('rakshak_user') || '');
        setUser(userData);
        if (!path.startsWith('/file/')) setView('dashboard');
      } catch (e) {
        localStorage.removeItem('rakshak_token');
      }
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('rakshak_token');
    localStorage.removeItem('rakshak_user');
    setUser(null);
    setView('landing');
    if (window.location.pathname !== '/') window.history.pushState({}, '', '/');
  };

  if (loading) return null;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <SecurityStyles />
      <div className="fixed inset-0 cyber-grid opacity-20 pointer-events-none" />
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-cyber-bright/5 blur-[150px] rounded-full -mr-48 -mt-48 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-cyber-pink/5 blur-[120px] rounded-full -ml-24 -mb-24 pointer-events-none" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 border-b border-white/5 bg-cyber-black/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setView(user ? 'dashboard' : 'landing')}
          >
            <div className="h-10 w-10 rounded-lg bg-cyber-bright flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)] group-hover:scale-105 transition-transform">
              <Shield className="w-6 h-6 text-black" />
            </div>
            <span className="font-bold text-xl tracking-tighter uppercase">Rakshak</span>
          </div>

          <div className="flex items-center gap-6">
            {user ? (
              <>
                <div className="flex items-center gap-3 px-3 py-1.5 bg-white/5 rounded border border-white/10 hidden md:flex">
                  <div className="h-6 w-6 rounded bg-gradient-to-tr from-cyber-bright to-cyber-pink"></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-white/80 leading-none mb-0.5 whitespace-nowrap overflow-hidden max-w-[100px] text-ellipsis">{user.email.split('@')[0]}</span>
                    <span className="text-[8px] text-white/40 uppercase tracking-widest font-mono">Operator</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              view === 'landing' && (
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => document.getElementById('login-modal')?.classList.remove('hidden')}
                    className="text-sm text-white/60 hover:text-white transition-colors cursor-pointer"
                  >
                    Partner Login
                  </button>
                  <Button onClick={() => document.getElementById('signup-modal')?.classList.remove('hidden')}>
                    Get Started
                  </Button>
                </div>
              )
            )}
          </div>
        </div>
      </nav>

      {/* View Content */}
      <main className="pt-20">
        <AnimatePresence mode="wait">
          {view === 'landing' && <motion.div key="landing"><LandingView /></motion.div>}
          {view === 'dashboard' && <motion.div key="dashboard"><DashboardView user={user!} /></motion.div>}
          {view === 'shared' && <motion.div key="shared"><SharedFileView shareId={shareId!} /></motion.div>}
        </AnimatePresence>
      </main>

      {/* Auth Modals */}
      <AuthModals onAuthSuccess={(u) => { setUser(u); setView('dashboard'); }} />
      
      <footer className="h-12 bg-cyber-gray border-t border-white/5 px-8 flex items-center justify-between text-[10px] font-mono text-white/30 fixed bottom-0 left-0 w-full z-40 backdrop-blur-md">
        <div className="flex gap-6">
          <span>LAT: 37.7749° N</span>
          <span>LONG: 122.4194° W</span>
          <span>STATUS: SYSTEM_READY</span>
        </div>
        <div className="flex gap-4 items-center">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-cyber-bright"></span>
            ENCRYPTION_ENGINE_V4.2
          </span>
          <span>RAKSHAK PRESTIGE v2.1.0</span>
        </div>
      </footer>
    </div>
  );
}

// --- LANDING VIEW ---
function LandingView() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="px-6 py-20 max-w-7xl mx-auto"
    >
      <section className="text-center mb-32 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyber-bright/5 blur-3xl rounded-full" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-bright/10 border border-cyber-bright/20 text-cyber-bright text-xs font-bold uppercase tracking-widest mb-8">
            <Zap className="w-3 h-3" />
            Zero Trust File Sharing
          </div>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-8 leading-[0.9] uppercase italic">
            SECURE THE<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyber-bright to-emerald-600">
              UNSHARABLE.
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-white/40 text-xl mb-12 font-medium">
            RAKSHAK is a zero-trust encrypted link platform where 
            you retain absolute control of your data, even after sharing.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Button size="lg" onClick={() => document.getElementById('signup-modal')?.classList.remove('hidden')}>
              Deploy Node <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="secondary">
              Read Protocol
            </Button>
          </div>
        </motion.div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-32">
        <FeatureCard 
          icon={<Lock className="w-6 h-6 text-cyber-bright" />}
          title="On-Disk AES-256"
          description="Every file is encrypted with a unique key generated on the fly. We never store raw data."
        />
        <FeatureCard 
          icon={<ShieldCheck className="w-6 h-6 text-cyber-bright" />}
          title="Real-Time Grant"
          description="Link recipients cannot open the file until you explicitly approve their request from your node."
        />
        <FeatureCard 
          icon={<Activity className="w-6 h-6 text-cyber-bright" />}
          title="Live Forensic Log"
          description="Track exactly who is trying to access your files, their device, browser, and location."
        />
      </section>

      <section className="glass rounded-3xl p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8">
          <Globe className="w-64 h-64 text-white/5 -rotate-12 translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="max-w-xl">
          <h2 className="text-4xl font-bold mb-6 text-white">Built for High-Stakes Data.</h2>
          <p className="text-white/60 mb-8 leading-relaxed">
            From classified legal documents to sensitive IP, RAKSHAK ensures that 
            even if a link is leaked, your data remains impenetrable. No one gets in 
            without your thumbprint.
          </p>
          <ul className="space-y-4 mb-8">
            <li className="flex items-center gap-3 text-sm font-medium">
              <CheckCircle className="w-5 h-5 text-cyber-bright" />
              Dynamic Watermarking on Shared Previews
            </li>
            <li className="flex items-center gap-3 text-sm font-medium">
              <CheckCircle className="w-5 h-5 text-cyber-bright" />
              Instant Access Revocation
            </li>
            <li className="flex items-center gap-3 text-sm font-medium">
              <CheckCircle className="w-5 h-5 text-cyber-bright" />
              Biometric Verification Support
            </li>
          </ul>
        </div>
      </section>
    </motion.div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="glass p-8 rounded-2xl group hover:border-cyber-bright/30 transition-all">
      <div className="mb-6 p-3 w-fit bg-white/5 rounded-xl group-hover:bg-cyber-bright/10 transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-4 text-white">{title}</h3>
      <p className="text-white/40 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

// --- DASHBOARD VIEW ---
function DashboardView({ user }: { user: User }) {
  const [files, setFiles] = useState<FileRef[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'files' | 'requests'>('files');
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [securityLogs, setSecurityLogs] = useState<{ id: string, msg: string, time: string, type: 'info' | 'warn' | 'success' }[]>([]);

  // Stagger variants for layout entry
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 100 }
    }
  };

  const addLog = (msg: string, type: 'info' | 'warn' | 'success' = 'info') => {
    setSecurityLogs(prev => [{ id: nanoid(5), msg, time: format(new Date(), 'HH:mm:ss'), type }, ...prev].slice(0, 8));
  };

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [filesData, requestsData] = await Promise.all([
        apiRequest('/files'),
        apiRequest('/requests')
      ]);
      
      // Add simulated logs based on data changes
      if (requestsData.length > requests.length) {
        addLog(`INCOMING ACCESS REQUEST DETECTED: ${requestsData[0].requester_email}`, 'warn');
      }
      
      setFiles(filesData);
      setRequests(requestsData);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Auto refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await apiRequest('/files/upload', {
        method: 'POST',
        body: formData,
      });
      fetchData();
      addLog(`DATA UPLOADED & ENCRYPTED`, 'success');
    } catch (e: any) {
      console.error('[RAKSHAK] Upload error:', e);
      alert(`Upload failed: ${e.message}`);
      addLog(`FILE UPLOAD REJECTED`, 'warn');
    } finally {
      setUploading(false);
    }
  };

  const handleRespond = async (requestId: string, status: 'approved' | 'denied') => {
    try {
      await apiRequest(`/requests/${requestId}/respond`, {
        method: 'POST',
        body: { status }
      });
      fetchData();
    } catch (e: any) {
      alert('Action failed: ' + e.message);
    }
  };

  const handleGenerateShare = async (fileId: string) => {
    try {
      const data = await apiRequest(`/files/${fileId}/share`, { method: 'POST' });
      const url = `${window.location.origin}/file/${data.shareId}`;
      await navigator.clipboard.writeText(url);
      addLog(`SECURE LINK GENERATED & COPIED`, 'success');
      alert('One-time secure link generated and copied to clipboard.');
    } catch (e: any) {
      alert('Link generation failed: ' + e.message);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await apiRequest(`/files/${fileId}`, { method: 'DELETE' });
      fetchData();
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    console.log(`[RAKSHAK] PURGING REQUEST: ${id}`);
    try {
      await apiRequest(`/requests/${id}`, { method: 'DELETE' });
      addLog(`REQUEST PURGED FROM SECURE LOGS`, 'success');
      fetchData();
    } catch (e: any) {
      console.error(`[RAKSHAK] PURGE FAILED:`, e);
      addLog(`ERR: PURGE FAILED - ${e.message}`, 'warn');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-6 py-12"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-bold mb-1 tracking-tight text-white uppercase italic">Security Command Center</h2>
          <div className="flex items-center gap-3 text-white/30 text-[10px] font-mono tracking-widest uppercase">
            <span className="flex items-center gap-1.5 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-bright border border-cyber-bright/50 animate-pulse" />
              Node RX-{user.id.substring(0, 4)} Active
            </span>
            <span className="opacity-30">|</span>
            <span>Zero-Trust Protocol V4.2.1</span>
          </div>
        </div>

        <div className="flex gap-3">
          <label className={cn(
            "cyber-button bg-cyber-bright text-black px-6 py-2.5 rounded-sm font-bold text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer cyber-glow",
            uploading && "opacity-50 pointer-events-none"
          )}>
            <Upload className="w-3.5 h-3.5" />
            {uploading ? 'Encrypting...' : 'Upload Data'}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
          <Button variant="secondary" onClick={fetchData} disabled={refreshing} size="sm">
            <Activity className={cn("w-3.5 h-3.5 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Stats Row */}
        <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            label="Active Secure Nodes" 
            value={files.length.toString()} 
            icon={<FileText className="w-4 h-4" />}
            footer="Entropy level stable"
          />
          <StatCard 
            label="Access Intercepts" 
            value={requests.filter(r => r.status === 'pending').length.toString()} 
            color="text-cyber-bright"
            icon={<ShieldCheck className="w-4 h-4" />}
            footer="Awaiting Operator Signoff"
          />
          <StatCard 
            label="Total Data Hardened" 
            value={`${(files.reduce((acc, current) => acc + current.size, 0) / (1024 * 1024)).toFixed(1)} MB`} 
            icon={<Unlock className="w-4 h-4" />}
            footer="AES-256 GCM Standards"
          />
        </div>

        {/* Main Content Area */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          <div className="flex gap-8 border-b border-white/5">
            <TabButton active={activeTab === 'files'} onClick={() => setActiveTab('files')}>Filesystems</TabButton>
            <TabButton active={activeTab === 'requests'} onClick={() => setActiveTab('requests')}>
              Live Stream
              {requests.some(r => r.status === 'pending') && (
                <span className="ml-2 w-1.5 h-1.5 bg-cyber-bright rounded-full animate-pulse" />
              )}
            </TabButton>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'files' ? (
              <motion.div 
                key="files"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {files.length === 0 ? (
                  <EmptyState title="No encrypted files yet" description="Deploy your first secure node to begin sharing." />
                ) : files.map(file => (
                  <motion.div key={file.id} variants={itemVariants} className="group relative">
                     <FileCard file={file} onShare={() => handleGenerateShare(file.id)} onDelete={() => handleDeleteFile(file.id)} />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div 
                key="requests"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {requests.length === 0 ? (
                  <EmptyState title="No access requests" description="Incoming requests will satisfy Zero-Trust conditions here." />
                ) : requests.map(req => (
                  <div key={req.id}><RequestItem request={req} onRespond={handleRespond} onDelete={() => handleDeleteRequest(req.id)} /></div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Sidebar: Security Visualization */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="glass p-8 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden bg-black h-80">
            <div className="absolute inset-0 opacity-10">
              <svg width="100%" height="100%" viewBox="0 0 100 100">
                <motion.circle 
                  cx="50" cy="50" r="45" fill="none" stroke="#10b981" strokeWidth="0.2" 
                  animate={{ r: [45, 48, 45] }}
                  transition={{ duration: 4, repeat: Infinity }}
                />
                <motion.circle 
                  cx="50" cy="50" r="30" fill="none" stroke="#10b981" strokeWidth="0.2" 
                  animate={{ r: [30, 33, 30] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <circle cx="50" cy="50" r="15" fill="none" stroke="#10b981" strokeWidth="0.2" />
                <line x1="50" y1="5" x2="50" y2="95" stroke="#10b981" strokeWidth="0.2" />
                <line x1="5" y1="50" x2="95" y2="50" stroke="#10b981" strokeWidth="0.2" />
              </svg>
            </div>
            <div className="relative flex flex-col items-center">
              <motion.div 
                animate={{ 
                  boxShadow: ["0 0 20px rgba(16,185,129,0.1)", "0 0 50px rgba(16,185,129,0.4)", "0 0 20px rgba(16,185,129,0.1)"],
                  scale: [1, 1.05, 1],
                  rotate: [0, 90, 180, 270, 360]
                }}
                transition={{ 
                  boxShadow: { duration: 3, repeat: Infinity },
                  scale: { duration: 3, repeat: Infinity },
                  rotate: { duration: 20, repeat: Infinity, ease: "linear" }
                }}
                className="w-32 h-32 rounded-full border-2 border-dashed border-cyber-bright/30 flex items-center justify-center bg-cyber-bright/5 relative"
              >
                <div className="absolute inset-0 rounded-full border border-cyber-bright/10" />
                <div className="text-center relative z-10">
                  <motion.div 
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-[10px] font-mono text-cyber-bright uppercase tracking-[0.2em] mb-1 font-bold"
                  >
                    Stable
                  </motion.div>
                  <div className="text-4xl font-bold tracking-tighter text-white font-mono">99.9<span className="text-cyber-bright/40 text-xl font-bold tracking-widest">%</span></div>
                </div>
              </motion.div>
              <div className="mt-8 flex flex-col items-center gap-2">
                <p className="text-[10px] font-mono text-cyber-bright/60 tracking-[0.3em] uppercase font-bold">Neural Cryptography Active</p>
                <div className="flex gap-1.5 h-4 items-end">
                  {[...Array(8)].map((_, i) => (
                    <motion.div 
                      key={i} 
                      animate={{ 
                        height: [8, 16, 8],
                        opacity: [0.3, 1, 0.3],
                        backgroundColor: ["#10b981", "#34d399", "#10b981"]
                      }}
                      transition={{ 
                        duration: 1.5, 
                        delay: i * 0.1, 
                        repeat: Infinity 
                      }}
                      className="w-1 bg-cyber-bright rounded-full" 
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="glass p-6 rounded-2xl space-y-4 border-white/5 bg-black/40">
             <h3 className="text-[10px] font-bold text-cyber-bright uppercase tracking-[0.2em] flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-cyber-bright animate-pulse" />
               Live Security Pulse
             </h3>
             <div className="space-y-4 max-h-[300px] overflow-hidden">
               {securityLogs.length === 0 ? (
                 <div className="text-[9px] font-mono text-white/10 uppercase tracking-widest py-4 text-center">Monitoring Handshakes...</div>
               ) : securityLogs.map(log => (
                 <motion.div 
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   key={log.id} 
                   className="flex gap-3 text-[9px] font-mono leading-tight"
                 >
                   <span className="text-white/20 whitespace-nowrap">[{log.time}]</span>
                   <span className={cn(
                     "uppercase tracking-tighter",
                     log.type === 'success' ? "text-cyber-bright" : 
                     log.type === 'warn' ? "text-orange-500" : "text-white/60"
                   )}>
                     {log.msg}
                   </span>
                 </motion.div>
               ))}
             </div>
          </div>

          <div className="glass p-6 rounded-2xl space-y-4">
             <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Environmental Data</h3>
             <div className="space-y-3">
               <div className="flex justify-between text-[10px] font-mono">
                 <span className="text-white/20 uppercase">Network Latency</span>
                 <span>12.4ms</span>
               </div>
               <div className="flex justify-between text-[10px] font-mono">
                 <span className="text-white/20 uppercase">Threat Level</span>
                 <span className="text-cyber-bright">Minimal</span>
               </div>
               <div className="flex justify-between text-[10px] font-mono">
                 <span className="text-white/20 uppercase">Node Uptime</span>
                 <span>142:12:08</span>
               </div>
             </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, icon, footer, color = "text-white" }: { label: string, value: string, icon: React.ReactNode, footer: string, color?: string }) {
  return (
    <div className="glass p-6 rounded-2xl relative overflow-hidden group">
      <div className="absolute top-2 right-2 p-2 bg-white/5 rounded-lg opacity-30 group-hover:opacity-100 transition-opacity">
        {icon}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-bold">{label}</div>
      <div className={cn("text-3xl font-mono font-bold mb-2", color)}>{value}</div>
      <div className="text-[10px] text-white/20 font-mono italic">{footer}</div>
    </div>
  );
}


function StatItem({ label, value, icon, color = "text-white" }: { label: string, value: string, icon: React.ReactNode, color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-white/40 text-xs text-left">
        {icon}
        {label}
      </div>
      <span className={cn("font-bold", color)}>{value}</span>
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean, children: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-bold tracking-widest uppercase transition-all relative cursor-pointer",
        active ? "text-cyber-bright" : "text-white/40 hover:text-white"
      )}
    >
      {children}
      {active && <motion.div layoutId="tab" className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-cyber-bright" />}
    </button>
  );
}

function FileCard({ file, onShare, onDelete }: { file: FileRef, onShare: () => void, onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<any>(null);

  const startConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirming) {
      console.log(`[RAKSHAK] CONFIRMED SHRED FOR: ${file.id}`);
      handleFinalDelete();
    } else {
      console.log(`[RAKSHAK] INITIAL SHRED REQ: ${file.id}`);
      setConfirming(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setConfirming(false);
        console.log(`[RAKSHAK] SHRED CONFIRM EXPIRED`);
      }, 5000); // Give 5s to confirm on mobile
    }
  };

  const handleFinalDelete = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(false);
    onDelete();
  };

  return (
    <div className="glass p-6 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors relative group">
      <div className="flex justify-between items-start mb-6 text-left">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/5 rounded-lg group-hover:bg-cyber-bright/10 transition-colors">
            <FileLock className="w-5 h-5 text-white/40 group-hover:text-cyber-bright transition-colors" />
          </div>
          <div className="text-left">
            <h4 className="font-bold text-sm truncate max-w-[150px] text-white/90">{file.original_name}</h4>
            <p className="text-white/20 text-[9px] uppercase font-mono tracking-widest mt-0.5">
              {(file.size / (1024 * 1024)).toFixed(2)} MB · SECURED
            </p>
          </div>
        </div>
        {file.pending_requests > 0 && !confirming && (
          <div className="px-2 py-0.5 bg-cyber-bright/10 text-cyber-bright text-[9px] font-bold rounded uppercase animate-pulse border border-cyber-bright/20">
            {file.pending_requests} Pending
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button 
          variant="secondary" 
          size="sm" 
          className={cn(
            "flex-1 text-[10px] tracking-widest flex items-center justify-center font-bold transition-all",
            confirming && "opacity-0 pointer-events-none scale-90"
          )} 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onShare(); }}
        >
          <Share2 className="w-3.5 h-3.5 mr-2" /> GENERATE LINK
        </Button>
        <Button
          id={`shred-btn-${file.id}`}
          variant={confirming ? "primary" : "danger"}
          size={confirming ? "md" : "icon"}
          className={cn(
            "h-10 transition-all duration-300",
            confirming ? "flex-1 text-[10px] bg-red-600 hover:bg-red-500 animate-pulse border-red-400" : "w-10 hover:bg-red-500/30 border-red-500/40"
          )}
          onClick={startConfirm}
          title="SHRED NODE"
        >
          {confirming ? <span className="flex items-center gap-2 px-2 uppercase font-black tracking-tighter">Confirm Shred?</span> : <Trash2 className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

function RequestItem({ request, onRespond, onDelete }: { request: AccessRequest, onRespond: (id: string, s: 'approved' | 'denied') => void, onDelete: () => void }) {
  return (
    <div className="glass p-5 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/[0.01] hover:bg-white/[0.02] transition-colors border border-white/5 active:border-white/10 group">
      <div className="flex gap-4">
        <div className={cn(
          "p-2.5 rounded bg-white/5 flex items-center justify-center",
          request.status === 'pending' ? "text-orange-500" : 
          request.status === 'approved' ? "text-cyber-bright" : "text-red-500"
        )}>
           <Shield className="w-5 h-5" />
        </div>
        <div className="text-left">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-sm text-white/90 truncate max-w-[120px]">{request.file_name}</span>
            <span className="text-white/20 text-[10px] font-mono">/ {request.requester_email}</span>
          </div>
          <div className="flex items-center gap-4 text-white/20 text-[9px] uppercase tracking-[0.15em] font-mono">
            <span className="flex items-center gap-1.5">
              {request.device_info.toLowerCase().includes('mobile') ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
              {request.device_info}
            </span>
            <span className="opacity-40">|</span>
            <span>{request.browser_info}</span>
            <span className="opacity-40">|</span>
            <span>{format(new Date(request.created_at), 'MMM d, HH:mm:ss')}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 w-full md:w-auto relative z-30">
        {request.status === 'pending' ? (
          <div className="flex gap-2 flex-1 md:flex-none">
            <Button 
              id={`approve-request-${request.id}`}
              size="sm"
              className="flex-1 md:flex-none uppercase tracking-widest text-[10px] font-bold"
              onClick={(e) => { e.stopPropagation(); onRespond(request.id, 'approved'); }}
            >
              Approve
            </Button>
            <Button 
              id={`deny-request-${request.id}`}
              variant="secondary"
              size="sm"
              className="flex-1 md:flex-none uppercase tracking-widest text-[10px] font-bold text-red-400 border-red-500/20 hover:bg-red-500/10"
              onClick={(e) => { e.stopPropagation(); onRespond(request.id, 'denied'); }}
            >
              Deny
            </Button>
          </div>
        ) : (
          <div className={cn(
            "px-4 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest border",
            request.status === 'approved' ? "text-cyber-bright border-cyber-bright/20 bg-cyber-bright/5" : "text-red-500 border-red-500/20 bg-red-500/5"
          )}>
            {request.status}
          </div>
        )}
        <Button
          id={`delete-request-btn-${request.id}`}
          variant="ghost"
          size="sm"
          className="w-10 h-10 p-0 opacity-100 md:opacity-0 group-hover:opacity-100 hover:bg-red-500/10"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <Trash2 className="w-4 h-4 text-white/20 group-hover:text-red-500 transition-colors" />
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string, description: string }) {
  return (
    <div className="col-span-full py-20 glass rounded-3xl flex flex-col items-center justify-center text-center px-6 border-dashed border-white/10">
      <Shield className="w-12 h-12 text-white/10 mb-6" />
      <h4 className="text-xl font-bold mb-2 text-white">{title}</h4>
      <p className="text-white/40 text-sm max-w-xs">{description}</p>
    </div>
  );
}

// --- SHARED FILE VIEW ---
function SharedFileView({ shareId }: { shareId: string }) {
  const [file, setFile] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [requestId, setRequestId] = useState<string | null>(() => localStorage.getItem(`req_${shareId}`));
  const [requestStatus, setRequestStatus] = useState<string>(() => localStorage.getItem(`req_${shareId}`) ? 'pending' : 'none');
  const [startSession, setStartSession] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchFile = async () => {
      try {
        const rid = localStorage.getItem(`req_${shareId}`);
        // If we have a requestId, try to fetch file with it to check status immediately
        const data = await apiRequest(`/share/${shareId}${rid ? `?requestId=${rid}` : ''}`);
        if (!isMounted) return;
        setFile(data);
        if (rid) setRequestId(rid);
      } catch (e: any) {
        if (!isMounted) return;
        setError(e.message || 'SECURE LINK EXPIRED OR COMPROMISED');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchFile();
    return () => { isMounted = false; };
  }, [shareId]);

  useEffect(() => {
    if (requestStatus === 'approved' && !startSession) {
      console.log("[RAKSHAK] ACCESS GRANTED: EXECUTING AUTO-HANDSHAKE");
      // Immediate open as soon as approved is detected
      setStartSession(true);
    }
  }, [requestStatus, startSession]);

  useEffect(() => {
    let timeoutId: any;
    let isMounted = true;
    
    const pollStatus = async () => {
      if (!requestId || !shareId || !isMounted) return;
      try {
        const data = await apiRequest(`/share/${shareId}/status/${requestId}`);
        if (!isMounted) return;
        
        setRequestStatus(data.status);
        
        if (data.status === 'pending') {
          timeoutId = setTimeout(pollStatus, 1500);
        } else if (data.status === 'denied') {
           if (data.reason === 'expired') {
              setError('SECURE SESSION EXPIRED: ONE-TIME VIEW LIMIT EXCEEDED');
           }
        } else if (data.status === 'approved' && !startSession) {
          // Continue polling even when approved to check for expiration if they haven't opened it yet
          timeoutId = setTimeout(pollStatus, 3000);
        }
      } catch (e: any) {
        if (!isMounted) return;
        if (e.message.includes('not found') || e.message.includes('expired') || e.message.includes('Unauthorized')) {
           setError(e.message);
        } else {
           timeoutId = setTimeout(pollStatus, 5000);
        }
      }
    };

    if (requestId && requestStatus !== 'denied' && !error) {
      pollStatus();
    }

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [shareId, requestId, startSession, error]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const browser = navigator.userAgent.split(') ')[1]?.split(' ')[0] || 'Generic Browser';
      const device = /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile Device' : 'Workstation';
      
      const data = await apiRequest(`/share/${shareId}/request`, {
        method: 'POST',
        body: { email, browser, device }
      });
      const rid = data.requestId;
      setRequestId(rid);
      localStorage.setItem(`req_${shareId}`, rid);
      setRequestStatus('pending');
    } catch (e: any) {
      setError(`Handshake request failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 min-h-[60vh] bg-[#050507]">
      <Activity className="w-12 h-12 text-cyber-bright animate-spin mb-4" />
      <span className="text-sm font-mono tracking-widest text-cyber-bright uppercase">Decrypting Shared Node...</span>
    </div>
  );

  if (error) return (
    <div className="max-w-md mx-auto py-20 px-6 text-center min-h-[60vh] flex flex-col justify-center items-center bg-[#050507]">
      <div className="glass p-12 rounded-3xl border-red-500/20 bg-black/40">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-red-500 mb-4 uppercase tracking-widest leading-tight">{error}</h2>
        <p className="text-white/40 text-[10px] uppercase tracking-widest mb-8">Access restricted by Rakshak Protocols. Your identity verification might have expired.</p>
        <Button 
          id="retry-request-button"
          onClick={() => {
            localStorage.removeItem(`req_${shareId}`);
            window.location.reload();
          }}
          className="w-full bg-white/5 border border-white/10 text-[10px] tracking-[0.3em] font-bold py-4 hover:bg-white/10"
        >
          Initialize New Request
        </Button>
      </div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto px-4 py-12 min-h-[70vh] flex items-center justify-center bg-[#050507]"
    >
      <div className={cn("glass rounded-3xl relative overflow-hidden w-full bg-[#08080a] transition-all duration-500", requestStatus === 'approved' && !startSession ? 'max-w-md' : 'max-w-4xl')}>
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Shield className="w-48 h-48 -rotate-12 translate-x-1/3 -translate-y-1/3 text-cyber-bright" />
        </div>

        <div className="p-8 md:p-12">
          {requestStatus === 'approved' && startSession ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-cyber-bright/20 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-cyber-bright" />
                  </div>
                  <h2 className="text-sm font-bold text-white tracking-tight">{file.original_name}</h2>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[8px] font-mono text-red-500 tracking-widest uppercase">Live Session</span>
                </div>
              </div>
              
              <div className="relative group min-h-[500px] w-full bg-black/40 rounded-xl overflow-hidden border border-white/5">
                <SecureViewer 
                  url={`/api/share/${shareId}/view/${requestId}`} 
                  mimetype={file.mimetype}
                  originalName={file.original_name}
                />
              </div>


              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl text-left relative overflow-hidden">
                <div className="absolute top-0 left-0 h-full w-1 bg-cyber-bright opacity-20" />
                <p className="text-[9px] text-white/30 leading-relaxed uppercase tracking-wider font-mono">
                  SECURITY PROTOCOL: One-time view session. 
                  Handshake ID: {requestId?.substring(0, 12)}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-5 mb-10">
                <div className="h-14 w-14 rounded-xl bg-cyber-bright flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  <FileText className="w-7 h-7 text-black" />
                </div>
                <div className="text-left">
                  <h2 className="text-2xl font-bold text-white tracking-tight">{file.original_name}</h2>
                  <p className="text-cyber-bright text-[10px] font-mono uppercase tracking-[0.2em] font-bold">
                    {requestStatus === 'approved' ? 'Handshake Confirmed' : 'Encrypted Session Pending'}
                  </p>
                </div>
              </div>

              <div className="space-y-8">
                {requestStatus === 'none' && (
                  <form onSubmit={handleRequest} className="space-y-4">
                    <p className="text-white/40 text-sm leading-relaxed mb-6 text-left">
                      Identity verification required. Your request will be transmitted to the 
                      node owner for real-time cryptographic approval.
                    </p>
                    <Input 
                      id="requester-email-share"
                      type="email" 
                      placeholder="ENTER YOUR AUTHORIZED EMAIL" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      required 
                      className="bg-black/40 border-white/5 h-14 text-xs tracking-widest uppercase"
                    />
                    <Button id="initiate-handshake-button" size="lg" className="w-full text-xs tracking-[0.3em] uppercase font-black py-4 cyber-glow">
                      Verify Identity
                    </Button>
                  </form>
                )}

                {requestStatus === 'pending' && (
                  <div className="text-center py-10 space-y-6">
                    <div className="relative w-20 h-20 mx-auto">
                      <div className="absolute inset-0 rounded-full border-2 border-cyber-bright/20 animate-ping"></div>
                      <div className="relative z-10 w-20 h-20 bg-cyber-bright/10 rounded-full flex items-center justify-center border border-cyber-bright/30">
                        <Clock className="w-8 h-8 text-cyber-bright" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold tracking-tight text-white uppercase italic">Awaiting Signoff</h3>
                      <p className="text-white/30 text-[10px] font-mono max-w-xs mx-auto uppercase tracking-widest">
                        Waiting for owner approval...<br />
                        Keep this terminal active.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-3 text-[9px] text-cyber-bright font-mono uppercase tracking-widest pt-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyber-bright animate-pulse" />
                      Encrypted Link Active
                    </div>
                  </div>
                )}

                {requestStatus === 'approved' && (
                  <div className="text-center py-6 space-y-8">
                    <div className="w-20 h-20 bg-cyber-bright/10 text-cyber-bright rounded-full flex items-center justify-center mx-auto border border-cyber-bright/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                      <Unlock className="w-10 h-10" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-white uppercase italic tracking-tighter">Access Authorized</h3>
                      <p className="text-white/40 text-[10px] max-w-[280px] mx-auto uppercase tracking-widest leading-relaxed">
                        The owner has signed off. Your one-time disposable session is ready.
                      </p>
                    </div>
                    <Button 
                      id="open-file-access-button"
                      size="lg" 
                      className="w-full py-6 text-[11px] tracking-[0.4em] font-black uppercase cyber-glow shadow-[0_0_40px_rgba(16,185,129,0.3)]" 
                      disabled={startSession}
                      onClick={(e) => {
                        e.preventDefault();
                        console.log("[RAKSHAK] MANUAL OVERRIDE: OPENING SECURE SESSION");
                        setStartSession(true);
                      }}
                    >
                      {startSession ? (
                        <span className="flex items-center gap-2">
                           <Loader2 className="w-4 h-4 animate-spin" />
                           Decrypting...
                        </span>
                      ) : "Open Secure File"}
                    </Button>

                  </div>
                )}

                {requestStatus === 'denied' && (
                  <div className="text-center py-8 space-y-6">
                    <XCircle className="w-20 h-20 text-red-500 mx-auto" />
                    <div>
                      <h3 className="text-2xl font-bold text-red-500 uppercase italic">Entry Denied</h3>
                      <p className="text-white/40 text-sm mt-2">The owner for this file has rejected your access request.</p>
                    </div>
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] uppercase font-mono text-red-500 tracking-widest">
                      Security violation logged.
                    </div>
                    <Button 
                      variant="ghost" 
                      className="text-[10px] uppercase tracking-widest text-white/20 hover:text-white"
                      onClick={() => {
                        localStorage.removeItem(`req_${shareId}`);
                        window.location.reload();
                      }}
                    >
                      Try with another identity
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// --- AUTH MODALS ---
function AuthModals({ onAuthSuccess }: { onAuthSuccess: (u: User) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      localStorage.setItem('rakshak_token', data.token);
      localStorage.setItem('rakshak_user', JSON.stringify(data.user));
      onAuthSuccess(data.user);
      document.getElementById('login-modal')?.classList.add('hidden');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest('/auth/signup', {
        method: 'POST',
        body: { email, password }
      });
      alert('Node initialized. You can now login.');
      document.getElementById('signup-modal')?.classList.add('hidden');
      document.getElementById('login-modal')?.classList.remove('hidden');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .modal-overlay {
          background: rgba(5, 5, 6, 0.8);
          backdrop-filter: blur(12px);
        }
      `}</style>
      {/* Login Modal */}
      <div id="login-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-6 modal-overlay hidden">
        <div className="glass p-10 rounded-2xl w-full max-w-md relative bg-[#08080a] border-white/5 shadow-2xl">
          <button className="absolute top-6 right-6 text-white/20 hover:text-white cursor-pointer transition-colors" onClick={() => document.getElementById('login-modal')?.classList.add('hidden')}>
            <XCircle className="w-5 h-5" />
          </button>
          <div className="text-center mb-10">
            <div className="h-12 w-12 rounded-lg bg-cyber-bright/10 flex items-center justify-center mx-auto mb-4 border border-cyber-bright/20">
              <Shield className="w-6 h-6 text-cyber-bright" />
            </div>
            <h3 className="text-2xl font-bold uppercase tracking-[0.2em] italic text-white leading-none">Access Node</h3>
            <p className="text-white/30 text-xs mt-3 font-mono">Verify Operator Credentials</p>
          </div>
          <form className="space-y-4" onSubmit={handleLogin}>
            <Input type="email" placeholder="Operator Email" value={email} onChange={e => setEmail(e.target.value)} required className="bg-black/40" />
            <Input type="password" placeholder="Passphrase" value={password} onChange={e => setPassword(e.target.value)} required className="bg-black/40" />
            <Button size="lg" className="w-full text-xs tracking-widest uppercase font-bold py-4 mt-4" disabled={loading}>
              {loading ? 'Authenticating...' : 'Establish Secure Link'}
            </Button>
          </form>
          <div className="mt-8 text-center text-[9px] text-white/10 font-mono tracking-[0.2em] uppercase">
            End-to-End TLS Encryption Active
          </div>
        </div>
      </div>

      {/* Signup Modal */}
      <div id="signup-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-6 modal-overlay hidden">
        <div className="glass p-10 rounded-2xl w-full max-w-md relative bg-[#08080a] border-white/5 shadow-2xl">
          <button className="absolute top-6 right-6 text-white/20 hover:text-white cursor-pointer transition-colors" onClick={() => document.getElementById('signup-modal')?.classList.add('hidden')}>
            <XCircle className="w-5 h-5" />
          </button>
          <div className="text-center mb-10">
             <div className="h-12 w-12 rounded-lg bg-cyber-bright/10 flex items-center justify-center mx-auto mb-4 border border-cyber-bright/20">
              <Zap className="w-6 h-6 text-cyber-bright" />
            </div>
            <h3 className="text-2xl font-bold uppercase tracking-[0.2em] italic text-white leading-none">Initialize</h3>
            <p className="text-white/30 text-xs mt-3 font-mono">Register new RAKSHAK node</p>
          </div>
          <form className="space-y-4" onSubmit={handleSignup}>
            <Input type="email" placeholder="Operator Email" value={email} onChange={e => setEmail(e.target.value)} required className="bg-black/40" />
            <Input type="password" placeholder="Define Passphrase" value={password} onChange={e => setPassword(e.target.value)} required className="bg-black/40" />
            <Button size="lg" className="w-full text-xs tracking-widest uppercase font-bold py-4 mt-4" disabled={loading}>
              {loading ? 'Initializing...' : 'Activate Node'}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
