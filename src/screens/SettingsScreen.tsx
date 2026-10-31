import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AppSettings, Language, VoiceMode } from '../application/types';
import { KeyboardField } from '../components/KeyboardField';
import { LandscapeFrame, LandscapePane } from '../components/LandscapeFrame';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { UiButton } from '../components/UiButton';
import { normalizeUsername } from '../platform/ids';
import { PublicPlayer } from '../platform/types';
import { t } from '../i18n';
import { saveProfilePhoto } from '../storage/profilePhoto';
import { colors, radius, spacing } from '../theme';

type Props = {
  settings: AppSettings;
  player?: PublicPlayer | null;
  onChange: (settings: Partial<AppSettings>) => void;
  onRename?: (username: string) => void;
  onBack: () => void;
  onTerms?: () => void;
  onPrivacy?: () => void;
};

export function SettingsScreen({
  settings,
  player,
  onChange,
  onRename,
  onBack,
  onTerms,
  onPrivacy,
}: Props) {
  const language = settings.language;
  const [username, setUsername] = useState(player?.username ?? '');

  useEffect(() => {
    if (player?.username) {
      setUsername(player.username);
    }
  }, [player?.username]);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t(language, 'profile'), t(language, 'choosePhoto'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }
    try {
      onChange({ profileUri: await saveProfilePhoto(result.assets[0].uri) });
    } catch {
      Alert.alert(t(language, 'profile'), t(language, 'tryAgain'));
    }
  };

  return (
    <LandscapeFrame
      title={t(language, 'settings')}
      backLabel={t(language, 'back')}
      onBack={onBack}
      action={
        onTerms ? <UiButton label={t(language, 'termsTitle')} variant="ghost" onPress={onTerms} /> : undefined
      }
    >
      <LandscapePane>
        <ScrollView contentContainerStyle={styles.pane} showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>{t(language, 'profile')}</Text>
          <View style={styles.profileRow}>
            {settings.profileUri ? (
              <Image source={{ uri: settings.profileUri }} style={styles.preview} />
            ) : (
              <PlayerAvatar size={56} accent={colors.gold} />
            )}
            <View style={styles.profileActions}>
              <UiButton label={t(language, 'choosePhoto')} variant="secondary" onPress={() => void pickPhoto()} />
              {settings.profileUri ? (
                <UiButton
                  label={t(language, 'removePhoto')}
                  variant="ghost"
                  onPress={() => onChange({ profileUri: null })}
                />
              ) : null}
            </View>
          </View>

          {player ? (
            <>
              <Text style={styles.label}>{t(language, 'username')}</Text>
              <KeyboardField
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={16}
                value={username}
                onChangeText={(value) => setUsername(normalizeUsername(value))}
                label={t(language, 'username')}
                doneLabel={t(language, 'ok')}
                style={styles.field}
              />
              {onRename ? (
                <UiButton label={t(language, 'saveUsername')} variant="secondary" onPress={() => onRename(username)} />
              ) : null}
              <Text style={styles.hint}>{t(language, 'identityHint')}</Text>
            </>
          ) : null}

          <Text style={styles.label}>{t(language, 'language')}</Text>
          <View style={styles.row}>
            {(['en', 'sq'] as Language[]).map((code) => (
              <Pressable
                key={code}
                accessibilityRole="button"
                accessibilityState={{ selected: language === code }}
                onPress={() => onChange({ language: code })}
                style={[styles.choice, language === code && styles.choiceOn]}
              >
                <Text style={[styles.choiceLabel, language === code && styles.choiceLabelOn]}>
                  {t(language, code === 'en' ? 'english' : 'albanian')}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </LandscapePane>
      <LandscapePane>
        <ScrollView contentContainerStyle={styles.pane} showsVerticalScrollIndicator={false}>
          <SwitchRow
            label={t(language, 'sound')}
            value={settings.sound}
            onValueChange={(sound) => onChange({ sound })}
          />
          <SwitchRow
            label={t(language, 'music')}
            value={settings.music}
            onValueChange={(music) => onChange({ music })}
          />
          <SwitchRow
            label={t(language, 'haptics')}
            value={settings.haptics}
            onValueChange={(haptics) => onChange({ haptics })}
          />
          <SwitchRow
            label={t(language, 'showLegalMoves')}
            value={settings.showLegalMoves}
            onValueChange={(showLegalMoves) => onChange({ showLegalMoves })}
          />
          <Text style={styles.label}>{t(language, 'voiceMode')}</Text>
          <Text style={styles.hint} numberOfLines={2}>
            {t(language, 'voiceModeHint')}
          </Text>
          <View style={styles.row}>
            {(['natural', 'clear'] as VoiceMode[]).map((mode) => (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected: settings.voiceMode === mode }}
                onPress={() => onChange({ voiceMode: mode })}
                style={[styles.choice, settings.voiceMode === mode && styles.choiceOn]}
              >
                <Text style={[styles.choiceLabel, settings.voiceMode === mode && styles.choiceLabelOn]}>
                  {t(language, mode === 'natural' ? 'naturalAudio' : 'clearVoice')}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </LandscapePane>
    </LandscapeFrame>
  );
}

function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.feltLight, true: colors.gold }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pane: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
    flexGrow: 1,
    justifyContent: 'center',
  },
  label: {
    color: colors.cream,
    fontWeight: '700',
    fontSize: 15,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  preview: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  profileActions: {
    flex: 1,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  choice: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceOn: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  choiceLabel: {
    color: colors.cream,
    fontWeight: '700',
  },
  choiceLabelOn: {
    color: colors.ink,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: spacing.md,
  },
  switchLabel: {
    color: colors.cream,
    flex: 1,
    fontSize: 15,
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: -4,
  },
  field: {
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLight,
    color: colors.cream,
    paddingHorizontal: 12,
  },
});
