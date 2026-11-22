import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { desktopAuthService, hasSessionDataChanged, INACTIVITY_TIMEOUT_MS } from '../src/services/desktopAuthService.ts';

const mockBaseSession = {
  sessionToken: 'test_token_abc_123',
  user: {
    id: 'user-uuid-1',
    username: 'admin',
    displayName: 'Administrator',
    allowedModules: 'both',
    defaultStoreId: 'store-1',
    assignedStoreIds: ['store-1', 'store-2'],
    credentialVersion: 1,
    permissionVersion: 1,
  },
  expiresAt: '2026-12-31T23:59:59.000Z',
  lastOnlineValidationAt: '2026-11-22T12:00:00.000Z',
  lastActivityAt: '2026-11-22T12:00:00.000Z',
  offlineMaxDays: 7,
};

test('hasSessionDataChanged returns false on identical user and expiration (passive heartbeat)', () => {
  const identicalUser = { ...mockBaseSession.user, assignedStoreIds: ['store-1', 'store-2'] };
  const changed = hasSessionDataChanged(
    mockBaseSession,
    identicalUser,
    mockBaseSession.expiresAt
  );
  assert.equal(changed, false, 'Passive heartbeat with same data must NOT be marked as changed');
});

test('hasSessionDataChanged returns true when allowedModules changes', () => {
  const updatedUser = { ...mockBaseSession.user, allowedModules: 'mss' };
  const changed = hasSessionDataChanged(
    mockBaseSession,
    updatedUser,
    mockBaseSession.expiresAt
  );
  assert.equal(changed, true, 'Permission change must trigger persistence');
});

test('hasSessionDataChanged returns true when assignedStoreIds changes', () => {
  const updatedUser = { ...mockBaseSession.user, assignedStoreIds: ['store-1'] };
  const changed = hasSessionDataChanged(
    mockBaseSession,
    updatedUser,
    mockBaseSession.expiresAt
  );
  assert.equal(changed, true, 'Store assignment change must trigger persistence');
});

test('hasSessionDataChanged returns true when permissionVersion changes', () => {
  const updatedUser = { ...mockBaseSession.user, permissionVersion: 2 };
  const changed = hasSessionDataChanged(
    mockBaseSession,
    updatedUser,
    mockBaseSession.expiresAt
  );
  assert.equal(changed, true, 'Permission version bump must trigger persistence');
});

test('hasSessionDataChanged returns true when credentialVersion changes', () => {
  const updatedUser = { ...mockBaseSession.user, credentialVersion: 2 };
  const changed = hasSessionDataChanged(
    mockBaseSession,
    updatedUser,
    mockBaseSession.expiresAt
  );
  assert.equal(changed, true, 'Credential version bump must trigger persistence');
});

test('hasSessionDataChanged returns true when expiresAt is renewed', () => {
  const identicalUser = { ...mockBaseSession.user };
  const changed = hasSessionDataChanged(
    mockBaseSession,
    identicalUser,
    '2027-01-15T00:00:00.000Z'
  );
  assert.equal(changed, true, 'Expiration date renewal must trigger persistence');
});

test('hasSessionDataChanged returns true when session token is renewed', () => {
  const identicalUser = { ...mockBaseSession.user };
  const changed = hasSessionDataChanged(
    mockBaseSession,
    identicalUser,
    mockBaseSession.expiresAt,
    'new_token_xyz_456'
  );
  assert.equal(changed, true, 'Session token change must trigger persistence');
});

test('desktopAuthService: inactivity timeout logic enforces 7-day limit (168 hours)', () => {
  const recentSession = {
    ...mockBaseSession,
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
  };
  const activeCheck = desktopAuthService.checkInactivityTimeout(recentSession);
  assert.equal(activeCheck.expired, false, '3-day-old activity must still be valid');

  const expiredSession = {
    ...mockBaseSession,
    lastActivityAt: new Date(Date.now() - (INACTIVITY_TIMEOUT_MS + 10000)).toISOString(), // > 7 days ago
  };
  const expiredCheck = desktopAuthService.checkInactivityTimeout(expiredSession);
  assert.equal(expiredCheck.expired, true, 'Session with >7 days inactivity must expire');
  assert.equal(expiredCheck.reason, 'INACTIVITY_TIMEOUT');
});

test('desktopAuthService: clock tampering detection works', () => {
  const tamperedSession = {
    ...mockBaseSession,
    lastActivityAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(), // 1 hour in future
  };
  const check = desktopAuthService.checkInactivityTimeout(tamperedSession);
  assert.equal(check.expired, true);
  assert.equal(check.reason, 'CLOCK_TAMPERING');
});

