//Para dar update: npm run dev
//Para meter no Github: git add . ;
//                      git commit -m "mensagem" ;  
//                      git push


import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Moon, Sun, TrendingUp, Download, Plus, Calendar, LogOut, User, Mail, Lock } from 'lucide-react';
import { supabase } from './supabase';


// Supabase (lê do .env do Vite)


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

    // Subscribe to real-time updates
    const channel = supabase
      .channel('sleep_records_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Sleep_Users',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          loadRecords();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      console.log('Loaded records:', data);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setEmail('');
      setPassword('');
    } catch (error) {
      console.error('Login error:', error);
      if (error.message.includes('Invalid login credentials')) {
        setAuthError('Email ou password incorretos');
      } else if (error.message.includes('Email not confirmed')) {
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
    
    if (wakeTimeMinutes < bedTimeMinutes) {
      wakeTimeMinutes += 24 * 60;
    }
    
    const totalMinutes = wakeTimeMinutes - bedTimeMinutes;
    return (totalMinutes / 60).toFixed(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Form submitted!', { bedTime, wakeTime });
    
    if (!bedTime || !wakeTime) {
      alert('Por favor preenche ambas as horas!');
      return;
    }

    try {

      const hours = calculateSleepHours(bedTime, wakeTime);
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

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
        .select();


      if (error) throw error;

      console.log('Record added:', data);
      setBedTime('');
      setWakeTime('');
      alert(`✓ Registo adicionado: ${hours}h de sono!`);
    } catch (error) {
      console.error('Error adding record:', error);
      alert('Erro ao adicionar registo: ' + error.message);
    }
  };

  const deleteRecord = async (id) => {
    if (!confirm('Tens a certeza que queres eliminar este registo?')) return;

    try {
      const { error } = await supabase
        .from('Sleep_Users')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('Erro ao eliminar registo: ' + error.message);
    }
  };

  const exportData = () => {
    const header = ['Data', 'Dia da Semana', 'Hora de Deitar', 'Hora de Acordar', 'Horas Dormidas', 'Qualidade'];
    
    const rows = sleepRecords.map(r => {
      const date = new Date(r.date.split('/').reverse().join('-'));
      const dayOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][date.getDay()];
      const quality = r.hours >= 7 ? 'Boa' : r.hours >= 6 ? 'Média' : 'Fraca';
      
      return [
        r.date,
        dayOfWeek,
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
    a.download = `sono_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert(`✓ Ficheiro exportado com ${sleepRecords.length} registos!`);
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

  const chartData = sleepRecords.slice(0, 14).reverse().map(r => ({
    date: r.date.split('/')[0] + '/' + r.date.split('/')[1],
    hours: r.hours
  }));

  // Loading state
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Space Mono", monospace',
        color: '#93c5fd'
      }}>
        <div style={{ textAlign: 'center' }}>
          <Moon size={48} className="icon-float" style={{ margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '1.2rem' }}>A carregar...</p>
        </div>
      </div>
    );
  }

  // Login screen
  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        fontFamily: '"Space Mono", "Courier New", monospace',
        color: '#e0e0e0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Playfair+Display:wght@600;900&display=swap');
          
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          
          .icon-float {
            animation: float 3s ease-in-out infinite;
          }

          input {
            background: rgba(255, 255, 255, 0.08);
            border: 2px solid rgba(147, 197, 253, 0.2);
            border-radius: 12px;
            color: #e0e0e0;
            padding: 1rem;
            font-family: 'Space Mono', monospace;
            font-size: 1rem;
            transition: all 0.3s ease;
            width: 100%;
          }
          
          input:focus {
            outline: none;
            border-color: #93c5fd;
            background: rgba(255, 255, 255, 0.12);
            box-shadow: 0 0 20px rgba(147, 197, 253, 0.2);
          }

          button {
            cursor: pointer;
            transition: all 0.3s ease;
          }
          
          button:hover {
            transform: translateY(-2px);
          }
          
          button:active {
            transform: translateY(0);
          }

          button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
          }
        `}</style>

        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '3rem',
          maxWidth: '450px',
          width: '100%'
        }}>
          <div className="icon-float" style={{ 
            display: 'inline-block', 
            marginBottom: '1rem',
            width: '100%',
            textAlign: 'center'
          }}>
            <Moon size={56} color="#93c5fd" strokeWidth={1.5} />
          </div>
          
          <h1 style={{
            fontFamily: '"Playfair Display", serif',
            fontSize: '2.5rem',
            fontWeight: 900,
            margin: '0.5rem 0',
            background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textAlign: 'center',
            letterSpacing: '-0.02em'
          }}>
            Sleep Tracker
          </h1>
          
          <p style={{ 
            color: '#9ca3af', 
            fontSize: '0.95rem',
            marginTop: '0.5rem',
            marginBottom: '2rem',
            textAlign: 'center',
            letterSpacing: '0.05em'
          }}>
            {isSignup ? 'Cria a tua conta' : 'Entra na tua conta'}
          </p>

          <form onSubmit={isSignup ? handleSignup : handleLogin}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                marginBottom: '0.75rem',
                color: '#93c5fd',
                fontSize: '0.85rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                <Mail size={16} />
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="o-teu-email@exemplo.com"
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                marginBottom: '0.75rem',
                color: '#93c5fd',
                fontSize: '0.85rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                <Lock size={16} />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {authError && (
              <div style={{
                background: 'rgba(248, 113, 113, 0.1)',
                border: '1px solid rgba(248, 113, 113, 0.3)',
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '1.5rem',
                color: '#f87171',
                fontSize: '0.9rem'
              }}>
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              style={{
                background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 700,
                fontFamily: 'Space Mono, monospace',
                width: '100%',
                boxShadow: '0 4px 20px rgba(96, 165, 250, 0.3)',
                marginBottom: '1rem'
              }}
            >
              {authLoading ? 'A processar...' : (isSignup ? 'Criar Conta' : 'Entrar')}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setAuthError('');
              }}
              style={{
                background: 'transparent',
                border: '2px solid rgba(147, 197, 253, 0.3)',
                borderRadius: '12px',
                color: '#93c5fd',
                padding: '0.75rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                fontFamily: 'Space Mono, monospace',
                width: '100%'
              }}
            >
              {isSignup ? 'Já tens conta? Entra aqui' : 'Não tens conta? Cria uma'}
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
      background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      fontFamily: '"Space Mono", "Courier New", monospace',
      color: '#e0e0e0',
      padding: '2rem 3rem'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Playfair+Display:wght@600;900&display=swap');
        
        * {
          box-sizing: border-box;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        .animate-in {
          animation: fadeIn 0.6s ease-out;
        }
        
        .card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 2rem;
          transition: all 0.3s ease;
        }
        
        .card:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(147, 197, 253, 0.3);
          transform: translateY(-2px);
        }
        
        input[type="time"] {
          background: rgba(255, 255, 255, 0.08);
          border: 2px solid rgba(147, 197, 253, 0.2);
          border-radius: 12px;
          color: #e0e0e0;
          padding: 1rem;
          font-family: 'Space Mono', monospace;
          font-size: 1.1rem;
          transition: all 0.3s ease;
          width: 100%;
        }
        
        input[type="time"]:focus {
          outline: none;
          border-color: #93c5fd;
          background: rgba(255, 255, 255, 0.12);
          box-shadow: 0 0 20px rgba(147, 197, 253, 0.2);
        }
        
        input[type="time"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          cursor: pointer;
        }
        
        button {
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        button:hover {
          transform: translateY(-2px);
        }
        
        button:active {
          transform: translateY(0);
        }
        
        .record-item {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 1.25rem;
          transition: all 0.3s ease;
        }
        
        .record-item:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(147, 197, 253, 0.2);
          transform: translateX(4px);
        }
        
        .stat-card {
          background: linear-gradient(135deg, rgba(147, 197, 253, 0.1) 0%, rgba(96, 165, 250, 0.05) 100%);
          border: 1px solid rgba(147, 197, 253, 0.2);
          border-radius: 16px;
          padding: 1.5rem;
          text-align: center;
          transition: all 0.3s ease;
        }
        
        .stat-card:hover {
          background: linear-gradient(135deg, rgba(147, 197, 253, 0.15) 0%, rgba(96, 165, 250, 0.08) 100%);
          transform: scale(1.05);
        }
        
        .icon-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>

      <div style={{ width: '100%' }}>
        {/* Header with user info */}
        <div className="animate-in" style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
          animation: 'fadeIn 0.6s ease-out'
        }}>
          <div style={{ textAlign: 'left' }}>
            <div className="icon-float" style={{ 
              display: 'inline-block', 
              marginBottom: '1rem' 
            }}>
              <Moon size={56} color="#93c5fd" strokeWidth={1.5} />
            </div>
            <h1 style={{
              fontFamily: '"Playfair Display", serif',
              fontSize: '3.5rem',
              fontWeight: 900,
              margin: '0.5rem 0',
              background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em'
            }}>
              Sleep Tracker
            </h1>
            <p style={{ 
              color: '#9ca3af', 
              fontSize: '1.1rem',
              marginTop: '0.5rem',
              letterSpacing: '0.05em'
            }}>
              Regista o teu sono e acompanha os teus padrões
            </p>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '1rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <User size={20} color="#93c5fd" />
              <span style={{ color: '#93c5fd', fontSize: '0.95rem' }}>
                {user.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#f87171',
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                fontFamily: 'Space Mono, monospace',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </div>

        {/* Input Form */}
        <div className="card animate-in" style={{ 
          marginBottom: '2rem',
          animation: 'fadeIn 0.6s ease-out 0.1s backwards'
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr auto', 
              gap: '2rem',
              alignItems: 'end',
              maxWidth: '900px',
              margin: '0 auto'
            }}>
              <div>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  marginBottom: '0.75rem',
                  color: '#93c5fd',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}>
                  <Moon size={18} />
                  Hora de Deitar
                </label>
                <input
                  type="time"
                  value={bedTime}
                  onChange={(e) => setBedTime(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  marginBottom: '0.75rem',
                  color: '#fbbf24',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}>
                  <Sun size={18} />
                  Hora de Acordar
                </label>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  required
                />
              </div>
              
              <button
                type="submit"
                style={{
                  background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  padding: '1rem 2rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  fontFamily: 'Space Mono, monospace',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 20px rgba(96, 165, 250, 0.3)'
                }}
              >
                <Plus size={20} />
                Adicionar
              </button>
            </div>
          </form>
        </div>

        {/* Stats & Actions */}
        {sleepRecords.length > 0 && (
          <>
            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              marginBottom: '2rem',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => setShowStats(!showStats)}
                className="animate-in"
                style={{
                  background: 'rgba(147, 197, 253, 0.1)',
                  border: '2px solid rgba(147, 197, 253, 0.3)',
                  borderRadius: '12px',
                  color: '#93c5fd',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  fontFamily: 'Space Mono, monospace',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  animation: 'fadeIn 0.6s ease-out 0.2s backwards'
                }}
              >
                <TrendingUp size={18} />
                {showStats ? 'Ocultar' : 'Ver'} Estatísticas
              </button>
              
              <button
                onClick={exportData}
                className="animate-in"
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '2px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '12px',
                  color: '#4ade80',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  fontFamily: 'Space Mono, monospace',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  animation: 'fadeIn 0.6s ease-out 0.25s backwards'
                }}
              >
                <Download size={18} />
                Exportar CSV
              </button>
            </div>

            {/* Statistics */}
            {showStats && (
              <div className="animate-in" style={{
                marginBottom: '2rem',
                animation: 'fadeIn 0.4s ease-out'
              }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '1.5rem',
                  marginBottom: '2rem'
                }}>
                  <div className="stat-card">
                    <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                      MÉDIA
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#93c5fd' }}>
                      {stats.avg}h
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                      MELHOR
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#4ade80' }}>
                      {stats.best}h
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                      PIOR
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#f87171' }}>
                      {stats.worst}h
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                      REGISTOS
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#fbbf24' }}>
                      {stats.total}
                    </div>
                  </div>
                </div>

                {/* Chart */}
                {chartData.length > 1 && (
                  <div className="card">
                    <h3 style={{ 
                      fontSize: '1.2rem', 
                      marginBottom: '1.5rem',
                      color: '#93c5fd',
                      fontWeight: 700,
                      letterSpacing: '0.05em'
                    }}>
                      ÚLTIMOS 14 DIAS
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#9ca3af"
                          style={{ fontSize: '0.85rem', fontFamily: 'Space Mono' }}
                        />
                        <YAxis 
                          stroke="#9ca3af"
                          style={{ fontSize: '0.85rem', fontFamily: 'Space Mono' }}
                          label={{ value: 'Horas', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            background: 'rgba(15, 12, 41, 0.95)',
                            border: '1px solid rgba(147, 197, 253, 0.3)',
                            borderRadius: '8px',
                            fontFamily: 'Space Mono',
                            fontSize: '0.9rem'
                          }}
                          labelStyle={{ color: '#93c5fd', marginBottom: '0.5rem' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="hours" 
                          stroke="#60a5fa" 
                          strokeWidth={3}
                          dot={{ fill: '#93c5fd', r: 5 }}
                          activeDot={{ r: 7, fill: '#3b82f6' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Records List */}
        <div className="card animate-in" style={{
          animation: 'fadeIn 0.6s ease-out 0.3s backwards'
        }}>
          <h2 style={{ 
            fontSize: '1.5rem', 
            marginBottom: '1.5rem',
            color: '#93c5fd',
            fontWeight: 700,
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <Calendar size={24} />
            HISTÓRICO
          </h2>
          
          {sleepRecords.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem',
              color: '#6b7280'
            }}>
              <Moon size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1.1rem' }}>Ainda não tens registos de sono.</p>
              <p style={{ fontSize: '0.95rem', marginTop: '0.5rem' }}>
                Começa por adicionar a tua primeira entrada acima!
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sleepRecords.map((record, index) => (
                <div 
                  key={record.id}
                  className="record-item"
                  style={{
                    animation: `fadeIn 0.4s ease-out ${index * 0.05}s backwards`
                  }}
                >
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: '140px 120px 120px 100px 1fr auto',
                    gap: '1.5rem',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#93c5fd' }}>
                        {record.date}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][new Date(record.date.split('/').reverse().join('-')).getDay()]}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                      <Moon size={16} color="#9ca3af" />
                      {record.bed_time}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                      <Sun size={16} color="#fbbf24" />
                      {record.wake_time}
                    </div>
                    <div style={{ 
                      fontWeight: 700,
                      fontSize: '1.2rem',
                      color: record.hours >= 7 ? '#4ade80' : record.hours >= 6 ? '#fbbf24' : '#f87171'
                    }}>
                      {record.hours}h
                    </div>
                    <div>
                      <span style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background: record.hours >= 7 ? 'rgba(74, 222, 128, 0.15)' : record.hours >= 6 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                        color: record.hours >= 7 ? '#4ade80' : record.hours >= 6 ? '#fbbf24' : '#f87171',
                        border: `1px solid ${record.hours >= 7 ? 'rgba(74, 222, 128, 0.3)' : record.hours >= 6 ? 'rgba(251, 191, 36, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`
                      }}>
                        {record.hours >= 7 ? '✓ Boa' : record.hours >= 6 ? '~ Média' : '✗ Fraca'}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => deleteRecord(record.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '8px',
                          color: '#f87171',
                          padding: '0.5rem 1rem',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          fontFamily: 'Space Mono, monospace'
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
      </div>
    </div>
  );
}