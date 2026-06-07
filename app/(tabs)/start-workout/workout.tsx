import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ExerciseInfo,
  fetchAllExercises,
  fetchDay,
  fetchDaySlots,
  fetchExerciseConfigs,
  fetchExerciseInfo,
  fetchRoutines,
  fetchSlotEntries,
  getEnglishName,
  REP_UNIT_LABEL,
  createWorkoutLog,
  createSession,
} from '@/lib/wger';
import {
  ActiveSet,
  clearActiveSets,
  deleteActiveSet,
  getActiveSets,
  insertActiveSet,
  updateActiveSet,
} from '@/lib/db';

interface ExercisePreview {
  exerciseId: number;
  exerciseName: string;
  category: string;
  setCount: number;
  slotOrder: number;
  defaultReps: number;
  defaultWeight: number;
  repUnit: number;
}

interface ExerciseBlock {
  slotOrder: number;
  exerciseId: number;
  exerciseName: string;
  sets: ActiveSet[];
  repUnit: number;
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function useTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      if (ref.current) clearInterval(ref.current);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);

  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const sec = String(seconds % 60).padStart(2, '0');
  return { formatted: `${h}:${m}:${sec}` };
}

const REST_SECONDS = 90;

// ── Rest Timer Bar ────────────────────────────────────────────────────────────

