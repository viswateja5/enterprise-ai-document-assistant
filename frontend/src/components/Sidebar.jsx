import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  MessageSquare, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Database,
  FileText,
  BarChart3,
  X,
  GraduationCap,
  Network,
  Eye,
  Settings,
  BookOpen,
  LogOut
} from 'lucide-react';
import { uploadDocument, checkHealth, fetchDocumentStatus } from '../api';
import Button from './ui/Button';

export default function Sidebar({ 
  isCollapsed = false,
  userRole = 'user',
  sessionId, 
  sessions, 
  onSelectSession, 
  onDeleteSession,
  onNewChat, 
  onClearSessions,
  activeDocument,
  setActiveDocument,
  sessionDocuments = [],
  onDeleteDocument,
  onUploadSuccess,
  onLogout,
  onOpenDashboard,
  onOpenSettings,
  activeTab = 'chat',
  onChangeTab,
  tokensLeft = 100000,
  onResetTokens
}) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [uploadState, setUploadState] = useState('idle'); // 'idle' | 'uploading' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [chunkCount, setChunkCount] = useState(null);
  const [backendStatus, setBackendStatus] = useState('connecting'); // 'connecting' | 'online' | 'offline'
  const [processingStatus, setProcessingStatus] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [pollingDocId, setPollingDocId] = useState(null);
  const fileInputRef = useRef(null);

  // Check health of backend on load
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        await checkHealth();
        setBackendStatus('online');
      } catch (err) {
        setBackendStatus('offline');
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getExtension = (filename) => {
    return filename.split('.').pop().toLowerCase();
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const ext = getExtension(droppedFile.name);
      if (['pdf', 'docx', 'txt', 'csv', 'xlsx', 'xls'].includes(ext)) {
        setFile(droppedFile);
        setUploadState('idle');
      } else {
        setErrorMessage("Supported formats: PDF, DOCX, TXT, CSV, Excel");
        setUploadState('error');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const ext = getExtension(selectedFile.name);
      if (['pdf', 'docx', 'txt', 'csv', 'xlsx', 'xls'].includes(ext)) {
        setFile(selectedFile);
        setUploadState('idle');
      } else {
        setErrorMessage("Supported formats: PDF, DOCX, TXT, CSV, Excel");
        setUploadState('error');
      }
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploadState('uploading');
    setErrorMessage('');
    setProgressPercent(10);
    setProcessingStatus('Uploading');
    
    try {
      const data = await uploadDocument(file, sessionId);
      if (data.status === 'Ready') {
        setUploadState('success');
        const chunks = data.total_chunks !== undefined ? data.total_chunks : (data.chunk_count !== undefined ? data.chunk_count : 0);
        setChunkCount(chunks);
        setActiveDocument({
          name: file.name,
          chunks: chunks
        });
        setFile(null);
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      } else {
        setPollingDocId(data.document_id);
      }
    } catch (error) {
      console.error(error);
      const detail = error.response?.data?.detail || "Upload ingestion failed. Verify configurations.";
      setErrorMessage(detail);
      setUploadState('error');
    }
  };

  useEffect(() => {
    if (!pollingDocId) return;

    const intervalId = setInterval(async () => {
      try {
        const data = await fetchDocumentStatus(pollingDocId);
        if (data.status === 'Ready') {
          clearInterval(intervalId);
          setUploadState('success');
          setChunkCount(data.chunk_count);
          setActiveDocument({
            name: file ? file.name : "Ingested Document",
            chunks: data.chunk_count
          });
          setFile(null);
          setPollingDocId(null);
          if (onUploadSuccess) {
            onUploadSuccess();
          }
        } else if (data.status === 'Failed') {
          clearInterval(intervalId);
          setUploadState('error');
          setErrorMessage("Ingestion processing failed.");
          setPollingDocId(null);
        } else {
          setProcessingStatus(data.status);
          if (data.status === 'Extracting') setProgressPercent(30);
          else if (data.status === 'Chunking') setProgressPercent(50);
          else if (data.status === 'Embedding') setProgressPercent(70);
          else if (data.status === 'Indexing') setProgressPercent(90);
        }
      } catch (err) {
        console.error("Status polling failed:", err);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [pollingDocId, file, activeDocument, onUploadSuccess]);

  const username = localStorage.getItem('rag_username') || "Viswateja";
  const userEmail = `${username.toLowerCase()}@enterprise.ai`;
  const sessionCount = sessions.length;
  const docCount = sessionDocuments.length;
  const userInitials = username.slice(0, 2).toUpperCase();

  const [activeModel, setActiveModel] = useState(() => {
    return localStorage.getItem('active_model') || 'llama3.3';
  });

  const handleModelChange = (model) => {
    setActiveModel(model);
    localStorage.setItem('active_model', model);
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') return <span className="text-red-500 text-[9px] font-bold">PDF</span>;
    if (ext === 'docx' || ext === 'doc') return <span className="text-indigo-400 text-[9px] font-bold">DOCX</span>;
    if (['csv', 'xlsx', 'xls'].includes(ext)) return <span className="text-emerald-500 text-[9px] font-bold">XLSX</span>;
    return <span className="text-cyan-500 text-[9px] font-bold">TXT</span>;
  };

  return (
    <div className={`h-full bg-white flex flex-col text-[#1E293B] border-r border-[#E2E8F0] shrink-0 font-sans shadow-sm relative overflow-hidden transition-all duration-300 select-none ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      
      {/* Brand Header */}
      <div className={`p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50/50 ${isCollapsed ? 'justify-center' : ''}`}>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-[#E2E8F0] flex items-center justify-center shadow-sm">
            <Database className="w-4 h-4 text-[#6366F1]" />
          </div>
          {!isCollapsed && (
            <span className="font-extrabold text-sm tracking-wide text-[#1E293B] animate-fade-in">
              DocVerse AI
            </span>
          )}
        </div>
      </div>

      {/* User Profile Card */}
      <div className={`p-4 border-b border-[#E2E8F0] bg-slate-50/20 flex flex-col space-y-3 ${isCollapsed ? 'items-center justify-center space-y-0 p-3' : ''}`}>
        <div className="flex items-center space-x-3" title={isCollapsed ? `${username} (${userEmail})` : undefined}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white font-extrabold text-sm shadow-md ring-2 ring-indigo-500/15 relative shrink-0">
            <span>{userInitials}</span>
            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
              backendStatus === 'online' ? 'bg-emerald-500' : 'bg-rose-500'
            }`} />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0 animate-fade-in">
              <div className="flex items-center space-x-1.5">
                <p className="text-xs font-bold text-slate-800 truncate">{username}</p>
                {userRole === 'admin' && (
                  <span className="text-[8px] bg-indigo-50 text-indigo-600 dark:bg-indigo-950/45 dark:text-indigo-400 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider border border-indigo-200 dark:border-indigo-800/30 shrink-0">Admin</span>
                )}
              </div>
              <p className="text-[9px] text-[#64748B] truncate">{userEmail}</p>
            </div>
          )}
        </div>
        
        {!isCollapsed && (
          <div className="space-y-3 animate-fade-in">
            <div className="grid grid-cols-3 gap-1.5 text-[9px] bg-[#F5F7FA] p-2 rounded-xl border border-[#E2E8F0] font-medium text-[#64748B] select-none">
              <div>
                <span className="block font-bold text-slate-400 uppercase tracking-wider text-[8px]">Sessions</span>
                <span className="text-[10px] font-bold text-indigo-600 truncate block">{sessionCount} threads</span>
              </div>
              <div>
                <span className="block font-bold text-slate-400 uppercase tracking-wider text-[8px]">Ingested</span>
                <span className="text-[10px] font-bold text-violet-650 truncate block">{docCount} docs</span>
              </div>
              <div 
                onClick={onResetTokens} 
                className="cursor-pointer hover:bg-slate-200/50 p-0.5 rounded transition-all" 
                title="Click to refill tokens"
              >
                <span className="block font-bold text-slate-400 uppercase tracking-wider text-[8px]">Tokens Left</span>
                <span className="text-[10px] font-bold text-emerald-600 truncate block">{tokensLeft?.toLocaleString() || "100,000"}</span>
              </div>
            </div>
            
            {/* Model Selector */}
            <div className="flex items-center justify-between pt-1 gap-2">
              <div className="flex-1">
                <select 
                  value={activeModel} 
                  onChange={e => handleModelChange(e.target.value)}
                  className="w-full py-1.5 px-2 bg-white border border-[#E2E8F0] rounded-lg text-[9px] font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all duration-200"
                >
                  <option value="llama3.3">Llama 3.3</option>
                  <option value="gemini-pro">Gemini 1.5</option>
                  <option value="gpt4o">GPT-4o</option>
                </select>
              </div>
              <div className="flex items-center bg-[#F5F7FA] border border-[#E2E8F0] px-2 py-1 rounded-lg shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  backendStatus === 'online' ? 'bg-emerald-500' : 'bg-rose-500'
                }`} />
                <span className="text-[8px] text-[#64748B] font-bold uppercase tracking-wider pl-1.5">
                  {backendStatus}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main sidebar contents wrapper (independently scrollable) */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 pr-0.5 space-y-4 py-3">
        
        {/* Primary Action Button */}
        <div className={`px-3 ${isCollapsed ? 'flex justify-center' : ''}`}>
          <Button
            variant="primary"
            onClick={onNewChat}
            className={`font-bold transition-all duration-300 ${isCollapsed ? 'p-2.5 rounded-full min-w-0 w-10 h-10 flex items-center justify-center' : 'w-full py-2.5 text-xs'}`}
            icon={<Plus className="w-4 h-4 text-white shrink-0" />}
            title={isCollapsed ? "New Chat Session" : undefined}
          >
            {!isCollapsed && <span>New Chat</span>}
          </Button>
        </div>

        {/* WORKSPACE CATEGORY */}
        <div className="space-y-1">
          {!isCollapsed ? (
            <label className="block text-[8px] font-bold text-[#64748B] uppercase tracking-widest pl-4 mb-1.5 select-none">
              Workspace
            </label>
          ) : (
            <div className="border-b border-[#E2E8F0]/80 my-2 mx-3" />
          )}
          <div className="px-2 space-y-1">
            <button
              onClick={() => onChangeTab('chat')}
              className={`w-full py-2 rounded-xl text-xs font-bold flex items-center border transition-all duration-200 ${
                activeTab === 'chat' 
                  ? 'bg-indigo-50/60 border-indigo-150/40 text-[#6366F1] shadow-sm' 
                  : 'bg-transparent border-transparent hover:bg-slate-50 text-[#64748B] hover:text-[#1E293B]'
              } ${isCollapsed ? 'justify-center px-0' : 'px-3 space-x-2.5'}`}
              title={isCollapsed ? "Chat Assistant" : undefined}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="animate-fade-in">Chat Assistant</span>}
            </button>

            <button
              onClick={() => onChangeTab('study')}
              className={`w-full py-2 rounded-xl text-xs font-bold flex items-center border transition-all duration-200 ${
                activeTab === 'study' 
                  ? 'bg-indigo-50/60 border-indigo-150/40 text-[#6366F1] shadow-sm' 
                  : 'bg-transparent border-transparent hover:bg-slate-50 text-[#64748B] hover:text-[#1E293B]'
              } ${isCollapsed ? 'justify-center px-0' : 'px-3 space-x-2.5'}`}
              title={isCollapsed ? "Study Center" : undefined}
            >
              <GraduationCap className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="animate-fade-in">Study Center</span>}
            </button>

            <button
              onClick={() => onChangeTab('graph')}
              className={`w-full py-2 rounded-xl text-xs font-bold flex items-center border transition-all duration-200 ${
                activeTab === 'graph' 
                  ? 'bg-indigo-50/60 border-indigo-150/40 text-[#6366F1] shadow-sm' 
                  : 'bg-transparent border-transparent hover:bg-slate-50 text-[#64748B] hover:text-[#1E293B]'
              } ${isCollapsed ? 'justify-center px-0' : 'px-3 space-x-2.5'}`}
              title={isCollapsed ? "GraphRAG Connections" : undefined}
            >
              <Network className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="animate-fade-in">GraphRAG Connections</span>}
            </button>

            <button
              onClick={() => onChangeTab('preview')}
              className={`w-full py-2 rounded-xl text-xs font-bold flex items-center border transition-all duration-200 ${
                activeTab === 'preview' 
                  ? 'bg-indigo-50/60 border-indigo-150/40 text-[#6366F1] shadow-sm' 
                  : 'bg-transparent border-transparent hover:bg-slate-50 text-[#64748B] hover:text-[#1E293B]'
              } ${isCollapsed ? 'justify-center px-0' : 'px-3 space-x-2.5'}`}
              title={isCollapsed ? "Context Preview" : undefined}
            >
              <Eye className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="animate-fade-in">Context Preview</span>}
            </button>
            
            <button
              onClick={() => onChangeTab('academic')}
              className={`w-full py-2 rounded-xl text-xs font-bold flex items-center border transition-all duration-200 ${
                activeTab === 'academic' 
                  ? 'bg-indigo-50/60 border-indigo-150/40 text-[#6366F1] shadow-sm' 
                  : 'bg-transparent border-transparent hover:bg-slate-50 text-[#64748B] hover:text-[#1E293B]'
              } ${isCollapsed ? 'justify-center px-0' : 'px-3 space-x-2.5'}`}
              title={isCollapsed ? "Academic Status" : undefined}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="animate-fade-in">Academic Status</span>}
            </button>
          </div>
        </div>

        {/* DOCUMENTS CATEGORY */}
        <div className="space-y-1">
          {!isCollapsed ? (
            <label className="block text-[8px] font-bold text-[#64748B] uppercase tracking-widest pl-4 mb-1.5 select-none">
              Documents
            </label>
          ) : (
            <div className="border-b border-[#E2E8F0]/80 my-2 mx-3" />
          )}
          
          {/* Collapsed Ingest Button */}
          {isCollapsed ? (
            <div className="flex justify-center px-2">
              <button 
                onClick={onButtonClick}
                className="p-2.5 rounded-xl border border-dashed border-[#E2E8F0] hover:border-indigo-400 bg-white text-[#64748B] hover:text-indigo-650 transition-all flex items-center justify-center w-10 h-10 shadow-sm"
                title="Quick Ingest Document"
              >
                <UploadCloud className="w-4 h-4 shrink-0" />
              </button>
              <input 
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                disabled={uploadState === 'uploading'}
              />
            </div>
          ) : (
            /* Expanded Ingest Widget */
            <div className="px-3 space-y-2.5 animate-fade-in select-none">
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={uploadState !== 'uploading' ? onButtonClick : null}
                className={`border border-dashed rounded-xl p-2.5 text-center cursor-pointer transition-all duration-200 bg-[#F8FAFC] hover:bg-white hover:border-indigo-400 ${
                  dragActive ? 'border-[#6366F1] bg-indigo-50/20' : 'border-[#E2E8F0]'
                }`}
              >
                <input 
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={uploadState === 'uploading'}
                />
                <UploadCloud className="w-5 h-5 mx-auto mb-1 text-[#64748B]" />
                <p className="text-[9px] text-[#1E293B] font-bold">
                  Drag files, or <span className="text-indigo-600 hover:underline">browse</span>
                </p>
              </div>

              {/* Selected File Details */}
              {file && uploadState !== 'success' && (
                <div className="bg-white p-2 rounded-xl border border-[#E2E8F0] flex flex-col space-y-1.5 shadow-sm animate-fade-in">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="truncate font-semibold text-slate-800 max-w-[130px]">{file.name}</span>
                    <button onClick={() => setFile(null)} className="text-gray-500 hover:text-rose-500 p-0.5"><X className="w-3 h-3" /></button>
                  </div>
                  
                  {uploadState === 'uploading' ? (
                    <div className="w-full space-y-1">
                      <div className="flex justify-between text-[7px] text-[#64748B] font-bold font-mono">
                        <span>{processingStatus}</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="w-full bg-[#F5F7FA] h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-[#6366F1] rounded-full" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                  ) : (
                    <Button variant="primary" onClick={handleUpload} className="w-full py-1.5 text-[8px] font-bold">
                      Ingest
                    </Button>
                  )}
                </div>
              )}

              {/* Ingest status alerts */}
              {uploadState === 'success' && (
                <div className="bg-emerald-50 border border-emerald-500/10 p-2 rounded-xl flex items-start space-x-1.5 text-[9px] text-emerald-700 animate-fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="flex-1 font-bold leading-tight">Ingested! {chunkCount} chunks.</span>
                  <button onClick={() => setUploadState('idle')}><X className="w-3 h-3 text-emerald-500" /></button>
                </div>
              )}

              {uploadState === 'error' && (
                <div className="bg-rose-50 border border-rose-500/10 p-2 rounded-xl flex items-start space-x-1.5 text-[9px] text-rose-700 animate-fade-in font-bold">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="flex-1 truncate">{errorMessage}</span>
                  <button onClick={() => setUploadState('idle')}><X className="w-3 h-3 text-rose-500" /></button>
                </div>
              )}

              {/* Active context file */}
              {activeDocument && (
                <div className="bg-indigo-50 border border-indigo-100 p-2 rounded-xl flex items-center justify-between text-[9px] text-[#1E293B] shadow-sm select-none animate-fade-in">
                  <div className="flex items-center space-x-1.5 truncate">
                    {getFileIcon(activeDocument.name)}
                    <span className="font-bold text-indigo-600 truncate max-w-[125px]" title={activeDocument.name}>{activeDocument.name}</span>
                  </div>
                  <button onClick={() => setActiveDocument(null)} className="text-gray-500 hover:text-rose-500"><X className="w-3 h-3" /></button>
                </div>
              )}
            </div>
          )}

          {/* Session Documents list */}
          {!isCollapsed && (
            <div className="px-3 pt-2 animate-fade-in">
              <label className="block text-[8px] font-bold text-[#64748B] uppercase tracking-widest pl-1 mb-1.5 select-none">
                Session Documents
              </label>
              {sessionDocuments && sessionDocuments.length > 0 ? (
                <div className="space-y-1.5 max-h-24 overflow-y-auto pr-0.5 scrollbar-thin">
                  {sessionDocuments.map((doc) => (
                    <div 
                      key={doc.document_id} 
                      className="flex items-center justify-between p-1.5 bg-[#F5F7FA] border border-[#E2E8F0] rounded-xl text-[9px] group shadow-sm transition-all"
                    >
                      <div className="flex items-center space-x-1.5 truncate">
                        {getFileIcon(doc.document_name)}
                        <span className="font-semibold text-slate-800 truncate max-w-[120px]" title={doc.document_name}>
                          {doc.document_name}
                        </span>
                      </div>
                      <button
                        onClick={() => onDeleteDocument(doc.document_id)}
                        className="text-gray-500 hover:text-rose-500 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[9px] text-[#64748B] italic px-1 select-none">No active documents.</p>
              )}
            </div>
          )}
        </div>

        {/* Recent Conversations */}
        {!isCollapsed && (
          <div className="px-3 animate-fade-in space-y-1.5">
            <label className="block text-[8px] font-bold text-[#64748B] uppercase tracking-widest pl-1 mb-1 select-none">
              Recent Conversations
            </label>
            
            {sessions.length === 0 ? (
              <div className="text-center py-4 text-[9px] text-[#64748B] italic select-none">
                No active threads
              </div>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5 select-none scrollbar-thin">
                {sessions.map((sess) => {
                  const isSelected = sessionId === sess.id;
                  return (
                    <div
                      key={sess.id}
                      className={`group w-full flex items-center justify-between px-2 py-1.5 rounded-xl text-[10px] cursor-pointer transition-all duration-200 border ${
                        isSelected 
                          ? 'bg-indigo-50 border-indigo-100 text-indigo-650 font-bold scale-[1.01]' 
                          : 'bg-transparent border-transparent hover:bg-slate-50 text-[#64748B] hover:text-[#1E293B]'
                      }`}
                      onClick={() => onSelectSession(sess.id)}
                    >
                      <div className="flex items-center space-x-2 truncate flex-1 mr-2">
                        <MessageSquare className="w-3 h-3 shrink-0 text-[#64748B]" />
                        <span className="truncate">{sess.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(sess.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 text-gray-400 transition-opacity duration-150 p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ADMINISTRATION CATEGORY */}
        {userRole === 'admin' && (
          <div className="space-y-1">
            {!isCollapsed ? (
              <label className="block text-[8px] font-bold text-[#64748B] uppercase tracking-widest pl-4 mb-1.5 select-none">
                Administration
              </label>
            ) : (
              <div className="border-b border-[#E2E8F0]/80 my-2 mx-3" />
            )}
            <div className="px-2 space-y-1">
              <button
                onClick={onOpenDashboard}
                className={`w-full py-2 rounded-xl text-xs font-bold flex items-center border hover:bg-slate-50 text-[#64748B] hover:text-[#1E293B] border-transparent transition-all duration-200 ${isCollapsed ? 'justify-center px-0' : 'px-3 space-x-2.5'}`}
                title={isCollapsed ? "Admin Console" : undefined}
              >
                <BarChart3 className="w-4 h-4 shrink-0 text-indigo-500" />
                {!isCollapsed && <span className="animate-fade-in">Admin Console</span>}
              </button>
            </div>
          </div>
        )}

        {/* APPLICATION CATEGORY */}
        <div className="space-y-1 mt-2">
          {!isCollapsed ? (
            <label className="block text-[8px] font-bold text-[#64748B] uppercase tracking-widest pl-4 mb-1.5 select-none">
              Application
            </label>
          ) : (
            <div className="border-b border-[#E2E8F0]/80 my-2 mx-3" />
          )}
          <div className="px-2 space-y-1">
            <button
              onClick={onOpenSettings}
              className={`w-full py-2 rounded-xl text-xs font-bold flex items-center border hover:bg-slate-50 text-[#64748B] hover:text-[#1E293B] border-transparent transition-all duration-200 ${isCollapsed ? 'justify-center px-0' : 'px-3 space-x-2.5'}`}
              title={isCollapsed ? "Settings Preferences" : undefined}
            >
              <Settings className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="animate-fade-in">Settings Preferences</span>}
            </button>
          </div>
        </div>

      </div>

      {/* Footer Controls panel */}
      <div className={`p-3 border-t border-[#E2E8F0] bg-slate-50 flex flex-col space-y-1.5 ${isCollapsed ? 'items-center justify-center p-2.5' : ''}`}>
        {!isCollapsed ? (
          <>
            {sessions.length > 0 && (
              <button
                onClick={onClearSessions}
                className="w-full flex items-center justify-center space-x-2 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-xl text-[9.5px] font-bold transition-all focus:outline-none"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )}
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center space-x-2 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-[9.5px] font-bold transition-all focus:outline-none"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </>
        ) : (
          <div className="flex flex-col space-y-2">
            {sessions.length > 0 && (
              <button
                onClick={onClearSessions}
                className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-650 rounded-xl flex items-center justify-center w-9 h-9"
                title="Clear Chat History"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
              </button>
            )}
            <button
              onClick={onLogout}
              className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl flex items-center justify-center w-9 h-9"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4 shrink-0" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
