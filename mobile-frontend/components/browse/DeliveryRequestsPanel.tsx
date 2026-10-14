import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  getDeliveryQuotes,
  type DeliveryQuote,
} from '@/services/api/delivery.service';
export function DeliveryRequestsPanel({
  vehicleId,
  onResume,
}: {
  vehicleId: string;
  onResume: (quote: DeliveryQuote) => void;
}) {
  const [quotes, setQuotes] = useState<DeliveryQuote[]>([]);
  const [page, setPage] = useState(1);
  const [last, setLast] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    getDeliveryQuotes(page, vehicleId)
      .then((r) => {
        if (active) {
          setQuotes(r.data);
          setLast(Number(r.meta?.last_page ?? 1));
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, vehicleId, reload]);
  return (
    <View className="mt-4 gap-2 rounded-card border border-border bg-surface p-4">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="font-sans text-body font-semibold text-foreground">
          Your Delivery Requests
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          className="min-h-control justify-center"
          onPress={() => {
            setLoading(true);
            setReload((v) => v + 1);
          }}
        >
          <Text className="font-sans text-caption font-semibold text-primary">
            Refresh
          </Text>
        </Pressable>
      </View>
      {loading ? (
        <Text className="font-sans text-caption text-secondary-foreground">
          Loading saved requests...
        </Text>
      ) : error ? (
        <Text
          accessibilityRole="alert"
          className="font-sans text-caption text-destructive"
        >
          Saved requests could not be loaded. Refresh to retry.
        </Text>
      ) : quotes.length === 0 ? (
        <Text className="font-sans text-caption text-secondary-foreground">
          No saved delivery requests for this vehicle.
        </Text>
      ) : (
        quotes.map((q) => (
          <Pressable
            key={q.id}
            accessibilityRole="button"
            className="min-h-control rounded-field border border-border p-3"
            onPress={() => onResume(q)}
          >
            <Text className="font-sans text-caption font-semibold text-primary">
              Resume ·{' '}
              {q.status === 'awaiting_review'
                ? 'Awaiting staff'
                : q.status === 'ready'
                  ? 'Quote ready'
                  : q.status === 'rejected'
                    ? 'Rejected'
                    : 'Expired'}
            </Text>
            <Text className="font-sans text-caption text-foreground">
              {q.destinationAddress}
            </Text>
          </Pressable>
        ))
      )}
      {last > 1 && (
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            disabled={loading || page === 1}
            className="min-h-control justify-center"
            onPress={() => {
              setLoading(true);
              setPage((v) => v - 1);
            }}
          >
            <Text className="font-sans text-caption text-primary">
              Previous
            </Text>
          </Pressable>
          <Text className="font-sans text-caption text-secondary-foreground">
            {page} / {last}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={loading || page === last}
            className="min-h-control justify-center"
            onPress={() => {
              setLoading(true);
              setPage((v) => v + 1);
            }}
          >
            <Text className="font-sans text-caption text-primary">Next</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
