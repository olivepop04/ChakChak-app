/**
 * 액션 만들기 / 이어서 작성하기.
 *
 *   /action/create          새로 만들기
 *   /action/create?id=xxx   저장해 둔 DRAFT 이어서 작성 (Activity 에서 들어옴)
 *
 * 로그인 확인은 middleware 가 이미 했습니다.
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { ActionForm, type ActionFormInitial } from '@/components/action/ActionForm';
import { CATEGORIES, type Category } from '@/lib/constants';
import type { ActionItemInput } from '@/lib/mutations';

const EMPTY: ActionFormInitial = {
  id: null,
  title: '',
  description: '',
  category: CATEGORIES[0],
  imageUrls: [],
  thumbnailIndex: 0,
  address: '',
  placeName: '',
  notice: '',
  recruitEndAt: null,
  activityStartAt: null,
  activityEndAt: null,
  items: [],
};

export default async function CreateActionPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/action/create');

  let initial = EMPTY;

  if (id) {
    const { data: action } = await supabase
      .from('actions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    // 남의 액션이거나 이미 공개된 액션은 이 화면에서 다루지 않습니다
    if (!action || action.owner_id !== user.id) redirect('/activity?tab=created');
    if (action.status !== 'DRAFT') redirect(`/action/${id}`);

    const { data: items } = await supabase
      .from('action_items')
      .select('*')
      .eq('action_id', id)
      .order('sort_order', { ascending: true });

    initial = {
      id: action.id,
      title: action.title,
      description: action.description ?? '',
      category: action.category as Category,
      imageUrls: action.image_urls ?? [],
      thumbnailIndex: action.thumbnail_index ?? 0,
      address: action.address ?? '',
      placeName: action.place_name ?? '',
      notice: action.notice ?? '',
      recruitEndAt: action.recruit_end_at,
      activityStartAt: action.activity_start_at,
      activityEndAt: action.activity_end_at,
      items: (items ?? []).map(
        (i): ActionItemInput => ({
          type: i.type as 'PERSON' | 'GOODS',
          name: i.name,
          targetType: i.target_type as 'RANGE' | 'MINIMUM',
          minRequired: i.min_required,
          maxAllowed: i.max_allowed,
          unit: i.unit,
          genderRequirement: i.gender_requirement as 'MALE' | 'FEMALE' | 'ANY',
          conditionName: i.condition_name,
          conditionDesc: i.condition_desc,
        }),
      ),
    };
  }

  return (
    <main>
      <Header title={id ? '액션 수정' : '액션 만들기'} back backHref="/" sticky />
      <ActionForm initial={initial} />
    </main>
  );
}
