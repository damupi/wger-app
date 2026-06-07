import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchSessionLogs, fetchSessions } from '@/lib/wger';

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const navigation = useNavigation();
  const router = useRouter();

  const { data: sessions } = useQuery({ queryKey: ['sessions'], queryFn: fetchSessions });
  const session = sessions?.find((s) => String(s.id) === sessionId);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['logs', session?.workout],
    queryFn: () => fetchSessionLogs(session!.workout),
    enabled: !!session?.workout,
  });

  useEffect(() => {
    if (session) {
      navigation.setOptions({ title: new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) });
    }
  }, [session, navigation]);

  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const grouped = new Map<number, typeof logs>();
  logs?.forEach((log) => {
    if (!grouped.has(log.exercise)) grouped.set(log.exercise, []);
    grouped.get(log.exercise)!.push(log);
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.dateText}>
        {new Date(session.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </Text>
      {session.notes ? <Text style={styles.notes}>{session.notes}</Text> : null}

      <TouchableOpacity
        style={styles.performBtn}
        onPress={() => router.push(`/start-workout/${session.workout}`)}
      >
        <MaterialIcons name="play-arrow" size={20} color="#fff" />
        <Text style={styles.performBtnText}>Perform Again</Text>
      </TouchableOpacity>

      {isLoading ? (
        <ActivityIndicator color="#4CAF50" style={{ marginTop: 24 }} />
      ) : logs?.length === 0 ? (
        <Text style={styles.noLogs}>No exercise logs for this session.</Text>
      ) : (
        Array.from(grouped.entries()).map(([exId, exLogs]) => {
          const best = exLogs!.reduce((b, l) =>
            Number(l.weight) * l.reps > Number(b.weight) * b.reps ? l : b
          );
          return (
            <View key={exId} style={styles.exerciseBlock}>
              <Text style={styles.exerciseName}>Exercise #{exId}</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, styles.cellHeader]}>SET</Text>
                <Text style={[styles.cell, styles.cellHeader]}>KG</Text>
                <Text style={[styles.cell, styles.cellHeader]}>REPS</Text>
                <Text style={[styles.cell, styles.cellHeader]}>VOL</Text>
              </View>
              {exLogs!.map((log, i) => (
                <View key={log.id} style={[styles.tableRow, log.id === best.id && styles.bestRow]}>
                  <Text style={styles.cell}>{i + 1}</Text>
                  <Text style={styles.cell}>{log.weight}</Text>
                  <Text style={styles.cell}>{log.reps}</Text>
                  <Text style={styles.cell}>{(Number(log.weight) * log.reps).toFixed(0)}</Text>
                </View>
              ))}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#0d0d0d', justifyContent: 'center', alignItems: 'center' },
  dateText: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  notes: { color: '#888', fontSize: 14, marginBottom: 16 },
  performBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
    marginVertical: 16,
  },
  performBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  noLogs: { color: '#666', fontStyle: 'italic', marginTop: 24, textAlign: 'center' },
  exerciseBlock: { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 14, marginBottom: 12 },
  exerciseName: { color: '#fff', fontWeight: '600', fontSize: 15, marginBottom: 10 },
  tableHeader: { flexDirection: 'row', marginBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 4 },
  bestRow: { backgroundColor: '#1a3d1a', borderRadius: 4 },
  cell: { flex: 1, color: '#ccc', fontSize: 13, textAlign: 'center' },
  cellHeader: { color: '#666', fontWeight: '700', fontSize: 11 },
});
