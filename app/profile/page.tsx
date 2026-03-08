'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, User, BadgeCheck, Clock, Link2, Loader2, CheckCircle, XCircle, AlertCircle, Search, LinkIcon } from 'lucide-react';

interface ProfileData {
  discord: {
    userId: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    linkedAt: number;
  };
  student: {
    id: string;
    callsign: string;
    student_name: string;
    student_id: string;
    batch: string;
    created_at: string;
    discord_id: string | null;
    discord_username: string | null;
    discord_avatar: string | null;
    discord_linked_at: string | null;
  } | null;
  isInstructor: boolean;
}

interface SearchResult {
  id: string;
  callsign: string;
  name: string | null;
  batch: string | null;
  isLinked: boolean;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Manual linking states
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/auth/profile');
      if (!res.ok) {
        throw new Error('Failed to fetch profile');
      }
      const data = await res.json();
      setProfile(data);
    } catch (err) {
      setError('無法載入個人資料');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSearch = async () => {
    if (searchQuery.length < 3) return;
    
    setIsSearching(true);
    setLinkError(null);
    try {
      const res = await fetch(`/api/auth/link-student?callsign=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data.students || []);
      } else {
        setLinkError(data.error);
      }
    } catch (err) {
      setLinkError('搜尋失敗');
    } finally {
      setIsSearching(false);
    }
  };

  const handleLink = async (studentId: string) => {
    setIsLinking(true);
    setLinkError(null);
    try {
      const res = await fetch('/api/auth/link-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowLinkModal(false);
        setSearchQuery('');
        setSearchResults([]);
        // Refresh profile
        setIsLoading(true);
        await fetchProfile();
      } else {
        setLinkError(data.error);
      }
    } catch (err) {
      setLinkError('連結失敗');
    } finally {
      setIsLinking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-cream/60">{error || '無法載入個人資料'}</p>
          <Link href="/" className="text-accent hover:underline mt-4 inline-block">
            返回首頁
          </Link>
        </div>
      </div>
    );
  }

  const discordLinked = !!profile.student?.discord_id;
  const vamsysLinked = !!profile.student; // If student exists, it means vAMSYS data is linked

  return (
    <div className="min-h-screen bg-primary p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link 
            href="/"
            className="p-2 rounded-lg bg-cream/5 hover:bg-cream/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-cream/60" />
          </Link>
          <h1 className="text-2xl font-bold text-cream">個人資料</h1>
        </div>

        <div className="space-y-6">
          {/* Primary Identity Card */}
          <div className="card border border-cream/20">
            <div className="flex items-center gap-2 mb-6">
              <User className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-cream">主要識別</h2>
            </div>
            
            <div className="flex items-center gap-4 mb-6">
              {profile.discord.avatar ? (
                <img 
                  src={`https://cdn.discordapp.com/avatars/${profile.discord.userId}/${profile.discord.avatar}.png?size=128`}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full ring-4 ring-accent/20"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center ring-4 ring-accent/10">
                  <span className="text-2xl font-bold text-accent">
                    {profile.discord.username?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
              <div>
                <p className="text-xl font-bold text-cream">
                  {profile.student?.callsign || profile.discord.username}
                </p>
                <p className="text-cream/50 text-sm">
                  @{profile.discord.username}
                  {profile.discord.discriminator && profile.discord.discriminator !== '0' && (
                    <span>#{profile.discord.discriminator}</span>
                  )}
                </p>
                {profile.isInstructor && (
                  <span className="inline-flex items-center gap-1 mt-2 text-xs bg-accent/20 text-accent px-2 py-1 rounded-full">
                    <BadgeCheck className="w-3 h-3" />
                    教官
                  </span>
                )}
              </div>
            </div>

            {profile.student && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-cream/10">
                <div>
                  <p className="text-cream/40 text-xs mb-1">姓名</p>
                  <p className="text-cream font-medium">{profile.student.student_name}</p>
                </div>
                <div>
                  <p className="text-cream/40 text-xs mb-1">員工編號</p>
                  <p className="text-cream font-mono">{profile.student.student_id}</p>
                </div>
              </div>
            )}
          </div>

          {/* Info & Status Card */}
          <div className="card border border-cream/20">
            <div className="flex items-center gap-2 mb-6">
              <BadgeCheck className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-cream">資訊 / 狀態</h2>
            </div>

            {profile.student ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-cream/10">
                  <span className="text-cream/60">培訓梯次</span>
                  <span className="text-cream font-medium">
                    {profile.student.batch || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-cream/10">
                  <span className="text-cream/60">Discord ID</span>
                  <span className="text-cream/80 font-mono text-sm">
                    {profile.discord.userId}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-cream/60">帳號狀態</span>
                  <span className="inline-flex items-center gap-1.5 text-green-400 bg-green-500/10 px-3 py-1 rounded-full text-sm">
                    <CheckCircle className="w-4 h-4" />
                    已驗證
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <p className="text-cream/60">尚未連結學員資料</p>
                <p className="text-cream/40 text-sm mt-1 mb-4">請搜尋您的 Callsign 進行連結</p>
                <button
                  onClick={() => setShowLinkModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 text-primary-dark rounded-lg font-medium transition-colors"
                >
                  <LinkIcon className="w-4 h-4" />
                  連結學員帳號
                </button>
              </div>
            )}
          </div>

          {/* Time Info Card */}
          <div className="card border border-cream/20">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-cream">時間</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-cream/10">
                <span className="text-cream/60">資料建立時間</span>
                <span className="text-cream/80 text-sm">
                  {profile.student?.created_at 
                    ? new Date(profile.student.created_at).toLocaleString('zh-TW')
                    : '—'
                  }
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-cream/10">
                <span className="text-cream/60">Discord 連結時間</span>
                <span className="text-cream/80 text-sm">
                  {profile.student?.discord_linked_at 
                    ? new Date(profile.student.discord_linked_at).toLocaleString('zh-TW')
                    : '—'
                  }
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-cream/60">本次登入時間</span>
                <span className="text-cream/80 text-sm">
                  {new Date(profile.discord.linkedAt).toLocaleString('zh-TW')}
                </span>
              </div>
            </div>
          </div>

          {/* Link Status Card */}
          <div className="card border border-cream/20">
            <div className="flex items-center gap-2 mb-6">
              <Link2 className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-cream">鏈接狀態</h2>
            </div>

            <div className="space-y-4">
              {/* Discord Link Status */}
              <div className="flex items-center justify-between py-3 px-4 bg-cream/5 rounded-xl">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-[#5865F2]" viewBox="0 0 71 55" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z"/>
                  </svg>
                  <div>
                    <p className="text-cream font-medium">Discord</p>
                    <p className="text-cream/50 text-xs">@{profile.discord.username}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${
                  discordLinked 
                    ? 'bg-green-500/10 text-green-400' 
                    : 'bg-amber-500/10 text-amber-400'
                }`}>
                  {discordLinked ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      已連結
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      待連結
                    </>
                  )}
                </span>
              </div>

              {/* vAMSYS Link Status */}
              <div className="flex items-center justify-between py-3 px-4 bg-cream/5 rounded-xl">
                <div className="flex items-center gap-3">
                  <Image 
                    src="/vamsys-logo.png" 
                    alt="vAMSYS" 
                    width={24} 
                    height={24}
                    className="w-6 h-6 object-contain"
                  />
                  <div>
                    <p className="text-cream font-medium">vAMSYS</p>
                    <p className="text-cream/50 text-xs">
                      {profile.student?.callsign || '飛行員資料'}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${
                  vamsysLinked 
                    ? 'bg-green-500/10 text-green-400' 
                    : 'bg-red-500/10 text-red-400'
                }`}>
                  {vamsysLinked ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      已連結
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      未連結
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-cream/30 text-xs mt-8">
          SJX Training System v2.3.0 © 2025-2026 Virtual Starlux
        </p>
      </div>

      {/* Manual Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-primary-dark border border-cream/20 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-cream/10">
              <h3 className="text-lg font-semibold text-cream">連結學員帳號</h3>
              <p className="text-cream/50 text-sm mt-1">搜尋您的 Callsign（如 SJX1234）</p>
            </div>
            
            <div className="p-6">
              {/* Search Input */}
              <div className="flex gap-2 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="輸入 Callsign..."
                    className="w-full pl-10 pr-4 py-2.5 bg-cream/5 border border-cream/20 rounded-lg text-cream placeholder:text-cream/30 focus:outline-none focus:border-accent"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={searchQuery.length < 3 || isSearching}
                  className="px-4 py-2.5 bg-accent hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed text-primary-dark rounded-lg font-medium transition-colors"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : '搜尋'}
                </button>
              </div>

              {/* Error Message */}
              {linkError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {linkError}
                </div>
              )}

              {/* Search Results */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.length === 0 && searchQuery.length >= 3 && !isSearching && (
                  <p className="text-center text-cream/40 py-4">沒有找到符合的學員</p>
                )}
                {searchResults.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 bg-cream/5 rounded-lg border border-cream/10"
                  >
                    <div>
                      <p className="text-cream font-medium">{student.callsign}</p>
                      <p className="text-cream/50 text-xs">
                        {student.name} {student.batch && `• ${student.batch}`}
                      </p>
                    </div>
                    {student.isLinked ? (
                      <span className="text-cream/40 text-xs">已連結其他帳號</span>
                    ) : (
                      <button
                        onClick={() => handleLink(student.id)}
                        disabled={isLinking}
                        className="px-3 py-1.5 bg-accent hover:bg-accent/80 disabled:opacity-50 text-primary-dark rounded-lg text-sm font-medium transition-colors"
                      >
                        {isLinking ? <Loader2 className="w-3 h-3 animate-spin" /> : '連結'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-cream/10 flex justify-end">
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                  setLinkError(null);
                }}
                className="px-4 py-2 text-cream/60 hover:text-cream transition-colors"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
