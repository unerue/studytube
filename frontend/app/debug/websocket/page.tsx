'use client';

import { useState, useEffect } from 'react';
import { Button, Card, Typography, Space, Alert, List } from 'antd';
import { useAuth } from '@/lib/context/AuthContext';

const { Title, Text, Paragraph } = Typography;

export default function WebSocketDebugPage() {
  const { user, isLoggedIn } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);
  const [wsStatus, setWsStatus] = useState<string>('disconnected');
  const [currentWs, setCurrentWs] = useState<WebSocket | null>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev, logMessage]);
  };

  const testWebSocketConnection = (lectureId: number = 1) => {
    const token = localStorage.getItem('access_token');
    
    addLog(`=== WebSocket 연결 테스트 시작 ===`);
    addLog(`사용자: ${user?.username || '없음'}`);
    addLog(`역할: ${user?.role || '없음'}`);
    addLog(`로그인 상태: ${isLoggedIn ? '로그인됨' : '로그아웃됨'}`);
    addLog(`토큰 존재: ${token ? '있음' : '없음'}`);
    
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          addLog(`토큰 페이로드: ${JSON.stringify(payload)}`);
          
          // user_id 체크
          if (!payload.user_id) {
            addLog('⚠️ 토큰에 user_id가 없습니다! 새로 로그인이 필요할 수 있습니다.');
          }
        }
      } catch (err) {
        addLog(`토큰 파싱 실패: ${err}`);
      }
    }

    if (!token) {
      addLog('❌ 토큰이 없어서 연결을 시도하지 않습니다.');
      return;
    }

    const wsUrl = `ws://localhost:8000/ws/chat/${lectureId}?token=${token}`;
    addLog(`WebSocket URL: ${wsUrl}`);

    try {
      const ws = new WebSocket(wsUrl);
      setCurrentWs(ws);
      setWsStatus('connecting');
      addLog('WebSocket 객체 생성 완료, 연결 시도 중...');

      const connectionTimeout = setTimeout(() => {
        addLog('❌ 연결 타임아웃 (10초)');
        ws.close();
        setWsStatus('timeout');
      }, 10000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        addLog('✅ WebSocket 연결 성공!');
        setWsStatus('connected');
        
        // 테스트 메시지 전송
        const testMessage = {
          type: 'chat_message',
          message: '테스트 메시지입니다.'
        };
        ws.send(JSON.stringify(testMessage));
        addLog(`테스트 메시지 전송: ${JSON.stringify(testMessage)}`);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        addLog(`📨 메시지 수신: ${JSON.stringify(data)}`);
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        addLog(`🔌 연결 종료: 코드=${event.code}, 이유=${event.reason || '없음'}`);
        setWsStatus('disconnected');
        setCurrentWs(null);
        
        // 에러 코드별 설명
        switch(event.code) {
          case 1008:
            addLog('❌ 토큰 인증 실패 - 토큰이 유효하지 않습니다.');
            break;
          case 1011:
            addLog('❌ 서버 내부 에러 - 서버 측 문제가 있습니다.');
            break;
          case 1006:
            addLog('❌ 비정상 종료 - 네트워크 문제 또는 서버 오류');
            break;
          default:
            addLog(`ℹ️ 정상 종료 (코드: ${event.code})`);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        addLog(`❌ WebSocket 에러: ${error}`);
        setWsStatus('error');
      };

    } catch (err) {
      addLog(`❌ WebSocket 생성 실패: ${err}`);
      setWsStatus('error');
    }
  };

  const disconnect = () => {
    if (currentWs) {
      currentWs.close();
      addLog('사용자가 연결을 종료했습니다.');
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const checkLocalStorage = () => {
    addLog('=== 로컬스토리지 확인 ===');
    const token = localStorage.getItem('access_token');
    addLog(`access_token: ${token ? '존재함' : '없음'}`);
    
    if (token) {
      addLog(`토큰 길이: ${token.length}자`);
      addLog(`토큰 시작: ${token.substring(0, 50)}...`);
    }
    
    const allKeys = Object.keys(localStorage);
    addLog(`로컬스토리지 전체 키: ${allKeys.join(', ')}`);
  };

  const forceRelogin = async () => {
    addLog('=== 강제 재로그인 시작 ===');
    
    // 기존 토큰 제거
    localStorage.removeItem('access_token');
    addLog('기존 토큰 제거됨');
    
    try {
      // 교수 계정으로 새로 로그인
      const formData = new URLSearchParams();
      formData.append("username", "professor@syu.ac.kr");
      formData.append("password", "1234");

      const response = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
        credentials: "include",
      });

      const data = await response.json();
      addLog(`로그인 응답: ${response.status}`);

      if (!response.ok) {
        addLog(`❌ 로그인 실패: ${data.detail || "알 수 없는 오류"}`);
        return;
      }

      // 새 토큰 저장
      if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        addLog('✅ 새 토큰 저장됨');
        
        // 새 토큰 페이로드 확인
        try {
          const parts = data.access_token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            addLog(`새 토큰 페이로드: ${JSON.stringify(payload)}`);
          }
        } catch (err) {
          addLog(`새 토큰 파싱 실패: ${err}`);
        }
        
        addLog('페이지를 새로고침하여 인증 상태를 업데이트합니다...');
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error) {
      addLog(`❌ 재로그인 오류: ${error}`);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Title level={2}>WebSocket 연결 디버그</Title>
      
      <Space direction="vertical" size="large" className="w-full">
        <Card title="현재 상태">
          <Space direction="vertical">
            <Text><strong>사용자:</strong> {user?.username || '로그인 필요'}</Text>
            <Text><strong>역할:</strong> {user?.role || '없음'}</Text>
            <Text><strong>로그인:</strong> {isLoggedIn ? '✅ 로그인됨' : '❌ 로그아웃됨'}</Text>
            <Text><strong>WebSocket:</strong> 
              <span className={
                wsStatus === 'connected' ? 'text-green-500' : 
                wsStatus === 'connecting' ? 'text-yellow-500' : 
                'text-red-500'
              }>
                {wsStatus === 'connected' ? '✅ 연결됨' : 
                 wsStatus === 'connecting' ? '🔄 연결 중' :
                 wsStatus === 'timeout' ? '⏰ 타임아웃' :
                 wsStatus === 'error' ? '❌ 에러' : '⭕ 연결 안됨'}
              </span>
            </Text>
          </Space>
        </Card>

        <Card title="테스트 액션">
          <Space wrap>
            <Button 
              type="primary" 
              onClick={() => testWebSocketConnection(1)}
              disabled={!isLoggedIn}
            >
              강의실 1번 WebSocket 연결 테스트
            </Button>
            <Button 
              onClick={disconnect}
              disabled={wsStatus !== 'connected'}
            >
              연결 종료
            </Button>
            <Button onClick={checkLocalStorage}>
              로컬스토리지 확인
            </Button>
            <Button onClick={forceRelogin} type="default">
              강제 재로그인 (교수)
            </Button>
            <Button onClick={clearLogs}>
              로그 지우기
            </Button>
          </Space>
        </Card>

        {!isLoggedIn && (
          <Alert
            message="로그인이 필요합니다"
            description="WebSocket 연결 테스트를 위해 먼저 로그인해주세요."
            type="warning"
            showIcon
          />
        )}

        <Card title="디버그 로그" style={{ maxHeight: '400px', overflow: 'auto' }}>
          <List
            dataSource={logs}
            renderItem={(log, index) => (
              <List.Item key={index}>
                <Text code style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                  {log}
                </Text>
              </List.Item>
            )}
            locale={{ emptyText: '로그가 없습니다. 테스트를 시작해보세요.' }}
          />
        </Card>

        <Card title="사용 방법">
          <Paragraph>
            1. 먼저 로그인을 완료하세요<br/>
            2. "강의실 1번 WebSocket 연결 테스트" 버튼을 클릭하세요<br/>
            3. 로그를 확인하여 연결 실패 원인을 파악하세요<br/>
            4. 브라우저 개발자 도구 콘솔도 함께 확인하세요
          </Paragraph>
        </Card>
      </Space>
    </div>
  );
} 