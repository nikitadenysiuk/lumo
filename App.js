import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Manrope_300Light,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';

import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { AuthProvider, useAuth } from './src/services/authContext';
import { LocaleProvider, useT } from './src/i18n/LocaleContext';
import { SettingsProvider, useSettings, useTheme } from './src/settings/SettingsContext';
import { withAlpha } from './src/theme/palettes';
import { SelectedDayProvider } from './src/state/SelectedDayContext';
import {
  getProfile,
  fetchRecentMeals,
  getWater,
  fetchSupplements,
  fetchSupplementLog,
  fetchWorkouts,
} from './src/services/supabaseClient';
import { rescheduleReminders } from './src/services/notifications';
import { dayKey, totalsByDay, currentStreak } from './src/lib/days';
import AuthScreen from './src/screens/AuthScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import WelcomeTourScreen from './src/screens/WelcomeTourScreen';
import HomeScreen from './src/screens/HomeScreen';
import FoodSearchScreen from './src/screens/FoodSearchScreen';
import CameraScreen from './src/screens/CameraScreen';
import ResultScreen from './src/screens/ResultScreen';
import BarcodeResultScreen from './src/screens/BarcodeResultScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import CoachScreen from './src/screens/CoachScreen';
import SupplementEditScreen from './src/screens/SupplementEditScreen';
import SupplementRecoScreen from './src/screens/SupplementRecoScreen';
import WorkoutEditScreen from './src/screens/WorkoutEditScreen';
import PlanWizardScreen from './src/screens/PlanWizardScreen';
import PlanDayEditScreen from './src/screens/PlanDayEditScreen';
import ExerciseProgressScreen from './src/screens/ExerciseProgressScreen';
import DiarySearchScreen from './src/screens/DiarySearchScreen';
import { Text } from './src/ui/Text';
import MealDetailScreen from './src/screens/MealDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import WeightScreen from './src/screens/WeightScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import TrendsScreen from './src/screens/TrendsScreen';
import CookModeScreen from './src/screens/CookModeScreen';
import AchievementsScreen from './src/screens/AchievementsScreen';
import WeeklyReportScreen from './src/screens/WeeklyReportScreen';
import QuickAddScreen from './src/screens/QuickAddScreen';
import CustomProductScreen from './src/screens/CustomProductScreen';
import RecipeScreen from './src/screens/RecipeScreen';
import RecipeDetailScreen from './src/screens/RecipeDetailScreen';
import PaywallScreen from './src/screens/PaywallScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

SplashScreen.preventAutoHideAsync().catch(() => {});

function TabIcon({ name, color, focused, size = 24 }) {
  return (
    <Ionicons
      name={focused ? name : `${name}-outline`}
      size={size}
      color={color}
    />
  );
}

