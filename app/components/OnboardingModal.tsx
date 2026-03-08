'use client';
import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle, ExternalLink, LogOut } from 'lucide-react';

interface VamsysPilot {
  callsign: string;
  name: string;
  discord_id: string | null;
}

export default function OnboardingModal() {
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  
  // Form states
  const [callsign, setCallsign] = useState('');
  const [pilotName, setPilotName] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifiedPilot, setVerifiedPilot] = useState<VamsysPilot | null>(null);

  useEffect(() => {
    checkLinkStatus();
  }, []);

  const checkLinkStatus = async () => {
    try {
      const res = await fetch('/api/auth/profile');
      if (res.ok) {
        const data = await res.json();
        // Show modal if not linked to student
        if (!data.student) {
          setShowModal(true);
        }
      }
    } catch (err) {
      console.error('Failed to check link status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!callsign.trim() || !pilotName.trim()) {
      setVerifyError('請輸入 Callsign 和顯示名稱');
      return;
    }

    setIsVerifying(true);
    setVerifyError(null);

    try {
      const res = await fetch(`/api/auth/verify-vamsys?callsign=${encodeURIComponent(callsign.trim())}&name=${encodeURIComponent(pilotName.trim())}`);
      const data = await res.json();

      if (res.ok && data.verified) {
        setVerifiedPilot(data.pilot);
        setStep(2);
      } else {
        setVerifyError(data.error || '找不到符合的飛行員資料，請確認您的 Callsign 和顯示名稱是否正確');
      }
    } catch (err) {
      setVerifyError('驗證失敗，請稍後再試');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    window.location.href = '/api/auth/logout';
  };

  if (isLoading || !showModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-secondary border border-cream/20 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-cream/10 flex-shrink-0">
          <h2 className="text-xl font-bold text-cream">歡迎加入 SJX Training</h2>
          <p className="text-cream/60 text-sm mt-1">
            請完成帳號連結以使用完整功能
          </p>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-cream/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${step >= 1 ? 'bg-accent text-primary' : 'bg-cream/10 text-cream/50'}`}>
              1
            </div>
            <div className={`flex-1 h-0.5 ${step >= 2 ? 'bg-accent' : 'bg-cream/10'}`}></div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${step >= 2 ? 'bg-accent text-primary' : 'bg-cream/10 text-cream/50'}`}>
              2
            </div>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-cream/50">驗證身份</span>
            <span className="text-xs text-cream/50">連結 Discord</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-cream/80 text-sm">
                請輸入您在 vAMSYS 上的 Callsign 和顯示名稱以驗證身份
              </p>

              <div>
                <label className="block text-sm text-cream/60 mb-2">Callsign</label>
                <input
                  type="text"
                  value={callsign}
                  onChange={(e) => setCallsign(e.target.value.toUpperCase())}
                  placeholder="例如: SJX001"
                  className="w-full px-4 py-3 bg-primary border border-cream/20 rounded-xl text-cream placeholder:text-cream/30 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>

              <div>
                <label className="block text-sm text-cream/60 mb-2">顯示名稱 (Name Display)</label>
                <input
                  type="text"
                  value={pilotName}
                  onChange={(e) => setPilotName(e.target.value)}
                  placeholder="您在 vAMSYS 上的顯示名稱"
                  className="w-full px-4 py-3 bg-primary border border-cream/20 rounded-xl text-cream placeholder:text-cream/30 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <p className="text-cream/40 text-xs mt-2">
                  可在 <a href="https://auth.vamsys.io/user/settings" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">auth.vamsys.io/user/settings</a> 的 Name Display 欄位查看
                </p>
              </div>

              {verifyError && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={isVerifying || !callsign.trim() || !pilotName.trim()}
                className="w-full px-6 py-3 bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    驗證中...
                  </>
                ) : (
                  '驗證身份'
                )}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {verifiedPilot && (
                <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-green-400 font-medium">身份驗證成功</p>
                    <p className="text-cream/60 text-sm">{verifiedPilot.callsign} - {verifiedPilot.name}</p>
                  </div>
                </div>
              )}

              <div className="bg-primary/50 border border-cream/10 rounded-xl p-4">
                <p className="text-cream font-medium mb-3">方法一：在 vAMSYS 連結 Discord</p>
                <ol className="space-y-3 text-cream/70 text-sm">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-medium">1</span>
                    <span>點擊下方按鈕前往 vAMSYS 社交連結頁面</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-medium">2</span>
                    <span>找到 <strong className="text-cream">Discord</strong>，按下 <strong className="text-cream">Link Account</strong></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-medium">3</span>
                    <span>按照指示完成連結</span>
                  </li>
                </ol>

                <a
                  href="https://auth.vamsys.io/user/social"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 w-full px-4 py-2 bg-cream/10 hover:bg-cream/20 text-cream rounded-lg transition-colors text-sm"
                >
                  前往 vAMSYS 連結 Discord
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-cream/20"></div>
                <span className="text-cream/40 text-sm">或</span>
                <div className="flex-1 h-px bg-cream/20"></div>
              </div>

              {/* Alternative Method */}
              <div className="bg-primary/50 border border-cream/10 rounded-xl p-4">
                <p className="text-cream font-medium mb-3">方法二：透過 Discord 頻道連結</p>
                <ol className="space-y-3 text-cream/70 text-sm">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5865F2]/20 text-[#5865F2] flex items-center justify-center text-xs font-medium">1</span>
                    <span>在 Discord 前往 <strong className="text-cream">🎫 Pilot Access</strong> 頻道</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5865F2]/20 text-[#5865F2] flex items-center justify-center text-xs font-medium">2</span>
                    <span>按下 <strong className="text-cream">Request Access</strong> 按鈕</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5865F2]/20 text-[#5865F2] flex items-center justify-center text-xs font-medium">3</span>
                    <span>按照指示完成連結</span>
                  </li>
                </ol>

                <a
                  href="https://discord.com/channels/1370343145463746652/1455976420374347994"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 w-full px-4 py-2 bg-[#5865F2]/20 hover:bg-[#5865F2]/30 text-[#5865F2] rounded-lg transition-colors text-sm"
                >
                  前往 Discord 頻道
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                <p className="text-amber-400 text-sm">
                  <strong>重要：</strong>完成 vAMSYS Discord 連結後，請重新登入本系統以完成帳號綁定。
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="w-full px-6 py-3 bg-accent hover:bg-accent/90 text-primary rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                重新登入
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-cream/10 flex justify-between items-center flex-shrink-0">
          <p className="text-cream/40 text-xs">
            SJX Training System v2.3.0 © 2025-2026
          </p>
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="text-cream/50 hover:text-cream text-sm transition-colors"
            >
              返回上一步
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
