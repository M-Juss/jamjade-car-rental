import {
  BookOpenCheck,
  ChevronRight,
  FileBadge,
  ReceiptText,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, Text, View, type PressableProps } from 'react-native';

import { cx, profileColors } from '@/components/profile/ProfileCards';
import {
  getDocumentStatusLabel,
  type CustomerDocumentDefinition,
} from '@/lib/customer/document-verification';
import type {
  CustomerDocumentId,
  DocumentVerificationStatus,
} from '@/types/customer';

const DOCUMENT_ICONS: Record<CustomerDocumentId, LucideIcon> = {
  'driver-license': FileBadge,
  passport: BookOpenCheck,
  'proof-of-address': ReceiptText,
};

const STATUS_STYLES: Record<
  DocumentVerificationStatus,
  { background: string; border: string; text: string }
> = {
  'not-submitted': {
    background: 'bg-[#F1F5F9]',
    border: 'border-[#CBD5E1]',
    text: 'text-[#475569]',
  },
  'pending-review': {
    background: 'bg-[#FFF7ED]',
    border: 'border-[#FED7AA]',
    text: 'text-[#C2410C]',
  },
  rejected: {
    background: 'bg-[#FEF2F2]',
    border: 'border-[#FECACA]',
    text: 'text-[#DC2626]',
  },
  verified: {
    background: 'bg-[#ECFDF5]',
    border: 'border-[#BBF7D0]',
    text: 'text-[#047857]',
  },
};

export function DocumentReviewBadge({
  status,
}: {
  status: DocumentVerificationStatus;
}) {
  const style = STATUS_STYLES[status];

  return (
    <View className={cx('rounded-full border px-2.5 py-1.5', style.background, style.border)}>
      <Text className={cx('text-[9px] font-black uppercase tracking-[0.3px]', style.text)}>
        {getDocumentStatusLabel(status)}
      </Text>
    </View>
  );
}

export function DocumentRequirementRow({
  compact = false,
  definition,
  hasDraft = false,
  isLast = false,
  onPress,
  status,
}: {
  definition: CustomerDocumentDefinition;
  status: DocumentVerificationStatus;
  onPress?: PressableProps['onPress'];
  compact?: boolean;
  hasDraft?: boolean;
  isLast?: boolean;
}) {
  const Icon = DOCUMENT_ICONS[definition.id];
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      className={cx(
        'flex-row items-center gap-3 py-3.5',
        !isLast && 'border-b border-[#EEF2FF]',
      )}>
      <View className="h-11 w-11 items-center justify-center rounded-full bg-[#F3F7FF]">
        <Icon size={20} color={profileColors.brand} strokeWidth={2.35} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="min-w-0 flex-shrink text-[14px] font-black leading-5 text-[#17315F]">
          {definition.name}
        </Text>
        {!compact ? (
          <Text className="mt-1 text-[11px] font-semibold leading-4 text-[#6C7A96]">
            {definition.shortDescription}
          </Text>
        ) : hasDraft && status === 'not-submitted' ? (
          <Text className="mt-1 text-[10px] font-bold text-[#346EF6]">Draft saved</Text>
        ) : null}
      </View>
      <View className="items-end gap-2">
        <DocumentReviewBadge status={status} />
        {onPress && !compact ? (
          <ChevronRight size={17} color="#A8B2C3" strokeWidth={2.45} />
        ) : null}
      </View>
    </Wrapper>
  );
}
