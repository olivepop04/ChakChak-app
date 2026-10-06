/**
 * 비밀번호 인풋 — 오른쪽 눈 버튼으로 가림/보임을 바꿉니다.
 *
 *   <PasswordInput autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
 *
 * 로그인·가입 1단계가 같이 씁니다 (2026-09-30 Day19 인증군 통일안).
 * 모양은 공용 Input 그대로(44px·12px·15px·hairline) + 오른쪽 44px 누르는 칸.
 * 화면 안에서 type 만 password ↔ text 로 바꿀 뿐, 값·제출 로직은 건드리지 않습니다.
 *
 * 아이콘은 「지금 상태」를 그립니다 — 가려짐 → EyeOff(감은 눈) · 보이는 중 → Eye(뜬 눈).
 * 읽어 주는 이름(aria-label)은 「누르면 할 일」 그대로 — 가려짐 「비밀번호 보기」 · 보이는 중 「비밀번호 숨기기」.
 * 2026-10-05 소정님 훑어보기: 가려진 칸에 뜬 눈이 보여 반대로 느껴진다는 의견으로 아이콘만 바꿈.
 */
'use client';

import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils/cn';

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    const Icon = visible ? Eye : EyeOff;

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('w-full pr-12', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-neutral-500 hover:text-neutral-700"
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    );
  },
);
