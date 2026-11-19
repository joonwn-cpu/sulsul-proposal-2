import React, { useState } from 'react';
import { 
  X, 
  Camera, 
  Mic, 
  MicOff, 
  AlertTriangle, 
  UploadCloud, 
  CheckCircle2, 
  Wrench, 
  Lightbulb, 
  Clock, 
  ShieldAlert,
  Sparkles,
  Gauge
} from 'lucide-react';
import { 
  SuggestionCategory, 
  BreweryProcess, 
  AttachmentItem, 
  BreweryWorker 
} from '../types/brewery';
import { 
  CATEGORY_CONFIG, 
  PROCESS_CONFIG, 
  QUICK_ISSUE_CHECKLISTS 
} from '../data/mockBreweryData';
import {
  CATEGORY_SEVERITY_SCORES,
  PRIORITY_LEVEL_CONFIG,
  PROCESS_IMPORTANCE_SCORES,
  calculatePriorityBreakdown,
} from '../lib/priorityScore';

interface NewSuggestionModalProps {
  currentUser: BreweryWorker;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    category: SuggestionCategory;
    process: BreweryProcess;
    locationDetail: string;
    isUrgent: boolean;
    urgencyReason?: string;
    attachments: AttachmentItem[];
    quickTags: string[];
    audioTranscript?: string;
  }) => void;
  isOffline: boolean;
}

