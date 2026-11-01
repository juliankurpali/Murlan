import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Language } from '../application/types';
import { ChatMessage, sanitizeChat } from '../online/chat';
import { t } from '../i18n';
import { colors, fonts, radius } from '../theme';
import { KeyboardField } from './KeyboardField';

type Props = {
  language: Language;
  messages: ChatMessage[];
  localSeat: number;
  onSend: (text: string) => void;
  onClose?: () => void;
  compact?: boolean;
  resumeMessageId?: string | null;
};

export function ChatPanel({
  language,
  messages,
  localSeat,
  onSend,
  onClose,
  compact = false,
  resumeMessageId = null,
}: Props) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<ScrollViewInstance>(null);
  const placed = useRef(false);
  const follow = useRef(false);
  const lastId = messages[messages.length - 1]?.id ?? null;

  const jumpTo = (id: string | null, y?: number) => {
    if (!id || placed.current) {
      return;
    }
    placed.current = true;
    if (id === lastId || y === undefined) {
      listRef.current?.scrollToEnd({ animated: false });
      return;
    }
    listRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: false });
  };

  const onLineLayout = (id: string, event: LayoutChangeEvent) => {
    if (id !== resumeMessageId) {
      return;
    }
    jumpTo(id, event.nativeEvent.layout.y);
  };

  useEffect(() => {
    if (follow.current) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  const submit = () => {
    const text = sanitizeChat(draft);
    if (!text) {
      return;
    }
    onSend(text);
    setDraft('');
    follow.current = true;
    onClose?.();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.wrap, compact && styles.compact]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t(language, 'chat')}</Text>
        {onClose ? (
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>{t(language, 'back')}</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => {
          if (!placed.current && (!resumeMessageId || resumeMessageId === lastId)) {
            jumpTo(lastId);
          }
        }}
      >
        {messages.length === 0 ? (
          <Text style={styles.empty}>{t(language, 'chatEmpty')}</Text>
        ) : (
          messages.map((line) => {
            const mine = line.seat === localSeat;
            return (
              <View
                key={line.id}
                onLayout={(event) => onLineLayout(line.id, event)}
                style={[styles.bubble, mine && styles.bubbleMine]}
              >
                <Text style={styles.sender} numberOfLines={1}>
                  {mine ? t(language, 'you') : line.name}
                </Text>
                <Text style={[styles.text, mine && styles.textMine]}>{line.text}</Text>
              </View>
            );
          })
        )}
      </ScrollView>
      <View style={styles.composer}>
        <KeyboardField
          value={draft}
          onChangeText={setDraft}
          placeholder={t(language, 'chatPlaceholder')}
          placeholderTextColor={colors.muted}
          maxLength={140}
          returnKeyType="send"
          onSubmitEditing={submit}
          label={t(language, 'chat')}
          doneLabel={t(language, 'sendChat')}
          onDone={submit}
          style={styles.input}
        />
        <Pressable accessibilityRole="button" onPress={submit} style={styles.send}>
          <Text style={styles.sendLabel}>{t(language, 'sendChat')}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 0,
    backgroundColor: 'rgba(8, 16, 18, 0.94)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(232, 197, 71, 0.28)',
    overflow: 'hidden',
  },
  compact: {
    maxHeight: 220,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    minHeight: 32,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    color: colors.goldHi,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontFamily: fonts.sans,
  },
  close: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    padding: 8,
    gap: 6,
  },
  empty: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(232, 197, 71, 0.16)',
  },
  sender: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  text: {
    color: colors.cream,
    fontSize: 12,
    lineHeight: 16,
  },
  textMine: {
    color: colors.goldHi,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.feltLight,
    color: colors.cream,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  send: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendLabel: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
