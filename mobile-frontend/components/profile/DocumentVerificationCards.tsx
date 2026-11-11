import { FileBadge, ReceiptText, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View, type PressableProps } from 'react-native';

import { cx, profileColors } from '@/components/profile/ProfileCards';
import {
  getDocumentStatusLabel,
  type CustomerDocumentDefinition,
} from '@/lib/customer/document-verification';
import type { CustomerDocumentId, DocumentVerificationStatus } from '@/types/customer';

const DOCUMENT_ICONS: Record<CustomerDocumentId, LucideIcon> = {
  'driver-license': FileBadge,
  'proof-of-address': ReceiptText,
};

const STATUS_STYLES: Record<
  DocumentVerificationStatus,
  { background: string; border: string; text: string }
> = {
  'not-submitted': {
    background: 'bg-muted',
    border: 'border-border',
    text: 'text-[#475569]',
  },
  'pending-review': {
    background: 'bg-warning-surface',
    border: 'border-warning-border',
    text: 'text-warning',
  },
  rejected: {
    background: 'bg-destructive-surface',
    border: 'border-destructive-border',
    text: 'text-destructive',
  },
  verified: {
    background: 'bg-success-surface',
    border: 'border-success-border',
    text: 'text-success',
  },
};

export function DocumentReviewBadge({ status }: { status: DocumentVerificationStatus }) {
  const style = STATUS_STYLES[status];

  return (
    <View className={cx('rounded-full border px-2.5 py-1.5', style.background, style.border)}>
      <Text className={cx('font-sans', 'text-[11px] font-semibold', style.text)}>
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
      className={cx('flex-row items-center gap-3 py-3.5', !isLast && 'border-b border-[#EEF2FF]')}>
      <Icon size={18} color={profileColors.brand} strokeWidth={2} />
      <View className="min-w-0 flex-1">
        <Text className="font-sans min-w-0 flex-shrink text-[14px] font-semibold leading-5 text-foreground">
          {definition.name}
        </Text>
        {!compact ? (
          <Text className="font-sans mt-1 text-[11px] font-normal leading-4 text-secondary-foreground">
            {definition.shortDescription}
          </Text>
        ) : hasDraft && status === 'not-submitted' ? (
          <Text className="font-sans mt-1 text-[11px] font-medium text-primary">Draft saved</Text>
        ) : null}
      </View>
      <View className="items-end gap-2">
        <DocumentReviewBadge status={status} />
      </View>
    </Wrapper>
  );
}
