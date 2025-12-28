// --- دالة الإرسال المعدلة لكشف الأخطاء ---
    const sendViaBrevo = async (toEmail: string, toName: string, subject: string, htmlContent: string) => {
        try {
            const response = await fetch('/api/send-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toEmail, toName, subject, htmlContent })
            });

            const data = await response.json();
            
            if (!response.ok) {
                // طباعة الخطأ في التنبيه
                console.error("Brevo Error:", data);
                alert(`فشل الإرسال لـ ${toName}:\n${data.error}\n${JSON.stringify(data.details)}`);
                return false;
            }
            
            return true;
        } catch (error: any) {
            console.error("Network Error:", error);
            alert(`خطأ في الشبكة أثناء إرسال لـ ${toName}:\n${error.message}`);
            return false;
        }
    };

    const handleSendReports = async () => {
        if (selectedIds.length === 0) return alert('اختر موظفاً واحداً على الأقل');
        if (!confirm(`إرسال ${selectedIds.length} تقرير؟`)) return;
        
        setSending(true);
        let successCount = 0;
        let failCount = 0;

        try {
            // ... (نفس كود جلب البيانات السابق - لا تغيير فيه) ...
            const startOfMonth = `${month}-01`;
            const endOfMonth = `${month}-31`;
            const { data: allAttendance } = await supabase.from('attendance').select('*').gte('date', startOfMonth).lte('date', endOfMonth);
            const { data: allLeaves } = await supabase.from('leave_requests').select('*');

            for (const empId of selectedIds) {
                const emp = employees.find(e => e.id === empId);
                if (!emp || !emp.email) { failCount++; continue; }

                const empAtt = allAttendance?.filter(a => String(a.employee_id).trim() === String(emp.employee_id).trim()) || [];
                const empLeaves = allLeaves?.filter(l => String(l.employee_id).trim() === String(emp.employee_id).trim()) || [];

                const htmlContent = generateEmailHTML(emp, empAtt, empLeaves, month);
                const subject = `تقرير شهر ${month} - ${emp.name}`;

                // الإرسال
                const isSent = await sendViaBrevo(emp.email, emp.name, subject, htmlContent);
                if (isSent) successCount++; else failCount++;
            }
            
            if (successCount > 0 || failCount > 0) {
                alert(`التقرير النهائي:\n✅ تم الإرسال: ${successCount}\n❌ فشل: ${failCount}`);
            }

        } catch (e:any) {
            alert('حدث خطأ غير متوقع: ' + e.message);
        } finally {
            setSending(false);
            setSelectedIds([]);
        }
    };