export function NewSuggestionModal({
  currentUser,
  isOpen,
  onClose,
  onSubmit,
  isOffline,
}: NewSuggestionModalProps) {
  const [category, setCategory] = useState<SuggestionCategory>('BREAKDOWN_REPAIR');
  const [process, setProcess] = useState<BreweryProcess>(currentUser.process || 'FERMENTATION');
  const [locationDetail, setLocationDetail] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioTranscript, setAudioTranscript] = useState('');
  const [selectedQuickTags, setSelectedQuickTags] = useState<string[]>([]);

  const isUrgent = CATEGORY_CONFIG[category].isUrgentDefault;

  // 실시간 예상 우선순위 점수 계산 (긴급도 50 + 카테고리 심각도 10~40 + 공정 영향도 2~10)
  const livePriority = calculatePriorityBreakdown({
    isUrgent,
    category,
    process,
  });
  const livePriorityMeta = PRIORITY_LEVEL_CONFIG[livePriority.level];

  if (!isOpen) return null;

  // 빠른 체크리스트 선택 시 제목/내용 자동 채우기 및 태그 추가
  const handleSelectQuickTag = (tag: string) => {
    if (!title) {
      setTitle(tag);
    }
    if (!description.includes(tag)) {
      setDescription(prev => prev ? `${prev}\n- ${tag}` : tag);
    }
    if (!selectedQuickTags.includes(tag)) {
      setSelectedQuickTags(prev => [...prev, tag]);
    }
  };

  // 음성 STT 시뮬레이션 / Web Speech API
  const handleToggleVoice = () => {
    if (!isRecording) {
      setIsRecording(true);
      // Try Web Speech API if supported, or provide simulated brewery voice input
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = 'ko-KR';
          recognition.continuous = false;
          recognition.interimResults = false;
          recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setAudioTranscript(transcript);
            setDescription(prev => prev ? `${prev} ${transcript}` : transcript);
            setIsRecording(false);
          };
          recognition.onerror = () => {
            simulateVoice();
          };
          recognition.start();
          return;
        } catch {
          simulateVoice();
        }
      } else {
        simulateVoice();
      }
    } else {
      setIsRecording(false);
    }
  };

  const simulateVoice = () => {
    setTimeout(() => {
      const voiceSamples: Record<SuggestionCategory, string> = {
        BREAKDOWN_REPAIR: '3호 발효조 상부 교반기 모터가 과열되면서 멈췄습니다. 탄 냄새가 나고 온도가 계속 올라가고 있습니다.',
        RISK_ASSESSMENT: '여과실 배수로 덮개가 틀어져서 작업화가 걸려 넘어질 뻔했습니다. 바닥에 세척수가 고여 미끄럽습니다.',
        PROCESS_IMPROVEMENT: '원료 쌀 침지 후 탈수 시간을 10분 단축할 수 있는 타이머 알람을 설치하면 좋겠습니다.',
        PREVENTIVE_MAINT: '2호 제성탱크 배관 연결부 가스켓에서 미세 누수 흔적이 보입니다. 다음 주말 교체 바랍니다.',
      };
      const text = voiceSamples[category];
      setAudioTranscript(text);
      if (!title) {
        setTitle(text.substring(0, 30) + '...');
      }
      setDescription(prev => prev ? `${prev}\n${text}` : text);
      setIsRecording(false);
    }, 1800);
  };

  // 사진 촬영 / 첨부 시뮬레이션
  const handleAddPhoto = () => {
    if (attachments.length >= 3) {
      alert('첨부파일은 최대 3장까지 등록 가능합니다.');
      return;
    }

    const sampleImages = [
      {
        url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
        name: `현장_고장부위_${attachments.length + 1}.jpg`,
      },
      {
        url: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80',
        name: `공정_설비확인_${attachments.length + 1}.jpg`,
      },
      {
        url: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80',
        name: `바닥_위험개소_${attachments.length + 1}.jpg`,
      },
    ];

    const pick = sampleImages[attachments.length % sampleImages.length];
    const newAtt: AttachmentItem = {
      id: `att-${Date.now()}`,
      url: pick.url,
      name: pick.name,
      type: 'image',
      uploadedAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };

    setAttachments(prev => [...prev, newAtt]);
  };

  const handleRemovePhoto = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !description.trim()) {
      alert('제목 또는 상세 내용을 입력해 주세요.');
      return;
    }

    onSubmit({
      title: title.trim() || description.substring(0, 35),
      description: description.trim(),
      category,
      process,
      locationDetail: locationDetail.trim() || PROCESS_CONFIG[process].zone,
      isUrgent,
      urgencyReason: isUrgent ? `${CATEGORY_CONFIG[category].shortLabel}에 따른 즉각 조치 요청` : undefined,
      attachments,
      quickTags: selectedQuickTags,
      audioTranscript: audioTranscript || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-xl max-h-[92vh] sm:rounded-2xl rounded-t-2xl flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* 모달 헤더 (큰 터치 타겟) */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded font-bold bg-blue-600 text-white">
                F-02 신규 등록
              </span>
              <h2 className="text-lg font-bold">술술제안 현장 등록</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              작성자: {currentUser.name} ({PROCESS_CONFIG[currentUser.process]?.label})
              {isOffline && <span className="text-amber-400 font-bold ml-2">⚡ 오프라인 임시저장</span>}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 폼 본문 */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* 1. 제안 유형 (4대 카테고리 라디오 버튼 - 장갑 착용 친화적 대형 버튼) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              1. 제안 유형 선택 (4대 카테고리) <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['BREAKDOWN_REPAIR', 'RISK_ASSESSMENT', 'PROCESS_IMPROVEMENT', 'PREVENTIVE_MAINT'] as SuggestionCategory[]).map(cat => {
                const isSelected = category === cat;
                const config = CATEGORY_CONFIG[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`h-16 p-2 rounded-xl border-2 flex items-center gap-2.5 text-left transition-all ${
                      isSelected 
                        ? `${config.bgLight} ${config.border} ring-2 ring-blue-500/30 shadow-sm font-bold`
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="shrink-0 p-2 rounded-lg bg-white shadow-xs">
                      {cat === 'BREAKDOWN_REPAIR' && <Wrench className="w-5 h-5 text-rose-600" />}
                      {cat === 'RISK_ASSESSMENT' && <ShieldAlert className="w-5 h-5 text-orange-600" />}
                      {cat === 'PROCESS_IMPROVEMENT' && <Lightbulb className="w-5 h-5 text-amber-600" />}
                      {cat === 'PREVENTIVE_MAINT' && <Clock className="w-5 h-5 text-blue-600" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold truncate">
                        {config.shortLabel}
                        {config.isUrgentDefault && (
                          <span className="ml-1 text-[10px] bg-rose-600 text-white px-1.5 py-0.2 rounded font-extrabold">긴급</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{config.desc.split(',')[0]}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 긴급 알림 트리거 안내 (F-03) */}
            {isUrgent && (
              <div className="mt-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>F-03 긴급 알림:</strong> 등록 즉시 제품팀 관리자 및 공무/안전팀에 Push 알림이 전송됩니다.
                </span>
              </div>
            )}
          </div>

          {/* 2. 공정 선택 (드롭다운) & 상세 위치 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                2. 공정 선택 <span className="text-rose-500">*</span>
              </label>
              <select
                value={process}
                onChange={e => setProcess(e.target.value as BreweryProcess)}
                className="w-full h-12 px-3 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {Object.entries(PROCESS_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.icon} {cfg.label} (중요도 +{PROCESS_IMPORTANCE_SCORES[key as BreweryProcess]?.score}점)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                상세 위치 (설비/호기)
              </label>
              <input
                type="text"
                placeholder="예: 3호 발효조 상부 교반기, 병입 2라인"
                value={locationDetail}
                onChange={e => setLocationDetail(e.target.value)}
                className="w-full h-12 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* 3. 원터치 빠른 문구 및 실시간 예상 우선순위 점수 */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>원터치 빠른 문구 (터치 시 제목·내용·태그 자동 입력)</span>
                </div>
                <span className="text-[11px] font-bold text-slate-500">
                  선택 유형 +{CATEGORY_SEVERITY_SCORES[category]?.score}점
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ISSUE_CHECKLISTS[category]?.map((item, idx) => {
                  const isSelected = selectedQuickTags.includes(item);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectQuickTag(item)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium text-left transition-colors active:scale-95 ${
                        isSelected
                          ? 'bg-blue-50 border-blue-400 text-blue-800 font-bold'
                          : 'bg-white hover:bg-blue-50 border-slate-300 hover:border-blue-300 text-slate-700'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 실시간 예상 우선순위 점수 카드 */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-slate-600 shrink-0" />
                <div className="text-xs">
                  <div className="font-bold text-slate-800">자동 산정 예상 우선순위 (Firestore 저장)</div>
                  <div className="text-[11px] text-slate-500">
                    긴급 {livePriority.urgencyScore} + 유형({livePriority.categoryLabel}) {livePriority.categoryScore} + 공정 {livePriority.processScore}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-base font-black tabular-nums ${livePriorityMeta.textColor}`}>
                  {livePriority.totalScore}점
                </span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold border ${livePriorityMeta.badgeClass}`}>
                  {livePriorityMeta.label}
                </span>
              </div>
            </div>
          </div>

          {/* 4. 제목 및 상세 내용 (음성 STT 지원) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                3. 제안 및 고장 내용 입력 <span className="text-rose-500">*</span>
              </label>
              
              {/* 음성인식 STT 버튼 */}
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  isRecording 
                    ? 'bg-rose-600 text-white animate-pulse' 
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                }`}
              >
                {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isRecording ? '듣는 중...' : '음성으로 말하기 (STT)'}</span>
              </button>
            </div>

            <input
              type="text"
              placeholder="제목 (간단 명료하게 한 줄)"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />

            <textarea
              rows={3}
              placeholder="현장 상황 및 조치 필요 사항을 기재해 주세요. (음성 입력 가능)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />

            {audioTranscript && (
              <div className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-100 text-[11px] text-indigo-900 flex items-start gap-1.5">
                <Mic className="w-3 h-3 text-indigo-600 mt-0.5 shrink-0" />
                <span><strong>인식된 음성:</strong> "{audioTranscript}"</span>
              </div>
            )}
          </div>

          {/* 5. 사진 첨부 (앱 내 카메라 구동 및 갤러리 접근, 최대 3장) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700">
                4. 현장 사진 첨부 (최대 3장)
              </label>
              <span className="text-xs font-semibold text-slate-500">
                {attachments.length} / 3장
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {attachments.map((att) => (
                <div key={att.id} className="relative aspect-square rounded-xl overflow-hidden border border-slate-300 group">
                  <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(att.id)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center text-xs hover:bg-rose-600 transition-colors"
                  >
                    ×
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                    {att.name}
                  </div>
                </div>
              ))}

              {attachments.length < 3 && (
                <button
                  type="button"
                  onClick={handleAddPhoto}
                  className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-blue-600 transition-colors active:scale-95"
                >
                  <Camera className="w-6 h-6" />
                  <span className="text-xs font-bold">사진 촬영</span>
                  <span className="text-[10px] text-slate-400">+ 첨부</span>
                </button>
              )}
            </div>
          </div>

          {/* 하단 버튼 (장갑 낀 손으로 누르기 쉬운 높이 54px+) */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full h-14 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl shadow-lg font-extrabold text-base flex items-center justify-center gap-2 transition-transform"
            >
              <CheckCircle2 className="w-6 h-6" />
              <span>
                {isOffline ? '오프라인 저장 (온라인 시 자동 전송)' : '현장 제안 즉시 등록하기'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
