import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { ToastContainer, type ToastMessage } from '../../components/admin/Toast';
import { Shield, Key, Save, Server, CheckCircle2 } from 'lucide-react';

export const AdminSettingsPage: React.FC = () => {
  // Studio Settings State
  const [studioName, setStudioName] = useState('Karsh Tech');
  const [tagline, setTagline] = useState('Crafting Next-Gen Gaming Experiences');
  const [contactEmail, setContactEmail] = useState('contact@karshtech.com');
  const [announcement, setAnnouncement] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await api.getAdminSettings();
        if (res.settings) {
          setStudioName(res.settings.studio_name || 'Karsh Tech');
          setTagline(res.settings.tagline || '');
          setContactEmail(res.settings.contact_email || 'contact@karshtech.com');
          setAnnouncement(res.settings.announcement || '');
        }
      } catch (err: any) {
        console.error('Failed to load settings', err);
      }
    }
    loadSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.updateAdminSettings({
        studio_name: studioName,
        tagline,
        contact_email: contactEmail,
        announcement,
      });
      showToast('success', 'Studio configuration updated successfully!');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('error', 'New password and confirmation do not match');
      return;
    }
    if (newPassword.length < 8) {
      showToast('error', 'New password must be at least 8 characters long');
      return;
    }

    setSavingPassword(true);
    try {
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      showToast('success', 'Admin password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast('error', err.message || 'Password update failed');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <AdminLayout title="Studio &amp; Security Settings">
      <div className="space-y-8 max-w-4xl mx-auto">
        {/* Section 1: Studio Profile Settings */}
        <div className="p-6 bg-[#1A191F] border border-[#39363A] rounded-md space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-[#39363A]">
            <div className="p-2.5 rounded bg-[#242329] border border-[#39363A] text-[#FF5A36]">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#F4F0E8]">
                STUDIO PUBLIC METADATA
              </h2>
              <p className="text-xs text-[#96929A]">
                Configure studio brand details, public contact address, and broadcast banners displayed across the platform.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
                  Studio Name
                </label>
                <input
                  type="text"
                  required
                  value={studioName}
                  onChange={(e) => setStudioName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] focus:outline-none focus:border-[#FF5A36] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
                  Public Contact Email
                </label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] focus:outline-none focus:border-[#FF5A36] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
                Studio Motto / Tagline
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] focus:outline-none focus:border-[#FF5A36] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
                Optional Broadcast Banner (Displayed On Homepage)
              </label>
              <input
                type="text"
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="e.g. Arrow Puzzle v1.0.0 is officially released! Download the APK now."
                className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A]/50 focus:outline-none focus:border-[#FF5A36] transition-colors"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF5A36] text-[#101014] font-bold text-xs uppercase tracking-[0.16em] rounded transition-all hover:brightness-110 active:scale-95 shadow-[0_2px_12px_rgba(255,90,54,0.3)] disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingSettings ? 'Saving...' : 'Save Studio Metadata'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Section 2: Security & Credentials */}
        <div className="p-6 bg-[#1A191F] border border-[#39363A] rounded-md space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-[#39363A]">
            <div className="p-2.5 rounded bg-[#242329] border border-[#39363A] text-[#FF5A36]">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#F4F0E8]">
                UPDATE MASTER PASSWORD
              </h2>
              <p className="text-xs text-[#96929A]">
                Enhance your publishing console security with an updated master cryptographic credential.
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
                Current Password *
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A]/50 focus:outline-none focus:border-[#FF5A36] transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
                  New Password (Min 8 Characters) *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A]/50 focus:outline-none focus:border-[#FF5A36] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A]/50 focus:outline-none focus:border-[#FF5A36] transition-colors"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingPassword}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#242329] border border-[#39363A] text-[#F4F0E8] hover:border-[#FF5A36]/60 text-xs font-semibold uppercase tracking-[0.16em] rounded transition-all disabled:opacity-50"
              >
                <Shield className="w-4 h-4 text-[#FF5A36]" />
                <span>{savingPassword ? 'Updating...' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Section 3: Architecture & Storage Status */}
        <div className="p-5 bg-[#1A191F] border border-[#39363A] rounded-md space-y-3 text-xs text-[#96929A]">
          <div className="text-[#F4F0E8] font-bold flex items-center gap-2 font-mono uppercase tracking-wider text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-[#34D399]" />
            <span>Platform Infrastructure &amp; Security Specs</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            <div>Database: <span className="text-[#F4F0E8] font-mono">Atomic Persistent JSON Store</span></div>
            <div>APK Storage: <span className="text-[#F4F0E8] font-mono">/server/uploads/apks</span></div>
            <div>Password Hash: <span className="text-[#F4F0E8] font-mono">Bcrypt Salt Rounds 10</span></div>
            <div>Rate Limiter: <span className="text-[#FF5A36] font-mono">Active (5 fails / 15m)</span></div>
          </div>
        </div>
      </div>

      {/* Toasts */}
      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </AdminLayout>
  );
};
