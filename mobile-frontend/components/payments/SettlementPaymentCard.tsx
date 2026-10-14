import { PhilippinePeso, ShieldAlert } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { themeColors } from '@/constants/theme';
import { formatPaymentAmount, type SettlementSummary } from '@/lib/payments/settlement-summary';

export function SettlementPaymentCard({ summary, isProcessing, message, onPay }: {
  summary: SettlementSummary;
  isProcessing: boolean;
  message?: string | null;
  onPay: () => void;
}) {
  return (
    <View className="mt-5 rounded-card border border-border bg-surface p-card">
      <View className="flex-row items-center gap-3">
        <View className="h-14 w-14 shrink-0 items-center justify-center rounded-field bg-muted">
          <PhilippinePeso size={29} color={themeColors.primary} strokeWidth={2.3} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-sans text-[32px] font-bold leading-[38px] text-foreground" adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1}>
            {formatPaymentAmount(summary.amount)}
          </Text>
          <Text className="font-sans mt-0.5 text-[13px] font-medium text-secondary-foreground">
            {summary.amountLabel}
          </Text>
        </View>
      </View>

      <Text className="font-sans mt-4 text-body leading-5 text-secondary-foreground">
        {summary.description}
      </Text>

      {summary.showBreakdown ? (
        <View className="mt-4 rounded-field bg-background px-3">
          {summary.rentalBalance > 0 ? (
            <View className="flex-row items-start justify-between gap-3 border-b border-border py-3">
              <Text className="font-sans min-w-0 flex-1 text-[13px] font-medium text-foreground">Remaining rental balance</Text>
              <Text className="font-sans text-[13px] font-semibold text-foreground">{formatPaymentAmount(summary.rentalBalance)}</Text>
            </View>
          ) : null}
          {summary.charges.map((charge, index) => (
            <View key={charge.id} className={`flex-row items-start justify-between gap-3 py-3 ${index < summary.charges.length - 1 ? 'border-b border-border' : ''}`}>
              <View className="min-w-0 flex-1">
                <Text className="font-sans text-[13px] font-semibold text-foreground">{charge.typeLabel}</Text>
                <Text className="font-sans mt-1 text-caption leading-5 text-secondary-foreground">{charge.description}</Text>
                {charge.outstandingAmount < charge.amount ? (
                  <Text className="font-sans mt-1 text-caption text-secondary-foreground">Unpaid portion of {formatPaymentAmount(charge.amount)}</Text>
                ) : null}
              </View>
              <Text className="font-sans text-[13px] font-semibold text-foreground">{formatPaymentAmount(charge.outstandingAmount)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {summary.deadline ? (
        <View className="mt-4 flex-row items-start gap-2.5 rounded-field border border-warning-border bg-warning-surface p-3">
          <ShieldAlert size={19} color={themeColors.warning} strokeWidth={2.3} />
          <Text className="font-sans min-w-0 flex-1 text-caption font-medium leading-5 text-warning">
            Due {new Date(summary.deadline).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}. If unpaid by the deadline, the booking is cancelled and the down payment is non-refundable.
          </Text>
        </View>
      ) : null}

      {message ? <Text accessibilityRole="alert" className="font-sans mt-4 text-caption leading-5 text-foreground">{message}</Text> : null}

      {summary.amount > 0 ? (
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: isProcessing, busy: isProcessing }} disabled={isProcessing} onPress={onPay} className={`mt-5 min-h-control items-center justify-center rounded-full bg-primary px-4 ${isProcessing ? 'opacity-60' : 'active:opacity-90'}`}>
          {isProcessing ? <ActivityIndicator color={themeColors.surface} /> : (
            <Text className="font-sans text-button font-medium text-surface">{summary.buttonLabel}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
