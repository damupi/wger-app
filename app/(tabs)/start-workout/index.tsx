import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Routine, WorkoutSession, fetchRoutines, fetchSessions } from '@/lib/wger';

function RoutineCard({ routine, onPress }: { routine: Routine; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardIcon}>
        <MaterialIcons name="fitness-center" size={18} color="#4CAF50" />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{routine.name}</Text>
        {routine.description ? <Text style={styles.cardDesc} numberOfLines={1}>{routine.description}</Text> : null}
      </View>
      <MaterialIcons name="chevron-right" size={20} color="#444" />
    </TouchableOpacity>
  );
}

function WorkoutCard({ session, onPress }: { session: WorkoutSession; onPress: () => void }) {
  const label = new Date(session.date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.cardIcon, styles.workoutIconBg]}>
        <MaterialIcons name="check-circle" size={18} color="#2196F3" />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{session.notes || 'Workout'}</Text>
        <Text style={styles.cardDesc}>{label}</Text>
      </View>
      {session.duration ? <Text style={styles.duration}>{session.duration.slice(0, 5)}</Text> : null}
    </TouchableOpacity>
  );
}

export default function StartWorkoutScreen() {
  const router = useRouter();

  const { data: allRoutines, isLoading: loadingRoutines, error: routinesError } = useQuery({
    queryKey: ['routines'],
    queryFn: fetchRoutines,
  });

  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
  });

  const templates = allRoutines?.filter((r) => r.is_template) ?? [];
  const routines  = allRoutines?.filter((r) => !r.is_template) ?? [];
  const sortedSessions = [...(sessions ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <Text style={styles.headerTitle}>Workout</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* My Templates */}
        <Text style={styles.sectionTitle}>My Templates</Text>

        {loadingRoutines && <ActivityIndicator color="#4CAF50" style={styles.loader} />}
        {routinesError && <Text style={styles.errorText}>Failed to load templates</Text>}
        {!loadingRoutines && !routinesError && !templates.length && (
          <Text style={styles.emptyText}>No templates yet.</Text>
        )}
        {templates.map((r) => (
          <RoutineCard key={r.id} routine={r} onPress={() => router.push(`/start-workout/${r.id}`)} />
        ))}

        {/* My Routines */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>My Routines</Text>

        {!loadingRoutines && !routinesError && !routines.length && (
          <Text style={styles.emptyText}>No routines yet.</Text>
        )}
        {routines.map((r) => (
          <RoutineCard key={r.id} routine={r} onPress={() => router.push(`/start-workout/${r.id}`)} />
        ))}

        {/* My Workouts */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>My Workouts</Text>

        {loadingSessions && <ActivityIndicator color="#2196F3" style={styles.loader} />}
        {!loadingSessions && !sortedSessions.length && (
          <Text style={styles.emptyText}>No workouts recorded yet.</Text>
        )}
        {sortedSessions.map((s) => (
          <WorkoutCard key={s.id} session={s} onPress={() => router.push(`/history/${s.id}`)} />
        ))}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  pageHeader: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 4 },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  scroll: { padding: 16, paddingBottom: 40 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  loader: { marginVertical: 12 },
  errorText: { color: '#f44', fontSize: 14, marginBottom: 8 },
  emptyText: { color: '#555', fontSize: 14, marginBottom: 8 },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: '#1a3d1a',
    justifyContent: 'center', alignItems: 'center',
  },
  workoutIconBg: { backgroundColor: '#0d1a2a' },
  cardBody: { flex: 1 },
  cardName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cardDesc: { color: '#888', fontSize: 12, marginTop: 2 },
  duration: { color: '#555', fontSize: 13 },
});