test('desktopAuthService: updateMemorySession updates in-memory session without error', () => {
  const sessionCopy = { ...mockBaseSession, sessionToken: 'memory_test_token' };
  desktopAuthService.updateMemorySession(sessionCopy);
  assert.equal(desktopAuthService.getMemorySession()?.sessionToken, 'memory_test_token');
});

test('Rust lib.rs: session commands have zero PowerShell invocations and use native DPAPI Win32 API', () => {
  const libRsPath = path.resolve('src-tauri/src/lib.rs');
  const content = fs.readFileSync(libRsPath, 'utf8');

  // Verify save_secure_session, load_secure_session, clear_secure_session do not call Command::new("powershell")
  const sessionSectionMatch = content.match(/fn save_secure_session[\s\S]*?fn clear_secure_session[\s\S]*?^}/m);
  assert.ok(sessionSectionMatch, 'Session storage section must exist in lib.rs');
  const sessionSection = sessionSectionMatch[0];

  assert.equal(
    sessionSection.includes('powershell'),
    false,
    'Session storage commands in lib.rs must NOT contain any reference to powershell'
  );

  // Verify Win32 DPAPI functions are declared
  assert.ok(content.includes('CryptProtectData'), 'lib.rs must use CryptProtectData');
  assert.ok(content.includes('CryptUnprotectData'), 'lib.rs must use CryptUnprotectData');
  assert.ok(content.includes('LocalFree'), 'lib.rs must use LocalFree to free DPAPI memory');
  assert.ok(content.includes('CRYPTPROTECT_UI_FORBIDDEN'), 'lib.rs must pass CRYPTPROTECT_UI_FORBIDDEN');
});

test('Win32 DPAPI binary compatibility: can decrypt session.dpapi on Windows if present', (t) => {
  if (process.platform !== 'win32') {
    t.skip('Skipping DPAPI test on non-Windows');
    return;
  }

  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    t.skip('LOCALAPPDATA not defined');
    return;
  }

  const sessionPath = path.join(localAppData, 'CompuMSS', 'session.dpapi');
  if (!fs.existsSync(sessionPath)) {
    t.skip('session.dpapi not present on this machine');
    return;
  }

  // Verify decryption using Win32 API directly via PowerShell P/Invoke script
  const tmpScriptPath = path.join(localAppData, 'CompuMSS', '_test_dpapi_verify.ps1');
  const script = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$csharp = @'
using System;
using System.Runtime.InteropServices;
public class TestWin32 {
    [StructLayout(LayoutKind.Sequential)]
    public struct DATA_BLOB { public int cbData; public IntPtr pbData; }
    [DllImport("Crypt32.dll", SetLastError = true)]
    public static extern bool CryptUnprotectData(ref DATA_BLOB pIn, IntPtr pDescr, IntPtr pEntropy, IntPtr pRes, IntPtr pPrompt, int flags, ref DATA_BLOB pOut);
    [DllImport("kernel32.dll")]
    public static extern IntPtr LocalFree(IntPtr h);
    public static string Decrypt(byte[] b) {
        DATA_BLOB inB = new DATA_BLOB(), outB = new DATA_BLOB();
        GCHandle h = GCHandle.Alloc(b, GCHandleType.Pinned);
        try {
            inB.pbData = h.AddrOfPinnedObject(); inB.cbData = b.Length;
            if (!CryptUnprotectData(ref inB, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 1, ref outB)) throw new Exception("Failed");
            byte[] outBytes = new byte[outB.cbData];
            Marshal.Copy(outB.pbData, outBytes, 0, outB.cbData);
            LocalFree(outB.pbData);
            return System.Text.Encoding.UTF8.GetString(outBytes);
        } finally { h.Free(); }
    }
}
'@
Add-Type -TypeDefinition $csharp
$bytes = [System.IO.File]::ReadAllBytes('${sessionPath.replace(/\\/g, '\\\\')}')
$dec = [TestWin32]::Decrypt($bytes)
[Console]::Out.Write($dec)
`;

  fs.writeFileSync(tmpScriptPath, script, 'utf8');
  let output = '';
  try {
    output = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpScriptPath}"`, {
      encoding: 'utf8',
      windowsHide: true,
    });
  } finally {
    if (fs.existsSync(tmpScriptPath)) {
      fs.unlinkSync(tmpScriptPath);
    }
  }

  const parsed = JSON.parse(output.trim());
  assert.ok(parsed.sessionToken, 'Decrypted session must contain sessionToken');
  assert.ok(parsed.user, 'Decrypted session must contain user');
});
