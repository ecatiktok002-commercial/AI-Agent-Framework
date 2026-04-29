import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { Agent } from '../types';
import { Lock, Mail, AlertCircle, Loader2, Eye, EyeOff, MessageSquare, UserPlus, LogIn, User, Smile, Zap } from 'lucide-react';
import { cn } from '../utils';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Personality settings for registration
  const [personality, setPersonality] = useState({
    tone_style: 'professional' as const,
    emoji_level: 'low' as const,
    greeting_template: '',
    signature: '',
    response_style_rules: {
      useStructuredReplies: true,
      useShortSentences: false,
      addEmojisAutomatically: false,
      formalLanguageMode: true
    }
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim() || !password.trim() || (mode === 'register' && !name.trim())) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    console.time('auth_request');

    try {
      if (mode === 'login') {
        // Add a timeout to the request
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Authentication timed out. Please try again.')), 15000)
        );

        const authPromise = supabase
          .from('agents')
          .select('id, name, username, password, role, status, is_approved, tone_style, greeting_template, signature, emoji_level, response_style_rules, created_at')
          .eq('username', username.trim())
          .eq('password', password)
          .maybeSingle();

        const { data, error: fetchError } = await Promise.race([authPromise, timeoutPromise]) as any;
        console.timeEnd('auth_request');
        console.log('Auth result:', { hasData: !!data, hasError: !!fetchError });

        if (fetchError || !data) {
          throw new Error('Invalid credentials');
        }

        if (data.role !== 'admin' && !data.is_approved) {
          throw new Error('Your account is pending approval by an administrator.');
        }

        login(data as Agent);

        if (data.role === 'admin') {
          navigate('/admin/dashboard');
        } else {
          navigate('/agent/dashboard');
        }
      } else {
        // Register with full details
        const { error: regError } = await supabase
          .from('agents')
          .insert([{
            username: username.trim(),
            name: name.trim(),
            password: password,
            role: 'agent',
            status: 'offline',
            is_approved: false,
            ...personality
          }]);

        if (regError) {
          if (regError.code === '23505') {
            throw new Error('Username already exists.');
          }
          throw regError;
        }

        setSuccess('Registration successful! Please wait for an administrator to approve your account.');
        setMode('login');
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handlePersonalityChange = (field: string, value: any) => {
    setPersonality(prev => ({ ...prev, [field]: value }));
  };

  const handleRuleToggle = (rule: string) => {
    setPersonality(prev => ({
      ...prev,
      response_style_rules: {
        ...prev.response_style_rules,
        [rule]: !prev.response_style_rules[rule as keyof typeof prev.response_style_rules]
      }
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="text-center mb-10">
          <img src="https://tnvhriiyuzjhtdqfufmh.supabase.co/storage/v1/object/public/public-assets/logo.png" alt="Logo" className="mx-auto h-14 w-14 rounded-2xl mb-6 shadow-xl shadow-black/10 object-cover" />
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            {mode === 'login' ? 'Welcome back' : 'Create an account'}
          </h2>
          <p className="mt-3 text-sm text-slate-500">
            {mode === 'login' ? 'Sign in to your helpdesk workspace' : 'Join the support team and set up your personality'}
          </p>
        </div>

        <div className="bg-white py-10 px-8 shadow-2xl shadow-slate-200/60 rounded-[2rem] border border-slate-100">
          <form className="space-y-6" onSubmit={handleAuth}>
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-2xl flex items-start gap-3 text-sm animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-4 py-3 rounded-2xl flex items-start gap-3 text-sm animate-in fade-in slide-in-from-top-2">
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <LogIn className="w-3 h-3 text-white" />
                </div>
                <p>{success}</p>
              </div>
            )}

            <div className={cn("grid gap-6", mode === 'register' ? "md:grid-cols-2" : "grid-cols-1")}>
              {/* Basic Info Column */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                  <User className="w-4 h-4 text-blue-500" />
                  Basic Info
                </div>

                {mode === 'register' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all"
                      placeholder="Enter your full name"
                      disabled={loading}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all"
                    placeholder="Enter your username"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all"
                      placeholder="••••••••"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-300 hover:text-slate-600 transition-colors focus:outline-none"
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Personality Column (Only for Register) */}
              {mode === 'register' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <Smile className="w-4 h-4 text-purple-500" />
                    Personality Settings
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Tone Style</label>
                      <select 
                        value={personality.tone_style}
                        onChange={(e) => handlePersonalityChange('tone_style', e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all appearance-none"
                      >
                        <option value="professional">Professional</option>
                        <option value="friendly">Friendly</option>
                        <option value="energetic">Energetic</option>
                        <option value="concise">Concise</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Emoji Level</label>
                      <select 
                        value={personality.emoji_level}
                        onChange={(e) => handlePersonalityChange('emoji_level', e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all appearance-none"
                      >
                        <option value="none">None</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Greeting Template</label>
                    <textarea 
                      value={personality.greeting_template}
                      onChange={(e) => handlePersonalityChange('greeting_template', e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all resize-none"
                      placeholder="e.g. Hi! I'm Mahira 👋"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Signature</label>
                    <textarea 
                      value={personality.signature}
                      onChange={(e) => handlePersonalityChange('signature', e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all resize-none"
                      placeholder="e.g. — Mahira 😊"
                    />
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                      <Zap className="w-4 h-4 text-amber-500" />
                      Response Style Options
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { label: 'Use structured replies', key: 'useStructuredReplies' },
                        { label: 'Use short sentences', key: 'useShortSentences' },
                        { label: 'Add emojis automatically', key: 'addEmojisAutomatically' },
                        { label: 'Formal language mode', key: 'formalLanguageMode' },
                      ].map((rule) => (
                        <div key={rule.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{rule.label}</span>
                          <button 
                            type="button"
                            onClick={() => handleRuleToggle(rule.key)}
                            className={cn(
                              "w-8 h-4 rounded-full relative transition-all",
                              personality.response_style_rules[rule.key as keyof typeof personality.response_style_rules] ? "bg-black" : "bg-slate-300"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                              personality.response_style_rules[rule.key as keyof typeof personality.response_style_rules] ? "right-0.5" : "left-0.5"
                            )} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent rounded-2xl shadow-lg shadow-black/5 text-sm font-bold text-white bg-black hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {mode === 'login' ? 'Authenticating...' : 'Creating account...'}
                </>
              ) : (
                mode === 'login' ? 'Sign in' : 'Create account'
              )}
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                  setSuccess('');
                }}
                className="text-sm font-semibold text-slate-500 hover:text-black transition-colors flex items-center justify-center gap-2 mx-auto"
              >
                {mode === 'login' ? (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Don't have an account? Register
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Already have an account? Sign in
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
