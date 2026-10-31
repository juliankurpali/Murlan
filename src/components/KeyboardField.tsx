import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
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
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(autoFocus);
  const frame = useKeyboardFrame();
  const shown = masked(value, secureTextEntry);
  const mirror = shown.length > 0 ? shown : (placeholder ?? '');
  const keyboardUp =
    frame.inset > 20 || (frame.height > 0 && frame.height < 320) || (focused && frame.height > 0 && frame.height < frame.width);
  const showBar = Platform.OS === 'web' && focused && keyboardUp;

  return (
    <>
      <TextInput
        {...inputProps}
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        autoFocus={autoFocus}
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
        style={style}
      />
      {showBar
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
                <Pressable
                  style={styles.barCopy}
                  onPress={() => inputRef.current?.focus()}
                >
                  {label ? <Text style={styles.barLabel}>{label}</Text> : null}
                  <Text numberOfLines={2} style={[styles.barMirror, shown.length === 0 && styles.barPlaceholder]}>
                    {mirror}
                  </Text>
                </Pressable>
                {accessory}
                {doneLabel ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      Keyboard.dismiss();
                      inputRef.current?.blur();
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
  lift: {
    zIndex: 400,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    marginBottom: 2,
  },
  barMirror: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  barPlaceholder: {
    color: colors.muted,
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
