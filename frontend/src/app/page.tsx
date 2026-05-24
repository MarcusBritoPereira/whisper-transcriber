"use client";

import React, { useState, useRef } from "react";
import { 
  CloudUpload, 
  Link as LinkIcon, 
  Zap, 
  Settings2, 
  Target,
  ChevronDown,
  ChevronUp,
  Loader2,
  Youtube,
  Cloud,
  Triangle,
  Headphones,
  Video,
  Link2,
  Check,
  ArrowLeft,
  FileAudio,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Clock,
  Mic,
  MessageSquare,
  Calendar,
  CheckCircle2,
  Share2,
  Download,
  Edit2,
  FolderInput,
  Trash2,
  FileText
} from "lucide-react";
import axios from "axios";

// Configure default X-API-Key header for Axios requests
axios.defaults.headers.common["X-API-Key"] = "sua_chave_cliente";

interface Segment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

interface TranscriptionResult {
  text: string;
  segments: Segment[];
}

type TabMode = "local" | "online";
type TranscribeMode = "rapido" | "equilibrado" | "preciso";

export default function HomePage() {
  const [tab, setTab] = useState<TabMode>("local");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("pt");
  const [transcribeMode, setTranscribeMode] = useState<TranscribeMode>("rapido");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const [recognizeSpeakers, setRecognizeSpeakers] = useState(false);
  const [translateAudio, setTranslateAudio] = useState(false);
  const [restoreAudio, setRestoreAudio] = useState(false);

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(true);

  type ResultTabType = "transcricao" | "editar" | "traduzir" | "resumo";
  const [activeResultTab, setActiveResultTab] = useState<ResultTabType>("transcricao");
  const [editedText, setEditedText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [summaryText, setSummaryText] = useState("");
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [targetTranslationLanguage, setTargetTranslationLanguage] = useState("en");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [viewMode, setViewMode] = useState<"transcribe" | "history" | "plan">("transcribe");
  const [historyJobs, setHistoryJobs] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Payment & Subscription States
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("inactive");
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"plans" | "form" | "pix" | "boleto" | "success">("plans");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelStep, setCancelStep] = useState<"confirm" | "final">("confirm");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [checkoutForm, setCheckoutForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    document_number: "",
    payment_method: "credit_card", // credit_card, pix, boleto
    postcode: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
    card_number: "",
    card_holder_name: "",
    card_holder_document: "",
    card_cvv: "",
    card_exp_month: "",
    card_exp_year: "",
    installments: 1
  });
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<any>(null);
  const [pixTimer, setPixTimer] = useState<number>(600); // 10 minutes (600s) for Pix

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  // Subscription Status check and payment redirection parameters
  React.useEffect(() => {
    const checkSubscription = async () => {
      try {
        const response = await axios.get(`${apiBaseUrl}/api/v1/payments/subscription-status`);
        setSubscriptionStatus(response.data.status);
        setSubscriptionData(response.data);
      } catch (err) {
        console.error("Failed to check subscription status", err);
        setSubscriptionStatus("inactive");
      }
    };
    checkSubscription();

    // Check for successful payment return URL parameters
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("status") === "success") {
        setCheckoutStep("success");
        setShowUpgradeModal(true);
        setSubscriptionStatus("active");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [apiBaseUrl]);

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    setCancelError(null);
    try {
      await axios.post(`${apiBaseUrl}/api/v1/payments/cancel`, {
        email: checkoutForm.email || "",
        name: `${checkoutForm.first_name || ""} ${checkoutForm.last_name || ""}`.trim() || "Usuário",
        reason: "Cancelado pelo usuário via painel",
      });
      setSubscriptionStatus("cancelled");
      setSubscriptionData((prev: any) => prev ? { ...prev, status: "cancelled" } : prev);
      setShowCancelModal(false);
      setCancelStep("confirm");
    } catch (err: any) {
      setCancelError(err.response?.data?.detail || "Erro ao cancelar assinatura.");
    } finally {
      setIsCancelling(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch { return "—"; }
  };

  // Pix timer effect
  React.useEffect(() => {
    let timer: any;
    if (checkoutStep === "pix" && pixTimer > 0) {
      timer = setInterval(() => {
        setPixTimer(prev => prev - 1);
      }, 1000);
    } else if (pixTimer === 0) {
      setCheckoutStep("plans");
      setPixTimer(600);
    }
    return () => clearInterval(timer);
  }, [checkoutStep, pixTimer]);

  React.useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (viewMode !== "history" && !jobId) {
      setAudioUrl(null);
    }
  }, [file, viewMode, jobId]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/jobs`);
      setHistoryJobs(response.data);
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleViewJob = async (job: any) => {
    setIsTranscribing(true);
    setError(null);
    setResult(null);
    setJobId(job.job_id);
    setJobStatus(null);
    setAudioUrl(`${apiBaseUrl}/jobs/${job.job_id}/audio`);
    
    try {
      const resultResponse = await axios.get(`${apiBaseUrl}/jobs/${job.job_id}/result?format=json`);
      setResult(resultResponse.data);
      setIsTranscribing(false);
      setViewMode("transcribe");
    } catch (err: any) {
      console.error("Failed to load job details", err);
      setError("Erro ao carregar detalhes da transcrição.");
      setIsTranscribing(false);
    }
  };

  React.useEffect(() => {
    let interval: any;
    if (viewMode === "history") {
      const hasPending = historyJobs.some(j => j.status === "queued" || j.status === "processing");
      if (hasPending) {
        interval = setInterval(async () => {
          try {
            const response = await axios.get(`${apiBaseUrl}/jobs`);
            setHistoryJobs(response.data);
          } catch (e) {
            console.error(e);
          }
        }, 5000);
      }
    }
    return () => clearInterval(interval);
  }, [viewMode, historyJobs, apiBaseUrl]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const changePlaybackRate = (rate: number) => {
    const newRate = Math.max(0.5, Math.min(3.0, rate));
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      audioRef.current.muted = vol === 0;
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (audioRef.current) {
      audioRef.current.muted = newMuted;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const pollJobStatus = async (id: string) => {
    try {
      const response = await axios.get(`${apiBaseUrl}/jobs/${id}`);
      const { status, error: jobError } = response.data;
      setJobStatus(status);

      if (status === "completed") {
        const resultResponse = await axios.get(`${apiBaseUrl}/jobs/${id}/result?format=json`);
        setResult(resultResponse.data);
        setIsTranscribing(false);
        // setJobId(null); // Manter o jobId para permitir download do áudio
        setJobStatus(null);
      } else if (status === "failed") {
        setError(jobError || "Erro no processamento do job.");
        setIsTranscribing(false);
        setJobId(null);
        setJobStatus(null);
      } else {
        // Continue polling
        setTimeout(() => pollJobStatus(id), 3000);
      }
    } catch (err: any) {
      console.error("Polling failed", err);
      setError("Falha ao verificar status da transcrição.");
      setIsTranscribing(false);
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCheckingOut(true);
    setCheckoutError(null);
    try {
      // Collect IP dynamically from script if present
      let clientIp = "127.0.0.1";
      if (window.AppmaxScripts) {
        // AppmaxJS collects the IP, so we extract it or fallback to a standard client IP
      }
      
      const payload: any = {
        first_name: checkoutForm.first_name,
        last_name: checkoutForm.last_name,
        email: checkoutForm.email,
        phone: checkoutForm.phone,
        document_number: checkoutForm.document_number,
        ip: clientIp,
        payment_method: checkoutForm.payment_method,
        postcode: checkoutForm.postcode || null,
        street: checkoutForm.street || null,
        number: checkoutForm.number || null,
        complement: checkoutForm.complement || null,
        district: checkoutForm.district || null,
        city: checkoutForm.city || null,
        state: checkoutForm.state || null
      };

      if (checkoutForm.payment_method === "credit_card") {
        // Appmax JS tokenization mock or sandbox simulation:
        payload.card_token = "mock_cc_token_from_frontend_" + Math.random().toString(36).substring(7);
        payload.card_holder_name = checkoutForm.card_holder_name || `${checkoutForm.first_name} ${checkoutForm.last_name}`;
        payload.card_holder_document = checkoutForm.card_holder_document || checkoutForm.document_number;
        payload.installments = Number(checkoutForm.installments);
      }

      const response = await axios.post(`${apiBaseUrl}/api/v1/payments/checkout`, payload);
      setCheckoutResult(response.data);
      const checkoutUrl = response.data.checkout_url;
      
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error("Checkout URL não retornada pelo Abacate Pay.");
      }
    } catch (err: any) {
      console.error("Checkout submit error", err);
      setCheckoutError(err.response?.data?.detail || "Erro ao processar pagamento na Abacate Pay.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const startTranscription = async () => {
    if ((tab === "local" && !file) || (tab === "online" && !url)) return;
    
    // Billing subscription guard check
    if (subscriptionStatus !== "active") {
      setShowUpgradeModal(true);
      return;
    }

    setIsTranscribing(true);
    setError(null);
    setResult(null);
    setJobStatus("queued");
    
    const formData = new FormData();
    if (tab === "local" && file) {
      formData.append("file", file);
    } else if (tab === "online" && url) {
      formData.append("url", url);
    }
    
    formData.append("diarize", recognizeSpeakers ? "true" : "false");
    formData.append("language", language);
    formData.append("translate", translateAudio ? "true" : "false");
    formData.append("restore_audio", restoreAudio ? "true" : "false");
    formData.append("mode", transcribeMode);

    try {
      // Usando o endpoint de jobs (assíncrono)
      const response = await axios.post(`${apiBaseUrl}/jobs/transcribe`, formData);
      const { job_id } = response.data;
      setJobId(job_id);
      pollJobStatus(job_id);
    } catch (err: any) {
      console.error("Transcription start failed", err);
      setError(err.response?.data?.detail || "Erro ao iniciar transcrição.");
      setIsTranscribing(false);
    }
  };

  const handleTranslation = async () => {
    if (!result) return;
    setIsProcessingAction(true);
    try {
      const response = await axios.post(`${apiBaseUrl}/translate_text`, {
        text: result.text,
        target_language: targetTranslationLanguage
      });
      setTranslatedText(response.data.translated_text);
    } catch (err) {
      alert("Erro ao traduzir o texto.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSummarize = async () => {
    if (!result) return;
    setIsProcessingAction(true);
    try {
      const response = await axios.post(`${apiBaseUrl}/summarize`, {
        text: result.text
      });
      setSummaryText(response.data.summary);
    } catch (err) {
      alert("Erro ao resumir o texto.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const exportTranscription = () => {
    if (!result) return;
    const content = showTimestamps 
      ? result.segments.map(s => {
          const mins = Math.floor(s.start / 60).toString().padStart(2, '0');
          const secs = Math.floor(s.start % 60).toString().padStart(2, '0');
          return `(${mins}:${secs}) ${s.text}`;
        }).join('\n')
      : result.text;
      
    const textBlob = new Blob([content], { type: "text/plain" });
    const blobUrl = URL.createObjectURL(textBlob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `transcricao_${file?.name || 'online'}.txt`;
    a.click();
    URL.revokeObjectURL(blobUrl);
    setIsMenuOpen(false);
  };

  const shareTranscription = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.text);
    alert("Texto copiado para a área de transferência!");
    setIsMenuOpen(false);
  };

  const downloadAudio = () => {
    if (file) {
      const blobUrl = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } else if (jobId || (result as any)?.job_id) {
       // Download do áudio processado no backend
       const id = jobId || (result as any)?.job_id;
       const url = `${apiBaseUrl}/jobs/${id}/audio`;
       const a = document.createElement("a");
       a.href = url;
       a.download = `audio_${id}.mp3`;
       a.click();
    } else {
      alert("Erro: ID do trabalho não encontrado para download.");
    }
    setIsMenuOpen(false);
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col items-center pt-20 pb-10 px-4 relative overflow-hidden font-sans">
      {/* Background soft glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/3 w-[800px] h-[500px] bg-indigo-100/50 rounded-full blur-[100px] pointer-events-none" />

      {/* Premium Upgrade Banner */}
      {subscriptionStatus !== "active" && (
        <div className="w-full max-w-4xl bg-gradient-to-r from-amber-500 to-orange-600 text-white px-6 py-3 rounded-2xl flex items-center justify-between gap-4 mb-6 z-10 shadow-sm border border-orange-400/20">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 animate-pulse text-amber-200 shrink-0" />
            <div className="text-left">
              <p className="text-sm font-bold">Aproveite todo o poder da Inteligência Artificial!</p>
              <p className="text-xs text-amber-100 font-medium">Assine o plano Premium por apenas R$ 150,00/ano e libere transcrições ilimitadas e speaker diarization.</p>
            </div>
          </div>
          <button 
            onClick={() => { setCheckoutStep("plans"); setShowUpgradeModal(true); }}
            className="bg-white text-orange-700 hover:bg-amber-50 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
          >
            Fazer Upgrade
          </button>
        </div>
      )}

      {/* Top Navigation / Tab menu */}
      <div className="flex bg-white/80 backdrop-blur-md p-1 border border-gray-100 rounded-full mb-10 z-10 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
      {viewMode === "transcribe" && (
        <button
          onClick={() => { setViewMode("transcribe"); setResult(null); }}
          className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-xs tracking-wider uppercase transition-all duration-200 ${
            viewMode === "transcribe" 
              ? "bg-indigo-600 text-white shadow-sm" 
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          Transcrever
        </button>
      )}
      {viewMode !== "transcribe" && (
        <button
          onClick={() => { setViewMode("transcribe"); setResult(null); }}
          className="flex items-center gap-2 px-6 py-2 rounded-full font-bold text-xs tracking-wider uppercase transition-all duration-200 text-gray-500 hover:text-gray-700"
        >
          <Mic className="w-3.5 h-3.5" />
          Transcrever
        </button>
      )}
        <button
          onClick={() => { setViewMode("history"); loadHistory(); }}
          className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-xs tracking-wider uppercase transition-all duration-200 ${
            viewMode === "history" 
              ? "bg-indigo-600 text-white shadow-sm" 
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Histórico
        </button>
        {subscriptionStatus === "active" && (
          <button
            onClick={() => setViewMode("plan")}
            className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-xs tracking-wider uppercase transition-all duration-200 ${
              viewMode === "plan"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Meu Plano
          </button>
        )}
      </div>

      {viewMode === "transcribe" && (
        isTranscribing ? (
        <div className="w-full max-w-[800px] mt-2 z-10 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-4 px-2">
            <button onClick={() => setIsTranscribing(false)} className="flex items-center gap-2 text-indigo-500 font-[600] text-[13px] hover:text-indigo-600 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
            <div className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-50 transition-colors">
              <span className="flex gap-[2px]">
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              </span>
            </div>
          </div>
          
          <div className="w-full bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8 flex flex-col items-center">
            
            <div className="w-full flex items-center justify-between border-b border-gray-100 pb-5 mb-5">
              <div className="flex items-center gap-3">
                 <div className="p-2.5 bg-[#F6F8FF] text-indigo-600 rounded-xl">
                   <FileAudio className="w-5 h-5" />
                 </div>
                 <div className="h-2 w-48 bg-gray-200 rounded-full overflow-hidden relative">
                   <div className="absolute top-0 left-0 h-full w-1/2 bg-indigo-100 rounded-full animate-[pulse_2s_ease-in-out_infinite]"></div>
                 </div>
              </div>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-1.5 text-gray-400 text-sm font-medium">
                   <Clock className="w-4 h-4" />
                   <div className="h-2 w-12 bg-gray-200 rounded-full overflow-hidden relative">
                     <div className="absolute top-0 left-0 h-full w-2/3 bg-gray-300 rounded-full"></div>
                   </div>
                 </div>
                 <div className="px-3 py-1.5 flex items-center gap-1.5 bg-[#F8FAFF] text-indigo-600 rounded-full border border-indigo-100 text-[12px] font-[700]">
                   <Loader2 className="w-3.5 h-3.5 animate-spin"/> {jobStatus === "processing" ? "Processando..." : "Na fila"}
                 </div>
              </div>
            </div>

            <div className="w-full flex items-center gap-8 border-b border-gray-100 mb-20 px-2 justify-start overflow-x-auto">
               <button className="pb-4 text-[13px] tracking-wide font-bold text-indigo-600 border-b-2 border-indigo-600 whitespace-nowrap relative top-[1px]">Transcrição</button>
               <button className="pb-4 text-[13px] tracking-wide font-semibold text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap">Editar</button>
               <button className="pb-4 text-[13px] tracking-wide font-semibold text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap">Traduzir</button>
               <button className="pb-4 text-[13px] tracking-wide font-semibold text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap">Resumo</button>
            </div>

            <div className="flex flex-col items-center justify-center pt-8 pb-32">
               <div className="w-[88px] h-[88px] bg-[#F8FAFF] rounded-full flex items-center justify-center mb-6 relative border-[6px] border-white shadow-[0_0_0_1px_rgba(99,102,241,0.05)]">
                 <Mic className="w-8 h-8 text-indigo-600" />
                 <div className="absolute top-1 -right-1 p-1.5 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-gray-50 flex items-center justify-center">
                   <MessageSquare className="w-4 h-4 text-indigo-400" />
                 </div>
               </div>
               <h3 className="text-[16px] font-bold text-gray-900 mb-2">Estamos processando sua transcrição...</h3>
               <p className="text-[13px] font-medium text-gray-500">{jobStatus === "processing" ? "Processando..." : "Na fila"}</p>
            </div>
          </div>
        </div>
      ) : !result ? (
        <>
          {/* Header Container */}
          <div className="text-center mb-10 z-10 w-full max-w-4xl px-4">
        <h1 className="text-[28px] sm:text-[32px] md:text-[40px] leading-tight font-bold text-gray-900 mb-3 tracking-tight sm:whitespace-nowrap">
          Transcreva seus áudios e vídeos online
        </h1>
        <p className="text-[15px] text-gray-500 font-medium">
          Transcreva com precisão em apenas alguns segundos.
        </p>
      </div>

      {/* Tab Selector */}
      <div className="flex bg-gray-100/80 p-1.5 rounded-2xl mb-6 z-10">
        <button
          onClick={() => setTab("local")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 min-h-[44px] ${
            tab === "local" 
              ? "bg-white text-indigo-600 shadow-[0_2px_8px_rgb(0,0,0,0.04)]" 
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <CloudUpload className="w-4 h-4" />
          Arquivo local
        </button>
        <button
          onClick={() => setTab("online")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 min-h-[44px] ${
            tab === "online" 
              ? "bg-white text-indigo-600 shadow-[0_2px_8px_rgb(0,0,0,0.04)]" 
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <LinkIcon className="w-4 h-4" />
          Arquivo online
        </button>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-[640px] bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8 z-10">
        
        {/* Upload Area */}
        {tab === "local" ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full border border-dashed border-indigo-200 bg-[#F8FAFF] rounded-xl flex flex-col items-center justify-center py-12 cursor-pointer hover:bg-indigo-50/50 transition-colors mb-8 group min-h-[160px]"
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept="audio/*,video/*"
            />
            <div className="w-12 h-12 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
              <CloudUpload className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-500">
              {file ? <span className="text-indigo-600">{file.name}</span> : "Clique para enviar ou arraste e solte"}
            </p>
          </div>
        ) : (
          <div className="w-full mb-8 text-left">
            <div className="flex items-center gap-2.5 mb-4">
              {/* TikTok */}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.34 2.88 2.88 0 0 1 2.31-4.53 2.66 2.66 0 0 1 1.04.2v-3.57A6.34 6.34 0 0 0 5 12.33a6.32 6.32 0 0 0 12.06 2.72v-4.14a8.13 8.13 0 0 0 4.6 1.48V8.84a4.85 4.85 0 0 1-2.07-.15z"/>
              </svg>
              {/* Twitch */}
              <svg className="w-5 h-5 text-[#9146FF]" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M4.265 3 3 6.236v13.223h5.103V23l3.527-3.541h3.765l5.605-5.6V3H4.265zm2.133 2.158h12.47v9.423l-3 3.01H11.5l-2.43 2.45v-2.45H6.398V5.158zm4.846 6.55v-3.79h1.72v3.79h-1.72zm4.312 0v-3.79h1.71v3.79h-1.71z"/>
              </svg>
              {/* Vimeo */}
              <svg className="w-5 h-5 text-[#1ab7ea]" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.396 7.164c-.093 2.026-1.507 4.8-4.245 8.32C15.322 19.16 12.93 21 11.05 21c-1.214 0-2.24-1.12-3.08-3.36-.56-2.052-1.119-4.1-1.68-6.15-.653-2.332-1.4-3.498-2.238-3.498-.187 0-.793.419-1.82 1.26L1 7.93c1.213-1.12 2.473-2.333 3.778-3.64 1.68-1.68 2.94-2.52 3.78-2.52 1.68 0 2.659 1.259 2.939 3.779.373 3.452.653 5.505.84 6.158.466 2.053 1.026 3.08 1.68 3.08.746 0 1.68-1.074 2.8-3.22 1.119-2.146 1.679-3.732 1.679-4.758 0-1.306-.653-1.96-1.959-1.96-.56 0-1.213.187-1.96.56C15.867 2.892 17.639 1.585 19.505 1.585c2.333 0 3.266 1.866 2.89 5.579z"/>
              </svg>
              {/* Dailymotion */}
              <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M14.93 11.838c-.378-.971-1.233-1.808-2.614-1.808-1.884 0-3.228 1.484-3.228 3.425v.068c0 1.94.978 3.407 3.031 3.407 1.453 0 2.417-.954 2.812-2.138v2.012H18.2V5h-3.27v6.838zm-3.13 3.65c-.886 0-1.385-.756-1.385-1.97v-.068c0-1.219.689-1.96 1.554-1.96 1.036 0 1.564.78 1.564 1.96v.068c0 1.18-.54 1.97-1.734 1.97zM2.872 17.13H0v-3.77A3.633 3.633 0 0 1 3.682 9.7a3.868 3.868 0 0 1 2.864 1.205v-1.16H9.37v7.385H6.498v-3.77c0-1.04-.457-1.547-1.15-1.547-.633 0-1.006.46-1.006 1.239v4.067H2.873z"/>
              </svg>
              {/* Facebook Watch */}
              <svg className="w-5 h-5 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              {/* Kwai */}
              <svg className="w-[1.125rem] h-[1.125rem] text-[#FF5D00]" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zm9.3 5.4a1 1 0 0 0-1.4-1.4L11 11.5 8.1 8.6A1 1 0 0 0 6.7 10l2.9 2.9L6.7 15.8a1 1 0 1 0 1.4 1.4l2.9-2.9 2.9 2.9a1 1 0 0 0 1.4-1.4L12.4 12.9l3.9-3.5z"/>
              </svg>
              {/* Instagram */}
              <svg className="w-5 h-5 text-[#E4405F]" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
              </svg>
            </div>
            
            <p className="text-[13px] font-[600] text-gray-800 mb-6">
              Envie sua gravação colando a URL da plataforma onde ela está hospedada.
            </p>
            
            <div className="mb-2">
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">Link</label>
              <div className="relative flex items-center h-[52px]">
                <Link2 className="absolute left-4 w-4 h-4 text-gray-400 z-10" />
                <input 
                  type="url" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full h-full bg-white border border-indigo-200/80 text-gray-700 text-[14px] rounded-xl pl-11 pr-[100px] outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-medium shadow-[0_2px_10px_rgb(0,0,0,0.02)]"
                />
                <button 
                  onClick={startTranscription}
                  disabled={!url || isTranscribing}
                  className="absolute right-2 px-5 py-2 bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 font-medium text-[13px] rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  Importar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Idioma */}
        <div className="mb-8">
          <label className="block text-[13px] font-semibold text-gray-700 mb-2">Idioma</label>
          <div className="relative">
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full appearance-none bg-white border border-gray-200 text-gray-700 text-[14px] rounded-xl px-4 py-3.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium min-h-[48px]"
            >
              <option value="pt">🇧🇷 Português</option>
              <option value="en">🇺🇸 Inglês</option>
              <option value="es">🇪🇸 Espanhol</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Modo de transcrição - Segmented Control Style */}
        <div className="mb-8">
          <label className="block text-[13px] font-semibold text-gray-700 mb-2">Modo de transcrição</label>
          <div className="flex bg-gray-50/80 p-1.5 rounded-2xl w-full border border-gray-100/50">
            {/* Rapido */}
            <button 
              onClick={() => setTranscribeMode("rapido")}
              className={`flex-1 flex flex-col items-center justify-center text-center py-3 px-2 rounded-xl min-h-[82px] transition-all duration-200 ${
                transcribeMode === "rapido" 
                  ? "bg-white shadow-[0_2px_8px_rgb(0,0,0,0.06)]" 
                  : "hover:bg-gray-100/50"
              }`}
            >
              <Zap className={`w-5 h-5 mb-1.5 ${transcribeMode === "rapido" ? "text-indigo-600" : "text-gray-400"}`} />
              <span className={`text-[12px] font-semibold ${transcribeMode === "rapido" ? "text-indigo-600" : "text-gray-700"}`}>
                Rápido
              </span>
              <span className="text-[10px] text-gray-400/80 mt-0.5 font-medium">(Menos preciso)</span>
            </button>

            {/* Equilibrado */}
            <button 
              onClick={() => setTranscribeMode("equilibrado")}
              className={`flex-1 flex flex-col items-center justify-center text-center py-3 px-2 rounded-xl min-h-[82px] transition-all duration-200 mx-1 ${
                transcribeMode === "equilibrado" 
                  ? "bg-white shadow-[0_2px_8px_rgb(0,0,0,0.06)]" 
                  : "hover:bg-gray-100/50"
              }`}
            >
              <Settings2 className={`w-5 h-5 mb-1.5 ${transcribeMode === "equilibrado" ? "text-indigo-600" : "text-gray-400"}`} />
              <span className={`text-[12px] font-semibold ${transcribeMode === "equilibrado" ? "text-indigo-600" : "text-gray-700"}`}>
                Equilibrado
              </span>
              <span className="text-[10px] text-gray-400/80 mt-0.5 font-medium">(Velocidade e precisão)</span>
            </button>

            {/* Preciso */}
            <button 
              onClick={() => setTranscribeMode("preciso")}
              className={`flex-1 flex flex-col items-center justify-center text-center py-3 px-2 rounded-xl min-h-[82px] transition-all duration-200 ${
                transcribeMode === "preciso" 
                  ? "bg-white shadow-[0_2px_8px_rgb(0,0,0,0.06)]" 
                  : "hover:bg-gray-100/50"
              }`}
            >
              <Target className={`w-5 h-5 mb-1.5 ${transcribeMode === "preciso" ? "text-indigo-600" : "text-gray-400"}`} />
              <span className={`text-[12px] font-semibold ${transcribeMode === "preciso" ? "text-indigo-600" : "text-gray-700"}`}>
                Preciso
              </span>
              <span className="text-[10px] text-gray-400/80 mt-0.5 font-medium">(Mais lento)</span>
            </button>
          </div>
        </div>

        {/* Opções avançadas */}
        <button 
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className={`flex items-center gap-1.5 text-[14px] font-[600] transition-colors mb-6 min-h-[44px] ${isAdvancedOpen ? "text-indigo-500" : "text-gray-700 hover:text-gray-900"}`}
        >
          Opções avançadas
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isAdvancedOpen ? "rotate-180 text-indigo-500" : "text-gray-400"}`} />
        </button>

        {isAdvancedOpen && (
          <div className="mb-8 flex flex-col gap-6">
            {/* Reconhecer falantes */}
            <label className="flex items-start gap-3.5 cursor-pointer group">
              <div className="relative flex items-center justify-center mt-0.5 min-w-[20px] min-h-[20px]">
                <input 
                  type="checkbox" 
                  className="appearance-none w-[20px] h-[20px] border border-gray-200 rounded-[5px] checked:bg-indigo-600 checked:border-indigo-600 transition-colors peer cursor-pointer"
                  checked={recognizeSpeakers}
                  onChange={(e) => setRecognizeSpeakers(e.target.checked)}
                />
                <Check className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" strokeWidth={3} />
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-[600] text-gray-800">Reconhecer falantes</span>
                <span className="text-[13px] text-gray-500 font-medium mt-0.5">Identifica automaticamente cada pessoa que aparece na transcrição.</span>
              </div>
            </label>

            {/* Transcrever para outro idioma */}
            <label className="flex items-start gap-3.5 cursor-pointer group">
              <div className="relative flex items-center justify-center mt-0.5 min-w-[20px] min-h-[20px]">
                <input 
                  type="checkbox" 
                  className="appearance-none w-[20px] h-[20px] border border-gray-200 rounded-[5px] checked:bg-indigo-600 checked:border-indigo-600 transition-colors peer cursor-pointer"
                  checked={translateAudio}
                  onChange={(e) => setTranslateAudio(e.target.checked)}
                />
                <Check className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" strokeWidth={3} />
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-[600] text-gray-800">Transcrever para outro idioma</span>
                <span className="text-[13px] text-gray-500 font-medium mt-0.5">Transcreve o idioma original do áudio diretamente no idioma de destino que você escolher.</span>
              </div>
            </label>

            {/* Restaurar áudio */}
            <label className="flex items-start gap-3.5 cursor-pointer group">
              <div className="relative flex items-center justify-center mt-0.5 min-w-[20px] min-h-[20px]">
                <input 
                  type="checkbox" 
                  className="appearance-none w-[20px] h-[20px] border border-gray-200 rounded-[5px] checked:bg-indigo-600 checked:border-indigo-600 transition-colors peer cursor-pointer"
                  checked={restoreAudio}
                  onChange={(e) => setRestoreAudio(e.target.checked)}
                />
                <Check className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" strokeWidth={3} />
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-[600] text-gray-800">Restaurar áudio</span>
                <span className="text-[13px] text-gray-500 font-medium mt-0.5">Remove ruído de fundo e melhora a nitidez das vozes. Use apenas em gravações de baixa qualidade.</span>
              </div>
            </label>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-center border-t border-gray-100/80 pt-6">
          <button 
            onClick={startTranscription}
            disabled={((tab === "local" && !file) || (tab === "online" && !url)) || isTranscribing}
            className={`min-w-[180px] min-h-[44px] px-8 rounded-lg text-[14px] font-semibold transition-all flex items-center justify-center gap-2 ${
              ((tab === "local" && !file) || (tab === "online" && !url)) || isTranscribing
                ? "bg-[#F3F4F6] text-gray-400 cursor-not-allowed border border-gray-200/50"
                : "bg-[#F3F4F6] text-gray-700 hover:bg-gray-200 shadow-sm"
            }`}
          >
            {isTranscribing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                Transcrevendo...
              </>
            ) : (
              "Transcrever"
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center border border-red-100 font-medium">
            {error}
          </div>
        )}
      </div>

      {/* Footer Text */}
      <div className="mt-6 text-center max-w-lg z-10 px-4">
        <p className="text-[10px] leading-relaxed text-gray-400 font-medium tracking-wide">
          Suporta no máximo 3 uploads simultâneos de arquivos com até 24 horas nos formatos:<br/>
          MP3, MPEG, M4A, AAC, WAV, OGG, OPUS, WMA, MP4, MOV ou WMV.
        </p>
      </div>
      </>
        ) : null
      )}

      {/* History view */}
      {viewMode === "history" && !result && (
        <div className="w-full max-w-[800px] z-10 flex flex-col items-center">
          <div className="text-center mb-10 w-full px-4">
            <h1 className="text-[28px] sm:text-[32px] font-bold text-gray-900 mb-3 tracking-tight">
              Histórico de Transcrições
            </h1>
            <p className="text-[15px] text-gray-500 font-medium">
              Consulte e acesse todas as suas gravações e transcrições anteriores.
            </p>
          </div>

          <div className="w-full bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
            {isLoadingHistory ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="text-sm font-medium text-gray-500">Carregando histórico...</p>
              </div>
            ) : historyJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1">Nenhuma transcrição encontrada</h3>
                <p className="text-sm text-gray-500 max-w-xs">Você ainda não enviou nenhum áudio ou vídeo para transcrição.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {historyJobs.map((job) => {
                  const date = new Date(job.created_at).toLocaleString('pt-BR');
                  const isCompleted = job.status === "completed";
                  const isFailed = job.status === "failed";
                  const isProcessing = job.status === "processing";
                  const isQueued = job.status === "queued";

                  return (
                    <div key={job.job_id} className="p-4 border border-gray-100 rounded-2xl hover:border-indigo-100 hover:bg-[#FDFEFF]/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-xl shrink-0 ${
                          isCompleted ? 'bg-green-50 text-green-600' :
                          isFailed ? 'bg-red-50 text-red-600' :
                          'bg-indigo-50 text-indigo-600'
                        }`}>
                          <FileAudio className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <h4 className="text-sm font-bold text-gray-900 max-w-[280px] sm:max-w-[400px] truncate" title={job.filename}>
                            {job.filename || "Gravação de Áudio"}
                          </h4>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 font-medium">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {date}
                            </span>
                            <span className="truncate max-w-[150px]" title={job.job_id}>ID: {job.job_id.substring(0, 8)}...</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          isCompleted ? 'bg-green-50 text-green-600 border border-green-100' :
                          isFailed ? 'bg-red-50 text-red-600 border border-red-100' :
                          isProcessing ? 'bg-blue-50 text-blue-600 border border-blue-100 animate-pulse' :
                          'bg-yellow-50 text-yellow-600 border border-yellow-100'
                        }`}>
                          {isCompleted ? 'Concluído' :
                           isFailed ? 'Falhou' :
                           isProcessing ? 'Processando' : 'Na Fila'}
                        </span>

                        {isCompleted && (
                          <button
                            onClick={() => handleViewJob(job)}
                            className="px-4 py-2 bg-indigo-50 text-indigo-600 font-bold text-xs rounded-xl hover:bg-indigo-100 transition-colors"
                          >
                            Visualizar
                          </button>
                        )}

                        {isFailed && (
                          <button
                            onClick={() => alert(`Erro: ${job.error || "Erro desconhecido"}`)}
                            className="px-4 py-2 bg-red-50 text-red-600 font-bold text-xs rounded-xl hover:bg-red-100 transition-colors"
                          >
                            Ver Erro
                          </button>
                        )}

                        {(isProcessing || isQueued) && (
                          <span className="text-xs text-gray-400 font-semibold px-2 flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Aguarde...
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result UI (if transcription completed) */}
      {result && !isTranscribing && (
        <div className="w-full max-w-[800px] mt-2 z-10 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-4 px-2">
            <button onClick={() => setResult(null)} className="flex items-center gap-2 text-indigo-500 font-[600] text-[13px] hover:text-indigo-600 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
          </div>
          
          <div className="w-full bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8 flex flex-col">
            
            {/* Header info */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <FileAudio className="w-6 h-6 text-indigo-600" />
                <h2 className="text-[18px] font-bold text-gray-900">
                  {file?.name || url || "Transcrição de Áudio"} {result.segments.length > 0 && result.segments[result.segments.length-1] ? `- ${Math.ceil(result.segments[result.segments.length-1]!.end / 60)}m` : ''}
                </h2>
              </div>
              <div className="relative">
                <div 
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="w-8 h-8 flex items-center justify-center text-gray-500 bg-gray-50 border border-gray-100 cursor-pointer hover:bg-gray-100 hover:text-indigo-600 transition-colors rounded-[8px]"
                >
                  <span className="flex gap-[3.5px] flex-col">
                    <div className="w-[3px] h-[3px] bg-current rounded-full"></div>
                    <div className="w-[3px] h-[3px] bg-current rounded-full"></div>
                    <div className="w-[3px] h-[3px] bg-current rounded-full"></div>
                  </span>
                </div>
                
                {isMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
                    <div className="absolute top-10 right-0 w-[220px] bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 py-2 z-20 flex flex-col">
                      <div 
                        onClick={() => {setShowTimestamps(!showTimestamps); setIsMenuOpen(false);}}
                        className="px-4 py-2.5 mx-2 my-1 bg-indigo-50/80 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-indigo-100/80 transition-colors"
                      >
                        <div className={`w-4 h-4 rounded-[4px] flex items-center justify-center ${showTimestamps ? 'bg-indigo-500 text-white' : 'border border-indigo-200 bg-white'}`}>
                          {showTimestamps && <Check className="w-3" strokeWidth={3} />}
                        </div>
                        <span className="text-[13px] font-[600] text-indigo-600">Marcas de tempo</span>
                      </div>
                      <div className="h-[1px] bg-gray-100 mx-4 my-1"></div>
                      <button onClick={exportTranscription} className="px-5 py-2.5 flex items-center gap-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors w-full text-left">
                         <FileText className="w-[18px] h-[18px] text-gray-500" /> Exportar
                      </button>
                      <button onClick={shareTranscription} className="px-5 py-2.5 flex items-center gap-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors w-full text-left">
                         <Share2 className="w-[18px] h-[18px] text-gray-500" /> Compartilhar
                      </button>
                      <button onClick={downloadAudio} className="px-5 py-2.5 flex items-center gap-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors w-full text-left">
                         <Download className="w-[18px] h-[18px] text-gray-500" /> Baixar áudio
                      </button>
                      <button onClick={() => {alert("Mock: Renomear arquivo"); setIsMenuOpen(false);}} className="px-5 py-2.5 flex items-center gap-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors w-full text-left">
                         <Edit2 className="w-[18px] h-[18px] text-gray-500" /> Renomear
                      </button>
                      <button onClick={() => {alert("Mock: Mover para pasta"); setIsMenuOpen(false);}} className="px-5 py-2.5 flex items-center gap-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors w-full text-left">
                         <FolderInput className="w-[18px] h-[18px] text-gray-500" /> Mover para a pasta
                      </button>
                      <div className="h-[1px] bg-gray-100 mx-4 my-1"></div>
                      <button 
                        onClick={() => {setResult(null); setFile(null); setUrl(""); setIsMenuOpen(false);}} 
                        className="px-5 py-2.5 flex items-center gap-3 text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                      >
                         <Trash2 className="w-[18px] h-[18px] text-red-500" /> Excluir
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center gap-1.5 text-gray-500 text-[13px] font-medium">
                <Calendar className="w-4 h-4" />
                {new Date().toLocaleDateString('pt-BR')}
              </div>
              <div className="flex items-center gap-1.5 text-gray-500 text-[13px] font-medium">
                <Clock className="w-4 h-4" />
                {result.segments.length > 0 && result.segments[result.segments.length-1] ? new Date(result.segments[result.segments.length-1]!.end * 1000).toISOString().substr(11, 8) : '00:00:00'}
              </div>
              <div className="flex items-center gap-1.5 text-indigo-600 text-[13px] font-bold">
                <CheckCircle2 className="w-4 h-4" />
                Concluído
              </div>
            </div>

            <div className="w-full flex items-center gap-8 border-b border-gray-100 mb-8 px-2 justify-start overflow-x-auto custom-scrollbar">
               <button onClick={() => setActiveResultTab("transcricao")} className={`pb-4 text-[13px] tracking-wide font-semibold whitespace-nowrap transition-colors relative top-[1px] border-b-2 ${activeResultTab === "transcricao" ? "text-indigo-600 border-indigo-600 font-bold" : "text-gray-400 border-transparent hover:text-gray-600 hover:border-gray-200"}`}>Transcrição</button>
               <button onClick={() => { setActiveResultTab("editar"); setEditedText(result.text); }} className={`pb-4 text-[13px] tracking-wide font-semibold whitespace-nowrap transition-colors relative top-[1px] border-b-2 ${activeResultTab === "editar" ? "text-indigo-600 border-indigo-600 font-bold" : "text-gray-400 border-transparent hover:text-gray-600 hover:border-gray-200"}`}>Editar</button>
               <button onClick={() => setActiveResultTab("traduzir")} className={`pb-4 text-[13px] tracking-wide font-semibold whitespace-nowrap transition-colors relative top-[1px] border-b-2 ${activeResultTab === "traduzir" ? "text-indigo-600 border-indigo-600 font-bold" : "text-gray-400 border-transparent hover:text-gray-600 hover:border-gray-200"}`}>Traduzir</button>
               <button onClick={() => setActiveResultTab("resumo")} className={`pb-4 text-[13px] tracking-wide font-semibold whitespace-nowrap transition-colors relative top-[1px] border-b-2 ${activeResultTab === "resumo" ? "text-indigo-600 border-indigo-600 font-bold" : "text-gray-400 border-transparent hover:text-gray-600 hover:border-gray-200"}`}>Resumo</button>
            </div>

            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
              {activeResultTab === "transcricao" && (
                result.segments.map((segment, idx) => {
                  const mins = Math.floor(segment.start / 60).toString().padStart(2, '0');
                  const secs = Math.floor(segment.start % 60).toString().padStart(2, '0');
                  const isActive = isPlaying && currentTime >= segment.start - 0.2 && currentTime <= segment.end + 0.2;
                  return (
                    <div 
                      key={idx} 
                      onClick={() => {
                        if (audioRef.current && activeResultTab === "transcricao") {
                          audioRef.current.currentTime = segment.start;
                          audioRef.current.play();
                          setIsPlaying(true);
                        }
                      }}
                      className={`flex gap-3 text-[14px] p-2.5 rounded-xl cursor-pointer transition-colors ${isActive ? 'bg-indigo-50' : 'hover:bg-gray-50/50'}`}
                    >
                      {showTimestamps && (
                        <span className={`font-semibold shrink-0 transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>
                          ({mins}:{secs})
                        </span>
                      )}
                      <p className={`font-medium leading-relaxed transition-colors ${isActive ? 'text-indigo-900 font-bold' : 'text-[#64748b]'}`}>
                        {segment.text}
                      </p>
                    </div>
                  );
                })
              )}

              {activeResultTab === "editar" && (
                <div className="flex flex-col gap-4">
                  <textarea 
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="w-full h-[300px] p-4 text-[14px] text-gray-700 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none resize-none custom-scrollbar leading-relaxed"
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={() => { 
                        if (result) {
                          setResult({
                            ...result, 
                            text: editedText, 
                            segments: [{
                              text: editedText, 
                              start: 0, 
                              end: result.segments.length > 0 ? (result.segments[result.segments.length-1]?.end ?? 0) : 0, 
                              speaker: result.segments.length > 0 ? (result.segments[result.segments.length-1]?.speaker ?? "") : ""
                            }]
                          }); 
                          setActiveResultTab("transcricao"); 
                        }
                      }}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-[13px] font-semibold hover:bg-indigo-700 transition"
                    >
                      Salvar Edições
                    </button>
                  </div>
                </div>
              )}

              {activeResultTab === "traduzir" && (
                <div className="flex flex-col items-center justify-center py-10 w-full">
                   {!translatedText ? (
                     <div className="w-full max-w-sm flex flex-col items-center gap-4">
                        <select 
                          value={targetTranslationLanguage}
                          onChange={(e) => setTargetTranslationLanguage(e.target.value)}
                          className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        >
                          <option value="en">Inglês</option>
                          <option value="es">Espanhol</option>
                          <option value="fr">Francês</option>
                          <option value="de">Alemão</option>
                          <option value="it">Italiano</option>
                        </select>
                        <button 
                          onClick={handleTranslation}
                          disabled={isProcessingAction}
                          className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700 transition disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                          {isProcessingAction && <Loader2 className="w-4 h-4 animate-spin" />}
                          Traduzir Texto
                        </button>
                     </div>
                   ) : (
                     <div className="w-full text-left">
                       <p className="text-[14px] text-[#64748b] font-medium leading-relaxed whitespace-pre-wrap">{translatedText}</p>
                       <button onClick={() => setTranslatedText("")} className="mt-6 text-indigo-600 text-sm font-semibold hover:underline">Traduzir para outro idioma</button>
                     </div>
                   )}
                </div>
              )}

              {activeResultTab === "resumo" && (
                <div className="flex flex-col items-center justify-center py-10 w-full">
                   {!summaryText ? (
                     <div className="w-full max-w-sm flex flex-col items-center gap-4">
                        <p className="text-sm text-gray-500 text-center mb-2">Gere um resumo inteligente do conteúdo transcrito.</p>
                        <button 
                          onClick={handleSummarize}
                          disabled={isProcessingAction}
                          className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700 transition disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                          {isProcessingAction && <Loader2 className="w-4 h-4 animate-spin" />}
                          Gerar Resumo
                        </button>
                     </div>
                   ) : (
                     <div className="w-full text-left">
                       <h4 className="text-gray-900 font-bold mb-3">Pontos Principais:</h4>
                       <p className="text-[14px] text-[#64748b] font-medium leading-relaxed whitespace-pre-wrap">{summaryText}</p>
                     </div>
                   )}
                </div>
              )}
            </div>

            {/* Audio Player Footer */}
            {audioUrl && (
              <div className="w-full mt-6 pt-5 border-t border-gray-100 flex items-center gap-4 bg-white sticky bottom-0 z-20 pb-2">
                <audio 
                  ref={audioRef} 
                  src={audioUrl} 
                  onTimeUpdate={handleTimeUpdate} 
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                />
                
                <button 
                  onClick={togglePlayPause}
                  className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-sm shrink-0"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>

                <div className="flex-1 flex items-center gap-4">
                  <span className="text-[11px] font-[700] text-gray-400 w-10 text-right shrink-0">
                    {Math.floor(currentTime / 60).toString().padStart(2, '0')}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
                  </span>
                  
                  <input 
                    type="range" 
                    min={0} 
                    max={duration || 100} 
                    value={currentTime} 
                    onChange={handleSeek}
                    style={{ background: `linear-gradient(to right, #4f46e5 ${(currentTime / (duration || 100)) * 100}%, #e5e7eb ${(currentTime / (duration || 100)) * 100}%)` }}
                    className="w-full h-1.5 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:rounded-full cursor-pointer hover:[&::-webkit-slider-thumb]:scale-110 transition-transform"
                  />
                  
                  <span className="text-[11px] font-[700] text-gray-400 w-10 shrink-0">
                    {Math.floor(duration / 60).toString().padStart(2, '0')}:{Math.floor(duration % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                <div className="flex items-center gap-4 shrink-0 pl-2 relative">
                  <div className="flex items-center gap-2 group">
                    <button onClick={toggleMute} className="text-gray-400 hover:text-indigo-600 transition">
                      {isMuted || volume === 0 ? <VolumeX className="w-[18px] h-[18px]" /> : <Volume2 className="w-[18px] h-[18px]" />}
                    </button>
                    <input 
                      type="range" 
                      min={0} 
                      max={1} 
                      step={0.01}
                      value={isMuted ? 0 : volume} 
                      onChange={handleVolumeChange}
                      style={{ background: `linear-gradient(to right, #4f46e5 ${(isMuted ? 0 : volume) * 100}%, #e5e7eb ${(isMuted ? 0 : volume) * 100}%)` }}
                      className="w-16 h-1.5 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:rounded-full cursor-pointer hover:[&::-webkit-slider-thumb]:scale-110 transition-transform"
                    />
                  </div>
                  <button 
                    onClick={() => setShowSettings(!showSettings)}
                    className={`transition ${showSettings ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-600'}`}
                  >
                    <Settings2 className="w-[18px] h-[18px]" />
                  </button>

                  {/* Settings Popup */}
                  {showSettings && (
                    <div className="absolute bottom-full right-0 mb-4 w-[340px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 p-5 flex flex-col z-30">
                      <h4 className="text-center text-[13px] font-[600] text-gray-800 mb-1">Velocidade</h4>
                      <p className="text-center text-[15px] font-bold text-indigo-600 mb-5">{playbackRate.toFixed(2)}x</p>
                      
                      <div className="flex items-center gap-3 mb-6">
                        <button 
                          onClick={() => changePlaybackRate(playbackRate - 0.25)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition shrink-0"
                        >-</button>
                        <input 
                          type="range" 
                          min={0.5} 
                          max={3.0} 
                          step={0.05}
                          value={playbackRate} 
                          onChange={(e) => changePlaybackRate(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-gray-200 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:rounded-full cursor-pointer hover:[&::-webkit-slider-thumb]:scale-110 transition-transform"
                        />
                        <button 
                          onClick={() => changePlaybackRate(playbackRate + 0.25)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition shrink-0"
                        >+</button>
                      </div>

                      <div className="w-full flex items-center justify-between bg-gray-50 p-1.5 rounded-xl">
                        {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 3.0].map(rate => (
                          <button 
                            key={rate}
                            onClick={() => changePlaybackRate(rate)}
                            className={`flex flex-1 items-center justify-center text-[11px] font-bold py-1.5 rounded-lg transition-colors ${playbackRate === rate ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                          >
                            {rate.toString()}{Number.isInteger(rate) ? '.0' : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Appmax Premium Checkout Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-300 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white w-full max-w-[540px] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 overflow-hidden flex flex-col max-h-[90vh] transition-transform duration-300 scale-100 animate-[scaleUp_0.3s_ease-out]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-amber-50/35">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500 animate-pulse" />
                <h3 className="text-base font-bold text-gray-900">
                  {checkoutStep === "plans" && "Escolha seu Plano"}
                  {checkoutStep === "form" && "Dados de Pagamento"}
                  {checkoutStep === "pix" && "Pagamento via Pix"}
                  {checkoutStep === "boleto" && "Pagamento via Boleto"}
                  {checkoutStep === "success" && "Parabéns! Conta Premium"}
                </h3>
              </div>
              <button 
                onClick={() => { setShowUpgradeModal(false); setCheckoutStep("plans"); setCheckoutError(null); }}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              
              {/* Step: PLANS */}
              {checkoutStep === "plans" && (
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-amber-100/50 text-amber-500 rounded-full flex items-center justify-center mb-5 border border-amber-200/20">
                    <Zap className="w-8 h-8 fill-current" />
                  </div>
                  <h4 className="text-[20px] font-black text-gray-900 mb-1">Whisper Transcriber Premium</h4>
                  <p className="text-xs text-gray-500 font-medium mb-6">Acesso ilimitado à inteligência artificial de transcrição mais precisa do mundo.</p>
                  
                  {/* Pricing Card */}
                  <div className="w-full bg-[#FBFDFF] border border-indigo-100/80 rounded-2xl p-6 mb-6 shadow-[0_4px_15px_rgba(99,102,241,0.02)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">Melhor Valor</div>
                    <span className="text-[13px] font-bold text-indigo-500 uppercase tracking-wider">Plano Anual</span>
                    <div className="flex items-baseline justify-center gap-1.5 mt-2 mb-4">
                      <span className="text-gray-400 text-sm font-semibold">R$</span>
                      <span className="text-[36px] font-black text-gray-900 tracking-tight">150,00</span>
                      <span className="text-gray-400 text-xs font-semibold">/ ano</span>
                    </div>
                    
                    <div className="border-t border-gray-100 pt-4 space-y-3.5 text-left text-xs font-medium text-gray-600">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4.5 h-4.5 text-green-500 shrink-0" />
                        <span>Transcrições ilimitadas sem restrição de minutos</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4.5 h-4.5 text-green-500 shrink-0" />
                        <span>Reconhecimento de falantes (Speaker Diarization)</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4.5 h-4.5 text-green-500 shrink-0" />
                        <span>Tradução simultânea e restauração de áudio</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4.5 h-4.5 text-green-500 shrink-0" />
                        <span>Suporte premium e maior velocidade de fila</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setCheckoutStep("form")}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm rounded-xl shadow-md hover:from-amber-600 hover:to-orange-600 transition-all flex items-center justify-center gap-2"
                  >
                    Quero Assinar Premium
                  </button>
                </div>
              )}

              {/* Step: FORM & CHECKOUT */}
              {checkoutStep === "form" && (
                <form onSubmit={handleCheckoutSubmit} className="space-y-6 text-left">
                  
                  {/* Dados Pessoais */}
                  <div className="space-y-4">
                    <h5 className="text-[13px] font-bold text-gray-800 border-l-2 border-indigo-500 pl-2">Identificação</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Nome</label>
                        <input 
                          type="text" 
                          required
                          value={checkoutForm.first_name}
                          onChange={(e) => setCheckoutForm({...checkoutForm, first_name: e.target.value})}
                          placeholder="Marcus"
                          className="w-full bg-[#F8FAFC] border border-gray-200 rounded-xl px-4 py-3 text-[13px] font-medium outline-none focus:border-indigo-400 focus:bg-white transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Sobrenome</label>
                        <input 
                          type="text" 
                          required
                          value={checkoutForm.last_name}
                          onChange={(e) => setCheckoutForm({...checkoutForm, last_name: e.target.value})}
                          placeholder="Pereira"
                          className="w-full bg-[#F8FAFC] border border-gray-200 rounded-xl px-4 py-3 text-[13px] font-medium outline-none focus:border-indigo-400 focus:bg-white transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">CPF / CNPJ</label>
                        <input 
                          type="text" 
                          required
                          value={checkoutForm.document_number}
                          onChange={(e) => setCheckoutForm({...checkoutForm, document_number: e.target.value})}
                          placeholder="Somente números"
                          className="w-full bg-[#F8FAFC] border border-gray-200 rounded-xl px-4 py-3 text-[13px] font-medium outline-none focus:border-indigo-400 focus:bg-white transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Celular</label>
                        <input 
                          type="tel" 
                          required
                          value={checkoutForm.phone}
                          onChange={(e) => setCheckoutForm({...checkoutForm, phone: e.target.value})}
                          placeholder="DDD + Número (Max 11)"
                          className="w-full bg-[#F8FAFC] border border-gray-200 rounded-xl px-4 py-3 text-[13px] font-medium outline-none focus:border-indigo-400 focus:bg-white transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">E-mail</label>
                      <input 
                        type="email" 
                        required
                        value={checkoutForm.email}
                        onChange={(e) => setCheckoutForm({...checkoutForm, email: e.target.value})}
                        placeholder="seu.email@exemplo.com"
                        className="w-full bg-[#F8FAFC] border border-gray-200 rounded-xl px-4 py-3 text-[13px] font-medium outline-none focus:border-indigo-400 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Método de Pagamento */}
                  <div className="space-y-4">
                    <h5 className="text-[13px] font-bold text-gray-800 border-l-2 border-indigo-500 pl-2">Forma de Pagamento</h5>
                    
                    <div className="grid grid-cols-3 gap-3">
                      {/* Cartão de Crédito */}
                      <button 
                        type="button"
                        onClick={() => setCheckoutForm({...checkoutForm, payment_method: "credit_card"})}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${checkoutForm.payment_method === "credit_card" ? "border-indigo-500 bg-indigo-50/20 text-indigo-600 font-bold" : "border-gray-100 hover:bg-gray-50 text-gray-500"}`}
                      >
                        <svg className="w-5 h-5 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x={2} y={5} width={20} height={14} rx={2} /><line x1={2} y1={10} x2={22} y2={10} /></svg>
                        <span className="text-[10px] tracking-wide">Cartão</span>
                      </button>

                      {/* Pix */}
                      <button 
                        type="button"
                        onClick={() => setCheckoutForm({...checkoutForm, payment_method: "pix"})}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${checkoutForm.payment_method === "pix" ? "border-indigo-500 bg-indigo-50/20 text-indigo-600 font-bold" : "border-gray-100 hover:bg-gray-50 text-gray-500"}`}
                      >
                        <Zap className="w-5 h-5 mb-1" />
                        <span className="text-[10px] tracking-wide">Pix</span>
                      </button>

                      {/* Boleto */}
                      <button 
                        type="button"
                        onClick={() => setCheckoutForm({...checkoutForm, payment_method: "boleto"})}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${checkoutForm.payment_method === "boleto" ? "border-indigo-500 bg-indigo-50/20 text-indigo-600 font-bold" : "border-gray-100 hover:bg-gray-50 text-gray-500"}`}
                      >
                        <FileText className="w-5 h-5 mb-1" />
                        <span className="text-[10px] tracking-wide">Boleto</span>
                      </button>
                    </div>

                    {/* Credit Card Inputs */}
                    {checkoutForm.payment_method === "credit_card" && (
                      <div className="space-y-4 bg-gray-50 p-4 rounded-2xl border border-gray-100/50 mt-3 transition-all">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Número do Cartão</label>
                          <input 
                            type="text" 
                            required
                            value={checkoutForm.card_number}
                            onChange={(e) => setCheckoutForm({...checkoutForm, card_number: e.target.value})}
                            placeholder="4444 2222 2222 2222"
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[12px] font-medium outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Nome impresso no Cartão</label>
                          <input 
                            type="text" 
                            required
                            value={checkoutForm.card_holder_name}
                            onChange={(e) => setCheckoutForm({...checkoutForm, card_holder_name: e.target.value})}
                            placeholder="MARCUS PEREIRA"
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[12px] font-medium outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Mês</label>
                            <input 
                              type="text" 
                              required
                              value={checkoutForm.card_exp_month}
                              onChange={(e) => setCheckoutForm({...checkoutForm, card_exp_month: e.target.value})}
                              placeholder="MM"
                              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[12px] font-medium text-center outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Ano</label>
                            <input 
                              type="text" 
                              required
                              value={checkoutForm.card_exp_year}
                              onChange={(e) => setCheckoutForm({...checkoutForm, card_exp_year: e.target.value})}
                              placeholder="AA"
                              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[12px] font-medium text-center outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">CVV</label>
                            <input 
                              type="text" 
                              required
                              value={checkoutForm.card_cvv}
                              onChange={(e) => setCheckoutForm({...checkoutForm, card_cvv: e.target.value})}
                              placeholder="123"
                              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[12px] font-medium text-center outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {checkoutError && (
                    <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-xl border border-red-100 text-center">
                      {checkoutError}
                    </div>
                  )}

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setCheckoutStep("plans")}
                      className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs rounded-xl transition-all"
                    >
                      Voltar
                    </button>
                    <button 
                      type="submit"
                      disabled={isCheckingOut}
                      className="flex-[2] py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      {isCheckingOut ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        `Pagar R$ 150,00`
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Step: PIX */}
              {checkoutStep === "pix" && checkoutResult && (
                <div className="flex flex-col items-center text-center">
                  <div className="bg-green-50 text-green-500 p-2.5 rounded-full border border-green-200/20 mb-5">
                    <Check className="w-6 h-6" strokeWidth={3} />
                  </div>
                  <h4 className="text-[18px] font-black text-gray-900 mb-1">Pedido Gerado com Sucesso!</h4>
                  <p className="text-xs text-gray-500 font-medium mb-6">Pague via Pix para ativação imediata da sua conta premium.</p>
                  
                  {/* QR Code */}
                  {checkoutResult.response_data?.pix_image && (
                    <div className="w-[180px] h-[180px] bg-white border border-gray-100 rounded-2xl p-2.5 shadow-sm mb-5 flex items-center justify-center">
                      <img 
                        src={`data:image/png;base64,${checkoutResult.response_data.pix_image}`} 
                        alt="QR Code Pix Appmax" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}

                  {/* Timer */}
                  <div className="flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl px-4 py-2 text-xs font-semibold mb-6">
                    <Clock className="w-4 h-4 animate-pulse" />
                    <span>Expira em: {Math.floor(pixTimer / 60)}:{(pixTimer % 60).toString().padStart(2, '0')}</span>
                  </div>

                  {/* EMV Copia e Cola */}
                  {checkoutResult.response_data?.pix_code && (
                    <div className="w-full mb-6">
                      <label className="block text-[10px] font-bold text-gray-400 text-left uppercase mb-1.5 pl-1">Código Pix Copia e Cola</label>
                      <div className="flex bg-gray-50 border border-gray-100 rounded-xl p-2.5 items-center justify-between gap-3">
                        <span className="text-[11px] font-mono text-gray-500 truncate text-left flex-1 select-all">{checkoutResult.response_data.pix_code}</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(checkoutResult.response_data.pix_code);
                            alert("Código Pix copiado!");
                          }}
                          className="bg-white hover:bg-gray-100 text-indigo-600 border border-gray-200 px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm shrink-0 transition-colors"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={() => { setShowUpgradeModal(false); setCheckoutStep("plans"); }}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                  >
                    Fechar e Conferir Status
                  </button>
                </div>
              )}

              {/* Step: BOLETO */}
              {checkoutStep === "boleto" && checkoutResult && (
                <div className="flex flex-col items-center text-center">
                  <div className="bg-green-50 text-green-500 p-2.5 rounded-full border border-green-200/20 mb-5">
                    <Check className="w-6 h-6" strokeWidth={3} />
                  </div>
                  <h4 className="text-[18px] font-black text-gray-900 mb-1">Pedido Gerado com Sucesso!</h4>
                  <p className="text-xs text-gray-500 font-medium mb-6">Realize o pagamento do boleto bancário abaixo.</p>
                  
                  {checkoutResult.response_data?.digitable_line && (
                    <div className="w-full mb-6 text-left bg-gray-50 p-4 border border-gray-100 rounded-2xl">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Linha Digitável</label>
                      <p className="text-[12px] font-mono font-semibold text-gray-600 break-all select-all mb-3">{checkoutResult.response_data.digitable_line}</p>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(checkoutResult.response_data.digitable_line);
                          alert("Linha digitável copiada!");
                        }}
                        className="bg-white hover:bg-gray-100 text-indigo-600 border border-gray-200 px-4 py-2 rounded-xl text-[10px] font-bold shadow-sm transition-colors"
                      >
                        Copiar Linha Digitável
                      </button>
                    </div>
                  )}

                  {checkoutResult.response_data?.pdf_url && (
                    <a 
                      href={checkoutResult.response_data.pdf_url} 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs rounded-xl shadow-md hover:from-amber-600 hover:to-orange-600 transition-all flex items-center justify-center gap-2 mb-6"
                    >
                      <Download className="w-4.5 h-4.5" />
                      Visualizar Boleto PDF
                    </a>
                  )}

                  <button 
                    onClick={() => { setShowUpgradeModal(false); setCheckoutStep("plans"); }}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                  >
                    Concluir e Voltar
                  </button>
                </div>
              )}

              {/* Step: SUCCESS */}
              {checkoutStep === "success" && (
                <div className="flex flex-col items-center text-center py-4">
                  <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center border border-green-200/20 mb-5 relative">
                    <Check className="w-8 h-8" strokeWidth={3} />
                    <span className="absolute -top-1 -right-1 text-lg animate-bounce">🎉</span>
                  </div>
                  <h4 className="text-[20px] font-black text-gray-900 mb-1">Upgrade Concluído!</h4>
                  <p className="text-xs text-gray-500 font-medium mb-6">Sua assinatura Premium anual está ativa e liberada.</p>

                  <div className="bg-indigo-50/20 border border-indigo-100 rounded-2xl p-5 mb-4 w-full text-left space-y-2.5">
                    <p className="text-xs text-gray-700 font-bold">Resumo da Assinatura:</p>
                    <div className="flex justify-between text-xs font-semibold text-gray-500">
                      <span>Plano</span>
                      <span className="text-indigo-600">Premium Anual</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-gray-500">
                      <span>Valor</span>
                      <span>R$ 150,00 / ano</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-gray-500">
                      <span>Válido até</span>
                      <span className="text-gray-800 font-bold">
                        {subscriptionData?.expires_at ? formatDate(subscriptionData.expires_at) : formatDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString())}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-gray-500">
                      <span>Status</span>
                      <span className="text-green-500">Ativo</span>
                    </div>
                  </div>

                  <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-2.5">
                    <span className="text-base">✉️</span>
                    <p className="text-xs text-amber-800 font-semibold text-left">
                      Um e-mail de boas-vindas foi enviado com os detalhes da sua assinatura.
                    </p>
                  </div>

                  <button
                    onClick={() => { setShowUpgradeModal(false); setCheckoutStep("plans"); }}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                  >
                    Começar a Transcrever
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── Meu Plano View ── */}
      {viewMode === "plan" && (
        <div className="w-full max-w-[540px] z-10 animate-[fadeIn_0.2s_ease-out]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">Meu Plano</h2>
              <p className="text-xs text-gray-500 font-medium">Gerencie sua assinatura Premium</p>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6 mb-4">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-gray-900">Premium Anual</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  subscriptionData?.status === "active" ? "bg-green-100 text-green-700"
                  : subscriptionData?.status === "cancelled" ? "bg-red-100 text-red-600"
                  : "bg-gray-100 text-gray-500"
                }`}>
                  {subscriptionData?.status === "active" ? "● Ativo" : subscriptionData?.status === "cancelled" ? "Cancelado" : "Inativo"}
                </span>
              </div>
              <span className="text-xs font-bold text-indigo-600">R$ 150,00 / ano</span>
            </div>
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 font-medium">Válido até</span>
                <span className="text-gray-900 font-bold">{subscriptionData?.expires_at ? formatDate(subscriptionData.expires_at) : "—"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 font-medium">Criado em</span>
                <span className="text-gray-700 font-semibold">{subscriptionData?.created_at ? formatDate(subscriptionData.created_at) : "—"}</span>
              </div>
              {subscriptionData?.last_order_id && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 font-medium">Pedido</span>
                  <span className="text-gray-500 font-mono text-xs truncate max-w-[180px]">{subscriptionData.last_order_id}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-5 mb-4">
            <p className="text-xs font-bold text-indigo-700 mb-3 uppercase tracking-wider">Incluído no seu plano</p>
            <div className="space-y-2">
              {["Transcrições ilimitadas", "Reconhecimento de falantes", "Tradução simultânea", "Restauração de áudio", "Suporte premium"].map(f => (
                <div key={f} className="flex items-center gap-2 text-xs text-gray-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>

          {subscriptionData?.status === "active" && (
            <button
              onClick={() => { setShowCancelModal(true); setCancelStep("confirm"); setCancelError(null); }}
              className="w-full py-3 border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 font-semibold text-xs rounded-xl transition-all"
            >
              Cancelar assinatura
            </button>
          )}

          {subscriptionData?.status === "cancelled" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-xs text-amber-800 font-semibold mb-3">Sua assinatura foi cancelada. Você ainda tem acesso até a data de expiração.</p>
              <button onClick={() => { setCheckoutStep("plans"); setShowUpgradeModal(true); }} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-all">
                Reativar Plano
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Cancel Subscription Modal ── */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white w-full max-w-[420px] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.18)] border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Cancelar assinatura</h3>
              <button onClick={() => setShowCancelModal(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors">✕</button>
            </div>
            <div className="p-6">
              {cancelStep === "confirm" && (
                <div className="text-center">
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">😢</span>
                  </div>
                  <h4 className="text-base font-bold text-gray-900 mb-2">Tem certeza?</h4>
                  <p className="text-xs text-gray-500 font-medium mb-5">
                    Ao cancelar, você perde acesso às transcrições ilimitadas e todos os recursos Premium.
                    Seu acesso continua até <strong className="text-gray-800">{subscriptionData?.expires_at ? formatDate(subscriptionData.expires_at) : "o fim do período"}</strong>.
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
                    <p className="text-xs text-amber-800 font-semibold">💡 Você não será reembolsado pelo período restante.</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowCancelModal(false)} className="flex-1 py-3 border border-gray-200 text-gray-600 font-semibold text-xs rounded-xl hover:bg-gray-50 transition-all">Manter Premium</button>
                    <button onClick={() => setCancelStep("final")} className="flex-1 py-3 border border-red-200 text-red-500 font-semibold text-xs rounded-xl hover:bg-red-50 transition-all">Sim, cancelar</button>
                  </div>
                </div>
              )}
              {cancelStep === "final" && (
                <div className="text-center">
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-6 h-6 text-red-500" />
                  </div>
                  <h4 className="text-base font-bold text-gray-900 mb-2">Confirmação final</h4>
                  <p className="text-xs text-gray-500 font-medium mb-5">Esta ação não pode ser desfeita. Sua assinatura será cancelada imediatamente.</p>
                  {cancelError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                      <p className="text-xs text-red-600 font-semibold">{cancelError}</p>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => setCancelStep("confirm")} disabled={isCancelling} className="flex-1 py-3 border border-gray-200 text-gray-600 font-semibold text-xs rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50">Voltar</button>
                    <button
                      onClick={handleCancelSubscription}
                      disabled={isCancelling}
                      className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isCancelling ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cancelando...</> : "Cancelar definitivamente"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
