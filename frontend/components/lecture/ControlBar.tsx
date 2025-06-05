'use client';

import { Button, Tooltip, Dropdown, Menu } from 'antd';
import { 
  AudioOutlined, 
  AudioMutedOutlined,
  VideoCameraOutlined,
  VideoCameraFilled,
  DesktopOutlined,
  MessageOutlined,
  TranslationOutlined,
  TeamOutlined,
  SettingOutlined,
  MoreOutlined,
  QuestionCircleOutlined,
  PhoneOutlined
} from '@ant-design/icons';

interface ControlBarProps {
  userRole: 'instructor' | 'student';
  isAudioOn: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  showParticipants: boolean;
  showBottomPanel: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleParticipants: () => void;
  onToggleBottomPanel: () => void;
}

export function ControlBar({
  userRole,
  isAudioOn,
  isVideoOn,
  isScreenSharing,
  showParticipants,
  showBottomPanel,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleParticipants,
  onToggleBottomPanel
}: ControlBarProps) {

  const screenShareMenu = (
    <Menu>
      <Menu.Item key="desktop" icon={<DesktopOutlined />}>
        전체 화면
      </Menu.Item>
      <Menu.Item key="window" icon={<DesktopOutlined />}>
        창 선택
      </Menu.Item>
      <Menu.Item key="tab" icon={<DesktopOutlined />}>
        브라우저 탭
      </Menu.Item>
    </Menu>
  );

  const moreMenu = (
    <Menu>
      <Menu.Item key="record" icon={<SettingOutlined />}>
        녹화 시작
      </Menu.Item>
      <Menu.Item key="whiteboard" icon={<DesktopOutlined />}>
        화이트보드
      </Menu.Item>
      <Menu.Item key="polls" icon={<MessageOutlined />}>
        투표/퀴즈
      </Menu.Item>
      <Menu.Item key="breakout" icon={<TeamOutlined />}>
        소회의실
      </Menu.Item>
    </Menu>
  );

  return (
    <div className="bg-gray-800 border-t border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* 왼쪽: 미디어 컨트롤 */}
        <div className="flex items-center space-x-3">
          {/* 마이크 */}
          <Tooltip title={isAudioOn ? '마이크 끄기' : '마이크 켜기'}>
            <Button
              type={isAudioOn ? 'primary' : 'default'}
              shape="circle"
              size="large"
              icon={isAudioOn ? <AudioOutlined /> : <AudioMutedOutlined />}
              onClick={onToggleAudio}
              className={`${
                isAudioOn 
                  ? 'bg-green-600 border-green-600 hover:bg-green-700' 
                  : 'bg-red-600 border-red-600 hover:bg-red-700 text-white'
              }`}
            />
          </Tooltip>

          {/* 비디오 */}
          <Tooltip title={isVideoOn ? '비디오 끄기' : '비디오 켜기'}>
            <Button
              type={isVideoOn ? 'primary' : 'default'}
              shape="circle"
              size="large"
              icon={isVideoOn ? <VideoCameraFilled /> : <VideoCameraOutlined />}
              onClick={onToggleVideo}
              className={`${
                isVideoOn 
                  ? 'bg-blue-600 border-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-600 border-gray-600 hover:bg-gray-700 text-white'
              }`}
            />
          </Tooltip>

          {/* 화면 공유 (강사만) */}
          {userRole === 'instructor' && (
            <Tooltip title={isScreenSharing ? '화면 공유 중지' : '화면 공유'}>
              <Dropdown overlay={screenShareMenu} placement="topLeft" trigger={['click']}>
                <Button
                  type={isScreenSharing ? 'primary' : 'default'}
                  shape="circle"
                  size="large"
                  icon={<DesktopOutlined />}
                  className={`${
                    isScreenSharing 
                      ? 'bg-purple-600 border-purple-600 hover:bg-purple-700' 
                      : 'text-white hover:bg-gray-700'
                  }`}
                />
              </Dropdown>
            </Tooltip>
          )}

          {/* 손들기 (학생만) */}
          {userRole === 'student' && (
            <Tooltip title="질문하기">
              <Button
                type="default"
                shape="circle"
                size="large"
                icon={<QuestionCircleOutlined />}
                className="text-white hover:bg-yellow-600 hover:border-yellow-600"
              />
            </Tooltip>
          )}
        </div>

        {/* 중앙: 시간 정보 */}
        <div className="flex items-center space-x-4 text-white">
          <div className="text-center">
            <div className="text-sm text-gray-400">강의 시간</div>
            <div className="text-lg font-mono">1:23:45</div>
          </div>
          <div className="w-px h-8 bg-gray-600" />
          <div className="text-center">
            <div className="text-sm text-gray-400">참가자</div>
            <div className="text-lg font-medium">24명</div>
          </div>
        </div>

        {/* 오른쪽: UI 컨트롤 */}
        <div className="flex items-center space-x-3">
          {/* 참가자 목록 토글 */}
          <Tooltip title={showParticipants ? '참가자 목록 숨기기' : '참가자 목록 보기'}>
            <Button
              type={showParticipants ? 'primary' : 'default'}
              shape="circle"
              size="large"
              icon={<TeamOutlined />}
              onClick={onToggleParticipants}
              className={showParticipants ? 'bg-blue-600 border-blue-600' : 'text-white hover:bg-gray-700'}
            />
          </Tooltip>

          {/* 채팅/자막 패널 토글 */}
          <Tooltip title={showBottomPanel ? '하단 패널 숨기기' : '하단 패널 보기'}>
            <Button
              type={showBottomPanel ? 'primary' : 'default'}
              shape="circle"
              size="large"
              icon={<MessageOutlined />}
              onClick={onToggleBottomPanel}
              className={showBottomPanel ? 'bg-green-600 border-green-600' : 'text-white hover:bg-gray-700'}
            />
          </Tooltip>

          {/* 자막 (빠른 접근) */}
          <Tooltip title="자막 설정">
            <Button
              type="default"
              shape="circle"
              size="large"
              icon={<TranslationOutlined />}
              className="text-white hover:bg-gray-700"
            />
          </Tooltip>

          {/* 더보기 메뉴 */}
          <Tooltip title="더보기">
            <Dropdown overlay={moreMenu} placement="topRight" trigger={['click']}>
              <Button
                type="default"
                shape="circle"
                size="large"
                icon={<MoreOutlined />}
                className="text-white hover:bg-gray-700"
              />
            </Dropdown>
          </Tooltip>

          {/* 통화 종료 */}
          <Tooltip title="강의실 나가기">
            <Button
              type="primary"
              danger
              shape="circle"
              size="large"
              icon={<PhoneOutlined className="rotate-[135deg]" />}
              onClick={() => {
                if (confirm('정말 강의실을 나가시겠습니까?')) {
                  window.location.href = '/lectures/new';
                }
              }}
              className="bg-red-600 border-red-600 hover:bg-red-700"
            />
          </Tooltip>
        </div>
      </div>

      {/* 하단 상태 표시 */}
      <div className="mt-3 flex items-center justify-center space-x-6 text-xs text-gray-400">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>연결 상태: 양호</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span>지연시간: 45ms</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span>품질: HD 720p</span>
        </div>
        
        {isScreenSharing && (
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            <span>화면 공유 중</span>
          </div>
        )}
      </div>
    </div>
  );
} 