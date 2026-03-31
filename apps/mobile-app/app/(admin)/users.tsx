import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { apiService, UserItem } from '../../src/utils/api';

const ORANGE = '#FF6B00';
const ROLES = ['citizen', 'operator', 'admin'];
const ROLE_COLORS: Record<string, string> = { citizen: '#34C759', operator: '#007AFF', admin: '#FF3B30' };

export default function UsersScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await apiService.getAllUsers();
      setUsers(res.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); setIsRefreshing(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const changeRole = (user: UserItem) => {
    const otherRoles = ROLES.filter(r => r !== user.role);
    Alert.alert(
      'Change Role',
      `Current role: ${user.role}\nSelect new role for ${user.full_name}:`,
      [
        ...otherRoles.map(role => ({
          text: role.charAt(0).toUpperCase() + role.slice(1),
          onPress: async () => {
            try {
              await apiService.updateUserRole(user.id, role);
              Alert.alert('Success', `Role changed to ${role}`);
              fetchUsers();
            } catch { Alert.alert('Error', 'Failed to update role'); }
          }
        })),
        { text: 'Cancel', style: 'cancel' as const }
      ]
    );
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const renderUser = ({ item }: { item: UserItem }) => {
    const roleColor = ROLE_COLORS[item.role] || '#8E8E93';
    return (
      <View style={styles.userCard} data-testid={`user-card-${item.id}`}>
        <View style={[styles.userAvatar, { backgroundColor: `${roleColor}20` }]}>
          <Text style={[styles.userAvatarText, { color: roleColor }]}>{getInitials(item.full_name)}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.full_name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <Text style={styles.userDate}>Joined: {format(new Date(item.created_at), 'dd.MM.yyyy')}</Text>
        </View>
        <TouchableOpacity style={[styles.roleBadge, { backgroundColor: `${roleColor}15`, borderColor: roleColor }]} onPress={() => changeRole(item)}>
          <Text style={[styles.roleText, { color: roleColor }]}>{item.role}</Text>
          <Ionicons name="chevron-down" size={14} color={roleColor} />
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading) return <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={ORANGE} /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} data-testid="admin-users-title">{t('admin.users')}</Text>
        <Text style={styles.headerSub}>{users.length} total users</Text>
      </View>
      <FlatList data={users} keyExtractor={i => i.id} renderItem={renderUser}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); fetchUsers(); }} tintColor={ORANGE} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#1C1C1E' },
  headerSub: { fontSize: 15, color: '#8E8E93', marginTop: 4 },
  list: { paddingHorizontal: 16 },
  userCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  userAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { fontSize: 16, fontWeight: 'bold' },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  userEmail: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  userDate: { fontSize: 11, color: '#C7C7CC', marginTop: 2 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, gap: 4 },
  roleText: { fontSize: 12, fontWeight: '600' }
});
