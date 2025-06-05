'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
  supportedLanguages: Array<{
    code: string;
    name: string;
    flag: string;
  }>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// 지원하는 언어 목록
const supportedLanguages = [
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' }
];

// 번역 데이터
const translations: Record<string, Record<string, string>> = {
  ko: {
    // Navigation
    'nav.dashboard': '대시보드',
    'nav.study': '학습하기',
    'nav.liveLecture': '실시간 강의',
    'nav.lectureManagement': '강의 관리',
    'nav.createLecture': '강의 생성',
    'nav.lectureList': '강의 목록',
    'nav.myLectures': '내 강의',
    'nav.profile': '회원정보',
    'nav.logout': '로그아웃',
    
    // Roles
    'role.instructor': '강사',
    'role.student': '학생',
    'role.switch': '전환',
    
    // Greetings
    'greeting.hello': '안녕하세요',
    
    // Auth
    'auth.register': '회원가입',
    'auth.login': '로그인',
    'auth.username': '사용자명',
    'auth.email': '이메일',
    'auth.password': '비밀번호',
    'auth.confirmPassword': '비밀번호 확인',
    'auth.preferredLanguage': '언어 선택',
    'auth.nationality': '국적',
    'auth.languageDescription': '선택한 언어로 StudyTube 인터페이스가 표시됩니다.',
    'auth.passwordMismatch': '비밀번호가 일치하지 않습니다.',
    
    // Header
    'header.participants': '참가자',
    'header.settings': '설정',
    'header.logout': '나가기',
    'header.audioSettings': '오디오 설정',
    'header.videoSettings': '비디오 설정',
    'header.languageSettings': '언어 설정',
    
    // Participant List
    'participants.title': '참가자',
    'participants.instructor': '강사',
    'participants.students': '학생',
    'participants.raisedHand': '질문 있는 학생',
    'participants.audioOn': '음성 켜짐',
    'participants.audioOff': '음성 꺼짐',
    'participants.videoOn': '비디오 켜짐',
    'participants.mute': '음소거',
    'participants.unmute': '음소거 해제',
    'participants.videoOn_action': '비디오 끄기',
    'participants.videoOff_action': '비디오 켜기',
    
    // Video Area
    'video.startScreenShare': '화면 공유를 시작하세요',
    'video.shareDescription': 'PPT, 문서, 브라우저 등을 학생들과 공유할 수 있습니다',
    'video.startShare': '화면 공유 시작',
    'video.stopShare': '공유 중지',
    'video.sharing': '화면 공유 중',
    'video.waitingForInstructor': '강의를 기다리고 있습니다',
    'video.waitingDescription': '강사가 화면 공유를 시작하면 여기에 표시됩니다',
    'video.ppt': 'PPT',
    'video.desktop': '바탕화면',
    'video.browser': '브라우저',
    
    // Chat Panel
    'chat.title': '채팅',
    'chat.privateMode': '비공개 모드',
    'chat.publicMode': '전체 채팅',
    'chat.privateDesc': '비공개 메시지 모드: 강사만 볼 수 있습니다',
    'chat.instructor_placeholder': '학생들에게 메시지를 보내세요...',
    'chat.student_placeholder': '교수님에게 질문하거나 메시지를 보내세요...',
    'chat.send': '전송',
    'chat.keyboardHint': 'Shift + Enter로 줄바꿈, Enter로 전송',
    'chat.instructor_role': '강사',
    'chat.private_label': '비공개',
    
    // Subtitle Panel
    'subtitle.title': '실시간 자막',
    'subtitle.listening': '수신 중',
    'subtitle.paused': '일시정지',
    'subtitle.translationLanguage': '번역 언어',
    'subtitle.fontSize': '글자 크기',
    'subtitle.original': '원문',
    'subtitle.translation': '번역',
    'subtitle.autoScroll': '자동 스크롤',
    'subtitle.pause': '일시정지',
    'subtitle.start': '수신 시작',
    'subtitle.totalSubtitles': '총 {count}개 자막',
    'subtitle.aiAccuracy': 'AI 번역 정확도: 평균 90%',
    'subtitle.waitingForAudio': '음성을 기다리고 있습니다...',
    'subtitle.pausedMessage': '자막 수신이 일시정지되었습니다',
    
    // Control Bar
    'control.muteOn': '마이크 끄기',
    'control.muteOff': '마이크 켜기',
    'control.videoOn': '비디오 끄기',
    'control.videoOff': '비디오 켜기',
    'control.screenShare': '화면 공유',
    'control.stopScreenShare': '화면 공유 중지',
    'control.raiseHand': '손들기',
    'control.lectureTime': '강의 시간',
    'control.participantCount': '참가자',
    'control.showParticipants': '참가자 목록 보기',
    'control.hideParticipants': '참가자 목록 숨기기',
    'control.showBottomPanel': '하단 패널 보기',
    'control.hideBottomPanel': '하단 패널 숨기기',
    'control.subtitleSettings': '자막 설정',
    'control.more': '더보기',
    'control.leaveRoom': '강의실 나가기',
    'control.connectionGood': '연결 상태: 양호',
    'control.latency': '지연시간: {ms}ms',
    'control.quality': '품질: HD 720p',
    'control.screenSharing': '화면 공유 중',
    
    // Common
    'common.confirm': '확인',
    'common.cancel': '취소',
    'common.close': '닫기',
    'common.save': '저장',
    'common.loading': '로딩 중...',
    'common.error': '오류가 발생했습니다',
    'common.success': '성공적으로 완료되었습니다',
    'common.user': '사용자'
  },
  
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.study': 'Study',
    'nav.liveLecture': 'Live Lecture',
    'nav.lectureManagement': 'Lecture Management',
    'nav.createLecture': 'Create Lecture',
    'nav.lectureList': 'Lecture List',
    'nav.myLectures': 'My Lectures',
    'nav.profile': 'Profile',
    'nav.logout': 'Logout',
    
    // Roles
    'role.instructor': 'Instructor',
    'role.student': 'Student',
    'role.switch': 'Switch',
    
    // Greetings
    'greeting.hello': 'Hello',
    
    // Auth
    'auth.register': 'Sign Up',
    'auth.login': 'Sign In',
    'auth.username': 'Username',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.confirmPassword': 'Confirm Password',
    'auth.preferredLanguage': 'Language',
    'auth.nationality': 'Nationality',
    'auth.languageDescription': 'StudyTube interface will be displayed in your selected language.',
    'auth.passwordMismatch': 'Passwords do not match.',
    
    // Header
    'header.participants': 'Participants',
    'header.settings': 'Settings',
    'header.logout': 'Leave',
    'header.audioSettings': 'Audio Settings',
    'header.videoSettings': 'Video Settings',
    'header.languageSettings': 'Language Settings',
    
    // Participant List
    'participants.title': 'Participants',
    'participants.instructor': 'Instructor',
    'participants.students': 'Students',
    'participants.raisedHand': 'Students with Questions',
    'participants.audioOn': 'Audio On',
    'participants.audioOff': 'Audio Off',
    'participants.videoOn': 'Video On',
    'participants.mute': 'Mute',
    'participants.unmute': 'Unmute',
    'participants.videoOn_action': 'Turn Off Video',
    'participants.videoOff_action': 'Turn On Video',
    
    // Video Area
    'video.startScreenShare': 'Start Screen Sharing',
    'video.shareDescription': 'You can share PPT, documents, browsers, etc. with students',
    'video.startShare': 'Start Screen Share',
    'video.stopShare': 'Stop Sharing',
    'video.sharing': 'Screen Sharing',
    'video.waitingForInstructor': 'Waiting for Lecture',
    'video.waitingDescription': 'Content will be displayed here when instructor starts screen sharing',
    'video.ppt': 'PPT',
    'video.desktop': 'Desktop',
    'video.browser': 'Browser',
    
    // Chat Panel
    'chat.title': 'Chat',
    'chat.privateMode': 'Private Mode',
    'chat.publicMode': 'Public Chat',
    'chat.privateDesc': 'Private message mode: Only instructor can see',
    'chat.instructor_placeholder': 'Send a message to students...',
    'chat.student_placeholder': 'Ask a question or send a message to professor...',
    'chat.send': 'Send',
    'chat.keyboardHint': 'Shift + Enter for new line, Enter to send',
    'chat.instructor_role': 'Instructor',
    'chat.private_label': 'Private',
    
    // Subtitle Panel
    'subtitle.title': 'Real-time Subtitles',
    'subtitle.listening': 'Listening',
    'subtitle.paused': 'Paused',
    'subtitle.translationLanguage': 'Translation Language',
    'subtitle.fontSize': 'Font Size',
    'subtitle.original': 'Original',
    'subtitle.translation': 'Translation',
    'subtitle.autoScroll': 'Auto Scroll',
    'subtitle.pause': 'Pause',
    'subtitle.start': 'Start Listening',
    'subtitle.totalSubtitles': 'Total {count} subtitles',
    'subtitle.aiAccuracy': 'AI Translation Accuracy: 90% Average',
    'subtitle.waitingForAudio': 'Waiting for audio...',
    'subtitle.pausedMessage': 'Subtitle reception is paused',
    
    // Control Bar
    'control.muteOn': 'Mute Microphone',
    'control.muteOff': 'Unmute Microphone',
    'control.videoOn': 'Turn Off Video',
    'control.videoOff': 'Turn On Video',
    'control.screenShare': 'Screen Share',
    'control.stopScreenShare': 'Stop Screen Share',
    'control.raiseHand': 'Raise Hand',
    'control.lectureTime': 'Lecture Time',
    'control.participantCount': 'Participants',
    'control.showParticipants': 'Show Participant List',
    'control.hideParticipants': 'Hide Participant List',
    'control.showBottomPanel': 'Show Bottom Panel',
    'control.hideBottomPanel': 'Hide Bottom Panel',
    'control.subtitleSettings': 'Subtitle Settings',
    'control.more': 'More',
    'control.leaveRoom': 'Leave Room',
    'control.connectionGood': 'Connection: Good',
    'control.latency': 'Latency: {ms}ms',
    'control.quality': 'Quality: HD 720p',
    'control.screenSharing': 'Screen Sharing',
    
    // Common
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.save': 'Save',
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.success': 'Successfully completed',
    'common.user': 'User'
  },
  
  ja: {
    // Navigation
    'nav.dashboard': 'ダッシュボード',
    'nav.study': '学習',
    'nav.liveLecture': 'ライブ講義',
    'nav.lectureManagement': '講義管理',
    'nav.createLecture': '講義作成',
    'nav.lectureList': '講義一覧',
    'nav.myLectures': 'マイ講義',
    'nav.profile': 'プロフィール',
    'nav.logout': 'ログアウト',
    
    // Roles
    'role.instructor': '講師',
    'role.student': '学生',
    'role.switch': '切り替え',
    
    // Greetings
    'greeting.hello': 'こんにちは',
    
    // Auth
    'auth.register': '新規登録',
    'auth.login': 'ログイン',
    'auth.username': 'ユーザー名',
    'auth.email': 'メールアドレス',
    'auth.password': 'パスワード',
    'auth.confirmPassword': 'パスワード確認',
    'auth.preferredLanguage': '言語',
    'auth.nationality': '国籍',
    'auth.languageDescription': '選択した言語でStudyTubeインターフェースが表示されます。',
    'auth.passwordMismatch': 'パスワードが一致しません。',
    
    // Header
    'header.participants': '参加者',
    'header.settings': '設定',
    'header.logout': '退出',
    'header.audioSettings': 'オーディオ設定',
    'header.videoSettings': 'ビデオ設定',
    'header.languageSettings': '言語設定',
    
    // Participant List
    'participants.title': '参加者',
    'participants.instructor': '講師',
    'participants.students': '学生',
    'participants.raisedHand': '質問のある学生',
    'participants.audioOn': '音声オン',
    'participants.audioOff': '音声オフ',
    'participants.videoOn': 'ビデオオン',
    'participants.mute': 'ミュート',
    'participants.unmute': 'ミュート解除',
    'participants.videoOn_action': 'ビデオをオフ',
    'participants.videoOff_action': 'ビデオをオン',
    
    // Video Area
    'video.startScreenShare': '画面共有を開始',
    'video.shareDescription': 'PPT、文書、ブラウザなどを学生と共有できます',
    'video.startShare': '画面共有開始',
    'video.stopShare': '共有停止',
    'video.sharing': '画面共有中',
    'video.waitingForInstructor': '講義を待機中',
    'video.waitingDescription': '講師が画面共有を開始するとここに表示されます',
    'video.ppt': 'PPT',
    'video.desktop': 'デスクトップ',
    'video.browser': 'ブラウザ',
    
    // Chat Panel
    'chat.title': 'チャット',
    'chat.privateMode': 'プライベートモード',
    'chat.publicMode': '全体チャット',
    'chat.privateDesc': 'プライベートメッセージモード：講師のみ表示',
    'chat.instructor_placeholder': '学生にメッセージを送信...',
    'chat.student_placeholder': '教授に質問またはメッセージを送信...',
    'chat.send': '送信',
    'chat.keyboardHint': 'Shift + Enterで改行、Enterで送信',
    'chat.instructor_role': '講師',
    'chat.private_label': 'プライベート',
    
    // Subtitle Panel
    'subtitle.title': 'リアルタイム字幕',
    'subtitle.listening': '受信中',
    'subtitle.paused': '一時停止',
    'subtitle.translationLanguage': '翻訳言語',
    'subtitle.fontSize': 'フォントサイズ',
    'subtitle.original': '原文',
    'subtitle.translation': '翻訳',
    'subtitle.autoScroll': '自動スクロール',
    'subtitle.pause': '一時停止',
    'subtitle.start': '受信開始',
    'subtitle.totalSubtitles': '合計{count}個の字幕',
    'subtitle.aiAccuracy': 'AI翻訳精度：平均90%',
    'subtitle.waitingForAudio': '音声を待機中...',
    'subtitle.pausedMessage': '字幕受信が一時停止されました',
    
    // Control Bar
    'control.muteOn': 'マイクをオフ',
    'control.muteOff': 'マイクをオン',
    'control.videoOn': 'ビデオをオフ',
    'control.videoOff': 'ビデオをオン',
    'control.screenShare': '画面共有',
    'control.stopScreenShare': '画面共有停止',
    'control.raiseHand': '手を上げる',
    'control.lectureTime': '講義時間',
    'control.participantCount': '参加者',
    'control.showParticipants': '参加者リストを表示',
    'control.hideParticipants': '参加者リストを非表示',
    'control.showBottomPanel': '下部パネルを表示',
    'control.hideBottomPanel': '下部パネルを非表示',
    'control.subtitleSettings': '字幕設定',
    'control.more': 'その他',
    'control.leaveRoom': 'ルームを退出',
    'control.connectionGood': '接続状態：良好',
    'control.latency': '遅延：{ms}ms',
    'control.quality': '品質：HD 720p',
    'control.screenSharing': '画면共有中',
    
    // Common
    'common.confirm': '確認',
    'common.cancel': 'キャンセル',
    'common.close': '閉じる',
    'common.save': '保存',
    'common.loading': '読み込み中...',
    'common.error': 'エラーが発生しました',
    'common.success': '正常に完了しました',
    'common.user': 'ユーザー'
  },
  
  zh: {
    // Navigation
    'nav.dashboard': '仪表板',
    'nav.study': '学习',
    'nav.liveLecture': '实时讲座',
    'nav.lectureManagement': '讲座管理',
    'nav.createLecture': '创建讲座',
    'nav.lectureList': '讲座列表',
    'nav.myLectures': '我的讲座',
    'nav.profile': '个人资料',
    'nav.logout': '注销',
    
    // Roles
    'role.instructor': '讲师',
    'role.student': '学生',
    'role.switch': '切换',
    
    // Greetings
    'greeting.hello': '您好',
    
    // Common
    'common.user': '用户'
  },
  
  es: {
    // Navigation
    'nav.dashboard': 'Panel de Control',
    'nav.study': 'Estudiar',
    'nav.liveLecture': 'Clase en Vivo',
    'nav.lectureManagement': 'Gestión de Clases',
    'nav.createLecture': 'Crear Clase',
    'nav.lectureList': 'Lista de Clases',
    'nav.myLectures': 'Mis Clases',
    'nav.profile': 'Perfil',
    'nav.logout': 'Cerrar Sesión',
    
    // Roles
    'role.instructor': 'Instructor',
    'role.student': 'Estudiante',
    'role.switch': 'Cambiar',
    
    // Greetings
    'greeting.hello': 'Hola',
    
    // Common
    'common.user': 'Usuario'
  },
  
  fr: {
    // Navigation
    'nav.dashboard': 'Tableau de Bord',
    'nav.study': 'Étudier',
    'nav.liveLecture': 'Cours en Direct',
    'nav.lectureManagement': 'Gestion des Cours',
    'nav.createLecture': 'Créer un Cours',
    'nav.lectureList': 'Liste des Cours',
    'nav.myLectures': 'Mes Cours',
    'nav.profile': 'Profil',
    'nav.logout': 'Déconnexion',
    
    // Roles
    'role.instructor': 'Instructeur',
    'role.student': 'Étudiant',
    'role.switch': 'Changer',
    
    // Greetings
    'greeting.hello': 'Bonjour',
    
    // Common
    'common.user': 'Utilisateur'
  },
  
  de: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.study': 'Lernen',
    'nav.liveLecture': 'Live-Vorlesung',
    'nav.lectureManagement': 'Vorlesungsverwaltung',
    'nav.createLecture': 'Vorlesung Erstellen',
    'nav.lectureList': 'Vorlesungsliste',
    'nav.myLectures': 'Meine Vorlesungen',
    'nav.profile': 'Profil',
    'nav.logout': 'Abmelden',
    
    // Roles
    'role.instructor': 'Dozent',
    'role.student': 'Student',
    'role.switch': 'Wechseln',
    
    // Greetings
    'greeting.hello': 'Hallo',
    
    // Common
    'common.user': 'Benutzer'
  },
  
  ru: {
    // Navigation
    'nav.dashboard': 'Панель управления',
    'nav.study': 'Изучать',
    'nav.liveLecture': 'Прямая лекция',
    'nav.lectureManagement': 'Управление лекциями',
    'nav.createLecture': 'Создать лекцию',
    'nav.lectureList': 'Список лекций',
    'nav.myLectures': 'Мои лекции',
    'nav.profile': 'Профиль',
    'nav.logout': 'Выйти',
    
    // Roles
    'role.instructor': 'Преподаватель',
    'role.student': 'Студент',
    'role.switch': 'Переключить',
    
    // Greetings
    'greeting.hello': 'Привет',
    
    // Common
    'common.user': 'Пользователь'
  }
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState('ko');

  useEffect(() => {
    // 로컬 스토리지에서 언어 설정 로드
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && supportedLanguages.some(lang => lang.code === savedLanguage)) {
      setLanguageState(savedLanguage);
    } else {
      // 브라우저 언어 감지
      const browserLanguage = navigator.language.split('-')[0];
      if (supportedLanguages.some(lang => lang.code === browserLanguage)) {
        setLanguageState(browserLanguage);
      }
    }
  }, []);

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string, params?: Record<string, string | number>) => {
    let translation = translations[language]?.[key] || translations['ko'][key] || key;
    
    // 파라미터 치환
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        translation = translation.replace(`{${paramKey}}`, String(value));
      });
    }
    
    return translation;
  };

  return (
    <LanguageContext.Provider 
      value={{ 
        language, 
        setLanguage, 
        t, 
        supportedLanguages 
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
} 