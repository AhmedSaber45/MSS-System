import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Table, Column } from './Table';
import { Badge } from './Badge';
import { Alert } from './Alert';
import { Spinner } from './Spinner';
import { useNotification } from '../../context/NotificationContext';
import { Sparkles, Search } from 'lucide-react';

export const ComponentShowcaseModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { showNotification } = useNotification();
  const [btnLoading, setBtnLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [inputValue, setInputValue] = useState('نص تجريبي');

  const sampleTableData = [
    { id: 1, name: 'عنصر تجريبي أول', type: 'رئيسي', status: 'نشط' },
    { id: 2, name: 'عنصر تجريبي ثان', type: 'فرعي', status: 'معلق' },
  ];

  const columns: Column<(typeof sampleTableData)[0]>[] = [
    { key: 'id', header: 'المعرف', render: item => <span className="font-mono">{item.id}</span> },
    { key: 'name', header: 'الاسم' },
    { key: 'type', header: 'النوع', render: item => <Badge variant="primary">{item.type}</Badge> },
    { key: 'status', header: 'الحالة', render: item => <Badge variant="success">{item.status}</Badge> },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="معاينة وفحص كافة عناصر الواجهة (Design System Showcase)"
      subtitle="مكتبة المكونات التفاعلية القابلة لإعادة الاستخدام في النظام"
      size="xl"
      footer={
        <Button variant="primary" size="md" onClick={onClose}>
          إغلاق المعاينة
        </Button>
      }
    >
      <div className="space-y-8 text-xs text-slate-700">
        {/* Section 1: Buttons */}
        <section className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 border-b pb-1.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            1. الأزرار (Buttons)
          </h4>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="sm">زر رئيسي صغير</Button>
            <Button variant="primary" size="md">زر رئيسي عادي</Button>
            <Button variant="primary" size="lg">زر رئيسي كبير</Button>
            <Button variant="secondary" size="md">زر ثانوي</Button>
            <Button variant="outline" size="md">زر إطار</Button>
            <Button variant="danger" size="md">زر تحذيري</Button>
            <Button variant="success" size="md">زر تأكيد</Button>
            <Button variant="ghost" size="md">زر شفاف</Button>
            <Button
              variant="primary"
              size="md"
              isLoading={btnLoading}
              onClick={() => {
                setBtnLoading(true);
                setTimeout(() => setBtnLoading(false), 2000);
              }}
            >
              {btnLoading ? 'جاري التحميل...' : 'انقر لاختبار التحميل'}
            </Button>
          </div>
        </section>

        {/* Section 2: Badges */}
        <section className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 border-b pb-1.5">2. الشارات والوسوم (Badges)</h4>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">افتراضي</Badge>
            <Badge variant="primary">رئيسي (أزرق)</Badge>
            <Badge variant="success">ناجح (أخضر)</Badge>
            <Badge variant="warning">تنبيه (أصفر)</Badge>
            <Badge variant="danger">خطر (أحمر)</Badge>
            <Badge variant="info">معلومة (سماوي)</Badge>
            <Badge variant="purple">أجهزة MSS (بترولي)</Badge>
          </div>
        </section>

        {/* Section 3: Inputs & Select */}
        <section className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 border-b pb-1.5">3. حقول الإدخال والاختيار (Inputs & Select)</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="حقل نص عادي مع مسح سريع"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onClear={() => setInputValue('')}
              leftIcon={<Search className="w-4 h-4" />}
            />
            <Input
              label="حقل مخصص للباركود والسيريال"
              placeholder="امسح الباركود..."
              scannerReady
              isMonospace
            />
            <Select
              label="قائمة منسدلة أنيقة"
              options={[
                { value: '1', label: 'الخيار الأول المتاح' },
                { value: '2', label: 'الخيار الثاني المتاح' },
              ]}
            />
          </div>
        </section>

        {/* Section 4: Alerts */}
        <section className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 border-b pb-1.5">4. التنبيهات والإشعارات (Alerts)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Alert type="info" title="تنبيه معلوماتي" message="هذا نموذج لتنبيه معلوماتي يوضح للمستخدم إجراء أو نصيحة." />
            <Alert type="success" title="تنبيه نجاح العملية" message="تم حفظ وتسجيل كافة البيانات بنجاح تام." />
            <Alert type="warning" title="تنبيه تحذيري" message="يرجى مراجعة رصيد الصنف قبل متابعة الحركة." />
            <Alert type="danger" title="تنبيه خطأ" message="تعذر إتمام الإجراء، تأكد من الاتصال أو سلامة المدخلات." />
          </div>
        </section>

        {/* Section 5: Notifications (Toasts) */}
        <section className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 border-b pb-1.5 flex items-center justify-between">
            <span>5. إشعارات النظام الفورية (Toast Notifications)</span>
          </h4>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="success"
              onClick={() => showNotification({ type: 'success', title: 'تمت العملية بنجاح', message: 'تم حفظ السجل وتحديث البيانات.' })}
            >
              إشعار نجاح
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => showNotification({ type: 'error', title: 'فشل الإجراء', message: 'حدث خطأ أثناء الاتصال بقاعدة البيانات.' })}
            >
              إشعار خطأ
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => showNotification({ type: 'warning', title: 'تنبيه مخزون', message: 'الصنف قارب على النفاد من المحل.' })}
            >
              إشعار تحذير
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => showNotification({ type: 'info', title: 'معلومة جديدة', message: 'تم استلام تحديث جديد من السحابة.' })}
            >
              إشعار معلومة
            </Button>
          </div>
        </section>

        {/* Section 6: Table & Skeletons */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b pb-1.5">
            <h4 className="text-sm font-bold text-slate-900">6. الجداول وحالات التحميل (Tables & Skeleton)</h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTableLoading(prev => !prev)}
            >
              {tableLoading ? 'عرض البيانات' : 'تجربة حالة التحميل (Skeleton)'}
            </Button>
          </div>
          <Table
            columns={columns}
            data={sampleTableData}
            keyExtractor={item => item.id}
            isLoading={tableLoading}
          />
        </section>

        {/* Section 7: Spinners */}
        <section className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 border-b pb-1.5">7. مؤشرات التحميل (Spinners)</h4>
          <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-xl">
            <Spinner size="sm" label="صغير" />
            <Spinner size="md" label="متوسط" />
            <Spinner size="lg" label="كبير" />
          </div>
        </section>
      </div>
    </Modal>
  );
};
