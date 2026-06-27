// Standalone Client-Side API & Search Engine Emulation Layer with FastAPI Hybrid Gateway
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
let isOfflineMode = true;

axios.defaults.timeout = 15000;

// Axios response interceptor for retrying failed GET requests and parsing friendly error messages
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    
    // Do not retry if config is missing, method is not GET, already retried, or is the health endpoint
    if (!config || config.method !== 'get' || config.__isRetryRequest || (config.url && config.url.endsWith('/health'))) {
      if (!response) {
        error.message = "Network connection failure. Please verify the backend service is running.";
      } else if (response.status >= 500) {
        error.message = "Server error. Please try again or contact the administrator.";
      }
      return Promise.reject(error);
    }
    
    const isTimeout = error.code === 'ECONNABORTED';
    const isNetworkError = !response;
    const is5xx = response && response.status >= 500;
    
    if (isTimeout || isNetworkError || is5xx) {
      config.__isRetryRequest = true;
      try {
        // Wait 1 second before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        return await axios(config);
      } catch (retryError) {
        if (!retryError.response) {
          retryError.message = "Network connection failure. Please verify the backend service is running.";
        } else if (retryError.response.status >= 500) {
          retryError.message = "Server error. Please try again or contact the administrator.";
        }
        return Promise.reject(retryError);
      }
    }
    
    return Promise.reject(error);
  }
);

const getHeaders = () => {
  const token = localStorage.getItem('rag_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const checkConnection = async () => {
  try {
    const res = await axios.get(`${API_BASE}/health`, { timeout: 4000 });
    isOfflineMode = !(res.data && res.data.status === "healthy");
  } catch (e) {
    isOfflineMode = true;
  }
};

// Initialize immediately in the background
checkConnection();

// Helper utilities for local storage management
const loadFromStorage = (key, defaultVal) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultVal;
};

const saveToStorage = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

// Initialize Local Databases if not present
if (!localStorage.getItem('rag_users')) {
  saveToStorage('rag_users', [
    { username: 'testuser', password: 'password123' }
  ]);
}
if (!localStorage.getItem('rag_sessions')) {
  saveToStorage('rag_sessions', []);
}
if (!localStorage.getItem('rag_documents')) {
  saveToStorage('rag_documents', []);
}
if (!localStorage.getItem('rag_chunks')) {
  saveToStorage('rag_chunks', []);
}
if (!localStorage.getItem('rag_stats')) {
  saveToStorage('rag_stats', {
    total_users: 1,
    total_chats: 0,
    uploaded_documents: 0,
    number_of_chunks: 0,
    query_count: 0,
    average_response_time: 0.15,
    cache_hits: 0
  });
}

// Emulate backend latency
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const signupUser = async (username, password) => {
  if (username === 'viswateja') {
    throw {
      response: {
        data: { detail: "Username 'viswateja' is reserved for system administrator." }
      }
    };
  }
  await checkConnection();
  if (!isOfflineMode) {
    const res = await axios.post(`${API_BASE}/signup`, { username, password });
    return res.data;
  }
  
  await delay(400);
  const users = loadFromStorage('rag_users', []);
  if (users.some(u => u.username === username)) {
    throw {
      response: {
        data: { detail: "Username already taken." }
      }
    };
  }
  
  users.push({ username, password });
  saveToStorage('rag_users', users);
  
  // Increment stats
  const stats = loadFromStorage('rag_stats', {});
  stats.total_users = users.length;
  saveToStorage('rag_stats', stats);
  
  return { status: "created", username };
};

