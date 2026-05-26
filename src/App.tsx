import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, AreaChart, Area, Line, ComposedChart
} from 'recharts';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, RefreshCw, Search, Filter, 
  ExternalLink, BarChart3, PieChartIcon, Lightbulb, Database, Settings, Sparkles, 
  FileText, ArrowRight, LogOut, ChevronDown, ListFilter, AlertOctagon, Info, Calendar, 
  Maximize2, DollarSign, Activity, Compass, CheckCircle2, CloudLightning, UserCheck
} from 'lucide-react';
import { Campaign, KPIStats, AISummary } from './types';
import { initAuth, googleSignIn, logout } from './firebase';

export default function App() {
  // Authentication states
  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // App core states
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("https://docs.google.com/spreadsheets/d/1nG2AtTKb0NfC1iOyEAEUC7ZQ0ClrEiuVW7ZKbrv-PKs/edit?usp=sharing");
  const [tempUrl, setTempUrl] = useState("https://docs.google.com/spreadsheets/d/1nG2AtTKb0NfC1iOyEAEUC7ZQ0ClrEiuVW7ZKbrv-PKs/edit?usp=sharing");
  const [isUrlEditing, setIsUrlEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("Google Sheets");
  const [isFallback, setIsFallback] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>("");
  const [sheetTab, setSheetTab] = useState<string>(""); // Options: "" (Principal), "CYN", "Direct Analytics"

  // Tabs navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'campaigns' | 'ai-insights' | 'op-analysis'>('dashboard');

  // OP Analysis Detail Tab States
  const [searchedOppId, setSearchedOppId] = useState("");
  const [selectedAnalysisCampaign, setSelectedAnalysisCampaign] = useState<Campaign | null>(null);
  const [dailyDeliveryPoints, setDailyDeliveryPoints] = useState<any[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [dailySource, setDailySource] = useState("");
  const [dailyIsReal, setDailyIsReal] = useState(false);
  const [activeMetric, setActiveMetric] = useState<'impressions' | 'clicks' | 'ctr' | 'vtr' | 'er'>('impressions');

  // Filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgencia, setSelectedAgencia] = useState("All");
  const [selectedCliente, setSelectedCliente] = useState("All");
  const [selectedTipoCompra, setSelectedTipoCompra] = useState("All");
  const [selectedMes, setSelectedMes] = useState("All");
  const [selectedStatusFlag, setSelectedStatusFlag] = useState("All"); // All, subentrega, optimo, sobregiro

  // AI Insights state
  const [aiAnalysis, setAiAnalysis] = useState<AISummary | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Detail Modal Campaign
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Initialize auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setAuthChecking(false);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setAuthChecking(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync / Fetch spreadsheets data
  const fetchSpreadsheetData = async (urlToFetch: string, sheetName: string = "") => {
    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const urlWithSheet = `/api/data?url=${encodeURIComponent(urlToFetch)}${sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : ''}`;
      const response = await fetch(urlWithSheet);
      if (!response.ok) {
        throw new Error(`Error en el servidor: código ${response.status}`);
      }
      const data = await response.json();
      if (data.success && data.campaigns) {
        setCampaigns(data.campaigns);
        setSourceName(data.source);
        setIsFallback(data.isFallback);
        setLastSyncTime(new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        if (data.isFallback && data.warning) {
          console.warn("Utilizando datos locales recuperados:", data.warning);
        }
      } else {
        throw new Error(data.warning || "Fallo estructural en el retorno de datos");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "No se pudo conectar a la fuente de Google Sheets.");
    } finally {
      setIsSyncing(false);
      setLoading(false);
    }
  };

  // Fetch daily delivery details for specific campaign
  const loadCampaignDailyData = async (camp: Campaign) => {
    setSelectedAnalysisCampaign(camp);
    setLoadingDaily(true);
    setDailyError(null);
    setDailyDeliveryPoints([]);
    setActiveMetric('impressions');
    
    try {
      const resp = await fetch(`/api/daily-delivery?oppId=${encodeURIComponent(camp.oppId)}&url=${encodeURIComponent(spreadsheetUrl)}`);
      const data = await resp.json();
      if (data.success) {
        setDailyDeliveryPoints(data.dailyData || []);
        setDailySource(data.source || "");
        setDailyIsReal(!!data.isRealData);
        if (data.campaign) {
          setSelectedAnalysisCampaign(prev => prev ? {
            ...prev,
            ...data.campaign
          } : data.campaign);
        }
      } else {
        setDailyError(data.error || "No se pudo cargar la entrega de la OP");
      }
    } catch (err: any) {
      setDailyError("Error de comunicación cargando reportes diarios: " + err.message);
    } finally {
      setLoadingDaily(false);
    }
  };

  // Initial load and on tab change
  useEffect(() => {
    // Reset filters on sheetTab change to avoid getting stuck with mismatching filters
    setSelectedAgencia("All");
    setSelectedCliente("All");
    setSelectedTipoCompra("All");
    setSelectedMes("All");
    setSelectedStatusFlag("All");
    setSearchQuery("");
    
    fetchSpreadsheetData(spreadsheetUrl, sheetTab);
  }, [spreadsheetUrl, sheetTab]);

  // Auth handler
  const handleGoogleLogin = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        // Toast notifications logic can be styled custom
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
  };

  // Precomputed Campaign Date Stats
  const dateStats = useMemo(() => {
    if (!selectedAnalysisCampaign) return null;
    const { fechaInicio, fechaFin, objectiveValue, avanceValue } = selectedAnalysisCampaign;
    
    const parseDmy = (str: string) => {
      if (!str) return new Date();
      const parts = str.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      }
      return new Date();
    };

    const start = parseDmy(fechaInicio);
    const end = parseDmy(fechaFin);
    const today = new Date();
    // Normalize to midnight for fair integer math
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    today.setHours(0,0,0,0);

    const totalMs = end.getTime() - start.getTime();
    const totalDays = isNaN(totalMs) || totalMs < 0 ? 30 : Math.ceil(totalMs / (1000 * 60 * 60 * 24)) + 1;

    let elapsedDays = 0;
    if (today >= start) {
      const elapsedMs = today.getTime() - start.getTime();
      elapsedDays = Math.min(totalDays, Math.ceil(elapsedMs / (1000 * 60 * 60 * 24)) + 1);
    }
    
    const remainingDays = Math.max(0, totalDays - elapsedDays);
    const averageTargetDaily = totalDays > 0 ? Math.round(objectiveValue / totalDays) : 0;
    
    let requiredDailyRunrate = 0;
    if (remainingDays > 0) {
      requiredDailyRunrate = Math.max(0, Math.round((objectiveValue - avanceValue) / remainingDays));
    } else {
      requiredDailyRunrate = 0;
    }

    const percentageTimeElapsed = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0;

    return {
      totalDays,
      elapsedDays,
      remainingDays,
      averageTargetDaily,
      requiredDailyRunrate,
      percentageTimeElapsed
    };
  }, [selectedAnalysisCampaign]);

  // Trigger Gemini Analysis
  const runCampaignAIAnalysis = async () => {
    if (campaigns.length === 0) return;
    setLoadingAI(true);
    setAiError(null);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ campaigns })
      });
      const data = await response.json();
      if (data.success && data.analysis) {
        setAiAnalysis({
          generalReport: data.analysis.generalReport,
          anomalies: data.analysis.anomalies || [],
          recommendations: data.analysis.recommendations || [],
          generatedAt: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
        });
      } else {
        setAiError(data.error || "No se pudo generar el reporte. Verifique la API Key de Gemini.");
      }
    } catch (err: any) {
      setAiError("Error de red llamando a la API de análisis de Gemini.");
    } finally {
      setLoadingAI(false);
    }
  };

  // Dynamic filter lists derived from data
  const filterOptions = useMemo(() => {
    const agencias = new Set<string>();
    const clientes = new Set<string>();
    const tiposCompra = new Set<string>();
    const meses = new Set<string>();

    campaigns.forEach(c => {
      if (c.agencia) agencias.add(c.agencia);
      if (c.cliente) clientes.add(c.cliente);
      if (c.tipoCompra) tiposCompra.add(c.tipoCompra);
      if (c.mes) meses.add(c.mes);
    });

    return {
      agencias: ["All", ...Array.from(agencias)],
      clientes: ["All", ...Array.from(clientes)],
      tiposCompra: ["All", ...Array.from(tiposCompra)],
      meses: ["All", ...Array.from(meses)]
    };
  }, [campaigns]);

  // Handle Sheet Connection change
  const handleSheetConnect = () => {
    if (tempUrl.trim().startsWith("http")) {
      setSpreadsheetUrl(tempUrl);
      if (tempUrl === spreadsheetUrl) {
        fetchSpreadsheetData(tempUrl, sheetTab);
      }
      setIsUrlEditing(false);
    } else {
      alert("Por favor ingrese una URL válida de Google Sheets");
    }
  };

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      const matchesSearch = 
        c.oppName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.oppId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.cliente.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesAgencia = selectedAgencia === "All" || c.agencia === selectedAgencia;
      const matchesCliente = selectedCliente === "All" || c.cliente === selectedCliente;
      const matchesTipoCompra = selectedTipoCompra === "All" || c.tipoCompra === selectedTipoCompra;
      const matchesMes = selectedMes === "All" || c.mes.toLowerCase() === selectedMes.toLowerCase();

      // Pacing criteria
      let matchesStatus = true;
      if (selectedStatusFlag !== "All") {
        if (selectedStatusFlag === "subentrega") {
          matchesStatus = c.pacingValue < 85;
        } else if (selectedStatusFlag === "optimo") {
          matchesStatus = c.pacingValue >= 85 && c.pacingValue <= 115;
        } else if (selectedStatusFlag === "sobregiro") {
          matchesStatus = c.pacingValue > 115;
        }
      }

      return matchesSearch && matchesAgencia && matchesCliente && matchesTipoCompra && matchesMes && matchesStatus;
    });
  }, [campaigns, searchQuery, selectedAgencia, selectedCliente, selectedTipoCompra, selectedMes, selectedStatusFlag]);

  // Compute live statistics for filtered set
  const stats = useMemo<KPIStats>(() => {
    let usdInversionSum = 0;
    let penInversionSum = 0;
    let pacingSum = 0;
    let optimal = 0;
    let under = 0;
    let over = 0;

    filteredCampaigns.forEach(c => {
      if (c.currency === 'USD') {
        usdInversionSum += c.inversionValue;
      } else {
        penInversionSum += c.inversionValue;
      }

      pacingSum += c.pacingValue;

      if (c.pacingValue < 85) {
        under++;
      } else if (c.pacingValue > 115) {
        over++;
      } else {
        optimal++;
      }
    });

    const count = filteredCampaigns.length;
    const averagePacing = count > 0 ? (pacingSum / count) : 0;

    return {
      totalInversionUSD: usdInversionSum,
      totalInversionPEN: penInversionSum,
      campaignCount: count,
      activeCampaigns: count,
      averagePacing,
      optimalCount: optimal,
      underperformingCount: under,
      overperformingCount: over
    };
  }, [filteredCampaigns]);

  // Currency Exchange Rate for unified sum representation
  const UNIFIED_TC = 3.75;
  const unifiedTotalUSD = useMemo(() => {
    return stats.totalInversionUSD + (stats.totalInversionPEN / UNIFIED_TC);
  }, [stats]);

  // Prepare charts data
  const agencyChartData = useMemo(() => {
    const map: Record<string, { name: string; InversionUSD: number; count: number }> = {};
    filteredCampaigns.forEach(c => {
      const key = c.agencia || "Otro";
      const valueInUSD = c.currency === 'USD' ? c.inversionValue : (c.inversionValue / UNIFIED_TC);
      if (!map[key]) {
        map[key] = { name: key, InversionUSD: 0, count: 0 };
      }
      map[key].InversionUSD += valueInUSD;
      map[key].count += 1;
    });
    return Object.values(map);
  }, [filteredCampaigns]);

  const clientChartData = useMemo(() => {
    const map: Record<string, { name: string; InversionEquiv: number; count: number }> = {};
    filteredCampaigns.forEach(c => {
      const key = c.cliente || "Otro";
      const valueUSD = c.currency === 'USD' ? c.inversionValue : (c.inversionValue / UNIFIED_TC);
      if (!map[key]) {
        map[key] = { name: key, InversionEquiv: 0, count: 0 };
      }
      map[key].InversionEquiv += valueUSD;
      map[key].count += 1;
    });
    // Sort and take top 5
    return Object.values(map)
      .sort((a, b) => b.InversionEquiv - a.InversionEquiv)
      .slice(0, 6);
  }, [filteredCampaigns]);

  const pacingRangeData = useMemo(() => {
    const ranges = [
      { name: 'Crítico <50%', count: 0, fill: '#ef4444' },
      { name: 'Bajo 50-85%', count: 0, fill: '#f59e0b' },
      { name: 'Óptimo 85-115%', count: 0, fill: '#10b981' },
      { name: 'Alto >115%', count: 0, fill: '#3b82f6' }
    ];

    filteredCampaigns.forEach(c => {
      if (c.pacingValue < 50) {
        ranges[0].count++;
      } else if (c.pacingValue < 85) {
        ranges[1].count++;
      } else if (c.pacingValue <= 115) {
        ranges[2].count++;
      } else {
        ranges[3].count++;
      }
    });

    return ranges;
  }, [filteredCampaigns]);

  // Color selection helper for single pacing
  const getPacingColorClass = (val: number) => {
    if (val < 50) return { bg: 'bg-red-500', bgLight: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
    if (val < 85) return { bg: 'bg-amber-500', bgLight: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    if (val <= 115) return { bg: 'bg-emerald-500', bgLight: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    return { bg: 'bg-blue-600', bgLight: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
  };

  return (
    <div className="min-h-screen transparent text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-white">
      <div className="liquid-glass-bg" />
      {/* Dynamic Alert Banner for Offline Fallback State */}
      {isFallback && (
        <div className="bg-amber-600 text-white text-sm py-2 px-4 text-center font-medium flex items-center justify-center gap-2 border-b border-amber-500/20">
          <AlertOctagon className="w-4 h-4 flex-shrink-0 animate-bounce" />
          <span>Mostrando datos locales de respaldo. Sincronización remota fallida debido a permisos o URL.</span>
        </div>
      )}

      {/* Main Header bar */}
      <header className="sticky top-0 liquid-glass-header z-30 shadow-lg shadow-[#02040a]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-650 rounded-xl text-white shadow-lg shadow-indigo-900/30">
              <TrendingUp className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">EX-Media Pacing Tracker</h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-950/50 text-indigo-400 border border-indigo-900/30">
                  <Activity className="w-3 h-3 text-indigo-400" /> Live Control
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Seguimiento de presupuesto y ritmo para Planificación de Campañas
              </p>
            </div>
          </div>

          {/* Connected Spreadsheet Input bar */}
          <div className="flex-1 max-w-xl md:mx-6 flex items-center gap-2 bg-[#090f1d] p-1.5 rounded-xl border border-slate-800/80">
            <span className="text-xs text-indigo-400 pl-2 font-mono whitespace-nowrap bg-indigo-950/50 border border-indigo-900/20 px-2 py-1 rounded-md max-w-[130px] overflow-hidden text-ellipsis">
              Planilla activa
            </span>
            {isUrlEditing ? (
              <div className="flex-1 flex gap-1.5">
                <input
                  type="text"
                  className="flex-grow bg-[#0c1325] border border-slate-750 rounded-lg text-xs py-1 px-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-500"
                  value={tempUrl}
                  onChange={(e) => setTempUrl(e.target.value)}
                  placeholder="Pegue URL de Google Sheets pública..."
                />
                <button
                  onClick={handleSheetConnect}
                  disabled={isSyncing}
                  className="px-3 py-1 bg-indigo-650 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold transition"
                >
                  Conectar
                </button>
                <button
                  onClick={() => {
                    setTempUrl(spreadsheetUrl);
                    setIsUrlEditing(false);
                  }}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                >
                  X
                </button>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-between min-w-0 pr-1">
                <span className="text-xs text-slate-300 font-medium truncate py-1 pr-4 pl-1" title={spreadsheetUrl}>
                  {spreadsheetUrl}
                </span>
                <button
                  onClick={() => setIsUrlEditing(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline font-semibold flex-shrink-0"
                >
                  Cambiar
                </button>
              </div>
            )}
          </div>

          {/* User Sign In and Sync buttons */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            {user ? (
              <div className="flex items-center gap-2 bg-[#0e1628] border border-slate-800 p-1 pr-3 rounded-full">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className="w-7 h-7 rounded-full border border-slate-700" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-950/80 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-900/40">
                    {user.displayName?.[0] || 'U'}
                  </div>
                )}
                <div className="hidden lg:block text-left">
                  <p className="text-[10px] text-slate-500 font-medium leading-none">Autenticado</p>
                  <p className="text-xs font-semibold text-slate-200 max-w-[120px] truncate leading-tight">{user.displayName}</p>
                </div>
                <button
                  onClick={handleLogout}
                  title="Cerrar sesión"
                  className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-200 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleLogin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-800 hover:border-slate-700 bg-[#0e1628] hover:bg-[#14203a] rounded-xl text-xs font-semibold text-slate-200 shadow-sm transition"
              >
                <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Google Sign In</span>
              </button>
            )}

            <button
              onClick={() => fetchSpreadsheetData(spreadsheetUrl, sheetTab)}
              disabled={isSyncing}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white shadow-md transition ${
                isSyncing ? 'bg-indigo-700/60 cursor-not-allowed text-slate-300' : 'bg-indigo-650 hover:bg-indigo-600'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Recargar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        
        {/* Navigation Tabs Bar */}
        <section className="flex items-center justify-between border-b border-slate-850 pb-1">
          <div className="flex gap-1 bg-[#090d16] border border-slate-800/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'dashboard' 
                  ? 'bg-indigo-655 text-white shadow-md bg-indigo-650' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              <span>Cuadro de Mando</span>
            </button>
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'campaigns' 
                  ? 'bg-indigo-655 text-white shadow-md bg-indigo-650' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
              }`}
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Campañas Activas</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/50 font-mono">
                {filteredCampaigns.length}
              </span>
            </button>
            <button
              onClick={() => {
                setActiveTab('ai-insights');
              }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all relative ${
                activeTab === 'ai-insights' 
                  ? 'bg-indigo-670 text-white shadow-md bg-indigo-650' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
              }`}
            >
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span>Analista IA</span>
              {aiAnalysis ? (
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              ) : null}
            </button>
            <button
              onClick={() => {
                setActiveTab('op-analysis');
                if (!selectedAnalysisCampaign && campaigns.length > 0) {
                  loadCampaignDailyData(campaigns[0]);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all relative ${
                activeTab === 'op-analysis' 
                  ? 'bg-indigo-670 text-white shadow-md bg-indigo-650' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
              }`}
            >
              <Activity className="w-4 h-4 text-rose-400" />
              <span>Análisis de OP (Detalle)</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 font-medium">
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span>Última sincronización: </span>
            <span className="font-semibold font-mono text-indigo-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
              {lastSyncTime || "Iniciando..."}
            </span>
          </div>
        </section>

        {/* Google Sheets Tab Selector */}
        <section className="liquid-glass-panel rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-950/50 border border-indigo-900/30 text-indigo-400 rounded-xl">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Hoja del Archivo de Google Sheets</p>
              <h3 className="text-sm font-bold text-slate-200">Seleccionar pestaña origen de datos</h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "", label: "Pacing General" },
              { id: "CAMU", label: "Pestaña CAMU" },
              { id: "CYN", label: "Pestaña CYN" },
              { id: "Direct Analytics", label: "Pestaña Direct Analytics" }
            ].map((tab) => {
              const isActive = sheetTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSheetTab(tab.id)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-indigo-[#121929] border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-900/30"
                      : "bg-[#121929] border-slate-800 text-slate-400 hover:bg-[#1b263f] hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}

            {/* Custom tab name selector */}
            <div className="flex items-center gap-1.5 border border-slate-800 rounded-xl px-2.5 h-[34px] bg-[#121929]">
              <span className="text-[11px] text-slate-500 font-semibold uppercase">Otra:</span>
              <input
                type="text"
                placeholder="Escribir nombre..."
                value={sheetTab !== "" && sheetTab !== "CYN" && sheetTab !== "Direct Analytics" ? sheetTab : ""}
                onChange={(e) => setSheetTab(e.target.value)}
                className="bg-transparent border-none outline-hidden text-xs font-semibold text-slate-200 w-28 placeholder:text-slate-500 focus:ring-0 p-0"
              />
            </div>
          </div>
        </section>

        {/* Global Error Banner if any */}
        {errorMsg && (
          <div className="p-4 bg-red-955/60 border border-red-900/40 rounded-2xl flex items-start gap-3 bg-red-950/40 text-slate-200">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-red-400">No se pudieron cargar los datos de Sheets</h4>
              <p className="text-xs text-red-350 mt-0.5">{errorMsg}</p>
              <p className="text-xs text-slate-400 mt-2">
                Haga clic en &ldquo;Recargar&rdquo; para intentarlo de nuevo o proceda con el visor local fuera de línea suministrado automáticamente.
              </p>
            </div>
          </div>
        )}

        {/* LOADING SHIMMER SKELETON */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse py-6">
            <div className="h-28 bg-[#101726]/80 rounded-2xl border border-slate-800/50"></div>
            <div className="h-28 bg-[#101726]/80 rounded-2xl border border-slate-800/50"></div>
            <div className="h-28 bg-[#101726]/80 rounded-2xl border border-slate-800/50"></div>
            <div className="h-28 bg-[#101726]/80 rounded-2xl border border-slate-800/50"></div>
            <div className="h-96 md:col-span-3 bg-[#101726]/80 rounded-2xl border border-slate-800/50"></div>
            <div className="h-96 bg-[#101726]/80 rounded-2xl border border-slate-800/50"></div>
          </div>
        ) : (
          <>
            {/* INFORMATIVE BANNER ABOUT OP PACING ENGINE */}
            <div className="bg-gradient-to-r from-rose-950/20 to-indigo-950/30 rounded-2xl border border-slate-805 border-slate-800 p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in text-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-650 text-white rounded-xl shadow-lg shadow-rose-950/50">
                  <Activity className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Buscador Detallado de Amortización Diaria (Direct Analytics)</h4>
                  <p className="text-xs text-slate-400 font-medium">
                    Consulte el ritmo de inyección de spend, curvas de trayectoria teórica y KPIs de cualquier OP o campaña en la nueva pestaña.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveTab('op-analysis');
                  if (campaigns.length > 0) {
                    loadCampaignDailyData(campaigns[0]);
                  }
                }}
                className="px-4 py-2 bg-rose-650 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-950/40 transition duration-155 flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer hover:scale-[1.02]"
              >
                <span>Ir al Buscador de OP</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* SEARCH AND QUICK FILTERS MODULE (PERSISTENT OR DRAWER) */}
            <section className="liquid-glass-panel p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col gap-4">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                  <Filter className="w-4 h-4 text-indigo-400" />
                  <span>Filtros Rápidos e Integración de Medios</span>
                </div>
                
                {/* Reset filters */}
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedAgencia("All");
                    setSelectedCliente("All");
                    setSelectedTipoCompra("All");
                    setSelectedMes("All");
                    setSelectedStatusFlag("All");
                  }}
                  className="text-xs text-slate-500 hover:text-blue-600 font-medium hover:underline self-end"
                >
                  Limpiar Filtros
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Search query */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar OP ID / Cliente..."
                    className="w-full bg-[#121929] border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs focus:bg-[#182239] focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-500 transition-all font-medium"
                  />
                </div>

                {/* Filter Agency */}
                <div className="relative">
                  <select
                    value={selectedAgencia}
                    onChange={(e) => setSelectedAgencia(e.target.value)}
                    className="w-full bg-[#121929] border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs focus:bg-[#182239] focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium appearance-none"
                  >
                    <option value="All" className="bg-[#121929] text-slate-300">Agencia: Todas</option>
                    {filterOptions.agencias.filter(a => a !== "All").map(ag => (
                      <option key={ag} value={ag} className="bg-[#121929] text-slate-300">{ag}</option>
                    ))}
                  </select>
                </div>

                {/* Filter Cliente */}
                <div className="relative">
                  <select
                    value={selectedCliente}
                    onChange={(e) => setSelectedCliente(e.target.value)}
                    className="w-full bg-[#121929] border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs focus:bg-[#182239] focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium appearance-none"
                  >
                    <option value="All" className="bg-[#121929] text-slate-300">Cliente: Todos</option>
                    {filterOptions.clientes.filter(c => c !== "All").map(cl => (
                      <option key={cl} value={cl} className="bg-[#121929] text-slate-300">{cl}</option>
                    ))}
                  </select>
                </div>

                {/* Filter Tipo Compra */}
                <div className="relative">
                  <select
                    value={selectedTipoCompra}
                    onChange={(e) => setSelectedTipoCompra(e.target.value)}
                    className="w-full bg-[#121929] border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs focus:bg-[#182239] focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium appearance-none"
                  >
                    <option value="All" className="bg-[#121929] text-slate-300">Formato de Compra</option>
                    {filterOptions.tiposCompra.filter(t => t !== "All").map(tc => (
                      <option key={tc} value={tc} className="bg-[#121929] text-slate-300">{tc}</option>
                    ))}
                  </select>
                </div>

                {/* Filter Mes */}
                <div className="relative">
                  <select
                    value={selectedMes}
                    onChange={(e) => setSelectedMes(e.target.value)}
                    className="w-full bg-[#121929] border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs focus:bg-[#182239] focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium appearance-none"
                  >
                    <option value="All" className="bg-[#121929] text-slate-300">Mes: Todos</option>
                    {filterOptions.meses.filter(m => m !== "All").map(ms => (
                      <option key={ms} value={ms} className="bg-[#121929] text-slate-300">{ms}</option>
                    ))}
                  </select>
                </div>

                {/* Filter Pacing Category */}
                <div className="relative">
                  <select
                    value={selectedStatusFlag}
                    onChange={(e) => setSelectedStatusFlag(e.target.value)}
                    className="w-full bg-[#121929] border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs focus:bg-[#182239] focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium appearance-none"
                  >
                    <option value="All" className="bg-[#121929] text-slate-300">Ritmo (Pacing): Todos</option>
                    <option value="subentrega" className="bg-[#121929] text-emerald-400">🟢 Subentrega (atraso &lt; 85%)</option>
                    <option value="optimo" className="bg-[#121929] text-indigo-400">🔵 Óptimo (85% a 115%)</option>
                    <option value="sobregiro" className="bg-[#121929] text-violet-400">🟣 Sobregiro (riesgo &gt; 115%)</option>
                  </select>
                </div>
              </div>
            </section>

            {/* TAB CONTENT: DASHBOARD VISUALIZATIONS */}
            {activeTab === 'dashboard' && (
              <div className="flex flex-col gap-6">
                
                {/* 4 BENTO CARDS INFRASTRUCTURE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Inversión Card */}
                  <div className="liquid-glass-panel p-5 rounded-2xl border border-slate-800 shadow-lg hover:border-slate-700 transition-all flex flex-col justify-between gap-2 group relative overflow-hidden">
                    <div className="absolute right-0 top-0 mt-[-10px] mr-[-10px] w-20 h-20 bg-indigo-500/5 rounded-full group-hover:scale-125 transition-all duration-300 pointer-events-none"></div>
                    <div className="z-10 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Inversión Planificada</span>
                      <div className="p-2 bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 rounded-lg">
                        <DollarSign className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="z-10 mt-2">
                      <p className="text-2xl font-bold text-white tracking-tight">
                        ${stats.totalInversionUSD.toLocaleString('es-PE')} <span className="text-sm text-slate-500 font-normal">USD</span>
                      </p>
                      <p className="text-xl font-semibold text-slate-300 tracking-tight mt-1">
                        S/. {stats.totalInversionPEN.toLocaleString('es-PE')} <span className="text-sm text-slate-500 font-normal">PEN</span>
                      </p>
                    </div>
                    <div className="z-10 mt-3 border-t border-slate-800/80 pt-2 flex items-center justify-between text-xs text-slate-400">
                      <span>Equiv. Total USD</span>
                      <span className="font-semibold font-mono text-indigo-400">${unifiedTotalUSD.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>

                  {/* Average Pacing Ring */}
                  <div className="liquid-glass-panel p-5 rounded-2xl border border-slate-800 shadow-lg hover:border-slate-700 transition-all flex flex-col justify-between gap-2 group relative overflow-hidden">
                    <div className="absolute right-0 top-0 mt-[-10px] mr-[-10px] w-20 h-20 bg-emerald-500/5 rounded-full group-hover:scale-125 transition-all duration-300 pointer-events-none"></div>
                    <div className="z-10 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Pacing Promedio (Ritmo)</span>
                      <div className="p-2 bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 rounded-lg">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="z-10 mt-2">
                      <div className="flex items-baseline gap-2">
                        <p className="text-4xl font-bold text-white tracking-tight">{stats.averagePacing.toFixed(2)}%</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          stats.averagePacing >= 90 && stats.averagePacing <= 110 
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/50' 
                            : 'bg-amber-950/60 text-amber-400 border border-amber-900/50'
                        }`}>
                          {stats.averagePacing >= 90 && stats.averagePacing <= 110 ? 'ESTABLE' : 'DESVIACIÓN'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Promedio simple de campañas mostradas</p>
                    </div>
                    <div className="z-10 mt-3 border-t border-slate-800/80 pt-2 flex items-center justify-between text-xs text-slate-400">
                      <span>Meta de Referencia</span>
                      <span className="font-semibold text-slate-300">100.00%</span>
                    </div>
                  </div>

                  {/* Volume delivery completion bar */}
                  <div className="liquid-glass-panel p-5 rounded-2xl border border-slate-800 shadow-lg hover:border-slate-700 transition-all flex flex-col justify-between gap-2 group relative overflow-hidden">
                    <div className="absolute right-0 top-0 mt-[-10px] mr-[-10px] w-20 h-20 bg-amber-500/5 rounded-full group-hover:scale-125 transition-all duration-300 pointer-events-none"></div>
                    <div className="z-10 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Volumen Impresiones / Clics</span>
                      <div className="p-2 bg-amber-955/40 text-amber-400 border border-amber-900/30 rounded-lg">
                        <Activity className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="z-10 mt-1">
                      <div className="flex justify-between items-baseline">
                        <p className="text-xl font-bold text-white">
                          {pacingRangeData.reduce((acc, r) => acc + (r.name.includes("Óptimo") ? r.count : 0), 0)}
                        </p>
                        <span className="text-xs text-slate-400 font-medium font-mono">de {stats.campaignCount} OPPs</span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">Campañas con ritmo operativo estable</p>
                      
                      {/* Interactive miniature segment bar */}
                      <div className="h-2.5 bg-slate-950 rounded-full overflow-hidden flex mt-3.5 border border-slate-805 border-slate-800">
                        <div style={{ width: `${(stats.optimalCount / (stats.campaignCount || 1)) * 100}%` }} className="bg-emerald-500" title="Óptimo"></div>
                        <div style={{ width: `${(stats.underperformingCount / (stats.campaignCount || 1)) * 100}%` }} className="bg-amber-400" title="Suentrenga"></div>
                        <div style={{ width: `${(stats.overperformingCount / (stats.campaignCount || 1)) * 100}%` }} className="bg-indigo-600" title="Sobregiro"></div>
                      </div>
                    </div>
                    <div className="z-10 mt-2 border-t border-slate-800/80 pt-1.5 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                      <span className="text-emerald-400">Estable: {stats.optimalCount}</span>
                      <span className="text-amber-400">Bajo: {stats.underperformingCount}</span>
                      <span className="text-indigo-400">Alto: {stats.overperformingCount}</span>
                    </div>
                  </div>

                  {/* AI diagnostic helper card */}
                  <div className="liquid-glass-panel p-5 rounded-2xl border border-slate-800 shadow-lg hover:border-slate-700 transition-all flex flex-col justify-between gap-2 group relative overflow-hidden">
                    <div className="absolute right-0 top-0 mt-[-10px] mr-[-10px] w-20 h-20 bg-indigo-505/5 bg-opacity-10 w-20 h-20 bg-indigo-500/5 rounded-full group-hover:scale-125 transition-all duration-300 pointer-events-none"></div>
                    <div className="z-10 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Diagnóstico Analítico</span>
                      <div className="p-2 bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 rounded-lg">
                        <Lightbulb className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="z-10 mt-2">
                      <p className="text-sm font-semibold text-slate-300">
                        {stats.underperformingCount > 0 
                          ? `${stats.underperformingCount} campañas requieren atención inmediata` 
                          : 'Todo marcha en el ritmo correcto'}
                      </p>
                      <button
                        onClick={() => {
                          setActiveTab('ai-insights');
                          if (!aiAnalysis) runCampaignAIAnalysis();
                        }}
                        className="mt-3.5 inline-flex items-center gap-1.5 bg-indigo-950/45 hover:bg-indigo-900/60 text-indigo-400 text-xs font-bold px-3.5 py-1.5 rounded-xl border border-indigo-900/35 transition cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                        <span>Generar con Gemini</span>
                      </button>
                    </div>
                    <div className="z-10 mt-2 border-t border-slate-800/80 pt-1.5 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                      <span>Anomalías Críticas</span>
                      <span className="font-bold text-red-500 font-mono">
                        {campaigns.filter(c => c.pacingValue < 50 || c.pacingValue > 150).length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* GRAPHICAL PLOTS LAYOUT: CHARTS DEEP VIEW */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Chart 1: Customer Budget Allocation (Pie/Doughnut) */}
                  <div className="liquid-glass-panel p-5 rounded-2xl border border-slate-800 shadow-lg lg:col-span-1">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4 font-semibold text-slate-200">
                      <div className="flex items-center gap-2">
                        <PieChartIcon className="w-4 h-4 text-indigo-400" />
                        <h3 className="text-sm font-bold text-slate-200">Distribución de Inversión por Cliente</h3>
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Top 6</span>
                    </div>

                    <div className="h-64 relative">
                      {clientChartData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-slate-500 font-medium">
                          No hay datos de distribución
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={clientChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={85}
                              paddingAngle={2}
                              dataKey="InversionEquiv"
                            >
                              {clientChartData.map((entry, index) => {
                                const colors = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
                                return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                              })}
                            </Pie>
                            <Tooltip 
                              formatter={(value: any) => [`$${Math.round(value).toLocaleString('es-PE')} USD`, 'Inversión']}
                              contentStyle={{ borderRadius: '12px', background: '#090e17', borderColor: '#1e293b', fontSize: '11px', color: '#fff' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                      
                      {/* Centered label widget inside donut */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none mt-2">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Total Equiv</p>
                        <p className="text-lg font-extrabold text-white leading-none">
                          ${Math.round(unifiedTotalUSD / 1000)}k
                        </p>
                        <p className="text-[9px] font-semibold text-slate-500 mt-1">USD</p>
                      </div>
                    </div>

                    {/* Legend Labels explicitly coded for flawless alignment */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-800">
                      {clientChartData.map((entry, idx) => {
                        const colors = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
                        return (
                          <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors[idx % colors.length] }}></span>
                            <span className="text-slate-300 truncate font-medium flex-1">{entry.name}</span>
                            <span className="text-slate-500 font-mono text-[10px]">({entry.count})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Chart 2: Pacing Categories dispersion (Bar chart) */}
                  <div className="liquid-glass-panel p-5 rounded-2xl border border-slate-800 shadow-lg lg:col-span-2">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-sm font-bold text-slate-200">Segmentación de Campañas por Rango de Pacing</h3>
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Frecuencia</span>
                    </div>

                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={pacingRangeData} barSize={40} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                          <Tooltip 
                            cursor={{ fill: '#141c2f' }}
                            formatter={(value: any) => [`${value} Campañas`, 'Conteo']}
                            contentStyle={{ borderRadius: '12px', background: '#090e17', borderColor: '#1e293b', fontSize: '11px', color: '#fff' }}
                          />
                          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                            {pacingRangeData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="p-3 liquid-glass-inner border border-slate-800 rounded-xl mt-4 flex items-start gap-2.5 text-xs text-slate-300">
                      <Info className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <p className="leading-normal">
                        El <b>Óptimo de entrega (85-115%)</b> garantiza la correcta amortización diaria. Valores inferiores sugieren detener o reasignar presupuesto, mientras que valores superiores en campañas de CPM representan sobregiros rápidos no planificados.
                      </p>
                    </div>
                  </div>
                </div>

                {/* HISTORICAL OR SECONDARY CHARTS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Agency Comparison Card */}
                  <div className="liquid-glass-panel p-5 rounded-2xl border border-slate-800 shadow-lg">
                    <h3 className="text-sm font-bold text-slate-200 mb-4 pb-2 border-b border-slate-800 flex items-center justify-between">
                      <span>Equilibrio Presupuestario por Agencia</span>
                      <span className="text-xs text-slate-500 font-mono">Convertido a USD Equiv</span>
                    </h3>
                    
                    <div className="space-y-4 font-semibold text-slate-100">
                      {agencyChartData.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-8">Sin agencias disponibles</p>
                      ) : (
                        agencyChartData.map(agencyObj => {
                          const percentage = (agencyObj.InversionUSD / (unifiedTotalUSD || 1)) * 100;
                          return (
                            <div key={agencyObj.name} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-300">{agencyObj.name}</span>
                                <span className="font-mono text-slate-400">
                                  ${Math.round(agencyObj.InversionUSD).toLocaleString('es-PE')} USD ({percentage.toFixed(0)}%)
                                </span>
                              </div>
                              <div className="h-2 bg-slate-900 border border-slate-800/60 rounded-full overflow-hidden">
                                <div 
                                  style={{ width: `${percentage}%` }} 
                                  className={`h-full ${agencyObj.name.toLowerCase().includes('havas') ? 'bg-indigo-600 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-pink-600 shadow-[0_0_8px_rgba(236,72,153,0.5)]'}`}
                                ></div>
                              </div>
                              <p className="text-[10px] text-slate-400">Total de {agencyObj.count} campañas registradas</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="liquid-glass-panel p-5 rounded-2xl border border-slate-800 shadow-lg">
                    <h3 className="text-sm font-bold text-slate-200 mb-4 pb-2 border-b border-slate-800 flex items-center justify-between">
                      <span>Campañas Críticas Recientes</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-950/45 text-red-400 font-bold border border-red-900/30">AI Alerts</span>
                    </h3>

                    <div className="space-y-2.5 max-h-[190px] overflow-flow scrollbar-thin">
                      {campaigns.filter(c => {
                        const cCtr = (c.clicksValue && c.avanceValue) ? ((c.clicksValue / c.avanceValue) * 100) : (c.ctrValue || 0);
                        const cVtr = c.vtrValue || 0;
                        return c.pacingValue < 85 || (cCtr > 0 && cCtr < 0.10) || (cVtr > 0 && cVtr < 70);
                      }).map(camp => {
                        const cCtr = (camp.clicksValue && camp.avanceValue) ? ((camp.clicksValue / camp.avanceValue) * 100) : (camp.ctrValue || 0);
                        const cVtr = camp.vtrValue || 0;
                        let reason = camp.pacingValue < 85 ? `Pacing bajo (${camp.pacingValue.toFixed(1)}%)` : (cCtr > 0 && cCtr < 0.10 ? `CTR crítico (${cCtr.toFixed(2)}%)` : `VTR crítico (${cVtr.toFixed(2)}%)`);
                        const colors = getPacingColorClass(camp.pacingValue);
                        return (
                          <div 
                            key={camp.oppId} 
                            onClick={() => setSelectedCampaign(camp)}
                            className="p-2.5 liquid-glass-inner border border-slate-850 border-slate-800/80 rounded-xl hover:border-slate-700 hover:bg-[#12192b]/70 cursor-pointer flex items-center justify-between gap-4 transition-all"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-100 truncate">{camp.oppName}</p>
                              <div className="flex gap-2 items-center text-[10px] text-slate-500 mt-1 font-mono">
                                <span>{camp.oppId}</span>
                                <span>•</span>
                                <span>{camp.cliente}</span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${colors.bgLight} ${colors.text} border ${colors.border}`}>
                                {reason}
                              </span>
                              <p className="text-[9px] text-slate-500 font-mono mt-0.5">{camp.mes}</p>
                            </div>
                          </div>
                        );
                      })}
                      {campaigns.filter(c => {
                        const cCtr = (c.clicksValue && c.avanceValue) ? ((c.clicksValue / c.avanceValue) * 100) : (c.ctrValue || 0);
                        const cVtr = c.vtrValue || 0;
                        return c.pacingValue < 85 || (cCtr > 0 && cCtr < 0.10) || (cVtr > 0 && cVtr < 70);
                      }).length === 0 && (
                        <div className="text-center py-12 text-slate-500 text-xs font-medium">
                          No se encontraron alarmas de desviaciones extremas. ¡Rendimiento en orden!
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* TAB CONTENT: ACTIVE CAMPAIGNS TABLE */}
            {activeTab === 'campaigns' && (
              <section className="liquid-glass-panel rounded-2xl border border-slate-800 shadow-lg overflow-hidden flex flex-col animate-fadeIn">
                <div className="px-5 py-4 border-b border-slate-800 liquid-glass-inner flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">Historial Detallado de Sincronización</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Visor de datos completo estructurado por fila de planilla</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Visualizando:</span>
                    <span className="text-xs font-bold text-indigo-400 bg-indigo-950/40 border border-indigo-900/35 px-2.5 py-1 rounded-xl font-mono">
                      {filteredCampaigns.length} de {campaigns.length} registros
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="bg-[#090d18] border-b border-slate-800 text-slate-400 font-semibold text-xs tracking-wide">
                        <th className="py-2.5 px-4">OPP ID</th>
                        <th className="py-2.5 px-4 min-w-[280px]">Nombre Campaña / Detalle</th>
                        <th className="py-2.5 px-4">Agencia / Cliente</th>
                        <th className="py-2.5 px-4 text-center">Mes</th>
                        <th className="py-2.5 px-4 text-right">Inversión</th>
                        <th className="py-2.5 px-4 text-right">CPM / Unitario</th>
                        <th className="py-2.5 px-4 text-right">Objetivo</th>
                        <th className="py-2.5 px-4 text-right">Avance</th>
                        <th className="py-2.5 px-4 text-right pr-6">Pacing (Ritmo)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {filteredCampaigns.map((camp) => {
                        const pacingVal = camp.pacingValue;
                        const colors = getPacingColorClass(pacingVal);
                        
                        return (
                          <tr 
                            key={camp.oppId + camp.mes}
                            onClick={() => setSelectedCampaign(camp)}
                            className="hover:bg-[#12192c]/50 cursor-pointer transition-all duration-150 group"
                          >
                            <td className="py-3.5 px-4 font-mono font-bold text-indigo-400 group-hover:underline">
                              {camp.oppId}
                            </td>
                            <td className="py-3.5 px-4">
                              <p className="font-bold text-slate-100 line-clamp-2 max-w-[340px]" title={camp.oppName}>
                                {camp.oppName}
                              </p>
                              <div className="flex gap-2.5 items-center mt-1 text-[10px] text-slate-400 font-medium font-mono">
                                <span className="bg-[#141b2e] text-slate-300 px-1.5 py-0.5 rounded border border-slate-800 leading-none">{camp.formato}</span>
                                <span>OC: {camp.oc || "N/A"}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <p className="font-semibold text-slate-200">{camp.agencia}</p>
                              <p className="text-[10px] text-slate-500 font-medium mt-0.5">{camp.cliente}</p>
                            </td>
                            <td className="py-3.5 px-4 text-center text-slate-300 capitalize font-medium">
                              {camp.mes}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-200">
                              {camp.inversionRaw}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                              {camp.cpmRaw}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                              {camp.objectiveValue ? camp.objectiveValue.toLocaleString('es-PE') : "0"}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                              {camp.avanceValue ? camp.avanceValue.toLocaleString('es-PE') : "0"}
                            </td>
                            <td className="py-3.5 px-4 text-right pr-6">
                              <div className="flex flex-col items-end gap-1.5 min-w-[90px]">
                                <span className={`inline-flex px-2 py-0.5 rounded-full font-bold font-mono text-[10px] ${colors.bgLight} ${colors.text} border ${colors.border}`}>
                                  {pacingVal.toFixed(2)}%
                                </span>
                                
                                <div className="w-20 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                  <div 
                                    className={`h-full ${colors.bg}`}
                                    style={{ width: `${Math.min(pacingVal, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {filteredCampaigns.length === 0 && (
                        <tr>
                          <td colSpan={9} className="py-16 text-center text-slate-400 font-semibold text-sm">
                            No se encontraron resultados para los filtros seleccionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* TAB CONTENT: ADVANCED AI ASSISTANT SUMMARY */}
            {activeTab === 'ai-insights' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Strategic Advisor controls */}
                <div className="liquid-glass-panel p-5 rounded-2xl border border-slate-800 shadow-lg lg:col-span-1 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-950/40 border border-indigo-900/30 rounded-lg text-indigo-400 animate-pulse">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-100 text-sm">Auditor Inteligente Gemini</h3>
                      <p className="text-xs text-slate-500">Análisis semántico del ritmo de spend</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-normal">
                    La inteligencia artificial de Gemini procesa la lista completa de indicadores de campaña, fechas de campaña y objetivos de avance para redactar optimizaciones, identificar desvíos y proponer rebalance de presupuestos.
                  </p>

                  <div className="p-3.5 bg-indigo-950/20 rounded-xl border border-indigo-900/40 text-[11px] text-slate-300 space-y-2">
                    <span className="font-bold text-indigo-400 block">¿Qué analiza el auditor?</span>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Campañas quemándose muy rápido (pacing &gt; 115%).</li>
                      <li>Detenciones tempranas y riesgo de subatención.</li>
                      <li>Cálculo predictivo al cierre de mes por run-rate.</li>
                      <li>Reasignación táctica entre objetivos compatibles.</li>
                    </ul>
                  </div>

                  <button
                    onClick={runCampaignAIAnalysis}
                    disabled={loadingAI || campaigns.length === 0}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-505 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg transition duration-155 disabled:opacity-50 cursor-pointer"
                  >
                    {loadingAI ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Generando de gemini...</span>
                      </>
                    ) : (
                      <>
                        <CloudLightning className="w-4 h-4" />
                        <span>Calcular Diagnóstico</span>
                      </>
                    )}
                  </button>

                  {/* API Key info disclaimer, server managed */}
                  <div className="text-[10px] text-slate-500 bg-slate-950/60 p-2.5 rounded-lg text-center mt-2 border border-slate-900">
                    * El cálculo se ejecuta 100% en el servidor mediante el SDK oficial <code className="font-semibold text-slate-350">@google/genai</code>.
                  </div>
                </div>

                {/* Strategic insights workspace */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                  
                  {loadingAI ? (
                    <div className="liquid-glass-panel p-12 rounded-2xl border border-slate-800 shadow-lg flex flex-col items-center justify-center text-center gap-4 animate-pulse">
                      {/* Generative pulsed ring */}
                      <div className="relative">
                        <div className="absolute inset-0 bg-indigo-900/20 rounded-full anim-pulse-ring"></div>
                        <div className="relative p-5 bg-indigo-600 text-white rounded-full">
                          <Sparkles className="w-8 h-8 animate-spin" />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-100">El modelo inteligente está examinando la plantilla...</h4>
                        <p className="text-xs text-slate-400 max-w-sm mt-1 leading-normal">
                          Evaluando fechas límites, conversiones de monedas soles/dólares, tipos de compra CTV y rendimiento del pacing acumulado en Lima.
                        </p>
                      </div>
                    </div>
                  ) : aiAnalysis ? (
                    <div className="flex flex-col gap-6">
                      
                      {/* Strategic Report executive summary */}
                      <div className="liquid-glass-panel p-5 rounded-2xl border border-slate-800 shadow-lg flex flex-col gap-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                          <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold">
                            <FileText className="w-4 h-4" />
                            <span>Resumen Ejecutivo de Rendimiento</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">Generado a las {aiAnalysis.generatedAt}</span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line font-normal">
                          {aiAnalysis.generalReport}
                        </p>
                      </div>

                      {/* AI identified anomalies list */}
                      <div className="liquid-glass-panel p-5 rounded-2xl border border-slate-800 shadow-lg flex flex-col gap-3">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider pb-1 border-b border-slate-800">
                          Alertas Críticas de Medios Identificadas ({aiAnalysis.anomalies.length})
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                          {aiAnalysis.anomalies.map((anom) => {
                            const isHigh = anom.severity === 'high';
                            const severityStyles = isHigh
                              ? 'bg-red-950/45 text-red-400 border border-red-900/30'
                              : 'bg-amber-950/45 text-amber-400 border border-amber-900/30';
                            
                            return (
                              <div key={anom.oppId} className="p-3 liquid-glass-inner border border-slate-800 rounded-xl flex flex-col justify-between gap-3 hover:border-slate-705 transition">
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-[10px] font-bold text-indigo-400">{anom.oppId}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize ${severityStyles}`}>
                                      {anom.severity === 'high' ? 'Crítica' : 'Moderada'}
                                    </span>
                                  </div>
                                  <p className="font-bold text-slate-100 text-xs mt-1.5 line-clamp-1">{anom.oppName}</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">Cliente: <span className="font-semibold text-slate-300">{anom.cliente}</span></p>
                                  <p className="text-xs text-slate-350 mt-2 font-normal leading-normal">{anom.issue}</p>
                                </div>

                                <div className="bg-[#0e1628] p-2 rounded-lg grid grid-cols-4 gap-1 text-[9px] font-mono border border-slate-800">
                                  <div>
                                    <p className="text-slate-500 font-bold uppercase leading-none">Inver.</p>
                                    <p className="text-slate-250 font-bold mt-1 truncate">{anom.metrics.inversion}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 font-bold uppercase leading-none">Metas</p>
                                    <p className="text-slate-250 font-bold mt-1 truncate">{anom.metrics.obj}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 font-bold uppercase leading-none">Entregado</p>
                                    <p className="text-slate-250 font-bold mt-1 truncate">{anom.metrics.avance}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 font-bold uppercase leading-none">Pacing</p>
                                    <p className="text-red-400 font-extrabold mt-1 truncate">{anom.metrics.pacing}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {aiAnalysis.anomalies.length === 0 && (
                            <p className="text-xs text-slate-500 py-6 text-center md:col-span-2 font-medium">No se detectaron anomalías significativas</p>
                          )}
                        </div>
                      </div>

                      {/* Smart budget reallocations based on analysis */}
                      <div className="liquid-glass-panel p-5 rounded-2xl border border-slate-800 shadow-lg flex flex-col gap-3">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider pb-1 border-b border-slate-800">
                          Recomendaciones Tácticas de Rebalance de Presupuesto ({aiAnalysis.recommendations.length})
                        </h4>

                        <div className="space-y-3 mt-1">
                          {aiAnalysis.recommendations.map((rec, index) => (
                            <div key={index} className="p-3.5 border border-slate-800 rounded-xl liquid-glass-inner flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-700 transition">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-1">
                                  <span>{rec.sourceOppId}</span>
                                  <ArrowRight className="w-3 h-3 text-slate-650" />
                                  <span>{rec.targetOppId}</span>
                                </div>
                                <p className="text-xs font-semibold text-slate-200 leading-normal">{rec.action}</p>
                                <p className="text-xs text-slate-400 mt-1 leading-normal font-normal">{rec.justification}</p>
                              </div>
                              <div className="bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-900/30 flex-shrink-0 text-right min-w-[130px]">
                                <span className="text-[9px] uppercase font-bold text-indigo-400 block tracking-wider font-mono">Impacto Rebalance</span>
                                <span className="text-xs font-extrabold text-[#f43f5e] block mt-0.5">{rec.estimatedImpact}</span>
                              </div>
                            </div>
                          ))}
                          {aiAnalysis.recommendations.length === 0 && (
                            <p className="text-xs text-slate-500 py-6 text-center font-medium">No hay transferencias de presupuesto recomendadas actualmente</p>
                          )}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="liquid-glass-panel p-12 rounded-2xl border border-slate-800 shadow-lg text-center flex flex-col items-center justify-center gap-4">
                      <div className="p-4 bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 rounded-full">
                        <Sparkles className="w-8 h-8 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-100">Generador de Estrategias y Pacing IA</h4>
                        <p className="text-xs text-slate-405 text-slate-400 max-w-sm mt-1 leading-normal">
                          Haga clic en &ldquo;Calcular Diagnóstico&rdquo; para analizar las {campaigns.length} campañas activas y redactar balances inteligentes con Gemini.
                        </p>
                      </div>
                      <button
                        onClick={runCampaignAIAnalysis}
                        className="px-5 py-2 hover:bg-indigo-505 bg-indigo-600 border border-indigo-550 hover:bg-slate-800 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 text-white cursor-pointer"
                      >
                        <CloudLightning className="w-4 h-4" />
                        <span>Comenzar Auditoría</span>
                      </button>
                    </div>
                  )}

                  {/* Show analysis errors if any */}
                  {aiError && (
                    <div className="p-4 bg-rose-950/45 border border-rose-900/30 rounded-xl text-xs text-rose-355 text-rose-300 flex items-start gap-1.5 font-medium mt-4">
                      <AlertTriangle className="w-4 h-4 text-rose-450 text-rose-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-rose-455 text-rose-405 text-rose-400">Error Generando Resumen Inteligente:</p>
                        <p className="mt-0.5 text-rose-300">{aiError}</p>
                      </div>
                    </div>
                  )}

                </div>

              </div>
            )}

            {activeTab === 'op-analysis' && (
              <div className="flex flex-col gap-6 animate-fade-in text-slate-100">
                
                {/* Search & Direct Dropdown Header */}
                <div className="liquid-glass-panel p-5 rounded-2xl border border-slate-800 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-rose-950/45 text-rose-400 border border-rose-900/30 rounded-xl">
                      <Activity className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">Buscador y Análisis de Entrega Diario</h3>
                      <p className="text-xs text-slate-400 font-medium">Historial diario, KPIs y run-rates extraídos de Direct Analytics</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:max-w-2xl">
                    <div className="relative w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Buscar por ID de OP o Nombre (ej: OP-116460)..."
                        value={searchedOppId}
                        onChange={(e) => setSearchedOppId(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const found = campaigns.find(
                              c => c.oppId.toLowerCase() === searchedOppId.trim().toLowerCase() ||
                              c.oppName.toLowerCase().includes(searchedOppId.trim().toLowerCase())
                            );
                            if (found) {
                              loadCampaignDailyData(found);
                            } else {
                              alert(`No se encontró la campaña con ID o nombre: "${searchedOppId}"`);
                            }
                          }
                        }}
                        className="w-full bg-[#121929] border border-slate-805 text-slate-100 placeholder-slate-505 placeholder-slate-500 rounded-xl pl-9 pr-20 h-10 text-xs focus:bg-[#182239] focus:outline-none focus:ring-1 focus:ring-rose-500 font-semibold border-slate-800"
                      />
                      <button
                        onClick={() => {
                          const found = campaigns.find(
                            c => c.oppId.toLowerCase() === searchedOppId.trim().toLowerCase() ||
                            c.oppName.toLowerCase().includes(searchedOppId.trim().toLowerCase())
                          );
                          if (found) {
                            loadCampaignDailyData(found);
                          } else {
                            alert(`No se encontró la campaña con ID o nombre: "${searchedOppId}"`);
                          }
                        }}
                        className="absolute right-1 top-1 h-8 px-3.5 bg-indigo-600 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition duration-155 cursor-pointer"
                      >
                        Buscar
                      </button>
                    </div>

                    <span className="text-xs text-slate-455 text-slate-450 text-slate-400 font-bold uppercase shrink-0 font-mono">O Seleccione:</span>
                    
                    <select
                      onChange={(e) => {
                        const found = campaigns.find(c => c.oppId === e.target.value);
                        if (found) {
                          setSearchedOppId(found.oppId);
                          loadCampaignDailyData(found);
                        }
                      }}
                      value={selectedAnalysisCampaign?.oppId || ""}
                      className="w-full sm:w-64 bg-[#121929] border border-slate-805 text-slate-200 rounded-xl h-10 px-3 py-2 text-xs focus:bg-[#182239] focus:outline-none focus:ring-1 focus:ring-rose-500 font-semibold font-mono border-slate-800"
                    >
                      <option value="" className="bg-[#121929] text-slate-400">-- Seleccionar Campaña --</option>
                      {campaigns.map((camp) => (
                        <option key={camp.oppId + camp.mes} value={camp.oppId} className="bg-[#121929] text-slate-200">
                          [{camp.oppId}] {camp.cliente.substring(0, 15)} - {camp.oppName.substring(0, 20)}...
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Main content body */}
                {!selectedAnalysisCampaign ? (
                  <div className="liquid-glass-panel p-16 rounded-2xl border border-slate-800 shadow-lg text-center flex flex-col items-center justify-center gap-4">
                    <div className="p-4 bg-rose-950/40 text-rose-455 rounded-full animate-pulse border border-rose-900/30">
                      <Search className="w-8 h-8 text-rose-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">Ninguna OP seleccionada para el análisis diario</h4>
                      <p className="text-xs text-slate-400 max-w-sm mt-1 leading-normal">
                        Escriba un ID de OP en el buscador superior o seleccione un elemento de la lista para analizar las gráficas diarias de la pestaña <b>Direct Analytics</b>.
                      </p>
                    </div>
                  </div>
                ) : loadingDaily ? (
                  <div className="liquid-glass-panel p-20 rounded-2xl border border-slate-800 shadow-lg flex flex-col items-center justify-center text-center gap-4">
                    <RefreshCw className="w-8 h-8 text-rose-400 animate-spin" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">Cargando reporte de ritmo diario...</h4>
                      <p className="text-xs text-slate-500 max-w-xs mt-1">Conectándose con las pestañas de amortización de Sheets...</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    
                    {/* Left Panel: Campaign Core KPIs & Runrates */}
                    <div className="xl:col-span-1 flex flex-col gap-5">
                      
                      {/* Brand Info card */}
                      <div className="liquid-glass-panel p-5 rounded-2xl border border-slate-800 shadow-lg flex flex-col gap-3 relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-6 -mt-6"></div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs px-2.5 py-1 rounded bg-rose-950/45 text-rose-400 border border-rose-900/30 font-bold">
                            {selectedAnalysisCampaign.oppId}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{selectedAnalysisCampaign.mes}</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase leading-none">Orden de Compra: {selectedAnalysisCampaign.oc || "N/A"}</p>
                          <h4 className="text-base font-extrabold text-slate-100 mt-1 lines-clamp-2 leading-tight">
                            {selectedAnalysisCampaign.oppName}
                          </h4>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
                          <div className="p-2 liquid-glass-inner border border-slate-800 rounded-lg">
                            <span className="text-[9px] uppercase font-bold text-slate-500 block">Agencia</span>
                            <span className="font-bold text-slate-300 line-clamp-1">{selectedAnalysisCampaign.agencia}</span>
                          </div>
                          <div className="p-2 liquid-glass-inner border border-slate-800 rounded-lg">
                            <span className="text-[9px] uppercase font-bold text-slate-500 block">Cliente</span>
                            <span className="font-bold text-slate-300 line-clamp-1">{selectedAnalysisCampaign.cliente}</span>
                          </div>
                          <div className="p-2 liquid-glass-inner border border-slate-800 rounded-lg">
                            <span className="text-[9px] uppercase font-bold text-slate-500 block">Formato</span>
                            <span className="font-bold text-slate-300 font-mono text-[10px]">{selectedAnalysisCampaign.formato}</span>
                          </div>
                          <div className="p-2 liquid-glass-inner border border-slate-800 rounded-lg">
                            <span className="text-[9px] uppercase font-bold text-slate-500 block">Compra Unitario</span>
                            <span className="font-bold text-slate-300 text-[10px]">{selectedAnalysisCampaign.tipoCompra}</span>
                          </div>
                        </div>
                      </div>

                      {/* Visual Pacing Progress widget */}
                      <div className="liquid-glass-panel p-5 rounded-2xl border border-slate-800 shadow-lg flex flex-col gap-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">Pacing de Amortización</span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full font-bold font-mono text-xs ${getPacingColorClass(selectedAnalysisCampaign.pacingValue).bgLight} ${getPacingColorClass(selectedAnalysisCampaign.pacingValue).text}`}>
                            {selectedAnalysisCampaign.pacingValue.toFixed(1)}%
                          </span>
                        </div>
                        
                        {/* Custom radial or horizontal progress bar */}
                        <div className="h-4 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${getPacingColorClass(selectedAnalysisCampaign.pacingValue).bg}`}
                            style={{ width: `${Math.min(selectedAnalysisCampaign.pacingValue, 100)}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-center">
                          <div className="p-3 liquid-glass-inner border border-slate-800 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Objetivo</span>
                            <span className="font-mono text-xs sm:text-sm font-extrabold text-[#f8fafc] block mt-1">
                              {selectedAnalysisCampaign.objectiveValue ? selectedAnalysisCampaign.objectiveValue.toLocaleString('es-PE') : "0"}
                            </span>
                          </div>
                          <div className="p-3 liquid-glass-inner border border-slate-800 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Avance Acumulado</span>
                            <span className="font-mono text-xs sm:text-sm font-extrabold text-[#f8fafc] block mt-1">
                              {selectedAnalysisCampaign.avanceValue ? selectedAnalysisCampaign.avanceValue.toLocaleString('es-PE') : "0"}
                            </span>
                          </div>
                        </div>

                        {/* Interactive Metrics Breakdown (Clicks, CTR, sessions, VTR, ER) */}
                        {selectedAnalysisCampaign?.clicksValue !== undefined && selectedAnalysisCampaign.clicksValue > 0 && (
                          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
                            <span className="text-[10px] font-bold text-slate-505 text-slate-500 uppercase tracking-widest block text-left">Métricas de Interacción</span>
                            <div className="grid grid-cols-2 gap-2 text-left">
                              <div className="p-2 liquid-glass-inner border border-slate-800 rounded-xl">
                                <span className="text-[9px] font-medium text-slate-500 block leading-none">Clics Totales</span>
                                <span className="font-mono text-xs font-bold text-[#f8fafc] mt-1 block">
                                  {selectedAnalysisCampaign.clicksValue.toLocaleString('es-PE')}
                                </span>
                              </div>
                              <div className="p-2 liquid-glass-inner border border-slate-800 rounded-xl">
                                <span className="text-[9px] font-medium text-slate-500 block leading-none">CTR Promedio</span>
                                <span className="font-mono text-xs font-bold text-emerald-400 mt-1 block">
                                  {selectedAnalysisCampaign.avanceValue ? ((selectedAnalysisCampaign.clicksValue / selectedAnalysisCampaign.avanceValue) * 100).toFixed(2) : '0.01'}%
                                </span>
                              </div>
                              
                              {selectedAnalysisCampaign.sesionesValue !== undefined && selectedAnalysisCampaign.sesionesValue > 0 && (
                                <div className="p-2 liquid-glass-inner border border-slate-800 rounded-xl">
                                  <span className="text-[9px] font-medium text-slate-500 block leading-none">Sesiones</span>
                                  <span className="font-mono text-xs font-bold text-[#f8fafc] mt-1 block">
                                    {selectedAnalysisCampaign.sesionesValue.toLocaleString('es-PE')}
                                  </span>
                                </div>
                              )}
                              
                              {selectedAnalysisCampaign.erValue !== undefined && selectedAnalysisCampaign.erValue > 0 && (
                                <div className="p-2 liquid-glass-inner border border-slate-800 rounded-xl">
                                  <span className="text-[9px] font-medium text-slate-500 block leading-none">ER (Engagement)</span>
                                  <span className="font-mono text-xs font-bold text-amber-400 mt-1 block">
                                    {selectedAnalysisCampaign.erValue.toFixed(2)}%
                                  </span>
                                </div>
                              )}

                              {selectedAnalysisCampaign.vtrValue !== undefined && selectedAnalysisCampaign.vtrValue > 0 && (
                                <div className="col-span-2 p-2.5 bg-[#141021] border border-pink-900/30 rounded-xl flex items-center justify-between">
                                  <span className="text-[9px] font-bold text-pink-400 uppercase">VTR (View Through Rate)</span>
                                  <span className="font-mono text-xs font-extrabold text-pink-400">
                                    {selectedAnalysisCampaign.vtrValue.toFixed(2)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Campaign Date & Daily Run-rate KPIs */}
                      {dateStats && (
                        <div className="liquid-glass-panel p-5 rounded-2xl border border-slate-800 shadow-lg flex flex-col gap-4">
                          <h4 className="text-xs font-extrabold text-slate-300 tracking-wider uppercase border-b border-slate-800 pb-1.5 flex items-center gap-1.5 font-sans">
                            <Calendar className="w-4 h-4 text-[#f43f5e]" />
                            <span>Calendario &amp; Run-rate Requerido</span>
                          </h4>
                          
                          <div className="space-y-3 text-xs text-slate-300 font-normal">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-slate-500">Periodo Oficial:</span>
                              <span className="font-bold text-slate-200 text-right">{selectedAnalysisCampaign.fechaInicio} al {selectedAnalysisCampaign.fechaFin}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-slate-500">Duración total:</span>
                              <span className="font-mono font-bold text-slate-200">{dateStats.totalDays} Impresiones/Días</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-slate-500">Transcurridos:</span>
                              <span className="font-mono font-bold text-slate-200">{dateStats.elapsedDays} días ({dateStats.percentageTimeElapsed.toFixed(0)}%)</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-slate-500">Días Restantes:</span>
                              <span className="font-mono font-bold text-[#f43f5e] bg-rose-950/45 px-2 py-0.5 rounded border border-rose-900/35">{dateStats.remainingDays} días</span>
                            </div>
                            
                            <hr className="border-slate-800" />
                            
                            <div className="p-3.5 bg-rose-955/20 border border-rose-900/35 rounded-xl flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest block font-mono">Inyección Diaria Pendiente</span>
                                <span className="text-sm font-mono font-extrabold text-rose-455 text-rose-350 block mt-1">
                                  {dateStats.requiredDailyRunrate.toLocaleString('es-PE')}
                                </span>
                                <span className="text-[9px] text-slate-500 font-medium block mt-0.5">Unidades recomendadas por día</span>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className="text-[9px] uppercase font-bold text-slate-500 block">Promedio Ideal</span>
                                <span className="text-xs font-mono font-semibold text-slate-300 mt-1 block">
                                  {dateStats.averageTargetDaily.toLocaleString('es-PE')}/Día
                                </span>
                              </div>
                            </div>

                            {/* Alert dynamic recommendations based on pacing */}
                            <div className={`p-3 rounded-xl border text-[11px] leading-relaxed font-sans ${
                              selectedAnalysisCampaign.pacingValue < 85 
                                ? 'bg-[#291b15] border-amber-900/30 text-amber-300' 
                                : selectedAnalysisCampaign.pacingValue > 115 
                                ? 'bg-[#151b2d] border-indigo-900/30 text-indigo-300' 
                                : 'bg-[#112419] border-green-900/30 text-green-300'
                            }`}>
                              {selectedAnalysisCampaign.pacingValue < 85 ? (
                                <p>⚠️ <b>Alerta de Subentrega</b>: La campaña necesita acelerar. Aumente la entrega diaria a un ritmo recomendado de <b>{dateStats.requiredDailyRunrate.toLocaleString('es-PE')}</b> unidades diarias para no perder presupuesto.</p>
                              ) : selectedAnalysisCampaign.pacingValue > 115 ? (
                                <p>⚠️ <b>Alerta de Sobrecosto</b>: Se está consumiendo demasiado rápido. Limite el ritmo de entrega diario para estirar el presupuesto restante a los {dateStats.remainingDays} días sobrantes.</p>
                              ) : (
                                <p>✅ <b>Ritmo Saludable</b>: No se requieren correcciones urgentes. El consumo diario de {dateStats.requiredDailyRunrate.toLocaleString('es-PE')} es muy similar al ideal original.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Right Panel: Daily Delivery Composed Chart */}
                    <div className="xl:col-span-2 flex flex-col gap-6">
                      
                      {/* Chart container */}
                      <div className="liquid-glass-panel p-5 rounded-2xl border border-slate-800 shadow-lg flex flex-col gap-4">
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800 gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-sans">Curva de Amortización Diaria y Acumulativa</span>
                          </div>
                          
                          {/* Data Source Badge */}
                          <div className={`px-3 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${
                            dailyIsReal 
                              ? 'bg-emerald-950/55 text-emerald-400 border border-emerald-900/30' 
                              : 'bg-amber-950/55 text-amber-400 border border-amber-900/30'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                            <span>{dailySource}</span>
                          </div>
                        </div>

                        {/* Switcher de Métricas */}
                        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#121929] border border-slate-800 rounded-xl self-start w-full">
                          <button
                            onClick={() => setActiveMetric('impressions')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-1 sm:flex-none text-center ${
                              activeMetric === 'impressions'
                                ? 'bg-indigo-650 text-white shadow-md'
                                : 'text-slate-450 text-slate-400 hover:bg-[#182239] hover:text-slate-250'
                            }`}
                          >
                            Impresiones ({selectedAnalysisCampaign?.avanceValue ? selectedAnalysisCampaign.avanceValue.toLocaleString('es-PE') : '0'})
                          </button>
                          
                          <button
                            onClick={() => setActiveMetric('clicks')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-1 sm:flex-none text-center ${
                              activeMetric === 'clicks'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-450 text-slate-400 hover:bg-[#182239] hover:text-slate-250'
                            }`}
                          >
                            Clics ({selectedAnalysisCampaign?.clicksValue !== undefined ? selectedAnalysisCampaign.clicksValue.toLocaleString('es-PE') : '0'})
                          </button>
                          
                          <button
                            onClick={() => setActiveMetric('ctr')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-1 sm:flex-none text-center ${
                              activeMetric === 'ctr'
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'text-slate-450 text-slate-400 hover:bg-[#182239] hover:text-slate-250'
                            }`}
                          >
                            CTR ({selectedAnalysisCampaign?.clicksValue && selectedAnalysisCampaign?.avanceValue ? ((selectedAnalysisCampaign.clicksValue / selectedAnalysisCampaign.avanceValue) * 100).toFixed(2) : '0.00'}%)
                          </button>
                          
                          {((selectedAnalysisCampaign?.vtrValue !== undefined && selectedAnalysisCampaign.vtrValue > 0) || (selectedAnalysisCampaign?.formato && selectedAnalysisCampaign.formato.toLowerCase().includes("video"))) && (
                            <button
                              onClick={() => setActiveMetric('vtr')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-1 sm:flex-none text-center ${
                                activeMetric === 'vtr'
                                  ? 'bg-[#ec4899] text-white shadow-md'
                                  : 'text-slate-455 text-slate-400 hover:bg-[#182239] hover:text-slate-250'
                              }`}
                            >
                              VTR ({selectedAnalysisCampaign?.vtrValue !== undefined ? selectedAnalysisCampaign.vtrValue.toFixed(2) : '0.00'}%)
                            </button>
                          )}

                          <button
                            onClick={() => setActiveMetric('er')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-1 sm:flex-none text-center ${
                              activeMetric === 'er'
                                ? 'bg-amber-600 text-white shadow-md'
                                : 'text-slate-455 text-slate-400 hover:bg-[#182239] hover:text-[#f8fafc]'
                            }`}
                          >
                            ER ({selectedAnalysisCampaign?.erValue !== undefined ? selectedAnalysisCampaign.erValue.toFixed(2) : '0.00'}%)
                          </button>
                        </div>

                        {dailyDeliveryPoints.length > 0 ? (
                          (() => {
                            const isImpressions = activeMetric === 'impressions';
                            const isClicks = activeMetric === 'clicks';
                            const isCtr = activeMetric === 'ctr';
                            const isVtr = activeMetric === 'vtr';
                            const isEr = activeMetric === 'er';
                            const isPercent = isCtr || isVtr || isEr;

                            // Decide keys, names, lines color
                            let barKey = "delivery";
                            let areaKey = "accumulated";
                            let lineKey = "targetAccumulated";
                            
                            let yLeftLabel = "Acumulado";
                            let yRightLabel = "Diario";
                            let barName = "Entrega Diaria";
                            let areaName = "Avance Real Acumulado";
                            let lineName = "Curva Ideal Teórica";

                            let colorTheme = "#38bdf8";      // Cyan
                            let barFill = "rgba(148, 163, 184, 0.15)"; // Soft translucent dark slate bar
                            let targetLineColor = "#818cf8";  // Indigo
                            let gradientId = "colorAccum";

                            if (isClicks) {
                              barKey = "clicks";
                              areaKey = "accumulatedClicks";
                              lineKey = "targetClicksAccumulated";
                              
                              yLeftLabel = "Acumulado Clics";
                              yRightLabel = "Clics Diarios";
                              barName = "Clics Diarios";
                              areaName = "Clics Acumulados";
                              lineName = "Meta Clics Acumulados";
                              
                              colorTheme = "#818cf8"; // Indigo
                              barFill = "rgba(129, 140, 248, 0.15)";
                              targetLineColor = "#a78bfa";
                              gradientId = "colorClicks";
                            } else if (isCtr) {
                              barKey = "ctr";
                              areaKey = "ctr";
                              lineKey = "";
                              
                              yLeftLabel = "CTR (%)";
                              yRightLabel = "CTR Diario (%)";
                              barName = "CTR Diario";
                              areaName = "CTR Diario (%)";
                              lineName = "";
                              
                              colorTheme = "#34d399"; // Emerald
                              barFill = "rgba(52, 211, 153, 0.15)";
                              gradientId = "colorCtr";
                            } else if (isVtr) {
                              barKey = "vtr";
                              areaKey = "vtr";
                              lineKey = "";
                              
                              yLeftLabel = "VTR (%)";
                              yRightLabel = "VTR Diario (%)";
                              barName = "VTR Diario";
                              areaName = "VTR Diario (%)";
                              lineName = "";
                              
                              colorTheme = "#fb7185"; // Rose
                              barFill = "rgba(251, 113, 133, 0.15)";
                              gradientId = "colorVtr";
                            } else if (isEr) {
                              barKey = "er";
                              areaKey = "er";
                              lineKey = "";
                              
                              yLeftLabel = "ER (%)";
                              yRightLabel = "ER Diario (%)";
                              barName = "ER Diario";
                              areaName = "ER Diario (%)";
                              lineName = "";
                              
                              colorTheme = "#fbbf24"; // Amber
                              barFill = "rgba(251, 191, 36, 0.15)";
                              gradientId = "colorEr";
                            }

                            return (
                              <div className="h-96 w-full -ml-4 pr-1 mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                  <ComposedChart data={dailyDeliveryPoints}>
                                    <defs>
                                      <linearGradient id="colorAccum" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0}/>
                                      </linearGradient>
                                      <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0.0}/>
                                      </linearGradient>
                                      <linearGradient id="colorCtr" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#34d399" stopOpacity={0.0}/>
                                      </linearGradient>
                                      <linearGradient id="colorVtr" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#fb7185" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#fb7185" stopOpacity={0.0}/>
                                      </linearGradient>
                                      <linearGradient id="colorEr" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.0}/>
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                    <XAxis 
                                      dataKey="date" 
                                      tickLine={false}
                                      axisLine={false}
                                      tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                                    />
                                    {/* Dual Y Axis */}
                                    <YAxis 
                                      yAxisId="left"
                                      axisLine={false}
                                      tickLine={false}
                                      tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                                      tickFormatter={(v) => {
                                        if (isPercent) return `${v.toFixed(1)}%`;
                                        return v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v;
                                      }}
                                      label={{ value: yLeftLabel, angle: -90, position: 'insideLeft', style: { fontSize: 8, fill: '#94a3b8', fontWeight: 600 } }}
                                    />
                                    <YAxis 
                                      yAxisId="right"
                                      orientation="right"
                                      axisLine={false}
                                      tickLine={false}
                                      tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                                      tickFormatter={(v) => {
                                        if (isPercent) return `${v.toFixed(1)}%`;
                                        return v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v;
                                      }}
                                      label={{ value: yRightLabel, angle: 90, position: 'insideRight', style: { fontSize: 8, fill: '#94a3b8', fontWeight: 600 } }}
                                    />
                                    
                                    <Tooltip 
                                      contentStyle={{ 
                                        backgroundColor: '#090d16', 
                                        border: '1px solid #1e293b', 
                                        borderRadius: '12px', 
                                        padding: '12px',
                                        color: '#f8fafc',
                                        fontSize: '11px',
                                        fontFamily: 'monospace'
                                      }}
                                      formatter={(value: any, name: string) => {
                                        if (typeof value !== 'number') return [value, name];
                                        const suffix = isPercent ? "%" : "";
                                        const valStr = isPercent ? value.toFixed(2) : value.toLocaleString('es-PE');
                                        
                                        let readableName = name;
                                        if (name === barKey) readableName = barName;
                                        else if (name === areaKey) readableName = areaName;
                                        else if (name === lineKey) readableName = lineName;

                                        return [`${valStr}${suffix}`, readableName];
                                      }}
                                    />
                                    <Legend 
                                      wrapperStyle={{ fontSize: 10, fontWeight: 600, color: '#94a3b8' }}
                                    />
                                    
                                    {/* Daily delivery bar */}
                                    <Bar 
                                      yAxisId="right"
                                      dataKey={barKey} 
                                      name={barName}
                                      fill={barFill} 
                                      stroke={colorTheme}
                                      strokeWidth={0.75}
                                      radius={[4, 4, 0, 0]}
                                      maxBarSize={30}
                                    />
                                    
                                    {/* Cumulative area */}
                                    {areaKey && (
                                      <Area 
                                        yAxisId="left"
                                        type="monotone" 
                                        dataKey={areaKey} 
                                        name={areaName}
                                        stroke={colorTheme} 
                                        strokeWidth={2.5}
                                        fillOpacity={1} 
                                        fill={`url(#${gradientId})`} 
                                      />
                                    )}
                                    
                                    {/* Cumulative target path line */}
                                    {lineKey && (
                                      <Line 
                                        yAxisId="left"
                                        type="monotone" 
                                        dataKey={lineKey} 
                                        name={lineName}
                                        stroke={targetLineColor} 
                                        strokeWidth={2}
                                        strokeDasharray="5 5"
                                        dot={false}
                                      />
                                    )}
                                  </ComposedChart>
                                </ResponsiveContainer>
                              </div>
                            );
                          })()
                        ) : (
                          <p className="text-center py-16 text-slate-400 text-xs font-semibold">No hay puntos de entrega suficientes para graficar</p>
                        )}
                        
                        <div className="text-[10px] text-slate-400 liquid-glass-inner p-3 rounded-xl border border-slate-800 flex items-start gap-1.5 font-sans leading-relaxed">
                          <Info className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                          <p className="font-normal text-slate-400 leading-relaxed">
                            <b>Análisis Visual:</b> Las barras de entrega diaria representan el volumen inyectado en esa fecha específica (Y-Eje derecho). La curva continua muestra la curva real acumulada, mientras que la curva punteada grafica el camino de amortización teórica uniforme (Y-Eje izquierdo).
                          </p>
                        </div>
                      </div>

                      {/* Daily schedule itemized datatable log */}
                      <div className="liquid-glass-panel rounded-2xl border border-slate-800 shadow-lg overflow-hidden flex flex-col">
                        <div className="px-5 py-3 border-b border-slate-800 liquid-glass-inner flex justify-between items-center gap-4">
                          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-sans">Bitácora Diaria Real de Amortización</h3>
                          <span className="text-[10px] font-mono text-slate-400 bg-[#121929] border border-slate-850 px-2.5 py-0.5 rounded-full font-bold">
                            {dailyDeliveryPoints.length} Registros de fechas
                          </span>
                        </div>

                        <div className="overflow-x-auto max-h-[305px] overflow-y-auto scrollbar-thin">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="liquid-glass-inner border-b border-slate-800 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                                <th className="py-2 px-4 text-center">Nro</th>
                                <th className="py-2 px-4 font-sans text-[10px] font-bold">Fecha de Ejecución</th>
                                <th className="py-2 px-3 text-right leading-none font-sans text-[10px] font-bold">Inyección Diaria</th>
                                <th className="py-2 px-3 text-right leading-none font-sans text-[10px] font-bold">Acumulado Real</th>
                                <th className="py-2 px-3 text-right leading-none font-sans text-[10px] font-bold">Trayectoria Teórica</th>
                                <th className="py-2 px-4 text-center font-sans text-[10px] font-bold">Desviación</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 text-xs font-mono">
                              {dailyDeliveryPoints.map((pt, index) => {
                                const hasAccumulated = pt.accumulated !== undefined && pt.accumulated !== null;
                                const hasDelivery = pt.delivery !== undefined && pt.delivery !== null;
                                const targetAccumulated = pt.targetAccumulated || 0;
                                const accumulated = pt.accumulated || 0;
                                const diff = accumulated - targetAccumulated;
                                const diffPerc = targetAccumulated > 0 ? (diff / targetAccumulated) * 100 : 0;
                                return (
                                  <tr key={index} className="hover:bg-slate-800/20 transition text-slate-300">
                                    <td className="py-1.5 px-4 text-center text-slate-500 text-[10px]">{index + 1}</td>
                                    <td className="py-1.5 px-4 text-slate-300 font-semibold">{pt.date || "-"}</td>
                                    <td className="py-1.5 px-3 text-right font-extrabold text-slate-100">
                                      {hasDelivery ? pt.delivery.toLocaleString('es-PE') : "-"}
                                    </td>
                                    <td className="py-1.5 px-3 text-right text-indigo-400 font-semibold">
                                      {hasAccumulated ? pt.accumulated.toLocaleString('es-PE') : "-"}
                                    </td>
                                    <td className="py-1.5 px-3 text-right text-slate-500 font-mono">
                                      {pt.targetAccumulated !== undefined && pt.targetAccumulated !== null ? pt.targetAccumulated.toLocaleString('es-PE') : "-"}
                                    </td>
                                    <td className="py-1.5 px-4 text-center">
                                      {!hasAccumulated ? (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-500 font-bold border border-slate-700">
                                          Pendiente
                                        </span>
                                      ) : diffPerc < -15 ? (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-950/40 text-amber-400 font-bold border border-amber-900/40">
                                          {diffPerc.toFixed(0)}% Atrás
                                        </span>
                                      ) : diffPerc > 15 ? (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-sky-950/40 text-sky-400 font-bold border border-sky-900/40">
                                          +{diffPerc.toFixed(0)}% Adelantado
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-950/40 text-emerald-400 font-bold border border-emerald-900/40">
                                          En línea
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>

                  </div>
                )}

              </div>
            )}

          </>
        )}

      </main>

      {/* CAMPAIGN DRAWER / MODAL SCREEN ASIDE FOR CRADLED DETAIL PREVIEW */}
      {selectedCampaign && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center z-50 p-4 transition-all animate-fade-in backdrop-blur-md">
          <div className="liquid-glass-panel w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Title bar */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between liquid-glass-inner">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2.5 py-1 rounded bg-indigo-950/60 text-indigo-400 border border-indigo-900 font-bold">
                  {selectedCampaign.oppId}
                </span>
                <span className="text-xs text-slate-400 capitalize font-medium">{selectedCampaign.mes}</span>
              </div>
              <button
                onClick={() => setSelectedCampaign(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-sm font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Payload container */}
            <div className="p-6 overflow-y-auto flex flex-col gap-5">
              
              {/* Campaign ID & Brand */}
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">OC: {selectedCampaign.oc || 'Sin registro'}</span>
                <h3 className="text-lg font-extrabold text-slate-100 tracking-tight max-w-full leading-tight mt-1">
                  {selectedCampaign.oppName}
                </h3>
                
                <div className="flex flex-wrap gap-2.5 mt-3 text-xs">
                  <span className="px-2.5 py-0.5 rounded bg-slate-850 text-slate-300 border border-slate-800 font-medium">Agencia: {selectedCampaign.agencia}</span>
                  <span className="px-2.5 py-0.5 rounded bg-slate-850 text-slate-300 border border-slate-800 font-medium font-mono">Cliente: {selectedCampaign.cliente}</span>
                  {selectedCampaign.motivo && (
                    <span className="px-2.5 py-0.5 rounded bg-sky-950/40 text-sky-400 border border-sky-900/40 font-medium font-mono">Motivo: {selectedCampaign.motivo}</span>
                  )}
                </div>
              </div>

              {/* Progress Tracking Gauges */}
              <div className="p-4 liquid-glass-inner/60 rounded-2xl border border-slate-800/80">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Pacing de Amortización Actual</span>
                  <span className="font-mono text-indigo-400 font-bold text-xs bg-[#121929] border border-slate-800 px-2.5 py-0.5 rounded-md">{selectedCampaign.pacingRaw}</span>
                </div>
                
                {/* Visual bar */}
                <div className="h-3 bg-slate-850 rounded-full overflow-hidden border border-slate-850 flex">
                  <div 
                    className={`h-full ${getPacingColorClass(selectedCampaign.pacingValue).bg}`} 
                    style={{ width: `${Math.min(selectedCampaign.pacingValue, 100)}%` }}
                  ></div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 mt-4 text-center">
                  <div className="bg-[#121929]/40 p-2 rounded-xl border border-slate-800/80">
                    <p className="text-[9px] uppercase font-bold text-slate-500 tracking-wide">Inversión</p>
                    <p className="text-xs font-mono font-extrabold text-slate-100 mt-1">{selectedCampaign.inversionRaw}</p>
                    <p className="text-[9px] text-slate-500 mt-0.5 font-mono">Moneda: {selectedCampaign.currency}</p>
                  </div>
                  <div className="bg-[#121929]/40 p-2 rounded-xl border border-slate-800/80">
                    <p className="text-[9px] uppercase font-bold text-slate-500 tracking-wide">Objetivo Total</p>
                    <p className="text-xs font-mono font-extrabold text-slate-100 mt-1">
                      {selectedCampaign.objectiveValue ? selectedCampaign.objectiveValue.toLocaleString('es-PE') : "0"}
                    </p>
                    <p className="text-[9px] text-slate-500 mt-0.5">{selectedCampaign.tipoCompra} unitario</p>
                  </div>
                  <div className="bg-[#121929]/40 p-2 rounded-xl border border-slate-800/80">
                    <p className="text-[9px] uppercase font-bold text-slate-500 tracking-wide">Avance Real</p>
                    <p className="text-xs font-mono font-extrabold text-slate-100 mt-1">
                      {selectedCampaign.avanceValue ? selectedCampaign.avanceValue.toLocaleString('es-PE') : "0"}
                    </p>
                    <p className="text-[9px] text-slate-505 mt-0.5 font-sans">Indicador acumulado</p>
                  </div>
                </div>
              </div>

              {/* Duration and Calendar Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border border-slate-800/80 rounded-xl flex items-center gap-3 liquid-glass-inner/40">
                  <Calendar className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider leading-none">Fecha de Lanzamiento</p>
                    <p className="text-xs font-semibold text-slate-300 mt-1.5">{selectedCampaign.fechaInicio || "No registrado"}</p>
                  </div>
                </div>

                <div className="p-3 border border-slate-800/80 rounded-xl flex items-center gap-3 liquid-glass-inner/40">
                  <Calendar className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider leading-none">Fecha de Culminación</p>
                    <p className="text-xs font-semibold text-slate-300 mt-1.5">{selectedCampaign.fechaFin || "No registrado"}</p>
                  </div>
                </div>
              </div>

              {/* Basic math projection analytics */}
              <div className="p-4 bg-indigo-950/20 rounded-2xl border border-indigo-900/40 text-xs">
                <h4 className="font-bold text-indigo-400 mb-2 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-indigo-400" />
                  <span>Análisis Operativo Predictivo (Run Rate)</span>
                </h4>
                <div className="space-y-1.5 text-slate-300 font-normal leading-relaxed">
                  <p>• Su ritmo de entrega acumulado representa un <b>{selectedCampaign.pacingValue.toFixed(1)}%</b> de lo esperado en este instante del mes.</p>
                  {selectedCampaign.pacingValue < 85 ? (
                    <p className="text-amber-400/90 bg-amber-950/20 p-2.5 rounded-lg border border-amber-900/30 mt-1.5">⚠️ <b>Recomendación de Alerta</b>: Esta campaña está infra-entregando. Se aconseja revisar los límites de frecuencia de formato en <b>{selectedCampaign.formato}</b> o consultar al equipo de soporte de medios, para evitar el subconsumo al cierre.</p>
                  ) : selectedCampaign.pacingValue > 115 ? (
                    <p className="text-sky-400/90 bg-sky-950/20 p-2.5 rounded-lg border border-[#1e293b] mt-1.5">⚠️ <b>Recomendación de Alerta</b>: Campaña sobre-entregada rápidamente. Es prioritario reducir las ofertas diarias (bidding unitario de {selectedCampaign.cpmRaw}) o asignar topes de presupuesto diarios para no sobrepasar la inversión.</p>
                  ) : (
                    <p className="text-emerald-400/95 bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/20 mt-1.5">✅ <b>Entrega Saludable</b>: No requiere ajustes operativos inmediatos. Se mantiene dentro de los márgenes óptimos de amortización mensual.</p>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-slate-800 liquid-glass-inner flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  setSearchedOppId(selectedCampaign.oppId);
                  loadCampaignDailyData(selectedCampaign);
                  setSelectedCampaign(null);
                  setActiveTab('op-analysis');
                }}
                className="px-3.5 py-2 bg-rose-950/20 hover:bg-rose-950/40 rounded-xl text-xs font-semibold text-rose-400 border border-rose-900/30 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Ver Entrega Diaria</span>
              </button>

              <div className="flex gap-2 font-sans">
                <button
                  onClick={() => setSelectedCampaign(null)}
                  className="px-4 py-2 bg-transparent hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-400 border border-slate-800 transition cursor-pointer"
                >
                  Cerrar Visor
                </button>
                <button
                  onClick={() => {
                    setSelectedCampaign(null);
                    setActiveTab('ai-insights');
                    if (!aiAnalysis) runCampaignAIAnalysis();
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Analizar con IA
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Footer copyright */}
      <footer className="bg-transparent border-t border-slate-900 mt-12 py-6 text-center text-xs text-slate-500 font-medium">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
          <p>© 2026 Media Budget Control. Excel Pacing Intelligence Dashboard.</p>
          <div className="flex gap-4 items-center justify-center">
            <span className="hover:underline hover:text-slate-400 cursor-pointer transition">Soporte de Medios</span>
            <span className="text-slate-700">•</span>
            <span className="hover:underline hover:text-slate-400 cursor-pointer transition">Google Cloud SDK</span>
            <span className="text-slate-700">•</span>
            <span className="hover:underline hover:text-slate-400 cursor-pointer transition font-bold text-slate-500">Gemini 3.5 Engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
