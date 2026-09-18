// src/components/CoachChat.js
//
// Инлайн-чат с тренером (рендерится во вкладке «Чат» раздела «Тренер»).
// Бесплатно — 3 вопроса/день, Pro — без лимита. Модель flash-lite,
// лимит проверяется на клиенте по таблице coach_messages.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';
import {
  fetchCoachMessages,
  addCoachMessage,
  countCoachQuestionsToday,
  clearCoachChat,
  getAnalysisQuota,
  fetchRecentMeals,
  fetchWeightLog,
  getProfile,
  getWater,
  fetchSupplements,
  fetchWorkouts,
  fetchWorkoutSetsIn,
} from '../services/supabaseClient';
import { coachChatReply } from '../services/aiService';
import { buildChatContext } from '../lib/coachChatContext';
import { dayKey } from '../lib/days';
import { toUserMessage } from '../services/errors';
import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';
import { hSelect } from '../lib/haptics';

const FREE_LIMIT = 3;
const SUGGESTIONS = ['q1', 'q2', 'q3'];

export default function CoachChat({ navigation, bottomInset = 16 }) {
  const { t } = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const scrollRef = useRef(null);
  const ctxRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [askedToday, setAskedToday] = useState(0);

  const remaining = Math.max(0, FREE_LIMIT - askedToday);
  const blocked = !isPro && remaining <= 0;

  useEffect(() => {
    (async () => {
      try {
        const [msgs, asked, quota] = await Promise.all([
          fetchCoachMessages(80).catch(() => []),
          countCoachQuestionsToday().catch(() => 0),
          getAnalysisQuota().catch(() => null),
        ]);
        setMessages(msgs);
        setAskedToday(asked);
        setIsPro(!!quota?.is_pro);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadContext = useCallback(async () => {
    if (ctxRef.current) return ctxRef.current;
    const tk = dayKey(new Date());
    const [meals, weightLog, profile, waterToday, supplements, workouts] =
      await Promise.all([
        fetchRecentMeals(14).catch(() => []),
        fetchWeightLog(35).catch(() => []),
        getProfile().catch(() => ({})),
        getWater(tk).catch(() => 0),
        fetchSupplements().catch(() => []),
        fetchWorkouts(30).catch(() => []),
      ]);
    const sets = await fetchWorkoutSetsIn(workouts.map((w) => w.id)).catch(() => []);
    ctxRef.current = buildChatContext({
      meals,
      weightLog,
      profile,
      waterToday,
      waterGoal: 8,
      supplements,
      workouts,
      sets,
    });
    return ctxRef.current;
  }, []);

  const scrollDown = () =>
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

  const onClear = () => {
    Alert.alert(t('coachchat.clearConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('coachchat.clear'),
        style: 'destructive',
        onPress: () => {
          setMessages([]);
          clearCoachChat().catch((e) => console.warn('clearCoachChat', e?.message));
        },
      },
    ]);
  };

  const send = async (textArg) => {
    const text = (textArg ?? input).trim();
    if (!text || sending || blocked) return;
    hSelect();
    setInput('');
    const userMsg = { id: `u${Date.now()}`, role: 'user', content: text };
    setMessages((m) => [...m, userMsg]);
    setSending(true);
    scrollDown();
    try {
      addCoachMessage('user', text).catch((e) =>
        console.warn('addCoachMessage', e?.message)
      );
      setAskedToday((n) => n + 1);
      const ctx = await loadContext();
      const history = [...messages, userMsg].map(({ role, content }) => ({
        role,
        content,
      }));
      const reply = await coachChatReply(history, JSON.stringify(ctx));
      setMessages((m) => [...m, { id: `a${Date.now()}`, role: 'assistant', content: reply }]);
      addCoachMessage('assistant', reply).catch(() => {});
      scrollDown();
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: `e${Date.now()}`,
          role: 'assistant',
          content: `⚠️ ${toUserMessage(e)}`,
          error: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {messages.length > 0 ? (
        <View style={styles.topBar}>
          <Pressable onPress={onClear} hitSlop={8} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={15} color={c.textMuted} />
            <Text style={styles.clearText}>{t('coachchat.clear')}</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: false })
        }
      >
        {messages.length === 0 ? (
          <View style={styles.welcome}>
            <View style={[styles.bubble, styles.coachBubble]}>
              <Text style={styles.bubbleText}>{t('coachchat.welcome')}</Text>
            </View>
            <View style={styles.suggWrap}>
              {SUGGESTIONS.map((k) => (
                <Pressable
                  key={k}
                  style={styles.sugg}
                  onPress={() => send(t(`coachchat.${k}`))}
                >
                  <Text style={styles.suggText}>{t(`coachchat.${k}`)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.bubble,
                m.role === 'user' ? styles.userBubble : styles.coachBubble,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  m.role === 'user' && styles.userText,
                  m.error && { color: c.danger },
                ]}
              >
                {m.content}
              </Text>
            </View>
          ))
        )}
        {sending ? (
          <View style={[styles.bubble, styles.coachBubble, styles.typing]}>
            <ActivityIndicator color={c.textMuted} size="small" />
            <Text style={styles.typingText}>{t('coachchat.typing')}</Text>
          </View>
        ) : null}
      </ScrollView>

      {blocked ? (
        <View style={[styles.limitBar, { paddingBottom: bottomInset }]}>
          <Text style={styles.limitText}>{t('coachchat.limitReached')}</Text>
          {navigation ? (
            <Pressable
              style={styles.proBtn}
              onPress={() => navigation.navigate('Paywall')}
            >
              <Text style={styles.proBtnText}>{t('coachchat.getPro')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={[styles.inputWrap, { paddingBottom: bottomInset }]}>
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={t('coachchat.placeholder')}
              placeholderTextColor={c.textFaint}
              multiline
              maxLength={400}
              editable={!sending}
            />
            <Pressable
              style={[styles.sendBtn, (!input.trim() || sending) && styles.sendOff]}
              onPress={() => send()}
              disabled={!input.trim() || sending}
            >
              <Ionicons name="arrow-up" size={18} color={c.onPrimary} />
            </Pressable>
          </View>
          {!isPro ? (
            <Text style={styles.quota}>
              {t('coachchat.remaining', { n: remaining })}
            </Text>
          ) : null}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },

    topBar: {
      alignItems: 'flex-end',
      paddingHorizontal: 14,
      paddingTop: 6,
    },
    clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
    clearText: { fontSize: 12, color: c.textMuted, fontWeight: '600' },

    list: { padding: 14, paddingBottom: 16, gap: 8 },
    welcome: { gap: 14 },
    bubble: {
      maxWidth: '86%',
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 13,
    },
    coachBubble: {
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      alignSelf: 'flex-start',
      borderBottomLeftRadius: 4,
    },
    userBubble: {
      backgroundColor: c.primary,
      alignSelf: 'flex-end',
      borderBottomRightRadius: 4,
    },
    bubbleText: { fontSize: 14.5, color: c.text, lineHeight: 20 },
    userText: { color: c.onPrimary },

    suggWrap: { gap: 8 },
    sugg: {
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 999,
      paddingVertical: 9,
      paddingHorizontal: 14,
      alignSelf: 'flex-start',
    },
    suggText: { fontSize: 13, fontWeight: '600', color: c.primary },

    typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    typingText: { fontSize: 13, color: c.textMuted },

    inputWrap: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
      backgroundColor: c.bg,
      paddingTop: 8,
    },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: 12,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      minHeight: 40,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: c.text,
      backgroundColor: c.inputBg,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendOff: { opacity: 0.4 },
    quota: {
      fontSize: 11,
      color: c.textFaint,
      textAlign: 'center',
      paddingTop: 6,
    },

    limitBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: 14,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
    },
    limitText: { flex: 1, fontSize: 13, color: c.textMuted },
    proBtn: {
      backgroundColor: c.primary,
      borderRadius: 999,
      paddingVertical: 9,
      paddingHorizontal: 16,
    },
    proBtnText: { color: c.onPrimary, fontWeight: '700', fontSize: 13 },
  });
