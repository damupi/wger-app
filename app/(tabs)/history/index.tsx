import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WorkoutSession, fetchSessions } from '@/lib/wger';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(dur: string | null): string {
  if (!dur) return '—';
  // duration is in "HH:MM:SS" or ISO format
  const match = dur.match(/(\d+):(\d+):(\d+)/);
  if (!match) return dur;
  const [, h, m] = match;
  return h !== '0' ? `${h}h ${m}m` : `${m}m`;
}

function SessionCard({ session, onPress }: { session: WorkoutSession; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardDate}>{formatDate(session.date)}</Text>
          {session.notes ? <Text style={styles.cardNotes}>{session.notes}</Text> : null}
        </View>
        <MaterialIcons name="chevron-right" size={20} color="#444" />
      </View>
      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <MaterialIcons name="timer" size={14} color="#888" />
          <Text style={styles.metaText}>{formatDuration(session.duration)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.pageHeader}>
          <Text style={styles.headerTitle}>History</Text>
        </View>
      </View>
    );
  }

  if (!sessions?.length) {
    return (
      <View style={styles.container}>
        <View style={styles.pageHeader}>
          <Text style={styles.headerTitle}>History</Text>
        </View>
        <View style={styles.empty}>
          <MaterialIcons name="history" size={64} color="#333" />
          <Text style={styles.emptyTitle}>No workouts yet</Text>
          <Text style={styles.emptySubtitle}>Complete a workout to see it here</Text>
        </View>
      </View>
    );
  }

  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <Text style={styles.headerTitle}>History</Text>
      </View>
      <FlatList
        data={sorted}
        keyExtractor={(s) => String(s.id)}
        renderItem={({ item }) => (
          <SessionCard session={item} onPress={() => router.push(`/history/${item.id}`)} />
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  pageHeader: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardDate: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cardNotes: { color: '#888', fontSize: 13, marginTop: 2 },
  cardMeta: { flexDirection: 'row', gap: 16, marginTop: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#888', fontSize: 13 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '600' },
  emptySubtitle: { color: '#666', fontSize: 14 },
});
