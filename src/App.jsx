//Para dar update: npm run dev
//Para meter no Github: git add . ;
//                      git commit -m "mensagem" ;
//                      git push

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Moon, Sun, TrendingUp, Download, Plus, Calendar, LogOut, User, Mail, Lock } from 'lucide-react';
import { supabase } from './supabase';

// ---------- helpers de data (YYYY-MM-DD) ----------
const pad2 = (n) => String(n).padStart(2, '0');

const todayLocalISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const formatPT = (iso) => {
  if (!iso || typeof iso !== 'string') return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

const isoToDateLocal = (iso) => {
  if (!iso || typeof iso !== 'string') return new Date(NaN);
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const dayShortPT = (iso) => {
  const dt = isoToDateLocal(iso);
  if (isNaN(dt.getTime())) return '';
  return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dt.getDay()];
};

const dayLongPT = (iso) => {
  const dt = isoToDateLocal(iso);
  if (isNaN(dt.getTime())) return '';
  return ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dt.getDay()];
};

const formatDDMM = (iso) => {
  if (!iso || typeof iso !== 'string') return '';
  const [y, m, d] = iso.split('-');
  if (!m || !d) return iso;
  return `${d}/${m}`;
};

export default function SleepTracker() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sleepRecords, setSleepRecords] = useState([]);
  const [bedTime, setBedTime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [showStats, setShowStats] = useState(false);

  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Check auth state on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load sleep records from Supabase when user logs in
  useEffect(() => {
    if (!user) {
      setSleepRecords([]);
      return;
    }

    loadRecords();

    const channel = supabase
      .channel(`sleep_users_changes_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Sleep_Users',
          filter: `user_id=eq.${user.id}`
        },
        () => loadRecords()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  const loadRecords = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('Sleep_Users')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading records:', error);
      alert('Erro ao carregar registos: ' + error.message);
    } else {
      setSleepRecords(data || []);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      alert('✓ Conta criada! Verifica o teu email para confirmar a conta.');
      setEmail('');
      setPassword('');
      setIsSignup(false);
    } catch (error) {
      console.error('Signup error:', error);
      setAuthError(error.message || 'Erro ao criar conta');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      setEmail('');
      setPassword('');
    } catch (error) {
      console.error('Login error:', error);
      if (error.message?.includes('Invalid login credentials')) {
        setAuthError('Email ou password incorretos');
      } else if (error.message?.includes('Email not confirmed')) {
        setAuthError('Por favor confirma o teu email antes de fazer login');
      } else {
        setAuthError(error.message || 'Erro ao fazer login');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSleepRecords([]);
  };

  const calculateSleepHours = (bedTime, wakeTime) => {
    const [bedHour, bedMin] = bedTime.split(':').map(Number);
    const [wakeHour, wakeMin] = wakeTime.split(':').map(Number);

    let bedTimeMinutes = bedHour * 60 + bedMin;
    let wakeTimeMinutes = wakeHour * 60 + wakeMin;

    if (wakeTimeMinutes < bedTimeMinutes) wakeTimeMinutes += 24 * 60;

    const totalMinutes = wakeTimeMinutes - bedTimeMinutes;
    return (totalMinutes / 60).toFixed(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!bedTime || !wakeTime) {
      alert('Por favor preenche ambas as horas!');
      return;
    }

    try {
      const hours = calculateSleepHours(bedTime, wakeTime);
      const today = todayLocalISO();

      const { data, error } = await supabase
        .from('Sleep_Users')
        .insert([
          {
            user_id: user.id,
            date: today,
            bed_time: bedTime,
            wake_time: wakeTime,
            hours: parseFloat(hours),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) setSleepRecords(prev => [data, ...prev]);

      setBedTime('');
      setWakeTime('');
      alert(`✓ Registo adicionado: ${hours}h de sono!`);
    } catch (error) {
      console.error('Error adding record:', error);
      alert('Erro ao adicionar registo: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const deleteRecord = async (id) => {
    if (!confirm('Tens a certeza que queres eliminar este registo?')) return;

    try {
      setSleepRecords(prev => prev.filter(r => r.id !== id));

      const { error } = await supabase.from('Sleep_Users').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('Erro ao eliminar registo: ' + (error.message || 'Erro desconhecido'));
      loadRecords();
    }
  };

  const stats = {
    avg: sleepRecords.length > 0
      ? (sleepRecords.reduce((sum, r) => sum + r.hours, 0) / sleepRecords.length).toFixed(1)
      : 0,
    best: sleepRecords.length > 0
      ? Math.max(...sleepRecords.map(r => r.hours)).toFixed(1)
      : 0,
    worst: sleepRecords.length > 0
      ? Math.min(...sleepRecords.map(r => r.hours)).toFixed(1)
      : 0,
    total: sleepRecords.length
  };

  const exportData = () => {
    const header = ['Data', 'Dia da Semana', 'Hora de Deitar', 'Hora de Acordar', 'Horas Dormidas', 'Qualidade'];

    const rows = sleepRecords.map(r => {
      const iso = r.date;
      const quality = r.hours >= 7 ? 'Boa' : r.hours >= 6 ? 'Média' : 'Fraca';

      return [
        formatPT(iso),
        dayLongPT(iso),
        r.bed_time,
        r.wake_time,
        `${r.hours}h`,
        quality
      ];
    });

    const summaryRows = [
      [],
      ['ESTATÍSTICAS'],
      ['Média de Sono', '', '', '', `${stats.avg}h`],
      ['Melhor Noite', '', '', '', `${stats.best}h`],
      ['Pior Noite', '', '', '', `${stats.worst}h`],
      ['Total de Registos', '', '', '', stats.total]
    ];

    const allRows = [header, ...rows, ...summaryRows];
    const csv = allRows.map(row => row.join(';')).join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sono_${todayLocalISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    alert(`✓ Ficheiro exportado com ${sleepRecords.length} registos!`);
  };

  const chartData = sleepRecords
    .slice(0, 14)
    .reverse()
    .map(r => ({
      date: formatDDMM(r.date),
      hours: r.hours
    }));

  // Loading state
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0a0e27 0%, #1a1f3a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
        color: '#8b93b0',
        padding: '1rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <Moon size={36} style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
          <p style={{ fontSize: '0.95rem', fontWeight: 500 }}>A carregar...</p>
        </div>
      </div>
    );
  }

  // Login screen
  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0a0e27 0%, #1a1f3a 100%)',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
        color: '#e0e4f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }}>
        <style>{`
          * { 
            box-sizing: border-box; 
            -webkit-tap-highlight-color: transparent;
          }
          body { 
            -webkit-font-smoothing: antialiased;
            -webkit-text-size-adjust: 100%;
          }

          input {
            background: rgba(255, 255, 255, 0.04);
            border: 1.5px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            color: #e0e4f0;
            padding: 0.9rem 1rem;
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
            font-size: 16px;
            font-weight: 500;
            transition: all 0.2s ease;
            width: 100%;
          }
          input:focus {
            outline: none;
            border-color: #60a5fa;
            background: rgba(96, 165, 250, 0.06);
            box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.08);
          }
          input::placeholder { color: rgba(139, 147, 176, 0.5); }

          button { 
            cursor: pointer; 
            transition: all 0.2s ease; 
            border: none; 
            font-weight: 600;
            -webkit-tap-highlight-color: transparent;
          }
          button:active { transform: scale(0.98); }
          button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        `}</style>

        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 20,
          padding: '2rem 1.5rem',
          maxWidth: 400,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <Moon size={40} color="#60a5fa" strokeWidth={1.8} style={{ margin: '0 auto 1rem', display: 'block' }} />
            <h1 style={{
              fontSize: '1.65rem',
              fontWeight: 700,
              margin: '0 0 0.4rem',
              color: '#e0e4f0',
              letterSpacing: '-0.02em'
            }}>
              Sleep Tracker
            </h1>
            <p style={{ color: '#8b93b0', fontSize: '0.875rem', fontWeight: 500 }}>
              {isSignup ? 'Cria a tua conta' : 'Bem-vindo de volta'}
            </p>
          </div>

          <form onSubmit={isSignup ? handleSignup : handleLogin}>
            <div style={{ marginBottom: '1.15rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                marginBottom: '0.55rem',
                color: '#8b93b0',
                fontSize: '0.8rem',
                fontWeight: 600
              }}>
                <Mail size={14} />
                Email
              </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" required />
            </div>

            <div style={{ marginBottom: '1.4rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                marginBottom: '0.55rem',
                color: '#8b93b0',
                fontSize: '0.8rem',
                fontWeight: 600
              }}>
                <Lock size={14} />
                Password
              </label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>

            {authError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 10,
                padding: '0.8rem',
                marginBottom: '1.4rem',
                color: '#f87171',
                fontSize: '0.85rem',
                fontWeight: 500
              }}>
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              style={{
                background: '#60a5fa',
                borderRadius: 12,
                color: 'white',
                padding: '0.95rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                fontFamily: '-apple-system, sans-serif',
                width: '100%',
                marginBottom: '0.7rem'
              }}
            >
              {authLoading ? 'A processar...' : (isSignup ? 'Criar Conta' : 'Entrar')}
            </button>

            <button
              type="button"
              onClick={() => { setIsSignup(!isSignup); setAuthError(''); }}
              style={{
                background: 'transparent',
                border: '1.5px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                color: '#8b93b0',
                padding: '0.8rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                width: '100%'
              }}
            >
              {isSignup ? 'Já tens conta? Entrar' : 'Criar nova conta'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main app (when logged in) - MOBILE FIRST
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0e27 0%, #1a1f3a 100%)',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
      color: '#e0e4f0',
      padding: '1.25rem 1rem',
      paddingBottom: '2rem'
    }}>
      <style>{`
        * { 
          box-sizing: border-box; 
          margin: 0; 
          padding: 0;
          -webkit-tap-highlight-color: transparent;
        }
        body { 
          -webkit-font-smoothing: antialiased;
          -webkit-text-size-adjust: 100%;
        }

        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .animate-in { animation: fadeIn 0.4s ease-out; }

        .card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 18px;
          padding: 1.35rem;
          transition: all 0.2s ease;
        }

        input[type="time"] {
          background: rgba(255, 255, 255, 0.04);
          border: 1.5px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          color: #e0e4f0;
          padding: 0.85rem 1rem;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
          font-size: 16px;
          font-weight: 500;
          transition: all 0.2s ease;
          width: 100%;
          display: block;
        }
        input[type="time"]:focus { 
          outline: none; 
          border-color: #60a5fa; 
          background: rgba(96, 165, 250, 0.06);
          box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.08);
        }
        input[type="time"]::-webkit-calendar-picker-indicator { 
          filter: invert(1); 
          opacity: 0.6;
        }

        button { 
          cursor: pointer; 
          transition: all 0.2s ease; 
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
          border: none;
          font-weight: 600;
        }
        button:active { transform: scale(0.98); }

        .record-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          padding: 1.15rem;
          transition: all 0.2s ease;
        }

        .stat-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 1.5rem;
          text-align: center;
        }

        html { scroll-behavior: smooth; }

        /* Desktop adjustments */
        @media (min-width: 768px) {
          .container { max-width: 600px; margin: 0 auto; }
        }
      `}</style>

      <div className="container">
        {/* Header */}
        <div className="animate-in" style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Moon size={28} color="#60a5fa" strokeWidth={2} />
              <h1 style={{
                fontSize: '1.6rem',
                fontWeight: 700,
                color: '#e0e4f0',
                letterSpacing: '-0.02em'
              }}>
                Sleep Tracker
              </h1>
            </div>
            
            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: 10,
                color: '#f87171',
                padding: '0.5rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <LogOut size={14} />
              Sair
            </button>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#8b93b0',
            fontSize: '0.85rem',
            fontWeight: 500
          }}>
            <User size={15} />
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {user.email}
            </span>
          </div>
        </div>

        {/* Input Form */}
        <div className="card animate-in" style={{ marginBottom: '1.5rem' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.15rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                marginBottom: '0.55rem',
                color: '#8b93b0',
                fontSize: '0.8rem',
                fontWeight: 600
              }}>
                <Moon size={15} />
                Deitar
              </label>
              <input type="time" value={bedTime} onChange={(e) => setBedTime(e.target.value)} required />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                marginBottom: '0.55rem',
                color: '#8b93b0',
                fontSize: '0.8rem',
                fontWeight: 600
              }}>
                <Sun size={15} />
                Acordar
              </label>
              <input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} required />
            </div>

            <button
              type="submit"
              style={{
                background: '#60a5fa',
                borderRadius: 12,
                color: 'white',
                padding: '0.95rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                width: '100%'
              }}
            >
              <Plus size={18} />
              Adicionar
            </button>
          </form>
        </div>

        {/* Stats & Actions */}
        {sleepRecords.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowStats(!showStats)}
                style={{
                  flex: 1,
                  background: 'rgba(96, 165, 250, 0.08)',
                  border: '1px solid rgba(96, 165, 250, 0.15)',
                  borderRadius: 12,
                  color: '#60a5fa',
                  padding: '0.75rem 1.15rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem'
                }}
              >
                <TrendingUp size={16} />
                {showStats ? 'Ocultar' : 'Ver'} Estatísticas
              </button>

              <button
                onClick={exportData}
                style={{
                  flex: 1,
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.15)',
                  borderRadius: 12,
                  color: '#4ade80',
                  padding: '0.75rem 1.15rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem'
                }}
              >
                <Download size={16} />
                Exportar
              </button>
            </div>

            {showStats && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem', marginBottom: '1.5rem' }}>
                  <div className="stat-card">
                    <div style={{ fontSize: '0.75rem', color: '#8b93b0', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Média</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#e0e4f0' }}>{stats.avg}h</div>
                  </div>

                  <div className="stat-card">
                    <div style={{ fontSize: '0.75rem', color: '#8b93b0', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Melhor</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#4ade80' }}>{stats.best}h</div>
                  </div>

                  <div className="stat-card">
                    <div style={{ fontSize: '0.75rem', color: '#8b93b0', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pior</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f87171' }}>{stats.worst}h</div>
                  </div>

                  <div className="stat-card">
                    <div style={{ fontSize: '0.75rem', color: '#8b93b0', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registos</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fbbf24' }}>{stats.total}</div>
                  </div>
                </div>

                {chartData.length > 1 && (
                  <div className="card">
                    <h3 style={{ fontSize: '0.95rem', marginBottom: '1.25rem', color: '#8b93b0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Últimos 14 dias
                    </h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="date" stroke="#8b93b0" style={{ fontSize: '0.75rem' }} />
                        <YAxis stroke="#8b93b0" style={{ fontSize: '0.75rem' }} />
                        <Tooltip
                          contentStyle={{ background: 'rgba(10, 14, 39, 0.98)', border: '1px solid rgba(96, 165, 250, 0.2)', borderRadius: '10px', fontSize: '0.8rem' }}
                          labelStyle={{ color: '#60a5fa', marginBottom: '0.3rem', fontWeight: 600 }}
                        />
                        <Line type="monotone" dataKey="hours" stroke="#60a5fa" strokeWidth={2.5} dot={{ fill: '#60a5fa', r: 4 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Records List */}
        <div className="card">
          <h2 style={{ fontSize: '0.95rem', marginBottom: '1.25rem', color: '#8b93b0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} />
            Histórico
          </h2>

          {sleepRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#8b93b0' }}>
              <Moon size={38} style={{ margin: '0 auto 0.85rem', opacity: 0.3 }} />
              <p style={{ fontSize: '0.95rem', fontWeight: 500 }}>Ainda não tens registos.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.35rem', opacity: 0.7 }}>Adiciona a tua primeira entrada acima!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sleepRecords.map((record, index) => (
                <div key={record.id} className="record-item" style={{ animation: `fadeIn 0.3s ease-out ${index * 0.03}s backwards` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontWeight: 600, color: '#e0e4f0', fontSize: '0.9rem' }}>{formatPT(record.date)}</div>
                    <div style={{ fontSize: '0.8rem', color: '#8b93b0', fontWeight: 500 }}>{dayShortPT(record.date)}</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.65rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.875rem', color: '#c7cfe0' }}>
                      <Moon size={14} color="#8b93b0" />
                      {record.bed_time}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.875rem', color: '#c7cfe0' }}>
                      <Sun size={14} color="#fbbf24" />
                      {record.wake_time}
                    </div>
                  </div>

                  <div style={{ fontWeight: 700, fontSize: '1.4rem', color: record.hours >= 7 ? '#4ade80' : record.hours >= 6 ? '#fbbf24' : '#f87171', marginBottom: '0.65rem' }}>
                    {record.hours}h
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{
                      padding: '0.4rem 0.7rem',
                      borderRadius: 8,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: record.hours >= 7 ? 'rgba(74, 222, 128, 0.1)' : record.hours >= 6 ? 'rgba(251, 191, 36, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                      color: record.hours >= 7 ? '#4ade80' : record.hours >= 6 ? '#fbbf24' : '#f87171',
                      border: `1px solid ${record.hours >= 7 ? 'rgba(74, 222, 128, 0.2)' : record.hours >= 6 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(248, 113, 113, 0.2)'}`
                    }}>
                      {record.hours >= 7 ? '✓ Boa' : record.hours >= 6 ? '~ Média' : '✗ Fraca'}
                    </span>

                    <button
                      onClick={() => deleteRecord(record.id)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.15)',
                        borderRadius: 8,
                        color: '#f87171',
                        padding: '0.45rem 0.85rem',
                        fontSize: '0.8rem',
                        fontWeight: 600
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}