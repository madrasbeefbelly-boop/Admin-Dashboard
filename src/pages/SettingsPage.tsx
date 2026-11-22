/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Building2,
  Bell,
  Loader2,
  MessageSquare,
  QrCode,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertTriangle,
  Unlink,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useProfile,
  useUpdateProfile,
  useWhatsAppStatus,
  useStartWhatsApp,
  useSaveWhatsAppConfig,
  useDisconnectWhatsApp,
  useSendWhatsAppTest,
} from '@/hooks/api';
import { isMockMode } from '@/lib/mock-mode';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const canManageWhatsApp = isAdmin();
  const mockMode = isMockMode();
  const [formData, setFormData] = useState({
    name: '',
    tagline: '',
    email: '',
    phone: '',
    address: '',
    city: '',
  });
  const [notifications, setNotifications] = useState({
    lowStock: true,
  });

  // WhatsApp hooks & state
  const { data: waStatus, isLoading: waLoading } = useWhatsAppStatus(canManageWhatsApp);
  const { mutate: startWhatsApp, isPending: isStartingWA } = useStartWhatsApp();
  const { mutate: saveWAConfig, isPending: isSavingWA } = useSaveWhatsAppConfig();
  const { mutate: disconnectWA, isPending: isDisconnectingWA } = useDisconnectWhatsApp();
  const { mutate: sendTestWA, isPending: isSendingTestWA } = useSendWhatsAppTest();

  const [waConfig, setWaConfig] = useState({
    targetPhone: '',
    targetGroupId: '',
    alertLowStock: true,
    alertNewOrders: true,
  });

  const savedPhone = waStatus?.targetPhone ?? '';
  const savedGroup = waStatus?.targetGroupId ?? '';
  const savedLowStock = waStatus?.alertLowStock ?? true;
  const savedOrders = waStatus?.alertNewOrders ?? true;
  useEffect(() => {
    setWaConfig({ targetPhone: savedPhone, targetGroupId: savedGroup, alertLowStock: savedLowStock, alertNewOrders: savedOrders });
  }, [savedPhone, savedGroup, savedLowStock, savedOrders]);

  const handleSaveWA = () => {
    if (!waConfig.targetGroupId.trim()) {
      toast.error('Please enter a WhatsApp Group ID.');
      return;
    }
    saveWAConfig(
      {
        targetPhone: '',
        targetGroupId: waConfig.targetGroupId.trim(),
        alertLowStock: waConfig.alertLowStock,
        alertNewOrders: waConfig.alertNewOrders,
      },
      {
        onSuccess: () => {
          toast.success('WhatsApp alert settings saved successfully!');
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.error || 'Failed to save WhatsApp settings');
        },
      }
    );
  };

  const handleSendTestWA = () => {
    const groupTarget = waConfig.targetGroupId.trim() || savedGroup;
    if (!groupTarget) {
      toast.error('Enter or save a WhatsApp Group ID first.');
      return;
    }
    sendTestWA(groupTarget, {
      onSuccess: () => {
        toast.success('Test message queued to group. Its status will update here.');
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.error || 'Failed to send WhatsApp message. Check connection.');
      },
    });
  };

  const handleDisconnectWA = () => {
    disconnectWA(undefined, {
      onSuccess: () => {
        toast.success('WhatsApp unlink requested');
      },
      onError: () => {
        toast.error('Failed to disconnect WhatsApp');
      },
    });
  };

  const handleStartWhatsApp = (refresh: boolean) => {
    startWhatsApp(refresh, {
      onSuccess: () => {
        toast.success('Requested a new WhatsApp QR code.');
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.error || err?.message || 'Failed to trigger WhatsApp bot');
      },
    });
  };

  // API hooks
  const { data: profile, isLoading } = useProfile();
  const { mutate: updateProfile, isPending: saving } = useUpdateProfile();

  // Sync form data with profile data when it loads
  // This is a valid React pattern for syncing with async data from React Query

  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        name: profile.name || prev.name,
        tagline: profile.tagline || prev.tagline,
        email: profile.email || prev.email,
        phone: profile.phone || prev.phone,
        address: profile.address || prev.address,
        city: profile.city || prev.city,
      }));
    }

  }, [profile]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Business name is required');
      return;
    }

    updateProfile(
      {
        name: formData.name,
        tagline: formData.tagline,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
      },
      {
        onSuccess: () => {
          toast.success('Business settings updated successfully!');
        },
        onError: (error: any) => {
          console.error('Error updating profile:', error);
          toast.error('Failed to update business settings');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Settings" subtitle="Manage your business preferences">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Settings" subtitle="Manage your business preferences">
      <div className="max-w-6xl space-y-6">
        {/* Top Grid: Business Information beside WhatsApp Alerts Bot */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column: Business Info */}
          <div className="card-premium p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground">Business Information</h3>
                  <p className="text-sm text-muted-foreground">Update your business details</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input
                    id="businessName"
                    placeholder="Enter your business name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    placeholder="Enter a tagline (e.g., 'Taste · Tradition · Madras Style')"
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="business@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      placeholder="03XX-XXXXXXX"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    placeholder="Business address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="City"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-200">
              <Button
                className="bg-gold hover:bg-gold-light text-primary-foreground font-semibold text-xs"
                onClick={handleSave}
                disabled={isMockMode() || saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Business Details'
                )}
              </Button>
            </div>
          </div>

          {/* Right Column: WhatsApp Bot & Mobile Notifications */}
          {canManageWhatsApp && <div className="card-premium p-6">
            <div className="flex items-start justify-between gap-4 mb-6 max-sm:flex-col">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                    WhatsApp Alerts Bot
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Send real-time order and low-stock alerts straight to your WhatsApp
                  </p>
                </div>
              </div>

              {/* Connection Status Badge */}
              <div>
                {waLoading ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                  </span>
                ) : waStatus?.status === 'connected' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                     ({waStatus?.info?.pushname || 'Active'})
                  </span>
                ) : waStatus?.status === 'qr_ready' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Ready to Scan QR
                  </span>
                ) : waStatus?.status === 'initializing' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                    Starting WhatsApp...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                    {waStatus?.status === 'offline' ? 'Worker Offline' : 'Not Connected'}
                  </span>
                )}
              </div>
            </div>

            {/* QR Code / Connection Box */}
            <div className="mb-6">
              {waStatus?.status === 'connected' ? (
                <div className="flex items-center justify-between p-4 bg-emerald-500/5 border border-emerald-200/80 rounded-2xl max-sm:flex-col max-sm:items-start gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        WhatsApp Linked: {waStatus.info?.pushname || 'Restaurant Phone'}
                      </p>
                      <p className="text-xs text-slate-500">
                        WhatsApp Web session is active. Live alerts will trigger automatically.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSendTestWA}
                      disabled={mockMode || isSendingTestWA || waStatus.lastTest?.status === 'queued'}
                      className="text-xs"
                    >
                      {isSendingTestWA ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                      Send Test Msg
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDisconnectWA}
                      disabled={mockMode || isDisconnectingWA}
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {isDisconnectingWA ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5 mr-1.5" />}
                      Unlink
                    </Button>
                  </div>
                </div>
              ) : waStatus?.status === 'qr_ready' && waStatus.qrCode ? (
                <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="bg-white p-2.5 rounded-2xl shadow-xs border border-slate-200 shrink-0 text-center">
                    <img
                      src={waStatus.qrCode}
                      alt="WhatsApp QR Code"
                      className="w-40 h-40 sm:w-44 sm:h-44 object-contain mx-auto"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Point camera to link</span>
                  </div>
                  <div className="space-y-2.5">
                    <h4 className="font-semibold text-slate-900 text-xs">How to connect in 10 seconds:</h4>
                    <ol className="text-[11px] text-slate-600 space-y-1.5 list-decimal list-inside leading-relaxed">
                      <li>Open <strong>WhatsApp</strong> on your phone</li>
                      <li>Tap <strong>Settings / Menu (⋮)</strong> &gt; <strong>Linked Devices</strong></li>
                      <li>Tap <strong>Link a Device</strong> and point your camera here</li>
                    </ol>
                    <p className="text-[11px] text-emerald-600 font-medium">
                      ⚡ Turns green automatically upon scan.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleStartWhatsApp(true)}
                      disabled={mockMode || isStartingWA}
                      className="text-xs h-8"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isStartingWA ? 'animate-spin' : ''}`} />
                      Refresh QR Code
                    </Button>
                  </div>
                </div>
              ) : waStatus?.status === 'initializing' || isStartingWA ? (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-800">Starting WhatsApp Web Session...</p>
                  <p className="text-xs text-slate-600 mt-1">Waiting for a fresh QR from WhatsApp Web.</p>
                </div>
              ) : waStatus?.status === 'offline' ? (
                <div className="rounded-2xl border border-input bg-background p-4">
                  <p className="text-sm font-semibold">The WhatsApp worker is offline</p>
                  <p className="mt-1 text-xs text-muted-foreground">Alerts stay queued until the worker is running and WhatsApp is linked.</p>
                </div>
              ) : (
                <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
                  <Smartphone className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-800">{waStatus?.status === 'qr_expired' ? 'The QR code expired' : 'WhatsApp Bot is not linked'}</p>
                  <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
                    {waStatus?.lastError || 'Generate a QR code to link your restaurant phone.'}
                  </p>
                  <Button
                    type="button"
                    onClick={() => handleStartWhatsApp(waStatus?.status === 'qr_expired')}
                    disabled={mockMode || waLoading || isStartingWA}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  >
                    {isStartingWA ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                    {waStatus?.status === 'qr_expired' ? 'Refresh QR Code' : 'Connect WhatsApp & Show QR Code'}
                  </Button>
                </div>
              )}
              {waStatus?.lastTest && (
                <p role="status" className="mt-3 text-xs text-muted-foreground">
                  {waStatus.lastTest.status === 'sent' ? 'WhatsApp accepted the last test message.'
                    : waStatus.lastTest.status === 'failed' ? 'The last test could not be sent. Check the receiver and try again.'
                    : 'The test message is queued.'}
                </p>
              )}
              {waStatus?.delivery?.pending > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">{waStatus.delivery.pending} alerts waiting to send.</p>
              )}
              {waStatus?.delivery?.failed > 0 && (
                <p className="mt-2 text-xs text-destructive">{waStatus.delivery.failed} alerts failed in the last 7 days.</p>
              )}
            </div>

            {/* WhatsApp Alert Preferences */}
            <div className="space-y-4 pt-2 border-t border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Notification Preferences
              </h4>

              <div>
                <Label htmlFor="waGroup" className="text-xs font-semibold text-slate-700">
                  Staff WhatsApp Group ID *
                </Label>
                <Input
                  id="waGroup"
                  placeholder="e.g. 120363432438097680@g.us"
                  value={waConfig.targetGroupId}
                  onChange={(e) => setWaConfig({ ...waConfig, targetGroupId: e.target.value })}
                  className="mt-1.5 text-xs font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  All order details and kitchen alerts are sent directly to this WhatsApp group.
                </span>
              </div>

              <Separator className="my-3" />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">🔔 New Order Alerts</p>
                    <p className="text-xs text-muted-foreground">
                      Instantly receive WhatsApp pings when a customer or table places an order
                    </p>
                  </div>
                  <Switch
                    checked={waConfig.alertNewOrders}
                    onCheckedChange={(checked) => setWaConfig({ ...waConfig, alertNewOrders: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">⚠️ Low Stock Alerts</p>
                    <p className="text-xs text-muted-foreground">
                      Instantly receive WhatsApp warnings when ingredients drop below minimum threshold
                    </p>
                  </div>
                  <Switch
                    checked={waConfig.alertLowStock}
                    onCheckedChange={(checked) => setWaConfig({ ...waConfig, alertLowStock: checked })}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={handleSaveWA}
                  disabled={mockMode || isSavingWA}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  {isSavingWA ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : null}
                  Save WhatsApp Settings
                </Button>
              </div>
            </div>
          </div>}
        </div>

        {/* Notifications / In-App Alert Preferences */}
        <div className="card-premium p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-info" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">In-App Notifications</h3>
              <p className="text-sm text-muted-foreground">Configure in-dashboard banner alert preferences</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Low Stock Banner Alerts</p>
                <p className="text-sm text-muted-foreground">Show in-dashboard warning when stock falls below minimum threshold</p>
              </div>
              <Switch
                checked={notifications.lowStock}
                onCheckedChange={(checked) => setNotifications({ ...notifications, lowStock: checked })}
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
