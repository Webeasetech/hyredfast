import { create } from "zustand";

const useCampaignStore = create((set) => ({
  // Campaign data
  currentCampaign: null,

  // Leads/contacts data. The list pages by company/role group, so `leadGroups`
  // is the shape the table renders and `leads` is the same rows flattened, for
  // lookups that only care about a lead by id.
  leads: [],
  leadGroups: [],
  totalLeads: 0,
  totalGroups: 0,
  currentPage: 1,
  totalPages: 1,
  searchQuery: "",

  // Set current campaign
  setCurrentCampaign: (campaign) => {
    set({ currentCampaign: campaign });
  },

  // Set leads data
  setLeadsData: (data) => {
    const groups = data.groups || [];
    set({
      leadGroups: groups,
      leads: groups.flatMap((group) => group.items || []),
      totalLeads: data.totalItems || 0,
      totalGroups: data.totalGroups || 0,
      totalPages: data.totalPages || 1,
    });
  },

  // Set pagination
  setPage: (page) => {
    set({ currentPage: page });
  },

  // Set search query
  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  // Reset campaign store
  resetCampaignStore: () => {
    set({
      currentCampaign: null,
      leads: [],
      leadGroups: [],
      totalLeads: 0,
      totalGroups: 0,
      currentPage: 1,
      totalPages: 1,
      searchQuery: "",
    });
  },
}));

export default useCampaignStore;
