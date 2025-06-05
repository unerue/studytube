'use client';

import { useState } from 'react';
import { Select, Button, Typography, Slider, Switch, Modal } from 'antd';
import { 
  SettingOutlined,
  SoundOutlined,
  TranslationOutlined
} from '@ant-design/icons';

const { Option } = Select;
const { Text, Title } = Typography;

interface SubtitleSettingsProps {
  visible: boolean;
  onClose: () => void;
  language: string;
  onLanguageChange: (language: string) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  showOriginal: boolean;
  onShowOriginalChange: (show: boolean) => void;
  showTranslated: boolean;
  onShowTranslatedChange: (show: boolean) => void;
  autoScroll: boolean;
  onAutoScrollChange: (scroll: boolean) => void;
  isListening: boolean;
  onListeningChange: (listening: boolean) => void;
}

export function SubtitleSettings({
  visible,
  onClose,
  language,
  onLanguageChange,
  fontSize,
  onFontSizeChange,
  showOriginal,
  onShowOriginalChange,
  showTranslated,
  onShowTranslatedChange,
  autoScroll,
  onAutoScrollChange,
  isListening,
  onListeningChange
}: SubtitleSettingsProps) {
  const languages = [
    { code: 'ko', name: '한국어' },
    { code: 'en', name: 'English' },
    { code: 'ja', name: '日本語' },
    { code: 'zh', name: '中文' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'ru', name: 'Русский' }
  ];

  return (
    <Modal
      title={
        <div className="flex items-center space-x-2">
          <SettingOutlined />
          <span>자막 설정</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          닫기
        </Button>
      ]}
      width={500}
    >
      <div className="space-y-6">
        {/* 자막 수신 제어 */}
        <div>
          <Title level={5} className="mb-3">자막 수신</Title>
          <div className="flex items-center space-x-3">
            <Button
              type={isListening ? 'primary' : 'default'}
              icon={<SoundOutlined />}
              onClick={() => onListeningChange(!isListening)}
            >
              {isListening ? '수신 중지' : '수신 시작'}
            </Button>
            <Text type="secondary">
              {isListening ? '실시간으로 자막을 수신하고 있습니다' : '자막 수신이 중지되었습니다'}
            </Text>
          </div>
        </div>

        {/* 언어 설정 */}
        <div>
          <Title level={5} className="mb-3">번역 언어</Title>
          <Select
            value={language}
            onChange={onLanguageChange}
            className="w-full"
            size="large"
          >
            {languages.map(lang => (
              <Option key={lang.code} value={lang.code}>
                <div className="flex items-center space-x-2">
                  <TranslationOutlined />
                  <span>{lang.name}</span>
                </div>
              </Option>
            ))}
          </Select>
        </div>

        {/* 폰트 크기 */}
        <div>
          <Title level={5} className="mb-3">글자 크기</Title>
          <Slider
            min={16}
            max={32}
            value={fontSize}
            onChange={onFontSizeChange}
            marks={{
              16: '작게',
              24: '보통',
              32: '크게'
            }}
            className="w-full"
          />
          <Text type="secondary" className="text-center block mt-2">
            현재 크기: {fontSize}px
          </Text>
        </div>

        {/* 표시 옵션 */}
        <div>
          <Title level={5} className="mb-3">표시 옵션</Title>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>원문 표시</span>
              <Switch 
                checked={showOriginal} 
                onChange={onShowOriginalChange}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span>번역문 표시</span>
              <Switch 
                checked={showTranslated} 
                onChange={onShowTranslatedChange}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span>자동 스크롤</span>
              <Switch 
                checked={autoScroll} 
                onChange={onAutoScrollChange}
              />
            </div>
          </div>
        </div>

        {/* 안내 메시지 */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <Text type="secondary" className="text-sm">
            💡 설정은 실시간으로 적용됩니다. 자막 창에서는 가독성을 위해 큰 폰트로 표시됩니다.
          </Text>
        </div>
      </div>
    </Modal>
  );
} 