"use client";

import React, { useState, useRef } from "react";
import { createClient } from "../utils/supabase/client";
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
  MoreHorizontal,
  Copy,
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
  Folder,
  FolderPlus,
  FolderInput,
  Trash2,
  FileText,
  AudioLines,
  User,
  Shield,
  X,
  CreditCard,
  Users,
  HelpCircle,
  LogOut
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
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);

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
  const [viewMode, setViewMode] = useState<"transcribe" | "history" | "plan" | "pricing" | "faq">("transcribe");
  const [historyJobs, setHistoryJobs] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Folders State
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all"); // "all", "root", or specific folder ID
  const [selectedFolderUploadId, setSelectedFolderUploadId] = useState<string>(""); // folder ID to upload to
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

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
  const [isInstantCheckingOut, setIsInstantCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<any>(null);
  const [pixTimer, setPixTimer] = useState<number>(600); // 10 minutes (600s) for Pix
  const [expandedFaqs, setExpandedFaqs] = useState<number[]>([0, 1, 2, 3]); // Initial all open
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState<boolean>(false);
  const [user, setUser] = useState<any>(null);

  // New SaaS Modules & Tab Navigation State
  const [activeTab, setActiveTab] = useState<"transcriptions" | "billing" | "users" | "settings" | "contact">("transcriptions");
  const [workspaceName, setWorkspaceName] = useState("Meu Workspace");
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInvitingMember, setIsInvitingMember] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Profile Edit & Workspace Naming
  const [profileName, setProfileName] = useState("");
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  // Support Form
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState<string | null>(null);

  // Modal Upload Dialog Trigger
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Configurações Gerais Sub-Tabs & Detailed Inputs
  const [settingsSubTab, setSettingsSubTab] = useState<"gerais" | "fiscais">("gerais");
  const [profileFirstName, setProfileFirstName] = useState("Marcus");
  const [profileLastName, setProfileLastName] = useState("Pereira");
  const [profilePhoneArea, setProfilePhoneArea] = useState("34");
  const [profilePhoneNumber, setProfilePhoneNumber] = useState("6555123");
  const [profilePassword, setProfilePassword] = useState("********");
  const [profileLanguage, setProfileLanguage] = useState("pt");
  const [profileTimezone, setProfileTimezone] = useState("GMT+01:00");
  const [profileDateFormat, setProfileDateFormat] = useState("DD-MM-AAAA");
  const [profileTimeFormat, setProfileTimeFormat] = useState("24");

  // Configurações Fiscais detailed inputs
  const [fiscalType, setFiscalType] = useState<"empresa" | "privado">("empresa");
  const [fiscalCompanyName, setFiscalCompanyName] = useState("");
  const [fiscalCountry, setFiscalCountry] = useState("Brasil");
  const [fiscalNif, setFiscalNif] = useState("");
  const [fiscalFirstName, setFiscalFirstName] = useState("");
  const [fiscalLastName, setFiscalLastName] = useState("");
  const [fiscalAddress, setFiscalAddress] = useState("");
  const [fiscalPostalCode, setFiscalPostalCode] = useState("");
  const [fiscalCity, setFiscalCity] = useState("");
  const [fiscalEmail, setFiscalEmail] = useState("");

  const supabase = createClient();

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  React.useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Add Axios interceptor for Authentication
    const requestInterceptor = axios.interceptors.request.use(async (config) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
      return config;
    });

    // Add Axios interceptor for handling expired/invalid sessions (401)
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          console.warn("Session expired or invalid, signing out and clearing storage...");
          try {
            await supabase.auth.signOut();
          } catch (e) {
            // ignore
          }
          if (typeof window !== "undefined") {
            try {
              // Clear any local storage keys related to supabase auth
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith("sb-") || key.includes("supabase"))) {
                  localStorage.removeItem(key);
                }
              }
            } catch (e) {
              // ignore
            }
            setUser(null);
            // Instantly reload to a clean logged-out homepage
            window.location.reload();
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      subscription.unsubscribe();
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [supabase]);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  // Subscription Status check and payment redirection parameters
  React.useEffect(() => {
    let isSuccessRedirect = false;
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("status") === "success") {
        isSuccessRedirect = true;
        setCheckoutStep("success");
        setShowUpgradeModal(true);
        setSubscriptionStatus("active");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    const checkSubscription = async () => {
      if (!user) return;
      try {
        const response = await axios.get(`${apiBaseUrl}/api/v1/payments/subscription-status`);
        if (isSuccessRedirect) {
          setSubscriptionStatus("active");
          setSubscriptionData({
            ...response.data,
            status: "active",
            plan_type: "annual"
          });
        } else {
          setSubscriptionStatus(response.data.status);
          setSubscriptionData(response.data);
        }
      } catch (err) {
        console.error("Failed to check subscription status", err);
        if (!isSuccessRedirect) {
          setSubscriptionStatus("inactive");
        }
      }
    };
    
    if (user) {
      checkSubscription();
    } else {
      setSubscriptionStatus("inactive");
      setSubscriptionData(null);
    }
  }, [apiBaseUrl, user]);

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

  const formatPortugueseDate = (iso: string | null) => {
    if (!iso) return "24 De Maio De 2026";
    try {
      const d = new Date(iso);
      const months = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ];
      const day = d.getDate();
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      return `${day} De ${month} De ${year}`;
    } catch {
      return "24 De Maio De 2026";
    }
  };

  const handleSaveContactInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingSettings(true);
    setSettingsSuccess(null);
    try {
      const fullName = `${profileFirstName} ${profileLastName}`.trim();
      await axios.put(`${apiBaseUrl}/api/v1/users/profile`, {
        full_name: fullName
      });
      setProfileName(fullName);
      
      if (user) {
        setUser({
          ...user,
          user_metadata: {
            ...user.user_metadata,
            full_name: fullName
          }
        });
      }
      
      // Save contact/phone state locally
      localStorage.setItem("general_settings", JSON.stringify({
        profilePhoneArea,
        profilePhoneNumber,
        profileLanguage,
        profileTimezone,
        profileDateFormat,
        profileTimeFormat
      }));
      
      setSettingsSuccess("Informações de contato salvas com sucesso!");
      setTimeout(() => setSettingsSuccess(null), 3000);
    } catch (err: any) {
      console.error("Failed to update profile info", err);
      alert("Erro ao atualizar informações de contato.");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingSettings(true);
    setSettingsSuccess(null);
    setTimeout(() => {
      setIsUpdatingSettings(false);
      setSettingsSuccess("Senha atualizada com sucesso!");
      setTimeout(() => setSettingsSuccess(null), 3000);
    }, 800);
  };

  const handleSaveLanguage = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingSettings(true);
    setSettingsSuccess(null);
    localStorage.setItem("general_settings", JSON.stringify({
      profilePhoneArea,
      profilePhoneNumber,
      profileLanguage,
      profileTimezone,
      profileDateFormat,
      profileTimeFormat
    }));
    setTimeout(() => {
      setIsUpdatingSettings(false);
      setSettingsSuccess("Linguagem atualizada com sucesso!");
      setTimeout(() => setSettingsSuccess(null), 3000);
    }, 800);
  };

  const handleSaveTimezone = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingSettings(true);
    setSettingsSuccess(null);
    localStorage.setItem("general_settings", JSON.stringify({
      profilePhoneArea,
      profilePhoneNumber,
      profileLanguage,
      profileTimezone,
      profileDateFormat,
      profileTimeFormat
    }));
    setTimeout(() => {
      setIsUpdatingSettings(false);
      setSettingsSuccess("Fuso horário atualizado com sucesso!");
      setTimeout(() => setSettingsSuccess(null), 3000);
    }, 800);
  };

  const handleSaveDateTimeFormat = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingSettings(true);
    setSettingsSuccess(null);
    localStorage.setItem("general_settings", JSON.stringify({
      profilePhoneArea,
      profilePhoneNumber,
      profileLanguage,
      profileTimezone,
      profileDateFormat,
      profileTimeFormat
    }));
    setTimeout(() => {
      setIsUpdatingSettings(false);
      setSettingsSuccess("Formatos de data e hora atualizados com sucesso!");
      setTimeout(() => setSettingsSuccess(null), 3000);
    }, 800);
  };

  const handleSaveFiscalInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingSettings(true);
    setSettingsSuccess(null);
    
    // Persist in localStorage for smooth UX persistence
    localStorage.setItem("fiscal_info", JSON.stringify({
      fiscalType,
      fiscalCompanyName,
      fiscalCountry,
      fiscalNif,
      fiscalFirstName,
      fiscalLastName,
      fiscalAddress,
      fiscalPostalCode,
      fiscalCity,
      fiscalEmail
    }));
    
    setTimeout(() => {
      setIsUpdatingSettings(false);
      setSettingsSuccess("Informações fiscais salvas com sucesso!");
      setTimeout(() => setSettingsSuccess(null), 3000);
    }, 800);
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Tem certeza absoluta de que deseja excluir permanentemente sua conta? Esta ação é irreversível e excluirá todos os seus workspaces, transcrições e pastas!")) {
      return;
    }
    
    setIsUpdatingSettings(true);
    setSettingsSuccess(null);
    try {
      await axios.delete(`${apiBaseUrl}/api/v1/users/profile`);
      
      // Sign out and clear local state/auth keys
      try {
        await supabase.auth.signOut();
      } catch (e) {
        // ignore
      }
      
      if (typeof window !== "undefined") {
        try {
          // Clear localStorage
          localStorage.clear();
        } catch (e) {
          // ignore
        }
        setUser(null);
        alert("Sua conta foi excluída com sucesso.");
        window.location.reload();
      }
    } catch (err: any) {
      console.error("Failed to delete account", err);
      alert(err.response?.data?.detail || "Erro ao excluir conta. Tente novamente mais tarde.");
    } finally {
      setIsUpdatingSettings(false);
    }
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
      let url = `${apiBaseUrl}/jobs`;
      if (selectedFolderId !== "all") {
        url += `?folder_id=${selectedFolderId}`;
      }
      const response = await axios.get(url);
      setHistoryJobs(response.data);
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadFolders = async () => {
    setIsLoadingFolders(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/api/v1/folders`);
      setFolders(response.data);
    } catch (err) {
      console.error("Failed to load folders", err);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setIsCreatingFolder(true);
    try {
      await axios.post(`${apiBaseUrl}/api/v1/folders`, { name: newFolderName });
      setNewFolderName("");
      setShowCreateFolderModal(false);
      await loadFolders();
    } catch (err) {
      console.error("Failed to create folder", err);
      alert("Erro ao criar pasta.");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Tem certeza que deseja excluir esta pasta? Todas as transcrições contidas nela também serão excluídas!")) return;
    try {
      await axios.delete(`${apiBaseUrl}/api/v1/folders/${folderId}`);
      if (selectedFolderId === folderId) {
        setSelectedFolderId("all");
      }
      await loadFolders();
      await loadHistory();
    } catch (err) {
      console.error("Failed to delete folder", err);
      alert("Erro ao excluir pasta.");
    }
  };


  // Load workspace members
  const loadWorkspaceMembers = async () => {
    setIsLoadingMembers(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/api/v1/workspaces/members`);
      setWorkspaceMembers(response.data);
    } catch (err) {
      console.error("Failed to load workspace members", err);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // Invite member
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsInvitingMember(true);
    setInviteError(null);
    try {
      await axios.post(`${apiBaseUrl}/api/v1/workspaces/members`, {
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole
      });
      setInviteEmail("");
      setShowInviteModal(false);
      await loadWorkspaceMembers();
    } catch (err: any) {
      console.error("Failed to invite member", err);
      setInviteError(err.response?.data?.detail || "Erro ao convidar membro.");
    } finally {
      setIsInvitingMember(false);
    }
  };

  // Remove member
  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Tem certeza que deseja remover este membro do workspace?")) return;
    try {
      await axios.delete(`${apiBaseUrl}/api/v1/workspaces/members/${memberId}`);
      await loadWorkspaceMembers();
    } catch (err: any) {
      console.error("Failed to remove member", err);
      alert(err.response?.data?.detail || "Erro ao remover membro.");
    }
  };

  // Update Workspace Name
  const handleUpdateWorkspaceName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;
    setIsUpdatingSettings(true);
    setSettingsSuccess(null);
    try {
      const res = await axios.put(`${apiBaseUrl}/api/v1/workspaces/current`, {
        name: workspaceName.trim()
      });
      setWorkspaceName(res.data.workspace_name);
      setSettingsSuccess("Configurações atualizadas com sucesso!");
      setTimeout(() => setSettingsSuccess(null), 3000);
    } catch (err: any) {
      console.error("Failed to update workspace name", err);
      alert("Erro ao atualizar nome do workspace.");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  // Update User Profile Name
  const handleUpdateProfileName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;
    setIsUpdatingSettings(true);
    setSettingsSuccess(null);
    try {
      const res = await axios.put(`${apiBaseUrl}/api/v1/users/profile`, {
        full_name: profileName.trim()
      });
      setProfileName(res.data.full_name);
      
      if (user) {
        setUser({
          ...user,
          user_metadata: {
            ...user.user_metadata,
            full_name: res.data.full_name
          }
        });
      }
      
      setSettingsSuccess("Perfil atualizado com sucesso!");
      setTimeout(() => setSettingsSuccess(null), 3000);
    } catch (err: any) {
      console.error("Failed to update profile name", err);
      alert("Erro ao atualizar perfil.");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  // Send Support Ticket
  const handleSendSupportTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportMessage.trim()) return;
    setIsSendingSupport(true);
    setSupportSuccess(null);
    try {
      await axios.post(`${apiBaseUrl}/api/v1/support/contact`, {
        subject: supportSubject.trim(),
        message: supportMessage.trim()
      });
      setSupportSubject("");
      setSupportMessage("");
      setSupportSuccess("Mensagem enviada com sucesso! Entraremos em contato em breve.");
      setTimeout(() => setSupportSuccess(null), 5000);
    } catch (err: any) {
      console.error("Failed to send support ticket", err);
      alert("Erro ao enviar mensagem de suporte.");
    } finally {
      setIsSendingSupport(false);
    }
  };


  const handleMoveJob = async (jobId: string, folderId: string | null) => {
    try {
      let url = `${apiBaseUrl}/api/v1/jobs/${jobId}/move`;
      if (folderId) {
        url += `?folder_id=${folderId}`;
      }
      await axios.patch(url);
      await loadHistory();
    } catch (err) {
      console.error("Failed to move job", err);
      alert("Erro ao mover transcrição.");
    }
  };

  React.useEffect(() => {
    if (user) {
      const email = user.email || "";
      setProfileName(user.user_metadata?.full_name || email.split("@")[0] || "");
      
      // Parse full name into First and Last name states
      const fullName = user.user_metadata?.full_name || "Marcus Pereira";
      const parts = fullName.split(" ");
      setProfileFirstName(parts[0] || "Marcus");
      setProfileLastName(parts.slice(1).join(" ") || "Pereira");
      
      setFiscalEmail(email);
      setFiscalFirstName(parts[0] || "");
      setFiscalLastName(parts.slice(1).join(" ") || "");
      
      // Load local storage values if they exist
      try {
        const savedFiscal = localStorage.getItem("fiscal_info");
        if (savedFiscal) {
          const parsed = JSON.parse(savedFiscal);
          if (parsed.fiscalType) setFiscalType(parsed.fiscalType);
          if (parsed.fiscalCompanyName) setFiscalCompanyName(parsed.fiscalCompanyName);
          if (parsed.fiscalCountry) setFiscalCountry(parsed.fiscalCountry);
          if (parsed.fiscalNif) setFiscalNif(parsed.fiscalNif);
          if (parsed.fiscalFirstName) setFiscalFirstName(parsed.fiscalFirstName);
          if (parsed.fiscalLastName) setFiscalLastName(parsed.fiscalLastName);
          if (parsed.fiscalAddress) setFiscalAddress(parsed.fiscalAddress);
          if (parsed.fiscalPostalCode) setFiscalPostalCode(parsed.fiscalPostalCode);
          if (parsed.fiscalCity) setFiscalCity(parsed.fiscalCity);
          if (parsed.fiscalEmail) setFiscalEmail(parsed.fiscalEmail);
        }
        
        const savedGeneral = localStorage.getItem("general_settings");
        if (savedGeneral) {
          const parsed = JSON.parse(savedGeneral);
          if (parsed.profilePhoneArea) setProfilePhoneArea(parsed.profilePhoneArea);
          if (parsed.profilePhoneNumber) setProfilePhoneNumber(parsed.profilePhoneNumber);
          if (parsed.profileLanguage) setProfileLanguage(parsed.profileLanguage);
          if (parsed.profileTimezone) setProfileTimezone(parsed.profileTimezone);
          if (parsed.profileDateFormat) setProfileDateFormat(parsed.profileDateFormat);
          if (parsed.profileTimeFormat) setProfileTimeFormat(parsed.profileTimeFormat);
        }
      } catch (e) {
        console.warn("Failed to load settings from localStorage", e);
      }

      loadFolders();
      loadHistory();
      loadWorkspaceMembers();
      setViewMode("history"); // Force dashboard/history mode immediately when logged in
    } else {
      setFolders([]);
      setWorkspaceMembers([]);
    }
  }, [user]);

  React.useEffect(() => {
    if (viewMode === "history" && user) {
      loadHistory();
    }
  }, [viewMode, user, selectedFolderId]);

  const handleViewJob = async (job: any) => {
    setIsTranscribing(true);
    setError(null);
    setResult(null);
    setJobId(job.job_id);
    setJobStatus(job.status);
    setAudioUrl(`${apiBaseUrl}/jobs/${job.job_id}/audio`);
    
    // Se o job ainda estiver na fila ou processando, redireciona para a tela de progresso e inicia o polling
    if (job.status === "queued" || job.status === "processing") {
      setViewMode("transcribe");
      setTranscriptionProgress(job.status === "queued" ? 10 : 45);
      pollJobStatus(job.job_id);
      return;
    }
    
    try {
      const resultResponse = await axios.get(`${apiBaseUrl}/jobs/${job.job_id}/result?format=json`);
      setResult(resultResponse.data);
      setIsTranscribing(false);
      setViewMode("transcribe");
    } catch (err: any) {
      console.error("Failed to load job details", err);
      // Evita travamento de tela (AxiosError unhandled) exibindo alerta elegante e resetando estado
      let errorMsg = "Erro ao carregar detalhes da transcrição.";
      if (err.response?.status === 409) {
        setViewMode("transcribe");
        setJobStatus("processing");
        setTranscriptionProgress(50);
        pollJobStatus(job.job_id);
        return;
      }
      setError(errorMsg);
      setIsTranscribing(false);
      alert(errorMsg);
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
        setTranscriptionProgress(100);
        setTimeout(async () => {
          try {
            const resultResponse = await axios.get(`${apiBaseUrl}/jobs/${id}/result?format=json`);
            setResult(resultResponse.data);
            setIsTranscribing(false);
            setJobStatus(null);
          } catch (resErr) {
            console.error("Failed to load completed job results", resErr);
            setError("Erro ao carregar os resultados da transcrição.");
            setIsTranscribing(false);
          }
        }, 800);
      } else if (status === "failed") {
        setError(jobError || "Erro no processamento do job.");
        setIsTranscribing(false);
        setJobId(null);
        setJobStatus(null);
        setTranscriptionProgress(0);
      } else {
        setTranscriptionProgress((prev) => {
          if (status === "queued") {
            return prev < 15 ? prev + 2 : 15;
          } else { // "processing"
            if (prev < 40) return prev + 8;
            if (prev < 70) return prev + 4;
            if (prev < 90) return prev + 2;
            if (prev < 96) return prev + 0.5;
            return 96;
          }
        });
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const payload: any = {
        first_name: checkoutForm.first_name,
        last_name: checkoutForm.last_name,
        email: checkoutForm.email,
        phone: checkoutForm.phone,
        document_number: checkoutForm.document_number,
        ip: "127.0.0.1",
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
        payload.card_token = "mock_cc_token_from_frontend_" + Math.random().toString(36).substring(7);
        payload.card_holder_name = checkoutForm.card_holder_name || `${checkoutForm.first_name} ${checkoutForm.last_name}`;
        payload.card_holder_document = checkoutForm.card_holder_document || checkoutForm.document_number;
        payload.installments = Number(checkoutForm.installments);
      }

      const response = await axios.post(`${apiBaseUrl}/api/v1/payments/checkout`, payload, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      setCheckoutResult(response.data);
      const checkoutUrl = response.data.checkout_url;
      
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error("Checkout URL não retornada pelo gateway de pagamento.");
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("Checkout submit error", err);
      if (err.name === "CanceledError" || err.name === "AbortError") {
        setCheckoutError("Tempo esgotado. Verifique sua conexão e tente novamente.");
      } else {
        setCheckoutError(err.response?.data?.detail || err.message || "Erro ao processar pagamento. Tente novamente.");
      }
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleInstantCheckout = async () => {
    if (isInstantCheckingOut) return;
    setIsInstantCheckingOut(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const payload: any = {
        first_name: profileFirstName || "Usuário",
        last_name: profileLastName || "Transcribe",
        email: user?.email || "",
        phone: (profilePhoneArea && profilePhoneNumber) ? `${profilePhoneArea}${profilePhoneNumber}` : null,
        payment_method: "pix"
      };

      const response = await axios.post(`${apiBaseUrl}/api/v1/payments/checkout`, payload, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      const checkoutUrl = response.data.checkout_url;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error("Checkout URL não retornada pelo Abacate Pay.");
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("Instant checkout error", err);
      let errorMsg = "Erro ao processar checkout. Tente novamente.";
      if (err.name === "CanceledError" || err.name === "AbortError") {
        errorMsg = "Tempo esgotado. Verifique sua conexão e tente novamente.";
      } else if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      } else if (err.message) {
        errorMsg = err.message;
      }
      alert(errorMsg);
    } finally {
      setIsInstantCheckingOut(false);
    }
  };

  const startTranscription = async () => {
    if ((tab === "local" && !file) || (tab === "online" && !url)) return;
    
    // Billing guard: backend returns active for all users in DEV_MODE
    // if (subscriptionStatus !== "active") {
    //   setShowUpgradeModal(true);
    //   return;
    // }

    setIsTranscribing(true);
    setViewMode("transcribe");
    setTranscriptionProgress(5);
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
    if (selectedFolderUploadId) {
      formData.append("folder_id", selectedFolderUploadId);
    }

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

  if (user) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex relative font-sans text-gray-900 overflow-x-hidden">
        {/* Sidebar Esquerda Unificada */}
        <aside className="w-[260px] h-screen bg-white border-r border-gray-100 flex flex-col justify-between shrink-0 p-6 fixed left-0 top-0 z-30">
          <div className="flex flex-col gap-8 w-full">
            {/* Logo Transcribe */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-600/10">
                <Mic className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900 tracking-tight">Transcribe</span>
            </div>
            
            {/* Menu Items */}
            <nav className="flex flex-col gap-1 w-full">
              <button 
                onClick={() => { setActiveTab("transcriptions"); setViewMode("history"); }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === "transcriptions" 
                    ? "bg-indigo-50 text-indigo-600 shadow-[0_2px_8px_rgba(99,102,241,0.04)]" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <AudioLines className="w-4 h-4" />
                Transcrições
              </button>
              <button 
                onClick={() => setActiveTab("billing")}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === "billing" 
                    ? "bg-indigo-50 text-indigo-600 shadow-[0_2px_8px_rgba(99,102,241,0.04)]" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Cobrança
              </button>
              <button 
                onClick={() => setActiveTab("users")}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === "users" 
                    ? "bg-indigo-50 text-indigo-600 shadow-[0_2px_8px_rgba(99,102,241,0.04)]" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Users className="w-4 h-4" />
                Usuários
              </button>
            </nav>
          </div>

          <div className="flex flex-col gap-4 w-full">
            {/* Bottom Menu Items */}
            <nav className="flex flex-col gap-1 w-full">
              <button 
                onClick={() => setActiveTab("settings")}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === "settings" 
                    ? "bg-indigo-50 text-indigo-600 shadow-[0_2px_8px_rgba(99,102,241,0.04)]" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Settings2 className="w-4 h-4" />
                Configurações
              </button>
              <button 
                onClick={() => setActiveTab("contact")}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === "contact" 
                    ? "bg-indigo-50 text-indigo-600 shadow-[0_2px_8px_rgba(99,102,241,0.04)]" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                Contate-nos
              </button>
            </nav>

            <div className="border-t border-gray-100 my-1"></div>

            {/* Profile & Sair */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col min-w-0 pl-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Conta ativa</span>
                <span className="text-xs font-semibold text-gray-700 truncate" title={user.email}>{user.email}</span>
              </div>
              <button 
                onClick={async () => { await supabase.auth.signOut(); setUser(null); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all w-full"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        </aside>

        {/* Área Principal de Conteúdo */}
        <main className="flex-1 min-h-screen ml-[260px] p-8 md:p-12 overflow-y-auto bg-[#F9FAFB] relative z-10">
          
          {/* TAB 1: TRANSCRIPÇÕES (DEFAULT) */}
          {activeTab === "transcriptions" && (
            <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
              {isTranscribing ? (
                /* LOADING LOADER VIEW */
                <div className="w-full max-w-[800px] mt-2 z-10 flex flex-col items-center mx-auto animate-[fadeIn_0.2s_ease-out]">
                  <div className="w-full flex items-center justify-between mb-4 px-2">
                    <button onClick={() => { setIsTranscribing(false); setJobId(null); setJobStatus(null); }} className="flex items-center gap-2 text-indigo-500 font-[600] text-[13px] hover:text-indigo-600 transition-colors">
                      <ArrowLeft className="w-4 h-4" />
                      Voltar ao Painel
                    </button>
                  </div>
                  
                  <div className="w-full bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8 flex flex-col items-center">
                    <div className="w-full flex items-center justify-between border-b border-gray-100 pb-5 mb-5">
                      <div className="flex items-center gap-3 text-left">
                         <div className="p-2.5 bg-[#F6F8FF] text-indigo-600 rounded-xl">
                           <FileAudio className="w-5 h-5" />
                         </div>
                         <div className="flex flex-col gap-1 w-48">
                           <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold">
                             <span>Progresso</span>
                             <span>{Math.round(transcriptionProgress)}%</span>
                           </div>
                           <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative">
                             <div 
                               className="absolute top-0 left-0 h-full bg-indigo-600 rounded-full transition-all duration-500 ease-out animate-[pulse_2s_infinite]" 
                               style={{ width: `${transcriptionProgress}%` }}
                             />
                           </div>
                         </div>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="flex items-center gap-1.5 text-gray-400 text-sm font-medium">
                           <Clock className="w-4 h-4" />
                           <div className="h-2 w-12 bg-gray-200 rounded-full overflow-hidden relative">
                             <div 
                               className="absolute top-0 left-0 h-full bg-gray-300 rounded-full transition-all duration-500"
                               style={{ width: `${transcriptionProgress}%` }}
                             />
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
                       <div className="w-[96px] h-[96px] bg-[#F8FAFF] rounded-full flex flex-col items-center justify-center mb-6 relative border-[6px] border-white shadow-[0_0_0_1px_rgba(99,102,241,0.1)]">
                         <span className="text-lg font-extrabold text-indigo-600 tracking-tight">{Math.round(transcriptionProgress)}%</span>
                         <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5">Whisper</span>
                       </div>
                       <h3 className="text-[16px] font-bold text-gray-900 mb-2">Estamos processando sua transcrição...</h3>
                       <p className="text-[13px] font-medium text-gray-500">
                         {jobStatus === "processing" ? "Extraindo áudio e transcrevendo..." : "Aguardando na fila de processamento..."}
                       </p>
                    </div>
                  </div>
                </div>
              ) : result ? (
                /* RESULT DISPLAY VIEW */
                <div className="w-full max-w-4xl mt-2 z-10 flex flex-col items-center mx-auto animate-[fadeIn_0.2s_ease-out]">
                  <div className="w-full flex items-center justify-between mb-4 px-2">
                    <button onClick={() => setResult(null)} className="flex items-center gap-2 text-indigo-500 font-[600] text-[13px] hover:text-indigo-600 transition-colors cursor-pointer">
                      <ArrowLeft className="w-4 h-4" />
                      Voltar ao Painel
                    </button>
                  </div>
                  
                  <div className="w-full bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8 flex flex-col">
                    <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-5">
                      <div className="flex items-center gap-3 text-left">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                          <FileAudio className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-[16px] font-bold text-gray-900 leading-tight">
                            {file?.name || (result as any)?.filename || "Transcrição de Áudio"}
                          </h2>
                          <p className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5">
                            {result.segments.length > 0 && result.segments[result.segments.length-1] ? `${Math.ceil(result.segments[result.segments.length-1]!.end / 60)} minutos` : ''}
                          </p>
                        </div>
                      </div>
                      
                      <div className="relative">
                        <button 
                          onClick={() => setIsMenuOpen(!isMenuOpen)}
                          className="w-8 h-8 flex items-center justify-center text-gray-500 bg-gray-50 border border-gray-100 cursor-pointer hover:bg-gray-100 hover:text-indigo-600 transition-colors rounded-[8px]"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        
                        {isMenuOpen && (
                          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg py-1.5 z-30 animate-[fadeIn_0.15s_ease-out]">
                            <button onClick={exportTranscription} className="w-full px-4 py-2 text-left text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center gap-2 cursor-pointer">
                              <Download className="w-3.5 h-3.5" /> Exportar TXT
                            </button>
                            <button onClick={shareTranscription} className="w-full px-4 py-2 text-left text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center gap-2 cursor-pointer">
                              <Copy className="w-3.5 h-3.5" /> Copiar texto
                            </button>
                            <button onClick={downloadAudio} className="w-full px-4 py-2 text-left text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center gap-2 cursor-pointer">
                              <Volume2 className="w-3.5 h-3.5" /> Baixar áudio
                            </button>
                            <button onClick={() => {setResult(null); setFile(null); setUrl(""); setIsMenuOpen(false);}} className="w-full px-4 py-2 text-left text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 border-t border-gray-50 cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" /> Fechar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="w-full flex items-center gap-8 border-b border-gray-100 mb-6 px-2 justify-start overflow-x-auto">
                       <button onClick={() => setActiveResultTab("transcricao")} className={`pb-4 text-[13px] tracking-wide font-semibold whitespace-nowrap transition-colors relative top-[1px] border-b-2 ${activeResultTab === "transcricao" ? "text-indigo-600 border-indigo-600 font-bold" : "text-gray-400 border-transparent hover:text-gray-600 hover:border-gray-200"}`}>Transcrição</button>
                       <button onClick={() => { setActiveResultTab("editar"); setEditedText(result.text); }} className={`pb-4 text-[13px] tracking-wide font-semibold whitespace-nowrap transition-colors relative top-[1px] border-b-2 ${activeResultTab === "editar" ? "text-indigo-600 border-indigo-600 font-bold" : "text-gray-400 border-transparent hover:text-gray-600 hover:border-gray-200"}`}>Editar</button>
                       <button onClick={() => setActiveResultTab("traduzir")} className={`pb-4 text-[13px] tracking-wide font-semibold whitespace-nowrap transition-colors relative top-[1px] border-b-2 ${activeResultTab === "traduzir" ? "text-indigo-600 border-indigo-600 font-bold" : "text-gray-400 border-transparent hover:text-gray-600 hover:border-gray-200"}`}>Traduzir</button>
                       <button onClick={() => setActiveResultTab("resumo")} className={`pb-4 text-[13px] tracking-wide font-semibold whitespace-nowrap transition-colors relative top-[1px] border-b-2 ${activeResultTab === "resumo" ? "text-indigo-600 border-indigo-600 font-bold" : "text-gray-400 border-transparent hover:text-gray-600 hover:border-gray-200"}`}>Resumo</button>
                    </div>

                    <div className="w-full min-h-[300px] text-left">
                      {activeResultTab === "transcricao" && (
                        <div className="space-y-4">
                          {result.segments.map((segment, idx) => (
                            <div key={idx} className="flex items-start gap-4 hover:bg-gray-50/50 p-2.5 rounded-xl transition-colors">
                              <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50/70 px-2 py-1 rounded-md shrink-0 select-none">
                                {new Date(segment.start * 1000).toISOString().substr(14, 5)}
                              </span>
                              <div className="flex flex-col">
                                {segment.speaker && (
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                                    {segment.speaker}
                                  </span>
                                )}
                                <p className="text-xs text-gray-700 font-medium leading-relaxed">
                                  {segment.text}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {activeResultTab === "editar" && (
                        <div className="flex flex-col gap-4">
                          <textarea 
                            value={editedText}
                            onChange={(e) => setEditedText(e.target.value)}
                            className="w-full h-64 p-4 border border-gray-100 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 text-xs font-medium leading-relaxed text-gray-700 bg-gray-50/50"
                          />
                          <div className="flex justify-end gap-3">
                            <button 
                              onClick={() => {
                                if (result) {
                                  setResult({
                                    ...result,
                                    text: editedText,
                                    segments: [{
                                      start: 0,
                                      end: result.segments.length > 0 ? (result.segments[result.segments.length-1]?.end ?? 0) : 0,
                                      speaker: result.segments.length > 0 ? (result.segments[result.segments.length-1]?.speaker ?? "") : "",
                                      text: editedText
                                    }]
                                  });
                                  setActiveResultTab("transcricao");
                                  alert("Transcrição atualizada com sucesso!");
                                }
                              }}
                              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer"
                            >
                              Salvar alterações
                            </button>
                          </div>
                        </div>
                      )}

                      {activeResultTab === "traduzir" && (
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center gap-3">
                            <select 
                              value={targetTranslationLanguage}
                              onChange={(e) => setTargetTranslationLanguage(e.target.value)}
                              className="appearance-none bg-gray-50 border border-gray-100 text-xs font-bold text-gray-700 rounded-xl px-4 py-2.5 outline-none min-w-[140px]"
                            >
                              <option value="en">🇺🇸 Inglês</option>
                              <option value="pt">🇧🇷 Português</option>
                              <option value="es">🇪🇸 Espanhol</option>
                            </select>
                            <button 
                              onClick={handleTranslation}
                              disabled={isProcessingAction}
                              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              {isProcessingAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                              Traduzir
                            </button>
                          </div>
                          {translatedText && (
                            <div className="p-4 bg-gray-50/50 border border-gray-100 rounded-xl">
                              <p className="text-xs text-gray-700 font-medium leading-relaxed whitespace-pre-wrap">{translatedText}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {activeResultTab === "resumo" && (
                        <div className="flex flex-col gap-4 text-left">
                          <div className="flex justify-start">
                            <button 
                              onClick={handleSummarize}
                              disabled={isProcessingAction}
                              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              {isProcessingAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                              Gerar Inteligência do Áudio
                            </button>
                          </div>
                          {summaryText && (
                            <div className="p-5 bg-[#F8FAFF] border border-indigo-50 rounded-xl">
                              <p className="text-xs text-gray-700 font-medium leading-relaxed whitespace-pre-wrap">{summaryText}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* RENDER THE STANDARD HISTORY LIST */
                <>
                  {/* Header com botão de upload */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                        {selectedFolderId === "all" 
                          ? "Todas as transcrições" 
                          : selectedFolderId === "root" 
                            ? "Nível Raiz (Sem pasta)" 
                            : folders.find(f => f.id === selectedFolderId)?.name || "Transcrição"}
                      </h1>
                      <p className="text-xs text-gray-500 font-medium">Consulte e organize todos os seus históricos escolares e gravações.</p>
                    </div>
                    <button 
                      onClick={() => setShowUploadModal(true)}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-3 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                    >
                      <Mic className="w-4 h-4" />
                      Criar novo
                    </button>
                  </div>

                  {/* Upgrade or Cancelled Info Banner */}
                  {subscriptionStatus === "inactive" && (
                    <div className="w-full bg-white border border-indigo-50 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_4px_20px_rgba(99,102,241,0.01)]">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                          <Zap className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900 mb-0.5">Desbloqueie mais recursos!</h3>
                          <p className="text-xs text-gray-500 font-medium">Atualize seu plano para desfrutar de processamento ilimitado de arquivos e armazenamento ampliado.</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setActiveTab("billing")}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
                      >
                        Plano de atualização
                      </button>
                    </div>
                  )}

                  {subscriptionStatus === "cancelled" && (
                    <div className="w-full bg-amber-50/50 border border-amber-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_4px_20px_rgba(245,158,11,0.02)]">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-amber-900 mb-0.5">Assinatura cancelada em andamento</h3>
                          <p className="text-xs text-amber-700 font-medium">
                            Seu acesso PRO continuará ativo até <strong className="font-bold text-amber-950">{subscriptionData?.expires_at ? formatDate(subscriptionData.expires_at) : "o fim do período"}</strong>. Após essa data, sua conta retornará ao plano gratuito.
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setActiveTab("billing")}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
                      >
                        Reativar Plano
                      </button>
                    </div>
                  )}

                  {/* Pastas Section */}
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold text-gray-800">Pastas</h2>
                      <button 
                        onClick={() => setShowCreateFolderModal(true)}
                        className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                      >
                        <FolderPlus className="w-4 h-4" />
                        Nova pasta
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {/* Card Todas */}
                      <div 
                        onClick={() => setSelectedFolderId("all")}
                        className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                          selectedFolderId === "all" 
                            ? "bg-white border-indigo-200 shadow-[0_4px_20px_rgba(99,102,241,0.04)] text-indigo-600" 
                            : "bg-white border-gray-100 hover:border-gray-200 text-gray-600"
                        }`}
                      >
                        <Folder className={`w-8 h-8 mb-3 ${selectedFolderId === "all" ? "text-indigo-500" : "text-gray-400"}`} />
                        <span className="text-xs font-bold truncate block">Todas</span>
                      </div>

                      {/* Card Raiz */}
                      <div 
                        onClick={() => setSelectedFolderId("root")}
                        className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                          selectedFolderId === "root" 
                            ? "bg-white border-indigo-200 shadow-[0_4px_20px_rgba(99,102,241,0.04)] text-indigo-600" 
                            : "bg-white border-gray-100 hover:border-gray-200 text-gray-600"
                        }`}
                      >
                        <Folder className={`w-8 h-8 mb-3 ${selectedFolderId === "root" ? "text-indigo-400" : "text-gray-400"}`} />
                        <span className="text-xs font-bold truncate block">Nível Raiz</span>
                      </div>

                      {/* Card folders list */}
                      {folders.map(f => (
                        <div 
                          key={f.id}
                          onClick={() => setSelectedFolderId(f.id)}
                          className={`group p-4 rounded-2xl border text-left cursor-pointer transition-all relative ${
                            selectedFolderId === f.id 
                              ? "bg-white border-indigo-200 shadow-[0_4px_20px_rgba(99,102,241,0.04)] text-indigo-600" 
                              : "bg-white border-gray-100 hover:border-gray-200 text-gray-600"
                          }`}
                        >
                          <Folder className={`w-8 h-8 mb-3 ${selectedFolderId === f.id ? "text-indigo-500" : "text-indigo-400"}`} />
                          <span className="text-xs font-bold truncate block pr-6">{f.name}</span>
                          <button 
                            onClick={(e) => handleDeleteFolder(f.id, e)}
                            className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Transcrições Section */}
                  <div className="w-full mt-2">
                    <h2 className="text-sm font-bold text-gray-800 mb-4">Transcrições</h2>
                    
                    {isLoadingHistory ? (
                      <div className="w-full bg-white rounded-2xl border border-gray-100 p-12 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                        <span className="text-xs text-gray-500 font-medium">Carregando históricos...</span>
                      </div>
                    ) : historyJobs.length === 0 ? (
                      <div className="w-full bg-white rounded-2xl border border-gray-100 p-16 flex flex-col items-center justify-center text-center gap-4">
                        <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center text-gray-400">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-gray-800 mb-1">Nenhum histórico escolar encontrado</h3>
                          <p className="text-xs text-gray-400 max-w-sm mx-auto font-medium">Crie pastas ou envie novas gravações clicando no botão Criar novo.</p>
                        </div>
                        <button 
                          onClick={() => setShowUploadModal(true)}
                          className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                        >
                          <FolderPlus className="w-4 h-4" />
                          Criar novo
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {historyJobs.map(job => (
                          <div 
                            key={job.job_id}
                            className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer"
                            onClick={() => handleViewJob(job)}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                                <FileAudio className="w-5 h-5" />
                              </div>
                              <div className="min-w-0 text-left">
                                <h4 className="text-xs font-bold text-gray-900 truncate mb-1" title={job.filename || "Gravação Sem Nome"}>
                                  {job.filename || "Gravação Sem Nome"}
                                </h4>
                                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-semibold uppercase">
                                  <span>{new Date(job.created_at).toLocaleDateString("pt-BR")}</span>
                                  <span>•</span>
                                  <span>{job.language === "pt" ? "Português" : job.language === "en" ? "Inglês" : job.language === "es" ? "Espanhol" : "Português"}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 shrink-0">
                              {/* Folder Mover Selector */}
                              <div className="relative" onClick={(e) => e.stopPropagation()}>
                                <select 
                                  value={job.folder_id || ""}
                                  onChange={(e) => handleMoveJob(job.job_id, e.target.value || null)}
                                  className="appearance-none bg-gray-50 border border-gray-100 text-[11px] font-bold text-gray-600 px-3 py-1.5 pr-7 rounded-xl outline-none hover:bg-gray-100 transition-colors"
                                >
                                  <option value="">📁 Sem Pasta</option>
                                  {folders.map(f => (
                                    <option key={f.id} value={f.id}>📁 {f.name}</option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                              </div>

                              {/* Status and Actions */}
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                job.status === "completed" 
                                  ? "bg-green-50 text-green-600" 
                                  : job.status === "failed" 
                                    ? "bg-red-50 text-red-600" 
                                    : "bg-indigo-50 text-indigo-600 animate-pulse"
                              }`}>
                                {job.status === "completed" ? "Concluído" : job.status === "failed" ? "Falhou" : "Na fila"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: COBRANÇA (BILLING) */}
          {activeTab === "billing" && (
            <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 text-left animate-[fadeIn_0.2s_ease-out]">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Inicie sua assinatura do Transcribe</h1>
              </div>

              {/* Central Premium Container */}
              <div className="w-full bg-white rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] p-8 flex flex-col gap-6 items-center">
                
                {/* Today vs Monthly Grid */}
                <div className="w-full grid grid-cols-2 text-center relative py-2">
                  {/* Today Column */}
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Hoje</span>
                    <span className="text-3xl font-extrabold text-gray-900 tracking-tight">R$ 5,00</span>
                    <span className="text-xs font-semibold text-gray-400 mt-2">Teste gratuito de 7 dias</span>
                  </div>

                  {/* Vertical Divider */}
                  <div className="absolute top-1/2 left-1/2 -translate-y-1/2 w-[1px] h-16 bg-gray-100"></div>

                  {/* Then Column */}
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Então</span>
                    <span className="text-3xl font-extrabold text-gray-900 tracking-tight">R$ 150,00</span>
                    <span className="text-xs font-semibold text-gray-400 mt-2">mensal</span>
                  </div>
                </div>

                {/* Trial Description Textbox */}
                <div className="w-full bg-gray-50/70 border border-gray-100 rounded-2xl p-5 text-center text-[11px] leading-relaxed text-gray-500 font-medium max-w-2xl">
                  Ao ativar seu período de teste gratuito de 7 dias por <strong className="text-gray-800">R$ 5,00</strong>, você inicia uma <strong className="text-gray-800">assinatura mensal recorrente</strong>. Após o término do período de teste, a taxa padrão de <strong className="text-gray-800">R$ 150,00</strong> será cobrada automaticamente todos os meses. Você pode cancelar a qualquer momento pelo seu painel de controle. Para evitar a cobrança de <strong className="text-gray-800">R$ 150,00</strong>, você deve cancelar pelo menos <strong className="text-gray-800">1 hora</strong> antes do término do período de teste.
                </div>

                {/* Trial CTA Button */}
                <div className="flex flex-col items-center gap-3 w-full mt-2">
                  <button 
                    onClick={handleInstantCheckout}
                    disabled={isInstantCheckingOut}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-8 py-3.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer w-full max-w-[320px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isInstantCheckingOut ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Redirecionando...
                      </>
                    ) : (
                      "Comece o teste gratuito em 7 dias."
                    )}
                  </button>
                  <span className="text-[11px] text-gray-400 font-medium">Cancele a qualquer momento.</span>
                </div>
              </div>

              {/* Sub-Header Comparison */}
              <div className="mt-4">
                <h2 className="text-sm font-bold text-gray-800 tracking-tight">Funcionalidades e condições da assinatura:</h2>
              </div>

              {/* Comparison Table */}
              <div className="w-full bg-white border border-gray-100 rounded-2xl shadow-[0_4px_25px_rgba(0,0,0,0.01)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100 text-left">
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 w-1/3">Funções principais</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-800 w-1/3 text-center">Teste gratuito de 7 dias</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-800 w-1/3 text-center">Assinatura mensal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs font-semibold text-gray-600">
                      {/* Preço */}
                      <tr className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4 text-gray-700 font-bold">Preço e renovação</td>
                        <td className="px-6 py-4 text-center text-[11px] font-medium text-gray-500">
                          R$ 5,00 <span className="text-[10px] text-gray-400">(Renovação automática por R$ 150,00/mês)</span>
                        </td>
                        <td className="px-6 py-4 text-center text-gray-800 font-bold">R$ 150,00 por mês</td>
                      </tr>

                      {/* Envio */}
                      <tr className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4 text-gray-700 font-bold">Envio de arquivo</td>
                        <td className="px-6 py-4 text-center text-gray-500 font-semibold">Máximo de 5 arquivos por dia</td>
                        <td className="px-6 py-4 text-center text-indigo-600 font-bold">Ilimitado</td>
                      </tr>

                      {/* Tamanho */}
                      <tr className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4 text-gray-700 font-bold">Tamanho máximo do arquivo</td>
                        <td className="px-6 py-4 text-center text-gray-500 font-semibold">Até 2 GB</td>
                        <td className="px-6 py-4 text-center text-gray-800 font-bold">Até 5 GB</td>
                      </tr>

                      {/* Armazenar */}
                      <tr className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4 text-gray-700 font-bold">Armazenar</td>
                        <td className="px-6 py-4 text-center text-red-500/80 font-bold">Apenas por 24 horas.</td>
                        <td className="px-6 py-4 text-center text-gray-800 font-bold">Durante 7 dias</td>
                      </tr>

                      {/* Pastas */}
                      <tr className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4 text-gray-700 font-bold">Organização em pastas</td>
                        <td className="px-6 py-4 text-center text-gray-400 font-medium">Não incluído</td>
                        <td className="px-6 py-4 text-center text-gray-800 font-bold">Incluindo</td>
                      </tr>

                      {/* Colaboradores */}
                      <tr className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4 text-gray-700 font-bold">Colaboradores</td>
                        <td className="px-6 py-4 text-center text-gray-400 font-medium">Não incluído</td>
                        <td className="px-6 py-4 text-center text-gray-800 font-bold">Acesso para toda a equipe</td>
                      </tr>

                      {/* Idiomas */}
                      <tr className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4 text-gray-700 font-bold">Mais de 99 idiomas disponíveis</td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex w-5 h-5 bg-indigo-600 rounded-full items-center justify-center text-white shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex w-5 h-5 bg-indigo-600 rounded-full items-center justify-center text-white shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        </td>
                      </tr>

                      {/* Download Formats */}
                      <tr className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4 text-gray-700 font-bold">Faça o download em DOCX, PDF, TXT ou SRT.</td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex w-5 h-5 bg-indigo-600 rounded-full items-center justify-center text-white shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex w-5 h-5 bg-indigo-600 rounded-full items-center justify-center text-white shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        </td>
                      </tr>

                      {/* Envio em Massa */}
                      <tr className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4 text-gray-700 font-bold">Envio de arquivos em massa</td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex w-5 h-5 bg-indigo-600 rounded-full items-center justify-center text-white shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex w-5 h-5 bg-indigo-600 rounded-full items-center justify-center text-white shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        </td>
                      </tr>

                      {/* Edição */}
                      <tr className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4 text-gray-700 font-bold">Edição de transcrição</td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex w-5 h-5 bg-indigo-600 rounded-full items-center justify-center text-white shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex w-5 h-5 bg-indigo-600 rounded-full items-center justify-center text-white shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        </td>
                      </tr>

                      {/* Timestamps */}
                      <tr className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4 text-gray-700 font-bold">Carimbos de data/hora opcionais</td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex w-5 h-5 bg-indigo-600 rounded-full items-center justify-center text-white shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex w-5 h-5 bg-indigo-600 rounded-full items-center justify-center text-white shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        </td>
                      </tr>

                      {/* Speakers */}
                      <tr className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4 text-gray-700 font-bold">Identificação do falante</td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex w-5 h-5 bg-indigo-600 rounded-full items-center justify-center text-white shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex w-5 h-5 bg-indigo-600 rounded-full items-center justify-center text-white shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        </td>
                      </tr>

                      {/* Resumo */}
                      <tr className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4 text-gray-700 font-bold">Resumo da transcrição</td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex w-5 h-5 bg-indigo-600 rounded-full items-center justify-center text-white shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex w-5 h-5 bg-indigo-600 rounded-full items-center justify-center text-white shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: USUÁRIOS (TEAM MEMBERS) */}
          {activeTab === "users" && (
            <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 text-left animate-[fadeIn_0.2s_ease-out]">
              
              {/* Header with Add User Button */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Usuários</h1>
                
                <button 
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  <span className="text-sm font-bold leading-none">+</span>
                  <span>Adicionar usuário</span>
                </button>
              </div>

              {/* Members Table Card */}
              <div className="bg-white border border-gray-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.02)] overflow-hidden p-6 mt-2">
                {isLoadingMembers ? (
                  <div className="p-12 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    <span className="text-xs text-gray-500 font-medium">Carregando membros...</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="text-left">
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-4">Nome</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-4">Papel</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-4">Pastas</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-4">Criado</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-4">Último acesso</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-4">Estado</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {workspaceMembers.map(member => (
                          <tr key={member.id} className="hover:bg-gray-50/30 transition-colors">
                            {/* Nome (Email) */}
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-700">
                              {member.email}
                            </td>
                            {/* Papel */}
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-gray-500">
                              {member.role === "admin" ? "Administrador" : "Colaborador"}
                            </td>
                            {/* Pastas */}
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-gray-500">
                              <span className="flex items-center gap-1">
                                <span>📁</span> Todas as pastas
                              </span>
                            </td>
                            {/* Criado */}
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-gray-500">
                              {formatPortugueseDate(member.created_at)}
                            </td>
                            {/* Último Acesso */}
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-gray-500">
                              {formatPortugueseDate(member.created_at)}
                            </td>
                            {/* Estado (Pill) */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex border border-green-200 bg-green-50/35 text-green-600 px-3 py-1 rounded-full text-[10px] font-bold">
                                Ativo
                              </span>
                            </td>
                            {/* Actions */}
                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                              {member.role !== "admin" ? (
                                <button 
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="text-red-500 hover:text-red-700 font-bold hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                >
                                  Remover
                                </button>
                              ) : (
                                <span className="text-[10px] text-gray-400 font-semibold italic">Proprietário</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {workspaceMembers.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-xs text-gray-400 font-medium">
                              Nenhum usuário cadastrado neste workspace.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: CONFIGURAÇÕES (SETTINGS) */}
          {activeTab === "settings" && (
            <div className="w-full max-w-4xl mx-auto flex flex-col text-left animate-[fadeIn_0.2s_ease-out]">
              
              {/* Settings Header */}
              <h1 className="text-xl font-bold text-gray-900 tracking-tight mb-4">Configurações</h1>

              {/* Subtabs Selector */}
              <div className="flex gap-6 border-b border-gray-100 pb-0 mb-4 w-full">
                <button 
                  onClick={() => setSettingsSubTab("gerais")}
                  className={`text-xs font-bold pb-2.5 transition-all outline-none cursor-pointer border-b-2 ${
                    settingsSubTab === "gerais" 
                      ? "text-indigo-600 border-indigo-600" 
                      : "text-gray-400 border-transparent hover:text-gray-600"
                  }`}
                >
                  Informações gerais
                </button>
                <button 
                  onClick={() => setSettingsSubTab("fiscais")}
                  className={`text-xs font-bold pb-2.5 transition-all outline-none cursor-pointer border-b-2 ${
                    settingsSubTab === "fiscais" 
                      ? "text-indigo-600 border-indigo-600" 
                      : "text-gray-400 border-transparent hover:text-gray-600"
                  }`}
                >
                  Informações fiscais
                </button>
              </div>

              {/* Success alert banner */}
              {settingsSuccess ? (
                <div className="w-full bg-green-50 border border-green-100 text-green-700 text-xs font-bold p-4 rounded-xl shadow-sm mb-4">
                  {settingsSuccess}
                </div>
              ) : (
                <div className="w-full bg-indigo-50/40 text-indigo-600 text-[10px] font-bold px-4 py-2 rounded-xl mb-4">
                  Atualizado em 24 de maio de 2026
                </div>
              )}

              {/* Big White Card containing settings forms */}
              <div className="w-full bg-white border border-gray-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.02)] p-8 flex flex-col">
                
                {/* SUBTAB 4A: INFORMAÇÕES GERAIS */}
                {settingsSubTab === "gerais" && (
                  <div className="divide-y divide-gray-100">
                    
                    {/* Section 1: Informações de contato */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6 first:pt-0">
                      <div className="md:col-span-1">
                        <h3 className="text-xs font-bold text-gray-900">Informações de contato</h3>
                        <p className="text-[11px] text-gray-400 font-semibold leading-relaxed mt-1">
                          Gerencie e atualize suas informações pessoais com facilidade.
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <form onSubmit={handleSaveContactInfo} className="flex flex-col gap-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 mb-1.5">Nome</label>
                              <input 
                                type="text"
                                required
                                value={profileFirstName}
                                onChange={(e) => setProfileFirstName(e.target.value)}
                                placeholder="Nome"
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 mb-1.5">Sobrenome</label>
                              <input 
                                type="text"
                                required
                                value={profileLastName}
                                onChange={(e) => setProfileLastName(e.target.value)}
                                placeholder="Sobrenome"
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 mb-1.5">E-mail</label>
                            <input 
                              type="email"
                              disabled
                              value={user?.email || ""}
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold text-gray-400 outline-none cursor-not-allowed"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 mb-1.5">Telefone</label>
                            <div className="grid grid-cols-4 gap-4">
                              <div className="col-span-1">
                                <input 
                                  type="text"
                                  value={profilePhoneArea}
                                  onChange={(e) => setProfilePhoneArea(e.target.value)}
                                  placeholder="Ex. 34"
                                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all text-center"
                                />
                              </div>
                              <div className="col-span-3">
                                <input 
                                  type="text"
                                  value={profilePhoneNumber}
                                  onChange={(e) => setProfilePhoneNumber(e.target.value)}
                                  placeholder="Exemplo: 6555123"
                                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-end mt-2">
                            <button 
                              type="submit"
                              disabled={isUpdatingSettings}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-2 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer disabled:opacity-50"
                            >
                              {isUpdatingSettings ? "Salvando..." : "Salvar"}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>

                    {/* Section 2: Senha */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
                      <div className="md:col-span-1">
                        <h3 className="text-xs font-bold text-gray-900">Senha</h3>
                        <p className="text-[11px] text-gray-400 font-semibold leading-relaxed mt-1">
                          Altere sua senha para manter sua conta segura. Recomenda-se o uso de uma senha forte e exclusiva.
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <form onSubmit={handleSavePassword} className="flex flex-col gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 mb-1.5">Senha</label>
                            <input 
                              type="password"
                              required
                              value={profilePassword}
                              onChange={(e) => setProfilePassword(e.target.value)}
                              placeholder="********"
                              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                            />
                          </div>

                          <div className="flex justify-end mt-2">
                            <button 
                              type="submit"
                              disabled={isUpdatingSettings}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-2 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer disabled:opacity-50"
                            >
                              {isUpdatingSettings ? "Salvando..." : "Salvar"}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>

                    {/* Section 3: Linguagem */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
                      <div className="md:col-span-1">
                        <h3 className="text-xs font-bold text-gray-900">Linguagem</h3>
                        <p className="text-[11px] text-gray-400 font-semibold leading-relaxed mt-1">
                          Selecione o idioma de sua preferência para personalizar sua experiência na plataforma.
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <form onSubmit={handleSaveLanguage} className="flex flex-col gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 mb-1.5">Linguagem</label>
                            <div className="relative">
                              <select 
                                value={profileLanguage}
                                onChange={(e) => setProfileLanguage(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all appearance-none cursor-pointer"
                              >
                                <option value="en">Inglês</option>
                                <option value="pt">Português</option>
                                <option value="es">Espanhol</option>
                              </select>
                              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          </div>

                          <div className="flex justify-end mt-2">
                            <button 
                              type="submit"
                              disabled={isUpdatingSettings}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-2 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer disabled:opacity-50"
                            >
                              {isUpdatingSettings ? "Salvando..." : "Salvar"}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>

                    {/* Section 4: Fuso horário */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
                      <div className="md:col-span-1">
                        <h3 className="text-xs font-bold text-gray-900">Fuso horário</h3>
                        <p className="text-[11px] text-gray-400 font-semibold leading-relaxed mt-1">
                          Por favor, selecione seu fuso horário para que as datas e horas sejam exibidas corretamente de acordo com sua localização.
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <form onSubmit={handleSaveTimezone} className="flex flex-col gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 mb-1.5">Fuso horário</label>
                            <div className="relative">
                              <select 
                                value={profileTimezone}
                                onChange={(e) => setProfileTimezone(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all appearance-none cursor-pointer"
                              >
                                <option value="GMT+01:00">(GMT+01:00) Bruxelas, Copenhague, Madri, Paris</option>
                                <option value="GMT-03:00">(GMT-03:00) Brasília, São Paulo, Rio de Janeiro</option>
                                <option value="GMT+00:00">(GMT+00:00) Londres, Dublin, Lisboa</option>
                                <option value="GMT-05:00">(GMT-05:00) Eastern Time (US & Canada)</option>
                              </select>
                              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          </div>

                          <div className="flex justify-end mt-2">
                            <button 
                              type="submit"
                              disabled={isUpdatingSettings}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-2 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer disabled:opacity-50"
                            >
                              {isUpdatingSettings ? "Salvando..." : "Salvar"}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>

                    {/* Section 5: Data e hora */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6 border-b border-gray-100">
                      <div className="md:col-span-1">
                        <h3 className="text-xs font-bold text-gray-900">Data e hora</h3>
                        <p className="text-[11px] text-gray-400 font-semibold leading-relaxed mt-1">
                          Configure o formato em que prefere exibir datas e horas na plataforma.
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <form onSubmit={handleSaveDateTimeFormat} className="flex flex-col gap-4">
                          <div className="grid grid-cols-2 gap-6">
                            
                            {/* Date Format Radios */}
                            <div>
                              <span className="block text-[10px] font-bold text-gray-400 mb-2.5">Formato de data</span>
                              <div className="flex flex-col gap-2">
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="radio" 
                                    name="dateFormat"
                                    checked={profileDateFormat === "DD-MM-AAAA"}
                                    onChange={() => setProfileDateFormat("DD-MM-AAAA")}
                                    className="w-3.5 h-3.5 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                  />
                                  <span className="text-xs font-semibold text-gray-700">DD-MM-AAAA</span>
                                </label>
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="radio" 
                                    name="dateFormat"
                                    checked={profileDateFormat === "MM-DD-AAAA"}
                                    onChange={() => setProfileDateFormat("MM-DD-AAAA")}
                                    className="w-3.5 h-3.5 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                  />
                                  <span className="text-xs font-semibold text-gray-700">MM-DD-AAAA</span>
                                </label>
                              </div>
                            </div>

                            {/* Time Format Radios */}
                            <div>
                              <span className="block text-[10px] font-bold text-gray-400 mb-2.5">Formato de tempo</span>
                              <div className="flex flex-col gap-2">
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="radio" 
                                    name="timeFormat"
                                    checked={profileTimeFormat === "24"}
                                    onChange={() => setProfileTimeFormat("24")}
                                    className="w-3.5 h-3.5 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                  />
                                  <span className="text-xs font-semibold text-gray-700">24</span>
                                </label>
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="radio" 
                                    name="timeFormat"
                                    checked={profileTimeFormat === "12"}
                                    onChange={() => setProfileTimeFormat("12")}
                                    className="w-3.5 h-3.5 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                  />
                                  <span className="text-xs font-semibold text-gray-700">12</span>
                                </label>
                              </div>
                            </div>

                          </div>

                          <div className="flex justify-end mt-2">
                            <button 
                              type="submit"
                              disabled={isUpdatingSettings}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-2 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer disabled:opacity-50"
                            >
                              {isUpdatingSettings ? "Salvando..." : "Salvar"}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>

                    {/* Section 6: Status da conta */}
                    <div className="py-6 last:pb-0 flex flex-col gap-4">
                      <div>
                        <h3 className="text-xs font-bold text-gray-900">Status da conta</h3>
                        <p className="text-[11px] text-gray-400 font-semibold leading-relaxed mt-1">
                          Se desejar encerrar sua conta permanentemente, você pode fazê-lo aqui.
                        </p>
                      </div>
                      
                      <div className="border-t border-gray-100/80 my-2"></div>
                      
                      <div className="flex justify-end">
                        <button 
                          onClick={handleDeleteAccount}
                          className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-md shadow-red-500/10 cursor-pointer"
                        >
                          Excluir conta
                        </button>
                      </div>
                    </div>

                  </div>
                )}

                {/* SUBTAB 4B: INFORMAÇÕES FISCAIS */}
                {settingsSubTab === "fiscais" && (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Left Header info */}
                      <div className="md:col-span-1">
                        <h3 className="text-xs font-bold text-gray-900">Informações de contato</h3>
                        <p className="text-[11px] text-gray-400 font-semibold leading-relaxed mt-1">
                          Gerencie e atualize suas informações pessoais com facilidade.
                        </p>
                      </div>

                      {/* Right Form Inputs matching Mockup 4 */}
                      <div className="md:col-span-2">
                        <form onSubmit={handleSaveFiscalInfo} className="flex flex-col gap-4">
                          
                          {/* Tipo (Pills Toggle) */}
                          <div>
                            <span className="block text-[10px] font-bold text-gray-400 mb-1.5">Tipo</span>
                            <div className="flex gap-2 w-fit bg-gray-50 border border-gray-100 rounded-xl p-1">
                              <button
                                type="button"
                                onClick={() => setFiscalType("empresa")}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  fiscalType === "empresa"
                                    ? "bg-white text-indigo-600 shadow-sm border border-gray-100"
                                    : "text-gray-500 hover:text-gray-800 border border-transparent"
                                }`}
                              >
                                Empresa
                              </button>
                              <button
                                type="button"
                                onClick={() => setFiscalType("privado")}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  fiscalType === "privado"
                                    ? "bg-white text-indigo-600 shadow-sm border border-gray-100"
                                    : "text-gray-500 hover:text-gray-800 border border-transparent"
                                }`}
                              >
                                Privado
                              </button>
                            </div>
                          </div>

                          {/* Nome da Empresa */}
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 mb-1.5">
                              Nome da empresa *
                            </label>
                            <input 
                              type="text"
                              required
                              value={fiscalCompanyName}
                              onChange={(e) => setFiscalCompanyName(e.target.value)}
                              placeholder="Por exemplo, minha empresa"
                              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                            />
                          </div>

                          {/* País */}
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 mb-1.5">País *</label>
                            <div className="relative">
                              <select 
                                value={fiscalCountry}
                                onChange={(e) => setFiscalCountry(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all appearance-none cursor-pointer"
                              >
                                <option value="Brasil">Brasil</option>
                                <option value="Portugal">Portugal</option>
                                <option value="Estados Unidos">Estados Unidos</option>
                                <option value="Espanha">Espanha</option>
                              </select>
                              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          </div>

                          {/* NIF */}
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 mb-1.5">
                              Número de Identificação Fiscal
                            </label>
                            <div className="relative">
                              <input 
                                type="text"
                                value={fiscalNif}
                                onChange={(e) => setFiscalNif(e.target.value)}
                                placeholder="Exemplo 52464690B"
                                className="w-full pl-4 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                              />
                              <span title="Identificação fiscal internacional ou CNPJ/CPF" className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-help">
                                <HelpCircle className="w-4 h-4 text-gray-400" />
                              </span>
                            </div>
                          </div>

                          {/* Nome / Sobrenome */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 mb-1.5">Nome *</label>
                              <input 
                                type="text"
                                required
                                value={fiscalFirstName}
                                onChange={(e) => setFiscalFirstName(e.target.value)}
                                placeholder="Exemplo: Maria"
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 mb-1.5">Sobrenome *</label>
                              <input 
                                type="text"
                                required
                                value={fiscalLastName}
                                onChange={(e) => setFiscalLastName(e.target.value)}
                                placeholder="Eg Smith"
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                              />
                            </div>
                          </div>

                          {/* Endereço */}
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 mb-1.5">Endereço *</label>
                            <input 
                              type="text"
                              required
                              value={fiscalAddress}
                              onChange={(e) => setFiscalAddress(e.target.value)}
                              placeholder="Exemplo: Rua Principal"
                              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                            />
                          </div>

                          {/* Código Postal / Cidade */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 mb-1.5">Código Postal *</label>
                              <input 
                                type="text"
                                required
                                value={fiscalPostalCode}
                                onChange={(e) => setFiscalPostalCode(e.target.value)}
                                placeholder="Exemplo 28028"
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 mb-1.5">Cidade *</label>
                              <input 
                                type="text"
                                required
                                value={fiscalCity}
                                onChange={(e) => setFiscalCity(e.target.value)}
                                placeholder="Exemplo: Londres"
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                              />
                            </div>
                          </div>

                          {/* E-mail */}
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 mb-1.5">E-mail *</label>
                            <input 
                              type="email"
                              required
                              value={fiscalEmail}
                              onChange={(e) => setFiscalEmail(e.target.value)}
                              placeholder="marcusrodrigo2@gmail.com"
                              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                            />
                          </div>

                          {/* Save Button */}
                          <div className="flex justify-end mt-4">
                            <button 
                              type="submit"
                              disabled={isUpdatingSettings}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-2 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer disabled:opacity-50"
                            >
                              {isUpdatingSettings ? "Salvando..." : "Salvar"}
                            </button>
                          </div>

                        </form>
                      </div>

                    </div>
                  </div>
                )}

              </div>

            </div>
          )}

          {/* TAB 5: CONTATE-NOS (CONTACT US) */}
          {activeTab === "contact" && (
            <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 text-left">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Fale com o Suporte</h1>
                <p className="text-xs text-gray-500 font-medium">Tem alguma dúvida ou sugestão? Envie uma mensagem diretamente ao nosso suporte.</p>
              </div>

              {supportSuccess && (
                <div className="w-full bg-green-50 border border-green-100 text-green-700 text-xs font-bold p-4 rounded-xl shadow-sm">
                  {supportSuccess}
                </div>
              )}

              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <form onSubmit={handleSendSupportTicket} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Assunto</label>
                    <input 
                      type="text"
                      required
                      value={supportSubject}
                      onChange={(e) => setSupportSubject(e.target.value)}
                      placeholder="Ex: Problema com transcrição de áudio"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Mensagem</label>
                    <textarea 
                      required
                      rows={5}
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="Descreva detalhadamente a sua dúvida ou o problema encontrado..."
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all resize-none"
                    ></textarea>
                  </div>
                  <div className="flex justify-end mt-2">
                    <button 
                      type="submit"
                      disabled={isSendingSupport}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-3 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {isSendingSupport ? "Enviando..." : "Enviar Mensagem"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </main>

        {/* MODAL: CONVIDAR MEMBRO DA EQUIPE */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white rounded-3xl w-full max-w-[420px] p-6 shadow-2xl border border-gray-100 text-left">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-gray-900">Convidar Novo Membro</h3>
                <button 
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteError(null);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {inviteError && (
                <div className="mb-4 bg-red-50 border border-red-100 text-red-600 text-xs font-bold p-3 rounded-xl">
                  {inviteError}
                </div>
              )}

              <form onSubmit={handleInviteMember} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">E-mail do Membro</label>
                  <input 
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Ex: colega@empresa.com"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Função na Equipe</label>
                  <div className="relative">
                    <select 
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full appearance-none bg-gray-50 border border-gray-100 text-xs font-bold text-gray-700 rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all min-h-[44px]"
                    >
                      <option value="member">Membro (Somente leitura e transcrição)</option>
                      <option value="admin">Administrador (Gerenciamento e Faturamento)</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex gap-3 justify-end mt-4">
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteError(null);
                    }}
                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={isInvitingMember || !inviteEmail.trim()}
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isInvitingMember && <Loader2 className="w-4 h-4 animate-spin" />}
                    Convidar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CRIAR NOVA TRANSCRIÇÃO (+ Criar Novo) */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white rounded-3xl w-full max-w-[540px] p-6 shadow-2xl border border-gray-100 text-left max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-gray-900">Nova Transcrição</h3>
                <button 
                  onClick={() => {
                    setShowUploadModal(false);
                    setFile(null);
                    setUrl("");
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tab Selector */}
              <div className="flex bg-gray-100/80 p-1.5 rounded-2xl mb-6">
                <button
                  onClick={() => setTab("local")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs transition-all duration-200 min-h-[40px] cursor-pointer ${
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
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs transition-all duration-200 min-h-[40px] cursor-pointer ${
                    tab === "online" 
                      ? "bg-white text-indigo-600 shadow-[0_2px_8px_rgb(0,0,0,0.04)]" 
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <LinkIcon className="w-4 h-4" />
                  Arquivo online
                </button>
              </div>

              {/* Upload Area / Attached File Info */}
              {tab === "local" ? (
                file ? (
                  <div className="w-full bg-[#F8FAFF] border border-indigo-100 rounded-xl p-4 flex items-center justify-between gap-3 mb-6 animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                        <FileAudio className="w-5 h-5 animate-pulse" />
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="text-xs font-bold text-gray-900 truncate">{file.name}</p>
                        <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest mt-0.5">
                          {file.size ? (file.size / (1024 * 1024)).toFixed(2) + " MB" : "Arquivo anexado"}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border border-dashed border-indigo-200 bg-[#F8FAFF] rounded-xl flex flex-col items-center justify-center py-10 cursor-pointer hover:bg-indigo-50/50 transition-colors mb-6 group min-h-[140px]"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={(e) => {
                        handleFileUpload(e);
                      }}
                      className="hidden"
                      accept="audio/*,video/*"
                    />
                    <div className="w-10 h-10 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
                      <CloudUpload className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-gray-500">
                      Clique para anexar arquivo ou arraste e solte
                    </p>
                  </div>
                )
              ) : (
                <div className="w-full mb-6">
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-700 mb-2">URL do Vídeo ou Áudio</label>
                    <div className="relative flex items-center h-[48px]">
                      <Link2 className="absolute left-4 w-4 h-4 text-gray-400 z-10" />
                      <input 
                        type="url" 
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full h-full bg-white border border-indigo-100 text-gray-700 text-xs rounded-xl pl-11 pr-4 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-semibold shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Idioma */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-2">Idioma</label>
                <div className="relative">
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full appearance-none bg-gray-50 border border-gray-100 text-gray-700 text-xs rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all font-semibold min-h-[44px]"
                  >
                    <option value="pt">🇧🇷 Português</option>
                    <option value="en">🇺🇸 Inglês</option>
                    <option value="es">🇪🇸 Espanhol</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Pasta (Opcional) */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-2">Salvar na pasta (Opcional)</label>
                <div className="relative">
                  <select 
                    value={selectedFolderUploadId}
                    onChange={(e) => setSelectedFolderUploadId(e.target.value)}
                    className="w-full appearance-none bg-gray-50 border border-gray-100 text-gray-700 text-xs rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all font-semibold min-h-[44px]"
                  >
                    <option value="">📁 Nível Raiz (Sem pasta)</option>
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>📁 {f.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Modo de Transcrição */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-2">Modo de transcrição</label>
                <div className="flex bg-gray-50/80 p-1 rounded-2xl w-full border border-gray-100/50">
                  {/* Rapido */}
                  <button 
                    onClick={() => setTranscribeMode("rapido")}
                    className={`flex-1 flex flex-col items-center justify-center text-center py-2.5 px-2 rounded-xl min-h-[70px] transition-all duration-200 ${
                      transcribeMode === "rapido" 
                        ? "bg-white shadow-[0_2px_8px_rgb(0,0,0,0.06)]" 
                        : "hover:bg-gray-100/50"
                    }`}
                  >
                    <Zap className={`w-4 h-4 mb-1 ${transcribeMode === "rapido" ? "text-indigo-600" : "text-gray-400"}`} />
                    <span className={`text-[11px] font-semibold ${transcribeMode === "rapido" ? "text-indigo-600" : "text-gray-700"}`}>
                      Rápido
                    </span>
                    <span className="text-[9px] text-gray-400 mt-0.5">(Menos preciso)</span>
                  </button>

                  {/* Equilibrado */}
                  <button 
                    onClick={() => setTranscribeMode("equilibrado")}
                    className={`flex-1 flex flex-col items-center justify-center text-center py-2.5 px-2 rounded-xl min-h-[70px] transition-all duration-200 mx-1 ${
                      transcribeMode === "equilibrado" 
                        ? "bg-white shadow-[0_2px_8px_rgb(0,0,0,0.06)]" 
                        : "hover:bg-gray-100/50"
                    }`}
                  >
                    <Settings2 className={`w-4 h-4 mb-1 ${transcribeMode === "equilibrado" ? "text-indigo-600" : "text-gray-400"}`} />
                    <span className={`text-[11px] font-semibold ${transcribeMode === "equilibrado" ? "text-indigo-600" : "text-gray-700"}`}>
                      Equilibrado
                    </span>
                    <span className="text-[9px] text-gray-400 mt-0.5">(Médio)</span>
                  </button>

                  {/* Preciso */}
                  <button 
                    onClick={() => setTranscribeMode("preciso")}
                    className={`flex-1 flex flex-col items-center justify-center text-center py-2.5 px-2 rounded-xl min-h-[70px] transition-all duration-200 ${
                      transcribeMode === "preciso" 
                        ? "bg-white shadow-[0_2px_8px_rgb(0,0,0,0.06)]" 
                        : "hover:bg-gray-100/50"
                    }`}
                  >
                    <Target className={`w-4 h-4 mb-1 ${transcribeMode === "preciso" ? "text-indigo-600" : "text-gray-400"}`} />
                    <span className={`text-[11px] font-semibold ${transcribeMode === "preciso" ? "text-indigo-600" : "text-gray-700"}`}>
                      Preciso
                    </span>
                    <span className="text-[9px] text-gray-400 mt-0.5">(Mais lento)</span>
                  </button>
                </div>
              </div>

              {/* Opções Avançadas */}
              <div className="mb-2">
                <button 
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                  className={`flex items-center gap-1.5 text-xs font-[600] transition-colors ${isAdvancedOpen ? "text-indigo-500" : "text-gray-700 hover:text-gray-900"}`}
                >
                  Opções avançadas
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isAdvancedOpen ? "rotate-180 text-indigo-500" : "text-gray-400"}`} />
                </button>

                {isAdvancedOpen && (
                  <div className="mt-4 flex flex-col gap-4 pl-1 animate-[fadeIn_0.2s_ease-out]">
                    {/* Reconhecer falantes */}
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center mt-0.5 min-w-[18px] min-h-[18px]">
                        <input 
                          type="checkbox" 
                          className="appearance-none w-[18px] h-[18px] border border-gray-200 rounded-[5px] checked:bg-indigo-600 checked:border-indigo-600 transition-colors peer cursor-pointer"
                          checked={recognizeSpeakers}
                          onChange={(e) => setRecognizeSpeakers(e.target.checked)}
                        />
                        <Check className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" strokeWidth={3} />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-[600] text-gray-800">Reconhecer falantes</span>
                        <span className="text-[10px] text-gray-400 font-medium mt-0.5">Identifica automaticamente cada pessoa no áudio.</span>
                      </div>
                    </label>

                    {/* Traduzir para outro idioma */}
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center mt-0.5 min-w-[18px] min-h-[18px]">
                        <input 
                          type="checkbox" 
                          className="appearance-none w-[18px] h-[18px] border border-gray-200 rounded-[5px] checked:bg-indigo-600 checked:border-indigo-600 transition-colors peer cursor-pointer"
                          checked={translateAudio}
                          onChange={(e) => setTranslateAudio(e.target.checked)}
                        />
                        <Check className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" strokeWidth={3} />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-[600] text-gray-800">Traduzir para Inglês</span>
                        <span className="text-[10px] text-gray-400 font-medium mt-0.5">Gera a transcrição diretamente traduzida para inglês.</span>
                      </div>
                    </label>

                    {/* Restaurar áudio */}
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center mt-0.5 min-w-[18px] min-h-[18px]">
                        <input 
                          type="checkbox" 
                          className="appearance-none w-[18px] h-[18px] border border-gray-200 rounded-[5px] checked:bg-indigo-600 checked:border-indigo-600 transition-colors peer cursor-pointer"
                          checked={restoreAudio}
                          onChange={(e) => setRestoreAudio(e.target.checked)}
                        />
                        <Check className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" strokeWidth={3} />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-[600] text-gray-800">Restaurar áudio</span>
                        <span className="text-[10px] text-gray-400 font-medium mt-0.5">Remove ruído de fundo e melhora a nitidez das vozes.</span>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-5 border-t border-gray-100 mt-6">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setFile(null);
                    setUrl("");
                  }}
                  className="px-5 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    startTranscription();
                    setShowUploadModal(false);
                  }}
                  disabled={((tab === "local" && !file) || (tab === "online" && !url)) || isTranscribing}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-indigo-600/10 transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Transcrevendo...
                    </>
                  ) : (
                    "Transcrever"
                  )}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* MODAL: CRIAR NOVA PASTA */}
        {showCreateFolderModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white rounded-3xl w-full max-w-[400px] p-6 shadow-2xl border border-gray-100 text-left">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-gray-900">Nova Pasta</h3>
                <button 
                  onClick={() => setShowCreateFolderModal(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateFolder}>
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Nome da pasta</label>
                  <input 
                    type="text" 
                    required
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Ex: Reuniões de Marketing"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button 
                    type="button" 
                    onClick={() => setShowCreateFolderModal(false)}
                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={isCreatingFolder || !newFolderName.trim()}
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isCreatingFolder && <Loader2 className="w-4 h-4 animate-spin" />}
                    Criar Pasta
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans relative overflow-x-hidden">
      {/* Top Background Glow (from mockup) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/10 rounded-[100%] blur-[80px] pointer-events-none" />

      {/* Header */}
      <header className="w-full flex items-center justify-between px-6 py-4 relative z-20">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setViewMode("transcribe"); setResult(null); }}>
          <div className="w-8 h-8 bg-indigo-500 rounded-md flex items-center justify-center shadow-sm">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">Transcribe</span>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          <button onClick={() => { setViewMode("transcribe"); setResult(null); }} className={`text-sm font-semibold transition-colors ${viewMode === 'transcribe' ? 'text-indigo-600' : 'text-gray-900 hover:text-indigo-600'}`}>Como funciona</button>
          <button onClick={() => setViewMode("pricing")} className={`text-sm font-semibold transition-colors ${viewMode === 'pricing' ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600'}`}>Preços</button>
          <button onClick={() => setViewMode("faq")} className={`text-sm font-semibold transition-colors ${viewMode === 'faq' ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600'}`}>Perguntas frequentes</button>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <button onClick={() => setViewMode("history")} className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors px-3 py-2">
                Histórico
              </button>
              <button onClick={() => setViewMode("plan")} className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold px-5 py-2.5 rounded-md transition-all shadow-sm">
                Minha Conta
              </button>
              <button onClick={async () => { await supabase.auth.signOut(); setUser(null); }} className="text-sm font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 px-4 py-2.5 rounded-md transition-all shadow-sm">
                Sair
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setShowLoginModal(true)} className="text-sm font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 px-5 py-2.5 rounded-md transition-all shadow-sm">
                Entrar
              </button>
              <button onClick={() => setShowSignupModal(true)} className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold px-5 py-2.5 rounded-md transition-all shadow-sm">
                Criar Conta
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex flex-col items-center pt-16 pb-10 px-4 relative z-10 w-full max-w-5xl mx-auto">
        
        {/* Hero Section */}
        {viewMode === "transcribe" && !isTranscribing && (
          <div className="text-center mb-10 w-full animate-[fadeIn_0.3s_ease-out]">
            <h1 className="text-[32px] md:text-[40px] font-bold text-gray-900 tracking-tight mb-4">
              Transcreva seus áudios e vídeos online
            </h1>
            <p className="text-base text-gray-500 font-medium">
              Transcreva com precisão em apenas alguns segundos.
            </p>
          </div>
        )}


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
                 <div className="flex flex-col gap-1 w-48">
                   <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold">
                     <span>Progresso</span>
                     <span>{Math.round(transcriptionProgress)}%</span>
                   </div>
                   <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative">
                     <div 
                       className="absolute top-0 left-0 h-full bg-indigo-600 rounded-full transition-all duration-500 ease-out animate-[pulse_2s_infinite]" 
                       style={{ width: `${transcriptionProgress}%` }}
                     />
                   </div>
                 </div>
              </div>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-1.5 text-gray-400 text-sm font-medium">
                   <Clock className="w-4 h-4" />
                   <div className="h-2 w-12 bg-gray-200 rounded-full overflow-hidden relative">
                     <div 
                       className="absolute top-0 left-0 h-full bg-gray-300 rounded-full transition-all duration-500"
                       style={{ width: `${transcriptionProgress}%` }}
                     />
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
               <div className="w-[96px] h-[96px] bg-[#F8FAFF] rounded-full flex flex-col items-center justify-center mb-6 relative border-[6px] border-white shadow-[0_0_0_1px_rgba(99,102,241,0.1)]">
                 <span className="text-lg font-extrabold text-indigo-600 tracking-tight">{Math.round(transcriptionProgress)}%</span>
                 <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5">Whisper</span>
               </div>
               <h3 className="text-[16px] font-bold text-gray-900 mb-2">Estamos processando sua transcrição...</h3>
               <p className="text-[13px] font-medium text-gray-500">
                 {jobStatus === "processing" ? "Extraindo áudio e transcrevendo..." : "Aguardando na fila de processamento..."}
               </p>
            </div>
          </div>
        </div>
      ) : !result ? (
        <>
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

        {/* Pasta (Opcional) */}
        {user && (
          <div className="mb-8">
            <label className="block text-[13px] font-semibold text-gray-700 mb-2">Salvar na pasta (Opcional)</label>
            <div className="relative">
              <select 
                value={selectedFolderUploadId}
                onChange={(e) => setSelectedFolderUploadId(e.target.value)}
                className="w-full appearance-none bg-white border border-gray-200 text-gray-700 text-[14px] rounded-xl px-4 py-3.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium min-h-[48px]"
              >
                <option value="">📁 Nível Raiz (Sem pasta)</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>📁 {f.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}

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

          <div className="w-full bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8 flex flex-col md:flex-row gap-8">
            
            {/* Left Sidebar: Folders */}
            <div className="w-full md:w-[240px] shrink-0 md:border-r border-gray-100 pb-6 md:pb-0 md:pr-6 flex flex-col gap-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-bold tracking-wider text-gray-400 uppercase">Pastas</span>
                <button 
                  onClick={() => setShowCreateFolderModal(true)} 
                  className="p-1 text-indigo-600 hover:text-indigo-800 transition-colors"
                  title="Criar Nova Pasta"
                >
                  <FolderPlus className="w-[18px] h-[18px]" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                {/* Todas */}
                <button
                  onClick={() => setSelectedFolderId("all")}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-semibold transition-all ${
                    selectedFolderId === "all"
                      ? "bg-indigo-50 text-indigo-600 shadow-[0_2px_8px_rgba(99,102,241,0.04)]"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Folder className="w-4 h-4" />
                  Todas as transcrições
                </button>

                {/* Sem pasta */}
                <button
                  onClick={() => setSelectedFolderId("root")}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-semibold transition-all ${
                    selectedFolderId === "root"
                      ? "bg-indigo-50 text-indigo-600 shadow-[0_2px_8px_rgba(99,102,241,0.04)]"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Folder className="w-4 h-4 text-gray-400" />
                  Nível Raiz (Sem pasta)
                </button>

                {/* List Folders */}
                {folders.map((f) => (
                  <div 
                    key={f.id}
                    className={`group flex items-center justify-between px-3 py-2 rounded-xl text-left text-sm font-semibold transition-all cursor-pointer ${
                      selectedFolderId === f.id
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                    onClick={() => setSelectedFolderId(f.id)}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Folder className={`w-4 h-4 shrink-0 ${selectedFolderId === f.id ? "text-indigo-500" : "text-indigo-400"}`} />
                      <span className="truncate">{f.name}</span>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteFolder(f.id, e)} 
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Side: Jobs List */}
            <div className="flex-1 min-w-0">
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
                  <h3 className="text-base font-bold text-gray-900 mb-1">Nenhuma transcrição</h3>
                  <p className="text-sm text-gray-500 max-w-xs">Nenhum áudio ou vídeo encontrado neste local.</p>
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
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`p-2.5 rounded-xl shrink-0 ${
                            isCompleted ? 'bg-green-50 text-green-600' :
                            isFailed ? 'bg-red-50 text-red-600' :
                            'bg-indigo-50 text-indigo-600'
                          }`}>
                            <FileAudio className="w-5 h-5" />
                          </div>
                          <div className="text-left min-w-0">
                            <h4 className="text-sm font-bold text-gray-900 truncate" title={job.filename}>
                              {job.filename || "Gravação de Áudio"}
                            </h4>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 font-medium">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {date}
                              </span>
                              <span className="truncate max-w-[100px]" title={job.job_id}>ID: {job.job_id.substring(0, 8)}...</span>
                              {job.folder_id && (
                                <span className="flex items-center gap-1 bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                  <Folder className="w-2.5 h-2.5" />
                                  {folders.find(f => f.id === job.folder_id)?.name || "Pasta"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          {/* Folder Selector to MOVE Job */}
                          <select
                            value={job.folder_id || ""}
                            onChange={(e) => handleMoveJob(job.job_id, e.target.value || null)}
                            className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 text-[11px] rounded-lg px-2 py-1 outline-none font-semibold transition-all max-w-[120px]"
                            title="Mover para pasta"
                          >
                            <option value="">📁 Sem pasta</option>
                            {folders.map(f => (
                              <option key={f.id} value={f.id}>📁 {f.name}</option>
                            ))}
                          </select>

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
                      onClick={() => { setCheckoutStep("plans"); setIsCheckingOut(false); setCheckoutError(null); }}
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

      {/* ── Minha Conta View ── */}
      {viewMode === "plan" && (
        <div className="w-full max-w-[540px] z-10 animate-[fadeIn_0.3s_ease-out]">
          
          <div className="flex items-center gap-5 mb-8 pb-6 border-b border-zinc-100">
            <div className="w-16 h-16 bg-zinc-50 text-zinc-800 rounded-lg flex items-center justify-center font-bold text-xl border border-zinc-200">
              M
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Minha Conta</h2>
              <p className="text-xs text-zinc-500 font-medium">mapatechltda@gmail.com</p>
            </div>
            <button className="text-[10px] font-bold text-zinc-600 hover:text-zinc-900 border border-zinc-200 hover:bg-zinc-50 transition-colors uppercase tracking-widest px-4 py-2 rounded-md">
              Editar Perfil
            </button>
          </div>

          {/* Plano Card */}
          <div className="bg-white border border-zinc-100 rounded-xl p-7 mb-5 shadow-[0_12px_40px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-1.5 bg-orange-50 rounded-md">
                <Zap className="w-4 h-4 text-orange-500" />
              </div>
              <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-widest">Assinatura</h3>
            </div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-base font-bold text-zinc-900 tracking-tight">Premium Anual</span>
                <span className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md ${
                  subscriptionData?.status === "active" ? "bg-green-50 text-green-600 border border-green-100"
                  : subscriptionData?.status === "cancelled" ? "bg-red-50 text-red-600 border border-red-100"
                  : "bg-zinc-50 text-zinc-500 border border-zinc-200"
                }`}>
                  {subscriptionData?.status === "active" ? "Ativo" : subscriptionData?.status === "cancelled" ? "Cancelado" : "Inativo"}
                </span>
              </div>
              <span className="text-sm font-semibold text-zinc-500">R$ 150,00 <span className="text-xs font-normal">/ ano</span></span>
            </div>
            <div className="space-y-4 pt-5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-medium tracking-wide">Válido até</span>
                <span className="text-zinc-800 font-medium">{subscriptionData?.expires_at ? formatDate(subscriptionData.expires_at) : "—"}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-medium tracking-wide">Criado em</span>
                <span className="text-zinc-800 font-medium">{subscriptionData?.created_at ? formatDate(subscriptionData.created_at) : "—"}</span>
              </div>
              {subscriptionData?.last_order_id && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-medium tracking-wide">Pedido</span>
                  <span className="text-zinc-800 font-mono text-[10px] truncate max-w-[180px] px-2 py-1 bg-zinc-50 rounded-md border border-zinc-100">{subscriptionData.last_order_id}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-zinc-50/50 border border-zinc-100 rounded-xl p-6 mb-5">
            <p className="text-[10px] font-bold text-zinc-400 mb-4 uppercase tracking-widest">Incluído no seu plano</p>
            <div className="space-y-3">
              {["Transcrições ilimitadas", "Reconhecimento de falantes", "Tradução simultânea", "Restauração de áudio", "Suporte premium"].map(f => (
                <div key={f} className="flex items-center gap-3 text-xs font-medium text-zinc-600">
                  <div className="w-1 h-1 bg-orange-400 rounded-full" />
                  {f}
                </div>
              ))}
            </div>
          </div>

          {subscriptionData?.status === "active" && (
            <button
              onClick={() => { setShowCancelModal(true); setCancelStep("confirm"); setCancelError(null); }}
              className="w-full py-3.5 border border-red-200 bg-transparent text-red-500 hover:bg-red-50 text-[11px] font-bold tracking-widest uppercase transition-all rounded-lg"
            >
              Cancelar assinatura
            </button>
          )}

          {subscriptionData?.status === "cancelled" && (
            <div className="bg-white border border-zinc-200 rounded-xl p-6 text-center shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
              <p className="text-xs text-zinc-500 font-medium mb-5">Sua assinatura foi cancelada, mas você mantém o acesso até a data de expiração.</p>
              <button 
                onClick={handleInstantCheckout}
                disabled={isInstantCheckingOut}
                className="w-full px-4 py-3 bg-zinc-900 text-white hover:bg-zinc-800 text-[11px] font-bold uppercase tracking-widest transition-all rounded-lg shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isInstantCheckingOut ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  "Reativar Plano"
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Pricing View ── */}
      {viewMode === "pricing" && (
        <div className="w-full max-w-4xl z-10 animate-[fadeIn_0.3s_ease-out] flex flex-col items-center">
          <div className="text-center mb-8">
            <h1 className="text-[32px] md:text-[40px] font-bold text-gray-900 tracking-tight mb-2">
              Inicie sua assinatura do Transcribe
            </h1>
            <p className="text-base text-gray-500 font-medium">
              Converta áudio e vídeo em texto em segundos com a mais alta qualidade.
            </p>
          </div>


          {/* Pricing Card */}
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8 md:p-10 mb-16">
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 mb-8">
              <div className="text-center">
                <p className="text-sm font-bold text-gray-900 mb-2">Hoje</p>
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-2">R$ 5,00</h2>
                <p className="text-xs text-gray-500 font-medium">Teste gratuito de 7 dias</p>
              </div>
              <div className="hidden md:block w-px h-24 bg-gray-100"></div>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-900 mb-2">Então</p>
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-2">R$ 150,00</h2>
                <p className="text-xs text-gray-500 font-medium">anual</p>
              </div>
            </div>

            <div className="bg-[#F8FAFC] rounded-2xl p-6 mb-8 text-center">
              <p className="text-xs text-gray-500 leading-relaxed font-medium">
                Ao ativar seu teste de 7 dias por <strong className="text-gray-700">R$ 5,00</strong>, você inicia uma <strong className="text-gray-700">assinatura anual recorrente</strong>. Após o término do período de teste, a taxa padrão de <strong className="text-gray-700">R$ 150,00</strong> será cobrada automaticamente todos os anos. Você pode cancelar a qualquer momento pelo seu painel de controle. Para evitar a cobrança de <strong className="text-gray-700">R$ 150,00</strong>, você deve cancelar pelo menos <strong className="text-gray-700">1 hora</strong> antes do término do período de teste.
              </p>
            </div>

            <div className="flex flex-col items-center">
              <button 
                onClick={handleInstantCheckout}
                disabled={isInstantCheckingOut}
                className="w-full max-w-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-lg transition-all shadow-sm text-sm mb-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isInstantCheckingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Redirecionando...
                  </>
                ) : (
                  "Comece o teste gratuito em 7 dias."
                )}
              </button>
              <p className="text-xs text-gray-500 font-medium">Cancele a qualquer momento.</p>
            </div>
          </div>

          {/* Features Table */}
          <div className="w-full mb-20">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Funcionalidades e condições da assinatura:</h2>
            
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="py-4 px-2 text-sm font-bold text-gray-900 w-1/2">Funções principais</th>
                    <th className="py-4 px-2 text-sm font-bold text-gray-900 w-1/4 text-center border-l border-gray-100">Teste de 7 dias</th>
                    <th className="py-4 px-2 text-sm font-bold text-gray-900 w-1/4 text-center border-l border-gray-100">Assinatura anual</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {[
                    { label: "Preço e renovação", trial: "R$ 5,00 (Renovação por R$ 150,00/ano)", sub: "R$ 150,00 por ano" },
                    { label: "Envio de arquivo", trial: "Máximo de 5 arquivos por dia", sub: "Ilimitado" },
                    { label: "Tamanho máximo do arquivo", trial: "Até 2 GB", sub: "Até 5 GB" },
                    { label: "Armazenar", trial: "Apenas por 24 horas.", sub: "Durante 7 dias" },
                    { label: "Organização em pastas", trial: "Não incluído", sub: "Incluído" },
                    { label: "Colaboradores", trial: "Não incluído", sub: "Acesso para toda a equipe" },
                    { label: "Mais de 99 idiomas disponíveis", trial: true, sub: true },
                    { label: "Faça o download em DOCX, PDF, TXT ou SRT.", trial: true, sub: true },
                    { label: "Envio de arquivos em massa", trial: true, sub: true },
                    { label: "Edição de transcrição", trial: true, sub: true },
                    { label: "Carimbos de data/hora opcionais", trial: true, sub: true },
                    { label: "Identificação do falante", trial: true, sub: true },
                    { label: "Resumo da transcrição", trial: true, sub: true },
                  ].map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-2 font-medium text-gray-600">{row.label}</td>
                      <td className="py-4 px-2 text-center border-l border-gray-100">
                        {typeof row.trial === "boolean" ? (
                          row.trial ? <div className="flex justify-center"><div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div></div> : <span className="text-gray-400">—</span>
                        ) : (
                          <span className="text-xs font-semibold text-gray-500">{row.trial}</span>
                        )}
                      </td>
                      <td className="py-4 px-2 text-center border-l border-gray-100">
                        {typeof row.sub === "boolean" ? (
                          row.sub ? <div className="flex justify-center"><div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div></div> : <span className="text-gray-400">—</span>
                        ) : (
                          <span className="text-xs font-semibold text-gray-500">{row.sub}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── FAQ View ── */}
      {viewMode === "faq" && (
        <div className="w-full max-w-3xl z-10 animate-[fadeIn_0.3s_ease-out] mb-20">
          <h1 className="text-[32px] md:text-[40px] font-bold text-gray-900 tracking-tight mb-12">
            Perguntas frequentes
          </h1>

          <div className="space-y-6">
            {[
              { 
                q: "O que acontece exatamente ao final do meu período de teste de 7 dias?", 
                a: "O período de teste custa R$ 5,00 e dura 7 dias corridos. \n\nIMPORTANTE: Se você não cancelar sua assinatura antes do final desse período, sua conta será renovada automaticamente para o plano anual padrão. A partir do oitavo dia, será cobrada automaticamente a taxa de R$ 150,00 por ano até que você cancele nas configurações da sua conta." 
              },
              { 
                q: "Quais são as limitações reais do período de teste de 7 dias?", 
                a: "Durante o período de teste de 7 dias, você pode realizar até 5 transcrições por dia e enviar arquivos com tamanho máximo de 2 GB. Os arquivos que você editar ou criar ficarão armazenados em nossos servidores por apenas 24 horas. Durante esse período, a opção de organizar seus arquivos em pastas ou adicionar colaboradores à sua conta não estará disponível." 
              },
              { 
                q: "Quando devo cancelar para evitar a cobrança da taxa de assinatura anual?", 
                a: "Para evitar a cobrança automática de R$ 150,00, você deve cancelar pelo menos 1 hora antes do término do seu período de teste de 7 dias. Você pode cancelar facilmente a qualquer momento na seção Minha Conta do seu painel de usuário." 
              },
              { 
                q: "Posso solicitar um reembolso se perdi o prazo de cancelamento?", 
                a: "Não oferecemos reembolsos automáticos caso você esqueça de cancelar. Por favor, gerencie sua assinatura ativamente." 
              }
            ].map((faq, idx) => {
              const isOpen = expandedFaqs.includes(idx);
              const toggleFaq = () => {
                if (isOpen) {
                  setExpandedFaqs(expandedFaqs.filter(i => i !== idx));
                } else {
                  setExpandedFaqs([...expandedFaqs, idx]);
                }
              };
              
              return (
              <div key={idx} className="border-b border-gray-200 pb-6">
                <div className="flex items-start gap-4 cursor-pointer" onClick={toggleFaq}>
                  <div className="mt-1 text-indigo-600 font-bold text-xl select-none w-6 text-center">
                    {isOpen ? "—" : "+"}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-medium text-indigo-600 max-w-[90%]">{faq.q}</h3>
                      <span className="text-xs text-indigo-600 font-bold pt-1">({idx + 1})</span>
                    </div>
                    {isOpen && (
                      <p className="text-sm text-gray-600 leading-relaxed font-medium whitespace-pre-wrap animate-[fadeIn_0.2s_ease-out]">
                        {faq.a}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )})}
          </div>
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

      {/* ── 3 Simple Steps Section ── */}
      {viewMode === "transcribe" && !result && !isTranscribing && (
        <section className="w-full max-w-5xl mt-24 mb-16 animate-[fadeIn_0.5s_ease-out]">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              Transcrições precisas em 3 passos simples
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {/* Step 1 */}
            <div className="bg-white rounded-3xl p-8 flex flex-col items-center text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
              <div className="w-24 h-24 mb-6 relative flex items-center justify-center">
                <div className="absolute inset-0 bg-indigo-50 rounded-full scale-110"></div>
                <CloudUpload className="w-10 h-10 text-indigo-500 relative z-10" />
                <div className="absolute top-2 right-2 w-6 h-6 bg-indigo-200/50 rounded-full"></div>
              </div>
              <p className="text-[10px] font-bold text-indigo-500 tracking-widest uppercase mb-4">Passo 1</p>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Faça upload do seu arquivo ou URL</h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">
                Selecione um arquivo ou cole o link do seu áudio ou vídeo e escolha o idioma do áudio.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-3xl p-8 flex flex-col items-center text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
              <div className="w-24 h-24 mb-6 relative flex items-center justify-center">
                <div className="absolute inset-0 bg-indigo-50 rounded-full scale-110"></div>
                <AudioLines className="w-10 h-10 text-indigo-500 relative z-10" />
                <div className="absolute bottom-2 left-2 w-5 h-5 bg-indigo-200/50 rounded-full"></div>
              </div>
              <p className="text-[10px] font-bold text-indigo-500 tracking-widest uppercase mb-4">Passo 2</p>
              <h3 className="text-lg font-bold text-indigo-600 mb-3">Nós processamos seu conteúdo</h3>
              <p className="text-sm text-indigo-600/80 font-medium leading-relaxed">
                Convertemos automaticamente o conteúdo em texto com alta precisão.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-3xl p-8 flex flex-col items-center text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
              <div className="w-24 h-24 mb-6 relative flex items-center justify-center">
                <div className="absolute inset-0 bg-indigo-50 rounded-full scale-110"></div>
                <FileText className="w-10 h-10 text-indigo-500 relative z-10" />
                <div className="absolute top-4 left-2 w-4 h-4 bg-indigo-200/50 rounded-full"></div>
              </div>
              <p className="text-[10px] font-bold text-indigo-500 tracking-widest uppercase mb-4">Passo 3</p>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Ative sua conta para baixar</h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">
                Cadastre-se e pague para se tornar Premium e ter acesso ilimitado para baixar e visualizar seus arquivos e resumos.
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <button 
              onClick={() => { setViewMode("transcribe"); window.scrollTo({top: 0, behavior: 'smooth'}); }}
              className="bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 px-8 rounded-lg transition-all shadow-sm text-sm"
            >
              Fazer upload
            </button>
          </div>
        </section>
      )}

      {/* ── Login Modal ── */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white w-full max-w-[420px] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Entrar</h3>
              <button onClick={() => setShowLoginModal(false)} className="text-indigo-500 hover:text-indigo-700 p-1 rounded-full hover:bg-indigo-50 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-8 pt-8 pb-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Bem-vindo(a) de volta!</h2>
              <p className="text-sm text-gray-500 font-medium mb-8">
                Entre com suas redes sociais ou complete seus dados.
              </p>

              {/* Form */}
              <div className="space-y-4 mb-6">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                  <input 
                    type="email" 
                    placeholder="nome@email.com" 
                    className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-gray-900"
                  />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Shield className="w-5 h-5 text-gray-400" />
                  </div>
                  <input 
                    type="password" 
                    placeholder="Insira sua senha aqui" 
                    className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-gray-900"
                  />
                </div>
              </div>

              <div className="text-center mb-6">
                <span className="text-xs text-gray-600 font-medium">Esqueceu sua senha? </span>
                <button onClick={() => alert("Enviaremos um link de recuperação para o seu email.")} className="text-xs text-indigo-600 font-medium hover:underline">Clique aqui</button>
              </div>

              <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm text-sm mb-6">
                Entrar
              </button>

              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-xs text-gray-900 font-bold">ou</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              <button onClick={handleGoogleLogin} className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-bold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-3 mb-8 shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Entrar com o Google
              </button>

              <div className="text-center">
                <span className="text-xs text-gray-900 font-medium">Você não tem uma conta? </span>
                <button onClick={() => { setShowLoginModal(false); setShowSignupModal(true); }} className="text-xs text-indigo-600 font-medium hover:underline">Crie uma conta</button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Sign Up Modal ── */}
      {showSignupModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white w-full max-w-[420px] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Criar Conta</h3>
              <button onClick={() => setShowSignupModal(false)} className="text-indigo-500 hover:text-indigo-700 p-1 rounded-full hover:bg-indigo-50 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-8 pt-8 pb-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Comece com o teste de 7 dias</h2>
              <p className="text-sm text-gray-500 font-medium mb-8">
                Crie sua conta com suas redes sociais ou e-mail.
              </p>

              {/* Form */}
              <div className="space-y-4 mb-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                  <input 
                    type="email" 
                    placeholder="nome@email.com" 
                    className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-gray-900"
                  />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Shield className="w-5 h-5 text-gray-400" />
                  </div>
                  <input 
                    type="password" 
                    placeholder="Insira sua senha aqui" 
                    className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-gray-900"
                  />
                </div>
              </div>

              {/* Password Strength Indicator */}
              <div className="flex items-center gap-1.5 mb-6">
                <div className="flex-1 h-1 bg-gray-200 rounded-full"></div>
                <div className="flex-1 h-1 bg-gray-200 rounded-full"></div>
                <div className="flex-1 h-1 bg-gray-200 rounded-full"></div>
                <div className="flex-1 h-1 bg-gray-200 rounded-full"></div>
              </div>

              <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm text-sm mb-6">
                Criar uma conta
              </button>

              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-xs text-gray-900 font-bold">ou</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              <button onClick={handleGoogleLogin} className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-bold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-3 mb-6 shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Criar conta com o Google
              </button>

              <div className="text-center mb-6">
                <span className="text-xs text-gray-900 font-medium">Eu já tenho uma conta </span>
                <button onClick={() => { setShowSignupModal(false); setShowLoginModal(true); }} className="text-xs text-indigo-500 font-medium hover:underline">Entrar</button>
              </div>

              <div className="text-center mt-2 border-t border-gray-100 pt-6">
                <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                  Ao criar uma conta, você reconhece que leu e concorda com os <a href="#" className="font-bold text-gray-700 hover:text-indigo-600">Termos de Uso e Contrato</a> e a <a href="#" className="font-bold text-gray-700 hover:text-indigo-600">Política de Privacidade</a>.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Create Folder Modal ── */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white w-full max-w-[400px] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Nova Pasta</h3>
              <button 
                onClick={() => setShowCreateFolderModal(false)} 
                className="text-gray-400 hover:text-indigo-600 p-1 rounded-full hover:bg-indigo-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="p-6">
              <div className="mb-6">
                <label className="block text-[13px] font-semibold text-gray-700 mb-2">Nome da pasta</label>
                <input 
                  type="text" 
                  required
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Ex: Reuniões de Marketing"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-gray-900 font-medium"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowCreateFolderModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isCreatingFolder || !newFolderName.trim()}
                  className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isCreatingFolder && <Loader2 className="w-4 h-4 animate-spin" />}
                  Criar Pasta
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      </main>
    </div>
  );
}
