import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getSignupAvatarError } from '../lib/utils/signup-avatar.ts';

const root = new URL('../', import.meta.url);

test('가입 아바타는 8종 목록에서 하나를 반드시 골라야 한다', () => {
  assert.equal(getSignupAvatarError('avatar_01'), null);
  assert.equal(getSignupAvatarError(null), '프로필 아바타를 선택해주세요.');
  assert.equal(getSignupAvatarError('avatar_09'), '프로필 아바타를 선택해주세요.');
});

test('가입 2단계가 아바타 선택값을 복원하고 회원가입 데이터에 함께 보낸다', () => {
  const source = readFileSync(new URL('app/(auth)/signup/page.tsx', root), 'utf8');

  assert.match(source, /import \{ AvatarPicker \} from '@\/components\/ui\/AvatarPicker';/);
  assert.match(source, /const \[avatar, setAvatar\] = useState<string \| null>\(null\);/);
  assert.match(source, /isAvatarKey\(parsed\.avatar\)/);
  const draftStart = source.indexOf('const draft = {');
  const draftEnd = source.indexOf('};', draftStart);
  assert.ok(draftStart >= 0 && draftEnd > draftStart);
  assert.match(source.slice(draftStart, draftEnd), /\bavatar,/);
  assert.match(source, /getSignupAvatarError\(avatar\)/);
  assert.match(source, /<AvatarPicker value=\{avatar\} onChange=\{setAvatar\} \/>/);
  assert.match(source, /data: \{ name: name\.trim\(\), nickname: nickname\.trim\(\), gender, avatar \}/);

  const nicknameIndex = source.indexOf('<FieldLabel>닉네임</FieldLabel>');
  const avatarPickerIndex = source.indexOf('<AvatarPicker value={avatar} onChange={setAvatar} />');
  const genderIndex = source.indexOf('<FieldLabel>성별</FieldLabel>');
  assert.ok(nicknameIndex < avatarPickerIndex && avatarPickerIndex < genderIndex);
});
