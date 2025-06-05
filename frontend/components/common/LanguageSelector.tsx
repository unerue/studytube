'use client';

import { Select } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useLanguage } from '@/lib/context/LanguageContext';

const { Option } = Select;

interface LanguageSelectorProps {
  size?: 'small' | 'middle' | 'large';
  className?: string;
  showIcon?: boolean;
}

export function LanguageSelector({ 
  size = 'middle', 
  className = '',
  showIcon = true 
}: LanguageSelectorProps) {
  const { language, setLanguage, supportedLanguages } = useLanguage();

  return (
    <Select
      value={language}
      onChange={setLanguage}
      size={size}
      className={className}
      style={{ minWidth: 120 }}
      suffixIcon={showIcon ? <GlobalOutlined /> : undefined}
    >
      {supportedLanguages.map(lang => (
        <Option key={lang.code} value={lang.code}>
          <span className="mr-2">{lang.flag}</span>
          {lang.name}
        </Option>
      ))}
    </Select>
  );
} 