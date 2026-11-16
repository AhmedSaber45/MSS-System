import { invoke, isTauri } from '@tauri-apps/api/core';

const AUTOSTART_STORAGE_KEY = 'mss_startup_with_windows_v1';

export interface AutostartStatusResult {
  enabled: boolean;
  isDesktop: boolean;
  message?: string;
}

export const autostartService = {
  /**
   * Check if running in desktop environment where Windows Registry is accessible.
   */
  isDesktopEnvironment(): boolean {
    return isTauri();
  },

  /**
   * Check whether MSS System is registered to run on Windows startup.
   * In Tauri desktop: reads actual Windows Registry key (HKCU\Software\Microsoft\Windows\CurrentVersion\Run).
   * In Web browser: returns saved preference with explanatory status.
   */
  async getStartupStatus(): Promise<AutostartStatusResult> {
    if (isTauri()) {
      try {
        const isRegistered = await invoke<boolean>('get_windows_startup_status');
        localStorage.setItem(AUTOSTART_STORAGE_KEY, String(isRegistered));
        return {
          enabled: isRegistered,
          isDesktop: true,
        };
      } catch (err: any) {
        console.warn('Failed to query Windows startup status from registry:', err);
        const fallback = localStorage.getItem(AUTOSTART_STORAGE_KEY) === 'true';
        return {
          enabled: fallback,
          isDesktop: true,
          message: 'تعذر الاستعلام من سجل النظام مباشرة',
        };
      }
    }

    // Web browser environment
    const saved = localStorage.getItem(AUTOSTART_STORAGE_KEY) === 'true';
    return {
      enabled: saved,
      isDesktop: false,
      message: 'خاصية بدء التشغيل التلقائي تتطلب تشغيل تطبيق سطح المكتب ',
    };
  },

  /**
   * Enable or disable automatic launch on Windows startup.
   * In Tauri desktop: directly writes or removes registry entry in HKCU\...\Run.
   * In Web browser: updates local storage and warns user that desktop app is required.
   */
  async setStartupStatus(enabled: boolean): Promise<AutostartStatusResult> {
    if (isTauri()) {
      try {
        const result = await invoke<boolean>('set_windows_startup_status', { enabled });
        localStorage.setItem(AUTOSTART_STORAGE_KEY, String(result));
        return {
          enabled: result,
          isDesktop: true,
          message: result
            ? 'تم تفعيل بدء التشغيل التلقائي مع Windows بنجاح'
            : 'تم إلغاء تفعيل بدء التشغيل التلقائي مع Windows بنجاح',
        };
      } catch (err: any) {
        const errMsg = typeof err === 'string' ? err : err?.message || 'فشل تحديث إعدادات بدء التشغيل';
        throw new Error(errMsg);
      }
    }

    // Web browser environment
    localStorage.setItem(AUTOSTART_STORAGE_KEY, String(enabled));
    return {
      enabled,
      isDesktop: false,
      message:
        'تم حفظ الإعدادات. ',
    };
  },
};
