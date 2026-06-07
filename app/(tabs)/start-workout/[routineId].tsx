import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Day,
  fetchDaySlots,
  fetchExerciseInfo,
  fetchRoutineDays,
  fetchRoutines,
  fetchSlotEntries,
  getEnglishName,
} from '@/lib/wger';

// Loads exercise names for one training day card
function DaySection({ day, onPress }: { day: Day; onPress: () => void }) {
  const { data: exercises, isLoading } = useQuery({
    queryKey: ['dayExercises', day.id],
    queryFn: async () => {
      const slots = await fetchDaySlots(day.id);
      const allEntries = await Promise.all(slots.map((s) => fetchSlotEntries(s.id)));
      const flat = allEntries.flat();
      const uniqueIds = [...new Set(flat.map((e) => e.exercise))];
      const infos = await Promise.all(uniqueIds.map((id) => fetchExerciseInfo(id)));
      return infos.map((info) => getEnglishName(info));
    },
    staleTime: 10 * 60 * 1000,
  });

  const visible = exercises?.slice(0, 5) ?? [];
  const extra = (exercises?.length ?? 0) - 5;

  return (
    <TouchableOpacity style={styles.dayCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.dayHeader}>
        <View style={styles.dayBadge}>
          <Text style={styles.dayBadgeText}>{day.order}</Text>
        </View>
        <Text style={styles.dayName}>{day.name}</Text>
        <MaterialIcons name="chevron-right" size={20} color="#444" />
      </View>
      <View style={styles.exerciseList}>
        {isLoading ? (
          <ActivityIndicator size="small" color="#555" style={{ marginTop: 4 }} />
        ) : (
          <>
            {visible.map((name, i) => (
              <Text key={i} style={styles.exerciseItem}>• {name}</Text>
            ))}
            {extra > 0 && <Text style={styles.moreText}>+{extra} more</Text>}
            {exercises?.length === 0 && (
              <Text style={styles.moreText}>No exercises configured</Text>
            )}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function RoutineDetailScreen() {
  const { routineId } = useLocalSearchParams<{ routineId: string }>();
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);

  const { data: allRoutines } = useQuery({ queryKey: ['routines'], queryFn: fetchRoutines });
  const routine = allRoutines?.find((r) => String(r.id) === routineId);

  const { data: days, isLoading, error } = useQuery({
    queryKey: ['days', routineId],
    queryFn: () => fetchRoutineDays(Number(routineId)),
  });

  function goToWorkout(day: Day) {
    router.push(`/start-workout/workout?routineId=${routineId}&dayId=${day.id}`);
  }

  function startWorkout() {
    if (!days?.length) return;
    if (days.length === 1) {
      goToWorkout(days[0]);
    } else {
      setShowPicker(true);
    }
  }

  function pickDay(day: Day) {
    setShowPicker(false);
    goToWorkout(day);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{routine?.name ?? 'Routine'}</Text>
          {routine?.is_template && <Text style={styles.headerBadge}>Template</Text>}
        </View>
      </View>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load routine</Text>
        </View>
      )}

      {!isLoading && !error && (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            {routine?.description ? (
              <Text style={styles.description}>{routine.description}</Text>
            ) : null}

            {!days?.length ? (
              <Text style={styles.emptyText}>No training days configured.</Text>
            ) : (
              days.map((day) => (
                <DaySection key={day.id} day={day} onPress={() => goToWorkout(day)} />
              ))
            )}
          </ScrollView>

          {days && days.length > 0 && (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.startBtn} onPress={startWorkout} activeOpacity={0.85}>
                <Text style={styles.startBtnText}>START WORKOUT</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowPicker(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Choose a day</Text>
          {days?.map((day) => (
            <TouchableOpacity key={day.id} style={styles.sheetRow} onPress={() => pickDay(day)} activeOpacity={0.7}>
              <View style={styles.sheetBadge}>
                <Text style={styles.sheetBadgeText}>{day.order}</Text>
              </View>
              <Text style={styles.sheetDayName}>{day.name}</Text>
              <MaterialIcons name="chevron-right" size={20} color="#444" />
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  backBtn: { padding: 4 },
  headerText: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerBadge: { color: '#4CAF50', fontSize: 11, fontWeight: '600', marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#f44' },
  content: { padding: 16, paddingBottom: 120 },
  description: { color: '#888', fontSize: 14, marginBottom: 20, lineHeight: 20 },
  emptyText: { color: '#555', fontSize: 14 },

  dayCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayBadge: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#1a3d1a',
    justifyContent: 'center', alignItems: 'center',
  },
  dayBadgeText: { color: '#4CAF50', fontWeight: '700', fontSize: 13 },
  dayName: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  exerciseList: { marginTop: 10, marginLeft: 42, gap: 4 },
  exerciseItem: { color: '#888', fontSize: 13 },
  moreText: { color: '#555', fontSize: 12 },

  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: '#0d0d0d',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  startBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#444', alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  sheetBadge: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#1a3d1a',
    justifyContent: 'center', alignItems: 'center',
  },
  sheetBadgeText: { color: '#4CAF50', fontWeight: '700', fontSize: 13 },
  sheetDayName: { color: '#fff', fontSize: 16, flex: 1 },
});
