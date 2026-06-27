import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  Settings, 
  Search, 
  LogOut, 
  Database, 
  ChevronDown, 
  Menu, 
  X
} from 'lucide-react';
import Sidebar from './Sidebar';
import Card from './ui/Card';

export default function Layout({
  children,
  isAuthenticated,
  view,
  setView,
  sessionId,
  sessions,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  onClearSessions,
  activeDocument,
  setActiveDocument,
  sessionDocuments,
  onDeleteDocument,
  onUploadSuccess,
  onLogout,
  activeTab,
  onChangeTab,
  userRole = 'user',
  tokensLeft,
  onResetTokens
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const profileRef = useRef(null);
  const notifRef = useRef(null);

  const username = localStorage.getItem('rag_username') || "Viswateja";
  const userEmail = `${username.toLowerCase()}@enterprise.ai`;
  const userInitials = username.slice(0, 2).toUpperCase();

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', next.toString());
      return next;
    });
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    alert(`Global search results for: "${searchQuery}"`);
    setSearchQuery('');
  };

  const notifications = [
    { id: 1, text: "System is online and running stable.", time: "Just now" },
    { id: 2, text: "FAISS vector indexes are fully synchronized.", time: "1 hour ago" },
    { id: 3, text: "Your session backup was successfully stored.", time: "Yesterday" }
  ];

  return (
    <div className="flex h-screen bg-[#F5F7FA] text-[#1E293B] overflow-hidden font-sans">
      
      {/* Sidebar - collapsible transition */}
      {isAuthenticated && (view === 'chat' || view === 'dashboard') && (
        <div className={`hidden md:flex h-full shrink-0 transition-all duration-300 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}>
          <Sidebar
            isCollapsed={sidebarCollapsed}
            userRole={userRole}
            sessionId={sessionId}
            sessions={sessions}
            onSelectSession={onSelectSession}
            onDeleteSession={onDeleteSession}
            onNewChat={onNewChat}
            onClearSessions={onClearSessions}
            activeDocument={activeDocument}
            setActiveDocument={setActiveDocument}
            sessionDocuments={sessionDocuments}
            onDeleteDocument={onDeleteDocument}
            onUploadSuccess={onUploadSuccess}
            onLogout={onLogout}
            onOpenDashboard={() => setView('dashboard')}
            onOpenSettings={() => setSettingsOpen(true)}
            activeTab={activeTab}
            onChangeTab={onChangeTab}
            tokensLeft={tokensLeft}
            onResetTokens={onResetTokens}
          />
        </div>
      )}

      {/* Main Panel Content Frame */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Header - Enforce clean border color #E2E8F0 and white background */}
        <header className="h-16 border-b border-[#E2E8F0] bg-white px-6 flex items-center justify-between shrink-0 z-20 shadow-sm">
          <div className="flex items-center space-x-4">
            {/* Sidebar toggle button */}
            {isAuthenticated && (view === 'chat' || view === 'dashboard') && (
              <>
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="md:hidden text-[#64748B] hover:text-[#1E293B] transition-colors"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <button
                  onClick={toggleSidebar}
                  className="hidden md:flex text-[#64748B] hover:text-[#1E293B] transition-colors"
                  title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                  <Menu className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Logo and Brand */}
            <div className="flex items-center space-x-2.5 select-none">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-[#E2E8F0] flex items-center justify-center shadow-sm">
                <Database className="w-4 h-4 text-[#6366F1]" />
              </div>
              <span className="font-extrabold text-sm tracking-wide text-[#1E293B]">
                DocVerse AI
              </span>
            </div>
          </div>

          {/* Header Action Items */}
          <div className="flex items-center space-x-4">
            {/* Search Input Box */}
            {isAuthenticated && (
              <form onSubmit={handleSearchSubmit} className="hidden sm:flex relative items-center">
                <input
                  type="text"
                  placeholder="Global search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 lg:w-64 py-1.5 pl-9 pr-4 bg-white border border-[#E2E8F0] rounded-xl text-xs outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all duration-300"
                />
                <Search className="absolute left-3 w-3.5 h-3.5 text-[#64748B]" />
              </form>
            )}

            {/* Notifications Menu */}
            {isAuthenticated && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#64748B] hover:text-[#1E293B] transition-colors relative"
                >
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full" />
                </button>

                <AnimatePresence>
                  {notificationsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-72 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-4 text-xs z-50 select-text"
                    >
                      <h4 className="font-extrabold text-[#1E293B] border-b border-[#E2E8F0] pb-2 mb-2 select-none">
                        Notifications
                      </h4>
                      <div className="space-y-3">
                        {notifications.map(notif => (
                          <div key={notif.id} className="flex flex-col space-y-0.5 hover:bg-slate-50 p-1 rounded-lg transition-all">
                            <p className="text-[#1E293B] font-medium">{notif.text}</p>
                            <span className="text-[9px] text-[#64748B]">{notif.time}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Profile Dropdown Menu */}
            {isAuthenticated && (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center space-x-1.5 p-1.5 rounded-xl hover:bg-slate-100 transition-all outline-none"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white font-extrabold text-xs shadow-sm">
                    {userInitials}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
                </button>

                <AnimatePresence>
                  {profileDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-56 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-2.5 text-xs z-50"
                    >
                      <div className="px-3.5 py-2.5 border-b border-[#E2E8F0] mb-1.5 select-text">
                        <div className="flex items-center space-x-1.5">
                          <p className="font-extrabold text-[#1E293B]">{username}</p>
                          {userRole === 'admin' && (
                            <span className="text-[8px] bg-indigo-50 text-indigo-650 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider border border-indigo-200 shrink-0">Admin</span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#64748B] truncate">{userEmail}</p>
                      </div>
                      
                      <button
                        onClick={() => {
                          setSettingsOpen(true);
                          setProfileDropdownOpen(false);
                        }}
                        className="w-full flex items-center space-x-2 px-3.5 py-2 hover:bg-slate-50 rounded-xl text-[#64748B] hover:text-[#1E293B] font-bold transition-all text-left"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Settings Preferences</span>
                      </button>
                      
                      {userRole === 'admin' && view === 'chat' && (
                        <button
                          onClick={() => {
                            setView('dashboard');
                            setProfileDropdownOpen(false);
                          }}
                          className="w-full flex items-center space-x-2 px-3.5 py-2 hover:bg-slate-50 rounded-xl text-[#64748B] hover:text-[#1E293B] font-bold transition-all text-left"
                        >
                          <Database className="w-3.5 h-3.5 text-[#6366F1]" />
                          <span>Admin Console</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          onLogout();
                          setProfileDropdownOpen(false);
                        }}
                        className="w-full flex items-center space-x-2 px-3.5 py-2 hover:bg-rose-50 rounded-xl text-rose-605 font-bold transition-all text-left"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Page Component Canvas */}
        <main className="flex-1 overflow-hidden relative bg-[#F5F7FA]">
          {children}
        </main>

        {/* Minimalist Professional Footer */}
        <footer className="h-10 border-t border-[#E2E8F0] bg-white px-6 flex items-center justify-center text-[9px] text-[#64748B] uppercase tracking-widest font-mono shrink-0 select-none">
          <span>© 2026 DocVerse AI | Privacy Policy | Terms of Service | Version 2.1.0</span>
        </footer>
      </div>

      {/* Settings Preferences Modal */}
      <AnimatePresence>
        {settingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSettingsOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg z-10 bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4 mb-4 select-none">
                <h3 className="text-lg font-extrabold text-[#1E293B] flex items-center gap-2">
                  <Settings className="w-4 h-4 text-indigo-500" />
                  <span>Settings Preferences</span>
                </h3>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#64748B] hover:text-[#1E293B] transition-all focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-5 text-xs text-[#1E293B] select-text max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
                <div className="bg-[#F5F7FA] p-3.5 rounded-xl border border-[#E2E8F0]">
                  <h4 className="font-extrabold text-[#1E293B] uppercase tracking-widest text-[9px] mb-2 select-none">User Account</h4>
                  <p><strong>Username:</strong> {username}</p>
                  <p className="mt-1"><strong>Default Email:</strong> {userEmail}</p>
                </div>

                <div className="bg-[#F5F7FA] p-3.5 rounded-xl border border-[#E2E8F0] font-mono">
                  <h4 className="font-extrabold text-[#1E293B] uppercase tracking-widest text-[9px] mb-2 select-none">Keyboard Shortcuts</h4>
                  <div className="space-y-1 text-[10px] leading-relaxed">
                    <p><kbd className="px-1.5 py-0.5 rounded bg-white font-bold border border-[#E2E8F0]">Enter</kbd> : Send Message</p>
                    <p><kbd className="px-1.5 py-0.5 rounded bg-white font-bold border border-[#E2E8F0]">Shift + Enter</kbd> : New Line</p>
                    <p><kbd className="px-1.5 py-0.5 rounded bg-white font-bold border border-[#E2E8F0]">Ctrl + A</kbd> : Select Input text</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Drawer Sidebar panel overlay - w-64 collapsible */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ x: -256 }}
            animate={{ x: 0 }}
            exit={{ x: -256 }}
            transition={{ type: 'tween', duration: 0.2 }}
            className="relative w-64 h-full flex flex-col"
          >
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-[#1E293B] transition-colors z-50"
            >
              <X className="w-5 h-5" />
            </button>
            <Sidebar
              userRole={userRole}
              sessionId={sessionId}
              sessions={sessions}
              onSelectSession={(id) => {
                onSelectSession(id);
                setMobileMenuOpen(false);
              }}
              onDeleteSession={onDeleteSession}
              onNewChat={() => {
                onNewChat();
                setMobileMenuOpen(false);
              }}
              onClearSessions={onClearSessions}
              activeDocument={activeDocument}
              setActiveDocument={setActiveDocument}
              sessionDocuments={sessionDocuments}
              onDeleteDocument={onDeleteDocument}
              onUploadSuccess={onUploadSuccess}
              onLogout={onLogout}
              onOpenDashboard={() => {
                setView('dashboard');
                setMobileMenuOpen(false);
              }}
              activeTab={activeTab}
              onChangeTab={onChangeTab}
              tokensLeft={tokensLeft}
              onResetTokens={onResetTokens}
            />
          </motion.div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

    </div>
  );
}