export const loginUser = async (username, password) => {
  if (username === 'viswateja' && password !== '090805') {
    throw {
      response: {
        data: { detail: "Incorrect username or password." }
      }
    };
  }

  await checkConnection();
  if (!isOfflineMode) {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    const res = await axios.post(`${API_BASE}/login`, params);
    if (res.data && res.data.access_token) {
      localStorage.setItem('rag_token', res.data.access_token);
      localStorage.setItem('rag_username', username);
      localStorage.setItem('rag_user_role', res.data.role || (username === 'viswateja' ? 'admin' : 'user'));
    }
    return res.data;
  }
  
  await delay(450);
  if (username === 'viswateja' && password === '090805') {
    const mockToken = `mock_jwt_token_viswateja_${Date.now()}`;
    localStorage.setItem('rag_token', mockToken);
    localStorage.setItem('rag_username', username);
    localStorage.setItem('rag_user_role', 'admin');
    return {
      access_token: mockToken,
      token_type: "bearer",
      role: "admin"
    };
  }
  
  const users = loadFromStorage('rag_users', []);
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    throw {
      response: {
        data: { detail: "Invalid login credentials." }
      }
    };
  }
  
  const mockToken = `mock_jwt_token_${username}_${Date.now()}`;
  localStorage.setItem('rag_token', mockToken);
  localStorage.setItem('rag_username', username);
  localStorage.setItem('rag_user_role', 'user');
  
  return {
    access_token: mockToken,
    token_type: "bearer",
    role: "user"
  };
};

export const checkHealth = async () => {
  await checkConnection();
  if (!isOfflineMode) {
    return { status: "online" };
  }
  return { status: "offline" };
};