function RestTimerBar({ startedAt, totalSeconds, onFinish }: {
  startedAt: number;
  totalSeconds: number;
  onFinish: () => void;
}) {
  const widthAnim = useRef(new Animated.Value(1)).current;
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: 0,
      duration: totalSeconds * 1000,
      useNativeDriver: false,
    }).start(({ finished }) => { if (finished) onFinish(); });

    const iv = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const rem = Math.max(0, totalSeconds - elapsed);
      setRemaining(Math.ceil(rem));
      if (rem <= 0) clearInterval(iv);
    }, 250);

    return () => { clearInterval(iv); widthAnim.stopAnimation(); };
  }, []);

  const m = Math.floor(remaining / 60);
  const sec = remaining % 60;

  return (
    <TouchableOpacity onPress={onFinish} activeOpacity={0.85}>
      <View style={rt.wrapper}>
        <Animated.View style={[rt.fill, {
          width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]} />
        <Text style={rt.label}>{m}:{String(sec).padStart(2, '0')}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Swipeable Row ─────────────────────────────────────────────────────────────

function SwipeableRow({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const translateX = useRef(new Animated.Value(0)).current;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx < -5 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => { if (g.dx < 0) translateX.setValue(g.dx); },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -80 || g.vx < -1) {
          Animated.timing(translateX, { toValue: -500, duration: 200, useNativeDriver: true }).start(onDelete);
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
      {children}
    </Animated.View>
  );
}

// ── Set Row ───────────────────────────────────────────────────────────────────

function SetRow({ set, index, onUpdate, onDelete }: {
  set: ActiveSet; index: number;
  onUpdate: (id: number, reps: number, weight: number, confirmed: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const [reps, setReps] = useState(String(set.reps || ''));
  const [weight, setWeight] = useState(String(set.weight || ''));
  const confirmed = set.confirmed;

  return (
    <View style={[sr.row, confirmed && sr.rowDone]}>
      <Text style={sr.num}>{index + 1}</Text>
      <Text style={sr.prev}>—</Text>
      <TextInput
        style={[sr.input, confirmed && sr.inputDone]}
        value={weight} onChangeText={setWeight}
        keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#555"
        editable={!confirmed}
      />
      <TextInput
        style={[sr.input, confirmed && sr.inputDone]}
        value={reps} onChangeText={setReps}
        keyboardType="number-pad" placeholder="0" placeholderTextColor="#555"
        editable={!confirmed}
      />
      <TouchableOpacity
        style={[sr.check, confirmed && sr.checkDone]}
        onPress={confirmed
          ? () => onUpdate(set.id!, parseInt(reps) || 0, parseFloat(weight) || 0, false)
          : () => onUpdate(set.id!, parseInt(reps) || 0, parseFloat(weight) || 0, true)
        }
      >
        {confirmed && <MaterialIcons name="check" size={18} color="#fff" />}
      </TouchableOpacity>
    </View>
  );
}

// ── Exercise menu ─────────────────────────────────────────────────────────────

function ExerciseMenuSheet({ exercise, onClose, onUpdateRestTimers, onDeleteExercise }: {
  exercise: ExerciseBlock | null;
  onClose: () => void;
  onUpdateRestTimers: () => void;
  onDeleteExercise: () => void;
}) {
  return (
    <Modal visible={exercise !== null} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={ms.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={ms.sheet}>
        <View style={ms.handle} />
        <Text style={ms.title} numberOfLines={1}>{exercise?.exerciseName}</Text>
        <TouchableOpacity style={ms.row} onPress={() => { onClose(); onUpdateRestTimers(); }} activeOpacity={0.7}>
          <MaterialIcons name="timer" size={22} color="#2196F3" style={ms.rowIcon} />
          <Text style={ms.rowLabel}>Update rest timers</Text>
        </TouchableOpacity>
        <TouchableOpacity style={ms.row} onPress={() => { onClose(); onDeleteExercise(); }} activeOpacity={0.7}>
          <MaterialIcons name="delete-outline" size={22} color="#f44336" style={ms.rowIcon} />
          <Text style={[ms.rowLabel, { color: '#f44336' }]}>Delete exercise</Text>
        </TouchableOpacity>
        <TouchableOpacity style={ms.cancelBtn} onPress={onClose}>
          <Text style={ms.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── Rest timer edit ───────────────────────────────────────────────────────────

function fmtSecs(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function RestTimerModal({ exercise, currentSeconds, onClose, onSave }: {
  exercise: ExerciseBlock | null;
  currentSeconds: number;
  onClose: () => void;
  onSave: (seconds: number) => void;
}) {
  const [seconds, setSeconds] = useState(currentSeconds);
  useEffect(() => { if (exercise) setSeconds(currentSeconds); }, [exercise, currentSeconds]);

  return (
    <Modal visible={exercise !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={rm.backdrop}>
        <View style={rm.card}>
          <Text style={rm.title}>Update rest timers</Text>
          <Text style={rm.subtitle}>Changes apply to future sets for this exercise.</Text>
          <View style={rm.row}>
            <Text style={rm.rowLabel}>Work set</Text>
            <View style={rm.stepper}>
              <TouchableOpacity style={[rm.stepBtn, seconds <= 0 && rm.stepBtnDisabled]}
                onPress={() => setSeconds((v) => Math.max(0, v - 15))} disabled={seconds <= 0}>
                <Text style={rm.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={rm.stepValue}>{fmtSecs(seconds)}</Text>
              <TouchableOpacity style={[rm.stepBtn, seconds >= 600 && rm.stepBtnDisabled]}
                onPress={() => setSeconds((v) => Math.min(600, v + 15))} disabled={seconds >= 600}>
                <Text style={rm.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={rm.saveBtn} onPress={() => onSave(seconds)}>
            <Text style={rm.saveBtnText}>UPDATE REST TIMERS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={rm.cancelBtn} onPress={onClose}>
            <Text style={rm.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Add Exercise Modal ────────────────────────────────────────────────────────

function AddExerciseModal({ visible, onClose, onSelect }: {
  visible: boolean;
  onClose: () => void;
  onSelect: (info: ExerciseInfo) => void;
}) {
  const [search, setSearch] = useState('');
  const { data: allExercises, isLoading } = useQuery({
    queryKey: ['exercises'],
    queryFn: fetchAllExercises,
    staleTime: 10 * 60 * 1000,
  });

  const filtered = (allExercises ?? []).filter((ex) =>
    getEnglishName(ex).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={ae.container}>
        <View style={ae.header}>
          <TouchableOpacity onPress={onClose} style={ae.closeBtn}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={ae.headerTitle}>Add Exercise</Text>
        </View>
        <View style={ae.searchRow}>
          <MaterialIcons name="search" size={20} color="#888" style={ae.searchIcon} />
          <TextInput style={ae.searchInput} placeholder="Search exercises…" placeholderTextColor="#555"
            value={search} onChangeText={setSearch} autoFocus />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialIcons name="cancel" size={18} color="#555" />
            </TouchableOpacity>
          )}
        </View>
        {isLoading ? (
          <View style={ae.center}><ActivityIndicator size="large" color="#4CAF50" /></View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(ex) => String(ex.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: ex }) => (
              <TouchableOpacity style={ae.row} onPress={() => onSelect(ex)} activeOpacity={0.7}>
                <View style={ae.rowLeft}>
                  <Text style={ae.rowName}>{getEnglishName(ex)}</Text>
                  {ex.category?.name ? <Text style={ae.rowCategory}>{ex.category.name}</Text> : null}
                </View>
                <MaterialIcons name="add-circle-outline" size={24} color="#4CAF50" />
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={ae.separator} />}
          />
        )}
      </View>
    </Modal>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function WorkoutScreen() {
  const { routineId, dayId } = useLocalSearchParams<{ routineId: string; dayId: string }>();
  const router = useRouter();

  const [preview, setPreview] = useState<ExercisePreview[]>([]);
  const [exercises, setExercises] = useState<ExerciseBlock[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [restTimer, setRestTimer] = useState<{ setId: number; startedAt: number; totalSeconds: number } | null>(null);
  const [exerciseRestTimes, setExerciseRestTimes] = useState<Map<number, number>>(new Map());
  const [menuExercise, setMenuExercise] = useState<ExerciseBlock | null>(null);
  const [restEditExercise, setRestEditExercise] = useState<ExerciseBlock | null>(null);
  const [showAddExercise, setShowAddExercise] = useState(false);

  const timer = useTimer(started);

  const { data: routines } = useQuery({ queryKey: ['routines'], queryFn: fetchRoutines });
  const routine = routines?.find((r) => String(r.id) === routineId);

  const { data: day } = useQuery({
    queryKey: ['day', dayId],
    queryFn: () => fetchDay(Number(dayId)),
  });

  const dayName = day?.name ?? '';

  useEffect(() => { loadPreview(); }, [dayId]);

  async function loadPreview() {
    setLoadingPreview(true);
    try {
      const slots = await fetchDaySlots(Number(dayId));
      const allEntries = await Promise.all(slots.map((sl) => fetchSlotEntries(sl.id)));
      const flat = allEntries.flatMap((list, i) =>
        list.map((e) => ({ ...e, slotOrder: slots[i].order * 100 + e.order }))
      );

      const uniqueIds = [...new Set(flat.map((e) => e.exercise))];
      const [infos, configMap] = await Promise.all([
        Promise.all(uniqueIds.map((id) => fetchExerciseInfo(id))),
        fetchExerciseConfigs(),
      ]);
      const infoMap = new Map<number, ExerciseInfo>(infos.map((info) => [info.id, info]));

      const byExercise = new Map<number, { name: string; category: string; sets: number; reps: number; weight: number; repUnit: number; minOrder: number }>();
      for (const e of flat) {
        const info = infoMap.get(e.exercise);
        const name = info ? getEnglishName(info) : `Exercise #${e.exercise}`;
        const category = info?.category?.name ?? '';
        const config = configMap.get(e.id);
        const entrySets = config?.sets ?? 1;
        const existing = byExercise.get(e.exercise);
        if (existing) {
          existing.sets += entrySets;
        } else {
          byExercise.set(e.exercise, {
            name, category,
            sets: entrySets,
            reps: config?.reps ?? 0,
            weight: config?.weight ?? 0,
            repUnit: e.repetition_unit ?? 1,
            minOrder: e.slotOrder,
          });
        }
      }

      setPreview(
        Array.from(byExercise.entries())
          .map(([id, v]) => ({
            exerciseId: id,
            exerciseName: v.name,
            category: v.category,
            setCount: v.sets,
            slotOrder: v.minOrder,
            defaultReps: v.reps,
            defaultWeight: v.weight,
            repUnit: v.repUnit,
          }))
          .sort((a, b) => a.slotOrder - b.slotOrder)
      );
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleStart() {
    setStarting(true);
    try {
      await clearActiveSets();
      const slots = await fetchDaySlots(Number(dayId));
      const allEntries = await Promise.all(slots.map((sl) => fetchSlotEntries(sl.id)));
      const flat = allEntries.flatMap((list, i) =>
        list.map((e) => ({ ...e, slotOrder: slots[i].order * 100 + e.order }))
      );
      const configMap = await fetchExerciseConfigs();

      const blocks: ExerciseBlock[] = [];
      for (const e of flat) {
        const config = configMap.get(e.id);
        const numSets = config?.sets ?? 1;
        const defaultReps = config?.reps ?? 0;
        const defaultWeight = config?.weight ?? 0;
        const repUnit = e.repetition_unit ?? 1;
        const name = preview.find((p) => p.exerciseId === e.exercise)?.exerciseName ?? `Exercise #${e.exercise}`;

        const newSets: ActiveSet[] = [];
        for (let i = 0; i < numSets; i++) {
          const setId = await insertActiveSet({ exerciseId: e.exercise, exerciseName: name, slotOrder: e.slotOrder, reps: defaultReps, weight: defaultWeight, confirmed: false });
          newSets.push({ id: setId, exerciseId: e.exercise, exerciseName: name, slotOrder: e.slotOrder, reps: defaultReps, weight: defaultWeight, confirmed: false });
        }

        const existing = blocks.find((b) => b.exerciseId === e.exercise);
        if (existing) { existing.sets.push(...newSets); }
        else { blocks.push({ slotOrder: e.slotOrder, exerciseId: e.exercise, exerciseName: name, repUnit, sets: newSets }); }
      }
      setExercises(blocks.sort((a, b) => a.slotOrder - b.slotOrder));
      setStarted(true);
    } finally {
      setStarting(false);
    }
  }

  const handleUpdateSet = useCallback(async (id: number, reps: number, weight: number, confirmed: boolean) => {
    await updateActiveSet(id, reps, weight, confirmed);
    setExercises((prev) =>
      prev.map((b) => ({ ...b, sets: b.sets.map((s) => s.id === id ? { ...s, reps, weight, confirmed } : s) }))
    );
    if (confirmed) {
      const exerciseId = exercises.flatMap((b) => b.sets).find((s) => s.id === id)?.exerciseId;
      const totalSeconds = exerciseId != null ? (exerciseRestTimes.get(exerciseId) ?? REST_SECONDS) : REST_SECONDS;
      if (totalSeconds > 0) setRestTimer({ setId: id, startedAt: Date.now(), totalSeconds });
    } else {
      setRestTimer((prev) => prev?.setId === id ? null : prev);
    }
  }, [exercises, exerciseRestTimes]);

  const handleAddSet = useCallback(async (block: ExerciseBlock) => {
    const setId = await insertActiveSet({ exerciseId: block.exerciseId, exerciseName: block.exerciseName, slotOrder: block.slotOrder, reps: 0, weight: 0, confirmed: false });
    const row: ActiveSet = { id: setId, exerciseId: block.exerciseId, exerciseName: block.exerciseName, slotOrder: block.slotOrder, reps: 0, weight: 0, confirmed: false };
    setExercises((prev) => prev.map((b) => b.exerciseId === block.exerciseId ? { ...b, sets: [...b.sets, row] } : b));
  }, []);

  const handleDeleteSet = useCallback(async (id: number) => {
    await deleteActiveSet(id);
    setExercises((prev) => prev.map((b) => ({ ...b, sets: b.sets.filter((s) => s.id !== id) })));
  }, []);

  const handleDeleteExercise = useCallback(async (block: ExerciseBlock) => {
    await Promise.all(block.sets.filter((s) => s.id != null).map((s) => deleteActiveSet(s.id!)));
    setExercises((prev) => prev.filter((b) => b.exerciseId !== block.exerciseId));
  }, []);

  const handleAddExercise = useCallback(async (info: ExerciseInfo) => {
    const name = getEnglishName(info);
    setShowAddExercise(false);
    setExercises((prev) => {
      if (prev.some((b) => b.exerciseId === info.id)) {
        const block = prev.find((b) => b.exerciseId === info.id)!;
        insertActiveSet({ exerciseId: info.id, exerciseName: name, slotOrder: block.slotOrder, reps: 0, weight: 0, confirmed: false })
          .then((setId) => {
            const row: ActiveSet = { id: setId, exerciseId: info.id, exerciseName: name, slotOrder: block.slotOrder, reps: 0, weight: 0, confirmed: false };
            setExercises((p) => p.map((b) => b.exerciseId === info.id ? { ...b, sets: [...b.sets, row] } : b));
          });
        return prev;
      }
      const slotOrder = (prev[prev.length - 1]?.slotOrder ?? 0) + 100;
      insertActiveSet({ exerciseId: info.id, exerciseName: name, slotOrder, reps: 0, weight: 0, confirmed: false })
        .then((setId) => {
          const row: ActiveSet = { id: setId, exerciseId: info.id, exerciseName: name, slotOrder, reps: 0, weight: 0, confirmed: false };
          setExercises((p) => [...p, { slotOrder, exerciseId: info.id, exerciseName: name, sets: [row] }]);
        });
      return prev;
    });
  }, []);

  const handleFinish = () => {
    Alert.alert('Finish Workout?', 'This will save all confirmed sets.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: async () => {
          setFinishing(true);
          try {
            const allSets = await getActiveSets();
            const confirmed = allSets.filter((s) => s.confirmed);
            const today = new Date().toISOString().split('T')[0];
            await createSession({ workout: Number(routineId), date: today, duration: timer.formatted, notes: dayName });
            await Promise.all(confirmed.map((s) =>
              createWorkoutLog({ exercise: s.exerciseId, workout: Number(routineId), reps: s.reps, weight: s.weight, date: today })
            ));
            await clearActiveSets();
            Alert.alert('Workout saved!', `${confirmed.length} set(s) logged.`, [
              { text: 'OK', onPress: () => router.push('/(tabs)/history') },
            ]);
          } catch {
            Alert.alert('Error', 'Failed to save workout. Please try again.');
          } finally {
            setFinishing(false);
          }
        },
      },
    ]);
  };

  // ── Preview ───────────────────────────────────────────────────────────────────

  if (!started) {
    return (
      <View style={styles.container}>
        <View style={styles.previewHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.previewRoutine}>{routine?.name ?? ''}</Text>
            <Text style={styles.previewDay}>{dayName}</Text>
          </View>
        </View>

        {loadingPreview ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#4CAF50" /></View>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.previewContent}>
              {preview.map((ex) => {
                const unitLabel = (REP_UNIT_LABEL[ex.repUnit] ?? 'REPS').toLowerCase();
                const detail = `${ex.setCount} sets × ${ex.defaultReps} ${unitLabel}${ex.defaultWeight > 0 ? ` @ ${ex.defaultWeight} kg` : ''}`;
                return (
                  <View key={ex.exerciseId} style={styles.previewRow}>
                    <View style={styles.previewMeta}>
                      <Text style={styles.previewName}>{ex.exerciseName}</Text>
                      <Text style={styles.previewCategory}>{detail}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.startContainer}>
              <TouchableOpacity style={styles.startBtn} onPress={handleStart} disabled={starting} activeOpacity={0.85}>
                {starting ? <ActivityIndicator color="#fff" /> : <Text style={styles.startBtnText}>START WORKOUT</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  }

  // ── Active workout ────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.activeHeader}>
        <TouchableOpacity onPress={() =>
          Alert.alert('Discard workout?', 'Exit without saving?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Exit', style: 'destructive', onPress: () => { clearActiveSets(); router.back(); } },
          ])
        }>
          <MaterialIcons name="close" size={24} color="#888" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName}>{dayName}</Text>
          <Text style={styles.headerTimer}>{timer.formatted}</Text>
        </View>
        <TouchableOpacity style={styles.finishBtn} onPress={handleFinish} disabled={finishing}>
          {finishing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.finishBtnText}>FINISH</Text>}
        </TouchableOpacity>
      </View>

      <FlatList
        data={exercises}
        keyExtractor={(item) => String(item.exerciseId)}
        contentContainerStyle={styles.activeContent}
        ListFooterComponent={
          <TouchableOpacity style={styles.addExerciseBtn} onPress={() => setShowAddExercise(true)} activeOpacity={0.8}>
            <MaterialIcons name="add" size={20} color="#4CAF50" />
            <Text style={styles.addExerciseText}>Add Exercise</Text>
          </TouchableOpacity>
        }
        renderItem={({ item: block }) => (
          <View style={styles.exerciseBlock}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{block.exerciseName}</Text>
              <TouchableOpacity onPress={() => setMenuExercise(block)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="more-horiz" size={22} color="#4CAF50" />
              </TouchableOpacity>
            </View>
            <View style={sr.row}>
              <Text style={[sr.num, styles.colHeader]}>SET</Text>
              <Text style={[sr.prev, styles.colHeader]}>PREV</Text>
              <Text style={[sr.input, styles.colHeader]}>KG</Text>
              <Text style={[sr.input, styles.colHeader]}>{REP_UNIT_LABEL[block.repUnit] ?? 'REPS'}</Text>
              <View style={sr.check} />
            </View>
            {block.sets.map((set, i) => (
              <View key={set.id}>
                <SwipeableRow onDelete={() => handleDeleteSet(set.id!)}>
                  <SetRow set={set} index={i} onUpdate={handleUpdateSet} onDelete={handleDeleteSet} />
                </SwipeableRow>
                {restTimer?.setId === set.id && (
                  <RestTimerBar startedAt={restTimer.startedAt} totalSeconds={restTimer.totalSeconds} onFinish={() => setRestTimer(null)} />
                )}
              </View>
            ))}
            <TouchableOpacity style={styles.addSetBtn} onPress={() => handleAddSet(block)}>
              <MaterialIcons name="add" size={16} color="#4CAF50" />
              <Text style={styles.addSetText}>Add Set</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <AddExerciseModal visible={showAddExercise} onClose={() => setShowAddExercise(false)} onSelect={handleAddExercise} />
      <ExerciseMenuSheet
        exercise={menuExercise}
        onClose={() => setMenuExercise(null)}
        onUpdateRestTimers={() => setRestEditExercise(menuExercise)}
        onDeleteExercise={() => menuExercise && handleDeleteExercise(menuExercise)}
      />
      <RestTimerModal
        exercise={restEditExercise}
        currentSeconds={restEditExercise ? (exerciseRestTimes.get(restEditExercise.exerciseId) ?? REST_SECONDS) : REST_SECONDS}
        onClose={() => setRestEditExercise(null)}
        onSave={(secs) => {
          if (restEditExercise) setExerciseRestTimes((prev) => new Map(prev).set(restEditExercise.exerciseId, secs));
          setRestEditExercise(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const rt = StyleSheet.create({
  wrapper: { height: 40, borderRadius: 8, backgroundColor: '#1a2a1a', overflow: 'hidden', marginVertical: 4, justifyContent: 'center', alignItems: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#1565C0', borderRadius: 8 },
  label: { color: '#fff', fontWeight: '700', fontSize: 15, fontVariant: ['tabular-nums'], zIndex: 1 },
});

const sr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  rowDone: { backgroundColor: '#0d1a2a', borderRadius: 6 },
  num: { width: 36, color: '#888', textAlign: 'center', fontSize: 13 },
  prev: { flex: 1, color: '#555', textAlign: 'center', fontSize: 12 },
  input: { flex: 1, color: '#fff', textAlign: 'center', backgroundColor: '#2a2a2a', borderRadius: 6, height: 36, marginHorizontal: 3, fontSize: 15 },
  inputDone: { backgroundColor: '#1a2a3a', color: '#2196F3' },
  check: { width: 32, height: 32, borderRadius: 6, borderWidth: 2, borderColor: '#444', justifyContent: 'center', alignItems: 'center', marginHorizontal: 2 },
  checkDone: { backgroundColor: '#2196F3', borderColor: '#2196F3' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  previewHeader: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 16, gap: 12, backgroundColor: '#1a1a1a', borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  backBtn: { padding: 4 },
  previewRoutine: { color: '#888', fontSize: 13 },
  previewDay: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  previewContent: { padding: 20, paddingBottom: 120 },
  previewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  previewMeta: { flex: 1 },
  previewName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  previewCategory: { color: '#888', fontSize: 13, marginTop: 2 },
  startContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36, backgroundColor: '#0d0d0d', borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  startBtn: { backgroundColor: '#4CAF50', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },

  activeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#1a1a1a', borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  headerCenter: { alignItems: 'center' },
  headerName: { color: '#fff', fontWeight: '700', fontSize: 16 },
  headerTimer: { color: '#4CAF50', fontSize: 13, fontVariant: ['tabular-nums'] },
  finishBtn: { backgroundColor: '#4CAF50', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  finishBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  activeContent: { padding: 12, paddingBottom: 40 },
  exerciseBlock: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 12 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  exerciseName: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  colHeader: { color: '#555', fontSize: 10, fontWeight: '700', backgroundColor: 'transparent', height: 20, lineHeight: 20 },
  addSetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 4, marginTop: 4 },
  addSetText: { color: '#4CAF50', fontSize: 14, fontWeight: '600' },
  addExerciseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, marginBottom: 20, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', borderStyle: 'dashed' },
  addExerciseText: { color: '#4CAF50', fontSize: 16, fontWeight: '600' },
});

const ae = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 16, gap: 12, backgroundColor: '#1a1a1a', borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  closeBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700', flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', margin: 12, paddingHorizontal: 12, backgroundColor: '#1a1a1a', borderRadius: 10, height: 44 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowLeft: { flex: 1 },
  rowName: { color: '#fff', fontSize: 15, fontWeight: '500' },
  rowCategory: { color: '#888', fontSize: 12, marginTop: 2 },
  separator: { height: 1, backgroundColor: '#1a1a1a', marginLeft: 16 },
});

const ms = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#444', alignSelf: 'center', marginBottom: 16 },
  title: { color: '#888', fontSize: 13, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  rowIcon: { marginRight: 16 },
  rowLabel: { color: '#fff', fontSize: 16 },
  cancelBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: '#888', fontSize: 16 },
});

const rm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#1e1e1e', borderRadius: 16, padding: 24, width: '100%' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#888', fontSize: 13, marginBottom: 24, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  rowLabel: { color: '#fff', fontSize: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
  stepBtnDisabled: { opacity: 0.3 },
  stepBtnText: { color: '#fff', fontSize: 22, fontWeight: '300' },
  stepValue: { color: '#fff', fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'], minWidth: 52, textAlign: 'center' },
  saveBtn: { backgroundColor: '#4CAF50', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { color: '#888', fontSize: 15 },
});
