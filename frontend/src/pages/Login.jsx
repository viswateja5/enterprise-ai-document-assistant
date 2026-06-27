import React, { useState } from 'react';
import { Database, ArrowRight } from 'lucide-react';
import { loginUser } from '../api';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Spinner } from '../components/ui/Loader';

export default function Login({ onLoginSuccess, onNavigateToSignup }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginType, setLoginType] = useState('user'); // 'user' | 'admin'

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    
    setLoading(true);
    setError('');
    
    try {
      const data = await loginUser(username, password);
      localStorage.setItem('rag_token', data.access_token);
      localStorage.setItem('rag_username', username);
      localStorage.setItem('rag_user_role', data.role || (username === 'viswateja' ? 'admin' : 'user'));
      onLoginSuccess();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || "Invalid login credentials. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto py-8 flex flex-col justify-start md:justify-center items-center px-4 select-none scrollbar-thin">
      <Card hover={false} className="w-full max-w-md border border-slate-200 dark:border-white/10 shadow-xl p-8 relative overflow-hidden bg-white/80 dark:bg-[#1E293B]/70 backdrop-blur-xl">
        {/* Brand Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6]/20 border border-indigo-500/20 rounded-2xl flex items-center justify-center mb-4 shadow-[0_4px_15px_rgba(99,102,241,0.15)]">
            <Database className="w-7 h-7 text-[#6366F1] dark:text-indigo-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">Welcome Back</h1>
          <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-widest">DocVerse AI</p>
        </div>

        {/* User / Admin Tab Selector */}
        <div className="flex bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl mb-6 border border-slate-200/50 dark:border-white/5">
          <button
            type="button"
            onClick={() => {
              setLoginType('user');
              setUsername('');
              setPassword('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              loginType === 'user'
                ? 'bg-white dark:bg-slate-700 text-[#6366F1] dark:text-indigo-450 shadow-sm border border-slate-200/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-gray-250'
            }`}
          >
            User Login
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginType('admin');
              setUsername('');
              setPassword('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              loginType === 'admin'
                ? 'bg-white dark:bg-slate-700 text-[#6366F1] dark:text-indigo-450 shadow-sm border border-slate-200/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-gray-250'
            }`}
          >
            Admin Login
          </button>
        </div>

        {error && (
          <div className="mb-5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 p-3.5 rounded-xl text-xs text-rose-600 dark:text-rose-450 font-bold text-center animate-fade-in shadow-sm">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            id="username-input"
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            disabled={loading}
          />

          <Input
            id="password-input"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            disabled={loading}
          />

          <Button
            type="submit"
            disabled={loading}
            variant="primary"
            className="w-full mt-6 py-3 font-bold"
            icon={loading ? <Spinner size="sm" className="border-white" /> : <ArrowRight className="w-4 h-4 text-white" />}
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Don't have an account?{' '}
          <button 
            onClick={onNavigateToSignup}
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold focus:outline-none transition-colors"
          >
            Create an account
          </button>
        </div>
      </Card>
    </div>
  );
}