// Generates educational study materials from parsed text chunks client-side
const generateClientEduContent = (chunks, contentType, difficulty, count) => {
  // Mock fallback topics if no chunks are uploaded
  if (chunks.length === 0) {
    if (contentType === 'mcqs') {
      const questions = [];
      for (let i = 0; i < count; i++) {
        questions.push({
          question: `Sample Question ${i + 1}: What is the primary purpose of a session-aware RAG vector database?`,
          options: [
            "To isolate search retrieval documents within active user chat boundaries",
            "To speed up hard disk reads across distributed nodes",
            "To encrypt passwords using direct bcrypt monkeypatching",
            "To record speech-to-text queries in browser-native frames"
          ],
          correct_answer: "To isolate search retrieval documents within active user chat boundaries",
          explanation: "Session-aware retrieval tags document chunks with session IDs to guarantee isolated context boundaries, preventing queries in one session from retrieving files uploaded in another session."
        });
      }
      return { questions };
    } else if (contentType === 'flashcards') {
      const flashcards = [];
      for (let i = 0; i < count; i++) {
        flashcards.push({
          front: `Concept Keycard ${i + 1}: Session Isolation`,
          back: "Restricting text searches exclusively to files uploaded inside the active conversation window."
        });
      }
      return { flashcards };
    } else if (contentType === 'interview') {
      const qa = [];
      for (let i = 0; i < count; i++) {
        qa.push({
          question: `Interview Q&A ${i + 1}: Why use Ensemble Hybrid Retrieval?`,
          answer: "Ensemble search combines semantic vector similarity (FAISS) with lexical keyword matching (BM25) using weight parameters like 0.7/0.3, ensuring high recall accuracy for both conceptual and keyword-exact lookups."
        });
      }
      return { qa };
    } else {
      return {
        text: "# System Revision Guide\n\n- **Document Isolation**: Tagging chunk nodes with `session_id` constraints.\n- **Optimized Router**: Classifies incoming query types to set dynamic K parameters.\n- **Interactive Front-End**: Modernized glassmorphic widgets with 3D card flips, pulsing recording icons, and MCQ choice glows."
      };
    }
  }

  // Extract terms and construct worksheets dynamically based on actual chunks text!
  const fullText = chunks.map(c => c.text).join(" ");
  const sentences = fullText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
  
  if (contentType === 'mcqs') {
    const questions = [];
    const maxQuestions = Math.min(count, sentences.length);
    
    for (let i = 0; i < maxQuestions; i++) {
      const sentence = sentences[i];
      const words = sentence.split(" ").filter(w => w.length > 5);
      const keyword = words.length > 0 ? words[Math.floor(Math.random() * words.length)] : "RAG";
      
      const cleanQuestion = sentence.replace(new RegExp(keyword, 'g'), "______");
      const distractors = [
        "Alternative configuration",
        "Legacy system parameter",
        "Encrypted database key",
        "Standard user prompt"
      ];
      
      const options = [keyword, ...distractors].sort(() => Math.random() - 0.5);
      
      questions.push({
        question: `Question ${i + 1}: ${cleanQuestion}?`,
        options,
        correct_answer: keyword,
        explanation: `In the provided document text, the missing term is exactly "${keyword}". The context sentence states: "${sentence}".`
      });
    }
    
    while (questions.length < count) {
      questions.push({
        question: `System Fact Question ${questions.length + 1}: What is the primary purpose of document context chunks?`,
        options: ["To represent text segments for vector search", "To cache database queries", "To hash passwords", "To play speech recordings"],
        correct_answer: "To represent text segments for vector search",
        explanation: "Document chunks represent split segments of document text indexed inside the vector store to allow high-precision text retrieval."
      });
    }
    
    return { questions };
  } else if (contentType === 'flashcards') {
    const flashcards = [];
    const maxCards = Math.min(count, sentences.length);
    
    for (let i = 0; i < maxCards; i++) {
      const sentence = sentences[i];
      const words = sentence.split(" ");
      const subject = words.slice(0, 3).join(" ");
      
      flashcards.push({
        front: `Key Concept: ${subject}...`,
        back: sentence
      });
    }
    
    while (flashcards.length < count) {
      flashcards.push({
        front: `Core Concept ${flashcards.length + 1}`,
        back: "Detailed definition parsed from document context chunks."
      });
    }
    return { flashcards };
  } else if (contentType === 'interview') {
    const qa = [];
    const maxQa = Math.min(count, sentences.length);
    
    for (let i = 0; i < maxQa; i++) {
      const sentence = sentences[i];
      const words = sentence.split(" ").filter(w => w.length > 4);
      const keyword = words.length > 0 ? words[0] : "Entity";
      
      qa.push({
        question: `Can you explain the relevance of ${keyword} in the context of this document?`,
        answer: `According to the document details, "${sentence}". This indicates that ${keyword} plays a key role in the overall architecture.`
      });
    }
    
    while (qa.length < count) {
      qa.push({
        question: `Core Interview Query ${qa.length + 1}: How does the document structure define its main points?`,
        answer: "The document organizes its topics sequentially, using paragraphs and page markers to segregate conceptual data into scrapable index chunks."
      });
    }
    return { qa };
  } else {
    // Revision Sheet Notes
    let notesText = `# Document Revision Sheet Summary\n\n`;
    notesText += `## Ingestion Overview\nThis guide compiles key points extracted directly from your parsed session documents.\n\n`;
    notesText += `## Key Extracted Details\n`;
    sentences.slice(0, 10).forEach(s => {
      notesText += `- **Core Fact**: ${s}.\n`;
    });
    notesText += `\n*End of automatically compiled revision guide.*`;
    return { text: notesText };
  }
};

// Generates entity network graph relationships client-side
const generateClientGraphData = (chunks) => {
  if (chunks.length === 0) {
    return {
      found: true,
      details: [
        { source: "Local Client", source_type: "System", relationship: "simulates", target: "FastAPI Backend", target_type: "API" },
        { source: "Browser", source_type: "Interface", relationship: "stores", target: "LocalStorage", target_type: "DB" }
      ]
    };
  }
  
  // Extract capitalized words as entities
  const fullText = chunks.map(c => c.text).join(" ");
  const words = fullText.split(/\s+/);
  const entities = [...new Set(words.filter(w => w.length > 5 && /^[A-Z][a-zA-Z]+$/.test(w.replace(/[^a-zA-Z]/g, ''))))].slice(0, 10);
  
  const details = [];
  for (let i = 0; i < entities.length - 1; i++) {
    details.push({
      source: entities[i],
      source_type: "Concept",
      relationship: "correlates to",
      target: entities[i + 1],
      target_type: "Concept"
    });
  }
  
  if (details.length === 0) {
    details.push({ source: "Document", source_type: "File", relationship: "contains", target: "Text Content", target_type: "Information" });
  }
  
  return { found: true, details };
};