// Акцентная кнопка таб-бара — «Фото» и «Тренер» (две ключевые фичи).
// Мягкий квадрат с тинтом акцента + подпись высокого контраста (читается в обеих темах).
function FeatureButton({ label, icon, active, onPress, c, styles }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.item}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <View style={styles.iconSlot}>
        <View
          style={[
            styles.featureSquare,
            {
              backgroundColor: active
                ? c.primary
                : withAlpha(c.primary, c.dark ? 0.22 : 0.13),
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={22}
            color={active ? c.onPrimary : c.primary}
          />
        </View>
      </View>
      <Text
        style={[
          styles.featureLabel,
          { color: active ? c.primary : c.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Кастомный однорядный таб-бар: 4 обычные вкладки + 2 акцентные кнопки
// «Фото» / «Тренер» по центру (равный визуальный вес двух главных фич).
function AppTabBar({ state, descriptors, navigation }) {
  const c = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeTabBarStyles(c), [c]);
  const [kbVisible, setKbVisible] = useState(false);

  useEffect(() => {
    const s1 = Keyboard.addListener('keyboardDidShow', () => setKbVisible(true));
    const s2 = Keyboard.addListener('keyboardDidHide', () => setKbVisible(false));
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  const byName = {};
  state.routes.forEach((r) => {
    byName[r.name] = r;
  });
  const activeName = state.routes[state.index]?.name;

  const go = (name) => {
    const route = byName[name];
    if (!route) return;
    const focused = activeName === name;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  if (kbVisible) return null;

  const ITEMS = [
    { kind: 'nav', name: 'HomeTab' },
    { kind: 'nav', name: 'FoodTab' },
    { kind: 'feature', name: 'CameraTab', icon: 'camera', label: t('nav.tabPhoto') },
    { kind: 'feature', name: 'CoachTab', icon: 'barbell', label: t('nav.tabCoach') },
    { kind: 'nav', name: 'HistoryTab' },
    { kind: 'nav', name: 'ProfileTab' },
  ];

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <BlurView
        tint={c.dark ? 'dark' : 'light'}
        intensity={70}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.tint} />

      <View style={styles.row}>
        {ITEMS.map((it) => {
          const active = activeName === it.name;
          if (it.kind === 'feature') {
            return (
              <FeatureButton
                key={it.name}
                label={it.label}
                icon={it.icon}
                active={active}
                onPress={() => go(it.name)}
                c={c}
                styles={styles}
              />
            );
          }
          const route = byName[it.name];
          if (!route) return null;
          const color = active ? c.primary : c.textFaint;
          const { options } = descriptors[route.key];
          return (
            <Pressable
              key={it.name}
              onPress={() => go(it.name)}
              style={styles.item}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View style={styles.iconSlot}>
                {options.tabBarIcon
                  ? options.tabBarIcon({ focused: active, color, size: 23 })
                  : null}
              </View>
              <Text style={[styles.navLabel, { color }]}>{options.title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeTabBarStyles = (c) =>
  StyleSheet.create({
    wrap: {
      paddingTop: 6,
      paddingHorizontal: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
      overflow: 'hidden',
    },
    tint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.dark
        ? 'rgba(11,11,14,0.55)'
        : 'rgba(255,255,255,0.6)',
    },
    row: { flexDirection: 'row', alignItems: 'flex-start' },
    item: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
    iconSlot: { height: 40, justifyContent: 'center', alignItems: 'center' },
    featureSquare: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureLabel: { fontFamily: 'Manrope_700Bold', fontSize: 11 },
    navLabel: { fontFamily: 'Manrope_600SemiBold', fontSize: 11 },
  });

function Splash() {
  const c = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: c.bg }]}>
      <ActivityIndicator size="large" color={c.primary} />
    </View>
  );
}

function MainTabs() {
  const { t } = useT();
  const c = useTheme();
  return (
    <Tab.Navigator
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: 'Manrope_700Bold' },
        animation: 'shift',
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: t('nav.tabHome'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="FoodTab"
        component={FoodSearchScreen}
        options={{
          title: t('nav.tabFood'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="restaurant" color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="CameraTab"
        component={CameraScreen}
        options={{ title: t('nav.tabCamera'), headerShown: false }}
      />
      <Tab.Screen
        name="CoachTab"
        component={CoachScreen}
        options={{ title: t('nav.tabCoach'), headerShown: false }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryScreen}
        options={{
          title: t('nav.tabDiary'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="book" color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: t('nav.tabProfile'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person" color={color} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function ProfileGate() {
  const [profile, setProfile] = useState(undefined);
  // гид по разделам — только для только что созданного аккаунта, один раз за сессию
  const [showTour, setShowTour] = useState(false);

  const refresh = useCallback(() => {
    getProfile()
      .then(setProfile)
      .catch((e) => {
        console.warn('ProfileGate: getProfile', e?.message);
        setProfile(null);
      });
  }, []);

  useEffect(refresh, [refresh]);

  if (profile === undefined) return <Splash />;

  if (!profile || !profile.onboarded) {
    return (
      <OnboardingScreen
        onDone={(updated) => {
          setShowTour(true);
          setProfile(updated);
        }}
      />
    );
  }

  if (showTour) {
    return <WelcomeTourScreen onDone={() => setShowTour(false)} />;
  }

  return <MainTabs />;
}

// Держит расписание «умных» напоминаний в актуальном состоянии:
// при запуске и каждом возврате в приложение сверяется с записями за сегодня.
function ReminderScheduler() {
  const { notifications, waterReminder, waterGoal, motivationPush } =
    useSettings();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const tk = dayKey(new Date());
        // для мотивации нужна история приёмов, для остального — только сегодня
        const meals = await fetchRecentMeals(motivationPush ? 40 : 1).catch(
          () => []
        );
        let loggedTypes = new Set();
        let mealCount = 0;
        if (notifications) {
          const today = (meals || []).filter(
            (m) => dayKey(m.created_at) === tk
          );
          loggedTypes = new Set(today.map((m) => m.meal_type).filter(Boolean));
          mealCount = today.length;
        }
        let waterToday = 0;
        if (waterReminder) {
          waterToday = await getWater(tk).catch(() => 0);
        }
        const [suppList, suppLog, profile, workouts] = await Promise.all([
          fetchSupplements().catch(() => []),
          fetchSupplementLog(tk).catch(() => []),
          motivationPush ? getProfile().catch(() => ({})) : Promise.resolve({}),
          motivationPush
            ? fetchWorkouts(30).catch(() => [])
            : Promise.resolve([]),
        ]);
        if (cancelled) return;

        let motivation = null;
        if (motivationPush) {
          const byDay = totalsByDay(meals);
          const yKey = dayKey(new Date(Date.now() - 86400000));
          const y = byDay[yKey];
          const lastWo = workouts[0]?.workout_on || null;
          motivation = {
            enabled: true,
            streak: currentStreak(byDay),
            yKcal: y?.calories || 0,
            yGoal: profile?.daily_kcal_goal || 0,
            yLogged: !!y?.count,
            everLoggedWorkout: workouts.length > 0,
            daysSinceWorkout: lastWo
              ? Math.round(
                  (Date.now() - new Date(`${lastWo}T12:00:00`).getTime()) /
                    86400000
                )
              : null,
          };
        }

        await rescheduleReminders({
          enabled: notifications,
          loggedTypes,
          mealCount,
          water: {
            enabled: waterReminder,
            goal: waterGoal,
            today: waterToday || 0,
          },
          supplements: { list: suppList, log: suppLog },
          motivation,
        });
      } catch (e) {
        console.warn('ReminderScheduler', e?.message);
      }
    };
    run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [notifications, waterReminder, waterGoal, motivationPush]);

  return null;
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const { t, ready: localeReady } = useT();
  const { ready: settingsReady, c } = useSettings();

  if (loading || !localeReady || !settingsReady) return <Splash />;

  const screenOptions = {
    headerStyle: { backgroundColor: c.bg },
    headerTintColor: c.text,
    headerShadowVisible: false,
    headerTitleStyle: { fontFamily: 'Manrope_700Bold' },
    contentStyle: { backgroundColor: c.bg },
  };

  return (
    <>
    {user ? <ReminderScheduler /> : null}
    <Stack.Navigator screenOptions={screenOptions}>
      {user ? (
        <>
          <Stack.Screen name="Main" component={ProfileGate} options={{ headerShown: false }} />
          <Stack.Screen
            name="Result"
            component={ResultScreen}
            options={{ title: t('nav.result'), animation: 'fade' }}
          />
          <Stack.Screen
            name="BarcodeResult"
            component={BarcodeResultScreen}
            options={{ title: t('nav.barcode'), animation: 'fade' }}
          />
          <Stack.Screen
            name="MealDetail"
            component={MealDetailScreen}
            options={{ title: t('nav.mealDetail') }}
          />
          <Stack.Screen
            name="DiarySearch"
            component={DiarySearchScreen}
            options={{ title: t('nav.diarySearch') }}
          />
          <Stack.Screen
            name="SupplementEdit"
            component={SupplementEditScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="SupplementReco"
            component={SupplementRecoScreen}
            options={{ presentation: 'modal', title: t('reco.wizardTitle') }}
          />
          <Stack.Screen
            name="WorkoutEdit"
            component={WorkoutEditScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="ExerciseProgress"
            component={ExerciseProgressScreen}
          />
          <Stack.Screen
            name="PlanWizard"
            component={PlanWizardScreen}
            options={{ presentation: 'modal', title: t('plan.wizardTitle') }}
          />
          <Stack.Screen
            name="PlanDayEdit"
            component={PlanDayEditScreen}
            options={{ presentation: 'modal', title: t('planday.title') }}
          />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('set.title') }} />
          <Stack.Screen name="Weight" component={WeightScreen} options={{ title: t('weight.title') }} />
          <Stack.Screen name="Goals" component={GoalsScreen} options={{ title: t('goals.title') }} />
          <Stack.Screen name="Trends" component={TrendsScreen} options={{ title: t('trends.title') }} />
          <Stack.Screen name="CookMode" component={CookModeScreen} options={{ title: t('recipe.cook') }} />
          <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ title: t('ach.title') }} />
          <Stack.Screen name="WeeklyReport" component={WeeklyReportScreen} options={{ title: t('report.title') }} />
          <Stack.Screen
            name="QuickAdd"
            component={QuickAddScreen}
            options={{ title: t('quick.title'), presentation: 'modal' }}
          />
          <Stack.Screen
            name="CustomProduct"
            component={CustomProductScreen}
            options={{ title: t('custom.title'), presentation: 'modal' }}
          />
          <Stack.Screen name="Recipe" component={RecipeScreen} options={{ title: t('nav.recipe') }} />
          <Stack.Screen
            name="RecipeDetail"
            component={RecipeDetailScreen}
            options={{ title: t('nav.recipe') }}
          />
          <Stack.Screen
            name="EditGoal"
            component={OnboardingScreen}
            options={{ title: t('nav.editGoal'), presentation: 'modal' }}
          />
          <Stack.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{ title: t('nav.paywall'), presentation: 'modal' }}
          />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
    </>
  );
}

function ThemedApp() {
  const { c } = useSettings();
  const navTheme = useMemo(() => {
    const base = c.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: c.bg,
        card: c.bg,
        text: c.text,
        border: c.divider,
        primary: c.primary,
      },
    };
  }, [c]);

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={c.statusBar} />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_300Light,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SettingsProvider>
      <LocaleProvider>
        <AuthProvider>
          <SelectedDayProvider>
            <ThemedApp />
          </SelectedDayProvider>
        </AuthProvider>
      </LocaleProvider>
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
