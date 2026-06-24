import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import ChatInterface from './components/ChatInterface';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <div className="min-h-screen text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
        
        {/* Abstract Background Elements for Premium Feel */}
        <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-fuchsia-600/20 blur-[120px]"></div>
        </div>

        {/* Navigation Bar */}
        <header className="px-8 py-4 border-b border-white/5 glass-panel sticky top-0 z-50 animate-fade-in flex justify-between items-center">
          <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent drop-shadow-sm tracking-tight">
              AlansChat
            </h1>
          </a>
          
          {/* Clerk Interactive Control Nodes */}
          <div className="flex items-center gap-4">
            <SignedIn>
              <div className="hover-lift">
                <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "w-10 h-10 border-2 border-indigo-500/50 hover:border-indigo-400 transition-colors" } }} />
              </div>
            </SignedIn>
            <SignedOut>
              <div className="hover-lift">
                <SignInButton mode="modal">
                  <button className="px-6 py-2.5 rounded-full bg-white text-slate-900 font-semibold text-sm transition-all shadow-lg hover:shadow-xl hover:shadow-indigo-500/20 hover:scale-105 active:scale-95">
                    Acquire Access
                  </button>
                </SignInButton>
              </div>
            </SignedOut>
          </div>
        </header>

        {/* Core Layout Window Viewports */}
        <main className="flex-1 flex flex-col md:p-8 p-4 max-w-7xl w-full mx-auto justify-center min-h-0">
          <SignedIn>
            <div className="animate-fade-in w-full h-full flex items-center justify-center min-h-0">
              <ChatInterface />
            </div>
          </SignedIn>
          <SignedOut>
            <div className="flex flex-col items-center justify-center h-[70vh] animate-fade-in text-center">
              <div className="w-24 h-24 mb-8 rounded-full bg-gradient-to-tr from-slate-800 to-slate-900 border border-white/5 flex items-center justify-center hover-lift shadow-2xl shadow-indigo-500/10">
                <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              </div>
              <h2 className="text-5xl font-extrabold tracking-tight mb-6 bg-gradient-to-br from-indigo-300 via-fuchsia-300 to-rose-300 bg-clip-text text-transparent drop-shadow-sm">Re-imagining Realtime Sync</h2>
              <p className="text-slate-300 max-w-xl text-lg leading-relaxed shadow-sm">
                AlansChat is an enterprise-grade communications matrix for teams that demand absolute speed. Combining surgical WebSocket persistence with breathtaking aesthetics—giving you a conversational interface where every pixel flows seamlessly.
              </p>
            </div>
          </SignedOut>
        </main>
        
        {/* Footer */}
        <footer className="py-6 w-full text-center text-slate-500 hover:text-slate-400 transition-colors text-sm mt-auto border-t border-white/5 bg-slate-950/20 backdrop-blur-sm z-10">
          &copy; {new Date().getFullYear()} Michael Alans. All rights reserved.
        </footer>
      </div>
    </ClerkProvider>
  );
}