// Core standalone parser that converts text strings into page chunks
const processTextToChunks = (text, fileName, sessionId) => {
  const cleanText = text.replace(/\r\n/g, "\n");
  const paragraphs = cleanText.split("\n\n").map(p => p.trim()).filter(p => p.length > 0);
  
  const docId = `doc_${Math.random().toString(36).substring(2, 9)}`;
  const docChunks = [];
  
  let currentChunkText = "";
  let page = 1;
  let chunkIdx = 1;
  
  const finalizeChunk = (textBlock) => {
    docChunks.push({
      session_id: sessionId,
      document_id: docId,
      document_name: fileName,
      chunk_id: `${docId}_chk_${chunkIdx++}`,
      text: textBlock,
      page: page
    });
    if (chunkIdx % 3 === 0) page++;
  };

  paragraphs.forEach(para => {
    if ((currentChunkText + "\n\n" + para).length > 600) {
      finalizeChunk(currentChunkText);
      currentChunkText = para;
    } else {
      currentChunkText = currentChunkText ? (currentChunkText + "\n\n" + para) : para;
    }
  });
  
  if (currentChunkText) {
    finalizeChunk(currentChunkText);
  }
  
  return {
    document: {
      session_id: sessionId,
      document_id: docId,
      document_name: fileName,
      chunk_count: docChunks.length,
      sizeBytes: text.length,
      upload_timestamp: new Date().toISOString()
    },
    chunks: docChunks
  };
};

export const uploadDocument = async (file, sessionId = null) => {
  await checkConnection();
  if (!isOfflineMode) {
    const formData = new FormData();
    formData.append('file', file);
    if (sessionId) {
      formData.append('session_id', sessionId);
    }
    const res = await axios.post(`${API_BASE}/upload`, formData, {
      headers: {
        ...getHeaders(),
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data;
  }
  
  await delay(800);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result || "";
      const parsed = processTextToChunks(text, file.name, sessionId || 'default_session');
      
      const docs = loadFromStorage('rag_documents', []);
      docs.push(parsed.document);
      saveToStorage('rag_documents', docs);
      
      const chunks = loadFromStorage('rag_chunks', []);
      chunks.push(...parsed.chunks);
      saveToStorage('rag_chunks', chunks);
      
      const stats = loadFromStorage('rag_stats', {});
      stats.uploaded_documents = docs.length;
      stats.number_of_chunks = chunks.length;
      saveToStorage('rag_stats', stats);
      
      resolve({
        message: "Successfully parsed document.",
        document_id: parsed.document.document_id,
        total_chunks: parsed.document.chunk_count,
        status: "Ready"
      });
    };
    reader.onerror = () => reject(new Error("Failed to read upload file context."));
    reader.readAsText(file);
  });
};

export const fetchSessionDocuments = async (sessionId) => {
  await checkConnection();
  if (!isOfflineMode) {
    const res = await axios.get(`${API_BASE}/session/${sessionId}/documents`, { headers: getHeaders() });
    return res.data;
  }
  
  await delay(200);
  const docs = loadFromStorage('rag_documents', []);
  return docs.filter(d => d.session_id === sessionId);
};

export const deleteDocument = async (documentId) => {
  await checkConnection();
  if (!isOfflineMode) {
    const res = await axios.delete(`${API_BASE}/document/${documentId}`, { headers: getHeaders() });
    return res.data;
  }
  
  await delay(300);
  const docs = loadFromStorage('rag_documents', []);
  const filteredDocs = docs.filter(d => d.document_id !== documentId);
  saveToStorage('rag_documents', filteredDocs);
  
  const chunks = loadFromStorage('rag_chunks', []);
  const filteredChunks = chunks.filter(c => c.document_id !== documentId);
  saveToStorage('rag_chunks', filteredChunks);
  
  const stats = loadFromStorage('rag_stats', {});
  stats.uploaded_documents = filteredDocs.length;
  stats.number_of_chunks = filteredChunks.length;
  saveToStorage('rag_stats', stats);
  
  return { status: "deleted", document_id: documentId };
};

