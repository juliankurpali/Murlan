import { useState, type ReactNode } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme';
import { portalToBody, useKeyboardFrame } from './keyboardOverlay';

type Props = Pick<
  TextInputProps,
  | 'value'
  | 'onChangeText'
  | 'placeholder'
  | 'placeholderTextColor'
  | 'maxLength'
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'autoComplete'
  | 'autoFocus'
  | 'secureTextEntry'
  | 'returnKeyType'
  | 'onSubmitEditing'
  | 'editable'
  | 'spellCheck'
  | 'importantForAutofill'
  | 'textContentType'
  | 'keyboardType'
  | 'style'
  | 'onFocus'
  | 'onBlur'
> & {
  accessory?: ReactNode;
  doneLabel?: string;
  label?: string;
};

function masked(value: string, secure: boolean | undefined): string {
  if (!secure || value.length === 0) {
    return value;
  }
  return '•'.repeat(Math.min(value.length, 24));
}

export function KeyboardField({
  value = '',
  onChangeText,
  placeholder,
  placeholderTextColor = colors.muted,
  accessory,
  doneLabel,
  label,
  autoFocus = false,
  secureTextEntry,
  style,
  onFocus,
  onBlur,
  editable = true,
  ...inputProps
}: Props) {
  const [focused, setFocused] = useState(autoFocus);
  const frame = useKeyboardFrame();
  const web = Platform.OS === 'web';
  const shown = masked(value, secureTextEntry);
  const mirror = shown.length > 0 ? shown : (placeholder ?? '');

  const input = (lifted: boolean) => (
    <TextInput
      {...inputProps}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={lifted ? colors.muted : placeholderTextColor}
      autoFocus={lifted || autoFocus}
      secureTextEntry={secureTextEntry}
      editable={editable}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={lifted ? styles.barField : style}
    />
  );

  if (!web) {
    return input(false);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        disabled={!editable}
        onPress={() => {
          if (editable) {
            setFocused(true);
          }
        }}
        style={[styles.anchor, style]}
      >
        <Text
          numberOfLines={1}
          style={[styles.anchorText, style, shown.length === 0 && { color: placeholderTextColor }]}
        >
          {mirror}
        </Text>
      </Pressable>
      {focused
        ? portalToBody(
            <View
              pointerEvents="box-none"
              style={
                [
                  styles.lift,
                  frame.width > 0
                    ? {
                        position: 'fixed' as unknown as 'absolute',
                        left: frame.left,
                        top: frame.top,
                        width: frame.width,
                        height: Math.max(frame.height, 56),
                      }
                    : styles.liftFallback,
                ] as ViewStyle[]
              }
            >
              <View accessibilityRole="alert" style={styles.bar}>
                <View style={styles.barCopy}>
                  {label ? <Text style={styles.barLabel}>{label}</Text> : null}
                  <Text numberOfLines={2} style={styles.barMirror}>
                    {mirror}
                  </Text>
                  {input(true)}
                </View>
                {accessory}
                {doneLabel ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      Keyboard.dismiss();
                      setFocused(false);
                    }}
                    style={styles.done}
                  >
                    <Text style={styles.doneLabel}>{doneLabel}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>,
          )
        : null}
    </>
  );
}

const styles = StyleSheet.create({
  anchor: {
    justifyContent: 'center',
  },
  anchorText: {
    color: colors.cream,
  },
  lift: {
    zIndex: 300,
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  liftFallback: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },
  bar: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cream,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  barCopy: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 120,
  },
  barLabel: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  barMirror: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  barField: {
    minHeight: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.feltLight,
    color: colors.ink,
    paddingHorizontal: 10,
    backgroundColor: colors.card,
    fontSize: 16,
    fontWeight: '700',
  },
  done: {
    minHeight: 36,
    minWidth: 52,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  doneLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
