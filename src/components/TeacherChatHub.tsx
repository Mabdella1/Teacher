import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Users, User, Plus, Trash2, Shield, Sparkles, Loader2, X, Check, Search
} from 'lucide-react';
import { Student, TeacherPreferences, ChatGroup } from '../types';
import LiveChat from './LiveChat';

interface TeacherChatHubProps {
  students: Student[];
  preferences: TeacherPreferences;
}

export default function TeacherChatHub({ students, preferences }: TeacherChatHubProps) {
  const [activeTab, setActiveTab] = useState<'individual' | 'groups'>('individual');
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  
  // Selection
  const [selectedTarget, setSelectedTarget] = useState<{ id: string; name: string } | null>(null);

  // Group creation modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [individualSearchQuery, setIndividualSearchQuery] = useState('');

  // Fetch groups
  const fetchGroups = () => {
    setIsLoadingGroups(true);
    fetch('/api/chat-groups')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.groups) {
          setGroups(data.groups);
        }
        setIsLoadingGroups(false);
      })
      .catch((err) => {
        console.error('Error fetching chat groups:', err);
        setIsLoadingGroups(false);
      });
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // Handle group creation
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      alert('الرجاء كتابة اسم المجموعة');
      return;
    }
    if (selectedStudentIds.length === 0) {
      alert('الرجاء اختيار طالب واحد على الأقل للمجموعة');
      return;
    }

    setIsSubmittingGroup(true);
    fetch('/api/chat-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newGroupName.trim(),
        studentIds: selectedStudentIds
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.group) {
          setGroups((prev) => [...prev, data.group]);
          setSelectedTarget({ id: data.group.id, name: data.group.name });
          setIsCreateModalOpen(false);
          setNewGroupName('');
          setSelectedStudentIds([]);
        } else {
          alert('فشل إنشاء المجموعة');
        }
        setIsSubmittingGroup(false);
      })
      .catch((err) => {
        console.error('Error creating group:', err);
        alert('حدث خطأ أثناء الاتصال بالخادم لإنشاء المجموعة');
        setIsSubmittingGroup(false);
      });
  };

  // Handle group deletion
  const handleDeleteGroup = (groupId: string, groupName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف مجموعة "${groupName}" نهائياً؟ سيتم مسح كافة الرسائل والمحادثة بشكل خاص وآمن.`)) {
      return;
    }

    fetch(`/api/chat-groups/${groupId}`, { method: 'DELETE' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setGroups((prev) => prev.filter((g) => g.id !== groupId));
          if (selectedTarget && selectedTarget.id === groupId) {
            setSelectedTarget(null);
          }
        } else {
          alert('فشل حذف المجموعة');
        }
      })
      .catch((err) => {
        console.error('Error deleting group:', err);
        alert('حدث خطأ أثناء محاولة حذف المجموعة');
      });
  };

  // Toggle student selection for group
  const handleToggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) => 
      prev.includes(studentId) 
        ? prev.filter((id) => id !== studentId) 
        : [...prev, studentId]
    );
  };

  // Filter students based on search
  const filteredIndividualStudents = students.filter(student => 
    student.name.toLowerCase().includes(individualSearchQuery.trim().toLowerCase()) ||
    student.phone.includes(individualSearchQuery.trim())
  );

  const filteredGroupList = groups.filter(group => 
    group.name.toLowerCase().includes(groupSearchQuery.trim().toLowerCase())
  );

  const filteredModalStudents = students.filter(student => 
    student.name.toLowerCase().includes(studentSearchQuery.trim().toLowerCase()) ||
    student.phone.includes(studentSearchQuery.trim())
  );

  return (
    <div className="bg-slate-50 rounded-3xl border border-slate-100 p-4 sm:p-6 text-right font-sans min-h-[680px]" dir="rtl">
      {/* Upper header segment */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/60 pb-5 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-650 rounded-2xl flex items-center justify-center border border-indigo-150 shadow-3xs">
            <MessageSquare size={22} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 leading-tight">بوابة المحادثات الذكية والتواصل المباشر 📞</h2>
            <p className="text-xs text-slate-500 font-bold mt-1">تواصل مشفر، مجفر بالكامل وخاص مع كافة طلابك أو مجموعات الكورسات والدراسة</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full px-3 py-1 text-[10.5px] font-black flex items-center gap-1.5 select-none animate-pulse">
            <Shield size={12} className="text-emerald-700" />
            <span>نظام تشفير آمن وخاص (end-to-end encryption)</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Targets column vs Active Chatbox */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Targets Column List (Span 1) */}
        <div className="bg-white border border-slate-150 rounded-2xl p-4.5 space-y-4">
          {/* Toggles between Individual and Group list */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-50/80 p-1.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('individual')}
              className={`py-2 px-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'individual'
                  ? 'bg-indigo-600 text-white shadow-3xs'
                  : 'text-slate-500 hover:bg-white hover:text-slate-700'
              }`}
            >
              <User size={14} />
              <span>طلاب فرديين ({students.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('groups');
                fetchGroups();
              }}
              className={`py-2 px-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'groups'
                  ? 'bg-indigo-600 text-white shadow-3xs'
                  : 'text-slate-500 hover:bg-white hover:text-slate-700'
              }`}
            >
              <Users size={14} />
              <span>مجموعات دراسية ({groups.length})</span>
            </button>
          </div>

          {/* Search Inputs */}
          {activeTab === 'individual' ? (
            <div className="relative">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                value={individualSearchQuery}
                onChange={(e) => setIndividualSearchQuery(e.target.value)}
                placeholder="ابحث عن طالب في القائمة..."
                className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-205 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  placeholder="ابحث عن مجموعة..."
                  className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-205 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all cursor-pointer shadow-3xs shrink-0"
                title="إنشاء مجموعة جديدة"
              >
                <Plus size={16} />
              </button>
            </div>
          )}

          {/* Target Items List */}
          <div className="max-h-[460px] overflow-y-auto space-y-1.5 scrollbar-thin pr-0.5">
            {activeTab === 'individual' ? (
              filteredIndividualStudents.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-400 font-bold">لا يوجد طلاب متطابقين لمحادثتهم.</p>
              ) : (
                filteredIndividualStudents.map((student) => {
                  const isSelected = selectedTarget?.id === student.id;
                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => setSelectedTarget({ id: student.id, name: student.name })}
                      className={`w-full text-right p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-250 ring-1 ring-indigo-250 shadow-3xs'
                          : 'bg-white border-slate-150 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center shrink-0 font-extrabold ${
                          student.active ? 'bg-indigo-50 text-indigo-650' : 'bg-slate-100 text-slate-400'
                        }`}>
                          <User size={15} />
                        </div>
                        <div className="truncate">
                          <h4 className="text-xs font-bold text-slate-800 truncate leading-tight">{student.name}</h4>
                          <span className="text-[9.5px] text-slate-400 mt-0.5 block font-bold font-mono" dir="ltr">{student.phone}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${student.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        <span className="text-[9px] font-black text-slate-400">{student.type === 'lesson' ? 'حصة' : 'كورس'}</span>
                      </div>
                    </button>
                  );
                })
              )
            ) : isLoadingGroups ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-1.5">
                <Loader2 size={20} className="animate-spin text-indigo-650" />
                <span className="text-[10px] font-bold">جاري تحميل المجموعات...</span>
              </div>
            ) : filteredGroupList.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4">
                <p className="text-xs text-slate-400 font-extrabold mb-2">لا توجد مجموعات تواصل دراسي.</p>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black cursor-pointer shadow-3xs"
                >
                  أنشئ أول مجموعة تواصل +
                </button>
              </div>
            ) : (
              filteredGroupList.map((group) => {
                const isSelected = selectedTarget?.id === group.id;
                return (
                  <div
                    key={group.id}
                    className={`group/group-row w-full p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-250 ring-1 ring-indigo-250 shadow-3xs'
                        : 'bg-white border-slate-150 hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedTarget({ id: group.id, name: group.name })}
                      className="flex-1 text-right flex items-center gap-2.5 truncate cursor-pointer"
                    >
                      <div className="w-8.5 h-8.5 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 font-extrabold">
                        <Users size={15} />
                      </div>
                      <div className="truncate">
                        <h4 className="text-xs font-bold text-slate-800 truncate leading-tight">{group.name}</h4>
                        <span className="text-[9.5px] text-slate-400 mt-0.5 block font-bold">
                          {group.studentIds.length} طلاب مشتركون
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(group.id, group.name)}
                      className="p-1.5 text-slate-400 hover:text-red-650 hover:bg-red-50 rounded-lg transition-all shrink-0 cursor-pointer md:opacity-0 md:group-hover/group-row:opacity-100"
                      title="حذف المجموعة"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Active Chatbox Segment (Span 2) */}
        <div className="lg:col-span-2">
          {selectedTarget ? (
            <LiveChat
              key={selectedTarget.id}
              role="teacher"
              studentId={selectedTarget.id}
              studentName={selectedTarget.name}
              teacherName={preferences.teacherName || 'المعلم'}
            />
          ) : (
            <div className="bg-white border border-slate-150 rounded-3xl p-8 text-center min-h-[500px] flex flex-col items-center justify-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-tr from-indigo-50 to-indigo-100/60 text-indigo-650 border border-indigo-200/50 rounded-3xl flex items-center justify-center shadow-md shadow-indigo-100/10 mb-2">
                <MessageSquare size={38} className="text-indigo-600 animate-bounce" />
              </div>
              
              <div className="max-w-md space-y-2">
                <h3 className="text-base font-black text-slate-800">ابدأ الاتصال والتحاور المباشر الآمن 🔒</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-bold">
                  الرجاء اختيار أحد الطلاب من محادثات الطلاب الفردية، أو التوجه إلى قسم المجموعات لاستهداف مجموعة طلاب محددة أو كورس لمشاركة المستندات بضغطة زر.
                </p>
              </div>

              {/* Informative Grid Benefits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full pt-4 text-right">
                <div className="p-3 bg-slate-50 border border-slate-150 rounded-2xl flex gap-2.5 items-start">
                  <div className="text-lg">📁</div>
                  <div>
                    <h5 className="text-[11px] font-black text-slate-800">مشاركة الواجبات والمستندات</h5>
                    <p className="text-[9.5px] text-slate-400 leading-normal font-semibold mt-0.5">الملفات والصور والواجبات المنزلية مشفرة بحد أقصى 5 ميجابايت.</p>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-150 rounded-2xl flex gap-2.5 items-start">
                  <div className="text-lg">⏱️</div>
                  <div>
                    <h5 className="text-[11px] font-black text-slate-800">تحديثات فورية بالثانية</h5>
                    <p className="text-[9.5px] text-slate-400 leading-normal font-semibold mt-0.5">يعتمد النظام على WebSocket لسرعة تفاعل ونقل فائقة الفورية.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Group Creation Dialog Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-2xl max-w-md w-full text-right font-sans space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-950">إنشاء مجموعة تواصل جديدة 👥</h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setSelectedStudentIds([]);
                  setNewGroupName('');
                }}
                className="p-1 text-slate-400 hover:text-slate-650 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">اسم المجموعة (مثال: طلاب الرياضيات كورس أ)</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="اكتب اسم مناسب للمجموعة هنا..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-205 rounded-xl text-xs font-semibold text-slate-850 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-slate-700">تحديد الطلاب الأعضاء ({selectedStudentIds.length} محدد)</label>
                  <span className="text-[10px] text-slate-405 font-bold">اختر من القائمة بالأسفل</span>
                </div>

                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    placeholder="ابحث عن طالب بالاسم لإضافته..."
                    className="w-full pl-3 pr-8.5 py-1.5 bg-slate-50 border border-slate-205 rounded-lg text-xs font-semibold placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* Checklist box */}
                <div className="max-h-48 overflow-y-auto border border-slate-150 rounded-xl p-2 bg-slate-50/50 space-y-1 scrollbar-thin">
                  {filteredModalStudents.length === 0 ? (
                    <p className="text-center py-4 text-[10.5px] text-slate-400 font-bold">لا يوجد طلاب متطابقين.</p>
                  ) : (
                    filteredModalStudents.map((student) => {
                      const isChecked = selectedStudentIds.includes(student.id);
                      return (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => handleToggleStudentSelection(student.id)}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-right text-xs font-bold transition-all ${
                            isChecked
                              ? 'bg-indigo-50/70 text-indigo-950 border border-indigo-150'
                              : 'bg-white border border-transparent hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-[10.5px] font-bold text-slate-800 truncate">{student.name}</span>
                            <span className="text-[8.5px] text-slate-450">({student.type === 'lesson' ? 'حصة' : 'كورس'})</span>
                          </div>
                          
                          <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                            isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                          }`}>
                            {isChecked && <Check size={10} />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setSelectedStudentIds([]);
                    setNewGroupName('');
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGroup}
                  className="px-4 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-xl cursor-pointer flex items-center gap-1.5 shadow-2xs shadow-indigo-600/10"
                >
                  {isSubmittingGroup ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>إنشاء المجموعة الحالية ✨</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