export const fetchSessions = async () => {
  await checkConnection();
  if (!isOfflineMode) {
    const res = await axios.get(`${API_BASE}/sessions`, { headers: getHeaders() });
    return res.data;
  }
  
  await delay(150);
  return loadFromStorage('rag_sessions', []);
};

export const fetchSessionHistory = async (sessionId) => {
  await checkConnection();
  if (!isOfflineMode) {
    const res = await axios.get(`${API_BASE}/history/${sessionId}`, { headers: getHeaders() });
    return res.data;
  }
  
  await delay(200);
  const sessions = loadFromStorage('rag_sessions', []);
  const sess = sessions.find(s => s.id === sessionId);
  return sess || { id: sessionId, name: "New Conversation", messages: [] };
};

export const deleteSession = async (sessionId) => {
  await checkConnection();
  if (!isOfflineMode) {
    const res = await axios.delete(`${API_BASE}/session/${sessionId}`, { headers: getHeaders() });
    return res.data;
  }
  
  await delay(250);
  const sessions = loadFromStorage('rag_sessions', []);
  const filtered = sessions.filter(s => s.id !== sessionId);
  saveToStorage('rag_sessions', filtered);
  
  const docs = loadFromStorage('rag_documents', []);
  const filteredDocs = docs.filter(d => d.session_id !== sessionId);
  saveToStorage('rag_documents', filteredDocs);
  
  const chunks = loadFromStorage('rag_chunks', []);
  const filteredChunks = chunks.filter(c => c.session_id !== sessionId);
  saveToStorage('rag_chunks', filteredChunks);
  
  const stats = loadFromStorage('rag_stats', {});
  stats.total_chats = filtered.length;
  stats.uploaded_documents = filteredDocs.length;
  stats.number_of_chunks = filteredChunks.length;
  saveToStorage('rag_stats', stats);
  
  return { status: "deleted", session_id: sessionId };
};

export const fetchAdminStats = async () => {
  await checkConnection();
  if (!isOfflineMode) {
    const res = await axios.get(`${API_BASE}/admin/stats`, { headers: getHeaders() });
    return res.data;
  }
  
  await delay(300);
  return loadFromStorage('rag_stats', {});
};

// Client-Side hybrid keyword search implementation
const searchClientChunks = (query, sessionId, globalSearch) => {
  const chunks = loadFromStorage('rag_chunks', []);
  const sessionChunks = globalSearch ? chunks : chunks.filter(c => c.session_id === sessionId);
  
  if (sessionChunks.length === 0) return [];
  
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (queryTerms.length === 0) return sessionChunks.slice(0, 3);
  
  const scored = sessionChunks.map(chunk => {
    let score = 0;
    const chunkTextLower = chunk.text.toLowerCase();
    queryTerms.forEach(term => {
      if (chunkTextLower.includes(term)) {
        score += 1;
        const idx = chunkTextLower.indexOf(term);
        if (idx !== -1) {
          score += 0.5;
        }
      }
    });
    return { chunk, score };
  });
  
  const matches = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  return matches.map(m => m.chunk);
};

