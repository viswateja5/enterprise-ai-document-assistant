import React, { useState } from 'react';
import { Database, UserPlus } from 'lucide-react';
import { signupUser } from '../api';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Spinner } from '../components/ui/Loader';

export default function Register({ onSignupSuccess, onNavigateToLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    
    if (username.length < 3) {
      setError("Username must be at least 3 characters long");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await signupUser(username, password);
      setSuccess(true);
      setTimeout(() => {
        onSignupSuccess();
      }, 1500);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || "Registration failed. Username may already be taken.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto py-8 flex flex-col justify-start md:justify-center items-center px-4 select-none scrollbar-thin">
      <Card hover={false} className="w-full max-w-md border border-slate-200 dark:border-white/10 shadow-2xl p-8 relative overflow-hidden bg-white/80 dark:bg-[#1E293B]/70 backdrop-blur-xl">
        {/* Brand Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6]/20 border border-indigo-500/20 rounded-2xl flex items-center justify-center mb-4 shadow-[0_4px_15px_rgba(99,102,241,0.15)]">
            <Database className="w-7 h-7 text-[#6366F1] dark:text-indigo-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">Create Account</h1>
          <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-widest">Register for DocVerse AI</p>
        </div>

        {error && (
          <div className="mb-5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 p-3.5 rounded-xl text-xs text-rose-600 dark:text-rose-450 font-bold text-center animate-fade-in shadow-sm">
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="mb-5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 p-3.5 rounded-xl text-xs text-emerald-600 dark:text-emerald-450 font-bold text-center animate-fade-in shadow-sm">
            ✅ Registration successful! Redirecting...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            id="register-username"
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Min 3 characters"
            disabled={loading || success}
          />

          <Input
            id="register-password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 6 characters"
            disabled={loading || success}
          />

          <Button
            type="submit"
            disabled={loading || success}
            variant="primary"
            className="w-full mt-6 py-3 font-bold"
            icon={loading ? <Spinner size="sm" className="border-white" /> : <UserPlus className="w-4 h-4 text-white" />}
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Already have an account?{' '}
          <button 
            onClick={onNavigateToLogin}
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold focus:outline-none transition-colors"
            disabled={loading || success}
          >
            Log in here
          </button>
        </div>
      </Card>
    </div>
  );
}
