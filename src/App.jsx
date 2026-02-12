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
        fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
        color: '#8b93b0'
      }}>
        <div style={{ textAlign: 'center' }}>
          <Moon size={40} style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
          <p style={{ fontSize: '1rem', fontWeight: 500 }}>A carregar...</p>
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
        fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
        color: '#e0e4f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          * { box-sizing: border-box; }
          body { -webkit-font-smoothing: antialiased; }

          input {
            background: rgba(255, 255, 255, 0.04);
            border: 1.5px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            color: #e0e4f0;
            padding: 0.95rem 1.1rem;
            font-family: 'Inter', -apple-system, system-ui, sans-serif;
            font-size: 0.95rem;
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

          button { cursor: pointer; transition: all 0.2s ease; border: none; font-weight: 600; }
          button:hover { transform: translateY(-1px); opacity: 0.9; }
          button:active { transform: translateY(0); }
          button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        `}</style>

        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 24,
          padding: '2.5rem',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <Moon size={44} color="#60a5fa" strokeWidth={1.8} style={{ margin: '0 auto 1.25rem', display: 'block' }} />
            <h1 style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              margin: '0 0 0.5rem',
              color: '#e0e4f0',
              letterSpacing: '-0.02em'
            }}>
              Sleep Tracker
            </h1>
            <p style={{ color: '#8b93b0', fontSize: '0.9rem', fontWeight: 500 }}>
              {isSignup ? 'Cria a tua conta' : 'Bem-vindo de volta'}
            </p>
          </div>

          <form onSubmit={isSignup ? handleSignup : handleLogin}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.6rem',
                color: '#8b93b0',
                fontSize: '0.85rem',
                fontWeight: 600
              }}>
                <Mail size={15} />
                Email
              </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" required />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.6rem',
                color: '#8b93b0',
                fontSize: '0.85rem',
                fontWeight: 600
              }}>
                <Lock size={15} />
                Password
              </label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>

            {authError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 10,
                padding: '0.85rem',
                marginBottom: '1.5rem',
                color: '#f87171',
                fontSize: '0.875rem',
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
                padding: '1rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
                width: '100%',
                marginBottom: '0.75rem'
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
                padding: '0.85rem',
                fontSize: '0.9rem',
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

  // Main app (when logged in)
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0e27 0%, #1a1f3a 100%)',
      fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
      color: '#e0e4f0',
      padding: '2.5rem 2rem'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { -webkit-font-smoothing: antialiased; }

        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .animate-in { animation: fadeIn 0.5s ease-out; }

        .card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 20px;
          padding: 2rem;
          transition: all 0.2s ease;
        }
        .card:hover { background: rgba(255,255,255,0.03); }

        input[type="time"] {
          background: rgba(255, 255, 255, 0.04);
          border: 1.5px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          color: #e0e4f0;
          padding: 0.9rem 0.75rem;
          font-family: 'Inter', -apple-system, system-ui, sans-serif;
          font-size: 1rem;
          font-weight: 500;
          transition: all 0.2s ease;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
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
          cursor: pointer;
        }

        button { 
          cursor: pointer; 
          transition: all 0.2s ease; 
          font-family: 'Inter', -apple-system, system-ui, sans-serif;
          border: none;
          font-weight: 600;
        }
        button:hover { transform: translateY(-1px); }
        button:active { transform: translateY(0); }

        .record-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 1.35rem;
          transition: all 0.2s ease;
        }
        .record-item:hover { 
          background: rgba(255,255,255,0.03); 
          border-color: rgba(96, 165, 250, 0.12);
        }

        .stat-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 18px;
          padding: 1.75rem;
          text-align: center;
          transition: all 0.2s ease;
        }
        .stat-card:hover { 
          background: rgba(96, 165, 250, 0.04);
          border-color: rgba(96, 165, 250, 0.15);
        }

        .container { max-width: 1400px; margin: 0 auto; width: 100%; }

        @media (max-width: 1024px) { .page { padding: 2rem 1.5rem !important; } }
        @media (max-width: 768px) { 
          .page { padding: 1.5rem 1.25rem !important; } 
          .card { padding: 1.5rem !important; } 
        }
        @media (max-width: 520px) { 
          .page { padding: 1.25rem 1rem !important; } 
          .card { padding: 1.25rem !important; } 
        }

        @media (max-width: 900px) {
          .headerRow { flex-direction: column !important; gap: 1.5rem !important; align-items: flex-start !important; }
          .userPill { width: 100% !important; justify-content: space-between !important; }
        }

        @media (max-width: 768px) {
          .sleep-form-grid { grid-template-columns: 1fr !important; gap: 1.25rem !important; }
          .formBtn { width: 100% !important; justify-content: center !important; }
          
          input[type="time"] {
            padding: 0.75rem !important;
            font-size: 0.95rem !important;
            width: 100% !important;
            margin: 0 !important;
          }
        }

        @media (max-width: 520px) {
          input[type="time"] {
            padding: 0.7rem !important;
            font-size: 0.9rem !important;
          }
        }

        @media (max-width: 900px) { .statsGrid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 520px) { .statsGrid { grid-template-columns: 1fr !important; } }

        .recordGrid {
          display: grid;
          grid-template-columns: 130px 110px 110px 90px 1fr auto;
          gap: 1.25rem;
          align-items: center;
        }

        @media (max-width: 900px) {
          .recordGrid { grid-template-columns: 1fr auto !important; gap: 1rem !important; }
          .recDate { grid-column: 1 / -1 !important; display: flex !important; justify-content: space-between !important; padding-bottom: 0.75rem !important; margin-bottom: 0.75rem !important; border-bottom: 1px solid rgba(255,255,255,0.04) !important; }
          .recBed, .recWake { grid-column: span 1 !important; font-size: 0.9rem !important; }
          .recHours { grid-column: 1 / -1 !important; font-size: 1.5rem !important; margin: 0.5rem 0 !important; }
          .recBadge { grid-column: 1 / -1 !important; margin: 0.5rem 0 !important; }
          .recActions { grid-column: 1 / -1 !important; text-align: left !important; margin-top: 0.75rem !important; padding-top: 0.75rem !important; border-top: 1px solid rgba(255,255,255,0.04) !important; }
          .recActions button { width: 100% !important; }
        }

        html { scroll-behavior: smooth; }
      `}</style>

      <div className="container">
        {/* Header */}
        <div className="animate-in headerRow" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2.5rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <Moon size={32} color="#60a5fa" strokeWidth={2} />
              <h1 style={{
                fontSize: '2rem',
                fontWeight: 700,
                color: '#e0e4f0',
                letterSpacing: '-0.02em'
              }}>
                Sleep Tracker
              </h1>
            </div>
            <p style={{ color: '#8b93b0', fontSize: '0.95rem', fontWeight: 500, marginLeft: '2.75rem' }}>
              Acompanha o teu sono
            </p>
          </div>

          <div className="userPill" style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 14,
            padding: '0.75rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
              <User size={18} color="#8b93b0" />
              <span style={{
                color: '#8b93b0',
                fontSize: '0.9rem',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '280px'
              }}>
                {user.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: 10,
                color: '#f87171',
                padding: '0.5rem 0.9rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <LogOut size={15} />
              Sair
            </button>
          </div>
        </div>

        {/* Input Form */}
        <div className="card animate-in" style={{ marginBottom: '2rem' }}>
          <form onSubmit={handleSubmit}>
            <div className="sleep-form-grid" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr auto',
              gap: '1.5rem',
              alignItems: 'end'
            }}>            
              <div style={{ width: '100%' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.65rem',
                  color: '#8b93b0',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}>
                  <Moon size={16} />
                  Deitar
                </label>
                <input type="time" value={bedTime} onChange={(e) => setBedTime(e.target.value)} required />
              </div>

              <div style={{ width: '100%' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.65rem',
                  color: '#8b93b0',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}>
                  <Sun size={16} />
                  Acordar
                </label>
                <input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} required />
              </div>

              <button
                type="submit"
                className="formBtn"
                style={{
                  background: '#60a5fa',
                  borderRadius: 14,
                  color: 'white',
                  padding: '0.9rem 1.75rem',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Plus size={19} />
                Adicionar
              </button>
            </div>
          </form>
        </div>

        {/* Stats & Actions */}
        {sleepRecords.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: '0.85rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowStats(!showStats)}
                style={{
                  background: 'rgba(96, 165, 250, 0.08)',
                  border: '1px solid rgba(96, 165, 250, 0.15)',
                  borderRadius: 12,
                  color: '#60a5fa',
                  padding: '0.75rem 1.35rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <TrendingUp size={17} />
                {showStats ? 'Ocultar' : 'Ver'} Estatísticas
              </button>

              <button
                onClick={exportData}
                style={{
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.15)',
                  borderRadius: 12,
                  color: '#4ade80',
                  padding: '0.75rem 1.35rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Download size={17} />
                Exportar CSV
              </button>
            </div>

            {showStats && (
              <div style={{ marginBottom: '2rem' }}>
                <div className="statsGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
                  <div className="stat-card">
                    <div style={{ fontSize: '0.8rem', color: '#8b93b0', marginBottom: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Média</div>
                    <div style={{ fontSize: '2.25rem', fontWeight: 700, color: '#e0e4f0' }}>{stats.avg}h</div>
                  </div>

                  <div className="stat-card">
                    <div style={{ fontSize: '0.8rem', color: '#8b93b0', marginBottom: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Melhor</div>
                    <div style={{ fontSize: '2.25rem', fontWeight: 700, color: '#4ade80' }}>{stats.best}h</div>
                  </div>

                  <div className="stat-card">
                    <div style={{ fontSize: '0.8rem', color: '#8b93b0', marginBottom: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pior</div>
                    <div style={{ fontSize: '2.25rem', fontWeight: 700, color: '#f87171' }}>{stats.worst}h</div>
                  </div>

                  <div className="stat-card">
                    <div style={{ fontSize: '0.8rem', color: '#8b93b0', marginBottom: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registos</div>
                    <div style={{ fontSize: '2.25rem', fontWeight: 700, color: '#fbbf24' }}>{stats.total}</div>
                  </div>
                </div>

                {chartData.length > 1 && (
                  <div className="card">
                    <h3 style={{ fontSize: '1.05rem', marginBottom: '1.5rem', color: '#8b93b0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Últimos 14 dias
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="date" stroke="#8b93b0" style={{ fontSize: '0.8rem', fontFamily: 'Inter' }} />
                        <YAxis stroke="#8b93b0" style={{ fontSize: '0.8rem', fontFamily: 'Inter' }} />
                        <Tooltip
                          contentStyle={{ background: 'rgba(10, 14, 39, 0.98)', border: '1px solid rgba(96, 165, 250, 0.2)', borderRadius: '12px', fontFamily: 'Inter', fontSize: '0.875rem' }}
                          labelStyle={{ color: '#60a5fa', marginBottom: '0.4rem', fontWeight: 600 }}
                        />
                        <Line type="monotone" dataKey="hours" stroke="#60a5fa" strokeWidth={2.5} dot={{ fill: '#60a5fa', r: 4 }} activeDot={{ r: 6, fill: '#3b82f6' }} />
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
          <h2 style={{ fontSize: '1.05rem', marginBottom: '1.5rem', color: '#8b93b0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Calendar size={20} />
            Histórico
          </h2>

          {sleepRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#8b93b0' }}>
              <Moon size={42} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1rem', fontWeight: 500 }}>Ainda não tens registos.</p>
              <p style={{ fontSize: '0.9rem', marginTop: '0.4rem', opacity: 0.7 }}>Adiciona a tua primeira entrada acima!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {sleepRecords.map((record, index) => (
                <div key={record.id} className="record-item" style={{ animation: `fadeIn 0.4s ease-out ${index * 0.04}s backwards` }}>
                  <div className="recordGrid">
                    <div className="recDate">
                      <div style={{ fontWeight: 600, color: '#e0e4f0', fontSize: '0.95rem' }}>{formatPT(record.date)}</div>
                      <div className="dow" style={{ fontSize: '0.82rem', color: '#8b93b0', fontWeight: 500 }}>{dayShortPT(record.date)}</div>
                    </div>

                    <div className="recBed" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#c7cfe0' }}>
                      <Moon size={15} color="#8b93b0" />
                      {record.bed_time}
                    </div>

                    <div className="recWake" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#c7cfe0' }}>
                      <Sun size={15} color="#fbbf24" />
                      {record.wake_time}
                    </div>

                    <div className="recHours" style={{ fontWeight: 700, fontSize: '1.15rem', color: record.hours >= 7 ? '#4ade80' : record.hours >= 6 ? '#fbbf24' : '#f87171' }}>
                      {record.hours}h
                    </div>

                    <div className="recBadge">
                      <span style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: 8,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: record.hours >= 7 ? 'rgba(74, 222, 128, 0.1)' : record.hours >= 6 ? 'rgba(251, 191, 36, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                        color: record.hours >= 7 ? '#4ade80' : record.hours >= 6 ? '#fbbf24' : '#f87171',
                        border: `1px solid ${record.hours >= 7 ? 'rgba(74, 222, 128, 0.2)' : record.hours >= 6 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(248, 113, 113, 0.2)'}`
                      }}>
                        {record.hours >= 7 ? '✓ Boa' : record.hours >= 6 ? '~ Média' : '✗ Fraca'}
                      </span>
                    </div>

                    <div className="recActions" style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => deleteRecord(record.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.15)',
                          borderRadius: 10,
                          color: '#f87171',
                          padding: '0.5rem 1rem',
                          fontSize: '0.85rem',
                          fontWeight: 600
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ height: '2rem' }} />
      </div>
    </div>
  );
}