import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Pressable, View, type Text as NativeText } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { AlertButton } from 'react-native';
import { dismissDialog, getDialogSnapshot, newDialogHostId, registerDialogHost, subscribeDialogs, type Dialog } from './alert';
import { press } from './pressable';
import { colors, layout, radii, shadows, spacing, typeStyles } from './tokens';
import { Text } from './Text';

function useHostedDialog(active: boolean): Dialog | undefined {
  const id = useRef(0);
  if (id.current === 0) id.current = newDialogHostId();
  useEffect(() => (active ? registerDialogHost(id.current) : undefined), [active]);
  const { dialogs, hosts } = useSyncExternalStore(subscribeDialogs, getDialogSnapshot);
  return hosts[hosts.length - 1] === id.current ? dialogs[0] : undefined;
}

// Mounted once, after the root stack.
export function DialogHost() {
  const dialog = useHostedDialog(true);
  return dialog ? <DialogView key={dialog.id} dialog={dialog} /> : null;
}

// Mounted as the last child of a modal sheet screen, which native-presents
// above the root host.
export function ScreenDialogHost() {
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const dialog = useHostedDialog(focused);
  return dialog ? <DialogView key={dialog.id} dialog={dialog} /> : null;
}

function DialogView({ dialog }: { dialog: Dialog }) {
  const { t } = useTranslation();
  const buttons: AlertButton[] = dialog.buttons?.length ? dialog.buttons : [{ text: t('dialog.ok') }];
  // Escape picks the cancel button, or the only button, as a native alert does.
  const escape = buttons.find((button) => button.style === 'cancel') ?? (buttons.length === 1 ? buttons[0] : undefined);
  const title = useRef<NativeText>(null);

  // Move VoiceOver focus to the title, as a native alert does. A dialog that
  // moves from a closing sheet to the root host is focused again, not read twice.
  useEffect(() => {
    if (title.current) AccessibilityInfo.sendAccessibilityEvent(title.current, 'focus');
  }, []);

  const choose = (button: AlertButton) => {
    dismissDialog(dialog.id);
    button.onPress?.();
  };

  return (
    <View
      accessibilityViewIsModal
      onAccessibilityEscape={escape ? () => choose(escape) : undefined}
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.scrim, justifyContent: 'center', alignItems: 'center', padding: layout.screenInset }}
    >
      <View style={{ width: '100%', maxWidth: 340, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, ...shadows.card }}>
        <Text ref={title} accessibilityRole="header" style={{ ...typeStyles.sectionTitle, color: colors.ink }}>{dialog.title}</Text>
        {dialog.message ? <Text style={{ ...typeStyles.body, color: colors.inkSecondary, marginTop: spacing.xs }}>{dialog.message}</Text> : null}
        <View style={{ flexDirection: buttons.length === 2 ? 'row' : 'column', gap: spacing.xs, marginTop: spacing.lg }}>
          {buttons.map((button, index) => {
            const destructive = button.style === 'destructive';
            return (
              <Pressable
                key={`${index}-${button.text}`}
                accessibilityRole="button"
                onPress={() => choose(button)}
                style={press({
                  flex: buttons.length === 2 ? 1 : undefined,
                  minHeight: layout.touchTarget,
                  paddingHorizontal: spacing.sm,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: radii.md,
                  backgroundColor: destructive ? colors.redTint : colors.neutralTint,
                })}
              >
                <Text style={{ ...typeStyles.button, fontWeight: button.style === 'cancel' ? '700' : '800', color: destructive ? colors.red : colors.ink, textAlign: 'center' }}>
                  {button.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
