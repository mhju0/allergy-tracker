import { Alert, type AlertButton } from 'react-native';

// iOS alerts split Korean words mid-syllable ("소아청" / "소년과") and ignore
// word joiners, so app alerts render in DialogHost with the app's Text. The
// newest active host shows the dialog: a sheet's host while that sheet is
// focused, otherwise the root one. Without a host (tests, or before the root
// layout mounts) the native alert is the fallback.
export type Dialog = { id: number; title: string; message?: string; buttons?: AlertButton[] };
type Snapshot = { dialogs: Dialog[]; hosts: number[] };

let snapshot: Snapshot = { dialogs: [], hosts: [] };
let nextId = 1;
const listeners = new Set<() => void>();

function update(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

export function subscribeDialogs(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getDialogSnapshot() {
  return snapshot;
}

export function newDialogHostId() {
  return nextId++;
}

export function registerDialogHost(id: number) {
  update({ hosts: [...snapshot.hosts, id] });
  return () => update({ hosts: snapshot.hosts.filter((host) => host !== id) });
}

export function dismissDialog(id: number) {
  update({ dialogs: snapshot.dialogs.filter((dialog) => dialog.id !== id) });
}

export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (snapshot.hosts.length === 0) {
    if (message === undefined && buttons === undefined) Alert.alert(title);
    else Alert.alert(title, message, buttons);
    return;
  }
  update({ dialogs: [...snapshot.dialogs, { id: nextId++, title, message, buttons }] });
}
