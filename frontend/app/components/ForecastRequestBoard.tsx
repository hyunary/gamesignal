'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface ForecastRequest {
  id: number;
  game_title: string;
  release_date: string | null;
  reason: string | null;
  nickname: string | null;
  created_at: string;
}

export default function ForecastRequestBoard() {
  const [requests, setRequests] = useState<ForecastRequest[]>([]);
  const [form, setForm] = useState({ game_title: '', release_date: '', reason: '', nickname: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from('forecast_requests')
      .select('id, game_title, release_date, reason, nickname, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setRequests(data);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleSubmit = async () => {
    if (!form.game_title.trim()) {
      setErrorMsg('게임명을 입력해주세요.');
      return;
    }
    setStatus('submitting');
    setErrorMsg('');

    const { error } = await supabase.from('forecast_requests').insert({
      game_title: form.game_title.trim(),
      release_date: form.release_date.trim() || null,
      reason: form.reason.trim() || null,
      nickname: form.nickname.trim() || null,
    });

    if (error) {
      setStatus('error');
      setErrorMsg('제출에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } else {
      setStatus('success');
      setForm({ game_title: '', release_date: '', reason: '', nickname: '' });
      fetchRequests();
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg)', border: '1px solid var(--line)',
    borderRadius: 5, padding: '8px 10px',
    fontFamily: 'var(--t-mono)', fontSize: 12, color: 'var(--ink)',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)',
    letterSpacing: '.08em', display: 'block', marginBottom: 6,
  };

  return (
    <div style={{ marginTop: 48, borderTop: '1px solid var(--line)', paddingTop: 32 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
          📬 판매량 예측 요청
        </span>
        <span style={{
          fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)',
          background: 'var(--bg-sunken)', padding: '2px 8px', borderRadius: 999,
        }}>
          {requests.length}건
        </span>
      </div>

      <div style={{
        background: 'var(--bg-elev)', border: '1px solid var(--line)',
        borderRadius: 8, padding: '20px', marginBottom: 20,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>
              게임명 <span style={{ color: 'var(--neg)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="예: GTA6, 붉은사막, 이환"
              value={form.game_title}
              onChange={e => setForm(f => ({ ...f, game_title: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              maxLength={100}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>출시 예정일</label>
            <input
              type="text"
              placeholder="예: 2026-11-07"
              value={form.release_date}
              onChange={e => setForm(f => ({ ...f, release_date: e.target.value }))}
              maxLength={20}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>요청 이유 (선택)</label>
            <input
              type="text"
              placeholder="예: 올해 최대 기대작, 한국 시장 전망이 궁금해요"
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              maxLength={200}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>닉네임 (선택)</label>
            <input
              type="text"
              placeholder="익명"
              value={form.nickname}
              onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))}
              maxLength={30}
              style={inputStyle}
            />
          </div>
        </div>

        {errorMsg && (
          <p style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--neg)', marginBottom: 10 }}>
            {errorMsg}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSubmit}
            disabled={status === 'submitting'}
            style={{
              background: status === 'success' ? 'var(--pos)' : 'var(--accent)',
              color: '#fff', border: 'none', borderRadius: 5,
              padding: '8px 20px', fontFamily: 'var(--t-mono)',
              fontSize: 12, fontWeight: 600,
              cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
              opacity: status === 'submitting' ? 0.6 : 1,
              transition: 'background .2s',
            }}
          >
            {status === 'submitting' ? '제출 중...' : status === 'success' ? '✓ 제출 완료!' : '요청하기'}
          </button>
        </div>
      </div>

      {requests.length === 0 ? (
        <div style={{
          padding: '24px', textAlign: 'center',
          background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 8,
        }}>
          <p style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-4)' }}>
            아직 요청이 없습니다. 첫 번째 예측을 요청해보세요!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {requests.map((req, i) => (
            <div key={req.id} style={{
              background: 'var(--bg-elev)', border: '1px solid var(--line)',
              borderRadius: 6, padding: '12px 14px',
              display: 'grid', gridTemplateColumns: '28px 1fr auto',
              alignItems: 'center', gap: 12,
            }}>
              <span style={{
                fontFamily: 'var(--t-mono)', fontSize: 10,
                color: 'var(--ink-4)', textAlign: 'center',
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {req.game_title}
                  </span>
                  {req.release_date && (
                    <span style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-4)' }}>
                      {req.release_date}
                    </span>
                  )}
                </div>
                {req.reason && (
                  <p style={{
                    fontSize: 12, color: 'var(--ink-3)', marginTop: 3,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    &ldquo;{req.reason}&rdquo;
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                  {req.nickname || '익명'}
                </div>
                <div style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-4)', marginTop: 2 }}>
                  {formatDate(req.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
