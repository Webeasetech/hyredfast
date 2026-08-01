import { create } from "zustand";

// Not persisted — this is just a mailbox from the current page to the navbar,
// scoped to a single render, unlike auth/campaign state which survives reloads.
const usePageHeaderStore = create((set) => ({
  title: "",
  description: "",
  setPageHeader: (header) => set(header),
  clearPageHeader: () => set({ title: "", description: "" }),
}));

export default usePageHeaderStore;