export const queryStream = async (
  question, 
  sessionId, 
  globalSearch,
  onToken, 
  onSources, 
  onError, 
  onDone,
  onTrace,
  onDecision,
  onConfidence,
  onIntent
) => {
  // 1. Try querying the backend first (this wakes up a sleeping server naturally)
  try {
    onDecision("agent");
    onTrace([
      "Connecting to remote agent graph...",
      "Awaiting query dispatch..."
    ]);
    
    const response = await fetch(`${API_BASE}/agent/query`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question,
        session_id: sessionId,
        global_search: globalSearch
      })
    });
    
    if (!response.ok) {
      throw new Error(`Remote query failed: HTTP ${response.status}`);
    }
    
    isOfflineMode = false;
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
          const rawData = line.trim().slice(6);
          try {
            const parsed = JSON.parse(rawData);
            if (parsed.type === 'sources') {
              onSources(parsed.data);
            } else if (parsed.type === 'content') {
              onToken(parsed.data);
            } else if (parsed.type === 'decision') {
              onDecision(parsed.data);
            } else if (parsed.type === 'confidence') {
              onConfidence(parsed.data);
            } else if (parsed.type === 'intent') {
              if (typeof onIntent === 'function') onIntent(parsed.data);
            } else if (parsed.type === 'trace') {
              onTrace(parsed.data);
            }
          } catch (e) {
            // JSON parse error
          }
        }
      }
    }
    
    onConfidence(0.95);
    onDone();
    return;
  } catch (err) {
    console.warn("Remote query connection failed, falling back to local offline mock:", err);
    isOfflineMode = true;
  }

  // 2. Local offline mock fallback
  try {
    const cleanQ = question.toLowerCase().trim().replace(/[?.!]/g, "");
    const username = localStorage.getItem('rag_username') || "Explorer";
    
    let intent = "general_knowledge";
    let decision = "llm";
    let answer = "";
    
    // Simulate thinking steps
    onDecision("agent");
    onTrace([
      "Offline local agent initialized.",
      "Analyzing query intent locally..."
    ]);
    
    await delay(350);
    
    if (cleanQ === "hi" || cleanQ === "hello" || cleanQ === "hey") {
      intent = "greeting";
      decision = "rule_based";
      answer = `Hello ${username}! I'm running in offline local mode because I couldn't reach the backend. How can I help you today?`;
    } else if (cleanQ.includes("help") || cleanQ.includes("what can you do")) {
      intent = "help";
      decision = "rule_based";
      answer = "I can search documents, answer queries based on uploaded files, and help you prepare for exams or interviews. Since I'm offline, upload and remote search are disabled.";
    } else if (cleanQ.includes("joke")) {
      intent = "joke";
      decision = "rule_based";
      answer = "Why don't databases go on dates? Because they prefer one-to-many relationships! 😄";
    } else if (cleanQ.includes("thank")) {
      intent = "thanks";
      decision = "rule_based";
      answer = "You're very welcome! Let me know if you need anything else.";
    } else if (cleanQ.includes("bye") || cleanQ.includes("exit")) {
      intent = "goodbye";
      decision = "rule_based";
      answer = `Goodbye ${username}! Hope to see you online soon.`;
    } else {
      // General knowledge / Greeting / Casual
      intent = "general_knowledge";
      decision = "llm";
      answer = `I am running in local offline mode because I couldn't connect to the backend server. To answer general knowledge queries (like "${question}"), please ensure the backend server is running and the connection indicator is Green (ONLINE).`;
    }

    if (typeof onIntent === 'function') onIntent(intent);

    if (intent === "document") {
      onTrace([
        "Query received. Initializing client-side agent graph...",
        "Evaluating query intent structure: document",
        `Checking session-isolated vector index for session: ${sessionId}`
      ]);
      
      await delay(350);
      const matchedChunks = searchClientChunks(question, sessionId, globalSearch);
      const sources = matchedChunks.slice(0, 3).map(chunk => ({
        chunk_id: chunk.chunk_id,
        file: chunk.document_name,
        page: chunk.page.toString()
      }));
      
      onSources(sources);
      
      let confidence = 0.95;
      if (sources.length > 0) {
        onTrace([
          `Ensembled Hybrid search matched ${matchedChunks.length} documents.`,
          "Reranker: cross-encoder scoring top passages...",
          "Formulating synthesis reasoning context with citations..."
        ]);
        confidence = 0.95;
        const citedSnippet = matchedChunks[0].text;
        answer = `Based on the document context in **${matchedChunks[0].document_name}** (Page ${matchedChunks[0].page}), here is the information:\n\n${citedSnippet}\n\nLet me know if you need to extract specific study guides or see relationship connections in GraphRAG.`;
      } else {
        onTrace([
          "No matching local session document chunks found.",
          "Triggering offline fallback response..."
        ]);
        confidence = 0.20;
        answer = "I couldn’t find relevant information in uploaded documents.";
      }
      
      onConfidence(confidence);
    } else {
      // General knowledge / Greeting / Casual
      onTrace([
        "Query received. Initializing client-side agent graph...",
        `Evaluating query intent: ${intent}`,
        "Bypassing vector retrieval node..."
      ]);
      onSources([]);
      onConfidence(1.0);
      await delay(250);
    }
    
    let currentIdx = 0;
    const streamInterval = setInterval(() => {
      if (currentIdx < answer.length) {
        const nextChar = answer[currentIdx++];
        onToken(nextChar);
      } else {
        clearInterval(streamInterval);
        
        const sessions = loadFromStorage('rag_sessions', []);
        let sess = sessions.find(s => s.id === sessionId);
        if (!sess) {
          sess = { id: sessionId, name: question.substring(0, 20), messages: [] };
          sessions.push(sess);
        }
        
        sess.messages.push({
          role: 'user',
          content: question,
          created_at: new Date().toISOString()
        });
        
        sess.messages.push({
          role: 'assistant',
          content: answer,
          sources: intent === "document" ? searchClientChunks(question, sessionId, globalSearch).slice(0, 3).map(c => ({ chunk_id: c.chunk_id, file: c.document_name, page: c.page.toString() })) : [],
          decision: decision,
          intent: intent,
          reasoning_trace: [
            "Client-Side Ingestion Node complete.",
            "Intent classification complete.",
            "Text response rendered successfully."
          ],
          confidence_score: intent === "document" ? 0.95 : 1.0,
          created_at: new Date().toISOString()
        });
        
        saveToStorage('rag_sessions', sessions);
        
        const stats = loadFromStorage('rag_stats', {});
        stats.query_count = (stats.query_count || 0) + 1;
        stats.total_chats = sessions.length;
        saveToStorage('rag_stats', stats);
        
        onDone();
      }
    }, 12);
    
  } catch (err) {
    onError(err);
  }
};

