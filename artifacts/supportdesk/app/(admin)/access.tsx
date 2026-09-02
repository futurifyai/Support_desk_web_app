import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminUsersQueryKey,
  getGetAdminUserProductsQueryKey,
  useCreateAdminUser,
  useCreateAdminUserProduct,
  useDeleteAdminUserProduct,
  useGetAdminUserProducts,
  useGetAdminUsers,
  useGetDistinctProductNames,
  useUpdateAdminUserProduct,
  type AdminUser,
  type UserProduct,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import AdminHeader, { AdminHeaderIconButton } from "@/components/AdminHeader";
import BottomNav, { NavTab } from "@/components/BottomNav";

const ADMIN_TABS: NavTab[] = [
  { key: "dashboard", label: "Tickets", icon: "grid", iconActive: "grid" },
  { key: "analytics", label: "Insights", icon: "bar-chart-2", iconActive: "bar-chart-2" },
  { key: "user-stats", label: "Users", icon: "users", iconActive: "users" },
  { key: "access", label: "Access", icon: "key", iconActive: "key" },
  { key: "audit-log", label: "Audit", icon: "shield", iconActive: "shield" },
];

function errorMessage(error: unknown, fallback: string) {
  const value = error as { response?: { data?: { message?: string } }; message?: string };
  return value.response?.data?.message ?? value.message ?? fallback;
}

function toDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "—";
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (
      date.getFullYear() === Number(match[1]) &&
      date.getMonth() === Number(match[2]) - 1 &&
      date.getDate() === Number(match[3])
    ) {
      return date;
    }
  }
  return new Date();
}

function formatDisplayDate(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = toDateInput(value).split("-").map(Number);
  if (!year || !month || !day) return null;
  const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1];
  return `${String(day).padStart(2, "0")} ${monthName} '${String(year).slice(-2)}`;
}

function formatDateRange(startDate?: string | null, endDate?: string | null) {
  const start = formatDisplayDate(startDate);
  const end = formatDisplayDate(endDate);
  if (!start && !end) return "No date limits";
  return `${start ?? "No start"} – ${end ?? "No end"}`;
}

function makePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function DateField({
  label,
  value,
  onChange,
  styles,
  colors,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  styles: ReturnType<typeof panelStyles>;
  colors: ReturnType<typeof useColors>;
}) {
  const [isPickerVisible, setPickerVisible] = useState(false);
  const selectedDate = parseDateValue(value);

  return (
    <View style={styles.dateField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {Platform.OS === "web" ? (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="numbers-and-punctuation"
          style={styles.input}
          accessibilityLabel={`${label} date, format YYYY-MM-DD`}
        />
      ) : (
        <>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setPickerVisible(true)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${label} date${value ? `, ${value}` : ", not set"}`}
          >
            <Text style={[styles.dateButtonText, !value && styles.datePlaceholder]}>{value || "Select date"}</Text>
            <Feather name="calendar" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
          {isPickerVisible ? (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={(event, date) => {
                setPickerVisible(false);
                if (event.type !== "dismissed" && date) onChange(formatDateValue(date));
              }}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

function ProductAccessPanel({ user }: { user: AdminUser }) {
  const colors = useColors();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useGetAdminUserProducts(user.id);
  const { data: productNamesData } = useGetDistinctProductNames();
  const addProduct = useCreateAdminUserProduct();
  const updateProduct = useUpdateAdminUserProduct();
  const removeProduct = useDeleteAdminUserProduct();
  const [productName, setProductName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editError, setEditError] = useState("");
  const [alsoReapprove, setAlsoReapprove] = useState(false);
  const { width } = useWindowDimensions();
  const products = (data?.data ?? []) as UserProduct[];
  const suggestions = (productNamesData?.data ?? []).filter((name) =>
    productName.trim().length > 0 && name.toLowerCase().includes(productName.trim().toLowerCase()) && name !== productName,
  ).slice(0, 4);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: getGetAdminUserProductsQueryKey(user.id) });
  }

  async function handleAddProduct() {
    setError("");
    if (productName.trim().length < 2) {
      setError("Enter a product name of at least 2 characters.");
      return;
    }
    try {
      await addProduct.mutateAsync({
        userId: user.id,
        data: {
          productName: productName.trim(),
          ...(startDate.trim() ? { startDate: startDate.trim() } : {}),
          ...(endDate.trim() ? { endDate: endDate.trim() } : {}),
        },
      });
      setProductName("");
      setStartDate("");
      setEndDate("");
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Unable to add product access."));
    }
  }

  async function changeStatus(product: UserProduct, status: "approved" | "disapproved") {
    setError("");
    if (status === "approved" && product.endDate && isPastEndDate(toDateInput(product.endDate))) {
      startEditing(product);
      setEditError("This product's end date has already passed. Please set a new end date to approve it.");
      return;
    }
    try {
      await updateProduct.mutateAsync({ userId: user.id, productId: product.id, data: { status } });
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Unable to update product access."));
    }
  }

  function startEditing(product: UserProduct) {
    setEditingProductId(product.id);
    setEditStartDate(product.startDate ? toDateInput(product.startDate) : "");
    setEditEndDate(product.endDate ? toDateInput(product.endDate) : "");
    setEditError("");
    setAlsoReapprove(false);
  }

  function cancelEditing() {
    setEditingProductId(null);
    setEditStartDate("");
    setEditEndDate("");
    setEditError("");
    setAlsoReapprove(false);
  }

  function isPastEndDate(value: string) {
    return Boolean(value) && new Date(`${value}T23:59:59.999Z`).getTime() < Date.now();
  }

  function isFutureEndDate(value: string) {
    return Boolean(value) && new Date(`${value}T23:59:59.999Z`).getTime() > Date.now();
  }

  async function saveDateEdits(product: UserProduct) {
    setError("");
    setEditError("");
    if (editStartDate && editEndDate && editEndDate <= editStartDate) {
      setEditError("End date must be after the start date.");
      return;
    }

    const canReapprove = (product.status === "expired" || product.status === "disapproved")
      && isFutureEndDate(editEndDate);
    try {
      await updateProduct.mutateAsync({
        userId: user.id,
        productId: product.id,
        data: {
          startDate: editStartDate || null,
          endDate: editEndDate || null,
          ...(alsoReapprove && canReapprove ? { status: "approved" } : {}),
        },
      });
      cancelEditing();
      await refresh();
    } catch (err) {
      setEditError(errorMessage(err, "Unable to update product dates."));
    }
  }

  async function deleteProduct(product: UserProduct) {
    setError("");
    try {
      await removeProduct.mutateAsync({ userId: user.id, productId: product.id });
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Unable to remove product access."));
    }
  }

  const s = panelStyles(colors, isDark);
  const isCompact = width < 480;
  return (
    <View style={s.panel}>
      <Text style={s.panelTitle}>Product access</Text>
      <Text style={s.panelHint}>New products start pending until an administrator approves them.</Text>
      {error ? <Text style={s.error}>{error}</Text> : null}

      <View style={s.addCard}>
        <TextInput
          value={productName}
          onChangeText={setProductName}
          placeholder="Product name"
          placeholderTextColor={colors.mutedForeground}
          style={s.input}
        />
        {suggestions.length > 0 ? (
          <View style={s.suggestions}>
            {suggestions.map((name) => (
              <TouchableOpacity key={name} style={s.suggestion} onPress={() => setProductName(name)}>
                <Feather name="corner-down-right" size={12} color={colors.primary} />
                <Text style={s.suggestionText}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        <View style={[s.dateRow, isCompact && s.dateRowCompact]}>
          <DateField label="Start date" value={startDate} onChange={setStartDate} styles={s} colors={colors} />
          <DateField label="End date" value={endDate} onChange={setEndDate} styles={s} colors={colors} />
        </View>
        <TouchableOpacity style={[s.addButton, addProduct.isPending && { opacity: 0.6 }]} onPress={() => void handleAddProduct()} disabled={addProduct.isPending}>
          {addProduct.isPending ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <><Feather name="plus" size={15} color={colors.primaryForeground} /><Text style={s.addButtonText}>Add product</Text></>}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={s.loading}><ActivityIndicator color={colors.primary} /><Text style={s.panelHint}>Loading access…</Text></View>
      ) : isError ? (
        <TouchableOpacity style={s.retry} onPress={() => refetch()}><Text style={s.retryText}>Couldn’t load products. Try again</Text></TouchableOpacity>
      ) : products.length === 0 ? (
        <View style={s.empty}><Feather name="package" size={20} color={colors.mutedForeground} /><Text style={s.panelHint}>No products assigned yet.</Text></View>
      ) : products.map((product) => {
        const color = product.status === "approved"
          ? colors.success
          : product.status === "disapproved"
            ? colors.destructive
            : product.status === "expired"
              ? "#F59E0B"
              : colors.warning;
        const isEditing = editingProductId === product.id;
        const canShowReapprove = (product.status === "expired" || product.status === "disapproved")
          && isFutureEndDate(editEndDate);
        return (
          <View key={product.id} style={[s.productRow, isCompact && s.productRowCompact]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.productTop}>
                <Text style={s.productName} numberOfLines={1}>{product.productName}</Text>
                <View style={[s.statusBadge, { backgroundColor: `${color}1C` }]}>
                  <Text style={[s.statusText, { color }]}>{product.status === "expired" ? "Expired" : product.status}</Text>
                </View>
              </View>
              <Text style={s.dates}>{formatDateRange(product.startDate, product.endDate)}</Text>
              {isEditing ? (
                <View style={s.editCard}>
                  <Text style={s.editTitle}>Edit access dates</Text>
                  <View style={[s.dateRow, isCompact && s.dateRowCompact]}>
                    <DateField label="Start date" value={editStartDate} onChange={setEditStartDate} styles={s} colors={colors} />
                    <DateField label="End date" value={editEndDate} onChange={setEditEndDate} styles={s} colors={colors} />
                  </View>
                  {editError ? <Text style={s.error}>{editError}</Text> : null}
                  {product.status === "approved" && isPastEndDate(editEndDate) ? (
                    <Text style={s.warning}>This end date is in the past — access will remain or become expired.</Text>
                  ) : null}
                  {canShowReapprove ? (
                    <TouchableOpacity
                      style={s.reapproveToggle}
                      onPress={() => setAlsoReapprove((value) => !value)}
                      activeOpacity={0.75}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: alsoReapprove }}
                    >
                      <Feather name={alsoReapprove ? "check-square" : "square"} size={17} color={colors.success} />
                      <Text style={s.reapproveText}>Also re-approve with these new dates</Text>
                    </TouchableOpacity>
                  ) : null}
                  <View style={s.editActions}>
                    <TouchableOpacity style={s.editCancelButton} onPress={cancelEditing} disabled={updateProduct.isPending}>
                      <Text style={s.editCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.editSaveButton, updateProduct.isPending && { opacity: 0.6 }]}
                      onPress={() => void saveDateEdits(product)}
                      disabled={updateProduct.isPending}
                    >
                      {updateProduct.isPending
                        ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                        : <Text style={s.editSaveText}>Save</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
            <View style={[s.actions, isCompact && s.actionsCompact]}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Edit product dates"
                hitSlop={4}
                style={s.actionButton}
                onPress={() => startEditing(product)}
              >
                <Feather name="edit-2" size={14} color={colors.primary} />
              </TouchableOpacity>
              {product.status !== "approved" ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Approve product"
                  hitSlop={4}
                  style={[s.actionButton, { borderColor: `${colors.success}55` }]}
                  onPress={() => void changeStatus(product, "approved")}
                >
                  <Feather name="check" size={15} color={colors.success} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Disapprove product"
                hitSlop={4}
                style={[s.actionButton, { borderColor: `${colors.destructive}55` }]}
                onPress={() => void changeStatus(product, "disapproved")}
              >
                <Feather name="x" size={15} color={colors.destructive} />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Delete product"
                hitSlop={4}
                style={s.actionButton}
                onPress={() => void deleteProduct(product)}
              >
                <Feather name="trash-2" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function AccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(makePassword());
  const [createError, setCreateError] = useState("");
  const createUser = useCreateAdminUser();
  const { data, isLoading, isRefetching, refetch } = useGetAdminUsers({ search: search.trim() || undefined, page, pageSize: 20 });
  const users = (data?.data ?? []) as AdminUser[];
  const meta = data?.meta;
  const s = styles(colors, isDark);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function handleCreateUser() {
    setCreateError("");
    if (name.trim().length < 2 || !email.includes("@") || password.length < 8) {
      setCreateError("Enter a name, a valid email, and a password with at least 8 characters.");
      return;
    }
    try {
      const result = await createUser.mutateAsync({ data: { name: name.trim(), email: email.trim(), password } });
      if (result.data) {
        setCreatedCredentials({ email: result.data.user.email, password: result.data.temporaryPassword });
      }
      setShowCreate(false);
      setName("");
      setEmail("");
      setPassword(makePassword());
      await queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });
    } catch (err) {
      setCreateError(errorMessage(err, "Unable to create the user."));
    }
  }

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <AdminHeader
        title="Access Control"
        subtitle="Manage product access and approvals"
        rightActions={
          <AdminHeaderIconButton
            icon="user-plus"
            accessibilityLabel="Create customer account"
            onPress={() => { setCreateError(""); setShowCreate(true); }}
          />
        }
      />
      <View style={s.searchRow}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} placeholder="Search users by name or email" placeholderTextColor={colors.mutedForeground} style={s.searchInput} />
        {search ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear user search" onPress={() => setSearch("")}><Feather name="x-circle" size={16} color={colors.mutedForeground} /></TouchableOpacity> : null}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
      >
        {isLoading ? <View style={s.center}><ActivityIndicator color={colors.primary} /><Text style={s.muted}>Loading users…</Text></View>
          : users.length === 0 ? <View style={s.center}><Feather name="users" size={36} color={colors.border} /><Text style={s.muted}>No users found.</Text></View>
          : users.map((user) => {
            const expanded = expandedUserId === user.id;
            return (
              <View key={user.id} style={s.userCard}>
                <TouchableOpacity style={s.userHeader} onPress={() => setExpandedUserId(expanded ? null : user.id)} activeOpacity={0.75}>
                  <View style={s.avatar}><Text style={s.avatarText}>{user.name[0]?.toUpperCase() ?? "U"}</Text></View>
                  <View style={{ flex: 1, minWidth: 0 }}><Text style={s.userName} numberOfLines={1}>{user.name}</Text><Text style={s.userEmail} numberOfLines={1}>{user.email}</Text></View>
                  <View style={s.roleBadge}><Text style={s.roleText}>{user.role}</Text></View>
                  <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
                {expanded ? <ProductAccessPanel user={user} /> : null}
              </View>
            );
          })}
        {users.length > 0 ? (
          <View style={s.pagination}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Previous page"
              disabled={page <= 1}
              onPress={() => setPage((current) => current - 1)}
              style={[s.pageButton, page <= 1 && s.disabled]}
            >
              <Feather name="chevron-left" size={15} color={colors.primary} />
              <Text style={s.pageText}>Previous</Text>
            </TouchableOpacity>
            <Text style={s.pageLabel}>Page {meta?.page ?? page} of {meta?.totalPages ?? 1}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Next page"
              disabled={!meta || page >= meta.totalPages}
              onPress={() => setPage((current) => current + 1)}
              style={[s.pageButton, (!meta || page >= meta.totalPages) && s.disabled]}
            >
              <Text style={s.pageText}>Next</Text>
              <Feather name="chevron-right" size={15} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <BottomNav tabs={ADMIN_TABS} activeKey="access" onPress={(key) => {
        if (key === "dashboard") router.navigate("/(admin)/dashboard" as never);
        if (key === "analytics") router.navigate("/(admin)/analytics" as never);
        if (key === "user-stats") router.navigate("/(admin)/user-stats" as never);
        if (key === "audit-log") router.navigate("/(admin)/audit-log" as never);
      }} />

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={s.modalBackdrop}><View style={s.modalCard}>
          <View style={s.modalTitleRow}><Text style={s.modalTitle}>Create customer</Text><TouchableOpacity onPress={() => setShowCreate(false)}><Feather name="x" size={20} color={colors.mutedForeground} /></TouchableOpacity></View>
          {createError ? <Text style={s.error}>{createError}</Text> : null}
          <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.mutedForeground} style={s.modalInput} />
          <TextInput value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={colors.mutedForeground} style={s.modalInput} />
          <View style={s.passwordRow}><TextInput value={password} onChangeText={setPassword} placeholder="Temporary password" placeholderTextColor={colors.mutedForeground} style={[s.modalInput, { flex: 1, marginBottom: 0 }]} /><TouchableOpacity style={s.generateButton} onPress={() => setPassword(makePassword())}><Feather name="refresh-cw" size={15} color={colors.primary} /></TouchableOpacity></View>
          <Text style={s.passwordHint}>Generate a secure temporary password. It will be shown once after account creation.</Text>
          <TouchableOpacity style={[s.createButton, createUser.isPending && { opacity: 0.6 }]} onPress={() => void handleCreateUser()} disabled={createUser.isPending}>{createUser.isPending ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={s.createButtonText}>Create account</Text>}</TouchableOpacity>
        </View></View>
      </Modal>

      <Modal visible={Boolean(createdCredentials)} transparent animationType="fade" onRequestClose={() => setCreatedCredentials(null)}>
        <View style={s.modalBackdrop}><View style={s.modalCard}>
          <Feather name="shield" size={28} color={colors.success} />
          <Text style={s.modalTitle}>Share credentials securely</Text>
          <Text style={s.muted}>This temporary password is displayed only now. Ask the customer to change it after their first sign-in.</Text>
          <View style={s.credentialBox}><Text style={s.credentialLabel}>EMAIL</Text><Text style={s.credentialValue}>{createdCredentials?.email}</Text><Text style={s.credentialLabel}>TEMPORARY PASSWORD</Text><Text selectable style={s.credentialValue}>{createdCredentials?.password}</Text></View>
          <TouchableOpacity style={s.createButton} onPress={() => setCreatedCredentials(null)}><Text style={s.createButtonText}>I’ve saved these credentials</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </View>
  );
}

function panelStyles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
    panel: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
    panelTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground },
    panelHint: { fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    error: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.destructive },
    addCard: { gap: 8, padding: 11, borderRadius: 10, backgroundColor: `${colors.primary}${isDark ? "14" : "0A"}`, borderWidth: 1, borderColor: colors.border },
    input: { height: 40, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.input, color: colors.foreground, fontSize: 12, fontFamily: "Inter_400Regular" },
    dateRow: { flexDirection: "row", gap: 8 }, dateRowCompact: { flexDirection: "column" }, dateField: { flex: 1, minWidth: 0, gap: 4 }, fieldLabel: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
    dateButton: { height: 40, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.input, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }, dateButtonText: { flex: 1, color: colors.foreground, fontSize: 12, fontFamily: "Inter_400Regular" }, datePlaceholder: { color: colors.mutedForeground },
    suggestions: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: "hidden", backgroundColor: colors.card },
    suggestion: { flexDirection: "row", gap: 7, alignItems: "center", padding: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
    suggestionText: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.foreground },
    addButton: { height: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, backgroundColor: colors.primary },
    addButtonText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.primaryForeground },
    loading: { alignItems: "center", paddingVertical: 12, gap: 7 }, empty: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
    retry: { padding: 10, borderRadius: 8, backgroundColor: colors.secondary }, retryText: { color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: "center" },
    productRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 10, borderRadius: 9, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }, productRowCompact: { flexDirection: "column" },
    productTop: { flexDirection: "row", alignItems: "center", gap: 7 }, productName: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    statusBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5 }, statusText: { fontSize: 10, textTransform: "capitalize", fontFamily: "Inter_600SemiBold" },
    dates: { fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 4 },
    editCard: { marginTop: 10, gap: 8, padding: 10, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    editTitle: { fontSize: 11, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    warning: { fontSize: 11, lineHeight: 16, color: "#F59E0B", fontFamily: "Inter_500Medium" },
    reapproveToggle: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 2 },
    reapproveText: { flex: 1, fontSize: 11, lineHeight: 16, color: colors.foreground, fontFamily: "Inter_500Medium" },
    editActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
    editCancelButton: { minHeight: 32, paddingHorizontal: 12, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 7 },
    editCancelText: { color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_600SemiBold" },
    editSaveButton: { minHeight: 32, minWidth: 68, paddingHorizontal: 12, justifyContent: "center", alignItems: "center", borderRadius: 7, backgroundColor: colors.primary },
    editSaveText: { color: colors.primaryForeground, fontSize: 12, fontFamily: "Inter_600SemiBold" },
    actions: { flexDirection: "row", gap: 8 }, actionsCompact: { alignSelf: "flex-end" }, actionButton: { width: 36, height: 36, borderRadius: 9, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  });
}

function styles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    searchRow: { marginTop: 14, marginHorizontal: 14, marginBottom: 6, height: 44, flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 12, backgroundColor: colors.card },
    searchInput: { flex: 1, minWidth: 0, color: colors.foreground, fontSize: 13, fontFamily: "Inter_400Regular" }, scroll: { flex: 1 }, content: { paddingTop: 8, paddingHorizontal: 14, gap: 9 },
    center: { alignItems: "center", paddingVertical: 50, gap: 10 }, muted: { fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    userCard: { overflow: "hidden", borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.card },
    userHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13 }, avatar: { width: 36, height: 36, borderRadius: 11, backgroundColor: `${colors.primary}${isDark ? "40" : "1F"}`, alignItems: "center", justifyContent: "center" },
    avatarText: { color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 15 }, userName: { fontSize: 14, color: colors.foreground, fontFamily: "Inter_600SemiBold" }, userEmail: { marginTop: 2, fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    roleBadge: { paddingHorizontal: 6, paddingVertical: 3, backgroundColor: colors.secondary, borderRadius: 5 }, roleText: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
    pagination: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingBottom: 4 }, pageButton: { flexDirection: "row", alignItems: "center", gap: 3, padding: 9, minHeight: 36 }, pageText: { fontSize: 12, color: colors.primary, fontFamily: "Inter_600SemiBold" }, pageLabel: { fontSize: 11, color: colors.foreground, fontFamily: "Inter_500Medium" }, disabled: { opacity: 0.35 },
    modalBackdrop: { flex: 1, backgroundColor: `${colors.background}B8`, justifyContent: "center", padding: 20 }, modalCard: { borderRadius: 16, gap: 13, padding: 19, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, maxWidth: 460, width: "100%", alignSelf: "center" },
    modalTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, modalTitle: { fontSize: 18, color: colors.foreground, fontFamily: "Inter_700Bold" }, modalInput: { height: 45, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 12, fontSize: 13, color: colors.foreground, backgroundColor: colors.input, fontFamily: "Inter_400Regular" },
    passwordRow: { flexDirection: "row", gap: 8, alignItems: "center" }, generateButton: { width: 45, height: 45, borderWidth: 1, borderColor: colors.border, borderRadius: 9, alignItems: "center", justifyContent: "center" }, passwordHint: { marginTop: -7, fontSize: 11, lineHeight: 16, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    createButton: { height: 46, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary }, createButtonText: { color: colors.primaryForeground, fontSize: 14, fontFamily: "Inter_600SemiBold" },
    error: { padding: 9, borderRadius: 8, backgroundColor: `${colors.destructive}${isDark ? "21" : "0F"}`, color: colors.destructive, fontSize: 12, fontFamily: "Inter_400Regular" },
    credentialBox: { gap: 5, borderRadius: 10, padding: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary }, credentialLabel: { marginTop: 4, fontSize: 10, letterSpacing: 0.8, color: colors.mutedForeground, fontFamily: "Inter_700Bold" }, credentialValue: { fontSize: 13, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
  });
}