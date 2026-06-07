import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ExerciseInfo, fetchAllExercises, getEnglishName } from '@/lib/wger';

interface ExerciseRow {
  id: number;
  name: string;
  category: string;
}

interface Section {
  title: string;
  data: ExerciseRow[];
}

function buildSections(exercises: ExerciseInfo[], search: string): Section[] {
  const query = search.toLowerCase().trim();
  const rows: ExerciseRow[] = exercises
    .map((e) => ({
      id: e.id,
      name: getEnglishName(e),
      category: e.category?.name ?? '',
    }))
    .filter((e) => !query || e.name.toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name));

  const map = new Map<string, ExerciseRow[]>();
  for (const row of rows) {
    const letter = row.name[0]?.toUpperCase() ?? '#';
    if (!map.has(letter)) map.set(letter, []);
    map.get(letter)!.push(row);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, data]) => ({ title, data }));
}

export default function ExercisesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['exercises'],
    queryFn: fetchAllExercises,
  });

  const sections = useMemo(() => buildSections(data ?? [], search), [data, search]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading exercises…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load exercises</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Exercises</Text>
      </View>
      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises…"
          placeholderTextColor="#666"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push(`/exercises/${item.id}`)}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <MaterialIcons name="fitness-center" size={20} color="#4CAF50" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowCategory}>{item.category}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#444" />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  center: { flex: 1, backgroundColor: '#0d0d0d', justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#0d0d0d' },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  loadingText: { color: '#888', marginTop: 12 },
  errorText: { color: '#f44' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, color: '#fff', height: 40, fontSize: 15 },
  sectionHeader: { backgroundColor: '#1a1a1a', paddingHorizontal: 16, paddingVertical: 4 },
  sectionHeaderText: { color: '#4CAF50', fontWeight: '700', fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d0d0d',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowContent: { flex: 1 },
  rowName: { color: '#fff', fontSize: 15, fontWeight: '500' },
  rowCategory: { color: '#888', fontSize: 12, marginTop: 1 },
  separator: { height: 1, backgroundColor: '#1a1a1a', marginLeft: 64 },
});