export const exportSession = async (sessionId, format) => {
  await checkConnection();
  if (!isOfflineMode) {
    // We can fetch from local or backend. Backend export also works,
    // but building the Blob in JS is extremely fast and avoids network roundtrips!
  }
  
  await delay(300);
  const sess = await fetchSessionHistory(sessionId);
  const messages = sess.messages || [];
  
  let content = "";
  if (format === 'markdown') {
    content = `# Chat Session Export: ${sess.name}\n\n`;
    messages.forEach(m => {
      content += `### ${m.role === 'user' ? 'User' : 'Assistant'}\n${m.content}\n\n`;
    });
    return new Blob([content], { type: 'text/markdown' });
  } else if (format === 'pdf') {
    content = `<html><head><title>${sess.name}</title><style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
      h1 { font-size: 24px; color: #111; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
      .message { margin-bottom: 20px; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
      .user { background-color: #f8fafc; border-left: 4px solid #64748b; }
      .assistant { background-color: #f0fdf4; border-left: 4px solid #10b981; }
      .meta { font-size: 11px; font-weight: bold; color: #64748b; margin-bottom: 5px; text-transform: uppercase; }
      .text { font-size: 14px; }
    </style></head><body>`;
    content += `<h1>Chat Session Export: ${sess.name}</h1>`;
    messages.forEach(m => {
      const roleClass = m.role === 'user' ? 'user' : 'assistant';
      content += `<div class="message ${roleClass}">`;
      content += `<div class="meta">${m.role}</div>`;
      content += `<div class="text">${m.content.replace(/\n/g, '<br/>')}</div></div>`;
    });
    content += `<script>window.onload = function() { window.print(); }</script></body></html>`;
    return new Blob([content], { type: 'text/html' });
  } else if (format === 'docx') {
    content = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><title>${sess.name}</title><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom></w:WordDocument></xml></head><body style="font-family: Arial, sans-serif; padding: 20px;">`;
    content += `<h1>Chat Session Export: ${sess.name}</h1>`;
    messages.forEach(m => {
      content += `<div style="margin-bottom: 20px; padding: 10px; border-bottom: 1px solid #eee;">`;
      content += `<strong style="text-transform: uppercase; color: ${m.role === 'user' ? '#475569' : '#059669'};">${m.role}:</strong>`;
      content += `<p style="font-size: 11pt;">${m.content.replace(/\n/g, '<br/>')}</p></div>`;
    });
    content += `</body></html>`;
    return new Blob([content], { type: 'application/msword' });
  } else {
    content = `<html><head><title>${sess.name}</title></head><body style="font-family:sans-serif;padding:30px;background:#111;color:#eee;">`;
    content += `<h1>Chat Session Export: ${sess.name}</h1>`;
    messages.forEach(m => {
      content += `<div style="margin:20px 0;padding:15px;background:#222;border-radius:8px;">`;
      content += `<strong>${m.role === 'user' ? 'User' : 'Assistant'}</strong><p>${m.content}</p></div>`;
    });
    content += `</body></html>`;
    return new Blob([content], { type: 'text/html' });
  }
};

// Client-Side Speech Synthesis (TTS) using window.speechSynthesis
export const speakText = async (text) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.text = text.substring(0, 300);
    window.speechSynthesis.speak(utterance);
  } else {
    console.warn("speechSynthesis is not supported in this browser.");
  }
  return new Blob([], { type: 'audio/wav' });
};

// Client-Side Speech Recognition (STT) interface
export const transcribeSpeech = async (audioBlob) => {
  await delay(500);
  return { text: "Voice input transcribed locally via browser recognition." };
};

export const fetchEduContent = async (sessionId, contentType, difficulty, count = 5) => {
  await checkConnection();
  if (!isOfflineMode) {
    const res = await axios.get(`${API_BASE}/edu/generate`, {
      params: { session_id: sessionId, content_type: contentType, difficulty, count },
      headers: getHeaders()
    });
    return res.data;
  }
  
  await delay(1000);
  const chunks = loadFromStorage('rag_chunks', []);
  const sessionChunks = chunks.filter(c => c.session_id === sessionId);
  return generateClientEduContent(sessionChunks, contentType, difficulty, count);
};

export const fetchGraphPath = async (sessionId, source, target) => {
  await checkConnection();
  if (!isOfflineMode) {
    const res = await axios.get(`${API_BASE}/agent/graph/path`, {
      params: { session_id: sessionId, source, target },
      headers: getHeaders()
    });
    return res.data;
  }
  
  await delay(400);
  const chunks = loadFromStorage('rag_chunks', []);
  const sessionChunks = chunks.filter(c => c.session_id === sessionId);
  const pathDetails = generateClientGraphData(sessionChunks);
  return pathDetails;
};

export const fetchGraphData = async (sessionId) => {
  await checkConnection();
  if (!isOfflineMode) {
    const res = await axios.get(`${API_BASE}/agent/graph/data`, {
      params: { session_id: sessionId },
      headers: getHeaders()
    });
    return res.data;
  }
  
  await delay(300);
  const chunks = loadFromStorage('rag_chunks', []);
  const sessionChunks = chunks.filter(c => c.session_id === sessionId);
  return generateClientGraphData(sessionChunks);
};

export const fetchDocumentStatus = async (documentId) => {
  await checkConnection();
  if (!isOfflineMode) {
    const res = await axios.get(`${API_BASE}/document/${documentId}/status`, { headers: getHeaders() });
    return res.data; // { document_id, status, chunk_count }
  }
  return { document_id: documentId, status: "Ready", chunk_count: 0 };
};
