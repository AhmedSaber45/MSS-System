import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Contact Modal Unification with Public MSS Inventory Reference', async (t) => {
  const referencePath = path.resolve('public-mss-inventory/src/components/ContactModal.tsx');
  const desktopPath = path.resolve('src/components/common/ContactModal.tsx');
  const footerPath = path.resolve('src/components/layout/AppFooter.tsx');
  const logoPath = path.resolve('public/as_logo_gold.png');
  const brandingLogoPath = path.resolve('public/assets/branding/as_logo_gold.png');

  assert.ok(fs.existsSync(referencePath), 'Reference ContactModal.tsx must exist in public-mss-inventory');
  assert.ok(fs.existsSync(desktopPath), 'Desktop ContactModal.tsx must exist in src/components/common');
  assert.ok(fs.existsSync(footerPath), 'AppFooter.tsx must exist in src/components/layout');
  assert.ok(fs.existsSync(logoPath), 'public/as_logo_gold.png must exist');
  assert.ok(fs.existsSync(brandingLogoPath), 'public/assets/branding/as_logo_gold.png must exist');

  const refContent = fs.readFileSync(referencePath, 'utf8');
  const desktopContent = fs.readFileSync(desktopPath, 'utf8');
  const footerContent = fs.readFileSync(footerPath, 'utf8');

  await t.test('1. Layout, overlay and dialog styling match reference', () => {
    assert.ok(
      desktopContent.includes('fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-none'),
      'Overlay styling must match reference backdrop'
    );
    assert.ok(
      desktopContent.includes('bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150'),
      'Modal dialog card styling must match reference'
    );
    assert.ok(
      desktopContent.includes('role="dialog"') &&
      desktopContent.includes('aria-modal="true"') &&
      desktopContent.includes('aria-labelledby="contact-modal-title"'),
      'Modal accessibility attributes must match reference'
    );
  });

  await t.test('2. Header copy, typography, and close button match reference', () => {
    assert.ok(
      desktopContent.includes('بيانات التواصل وحقوق الملكية'),
      'Modal header title must be "بيانات التواصل وحقوق الملكية"'
    );
    assert.ok(
      desktopContent.includes('AS System — التواصل المباشر مع مطور النظام والدعم الفني'),
      'Modal header subtitle must be "AS System — التواصل المباشر مع مطور النظام والدعم الفني"'
    );
    assert.ok(
      desktopContent.includes('<X className="w-5 h-5" />'),
      'Close button must render X icon'
    );
    assert.ok(
      desktopContent.includes('aria-label="إغلاق"'),
      'Close button must include aria-label'
    );
  });

  await t.test('3. Official logo badge and founder information match reference', () => {
    assert.ok(
      desktopContent.includes('w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center p-2 shadow-sm shrink-0'),
      'Official AS System logo badge container styling must match reference'
    );
    assert.ok(
      desktopContent.includes('as_logo_gold.png'),
      'Gold AS System logo image must be referenced'
    );
    assert.ok(
      desktopContent.includes('Ahmed Saber'),
      'Founder name must be Ahmed Saber'
    );
    assert.ok(
      desktopContent.includes('Founder of AS System'),
      'Founder subtitle must be "Founder of AS System"'
    );
    assert.ok(
      !desktopContent.includes('مطور ومؤسس نظام Compu MSS'),
      'Old "مطور ومؤسس نظام Compu MSS" subtitle must be replaced with "Founder of AS System"'
    );
  });

  await t.test('4. Contact details and labels match reference', () => {
    assert.ok(
      desktopContent.includes('01030137635'),
      'Phone number must be 01030137635'
    );
    assert.ok(
      desktopContent.includes('رقم الهاتف :'),
      'Phone label must match reference "رقم الهاتف :"'
    );
  });

  await t.test('5. Action buttons, states, and WhatsApp dispatch match reference', () => {
    // Copy button
    assert.ok(
      desktopContent.includes('bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs'),
      'Copy button must have blue styling matching reference'
    );
    assert.ok(
      desktopContent.includes("copiedPhone ? 'تم النسخ!' : 'نسخ الرقم'"),
      'Copy button must show "تم النسخ!" and "نسخ الرقم"'
    );

    // WhatsApp button
    assert.ok(
      desktopContent.includes('bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg font-bold text-xs'),
      'WhatsApp button must have emerald styling matching reference'
    );
    assert.ok(
      desktopContent.includes('محادثة واتساب'),
      'WhatsApp button must show "محادثة واتساب"'
    );
    assert.ok(
      desktopContent.includes('https://wa.me/201030137635?text='),
      'WhatsApp URL must point to 201030137635'
    );
    assert.ok(
      desktopContent.includes('مرحباً أستاذ أحمد، أتواصل معك بخصوص نظام AS System'),
      'WhatsApp message must mention AS System'
    );
  });

  await t.test('6. Legal copyright and versioning match reference', () => {
    assert.ok(
      desktopContent.includes('© 2026 Ahmed Saber. All rights reserved.'),
      'Copyright notice must be "© 2026 Ahmed Saber. All rights reserved."'
    );
    assert.ok(
      desktopContent.includes('{FULL_APP_VERSION}') || desktopContent.includes('AS System v1.0.9'),
      'Desktop version must be synchronized via FULL_APP_VERSION or AS System v1.0.9'
    );
    assert.ok(
      !desktopContent.includes('Compu MSS v1.0.5'),
      'Stale "Compu MSS v1.0.5" label must be removed'
    );
  });

  await t.test('7. Dismissal behavior: Escape key, backdrop click, body overflow lock', () => {
    assert.ok(
      desktopContent.includes("e.key === 'Escape' && isOpen"),
      'Escape key listener must dismiss modal when open'
    );
    assert.ok(
      desktopContent.includes("document.body.style.overflow = 'hidden'"),
      'Body overflow must be locked when modal is open'
    );
    assert.ok(
      desktopContent.includes("document.body.style.overflow = ''"),
      'Body overflow must be restored when modal is closed or unmounted'
    );
    assert.ok(
      desktopContent.includes('onClick={(e) => e.stopPropagation()}'),
      'Dialog card click must stop propagation so backdrop click closes modal'
    );
  });

  await t.test('8. AppFooter integration remains intact', () => {
    assert.ok(
      footerContent.includes("import { ContactModal } from '../common/ContactModal';"),
      'AppFooter must import ContactModal'
    );
    assert.ok(
      footerContent.includes('<ContactModal'),
      'AppFooter must render ContactModal'
    );
  });
});
