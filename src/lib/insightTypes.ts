// Shared (client + server) shape of the Insights payload.
export type Group = "apple" | "google" | "email" | "other";
export const GROUPS: { key: Group; label: string }[] = [
  { key: "apple", label: "Apple" }, { key: "google", label: "Google" }, { key: "email", label: "Email" }, { key: "other", label: "Other" },
];
export interface Person { uid: string; name: string; email: string; photo: string }
export interface Stage { key: string; label: string; overall: number; by: Record<Group, number> }
export interface Insights {
  generatedAt: number;
  excludeTest: boolean;
  testAccounts: number;
  totals: { users: number; byGroup: Record<Group, number> };
  stages: Stage[];
  timeToLeave: { label: string; count: number }[];
  retention: { week: string; users: number; d1: number | null; d7: number | null; d30: number | null }[];
  supply: {
    petsByCountry: { country: string; pets: number; users: number }[];
    petsByCategory: Record<string, number>;
    petsByStatus: Record<string, number>;
    petsPerWeek: { week: string; count: number }[];
    requestsByStatus: Record<string, number>;
    pendingAge: { under3d: number; d3to7: number; d7to14: number; over14d: number };
    unanswered: { uid: string; name: string; email: string; pending: number; oldestDays: number }[];
    topLiked: { id: string; name: string; category: string; likes: number; requests: number }[];
    petsWithNoLikes: number;
  };
  moderation: {
    reportsByStatus: Record<string, number>;
    reports: { id: string; at: number | null; status: string; reason: string; description: string; reporter: Person; reported: Person }[];
    recentPets: { id: string; name: string; category: string; at: number | null; photo: string; owner: Person }[];
    recentPosts: { id: string; caption: string; at: number | null; author: Person; reports: number; photo: string }[];
    testAccountSample: { uid: string; email: string }[];
  };
}
