import { Check } from 'lucide-react-native';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ActionButton } from '@/components/bookings';
import { ProfileFormSheet } from '@/components/profile/ProfileFormSheet';
import { themeColors } from '@/constants/theme';
import { useCustomer } from '@/lib/customer/customer-store';
import { useAuth } from '@/providers/AuthProvider';
import { getDocumentPrivacyNotice } from '@/services/api/document.service';

export const DOCUMENT_PRIVACY_VERSION = 'document-privacy-v1';
const noticeSections = [
  {
    title: '1. Collection and purpose',
    body: 'JamJade collects your driver’s license and proof of address, including reverse-side images where applicable, to verify your identity and assess your eligibility for self-drive rentals.',
  },
  {
    title: '2. Authorized access',
    body: 'Authorized JamJade personnel review submitted documents. The hosting provider processes document files as necessary to operate the service.',
  },
  {
    title: '3. Retention and removal',
    body: 'Documents are removed 12 months after your latest completed rental, or after the verification decision if you have not completed a rental. For pending submissions, this period begins on the upload date. Removal is deferred while a self-drive booking is pending, confirmed, ongoing or returned. Backup copies may be retained separately.',
  },
  {
    title: '4. Document storage',
    body: 'Uploaded document files are stored on the public storage service. Anyone with a direct file link may be able to access them.',
  },
  {
    title: '5. Your rights',
    body: 'You may request access to, correction of or deletion of your personal data, subject to applicable requirements. You may also raise privacy concerns with the National Privacy Commission.',
  },
];

let acceptedUser: number | null = null;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function setAccepted(userId: number | null) {
  acceptedUser = userId;
  listeners.forEach((listener) => listener());
}

export function useDocumentPrivacyAgreement() {
  const { user } = useAuth();
  const accepted = useSyncExternalStore(subscribe, () => acceptedUser === user?.id && user != null);
  const toggle = useCallback(() => setAccepted(accepted ? null : user?.id ?? null), [accepted, user?.id]);
  return { accepted, toggle };
}

export function DocumentPrivacyNotice() {
  const { accepted, toggle } = useDocumentPrivacyAgreement();
  const customer = useCustomer();
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [confirmUncheck, setConfirmUncheck] = useState(false);
  const [contact, setContact] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const hasSubmittedDocuments = Object.values(customer.documentStatuses).some((status) => status !== 'not-submitted');

  useEffect(() => {
    let active = true;
    setContact(null);
    setError(false);
    getDocumentPrivacyNotice()
      .then((data) => {
        if (!active) return;
        if (data.version !== DOCUMENT_PRIVACY_VERSION) throw new Error('Notice version changed');
        setContact(data.contact_email);
      })
      .catch(() => {
        if (!active) return;
        setAccepted(null);
        setError(true);
      });

    return () => { active = false; };
  }, [retryKey, user?.id]);

  return (
    <View>
      <View className="min-h-control flex-row items-center gap-1">
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="I agree to the document privacy notice"
          accessibilityState={{ checked: accepted }}
          onPress={() => {
            if (accepted && hasSubmittedDocuments) {
              setConfirmUncheck(true);
              return;
            }
            if (accepted || (contact && user != null)) toggle();
            else setVisible(true);
          }}
          className="min-h-control w-11 items-center justify-center">
          <View className={`h-6 w-6 items-center justify-center rounded-md border ${accepted ? 'border-primary bg-primary' : 'border-border bg-surface'}`}>
            {accepted ? <Check size={16} color={themeColors.surface} /> : null}
          </View>
        </Pressable>
        <Text className="min-w-0 flex-1 font-sans text-body text-foreground">
          I agree to the{' '}
          <Text accessibilityRole="link" onPress={() => setVisible(true)} className="font-semibold text-primary underline">
            document privacy notice
          </Text>.
        </Text>
      </View>
      <ProfileFormSheet visible={visible} onClose={() => setVisible(false)} title="Document Privacy Notice">
        <ScrollView className="shrink" showsVerticalScrollIndicator={false}>
          <View className="gap-4 pb-3">
            {noticeSections.map((section) => (
              <View key={section.title} className="gap-2">
                <Text className="font-sans text-section font-semibold text-foreground">{section.title}</Text>
                <Text className="font-sans text-body text-foreground">{section.body}</Text>
              </View>
            ))}
            <View className="gap-2">
              <Text className="font-sans text-section font-semibold text-foreground">6. Privacy contact</Text>
              <Text accessibilityLiveRegion="polite" className="font-sans text-body text-foreground">
                {contact ?? (error ? 'Privacy contact is unavailable. Please try again.' : 'Loading...')}
              </Text>
              {error ? <ActionButton label="Retry" onPress={() => setRetryKey((current) => current + 1)} /> : null}
            </View>
          </View>
        </ScrollView>
      </ProfileFormSheet>
      <ProfileFormSheet visible={confirmUncheck} onClose={() => setConfirmUncheck(false)} title="Uncheck agreement?">
        <Text className="font-sans text-body text-foreground">
          You cannot submit or resubmit documents until you agree again. Your previous submissions and their saved agreements remain unchanged.
        </Text>
        <View className="mt-section flex-row gap-3">
          <ActionButton className="flex-1" label="Keep agreement" onPress={() => setConfirmUncheck(false)} />
          <ActionButton className="flex-1" label="Uncheck" variant="primary" onPress={() => {
            setConfirmUncheck(false);
            toggle();
          }} />
        </View>
      </ProfileFormSheet>
    </View>
  );
}
