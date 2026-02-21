// 6. الإرسال
  const handleSend = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim() || !selectedChatId) return;
      setSending(true);

      const isGeneral = selectedChatId === 'general';
      const isGroup = selectedChatId === 'group';
      const toUser = isGeneral ? 'general_group' : isGroup ? 'group_managers' : selectedChatId;

      const payload = {
          from_user: 'admin',
          to_user: toUser,
          content: newMessage,
          is_read: (isGeneral || isGroup) ? true : false
      };

      const { error } = await supabase.from('messages').insert(payload);

      if (!error) {
          setNewMessage('');
          try {
              let targetIds: string[] = [];
              let title = '';
              
              if (isGeneral) {
                  // ✅ تم التعديل: استخدام employee_id
                  targetIds = employees.map(e => e.employee_id).filter(Boolean) as string[];
                  title = '📣 رسالة عامة من المدير';
              } else if (isGroup) {
                  // ✅ تم التعديل: استخدام employee_id
                  targetIds = employees
                    .filter(e => ['admin', 'head_of_dept', 'quality_manager'].includes(e.role))
                    .map(e => e.employee_id).filter(Boolean) as string[];
                  title = '👥 رسالة لإدارة المركز';
              } else {
                  const target = employees.find(e => e.employee_id === selectedChatId);
                  // ✅ تم التعديل: استخدام employee_id
                  if (target?.employee_id) targetIds = [target.employee_id];
                  title = '💬 رسالة من المدير';
              }

              if (targetIds.length > 0) {
                  // ✅ تم التعديل: إرسال متوازي (Parallel) ليتوافق مع السيرفر الذي يقبل userId مفرد
                  Promise.all(
                      targetIds.map(targetId => 
                          supabase.functions.invoke('send-push-notification', {
                              body: { 
                                  userId: String(targetId), 
                                  title: title, 
                                  body: newMessage.substring(0, 50), 
                                  url: '/messages' 
                              }
                          })
                      )
                  ).catch(err => console.error("Push invocation error:", err));
              }
          } catch (e) { console.error(e); }
      } else {
          toast.error('فشل الإرسال');
      }
      setSending(false);
  };
