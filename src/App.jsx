import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Activity, Archive, ArrowDownToLine, ArrowRight, BadgeCheck, BriefcaseBusiness, CalendarDays,
  Check, ChevronDown, ClipboardList, Eye, EyeOff, FileText, HardHat, KeyRound, LayoutDashboard,
  LockKeyhole, LogOut, Mail, MailPlus, MapPin, Minus, Package, Plus, Printer, RotateCcw, Search,
  Settings, ShieldCheck, Trash2, Users, Wrench, X,
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseConfigError = !supabaseUrl || !supabaseAnonKey;
const supabase = supabaseConfigError ? null : createClient(supabaseUrl, supabaseAnonKey);

const roles = {
  administrator: 'Administrator',
  field_technician: 'Field Technician',
};
const roleEmails = {
  administrator: 'christopherandal@ceacompany.com',
  field_technician: 'technicianstaff@ceacompany.com',
};
const appPasswordResetEmailKey = 'cea-opsgrid-password-reset-email';
const DEFAULT_SUPPLIER = 'Bright Light Electrical Supply';
const COMPANY = {
  name: 'CEA CCTV INSTALLATION SERVICES',
  address: 'BLK 4 LOT 4 BENEDICT HEIGHTS, TUGBOK PROPER DAVAO CITY',
  phone: 'TEL. NO. 228-36-06/09358897324',
  email: 'christopherandal@ceacompany.com',
  checkedBy: 'CHRISTOPHER C. ANDAL',
  checkedByTitle: 'G. MANAGER',
};
const tabsByRole = {
  administrator: [
    ['dashboard', 'Overview', LayoutDashboard], ['workorders', 'Work Orders', ClipboardList],
    ['inventory', 'Inventory Tracking', Package], ['quotations', 'Quotations', FileText],
    ['employees', 'Employees', Users], ['settings', 'Account Settings', Settings],
  ],
  field_technician: [
    ['dashboard', 'My Dashboard', LayoutDashboard], ['workorders', 'My Work Orders', ClipboardList],
    ['schedule', 'Team Schedule', CalendarDays],
    ['settings', 'Account Settings', Settings],
  ],
};
const money = (value) => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'N/A');
const formatDateTime = (value) => (value ? new Date(value).toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'N/A');
const formatTime = (value) => {
  if (!value) return '';
  const [h, m] = String(value).split(':');
  if (h == null) return value;
  const hour = Number(h);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m || '00'} ${suffix}`;
};
const formatQty = (qty, unit) => {
  const safeQty = Number(qty ?? 0);
  const safeUnit = String(unit || '').trim() || 'pcs';
  return `${safeQty} ${safeUnit}`;
};
const todayISO = () => new Date().toISOString().slice(0, 10);
async function addAvatarUrl(record) {
  if (!record?.avatar_path) return record;
  const { data } = await supabase.storage.from('profile-photos').createSignedUrl(record.avatar_path, 3600);
  return { ...record, avatar_url: data?.signedUrl || null };
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [loginRole, setLoginRole] = useState('administrator');
  const [loginEmail, setLoginEmail] = useState(roleEmails.administrator);
  const [resetEmail, setResetEmail] = useState(() => {
    try { return localStorage.getItem(appPasswordResetEmailKey) || ''; } catch { return ''; }
  });
  const [tab, setTab] = useState('dashboard');
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [teamSchedule, setTeamSchedule] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [printingQuote, setPrintingQuote] = useState(null);
  const [previewQuote, setPreviewQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All statuses');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState('all');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [quotationSearch, setQuotationSearch] = useState('');
  const [hardwareRows, setHardwareRows] = useState([{ item_name: '', quantity: 1, unit: 'pcs' }]);
  const [customSupplier, setCustomSupplier] = useState(false);
  const [quoteRows, setQuoteRows] = useState([{ description: '', quantity: 1, unit: 'pcs', unit_cost: 0 }]);

  const role = profile?.role;
  const displayName = profile?.full_name || session?.user?.email || 'Account';

  const loadWorkspace = useCallback(async () => {
    if (!session?.user || !supabase) return;
    setBusy(true);
    setProfileLoading(true);
    setMessage('');
    const [profileResult, invResult, orderResult, employeeResult, quoteResult, txnResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      supabase.from('inventory').select('*').order('item_name'),
      supabase.from('work_orders').select('*, work_order_assignments(employee_id, employees(id, full_name, job_title, auth_user_id)), work_order_materials(id, item_name, quantity, unit)').order('created_at', { ascending: false }),
      supabase.from('employees').select('*').order('full_name'),
      supabase.from('quotations').select('*, quotation_items(*)').order('created_at', { ascending: false }),
      supabase.from('inventory_transactions').select('*').order('created_at', { ascending: false }).limit(1000),
    ]);
    if (profileResult.error) setMessage(`Could not load account profile: ${profileResult.error.message}`);
    else setProfile(await addAvatarUrl(profileResult.data));
    if (invResult.data) setInventory(invResult.data);
    if (orderResult.data) setOrders(orderResult.data);
    if (employeeResult.data) setEmployees(await Promise.all(employeeResult.data.map(addAvatarUrl)));
    if (quoteResult.data) setQuotations(quoteResult.data);
    if (txnResult.data) setTransactions(txnResult.data);
    if (profileResult.data?.role === 'field_technician') {
      const scheduleResult = await supabase.rpc('team_schedule');
      if (scheduleResult.error) setMessage(`Team schedule could not be loaded: ${scheduleResult.error.message}`);
      else setTeamSchedule(scheduleResult.data || []);
    }
    const error = [invResult, orderResult, employeeResult, quoteResult].find((result) => result.error);
    if (error && !profileResult.error) setMessage(`Some records could not be loaded: ${error.error.message}. Apply the Supabase migration if you have not already.`);
    setBusy(false);
    setProfileLoading(false);
  }, [session]);

  useEffect(() => {
    if (supabaseConfigError) {
      setProfileLoading(false);
      return undefined;
    }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setProfileLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); if (!nextSession) { setProfile(null); setProfileLoading(false); } else setProfileLoading(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session) loadWorkspace(); }, [session, loadWorkspace]);
  useEffect(() => { setTab('dashboard'); }, [role]);
  useEffect(() => {
    const savedResetEmail = (() => { try { return localStorage.getItem(appPasswordResetEmailKey) || ''; } catch { return ''; } })();
    setResetEmail(savedResetEmail || session?.user?.email || '');
  }, [session?.user?.email]);
  useEffect(() => {
    if (!printingQuote) return undefined;
    const printTimer = window.setTimeout(() => window.print(), 80);
    const clearPrintedQuote = () => setPrintingQuote(null);
    window.addEventListener('afterprint', clearPrintedQuote);
    return () => {
      window.clearTimeout(printTimer);
      window.removeEventListener('afterprint', clearPrintedQuote);
    };
  }, [printingQuote]);

  const addHardwareRow = () => setHardwareRows((rows) => [...rows, { item_name: '', quantity: 1, unit: 'pcs' }]);
  const updateHardwareRow = (index, field, value) =>
    setHardwareRows((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  const removeHardwareRow = (index) =>
    setHardwareRows((rows) => rows.filter((_, i) => i !== index));
  const resetHardwareRows = (rows = [{ item_name: '', quantity: 1, unit: 'pcs' }]) => setHardwareRows(rows);

  const addQuoteRow = () => setQuoteRows((rows) => [...rows, { description: '', quantity: 1, unit: 'pcs', unit_cost: 0 }]);
  const updateQuoteRow = (index, field, value) =>
    setQuoteRows((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  const removeQuoteRow = (index) =>
    setQuoteRows((rows) => rows.filter((_, i) => i !== index));
  const resetQuoteRows = (rows = [{ description: '', quantity: 1, unit: 'pcs', unit_cost: 0 }]) => setQuoteRows(rows);

  async function requestPasswordReset() {
    const targetEmail = (resetEmail || session?.user?.email || '').trim();
    if (!targetEmail) {
      setMessage('Set a password reset email in Account Settings before requesting a reset.');
      return;
    }
    try { localStorage.setItem(appPasswordResetEmailKey, targetEmail); } catch {}
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, { redirectTo: window.location.origin });
    setBusy(false);
    if (error) setMessage(error.message);
    else setMessage(`Password reset email sent to ${targetEmail}.`);
  }

  async function sendSignInLink(email, note = '') {
    const target = String(email || '').trim();
    if (!target) {
      setMessage('Enter an email address first.');
      return false;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(target, { redirectTo: window.location.origin });
    setBusy(false);
    if (error) { setMessage(error.message); return false; }
    setMessage(`Password setup email sent to ${target}.${note ? ' ' + note : ''}`);
    return true;
  }

  async function signIn(event) {
    event.preventDefault();
    setBusy(true); setMessage('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    const { data: account, error: accountError } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
    if (accountError || !account || account.role !== loginRole) {
      setMessage(accountError
        ? `Could not verify this account: ${accountError.message}`
        : account ? 'The selected role does not match this account.' : 'This account has no assigned role. Ask the administrator to assign one.');
      await supabase.auth.signOut();
      setBusy(false);
      return;
    }

    setBusy(false);
  }
  async function signOut() { await supabase.auth.signOut(); setProfile(null); }
  async function saveRecord(table, values, id) {
    const query = id ? supabase.from(table).update(values).eq('id', id) : supabase.from(table).insert(values);
    const { error } = await query;
    if (error) { setMessage(error.message); return false; }
    setModal(null); setSelectedOrder(null); await loadWorkspace(); return true;
  }
  async function deleteOrder(order) {
    if (!window.confirm(`Delete the work order for ${order.client_name}?`)) return;
    const { error } = await supabase.from('work_orders').delete().eq('id', order.id);
    if (error) setMessage(error.message); else { setSelectedOrder(null); await loadWorkspace(); }
  }
  async function setOrderStatus(order, status) { await saveRecord('work_orders', { status }, order.id); }
  async function addInventory(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = Object.fromEntries(['item_name', 'category', 'unit', 'supplier'].map((key) => [key, data.get(key) || null]));
    values.unit = String(values.unit || '').trim() || 'pcs';
    values.unit_cost = Number(data.get('unit_cost') || 0);
    values.stock_qty = Number(data.get('stock_qty') || 0);
    values.reorder_level = Number(data.get('reorder_level') || 1);
    values.archived = false;
    const { data: inserted, error } = await supabase.from('inventory').insert(values).select('id').single();
    if (error) { setMessage(error.message); return; }
    if (values.stock_qty > 0) {
      const { error: transactionError } = await supabase.from('inventory_transactions').insert({ inventory_item_id: inserted.id, quantity: values.stock_qty, transaction_type: 'received', notes: 'Initial stock entry' });
      if (transactionError) { setMessage(`Item was added, but initial stock history failed: ${transactionError.message}`); await loadWorkspace(); return; }
    }
    setModal(null); setCustomSupplier(false); await loadWorkspace();
  }
  async function editInventory(event, item) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = Object.fromEntries(['item_name', 'category', 'unit', 'supplier'].map((key) => [key, data.get(key) || null]));
    values.unit = String(values.unit || '').trim() || 'pcs';
    values.unit_cost = Number(data.get('unit_cost') || 0);
    values.reorder_level = Number(data.get('reorder_level') || 1);
    const { error } = await supabase.from('inventory').update(values).eq('id', item.id);
    if (error) setMessage(error.message); else { setModal(null); setCustomSupplier(false); await loadWorkspace(); }
  }
  async function archiveInventory(item) {
    if (!window.confirm(`Archive "${item.item_name}"? It will be hidden from the list but history is kept.`)) return;
    const { error } = await supabase.rpc('archive_inventory', { item_id: item.id });
    if (error) setMessage(error.message); else { setMessage(`"${item.item_name}" archived.`); setModal(null); await loadWorkspace(); }
  }
  async function restoreInventory(item) {
    const { error } = await supabase.rpc('restore_inventory', { item_id: item.id });
    if (error) setMessage(error.message); else { setMessage(`"${item.item_name}" restored.`); setModal(null); await loadWorkspace(); }
  }
  async function forceDeleteInventory(item) {
    if (!window.confirm(`Permanently delete "${item.item_name}" AND all its stock history? This cannot be undone.`)) return;
    if (!window.confirm(`Are you absolutely sure? This is your last chance.`)) return;
    const { error } = await supabase.rpc('force_delete_inventory', { item_id: item.id });
    if (error) setMessage(error.message); else { setMessage(`"${item.item_name}" permanently deleted.`); setModal(null); await loadWorkspace(); }
  }
  async function receiveStock(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const id = data.get('item_id'); const quantity = Number(data.get('quantity'));
    const item = inventory.find((entry) => entry.id === id);
    if (!item || quantity <= 0) return;
    const { error } = await supabase.rpc('receive_inventory_stock', { item_id: id, received_quantity: quantity, receipt_note: data.get('notes') || null });
    if (error) setMessage(error.message); else { setModal(null); await loadWorkspace(); }
  }
  async function adjustStock(item, delta, note) {
    const { error } = await supabase.rpc('adjust_inventory_stock', {
      item_id: item.id,
      adjustment: delta,
      adjust_note: note || (delta > 0 ? `Added ${delta}` : `Used ${Math.abs(delta)}`),
    });
    if (error) { setMessage(error.message); return; }
    setModal(null);
    await loadWorkspace();
  }
  async function createWorkOrder(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const techIds = data.getAll('technicians');
    const materials = hardwareRows
      .filter((row) => row.item_name.trim())
      .map((row) => ({
        item_name: row.item_name.trim(),
        quantity: Number(row.quantity) || 1,
        unit: String(row.unit || 'pcs').trim() || 'pcs',
      }));

    const values = {
      client_name: data.get('client_name'),
      location: data.get('location'),
      service_type: data.get('service_type'),
      status: 'Pending',
      scheduled_at: data.get('scheduled_at') || null,
      scheduled_time: data.get('scheduled_time') || null,
      notes: data.get('notes') || null,
    };

    const { data: inserted, error } = await supabase.from('work_orders').insert(values).select().single();
    if (error) { setMessage(error.message); return; }

    if (techIds.length) {
      const { error: assignError } = await supabase
        .from('work_order_assignments')
        .insert(techIds.map((employee_id) => ({ work_order_id: inserted.id, employee_id })));
      if (assignError) setMessage(assignError.message);
    }

    for (const material of materials) {
      await supabase.from('work_order_materials').insert({ work_order_id: inserted.id, ...material });
    }

    setModal(null);
    resetHardwareRows();
    await loadWorkspace();
  }
  async function editWorkOrder(event, order) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const materials = hardwareRows
      .filter((row) => row.item_name.trim())
      .map((row) => ({
        item_name: row.item_name.trim(),
        quantity: Number(row.quantity) || 1,
        unit: String(row.unit || 'pcs').trim() || 'pcs',
      }));

    const values = {
      client_name: data.get('client_name'),
      location: data.get('location'),
      service_type: data.get('service_type'),
      scheduled_at: data.get('scheduled_at') || null,
      scheduled_time: data.get('scheduled_time') || null,
      notes: data.get('notes') || null,
    };

    const { error } = await supabase.from('work_orders').update(values).eq('id', order.id);
    if (error) { setMessage(error.message); return; }

    const { error: clearError } = await supabase
      .from('work_order_assignments').delete().eq('work_order_id', order.id);
    const techIds = data.getAll('technicians');
    if (!clearError && techIds.length) {
      const { error: assignError } = await supabase
        .from('work_order_assignments')
        .insert(techIds.map((employee_id) => ({ work_order_id: order.id, employee_id })));
      if (assignError) { setMessage(assignError.message); return; }
    } else if (clearError) { setMessage(clearError.message); return; }

    await supabase.from('work_order_materials').delete().eq('work_order_id', order.id);
    for (const material of materials) {
      await supabase.from('work_order_materials').insert({ work_order_id: order.id, ...material });
    }

    setModal(null);
    setSelectedOrder(null);
    resetHardwareRows();
    await loadWorkspace();
  }
  async function updateProfile(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get('avatar');
    const resetTarget = (data.get('reset_email') || '').toString().trim();
    if (resetTarget) {
      try { localStorage.setItem(appPasswordResetEmailKey, resetTarget); } catch {}
      setResetEmail(resetTarget);
    }
    const updates = { full_name: data.get('full_name'), phone: data.get('phone') || null };
    if (file?.size) {
      const path = await uploadAvatar(file, `profiles/${session.user.id}`);
      if (!path) return;
      updates.avatar_path = path;
    }
    const { error } = await supabase.from('profiles').update(updates).eq('id', session.user.id);
    if (error) setMessage(error.message); else { setMessage('Account settings saved.'); await loadWorkspace(); }
  }
  async function changeOwnPassword(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = String(data.get('new_password') || '');
    const confirm = String(data.get('confirm_password') || '');
    if (!next || next.length < 6) { setMessage('New password must be at least 6 characters.'); return; }
    if (next !== confirm) { setMessage('Passwords do not match.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (error) setMessage(error.message); else { setMessage('Password updated.'); event.currentTarget.reset(); }
  }
  async function createEmployee(event) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const wantsLogin = data.get('wants_login') === 'on';
    const email = data.get('email') || null;
    const { data: employee, error } = await supabase.from('employees').insert({
      full_name: data.get('full_name'),
      job_title: data.get('job_title'),
      email,
      phone: data.get('phone') || null,
      active: true,
    }).select().single();
    if (error) { setMessage(error.message); return; }
    const file = data.get('avatar');
    if (file?.size) {
      const path = await uploadAvatar(file, `employees/${employee.id}`);
      if (path) await supabase.from('employees').update({ avatar_path: path }).eq('id', employee.id);
    }
    setModal(null); await loadWorkspace();
    if (wantsLogin && email) {
      await sendSignInLink(email, 'Staff clicks the link to set their password, then can log in with the Field Technician role.');
    }
  }
  async function editEmployee(event, employee) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = { full_name: data.get('full_name'), job_title: data.get('job_title'), email: data.get('email') || null, phone: data.get('phone') || null, active: data.get('active') === 'true' };
    const file = data.get('avatar');
    if (file?.size) {
      const path = await uploadAvatar(file, `employees/${employee.id}`);
      if (!path) return;
      values.avatar_path = path;
    }
    const ok = await saveRecord('employees', values, employee.id);
    if (ok) setModal(null);
  }
  async function uploadAvatar(file, folder) {
    if (!file.type.startsWith('image/')) { setMessage('Choose an image file.'); return null; }
    if (file.size > 5 * 1024 * 1024) { setMessage('Profile images must be 5 MB or smaller.'); return null; }
    const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'jpg';
    const path = `${folder}/${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from('profile-photos').upload(path, file, { upsert: false, contentType: file.type });
    if (error) { setMessage(error.message); return null; }
    return path;
  }
  async function deleteEmployee(employee) {
    if (!window.confirm(`Delete ${employee.full_name} from the employee directory?`)) return;
    const { error } = await supabase.from('employees').delete().eq('id', employee.id);
    if (error) setMessage(error.message); else { setModal(null); await loadWorkspace(); }
  }
  async function createQuotation(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    const itemLines = quoteRows
      .filter((row) => row.description.trim())
      .map((row) => {
        const quantity = Number(row.quantity) || 0;
        const unit_cost = Number(row.unit_cost) || 0;
        return {
          description: row.description.trim(),
          quantity,
          unit: String(row.unit || 'pcs').trim() || 'pcs',
          unit_cost,
          amount: quantity * unit_cost,
        };
      });

    if (!itemLines.length) {
      setMessage('Add at least one item with a description.');
      return;
    }

    const labor = Number(data.get('labor_cost') || 0);
    const subtotal = itemLines.reduce((sum, item) => sum + item.amount, 0);

    const payload = {
      client_name: data.get('client_name'),
      client_address: data.get('location') || null,
      project_title: data.get('project_title') || null,
      service_type: data.get('project_title') || 'CCTV Installation',
      quote_date: data.get('quote_date') || todayISO(),
      labor_cost: labor,
      labor_label: 'LABOR',
      subtotal,
      down_payment: subtotal * 0.5,
      status: 'Draft',
      notes: data.get('notes') || null,
    };

    const { data: quote, error } = await supabase.from('quotations').insert(payload).select().single();
    if (error) { setMessage(error.message); return; }

    const quoteItems = itemLines.map((line) => ({
      quotation_id: quote.id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_cost,
      amount: line.amount,
    }));

    const { error: itemsError } = await supabase.from('quotation_items').insert(quoteItems);
    if (itemsError) { setMessage(itemsError.message); return; }

    const savedQuote = {
      ...quote,
      quotation_items: quoteItems.map((it, i) => ({ ...it, unit: itemLines[i].unit })),
      created_at: quote.created_at || new Date().toISOString(),
    };
    setModal(null);
    resetQuoteRows();
    await loadWorkspace();
    setPreviewQuote(savedQuote);
  }

  const sessionUserId = session?.user?.id;
  const visibleOrders = useMemo(() => (role === 'field_technician'
    ? orders.filter((order) => order.work_order_assignments?.some((assignment) => assignment.employees?.auth_user_id === sessionUserId))
    : orders), [orders, role, sessionUserId]);
  const filteredOrders = useMemo(() => visibleOrders.filter((order) => {
    const matchesSearch = `${order.client_name} ${order.location} ${order.service_type}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (category === 'All statuses' || order.status === category);
  }), [category, search, visibleOrders]);
  const activeInventory = useMemo(() => inventory.filter((item) => !item.archived), [inventory]);
  const archivedInventory = useMemo(() => inventory.filter((item) => item.archived), [inventory]);
  const filteredInventory = useMemo(() => activeInventory.filter((item) => {
    const matches = `${item.item_name} ${item.category} ${item.supplier || ''}`.toLowerCase().includes(inventorySearch.toLowerCase());
    const low = Number(item.stock_qty) <= Number(item.reorder_level ?? 1);
    return matches && (inventoryFilter === 'all' || (inventoryFilter === 'low' && low));
  }), [activeInventory, inventorySearch, inventoryFilter]);
  const filteredEmployees = useMemo(() => employees.filter((employee) => `${employee.full_name} ${employee.job_title} ${employee.email || ''} ${employee.phone || ''}`.toLowerCase().includes(employeeSearch.toLowerCase())), [employees, employeeSearch]);
  const filteredQuotations = useMemo(() => quotations.filter((quote) => `${quote.client_name} ${quote.service_type} ${quote.status} ${quote.project_title || ''}`.toLowerCase().includes(quotationSearch.toLowerCase())), [quotations, quotationSearch]);

  if (supabaseConfigError) return <ConfigErrorScreen />;
  if (!session) return <LoginScreen
    onSubmit={signIn}
    busy={busy}
    message={message}
    role={loginRole}
    email={loginEmail}
    onEmailChange={setLoginEmail}
    onRoleChange={(nextRole) => { setLoginRole(nextRole); setLoginEmail(roleEmails[nextRole]); }}
    onForgotPassword={sendSignInLink}
  />;
  if (!role && profileLoading) return <main className="login-shell"><section className="login-card"><Brand /><p>Loading your account…</p></section><div className="login-background" /></main>;
  if (!role) return <main className="login-shell"><section className="login-card"><Brand /><h2>Account role not assigned</h2><p>Your sign-in is active, but this user has no matching row in <b>public.profiles</b>. Add a profile row with this account’s Auth user ID and role, then sign in again.</p>{message && <Notice>{message}</Notice>}<button className="button secondary full" onClick={signOut}><LogOut size={16} /> Sign out</button></section><div className="login-background" /></main>;

  const tabs = tabsByRole[role] || tabsByRole.field_technician;
  const title = tabs.find(([key]) => key === tab)?.[1] || 'Overview';

  return <>
    <div className="app-shell">
      <aside className="sidebar">
        <Brand compact />
        <div className="role-pill"><ShieldCheck size={15} />{roles[role]}</div>
        <nav className="side-nav">{tabs.map(([key, label, Icon]) => <button key={key} onClick={() => setTab(key)} className={tab === key ? 'nav-link active' : 'nav-link'}><Icon size={18} /><span>{label}</span></button>)}</nav>
        <div className="sidebar-user"><Avatar name={displayName} src={profile?.avatar_url} /><div className="user-copy"><b>{displayName}</b><span>{session.user.email}</span></div><button className="icon-button" title="Sign out" onClick={signOut}><LogOut size={17} /></button></div>
      </aside>
      <main className="main-area">
        <header className="topbar"><div><div className="eyebrow">CEA CCTV INSTALLATION SERVICES</div><h1>{title}</h1></div><div className="topbar-right"><span className="live-indicator"><i /> Supabase connected</span><Avatar name={displayName} src={profile?.avatar_url} small /></div></header>
        {message && <Notice onClose={() => setMessage('')}>{message}</Notice>}
        {busy && <div className="loading-line">Syncing records…</div>}
        {tab === 'dashboard' && <Dashboard role={role} profile={profile} orders={visibleOrders} inventory={activeInventory} employees={employees} setTab={setTab} />}
        {tab === 'inventory' && <InventoryView
          inventory={filteredInventory}
          archived={archivedInventory}
          allInventory={activeInventory}
          transactions={transactions}
          search={inventorySearch} setSearch={setInventorySearch}
          filter={inventoryFilter} setFilter={setInventoryFilter}
          onAdd={() => { setCustomSupplier(false); setModal({ type: 'inventory' }); }}
          onReceiveAll={() => setModal({ type: 'receive' })}
          onReceive={(item) => setModal({ type: 'receive', item })}
          onOpen={(item) => setModal({ type: 'inventory-details', item })}
          onAdjust={(item) => setModal({ type: 'adjust-stock', item })}
          onHistory={(item) => setModal({ type: 'stock-history', item })}
          onRestore={restoreInventory}
          onViewHistoryPage={() => setInventoryFilter('history')}
        />}
        {tab === 'schedule' && <TeamScheduleView schedule={teamSchedule} myOrderIds={visibleOrders.map((order) => order.id)} />}
        {tab === 'workorders' && <WorkOrdersView role={role} orders={filteredOrders} search={search} setSearch={setSearch} category={category} setCategory={setCategory} onAdd={() => { resetHardwareRows(); setModal({ type: 'workorder' }); }} onOpen={setSelectedOrder} />}
        {tab === 'employees' && <EmployeesView
          employees={filteredEmployees}
          search={employeeSearch} setSearch={setEmployeeSearch}
          onAdd={() => setModal({ type: 'employee' })}
          onOpen={(employee) => setModal({ type: 'employee-details', employee })}
        />}
        {tab === 'quotations' && <QuotationsView quotations={filteredQuotations} search={quotationSearch} setSearch={setQuotationSearch} onAdd={() => { resetQuoteRows(); setModal({ type: 'quotation' }); }} onView={(q) => setPreviewQuote(q)} onPrint={(q) => setPrintingQuote(q)} />}
        {tab === 'settings' && <SettingsView
          profile={profile}
          email={session.user.email}
          resetEmail={resetEmail}
          onResetEmailChange={setResetEmail}
          onSubmit={updateProfile}
          onRequestPasswordReset={requestPasswordReset}
          onChangePassword={changeOwnPassword}
        />}
      </main>
      {modal && <Modal title={modal.type === 'inventory' ? 'Add inventory item' : modal.type === 'edit-inventory' ? 'Edit inventory item' : modal.type === 'inventory-details' ? 'Inventory item details' : modal.type === 'receive' ? 'Receive stock' : modal.type === 'adjust-stock' ? 'Adjust stock' : modal.type === 'stock-history' ? 'Stock history' : modal.type === 'workorder' ? 'Create work order' : modal.type === 'edit-workorder' ? 'Edit work order' : modal.type === 'employee' ? 'Add employee' : modal.type === 'edit-employee' ? 'Employee settings' : modal.type === 'employee-details' ? 'Employee details' : modal.type === 'quotation' ? 'Create quotation' : 'Quotation details'} onClose={() => { resetHardwareRows(); resetQuoteRows(); setCustomSupplier(false); setModal(null); }}>

        {modal.type === 'inventory' && <form className="form-grid" onSubmit={addInventory}>
          <Field name="item_name" label="What is it?" required placeholder="8MP Bullet Camera" />
          <Field name="category" label="Type" required placeholder="CCTV, Fire Safety, Wiring…" />
          <label className="field">
            <span>Measured in</span>
            <input name="unit" placeholder="e.g. pieces, rolls, box" defaultValue="" />
            <small>What form of measurement? pieces, rolls, box, meters…</small>
          </label>
          <SupplierField customSupplier={customSupplier} setCustomSupplier={setCustomSupplier} />
          <Field name="unit_cost" label="Price per unit (₱)" type="number" min="0" step="0.01" required />
          <label className="field">
            <span>Quantity on hand</span>
            <input name="stock_qty" type="number" min="0" required placeholder="e.g. 12" />
            <small>The actual number of items you currently have</small>
          </label>
          <label className="field">
            <span>Warn me when it drops to…</span>
            <input name="reorder_level" type="number" min="0" defaultValue="1" />
            <small>Get a low-stock alert when the quantity reaches this number</small>
          </label>
          <FormActions onCancel={() => { setCustomSupplier(false); setModal(null); }} />
        </form>}

        {modal.type === 'edit-inventory' && <form className="form-grid" onSubmit={(event) => editInventory(event, modal.item)}>
          <Field name="item_name" label="What is it?" required defaultValue={modal.item.item_name} />
          <Field name="category" label="Type" required defaultValue={modal.item.category} />
          <label className="field">
            <span>Measured in</span>
            <input name="unit" placeholder="e.g. pieces, rolls, box" defaultValue={modal.item.unit || ''} />
            <small>What form of measurement? pieces, rolls, box, meters…</small>
          </label>
          <SupplierField customSupplier={customSupplier} setCustomSupplier={setCustomSupplier} defaultValue={modal.item.supplier || ''} />
          <Field name="unit_cost" label="Price per unit (₱)" type="number" min="0" step="0.01" required defaultValue={modal.item.unit_cost} />
          <label className="field">
            <span>Warn me when it drops to…</span>
            <input name="reorder_level" type="number" min="0" defaultValue={modal.item.reorder_level ?? 1} />
            <small>Get a low-stock alert when the quantity reaches this number</small>
          </label>
          <div className="field full stock-hint"><small>To change the quantity on hand, use the <b>Adjust stock</b> button — this keeps a clean history of every add and subtraction.</small></div>
          <FormActions onCancel={() => { setCustomSupplier(false); setModal(null); }} />
        </form>}

        {modal.type === 'inventory-details' && <div className="record-details">
          <Detail label="Item" value={modal.item.item_name} icon={Package} />
          <Detail label="Type" value={modal.item.category} icon={Package} />
          <Detail label="Quantity available" value={formatQty(modal.item.stock_qty, modal.item.unit)} icon={ArrowDownToLine} />
          <Detail label="Price per unit" value={money(modal.item.unit_cost)} icon={FileText} />
          <Detail label="Supplier" value={modal.item.supplier || 'Not recorded'} icon={BriefcaseBusiness} />
          <Detail label="Warn when it drops to" value={formatQty(modal.item.reorder_level ?? 1, modal.item.unit)} icon={Activity} />
          {role === 'administrator' && <div className="form-actions inventory-detail-actions">
            <button className="button danger" onClick={() => archiveInventory(modal.item)}><Archive size={16} /> Archive</button>
            <button className="button danger subtle" onClick={() => forceDeleteInventory(modal.item)} title="Permanently delete item and all its history"><Trash2 size={16} /> Force delete</button>
            <button className="button secondary" onClick={() => setModal({ type: 'adjust-stock', item: modal.item })}><ArrowDownToLine size={16} /> Adjust stock</button>
            <button className="button secondary" onClick={() => setModal({ type: 'stock-history', item: modal.item })}><ClipboardList size={16} /> History</button>
            <button className="button primary" onClick={() => { setCustomSupplier(false); setModal({ type: 'edit-inventory', item: modal.item }); }}>Edit item</button>
          </div>}
        </div>}

        {modal.type === 'receive' && <form className="form-grid" onSubmit={receiveStock}>{modal.item ? <div className="field full"><span>Receiving</span><div className="receive-item-card"><b>{modal.item.item_name}</b><small>Current stock: {formatQty(modal.item.stock_qty, modal.item.unit)}</small></div><input type="hidden" name="item_id" value={modal.item.id} /></div> : <label className="field full"><span>Inventory item</span><select name="item_id" required>{activeInventory.map((item) => <option key={item.id} value={item.id}>{item.item_name} · {formatQty(item.stock_qty, item.unit)} available</option>)}</select></label>}<Field name="quantity" label="How many received?" type="number" min="1" required autoFocus /><Field name="notes" label="Receipt note (optional)" placeholder="Supplier or reference no." /><FormActions onCancel={() => setModal(null)} /></form>}

        {modal.type === 'adjust-stock' && <AdjustStockForm item={modal.item} onAdjust={adjustStock} onCancel={() => setModal(null)} />}

        {modal.type === 'stock-history' && <StockHistoryView item={modal.item} transactions={transactions.filter((t) => t.inventory_item_id === modal.item.id)} />}

        {modal.type === 'workorder' && <form className="form-grid" onSubmit={createWorkOrder}><Field name="client_name" label="Client name" required /><Field name="service_type" label="Service" required placeholder="CCTV Installation" /><Field name="location" label="Location" required placeholder="Davao City" /><Field name="scheduled_at" label="Scheduled date" type="date" /><Field name="scheduled_time" label="Scheduled time" type="time" /><TechnicianChecklist employees={employees} /><HardwareBuilder rows={hardwareRows} onAdd={addHardwareRow} onUpdate={updateHardwareRow} onRemove={removeHardwareRow} /><label className="field full"><span>Work notes</span><textarea name="notes" rows="2" /></label><FormActions onCancel={() => { resetHardwareRows(); setModal(null); }} /></form>}

        {modal.type === 'edit-workorder' && <form className="form-grid" onSubmit={(event) => editWorkOrder(event, modal.order)}><Field name="client_name" label="Client name" required defaultValue={modal.order.client_name} /><Field name="service_type" label="Service" required defaultValue={modal.order.service_type} /><Field name="location" label="Location" required defaultValue={modal.order.location} /><Field name="scheduled_at" label="Scheduled date" type="date" defaultValue={modal.order.scheduled_at || ''} /><Field name="scheduled_time" label="Scheduled time" type="time" defaultValue={modal.order.scheduled_time || ''} /><TechnicianChecklist employees={employees} selectedIds={modal.order.work_order_assignments?.map((assignment) => assignment.employee_id) || []} /><HardwareBuilder rows={hardwareRows} onAdd={addHardwareRow} onUpdate={updateHardwareRow} onRemove={removeHardwareRow} /><label className="field full"><span>Work notes</span><textarea name="notes" rows="2" defaultValue={modal.order.notes || ''} /></label><FormActions onCancel={() => { resetHardwareRows(); setModal(null); }} /></form>}

        {modal.type === 'employee' && <form className="form-grid" onSubmit={createEmployee}>
          <Field name="full_name" label="Full name" required />
          <Field name="job_title" label="Job title" required placeholder="Technician" />
          <Field name="email" label="Email" type="email" required placeholder="staff@ceacompany.com" />
          <Field name="phone" label="Phone" />
          <Field name="avatar" label="Profile picture" type="file" accept="image/*" />
          <div className="field full login-toggle">
            <span>Login account</span>
            <label className="login-toggle-row">
              <input type="checkbox" name="wants_login" defaultChecked />
              <div className="login-toggle-copy">
                <b>Send password setup email to the above address</b>
                <small>Staff clicks the link, sets their password, and can log in as Field Technician to view their schedule.</small>
              </div>
            </label>
          </div>
          <FormActions onCancel={() => setModal(null)} />
        </form>}

        {modal.type === 'edit-employee' && <form className="form-grid" onSubmit={(event) => editEmployee(event, modal.employee)}>
          <div className="photo-picker full"><Avatar name={modal.employee.full_name} src={modal.employee.avatar_url} large /><Field name="avatar" label="Change profile picture" type="file" accept="image/*" /></div>
          <Field name="full_name" label="Full name" required defaultValue={modal.employee.full_name} />
          <Field name="job_title" label="Job title" required defaultValue={modal.employee.job_title} />
          <Field name="email" label="Email (for login)" type="email" defaultValue={modal.employee.email || ''} />
          <Field name="phone" label="Phone" defaultValue={modal.employee.phone || ''} />
          <label className="field"><span>Employee status</span><select name="active" defaultValue={String(modal.employee.active)}><option value="true">Active</option><option value="false">Inactive</option></select></label>
          <FormActions onCancel={() => setModal(null)} />
        </form>}

        {modal.type === 'employee-details' && <div className="record-details employee-details-view">
          <div className="employee-profile-heading">
            <Avatar name={modal.employee.full_name} src={modal.employee.avatar_url} large />
            <div><h3>{modal.employee.full_name}</h3><span>{modal.employee.job_title}</span></div>
          </div>
          <Detail label="Email" value={modal.employee.email || 'Not recorded'} icon={Mail} />
          <Detail label="Phone" value={modal.employee.phone || 'Not recorded'} icon={Activity} />
          <Detail label="Status" value={modal.employee.active ? 'Active' : 'Inactive'} icon={BadgeCheck} />
          {modal.employee.auth_user_id && <Detail label="Login account" value="Linked" icon={KeyRound} />}
          {!modal.employee.auth_user_id && <div className="detail-block login-hint">
            <b>Login account</b>
            <small>This staff can't log in yet. Send them a password setup email so they can access their schedule.</small>
          </div>}
          <div className="form-actions employee-detail-actions">
            <button className="button danger" onClick={() => deleteEmployee(modal.employee)}><Trash2 size={16} /> Delete employee</button>
            {modal.employee.email && !modal.employee.auth_user_id && (
              <button className="button secondary" onClick={() => sendSignInLink(modal.employee.email, 'They will set their password and can log in with the Field Technician role.')}>
                <MailPlus size={16} /> Send password setup email
              </button>
            )}
            {modal.employee.email && modal.employee.auth_user_id && (
              <button className="button secondary" onClick={() => sendSignInLink(modal.employee.email, 'They can set a new password from this link.')}>
                <MailPlus size={16} /> Send password reset email
              </button>
            )}
            <button className="button primary" onClick={() => setModal({ type: 'edit-employee', employee: modal.employee })}>Edit</button>
          </div>
        </div>}

        {modal.type === 'quotation' && <form className="form-grid quotation-form" onSubmit={createQuotation}>
          <Field name="client_name" label="Client name" required placeholder="e.g. Brgy. Bonifacio" />
          <Field name="location" label="Location" placeholder="e.g. Brgy Bonifacio st. Davao City" />
          <Field name="project_title" label="Project" required placeholder="e.g. waterlines submeter installation" />
          <Field name="quote_date" label="Date" type="date" defaultValue={todayISO()} />

          <div className="field full quote-builder">
            <span>Items</span>
            <div className="quote-builder-head">
              <span>Description</span>
              <span>Qty</span>
              <span>Unit</span>
              <span>Unit Cost</span>
              <span>Amount</span>
              <span />
            </div>
            <div className="quote-builder-rows">
              {quoteRows.map((row, index) => {
                const amount = (Number(row.quantity) || 0) * (Number(row.unit_cost) || 0);
                return (
                  <div className="quote-builder-row" key={index}>
                    <input className="quote-desc" placeholder="e.g. SUBMETER" value={row.description} onChange={(e) => updateQuoteRow(index, 'description', e.target.value)} />
                    <input className="quote-qty" type="number" min="1" placeholder="1" value={row.quantity} onChange={(e) => updateQuoteRow(index, 'quantity', e.target.value)} />
                    <input className="quote-unit" placeholder="pcs" value={row.unit} onChange={(e) => updateQuoteRow(index, 'unit', e.target.value)} />
                    <input className="quote-cost" type="number" min="0" step="0.01" placeholder="0.00" value={row.unit_cost} onChange={(e) => updateQuoteRow(index, 'unit_cost', e.target.value)} />
                    <span className="quote-amount">{money(amount)}</span>
                    <button type="button" className="icon-button danger" onClick={() => removeQuoteRow(index)} disabled={quoteRows.length === 1} title="Remove row"><X size={16} /></button>
                  </div>
                );
              })}
            </div>
            <button type="button" className="button secondary small-button add-row-button" onClick={addQuoteRow}><Plus size={15} /> Add item</button>
          </div>

          <Field name="labor_cost" label="Labor (₱)" type="number" min="0" step="0.01" defaultValue="0" />
          <div className="field quote-summary">
            <span>Subtotal</span>
            <input value={money(quoteRows.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unit_cost) || 0), 0))} readOnly />
          </div>
          <label className="field full"><span>Notes (optional)</span><textarea name="notes" rows="2" /></label>
          <FormActions onCancel={() => { resetQuoteRows(); setModal(null); }} />
        </form>}
      </Modal>}
      {selectedOrder && <WorkOrderDetails order={orders.find((item) => item.id === selectedOrder.id) || selectedOrder} role={role} onClose={() => setSelectedOrder(null)} onStatus={setOrderStatus} onDelete={deleteOrder} onEdit={(order) => { setSelectedOrder(null); resetHardwareRows(order.work_order_materials?.length ? order.work_order_materials.map((m) => ({ item_name: m.item_name, quantity: m.quantity, unit: m.unit || 'pcs' })) : [{ item_name: '', quantity: 1, unit: 'pcs' }]); setModal({ type: 'edit-workorder', order }); }} />}
      {previewQuote && <QuotePreviewModal
        quote={previewQuote}
        onClose={() => setPreviewQuote(null)}
        onPrint={() => {
          const q = previewQuote;
          setPreviewQuote(null);
          setTimeout(() => setPrintingQuote(q), 60);
        }}
      />}
    </div>
    {printingQuote && <PrintableQuotation quote={printingQuote} />}
  </>;
}

function Brand({ compact = false, subtitle = 'Operations platform' }) {
  return <div className={compact ? 'brand compact' : 'brand'}>
    <div className="brand-mark"><ShieldCheck size={compact ? 22 : 29} /></div>
    <div><b>CEA OpsGrid</b><span>{subtitle}</span></div>
  </div>;
}
function Avatar({ name, src, small = false, large = false }) { return src ? <img className={`avatar avatar-photo${small ? ' small' : ''}${large ? ' large' : ''}`} src={src} alt={`${name} profile`} /> : <div className={`avatar${small ? ' small' : ''}${large ? ' large' : ''}`}>{initials(name)}</div>; }
function Notice({ children, onClose }) { return <div className="notice">{children}{onClose && <button onClick={onClose} className="icon-button"><X size={15} /></button>}</div>; }
function ConfigErrorScreen() {
  return <main className="login-shell"><section className="login-card"><Brand /><div className="login-heading"><h1>Supabase configuration required</h1><p>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your deployment environment before opening the app.</p></div><Notice>Missing Supabase environment variables. The app will not connect with hardcoded fallback keys.</Notice></section><div className="login-background" /></main>;
}

function LoginScreen({ onSubmit, busy, message, role, email, onEmailChange, onRoleChange, onForgotPassword }) {
  const [visible, setVisible] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState(email);

  if (forgotMode) {
    return <main className="login-shell"><section className="login-card">
      <Brand />
      <div className="login-heading">
        <h1>Forgot password?</h1>
        <p>Enter your email and we'll send a reset link.</p>
      </div>
      {message && <Notice>{message}</Notice>}
      <form className="login-form" onSubmit={(e) => { e.preventDefault(); onForgotPassword(forgotEmail, 'Open the email on this device to set a new password.'); }}>
        <label className="field">
          <span>Email address</span>
          <div className="input-icon"><Mail size={17} /><input type="email" autoFocus required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@ceacompany.com" /></div>
        </label>
        <button className="button primary full" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}<ArrowRight size={17} /></button>
      </form>
      <button className="text-button centered-back" onClick={() => setForgotMode(false)}>← Back to sign in</button>
    </section><div className="login-background" /></main>;
  }

  return <main className="login-shell"><section className="login-card">
    <Brand subtitle="CEA CCTV Installation Services • Tugbok, Davao City" />
    {message && <Notice>{message}</Notice>}
    <div className="role-quick">
      <label>Select access role</label>
      <div className="role-quick-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {Object.entries(roles).map(([key]) => <button key={key} type="button" className={role === key ? 'active' : ''} onClick={() => onRoleChange(key)}>{key === 'administrator' ? 'Admin' : 'Field Tech'}</button>)}
      </div>
    </div>
    <form className="login-form" onSubmit={onSubmit}>
      <label className="field"><span>Email address</span><div className="input-icon"><Mail size={17} /><input type="email" name="email" autoComplete="username" required value={email} onChange={(event) => onEmailChange(event.target.value)} /></div></label>
      <label className="field"><span>Password</span><div className="input-icon"><LockKeyhole size={17} /><input type={visible ? 'text' : 'password'} name="password" autoComplete="current-password" required placeholder="Enter your password" /><button type="button" className="password-toggle" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
      <button className="button primary full" disabled={busy}>{busy ? 'Signing in…' : 'Access ERP Portal'}<ArrowRight size={17} /></button>
    </form>
    <button className="text-button centered-back" onClick={() => { setForgotEmail(email); setForgotMode(true); }}>Forgot password?</button>
    <div className="login-foot"><ShieldCheck size={15} /> Selected role must match your account</div>
  </section><div className="login-background" /></main>;
}

function Dashboard({ role, profile, orders, inventory, employees, setTab }) {
  const pending = orders.filter((order) => order.status === 'Pending').length;
  const active = orders.filter((order) => order.status === 'In Progress').length;
  const completed = orders.filter((order) => order.status === 'Completed').length;
  if (role === 'field_technician') return <><div className="welcome-row"><div><div className="eyebrow">FIELD OPERATIONS</div><h2>Your assigned work</h2><p>Installation schedules, site addresses, and required hardware.</p></div><button className="button primary" onClick={() => setTab('workorders')}><ClipboardList size={17} /> View assignments</button></div><div className="stats-grid three"><Stat label="Assigned jobs" value={orders.length} icon={BriefcaseBusiness} /><Stat label="In progress" value={active} icon={Wrench} tone="amber" /><Stat label="Completed" value={completed} icon={BadgeCheck} tone="green" /></div><WorkOrdersView role={role} orders={orders.slice(0, 4)} compact onOpen={() => setTab('workorders')} /></>;
  return <><div className="welcome-row"><div><div className="eyebrow">ADMINISTRATOR OVERVIEW</div><h2>Good day, {profile?.full_name?.split(' ')[0] || 'Administrator'}</h2><p>Here’s the current status of your operations.</p></div><button className="button primary" onClick={() => setTab('workorders')}><Plus size={17} /> New work order</button></div><div className="stats-grid four"><Stat label="Pending" value={pending} icon={CalendarDays} /><Stat label="In progress" value={active} icon={Activity} tone="amber" /><Stat label="Completed" value={completed} icon={BadgeCheck} tone="green" /><Stat label="Inventory items" value={inventory.length} icon={Package} /></div><div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h3>Recent work orders</h3><p>Latest projects across all statuses</p></div><button className="text-button" onClick={() => setTab('workorders')}>View all <ArrowRight size={15} /></button></div><OrderList orders={orders.slice(0, 5)} onOpen={() => setTab('workorders')} /></section><section className="panel quick-panel"><div className="panel-heading"><div><h3>Quick access</h3><p>Common administrator tasks</p></div></div><QuickLink icon={ClipboardList} title="Manage work orders" subtitle={`${orders.length} project records`} onClick={() => setTab('workorders')} /><QuickLink icon={Package} title="Inventory tracking" subtitle={`${inventory.length} items`} onClick={() => setTab('inventory')} /><QuickLink icon={Users} title="Employee directory" subtitle={`${employees.length} employees`} onClick={() => setTab('employees')} /><QuickLink icon={FileText} title="Client quotations" subtitle="Create and print quotations" onClick={() => setTab('quotations')} /></section></div></>;
}
function Stat({ label, value, icon: Icon, tone = 'blue' }) { return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><div><span>{label}</span><strong>{value}</strong></div></div>; }
function QuickLink({ icon: Icon, title, subtitle, onClick }) { return <button className="quick-link" onClick={onClick}><span className="quick-icon"><Icon size={18} /></span><span><b>{title}</b><small>{subtitle}</small></span><ArrowRight size={16} /></button>; }

function InventoryView({ inventory, archived, allInventory, transactions, search, setSearch, filter, setFilter, onAdd, onReceiveAll, onReceive, onOpen, onAdjust, onHistory, onRestore, onViewHistoryPage }) {
  const lowCount = allInventory.filter((item) => Number(item.stock_qty) <= Number(item.reorder_level ?? 1)).length;
  const showHistoryPage = filter === 'history';

  return <section className="panel table-panel">
    <div className="panel-heading">
      <div><h3>Inventory tracking</h3><p>Current quantities and reorder alerts</p></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="button secondary small-button" onClick={onReceiveAll}><ArrowDownToLine size={15} /> Receive stock</button>
        <button className="button primary small-button" onClick={onAdd}><Plus size={15} /> Add item</button>
      </div>
    </div>
    <div className="inventory-filters">
      <button className={filter === 'all' ? 'chip active' : 'chip'} onClick={() => setFilter('all')}>All items</button>
      <button className={filter === 'low' ? 'chip active' : 'chip'} onClick={() => setFilter('low')}>
        Low stock {lowCount > 0 && <span className="chip-count">{lowCount}</span>}
      </button>
      <button className={filter === 'history' ? 'chip active' : 'chip'} onClick={onViewHistoryPage}>
        <ClipboardList size={13} /> History
      </button>
      {archived.length > 0 && (
        <button className={filter === 'archived' ? 'chip active' : 'chip'} onClick={() => setFilter('archived')}>
          <Archive size={13} /> Archived ({archived.length})
        </button>
      )}
    </div>

    {showHistoryPage ? (
      <AllHistoryView inventory={allInventory} transactions={transactions} />
    ) : filter === 'archived' ? (
      <ArchivedListView archived={archived} onRestore={onRestore} onOpen={onOpen} />
    ) : (
      <>
        <ListSearch value={search} onChange={setSearch} placeholder="Search item, type, or supplier…" />
        <div className="table-scroll"><table>
          <thead><tr><th>Item</th><th>Type</th><th>Price per unit</th><th>On hand</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {inventory.map((item) => {
              const low = Number(item.stock_qty) <= Number(item.reorder_level ?? 1);
              return <tr key={item.id} className={onOpen ? 'clickable-row' : ''} onClick={() => onOpen?.(item)}>
                <td>{onOpen ? <button className="table-link" onClick={(event) => { event.stopPropagation(); onOpen(item); }}><b>{item.item_name}</b><small>{item.supplier || item.unit || ''}</small></button> : <><b>{item.item_name}</b><small>{item.supplier || item.unit || ''}</small></>}</td>
                <td>{item.category}</td>
                <td>{money(item.unit_cost)}</td>
                <td><span className="qty-value">{formatQty(item.stock_qty, item.unit)}</span></td>
                <td><span className={low ? 'status-chip low' : 'status-chip completed'}>{low ? 'Low stock' : 'In stock'}</span></td>
                <td>
                  <div className="row-actions">
                    <button className="button secondary small-button" title="Receive stock" onClick={(event) => { event.stopPropagation(); onReceive(item); }}><ArrowDownToLine size={14} /> Receive</button>
                    <button className="button secondary small-button" title="Adjust stock" onClick={(event) => { event.stopPropagation(); onAdjust(item); }}><ArrowDownToLine size={14} /> Adjust</button>
                    <button className="button secondary small-button" title="Stock history" onClick={(event) => { event.stopPropagation(); onHistory(item); }}><ClipboardList size={14} /> History</button>
                  </div>
                </td>
              </tr>;
            })}
            {!inventory.length && <EmptyRow columns={6} text="No matching inventory records." />}
          </tbody>
        </table></div>
      </>
    )}
  </section>;
}

function ArchivedListView({ archived, onRestore, onOpen }) {
  return <>
    <div className="archived-banner">
      <Archive size={15} /> Archived items are hidden from the main list but their history is kept.
    </div>
    <div className="table-scroll"><table>
      <thead><tr><th>Item</th><th>Type</th><th>On hand</th><th>Action</th></tr></thead>
      <tbody>
        {archived.map((item) => <tr key={item.id}>
          <td><button className="table-link" onClick={() => onOpen?.(item)}><b>{item.item_name}</b><small>{item.supplier || item.unit || ''}</small></button></td>
          <td>{item.category}</td>
          <td><span className="qty-value">{formatQty(item.stock_qty, item.unit)}</span></td>
          <td><button className="button secondary small-button" onClick={() => onRestore(item)}><RotateCcw size={14} /> Restore</button></td>
        </tr>)}
        {!archived.length && <EmptyRow columns={4} text="No archived items." />}
      </tbody>
    </table></div>
  </>;
}

function AllHistoryView({ inventory, transactions }) {
  const itemById = useMemo(() => {
    const map = new Map();
    inventory.forEach((item) => map.set(item.id, item));
    return map;
  }, [inventory]);

  const sorted = useMemo(() => [...transactions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), [transactions]);

  return <div className="all-history-wrap">
    <div className="all-history-header">
      <b>Complete stock history</b>
      <small>{sorted.length} movement{sorted.length === 1 ? '' : 's'} across all items</small>
    </div>
    <div className="table-scroll"><table>
      <thead><tr><th>When</th><th>Item</th><th>Change</th><th>Note</th></tr></thead>
      <tbody>
        {sorted.map((t) => {
          const item = itemById.get(t.inventory_item_id);
          const positive = Number(t.quantity) >= 0;
          return <tr key={t.id}>
            <td><b>{formatDateTime(t.created_at)}</b></td>
            <td>{item?.item_name || '—'}<small>{item?.category || ''}</small></td>
            <td>
              <span className={positive ? 'status-chip completed' : 'status-chip low'}>
                {positive ? '+' : ''}{t.quantity} {String(item?.unit || 'pcs').trim()}
              </span>
            </td>
            <td>{t.notes || t.transaction_type || '—'}</td>
          </tr>;
        })}
        {!sorted.length && <EmptyRow columns={4} text="No stock movements yet." />}
      </tbody>
    </table></div>
  </div>;
}

function WorkOrdersView({ role, orders, search = '', setSearch, category = 'All statuses', setCategory, onAdd, onOpen, compact = false }) {
  const isAdmin = role === 'administrator';
  return <section className="panel"><div className="panel-heading"><div><h3>{compact ? 'Your upcoming assignments' : isAdmin ? 'Work orders & dispatch' : 'Assigned work orders'}</h3><p>{isAdmin ? 'Track progress and assign technicians individually' : 'Only work orders assigned to your account are shown'}</p></div>{isAdmin && !compact && <button className="button primary small-button" onClick={onAdd}><Plus size={15} /> Create work order</button>}</div>{!compact && <div className="filter-row"><div className="search-box"><Search size={17} /><input placeholder="Search client, site, or service…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><label className="select-wrap"><ChevronDown size={15} /><select value={category} onChange={(event) => setCategory(event.target.value)}><option>All statuses</option><option>Pending</option><option>In Progress</option><option>Completed</option></select></label></div>}<div className="order-list">{orders.map((order) => <button key={order.id} className="order-row" onClick={() => onOpen(order)}><div className="order-service"><span className="order-icon"><Wrench size={17} /></span><span><b>{order.client_name}</b><small>{order.service_type}</small></span></div><span className="order-location"><MapPin size={14} />{order.location}</span><span className="order-techs">{order.work_order_assignments?.map((item) => item.employees?.full_name).filter(Boolean).join(', ') || 'Unassigned'}</span><Status status={order.status} /></button>)}{!orders.length && <div className="empty-state">No work orders match this view.</div>}</div></section>;
}
function OrderList({ orders, onOpen }) { return <div className="order-list">{orders.map((order) => <button className="order-row" key={order.id} onClick={() => onOpen(order)}><div className="order-service"><span className="order-icon"><Wrench size={17} /></span><span><b>{order.client_name}</b><small>{order.service_type}</small></span></div><span className="order-location"><MapPin size={14} />{order.location}</span><Status status={order.status} /></button>)}{!orders.length && <div className="empty-state">No work orders yet.</div>}</div>; }
function Status({ status }) { const key = status === 'In Progress' ? 'progress' : status?.toLowerCase(); return <span className={`status-chip ${key || 'pending'}`}>{status || 'Pending'}</span>; }
function TeamScheduleView({ schedule, myOrderIds }) {
  const mine = new Set(myOrderIds);
  return <section className="panel table-panel"><div className="panel-heading"><div><h3>Team schedule</h3><p>See who is working where and when. Client details are shown only on your own assigned work orders.</p></div></div><div className="table-scroll"><table><thead><tr><th>Date</th><th>Service</th><th>Area</th><th>Technicians</th><th>Status</th></tr></thead><tbody>{schedule.map((job) => <tr key={job.id}><td><b>{job.scheduled_at ? formatDate(job.scheduled_at) : 'Not scheduled'}</b></td><td>{job.service_type}</td><td>{job.location}</td><td>{job.technicians?.length ? job.technicians.join(', ') : 'Unassigned'}</td><td><Status status={job.status} />{mine.has(job.id) && <span className="status-chip neutral" style={{ marginLeft: 6 }}>Yours</span>}</td></tr>)}{!schedule.length && <EmptyRow columns={5} text="No upcoming jobs on the schedule." />}</tbody></table></div></section>;
}

function EmployeesView({ employees, search, setSearch, onAdd, onOpen }) {
  return <section className="panel">
    <div className="panel-heading">
      <div><h3>Employee directory</h3><p>Company staff and their assigned roles</p></div>
      <button className="button primary small-button" onClick={onAdd}><Plus size={15} /> Add employee</button>
    </div>
    <ListSearch value={search} onChange={setSearch} placeholder="Search name, position, email, or phone…" />
    <div className="employee-grid">
      {employees.map((employee) => <button className="employee-card clickable-card" key={employee.id} onClick={() => onOpen(employee)}>
        <Avatar name={employee.full_name} src={employee.avatar_url} />
        <div className="employee-card-body">
          <b>{employee.full_name}</b>
          <span>{employee.job_title}</span>
          <small>{employee.email || employee.phone || 'Contact details not added'}</small>
        </div>
        <span className={`presence ${employee.active ? 'on' : ''}`}>{employee.active ? 'Active' : 'Inactive'}</span>
      </button>)}
      {!employees.length && <div className="empty-state">No matching employees.</div>}
    </div>
  </section>;
}

function QuotationsView({ quotations, search, setSearch, onAdd, onView, onPrint }) {
  return <section className="panel">
    <div className="panel-heading">
      <div><h3>Client quotations</h3><p>Draft itemized service estimates and print for clients</p></div>
      <button className="button primary small-button" onClick={onAdd}><Plus size={15} /> New quotation</button>
    </div>
    <ListSearch value={search} onChange={setSearch} placeholder="Search client, project, or status…" />
    <div className="quote-grid">
      {quotations.map((quote) => <article className="quote-card" key={quote.id}>
        <div className="quote-top">
          <span className="order-icon"><FileText size={18} /></span>
          <Status status={quote.status} />
        </div>
        <div className="quote-card-body">
          <h4>{quote.client_name}</h4>
          <p className="quote-project">{quote.project_title || quote.service_type}</p>
          <small className="quote-location">{quote.client_address || 'No location set'}</small>
          <div className="quote-totals">
            <strong>{money(quote.subtotal)}</strong>
            <small>50% down payment · {money(quote.down_payment)}</small>
          </div>
        </div>
        <div className="quote-actions">
          <button className="button secondary small-button" onClick={() => onView(quote)}><Eye size={15} /> View</button>
          <button className="button primary small-button" onClick={() => onPrint(quote)}><Printer size={15} /> Print</button>
        </div>
      </article>)}
      {!quotations.length && <div className="empty-state">No matching quotations.</div>}
    </div>
  </section>;
}

function QuotePreviewModal({ quote, onClose, onPrint }) {
  return <div className="modal-scrim"><section className="modal-card quote-preview-card">
    <header className="modal-header">
      <h2>Ready to print</h2>
      <div className="modal-header-actions">
        <button className="button primary small-button" onClick={onPrint}><Printer size={15} /> Print</button>
        <button className="icon-button" onClick={onClose}><X size={19} /></button>
      </div>
    </header>
    <div className="quote-preview-scroll">
      <PrintableQuotation quote={quote} inline />
    </div>
  </section></div>;
}

function ListSearch({ value, onChange, placeholder }) { return <div className="filter-row list-search"><div className="search-box"><Search size={17} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div></div>; }
function TechnicianChecklist({ employees, selectedIds = [] }) {
  const technicians = employees.filter((employee) => employee.active && /tech/i.test(employee.job_title || ''));
  return <fieldset className="field full checkbox-list"><legend>Assign technicians</legend>{technicians.length ? technicians.map((employee) => <label key={employee.id} className="checkbox-option"><input type="checkbox" name="technicians" value={employee.id} defaultChecked={selectedIds.includes(employee.id)} /><span><b>{employee.full_name}</b><small>{employee.job_title}</small></span></label>) : <small>No active technicians are available.</small>}</fieldset>;
}
function HardwareBuilder({ rows, onAdd, onUpdate, onRemove }) {
  return <div className="field full hardware-builder">
    <span>Required hardware</span>
    <div className="hardware-rows">
      {rows.map((row, index) => (
        <div className="hardware-row" key={index}>
          <input className="hardware-item" placeholder="Item name (e.g. CCTV Camera)" value={row.item_name} onChange={(e) => onUpdate(index, 'item_name', e.target.value)} />
          <input className="hardware-qty" type="number" min="1" placeholder="Qty" value={row.quantity} onChange={(e) => onUpdate(index, 'quantity', e.target.value)} />
          <input className="hardware-unit" placeholder="Unit" value={row.unit} onChange={(e) => onUpdate(index, 'unit', e.target.value)} />
          <button type="button" className="icon-button danger" onClick={() => onRemove(index)} disabled={rows.length === 1} title="Remove row"><X size={16} /></button>
        </div>
      ))}
    </div>
    <button type="button" className="button secondary small-button add-row-button" onClick={onAdd}><Plus size={15} /> Add hardware item</button>
  </div>;
}

function PrintableQuotation({ quote, inline = false }) {
  const rows = quote.quotation_items?.length ? quote.quotation_items : [];
  const labor = Number(quote.labor_cost || 0);
  const itemsTotal = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const grandTotal = itemsTotal + labor;
  const downPayment = grandTotal * 0.5;
  const projectDate = quote.quote_date || quote.created_at;

  return <article className={inline ? 'printable-quotation inline' : 'printable-quotation'}>
    <div className="print-brand">
      {COMPANY.name}
      <span>{COMPANY.address}</span>
      <span>{COMPANY.phone}</span>
      <span>{COMPANY.email}</span>
    </div>

    <div className="print-header-row">
      <div className="print-meta">
        <p><b>LOCATION:</b> {quote.client_address || 'N/A'}</p>
        <p><b>PROJECT:</b> {quote.project_title || quote.service_type || 'N/A'}</p>
      </div>
      <div className="print-date">{formatDate(projectDate)}</div>
    </div>

    <table className="print-table">
      <colgroup>
        <col className="col-item-no" />
        <col className="col-desc" />
        <col className="col-qty" />
        <col className="col-unit" />
        <col className="col-cost" />
        <col className="col-cost" />
      </colgroup>
      <thead>
        <tr>
          <th className="th-item-no" rowSpan="2">Item No.</th>
          <th className="th-desc" rowSpan="2">Description</th>
          <th className="th-qty" rowSpan="2">Qty.</th>
          <th className="th-unit" rowSpan="2">Unit</th>
          <th className="th-material" colSpan="2">Material Cost</th>
        </tr>
        <tr>
          <th className="th-sub">Unit Cost</th>
          <th className="th-sub">Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.length ? rows.map((item, index) => <tr key={item.id || index}>
          <td className="col-item-no">{index + 1}</td>
          <td className="col-desc">{item.description}</td>
          <td className="col-qty">{item.quantity}</td>
          <td className="col-unit">{String(item.unit || 'pcs').trim()}</td>
          <td className="col-cost">{money(item.unit_price)}</td>
          <td className="col-cost">{money(item.amount)}</td>
        </tr>) : <tr><td colSpan="6" className="print-empty">No item details provided.</td></tr>}

        <tr className="print-summary-row">
          <td colSpan="5" className="print-summary-label">{quote.labor_label || 'LABOR'}</td>
          <td className="col-cost">{money(labor)}</td>
        </tr>
        <tr className="print-total-row">
          <td colSpan="5" className="print-total-label">TOTAL</td>
          <td className="col-cost">{money(grandTotal)}</td>
        </tr>
        <tr className="print-total-row secondary">
          <td colSpan="5" className="print-total-label">REQUIRED 50% DOWN PAYMENT</td>
          <td className="col-cost">{money(downPayment)}</td>
        </tr>
      </tbody>
    </table>

    {quote.notes && <p className="print-notes">{quote.notes}</p>}

    <div className="print-signatures">
      <div className="print-sig">
        <small className="print-sig-label">CHECKED BY</small>
        <span className="print-sig-name"><b>{COMPANY.checkedBy}</b></span>
        <span className="print-sig-title">{COMPANY.checkedByTitle}</span>
      </div>
      <div className="print-sig">
        <small className="print-sig-label">CLIENT APPROVAL</small>
        <span className="print-sig-line" />
        <span className="print-sig-title">Signature over printed name</span>
      </div>
    </div>
  </article>;
}

function SettingsView({ profile, email, resetEmail, onResetEmailChange, onSubmit, onRequestPasswordReset, onChangePassword }) {
  return <div className="settings-layout">
    <section className="panel settings-card">
      <div className="panel-heading"><div><h3>Account settings</h3><p>Manage your personal account details</p></div></div>
      <form className="form-grid" onSubmit={onSubmit}>
        <div className="photo-picker full"><Avatar name={profile?.full_name || email} src={profile?.avatar_url} large /><Field name="avatar" label="Profile picture" type="file" accept="image/*" /></div>
        <Field name="full_name" label="Full name" defaultValue={profile?.full_name || ''} required />
        <Field name="phone" label="Phone" defaultValue={profile?.phone || ''} />
        <label className="field full"><span>Password reset email</span><input name="reset_email" value={resetEmail} onChange={(event) => onResetEmailChange(event.target.value)} /></label>
        <label className="field full"><span>Sign-in email</span><input value={email} readOnly /></label>
        <label className="field full"><span>Access role</span><input value={roles[profile?.role] || profile?.role || ''} readOnly /></label>
        <div className="form-actions left-aligned"><button className="button primary"><Check size={16} /> Save account details</button></div>
      </form>
    </section>
    <section className="panel security-card">
      <div className="security-icon"><KeyRound size={21} /></div>
      <h3>Change password</h3>
      <p>Set a new password for your account. You must be signed in.</p>
      <form className="form-grid" onSubmit={onChangePassword}>
        <label className="field full"><span>New password</span><input name="new_password" type="password" required minLength={6} placeholder="At least 6 characters" /></label>
        <label className="field full"><span>Confirm new password</span><input name="confirm_password" type="password" required minLength={6} /></label>
        <div className="form-actions left-aligned"><button className="button primary"><Check size={16} /> Update password</button></div>
      </form>
    </section>
    <section className="panel security-card">
      <div className="security-icon"><MailPlus size={21} /></div>
      <h3>Forgot password?</h3>
      <p>Send a reset link to your password reset email.</p>
      <button className="text-button" onClick={onRequestPasswordReset}>Send password reset email <ArrowRight size={15} /></button>
    </section>
  </div>;
}

function SupplierField({ customSupplier, setCustomSupplier, defaultValue = '' }) {
  const usingDefault = !customSupplier && (!defaultValue || defaultValue === DEFAULT_SUPPLIER);
  return <div className="field supplier-field">
    <span>Supplier</span>
    {usingDefault ? (
      <div className="supplier-default">
        <input type="hidden" name="supplier" value={DEFAULT_SUPPLIER} />
        <span className="supplier-chip">
          <BriefcaseBusiness size={14} />
          {DEFAULT_SUPPLIER}
          <button type="button" className="supplier-chip-x" title="Use a different supplier" onClick={() => setCustomSupplier(true)}>
            <X size={13} />
          </button>
        </span>
      </div>
    ) : (
      <input name="supplier" placeholder="Enter supplier name" defaultValue={defaultValue && defaultValue !== DEFAULT_SUPPLIER ? defaultValue : ''} autoFocus />
    )}
  </div>;
}

function AdjustStockForm({ item, onAdjust, onCancel }) {
  const [mode, setMode] = useState('remove');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const current = Number(item.stock_qty || 0);
  const parsed = Number(amount || 0);
  const projected = mode === 'remove' ? Math.max(0, current - parsed) : current + parsed;
  const invalid = !parsed || parsed < 1;
  const tooMany = mode === 'remove' && parsed > current;
  const delta = mode === 'remove' ? -parsed : parsed;
  const unitLabel = String(item.unit || 'pcs').trim();

  const requestConfirm = (event) => {
    event.preventDefault();
    if (invalid || tooMany) return;
    setConfirming(true);
  };

  const commit = () => {
    onAdjust(item, delta, note || (mode === 'remove' ? `Used ${parsed}` : `Added ${parsed}`));
  };

  if (confirming) {
    return <div className="form-grid adjust-stock-form">
      <div className="field full">
        <span>Confirm adjustment</span>
        <div className="confirm-adjust-card">
          <p><b>{item.item_name}</b></p>
          <p className="confirm-line">
            <span>{current} {unitLabel}</span>
            <ArrowRight size={14} />
            <span className={mode === 'remove' ? 'confirm-to remove' : 'confirm-to add'}>{projected} {unitLabel}</span>
          </p>
          <small>{mode === 'remove' ? `Using ${parsed}` : `Adding ${parsed}`}{note ? ` · "${note}"` : ''}</small>
        </div>
      </div>
      <div className="form-actions full">
        <button type="button" className="button secondary" onClick={() => setConfirming(false)}>Back</button>
        <button type="button" className="button primary" onClick={commit}><Check size={16} /> Confirm & save</button>
      </div>
    </div>;
  }

  return <form className="form-grid adjust-stock-form" onSubmit={requestConfirm}>
    <div className="field full">
      <span>Item</span>
      <div className="receive-item-card">
        <b>{item.item_name}</b>
        <small>Currently on hand: {current} {unitLabel}</small>
      </div>
    </div>

    <div className="field full adjust-mode">
      <span>What happened?</span>
      <div className="adjust-mode-grid">
        <button type="button" className={mode === 'remove' ? 'adjust-mode-button active remove' : 'adjust-mode-button remove'} onClick={() => setMode('remove')}>
          <Minus size={16} /> Used / Removed
        </button>
        <button type="button" className={mode === 'add' ? 'adjust-mode-button active add' : 'adjust-mode-button add'} onClick={() => setMode('add')}>
          <Plus size={16} /> Added / Received
        </button>
      </div>
    </div>

    <label className="field full">
      <span>{mode === 'remove' ? 'How many used?' : 'How many added?'}</span>
      <input type="number" min="1" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={mode === 'remove' ? 'e.g. 4' : 'e.g. 10'} autoFocus />
      {tooMany && <small className="field-error">Only {current} {unitLabel} available. Cannot remove more than that.</small>}
      {!invalid && !tooMany && (
        <small className="live-preview">
          New total will be <b>{projected} {unitLabel}</b>
          {mode === 'remove' ? ' (minus ' : ' (plus '}{parsed}{')'}
        </small>
      )}
    </label>

    <label className="field full">
      <span>Note (optional)</span>
      <input placeholder={mode === 'remove' ? 'e.g. Used on Reyes residence install' : 'e.g. Delivery from supplier'} value={note} onChange={(e) => setNote(e.target.value)} />
    </label>

    <div className="form-actions full">
      <button type="button" className="button secondary" onClick={onCancel}>Cancel</button>
      <button className="button primary" disabled={invalid || tooMany}><ArrowRight size={16} /> Review & confirm</button>
    </div>
  </form>;
}

function StockHistoryView({ item, transactions }) {
  const sorted = [...transactions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const unitLabel = String(item.unit || 'pcs').trim();
  return <div className="record-details stock-history">
    <div className="receive-item-card">
      <b>{item.item_name}</b>
      <small>Currently on hand: {item.stock_qty} {unitLabel}</small>
    </div>
    <div className="history-list">
      {sorted.length ? sorted.map((t) => {
        const positive = Number(t.quantity) >= 0;
        return <div className="history-row" key={t.id}>
          <div className={`history-badge ${positive ? 'in' : 'out'}`}>
            {positive ? <Plus size={13} /> : <Minus size={13} />}
          </div>
          <div className="history-body">
            <b>{positive ? 'Added' : 'Used'} {Math.abs(t.quantity)} {unitLabel}</b>
            <small>{t.notes || t.transaction_type || 'Stock movement'}</small>
          </div>
          <span className="history-date">{formatDateTime(t.created_at)}</span>
        </div>;
      }) : <div className="empty-state">No stock history yet.</div>}
    </div>
  </div>;
}

function WorkOrderDetails({ order, role, onClose, onStatus, onDelete, onEdit }) {
  const isAdmin = role === 'administrator';

  return <div className="drawer-scrim" onClick={onClose}><aside className="details-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><div className="eyebrow">WORK ORDER</div><h2>{order.client_name}</h2></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div><div className="drawer-content"><div className="detail-chip-row"><Status status={order.status} /><span className="status-chip neutral">{order.service_type}</span></div><Detail label="Client location" value={order.location} icon={MapPin} /><Detail label="Scheduled" value={order.scheduled_at ? `${new Date(order.scheduled_at).toLocaleDateString()}${order.scheduled_time ? ` · ${formatTime(order.scheduled_time)}` : ''}` : 'Not scheduled'} icon={CalendarDays} /><Detail label="Assigned technicians" value={order.work_order_assignments?.map((item) => item.employees?.full_name).filter(Boolean).join(', ') || 'Not assigned'} icon={HardHat} /><div className="detail-block"><b>Required hardware</b>{order.work_order_materials?.length ? order.work_order_materials.map((item) => <p key={item.id}>{item.item_name} <span>{item.quantity} {String(item.unit || 'pcs').trim()}</span></p>) : <small>No hardware list recorded.</small>}</div>{order.notes && <div className="detail-block"><b>Work notes</b><p>{order.notes}</p></div>}{isAdmin && <div className="status-save-row"><span className="status-save-label">Progress this work order</span><div className="status-save-actions">{order.status === 'Pending' && <button className="button primary small-button" type="button" onClick={() => onStatus(order, 'In Progress')}><ArrowRight size={15} /> Start — mark In Progress</button>}{order.status === 'In Progress' && <button className="button primary small-button" type="button" onClick={() => onStatus(order, 'Completed')}><Check size={15} /> Mark Completed</button>}{order.status === 'Completed' && <span className="status-chip completed">Work order completed</span>}</div></div>}</div>{isAdmin && <div className="drawer-actions"><button className="button danger" onClick={() => onDelete(order)}><Trash2 size={16} /> Delete</button><button className="button secondary" onClick={() => onEdit(order)}>Edit details</button></div>}</aside></div>;
}
function Detail({ label, value, icon: Icon }) { return <div className="detail-row"><Icon size={17} /><span><small>{label}</small><b>{value || '—'}</b></span></div>; }
function Modal({ title, children, onClose }) { return <div className="modal-scrim"><section className="modal-card"><header className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={19} /></button></header>{children}</section></div>; }
function Field({ label, name, type = 'text', required = false, ...props }) { return <label className="field"><span>{label}</span><input name={name} type={type} required={required} {...props} /></label>; }
function FormActions({ onCancel }) { return <div className="form-actions full"><button type="button" className="button secondary" onClick={onCancel}>Cancel</button><button className="button primary"><Check size={16} /> Save record</button></div>; }
function EmptyRow({ columns, text }) { return <tr><td colSpan={columns} className="empty-cell">{text}</td></tr>; }

export default App;