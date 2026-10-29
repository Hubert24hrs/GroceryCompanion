import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootScreenProps } from '../navigation/navigation';
import { getDb } from '../data/db';
import { canAddMember, FREE_LIMITS } from '../domain/entitlements';
import { HouseholdMember, Invite, Role } from '../domain/types';
import { canInvite, canManageMembers, normalizeInviteCode, validateName } from '../domain/validation';
import { isBackendConfigured } from '../services/firebase';
import { useIsPro, useSession } from '../state/session';
import { toast, toastError } from '../state/toast';
import { Banner, Button, Card, Chip, EmptyState, Field, IconButton, Text } from '../ui/primitives';
import { layout } from '../ui/Screen';
import { ActionSheet, ConfirmSheet, Sheet } from '../ui/Sheet';
import { radius, spacing, useTheme } from '../ui/theme';
import { AuthMode, AuthSheet } from './settings/AuthSheet';

const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', editor: 'Can edit', viewer: 'View only' };

/** "ABCDE12345" → "ABCDE-12345" for reading aloud or typing. */
const prettyCode = (code: string) => (code.length === 10 ? `${code.slice(0, 5)}-${code.slice(5)}` : code);

export function HouseholdScreen({ navigation }: RootScreenProps<'Household'>) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const user = useSession(s => s.user);
    const linked = useSession(s => s.linked);
    const householdName = useSession(s => s.householdName);
    const role = useSession(s => s.role);
    const members = useSession(s => s.members);
    const memberships = useSession(s => s.memberships);
    const isPro = useIsPro();

    const [auth, setAuth] = useState<AuthMode | null>(null);
    const [invite, setInvite] = useState<Invite | null>(null);
    const [creating, setCreating] = useState<Role | null>(null);
    const [code, setCode] = useState('');
    const [codeError, setCodeError] = useState<string | null>(null);
    const [joining, setJoining] = useState(false);
    const [renaming, setRenaming] = useState<string | null>(null);
    const [memberMenu, setMemberMenu] = useState<HouseholdMember | null>(null);
    const [confirm, setConfirm] = useState<null | { title: string; message: string; label: string; run: () => Promise<void> }>(null);

    const session = useSession.getState;

    if (!isBackendConfigured || !user) {
        return (
            <View style={[styles.root, { backgroundColor: colors.background }]}>
                <ScrollView contentContainerStyle={styles.content}>
                    <Card>
                        <EmptyState
                            icon="people-outline"
                            title="Shop together"
                            message={
                                isBackendConfigured
                                    ? 'Sign in to share lists, pantry, recipes and the meal plan with your household. Everyone sees changes as they happen.'
                                    : "Sharing needs accounts, which aren't set up in this build. Everything you add is saved on this device."
                            }
                            action={isBackendConfigured ? 'Sign in' : undefined}
                            onAction={() => setAuth('signin')}
                        />
                    </Card>
                </ScrollView>
                <AuthSheet mode={auth} onClose={() => setAuth(null)} />
            </View>
        );
    }

    const memberCount = Math.max(members.length, 1);
    const inviteAllowed = canInvite(role);
    const atLimit = !canAddMember(isPro, memberCount);

    const createInvite = async (r: 'editor' | 'viewer') => {
        if (atLimit) {
            toast(`Free households have up to ${FREE_LIMITS.householdMembers} members.`, { tone: 'warning', actionLabel: 'See Pro', onAction: () => navigation.navigate('Pro') });
            return;
        }
        setCreating(r);
        try {
            setInvite(await session().createInvite(r));
        } catch (e) {
            toastError(e);
        } finally {
            setCreating(null);
        }
    };

    const shareInvite = async (inv: Invite) => {
        const message = `Join my GroceryCompanion household “${householdName}”: open the app, go to Settings → Household and enter code ${prettyCode(inv.code)}`;
        try {
            if (Platform.OS === 'web' && !(navigator as Navigator & { share?: unknown }).share) {
                await navigator.clipboard.writeText(message);
                toast('Invite copied. Paste it into a message.', { tone: 'success' });
            } else {
                await Share.share({ message });
            }
        } catch {
            // Share sheet dismissed.
        }
    };

    const join = async () => {
        const c = normalizeInviteCode(code);
        if (!c.ok) {
            setCodeError(c.error);
            return;
        }
        setJoining(true);
        try {
            await session().joinHousehold(c.value);
            setCode('');
            setCodeError(null);
            toast(`You joined ${useSession.getState().householdName}.`, { tone: 'success' });
        } catch (e) {
            setCodeError(e instanceof Error ? e.message : 'That code didn’t work.');
        } finally {
            setJoining(false);
        }
    };

    const memberActions = (m: HouseholdMember) => [
        ...(m.role !== 'editor'
            ? [{ label: 'Allow editing', icon: 'create-outline' as const, onPress: () => void session().setMemberRole(m.userId, 'editor').catch(toastError) }]
            : []),
        ...(m.role !== 'viewer'
            ? [{ label: 'Make view only', icon: 'eye-outline' as const, onPress: () => void session().setMemberRole(m.userId, 'viewer').catch(toastError) }]
            : []),
        {
            label: 'Remove from household',
            icon: 'person-remove-outline' as const,
            destructive: true,
            onPress: () =>
                setConfirm({
                    title: 'Remove member?',
                    message: `${m.displayName || m.email || 'This person'} will lose access to your household's lists, pantry and plans.`,
                    label: 'Remove',
                    run: () => session().removeMember(m.userId),
                }),
        },
    ];

    return (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
                {!linked ? <Banner tone="info" icon="cloud-offline-outline" message="Connecting to your household… sharing tools appear once you're online." /> : null}

                <Card style={{ gap: spacing.md }}>
                    <View style={styles.titleRow}>
                        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                            <Ionicons name="home" size={22} color={colors.onPrimary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text variant="heading">{householdName}</Text>
                            <Text variant="caption" muted>
                                {memberCount} member{memberCount === 1 ? '' : 's'}
                                {!isPro ? ` of ${FREE_LIMITS.householdMembers} on the free plan` : ''}
                            </Text>
                        </View>
                        {canManageMembers(role) && linked ? <IconButton icon="create-outline" label="Rename household" onPress={() => setRenaming(householdName)} color={colors.primary} /> : null}
                    </View>
                    {memberships.length > 1 ? (
                        <View style={{ gap: spacing.sm }}>
                            <Text variant="caption" muted>
                                You belong to {memberships.length} households:
                            </Text>
                            <View style={styles.chips}>
                                {memberships.map(m => (
                                    <Chip
                                        key={m.household.id}
                                        label={m.household.name}
                                        selected={m.household.id === getDb().householdId}
                                        onPress={() => void session().switchHousehold(m.household.id).catch(toastError)}
                                    />
                                ))}
                            </View>
                        </View>
                    ) : null}
                </Card>

                <View style={{ gap: spacing.sm }}>
                    <Text variant="subheading">Members</Text>
                    <Card style={{ padding: 0 }}>
                        {members.length === 0 ? (
                            <Text muted style={{ padding: spacing.lg }}>
                                Just you so far.
                            </Text>
                        ) : (
                            members.map((m, i) => {
                                const isMe = m.userId === user.id;
                                const name = m.displayName || m.email || 'Member';
                                return (
                                    <View key={m.userId} style={[styles.member, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                                        <View style={[styles.initial, { backgroundColor: colors.accentSoft }]}>
                                            <Text variant="label" color={colors.accent}>
                                                {name[0]?.toUpperCase()}
                                            </Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text numberOfLines={1}>
                                                {name}
                                                {isMe ? ' (you)' : ''}
                                            </Text>
                                            <Text variant="caption" muted>
                                                {ROLE_LABEL[m.role]}
                                            </Text>
                                        </View>
                                        {canManageMembers(role) && !isMe && m.role !== 'owner' ? (
                                            <IconButton icon="ellipsis-horizontal" label={`Options for ${name}`} onPress={() => setMemberMenu(m)} color={colors.textMuted} />
                                        ) : null}
                                    </View>
                                );
                            })
                        )}
                    </Card>
                </View>

                {inviteAllowed && linked ? (
                    <View style={{ gap: spacing.sm }}>
                        <Text variant="subheading">Invite someone</Text>
                        <Card style={{ gap: spacing.md }}>
                            {invite ? (
                                <View style={{ gap: spacing.md, alignItems: 'center' }}>
                                    <Text variant="caption" muted>
                                        {invite.role === 'editor' ? 'Can edit' : 'View only'} · works {invite.maxUses} times · expires{' '}
                                        {new Date(invite.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </Text>
                                    <Text selectable variant="title" style={styles.code} accessibilityLabel={`Invite code ${invite.code.split('').join(' ')}`}>
                                        {prettyCode(invite.code)}
                                    </Text>
                                    <View style={{ flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' }}>
                                        <Button title="Share" icon="share-outline" onPress={() => shareInvite(invite)} style={{ flex: 1 }} />
                                        <Button title="Done" variant="secondary" onPress={() => setInvite(null)} style={{ flex: 1 }} />
                                    </View>
                                </View>
                            ) : (
                                <>
                                    <Text variant="caption" muted>
                                        They’ll enter the code in their app under Settings → Household. Codes expire after a week.
                                    </Text>
                                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                                        <Button title="Can edit" icon="create-outline" loading={creating === 'editor'} onPress={() => createInvite('editor')} style={{ flex: 1 }} />
                                        <Button
                                            title="View only"
                                            icon="eye-outline"
                                            variant="secondary"
                                            loading={creating === 'viewer'}
                                            onPress={() => createInvite('viewer')}
                                            style={{ flex: 1 }}
                                        />
                                    </View>
                                </>
                            )}
                        </Card>
                    </View>
                ) : null}

                <View style={{ gap: spacing.sm }}>
                    <Text variant="subheading">Join a household</Text>
                    <Card style={{ gap: spacing.md }}>
                        <Text variant="caption" muted>
                            Got a code from someone? Joining switches this app to their household. You can switch back any time.
                        </Text>
                        <Field
                            value={code}
                            onChangeText={t => {
                                setCode(t.toUpperCase());
                                setCodeError(null);
                            }}
                            placeholder="ABCDE-12345"
                            autoCapitalize="characters"
                            autoCorrect={false}
                            accessibilityLabel="Invite code"
                            error={codeError}
                            onSubmitEditing={join}
                        />
                        <Button title="Join" icon="enter-outline" loading={joining} disabled={!code.trim() || !linked} onPress={join} />
                    </Card>
                </View>

                {role !== 'owner' && linked ? (
                    <Button
                        title="Leave this household"
                        icon="exit-outline"
                        variant="danger"
                        onPress={() =>
                            setConfirm({
                                title: 'Leave household?',
                                message: `You'll lose access to ${householdName}'s lists and plans. You'll go back to your own household.`,
                                label: 'Leave',
                                run: () => session().leaveHousehold(),
                            })
                        }
                    />
                ) : null}
            </ScrollView>

            <ActionSheet
                visible={!!memberMenu}
                onClose={() => setMemberMenu(null)}
                title={memberMenu?.displayName || memberMenu?.email || 'Member'}
                actions={memberMenu ? memberActions(memberMenu) : []}
            />
            <ConfirmSheet
                visible={!!confirm}
                onClose={() => setConfirm(null)}
                title={confirm?.title ?? ''}
                message={confirm?.message ?? ''}
                confirmLabel={confirm?.label ?? 'OK'}
                onConfirm={() => void confirm?.run().catch(toastError)}
            />
            <Sheet
                visible={renaming != null}
                onClose={() => setRenaming(null)}
                title="Rename household"
                footer={
                    <Button
                        title="Save"
                        onPress={() => {
                            const n = validateName(renaming ?? '', 'Name', 60);
                            if (!n.ok) {
                                toast(n.error, { tone: 'warning' });
                                return;
                            }
                            setRenaming(null);
                            session().renameHousehold(n.value).catch(toastError);
                        }}
                    />
                }
            >
                <Field label="Name" value={renaming ?? ''} onChangeText={setRenaming} autoFocus />
            </Sheet>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.xl, ...layout.page },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    avatar: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    member: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
    initial: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    code: { letterSpacing: 3, fontVariant: ['tabular-nums'] },
});
