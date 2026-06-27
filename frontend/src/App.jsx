import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, 
  X, 
  Database,
  GraduationCap,
  Network,
  Eye,
  BookOpen,
  ArrowRight,
  HelpCircle,
  CheckCircle,
  XCircle,
  FileDown,
  RefreshCw,
  Search
} from 'lucide-react';
import { ThemeProvider } from './components/ui/ThemeProvider';
import { ToastProvider, useToast } from './components/ui/Toast';
import Layout from './components/Layout';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import Button from './components/ui/Button';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import { 
  fetchSessions, 
  fetchSessionHistory, 
  deleteSession, 
  queryStream,
  exportSession,
  fetchEduContent,
  fetchGraphPath,
  fetchGraphData,
  fetchSessionDocuments,
  deleteDocument
} from './api';

const generateSessionId = () => `session_${Math.random().toString(36).substring(2, 9)}`;

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </ThemeProvider>
  );
}

function MainApp() {
  const { addToast } = useToast();
  const [path, setPath] = useState(() => window.location.pathname);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(() => localStorage.getItem('rag_user_role') || 'user');
  const [sessionId, setSessionId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [allMessages, setAllMessages] = useState({});
  const [activeDocument, setActiveDocument] = useState(null);
  const [sessionDocuments, setSessionDocuments] = useState([]);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'study' | 'graph' | 'preview'
  const [tokensLeft, setTokensLeft] = useState(() => {
    const saved = localStorage.getItem('rag_tokens_left');
    return saved ? parseInt(saved, 10) : 100000;
  });

  const handleResetTokens = () => {
    setTokensLeft(100000);
    localStorage.setItem('rag_tokens_left', '100000');
    addToast("Tokens refilled to 100,000!", "success");
  };

  // Study workspace state
  const [studyType, setStudyType] = useState('mcqs'); // 'mcqs' | 'flashcards' | 'interview' | 'notes'
  const [studyDiff, setStudyDiff] = useState('medium'); // 'easy' | 'medium' | 'hard'
  const [studyCount, setStudyCount] = useState(5); // 5 | 10 | 15 | 20
  const [studyData, setStudyData] = useState(null);
  const [studyLoading, setStudyLoading] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { qIdx: selectedOption }
  const [flippedCards, setFlippedCards] = useState({}); // { cardIdx: boolean }
  const [showAllStudyItems, setShowAllStudyItems] = useState(false);
  const studyOutputRef = useRef(null);

  // GraphRAG state
  const [graphSource, setGraphSource] = useState('');
  const [graphTarget, setGraphTarget] = useState('');
  const [graphPathData, setGraphPathData] = useState(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState('');

  const handleUploadSuccess = async () => {
    if (!sessionId) return;
    try {
      const docs = await fetchSessionDocuments(sessionId);
      setSessionDocuments(docs);
      addToast("Knowledge document uploaded successfully!", "success");
    } catch (err) {
      console.error("Failed to reload session documents:", err);
      addToast("Failed to sync session documents", "error");
    }
  };

  const handleDeleteDocument = async (docId) => {
    try {
      await deleteDocument(docId);
      setSessionDocuments(prev => prev.filter(d => (d.id !== docId && d.document_id !== docId)));
      if (activeDocument && activeDocument.id === docId) {
        setActiveDocument(null);
      }
      addToast("Document removed from context", "info");
    } catch (err) {
      console.error("Failed to delete document:", err);
      addToast("Failed to delete document", "error");
    }
  };

  const navigateTo = (newPath) => {
    window.history.pushState(null, '', newPath);
    setPath(newPath);
  };

  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Authenticate on mount checking local storage
  useEffect(() => {
    const token = localStorage.getItem('rag_token');
    const role = localStorage.getItem('rag_user_role') || 'user';
    const currentPath = window.location.pathname;
    
    if (token) {
      setIsAuthenticated(true);
      setUserRole(role);
      if (currentPath === '/login' || currentPath === '/register' || currentPath === '/') {
        navigateTo('/dashboard');
      } else {
        setPath(currentPath);
      }
    } else {
      setIsAuthenticated(false);
      setUserRole('user');
      if (currentPath !== '/login' && currentPath !== '/register') {
        navigateTo('/login');
      } else {
        setPath(currentPath);
      }
    }
  }, [isAuthenticated]);

  // Load user sessions from database when entering '/dashboard' or '/admin'
  useEffect(() => {
    if (isAuthenticated && (path === '/dashboard' || path === '/admin')) {
      loadSessions(true);
    }
  }, [path, isAuthenticated]);

  // Load session documents when active sessionId changes
  useEffect(() => {
    if (sessionId && isAuthenticated && (path === '/dashboard' || path === '/admin')) {
      const loadDocs = async () => {
        try {
          const docs = await fetchSessionDocuments(sessionId);
          setSessionDocuments(docs);
        } catch (err) {
          console.error("Failed to load documents for session:", err);
        }
      };
      loadDocs();
    } else {
      setSessionDocuments([]);
    }
  }, [sessionId, path, isAuthenticated]);

  const loadSessions = async (autoSelect = true) => {
    try {
      const data = await fetchSessions();
      setSessions(data);
      
      const newAllMessages = {};
      data.forEach(sess => {
        newAllMessages[sess.id] = sess.messages || [];
      });
      setAllMessages(newAllMessages);

      if (autoSelect) {
        if (data.length > 0) {
          setSessionId(data[0].id);
        } else {
          const newId = generateSessionId();
          setSessionId(newId);
          setSessions([{ id: newId, name: 'New Conversation' }]);
          setAllMessages({ [newId]: [] });
        }
      }
    } catch (err) {
      console.error("Failed to fetch sessions from server:", err);
      if (err.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const handleSelectSession = async (id) => {
    setSessionId(id);
    setStudyData(null);
    setGraphPathData(null);
    
    try {
      const data = await fetchSessionHistory(id);
      setAllMessages(prev => ({
        ...prev,
        [id]: data.messages || []
      }));
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error(`Failed to load history for session ${id}:`, err);
      }
    }
  };

  const handleNewChat = () => {
    const newId = generateSessionId();
    setSessionId(newId);
    setSessions(prev => [
      { id: newId, name: 'New Conversation' },
      ...prev
    ]);
    setAllMessages(prev => ({
      ...prev,
      [newId]: []
    }));
    setSessionDocuments([]);
    setActiveTab('chat');
    addToast("New conversation thread initialized", "success");
  };

  const handleDeleteSession = async (id) => {
    try {
      try {
        await deleteSession(id);
      } catch (err) {
        if (err.response?.status !== 404) {
          throw err;
        }
      }
      
      setSessions(prev => {
        const filtered = prev.filter(s => s.id !== id);
        if (id === sessionId) {
          if (filtered.length > 0) {
            setSessionId(filtered[0].id);
            fetchSessionHistory(filtered[0].id)
              .then(data => {
                setAllMessages(prevAll => ({
                  ...prevAll,
                  [filtered[0].id]: data.messages || []
                }));
              })
              .catch(e => console.error(e));
          } else {
            const newId = generateSessionId();
            setSessionId(newId);
            setAllMessages({ [newId]: [] });
            return [{ id: newId, name: 'New Conversation' }];
          }
        }
        return filtered;
      });

      setAllMessages(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      addToast("Conversation deleted", "info");
    } catch (err) {
      console.error("Failed to delete session:", err);
      addToast("Failed to delete conversation", "error");
    }
  };

  const handleClearSessions = async () => {
    try {
      for (const s of sessions) {
        try {
          await deleteSession(s.id);
        } catch (e) {
          // ignore error
        }
      }
    } catch (err) {
      console.error("Failed to clear sessions:", err);
    }
    
    const newId = generateSessionId();
    setSessionId(newId);
    setSessions([{ id: newId, name: 'New Conversation' }]);
    setAllMessages({ [newId]: [] });
    addToast("All conversation histories cleared", "info");
  };

  const handleSendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    const userMsg = { 
      role: 'user', 
      content: text,
      created_at: new Date().toISOString()
    };
    const currentMsgs = allMessages[sessionId] || [];
    
    const assistantMsg = { 
      role: 'assistant', 
      content: 'Thinking...', 
      sources: [],
      decision: '',
      reasoning_trace: ['Initializing router node...'],
      confidence_score: 1.0,
      created_at: new Date().toISOString()
    };
    
    // Optimistic UI updates
    setAllMessages(prev => ({
      ...prev,
      [sessionId]: [...currentMsgs, userMsg, assistantMsg]
    }));
    
    // Deduct prompt input tokens
    setTokensLeft(prev => {
      const inputTokens = Math.max(5, Math.ceil(text.trim().split(/\s+/).length / 0.75));
      const next = Math.max(0, prev - inputTokens);
      localStorage.setItem('rag_tokens_left', next.toString());
      return next;
    });

    setIsLoading(true);

    let streamAnswer = "";
    let streamSources = [];
    let streamDecision = "";
    let streamTrace = [];
    let streamConfidence = 1.0;

    const updateAssistantState = (newAnswer, newSources, newDecision, newTrace, newConfidence) => {
      setAllMessages(prev => {
        const list = prev[sessionId] || [];
        if (list.length === 0) return prev;
        const updatedList = [...list];
        updatedList[updatedList.length - 1] = {
          ...updatedList[updatedList.length - 1],
          content: newAnswer,
          sources: newSources,
          decision: newDecision,
          reasoning_trace: newTrace,
          confidence_score: newConfidence
        };
        return {
          ...prev,
          [sessionId]: updatedList
        };
      });
    };

    try {
      await queryStream(
        text,
        sessionId,
        globalSearch,
        (token) => {
          streamAnswer += token;
          updateAssistantState(streamAnswer, streamSources, streamDecision, streamTrace, streamConfidence);
          
          setTokensLeft(prev => {
            const next = Math.max(0, prev - 1);
            localStorage.setItem('rag_tokens_left', next.toString());
            return next;
          });
        },
        (sources) => {
          streamSources = sources;
          updateAssistantState(streamAnswer, streamSources, streamDecision, streamTrace, streamConfidence);
        },
        (error) => {
          console.error("Query stream error:", error);
          const errDetail = error.message || "Failed to receive streaming response.";
          streamAnswer = `[Query Error: ${errDetail}]`;
          updateAssistantState(streamAnswer, streamSources, 'llm', ['Stream execution failed.'], 0.0);
          setIsLoading(false);
          addToast("Stream query execution error", "error");
        },
        () => {
          setIsLoading(false);
          setSessions(prev => prev.map(s => {
            if (s.id === sessionId && (s.name === 'New Conversation' || s.name === 'General Document Query')) {
              return { ...s, name: text.length > 25 ? `${text.substring(0, 22)}...` : text };
            }
            return s;
          }));
        },
        (trace) => {
          streamTrace = trace;
          updateAssistantState(streamAnswer, streamSources, streamDecision, streamTrace, streamConfidence);
        },
        (decision) => {
          streamDecision = decision;
          updateAssistantState(streamAnswer, streamSources, streamDecision, streamTrace, streamConfidence);
        },
        (confidence) => {
          streamConfidence = confidence;
          updateAssistantState(streamAnswer, streamSources, streamDecision, streamTrace, streamConfidence);
        }
      );
    } catch (err) {
      console.error(err);
      setIsLoading(false);
      addToast("Failed to connect to conversational router", "error");
    }
  };

  const handleExport = async (format) => {
    try {
      setIsLoading(true);
      const blob = await exportSession(sessionId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session_${sessionId}.${format === 'markdown' ? 'md' : format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      addToast(`Chat export compiled as ${format.toUpperCase()}`, "success");
    } catch (err) {
      console.error("Export failed:", err);
      addToast("Failed to export chat session.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateStudy = async () => {
    setStudyLoading(true);
    setStudyData(null);
    setSelectedAnswers({});
    setFlippedCards({});
    
    try {
      const data = await fetchEduContent(sessionId, studyType, studyDiff, studyCount);
      setStudyData(data);
      addToast("Interactive study sheets compiled!", "success");
      
      // Update school progress metrics
      if (studyType === 'mcqs') {
        const quizzes = parseInt(localStorage.getItem('school_quizzes_taken') || '0', 10);
        localStorage.setItem('school_quizzes_taken', (quizzes + 1).toString());
      } else if (studyType === 'notes') {
        const notes = parseInt(localStorage.getItem('school_notes_compiled') || '0', 10);
        localStorage.setItem('school_notes_compiled', (notes + 1).toString());
      }
    } catch (err) {
      console.error(err);
      addToast("Failed to compile study quiz materials.", "error");
    } finally {
      setStudyLoading(false);
    }
  };

  useEffect(() => {
    if (studyData && studyOutputRef.current) {
      setTimeout(() => {
        studyOutputRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [studyData]);

  useEffect(() => {
    setShowAllStudyItems(false);
  }, [studyType, studyData]);

  const handleFindGraphPath = async (e) => {
    e.preventDefault();
    if (!graphSource.trim() || !graphTarget.trim()) return;

    setGraphLoading(true);
    setGraphPathData(null);
    setGraphError('');

    try {
      const data = await fetchGraphPath(sessionId, graphSource.trim(), graphTarget.trim());
      if (data.found) {
        setGraphPathData(data);
        addToast("Shortest relationship path traced!", "success");
      } else {
        setGraphError(data.message || "No relationship path found.");
        addToast("No relationships mapped between concepts.", "info");
      }
    } catch (err) {
      console.error(err);
      setGraphError("Failed to trace graph relationships.");
      addToast("Graph connections search error", "error");
    } finally {
      setGraphLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('rag_token');
    localStorage.removeItem('rag_username');
    localStorage.removeItem('rag_user_role');
    setIsAuthenticated(false);
    setUserRole('user');
    setSessionId('');
    setSessions([]);
    setAllMessages({});
    setActiveDocument(null);
    addToast("Logged out of session", "info");
    navigateTo('/login');
  };

  const currentMessages = allMessages[sessionId] || [];

  return (
    <Layout
      userRole={userRole}
      isAuthenticated={isAuthenticated}
      view={path === '/admin' ? 'dashboard' : (path === '/dashboard' ? 'chat' : '')}
      setView={(v) => {
        if (v === 'login') navigateTo('/login');
        else if (v === 'register') navigateTo('/register');
        else if (v === 'dashboard') navigateTo('/admin');
        else navigateTo('/dashboard');
      }}
      sessionId={sessionId}
      sessions={sessions}
      onSelectSession={handleSelectSession}
      onDeleteSession={handleDeleteSession}
      onNewChat={handleNewChat}
      onClearSessions={handleClearSessions}
      activeDocument={activeDocument}
      setActiveDocument={setActiveDocument}
      sessionDocuments={sessionDocuments}
      onDeleteDocument={handleDeleteDocument}
      onUploadSuccess={handleUploadSuccess}
      onLogout={handleLogout}
      activeTab={activeTab}
      onChangeTab={(tab) => {
        setActiveTab(tab);
        navigateTo('/dashboard');
      }}
      tokensLeft={tokensLeft}
      onResetTokens={handleResetTokens}
    >
      {path === '/login' && (
        <Login 
          onLoginSuccess={() => {
            setIsAuthenticated(true);
            setUserRole(localStorage.getItem('rag_user_role') || 'user');
            navigateTo('/dashboard');
          }}
          onNavigateToSignup={() => navigateTo('/register')}
        />
      )}

      {path === '/register' && (
        <Register
          onSignupSuccess={() => navigateTo('/login')}
          onNavigateToLogin={() => navigateTo('/login')}
        />
      )}

      {path === '/admin' && (
        <ProtectedAdminRoute
          userRole={userRole}
          onNavigateBack={() => navigateTo('/dashboard')}
        >
          <Dashboard 
            onBackToChat={() => navigateTo('/dashboard')}
          />
        </ProtectedAdminRoute>
      )}

      {path === '/dashboard' && activeTab === 'chat' && (
        <ChatWindow
          messages={currentMessages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          activeDocument={activeDocument}
          onExport={handleExport}
          globalSearch={globalSearch}
          setGlobalSearch={setGlobalSearch}
        />
      )}

      {path === '/dashboard' && activeTab === 'study' && (
        <div className="flex-1 flex flex-col bg-[#F8FAFC] dark:bg-[#0E0F13] overflow-y-auto overflow-x-hidden min-h-screen scrollbar-thin p-6 md:p-10 select-none transition-colors duration-300">
          <div className="max-w-4xl mx-auto w-full animate-fade-in">
            <div className="mb-6 flex items-center space-x-3 text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">
              <GraduationCap className="w-8 h-8 text-emerald-450 shrink-0" />
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">Interactive Study Workspace</h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-gray-400 mb-8 max-w-2xl">
              Compile interactive quiz worksheets, review card recall tools, and interview prep guides instantly compiled by scanning your ingested document context.
            </p>
            
            {/* Configurations Header */}
            <div className="bg-slate-100/70 dark:bg-[#13141C]/80 border border-slate-200 dark:border-white/5 rounded-2xl p-6 mb-8 grid grid-cols-1 sm:grid-cols-4 gap-5 backdrop-blur-md shadow-xl select-none">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-2">Resource Format</label>
                <select 
                  value={studyType} 
                  onChange={e => setStudyType(e.target.value)}
                  className="w-full py-2.5 px-3 bg-white dark:bg-[#181922] border border-slate-200 dark:border-white/5 rounded-xl text-xs text-slate-800 dark:text-gray-200 outline-none focus:border-emerald-500 transition-all duration-300 font-bold"
                >
                  <option value="mcqs">Multiple Choice (MCQ)</option>
                  <option value="flashcards">Flashcards Match</option>
                  <option value="interview">Interview Prep</option>
                  <option value="notes">Revision Sheet</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-gray-550 uppercase tracking-widest mb-2">Difficulty Tier</label>
                <select 
                  value={studyDiff} 
                  onChange={e => setStudyDiff(e.target.value)}
                  className="w-full py-2.5 px-3 bg-white dark:bg-[#181922] border border-slate-200 dark:border-white/5 rounded-xl text-xs text-slate-800 dark:text-gray-200 outline-none focus:border-emerald-500 transition-all duration-300 font-bold"
                >
                  <option value="easy">Easy Level</option>
                  <option value="medium">Medium Level</option>
                  <option value="hard">Hard Level</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-gray-550 uppercase tracking-widest mb-2">Number of Items</label>
                <select 
                  value={studyCount} 
                  onChange={e => setStudyCount(Number(e.target.value))}
                  disabled={studyType === 'notes'}
                  className="w-full py-2.5 px-3 bg-white dark:bg-[#181922] border border-slate-200 dark:border-white/5 rounded-xl text-xs text-slate-800 dark:text-gray-200 outline-none focus:border-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 font-bold"
                >
                  <option value={3}>3 Items</option>
                  <option value={5}>5 Items</option>
                  <option value={10}>10 Items</option>
                  <option value={15}>15 Items</option>
                  <option value={20}>20 Items</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="primary"
                  onClick={handleGenerateStudy}
                  disabled={studyLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-650 to-teal-650 text-white font-bold"
                  icon={studyLoading ? <RefreshCw className="w-4 h-4 animate-spin text-white" /> : <BookOpen className="w-4 h-4 text-white" />}
                >
                  {studyLoading ? 'Compiling...' : 'Generate Materials'}
                </Button>
              </div>
            </div>

            {/* Generation outputs display panels */}
            {studyData && (
              <div ref={studyOutputRef} className="bg-white/80 dark:bg-[#13141C]/60 border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-2xl animate-fade-in select-text">
                
                {/* MCQ quiz template format */}
                {studyType === 'mcqs' && studyData.questions && (
                  <div className="space-y-6 max-h-[65vh] overflow-y-auto scrollbar-thin pr-1">
                    <div className="border-b border-slate-200 dark:border-white/5 pb-4 mb-4 select-none">
                      <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center space-x-2">
                        <span className="text-emerald-500">📝</span>
                        <span>Worksheet: Multiple Choice Quiz</span>
                      </h2>
                      <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">Select your answers below. Explanations will reveal automatically.</p>
                    </div>
                                      {studyData.questions.slice(0, showAllStudyItems ? undefined : 5).map((q, qIdx) => (
                      <div key={qIdx} className="bg-slate-50 dark:bg-[#16171f]/80 p-5 rounded-xl border border-slate-200 dark:border-white/5 hover:border-indigo-500/20 transition-all duration-300 shadow-sm animate-fade-in">
                        <p className="font-semibold text-sm text-slate-800 dark:text-gray-100 mb-4 flex items-start">
                          <span className="text-emerald-500 font-mono font-bold mr-2">{qIdx + 1}.</span>
                          <span>{q.question}</span>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 select-none">
                          {q.options.map((opt, oIdx) => {
                            const isSelected = selectedAnswers[qIdx] === opt;
                            const isCorrect = opt === q.correct_answer;
                            const answered = selectedAnswers[qIdx] !== undefined;
                            
                            return (
                              <button
                                key={oIdx}
                                onClick={() => {
                                  if (!answered) {
                                    setSelectedAnswers(prev => ({...prev, [qIdx]: opt}));
                                    const isCorrect = opt === q.correct_answer;
                                    const correctCount = parseInt(localStorage.getItem('school_correct_answers') || '0', 10);
                                    const incorrectCount = parseInt(localStorage.getItem('school_incorrect_answers') || '0', 10);
                                    if (isCorrect) {
                                      localStorage.setItem('school_correct_answers', (correctCount + 1).toString());
                                    } else {
                                      localStorage.setItem('school_incorrect_answers', (incorrectCount + 1).toString());
                                    }
                                  }
                                }}
                                className={`py-3 px-4 rounded-xl text-xs text-left transition-all duration-300 font-medium border ${
                                  isSelected 
                                    ? (isCorrect 
                                        ? 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold scale-[1.02] shadow-[0_0_12px_rgba(16,185,129,0.15)]' 
                                        : 'bg-rose-100 dark:bg-rose-950/40 border-rose-500 text-rose-600 dark:text-rose-400 font-bold scale-[1.02] shadow-[0_0_12px_rgba(244,63,94,0.15)]')
                                    : (answered && isCorrect 
                                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-800 text-emerald-600 dark:text-emerald-400' 
                                        : 'bg-white dark:bg-[#121319] border-slate-200 dark:border-white/5 hover:border-slate-350 dark:hover:border-white/20 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 hover:scale-[1.01]')
                                }`}
                              >
                                <span className="inline-block w-5 h-5 rounded-full bg-slate-100 dark:bg-black/35 text-center leading-5 text-[10px] mr-2 font-mono text-slate-500 dark:text-gray-500 uppercase">
                                  {String.fromCharCode(65 + oIdx)}
                                </span>
                                <span>{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                        {selectedAnswers[qIdx] !== undefined && (
                          <div className="text-xs text-slate-700 dark:text-gray-300 pt-3.5 border-t border-slate-200 dark:border-white/5 flex items-start space-x-2.5 bg-slate-100/50 dark:bg-black/20 p-3 rounded-lg animate-fade-in select-text max-h-36 overflow-y-auto scrollbar-thin">
                            {selectedAnswers[qIdx] === q.correct_answer ? (
                              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <p className="font-bold text-emerald-600 dark:text-emerald-400">Correct Answer: {q.correct_answer}.</p>
                              <p className="text-slate-500 dark:text-gray-400 mt-1 leading-relaxed">{q.explanation}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {studyData.questions.length > 5 && !showAllStudyItems && (
                      <div className="text-center pt-4">
                        <Button
                          variant="secondary"
                          onClick={() => setShowAllStudyItems(true)}
                          className="px-6 py-2 text-xs font-bold"
                        >
                          Show More ({studyData.questions.length - 5} questions remaining)
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Interactive Flashcards recall */}
                {studyType === 'flashcards' && studyData.flashcards && (
                  <div>
                    <div className="border-b border-slate-200 dark:border-white/5 pb-4 mb-6 select-none">
                      <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center space-x-2">
                        <span className="text-emerald-505">🎴</span>
                        <span>Worksheet: Flashcard Recalls</span>
                      </h2>
                      <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">Click cards to spin them in 3D and reveal the concept definition.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-h-[60vh] overflow-y-auto scrollbar-thin pr-1 py-1">
                      {studyData.flashcards.slice(0, showAllStudyItems ? undefined : 6).map((fc, idx) => {
                        const isFlipped = flippedCards[idx];
                        return (
                          <div key={idx} className="card-container h-44 cursor-pointer select-none">
                            <div 
                              className={`card-inner ${isFlipped ? 'flipped' : ''}`}
                              onClick={() => {
                                const newFlipped = !isFlipped;
                                setFlippedCards(prev => ({...prev, [idx]: newFlipped}));
                                if (newFlipped) {
                                  const flippedSet = JSON.parse(localStorage.getItem('school_flipped_cards_set') || '{}');
                                  const fcKey = `${sessionId}_${idx}`;
                                  if (!flippedSet[fcKey]) {
                                    flippedSet[fcKey] = true;
                                    localStorage.setItem('school_flipped_cards_set', JSON.stringify(flippedSet));
                                    const totalFlipped = parseInt(localStorage.getItem('school_total_flipped') || '0', 10);
                                    localStorage.setItem('school_total_flipped', (totalFlipped + 1).toString());
                                  }
                                }
                              }}
                            >
                              {/* Front Face */}
                              <div className="card-front bg-slate-100/90 dark:bg-[#161720] border border-slate-200 dark:border-white/5 hover:border-emerald-500/20 p-6 shadow-xl flex flex-col justify-between">
                                <div className="w-full flex justify-between items-center text-[9px] uppercase tracking-wider font-mono font-bold text-slate-400 dark:text-gray-500">
                                  <span>Card {idx + 1}</span>
                                  <span>Click to reveal</span>
                                </div>
                                <p className="text-sm font-bold text-slate-800 dark:text-gray-250 text-center flex-1 flex items-center justify-center max-w-[240px] overflow-y-auto scrollbar-thin max-h-24 py-1">
                                  {fc.front}
                                </p>
                                <div className="text-[9px] text-emerald-600 dark:text-emerald-450 font-extrabold uppercase tracking-widest border border-emerald-500/20 px-2 py-0.5 rounded bg-emerald-500/10 shrink-0">
                                  QUESTION
                                </div>
                              </div>
                              
                              {/* Back Face */}
                              <div className="card-back bg-indigo-50 dark:bg-[#0E1017] border border-emerald-500/20 p-6 shadow-2xl flex flex-col justify-between">
                                <div className="w-full flex justify-between items-center text-[9px] uppercase tracking-wider font-mono font-bold text-emerald-505/40">
                                  <span>Answer Side</span>
                                  <span>Click to flip back</span>
                                </div>
                                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 text-center flex-1 flex items-center justify-center leading-relaxed overflow-y-auto scrollbar-thin max-h-24 py-1">
                                  {fc.back}
                                </p>
                                <div className="text-[9px] text-teal-600 dark:text-teal-400 font-extrabold uppercase tracking-widest border border-teal-500/20 px-2 py-0.5 rounded bg-teal-500/10 shrink-0">
                                  DEFINITION
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {studyData.flashcards.length > 6 && !showAllStudyItems && (
                      <div className="text-center pt-6">
                        <Button
                          variant="secondary"
                          onClick={() => setShowAllStudyItems(true)}
                          className="px-6 py-2 text-xs font-bold"
                        >
                          Show More ({studyData.flashcards.length - 6} flashcards remaining)
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Interview prep */}
                {studyType === 'interview' && studyData.qa && (
                  <div className="space-y-4 max-h-[65vh] overflow-y-auto scrollbar-thin pr-1">
                    <div className="border-b border-slate-200 dark:border-white/5 pb-4 mb-4 select-none">
                      <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center space-x-2">
                        <span className="text-emerald-500">🎤</span>
                        <span>Worksheet: Interview Q&A Guide</span>
                      </h2>
                      <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">Review standard interview answers generated dynamically for your ingestion context.</p>
                    </div>
                    
                    {studyData.qa.slice(0, showAllStudyItems ? undefined : 5).map((qa, idx) => (
                      <div key={idx} className="bg-slate-50 dark:bg-[#16171f]/80 p-5 rounded-xl border border-slate-200 dark:border-white/5 hover:border-indigo-550/20 hover:scale-[1.01] transition-all duration-300 shadow-sm animate-fade-in">
                        <p className="font-bold text-sm text-emerald-600 dark:text-emerald-450 mb-2.5 flex items-start">
                          <span className="mr-2 font-mono">Q:</span>
                          <span>{qa.question}</span>
                        </p>
                        <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed pl-5 border-l border-emerald-500/30 max-h-36 overflow-y-auto scrollbar-thin">
                          <span className="font-bold text-slate-400 dark:text-gray-500 block mb-1 uppercase text-[9px] tracking-wider select-none">Suggested Answer:</span>
                          {qa.answer}
                        </p>
                      </div>
                    ))}
                    {studyData.qa.length > 5 && !showAllStudyItems && (
                      <div className="text-center pt-4">
                        <Button
                          variant="secondary"
                          onClick={() => setShowAllStudyItems(true)}
                          className="px-6 py-2 text-xs font-bold"
                        >
                          Show More ({studyData.qa.length - 5} questions remaining)
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Revision Notes Summary */}
                {studyType === 'notes' && studyData.text && (
                  <div>
                    <div className="border-b border-slate-200 dark:border-white/5 pb-4 mb-4 select-none">
                      <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center space-x-2">
                        <span className="text-emerald-500">📚</span>
                        <span>Worksheet: Revision Study Sheets</span>
                      </h2>
                      <p className="text-xs text-slate-400 dark:text-gray-550 mt-1">Comprehensive structured breakdown of core document information.</p>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-[#16171f]/60 p-6 rounded-xl border border-slate-200 dark:border-white/5 prose dark:prose-invert max-w-none text-xs md:text-sm text-slate-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap select-text font-sans max-h-96 overflow-y-auto scrollbar-thin">
                      {studyData.text}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {path === '/dashboard' && activeTab === 'graph' && (
        <div className="flex-1 flex flex-col bg-[#F8FAFC] dark:bg-[#0E0F13] overflow-y-auto overflow-x-hidden min-h-screen scrollbar-thin p-6 md:p-10 select-none transition-colors duration-300">
          <div className="max-w-4xl mx-auto w-full animate-fade-in">
            <div className="mb-6 flex items-center space-x-3 text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-indigo-400">
              <Network className="w-8 h-8 text-emerald-450 shrink-0" />
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-850 dark:text-white">GraphRAG Relationship Explorer</h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-gray-400 mb-8 max-w-2xl">
              Examine connections and shortest relationship paths between entities extracted automatically during document parsing.
            </p>

            <form onSubmit={handleFindGraphPath} className="bg-slate-100/70 dark:bg-[#13141C]/80 border border-slate-200 dark:border-white/5 rounded-2xl p-6 mb-8 grid grid-cols-1 sm:grid-cols-3 gap-5 backdrop-blur-md shadow-xl select-none">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-2">Source Entity</label>
                <input
                  type="text"
                  value={graphSource}
                  onChange={e => setGraphSource(e.target.value)}
                  placeholder="e.g. Elon Musk"
                  className="w-full py-2.5 px-3 bg-white dark:bg-[#181922] border border-slate-200 dark:border-white/5 rounded-xl text-xs text-slate-800 dark:text-gray-250 placeholder-slate-400 outline-none focus:border-emerald-500 transition-all duration-300"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-gray-550 uppercase tracking-widest mb-2">Target Entity</label>
                <input
                  type="text"
                  value={graphTarget}
                  onChange={e => setGraphTarget(e.target.value)}
                  placeholder="e.g. Tesla"
                  className="w-full py-2.5 px-3 bg-white dark:bg-[#181922] border border-slate-200 dark:border-white/5 rounded-xl text-xs text-slate-800 dark:text-gray-250 placeholder-slate-400 outline-none focus:border-emerald-500 transition-all duration-300"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={graphLoading}
                  className="w-full py-2.5 font-bold"
                  icon={graphLoading ? <RefreshCw className="w-4 h-4 animate-spin text-white" /> : <Search className="w-4 h-4 text-white" />}
                >
                  <span>Search Connections</span>
                </Button>
              </div>
            </form>

            {graphError && (
              <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-500/20 p-4 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-bold text-center animate-fade-in shadow-sm select-text">
                ⚠️ {graphError}
              </div>
            )}

            {graphPathData && (
              <div className="bg-white/80 dark:bg-[#13141c]/60 border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-2xl animate-fade-in select-text">
                <h2 className="text-xl font-bold text-slate-850 dark:text-white mb-4 flex items-center space-x-2 border-b border-slate-200 dark:border-white/5 pb-3">
                  <span className="text-indigo-400">🔗</span>
                  <span>Shortest Relationship Path Results</span>
                </h2>
                <div className="flex flex-col space-y-4">
                  {graphPathData.details.map((link, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 dark:bg-[#16171f]/80 p-4 rounded-xl border border-slate-200 dark:border-white/5 text-xs shadow-sm hover:scale-[1.01] hover:border-emerald-500/20 transition-all duration-300">
                      <div className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex flex-col items-center sm:items-start max-w-[200px] truncate shadow-inner">
                        <strong className="text-slate-800 dark:text-white truncate max-w-xs">{link.source}</strong>
                        <span className="text-[9px] uppercase font-mono tracking-widest text-emerald-500/60 mt-0.5">{link.source_type}</span>
                      </div>
                      <div className="my-2 sm:my-0 text-[#6366F1] font-bold font-mono text-[10px] uppercase tracking-widest flex flex-col items-center shrink-0">
                        <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-500/20 rounded-full">{link.relationship}</span>
                        <span className="text-[14px] mt-1 tracking-widest leading-none">───▶</span>
                      </div>
                      <div className="px-3.5 py-2 bg-slate-100 dark:bg-indigo-950/20 border border-slate-250 dark:border-white/5 text-slate-800 dark:text-gray-200 rounded-xl flex flex-col items-center sm:items-start max-w-[200px] truncate">
                        <strong className="text-slate-850 dark:text-white truncate max-w-xs">{link.target}</strong>
                        <span className="text-[9px] uppercase font-mono tracking-widest text-slate-400 dark:text-gray-500 mt-0.5">{link.target_type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {path === '/dashboard' && activeTab === 'preview' && (
        <div className="flex-1 flex flex-col bg-[#F8FAFC] dark:bg-[#0E0F13] overflow-y-auto overflow-x-hidden min-h-screen scrollbar-thin p-6 md:p-10 select-none transition-colors duration-300">
          <div className="max-w-4xl mx-auto w-full animate-fade-in">
            <div className="mb-6 flex items-center space-x-3 text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-indigo-400">
              <Eye className="w-8 h-8 text-emerald-450 shrink-0" />
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-850 dark:text-white">Visual Context Document Preview</h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-gray-400 mb-8 max-w-2xl">
              Examine structured indexing metadata and view loaded chunk structures directly in vector DB layout space.
            </p>
            
            {activeDocument ? (
              <div className="bg-white/80 dark:bg-[#13141c]/60 border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-2xl animate-fade-in select-text">
                <h2 className="text-lg font-bold text-slate-850 dark:text-white mb-4 border-b border-slate-200 dark:border-white/5 pb-3 select-none">Document Details</h2>
                <div className="bg-slate-55/50 dark:bg-[#16171f]/80 p-5 rounded-xl border border-slate-200 dark:border-white/5 space-y-4 text-xs md:text-sm">
                  <p className="text-slate-700 dark:text-gray-300 flex items-center justify-between">
                    <span className="font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest text-[10px] select-none">File Context:</span> 
                    <span className="font-bold text-indigo-600 dark:text-indigo-455 bg-indigo-50 dark:bg-emerald-950/40 border border-indigo-250 dark:border-emerald-500/20 px-3 py-1 rounded-xl shadow-inner">{activeDocument.name}</span>
                  </p>
                  <p className="text-slate-700 dark:text-gray-300 flex items-center justify-between">
                    <span className="font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest text-[10px] select-none">Indexed Blocks:</span> 
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{activeDocument.chunks} chunks loaded in FAISS</span>
                  </p>
                  <div className="h-64 bg-slate-100 dark:bg-black/40 rounded-xl border border-slate-200 dark:border-white/5 flex flex-col items-center justify-center text-slate-400 dark:text-gray-550 italic text-center p-6 shadow-inner select-none">
                    <Database className="w-10 h-10 text-emerald-500/20 mb-3" />
                    <span className="font-semibold text-xs text-slate-500 dark:text-gray-400">Thumbnail view active</span>
                    <p className="text-[10px] text-slate-450 dark:text-gray-600 mt-1.5 max-w-xs">Document chunks are parsed and loaded dynamically. Interactive canvas layers will load once context-focused queries are fired.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-100/50 dark:bg-[#13141c]/40 border border-slate-200 dark:border-white/5 rounded-2xl p-12 text-center text-slate-400 dark:text-gray-500 italic text-xs md:text-sm select-none shadow-md">
                <Database className="w-8 h-8 text-slate-400 dark:text-gray-700 mx-auto mb-3" />
                <span>Please select or ingest a file context block to preview chunks visually.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {path === '/dashboard' && activeTab === 'academic' && (
        <div className="flex-1 flex flex-col bg-[#F5F7FA] p-6 md:p-10 select-none min-h-screen overflow-y-auto overflow-x-hidden scrollbar-thin">
          <div className="max-w-4xl mx-auto w-full animate-fade-in flex flex-col h-full">
            <div className="shrink-0 mb-6">
              <div className="flex items-center space-x-3 text-transparent bg-clip-text bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]">
                <BookOpen className="w-8 h-8 text-[#6366F1] shrink-0" />
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">Academic Status & Progress</h1>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Monitor your retention, quiz accuracy metrics, review card counts, and general educational material stats.
              </p>
            </div>

            {/* Scrollable Container to Manage Spacing */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-8 pb-10 scrollbar-thin">
              {/* Academic Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white border border-[#E2E8F0] p-5 rounded-2xl shadow-sm hover:scale-[1.01] transition-all">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quizzes Taken</p>
                  <h2 className="text-3xl font-extrabold text-slate-800 mt-1.5">{localStorage.getItem('school_quizzes_taken') || '0'}</h2>
                </div>
                <div className="bg-white border border-[#E2E8F0] p-5 rounded-2xl shadow-sm hover:scale-[1.01] transition-all">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Average Accuracy</p>
                  <h2 className="text-3xl font-extrabold text-slate-800 mt-1.5">
                    {(() => {
                      const c = parseInt(localStorage.getItem('school_correct_answers') || '0', 10);
                      const i = parseInt(localStorage.getItem('school_incorrect_answers') || '0', 10);
                      if (c + i === 0) return 'N/A';
                      return `${((c / (c + i)) * 100).toFixed(0)}%`;
                    })()}
                  </h2>
                </div>
                <div className="bg-white border border-[#E2E8F0] p-5 rounded-2xl shadow-sm hover:scale-[1.01] transition-all">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Flashcards Flipped</p>
                  <h2 className="text-3xl font-extrabold text-slate-800 mt-1.5">{localStorage.getItem('school_total_flipped') || '0'}</h2>
                </div>
                <div className="bg-white border border-[#E2E8F0] p-5 rounded-2xl shadow-sm hover:scale-[1.01] transition-all">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Study Notes Compiled</p>
                  <h2 className="text-3xl font-extrabold text-slate-800 mt-1.5">{localStorage.getItem('school_notes_compiled') || '0'}</h2>
                </div>
              </div>

              {/* In Depth Stats & Chart */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white border border-[#E2E8F0] p-6 rounded-3xl shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-850 mb-1">Retention & Accuracy Details</h3>
                    <p className="text-xs text-slate-400 mb-5">Answer tracking for Multiple Choice Quizzes</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs text-slate-505">
                      <span>Correct Answers:</span>
                      <span className="font-bold text-emerald-600">{localStorage.getItem('school_correct_answers') || '0'}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-505">
                      <span>Incorrect Answers:</span>
                      <span className="font-bold text-rose-600">{localStorage.getItem('school_incorrect_answers') || '0'}</span>
                    </div>
                    <div className="w-full bg-[#F5F7FA] rounded-full h-2.5 overflow-hidden">
                      {(() => {
                        const c = parseInt(localStorage.getItem('school_correct_answers') || '0', 10);
                        const i = parseInt(localStorage.getItem('school_incorrect_answers') || '0', 10);
                        const pct = c + i > 0 ? (c / (c + i)) * 100 : 0;
                        return (
                          <div 
                            className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[#E2E8F0] p-6 rounded-3xl shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-850 mb-1">Academic Progress</h3>
                    <p className="text-xs text-slate-400 mb-5">Current level module completion index</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs text-slate-505">
                      <span>Overall Course Completion:</span>
                      <span className="font-bold text-indigo-600">
                        {(() => {
                          const quizzes = parseInt(localStorage.getItem('school_quizzes_taken') || '0', 10);
                          const notes = parseInt(localStorage.getItem('school_notes_compiled') || '0', 10);
                          const cards = parseInt(localStorage.getItem('school_total_flipped') || '0', 10);
                          const points = (quizzes * 25) + (notes * 20) + (cards * 5);
                          return `${Math.min(points, 100)}%`;
                        })()}
                      </span>
                    </div>
                    <div className="w-full bg-[#F5F7FA] rounded-full h-2.5 overflow-hidden">
                      {(() => {
                        const quizzes = parseInt(localStorage.getItem('school_quizzes_taken') || '0', 10);
                        const notes = parseInt(localStorage.getItem('school_notes_compiled') || '0', 10);
                        const cards = parseInt(localStorage.getItem('school_total_flipped') || '0', 10);
                        const points = (quizzes * 25) + (notes * 20) + (cards * 5);
                        return (
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(points, 100)}%` }}
                          />
                        );
                      })()}
                    </div>
                    <button 
                      onClick={() => {
                        localStorage.setItem('school_quizzes_taken', '0');
                        localStorage.setItem('school_correct_answers', '0');
                        localStorage.setItem('school_incorrect_answers', '0');
                        localStorage.setItem('school_total_flipped', '0');
                        localStorage.setItem('school_flipped_cards_set', '{}');
                        localStorage.setItem('school_notes_compiled', '0');
                        addToast("Academic status and progress reset successful.", "info");
                      }}
                      className="w-full text-center text-[10px] uppercase font-bold text-rose-500 hover:text-rose-600 mt-2 hover:underline transition-all"
                    >
                      Reset Academic Progress
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </Layout>
  );
}
