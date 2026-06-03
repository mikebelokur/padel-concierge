import type { Mode } from "@/hooks/useActiveMode";

export interface NavEntry {
  href: string;
  labelKey: string;
  icon: string;
  badgeKey?: string;
}

export interface NavConfig {
  /** Primary tabs shown in the bottom nav bar (mobile) as headline destinations. */
  primary: NavEntry[];
  /** Tertiary tabs — profile / rules / settings cluster, also in bottom nav. */
  tertiary: NavEntry[];
  /** Extra entries shown in the desktop sidebar / drawer below the primary. */
  drawerExtras: NavEntry[];
}

const PLAYER_PRIMARY: NavEntry[] = [
  { href: "/training", labelKey: "nav.training", icon: "🎓" },
  { href: "/play", labelKey: "nav.play", icon: "🎾", badgeKey: "pendingRequests" },
];

const PLAYER_TERTIARY: NavEntry[] = [
  { href: "/profile", labelKey: "nav.profile", icon: "👤" },
  { href: "/rules", labelKey: "nav.padelRules", icon: "📖" },
  { href: "/settings", labelKey: "nav.settings", icon: "⚙️" },
];

const COACH_PRIMARY: NavEntry[] = [
  { href: "/training", labelKey: "nav.training", icon: "🎓" },
  { href: "/clients", labelKey: "nav.myClients", icon: "👥" },
];

const COACH_TERTIARY: NavEntry[] = [
  { href: "/messages", labelKey: "nav.messages", icon: "💬" },
  { href: "/profile", labelKey: "nav.profile", icon: "👤" },
  { href: "/settings", labelKey: "nav.settings", icon: "⚙️" },
];

const COACH_DRAWER_EXTRAS: NavEntry[] = [
  { href: "/coach", labelKey: "nav.coachHub", icon: "🏆" },
  { href: "/coach/group-trainings", labelKey: "nav.groupTrainings", icon: "📅" },
  { href: "/level-quiz/admin", labelKey: "nav.levelQuizResults", icon: "📋" },
  { href: "/clubs", labelKey: "nav.clubs", icon: "🏢" },
  { href: "/rules", labelKey: "nav.padelRules", icon: "📖" },
  { href: "/news", labelKey: "nav.newsAndTips", icon: "📰" },
];

const ADMIN_DRAWER_EXTRAS: NavEntry[] = [
  { href: "/coach", labelKey: "nav.coachHub", icon: "🏆" },
  { href: "/clients", labelKey: "nav.myClients", icon: "👥" },
  { href: "/messages", labelKey: "nav.messages", icon: "💬" },
  { href: "/coach/group-trainings", labelKey: "nav.groupTrainings", icon: "📅" },
  { href: "/registrations", labelKey: "nav.registrations", icon: "🆕", badgeKey: "pending" },
  { href: "/members", labelKey: "nav.members", icon: "👤" },
  { href: "/courts", labelKey: "nav.courts", icon: "🏟️" },
  { href: "/admin/clubs", labelKey: "nav.adminClubs", icon: "🏢" },
  { href: "/admin/slots", labelKey: "nav.adminSlots", icon: "🗓️" },
  { href: "/level-quiz/admin", labelKey: "nav.levelQuizResults", icon: "📋" },
  { href: "/rules", labelKey: "nav.padelRules", icon: "📖" },
  { href: "/news", labelKey: "nav.newsAndTips", icon: "📰" },
  { href: "/admin", labelKey: "nav.adminPanel", icon: "🔧" },
  { href: "/admin/users", labelKey: "nav.adminUsers", icon: "👥" },
];

const DEVELOPER_DRAWER_EXTRAS: NavEntry[] = [
  ...ADMIN_DRAWER_EXTRAS,
  { href: "/assessment", labelKey: "nav.assessment", icon: "📊" },
  { href: "/quiz", labelKey: "nav.archetypeQuiz", icon: "🧠" },
  { href: "/level-quiz", labelKey: "nav.levelQuiz", icon: "📊" },
  { href: "/video-analysis", labelKey: "nav.videoAnalysis", icon: "🎬" },
];

export function getNavConfig(mode: Mode): NavConfig {
  switch (mode) {
    case "player":
      return {
        primary: PLAYER_PRIMARY,
        tertiary: PLAYER_TERTIARY,
        drawerExtras: [
          { href: "/dashboard", labelKey: "nav.dashboard", icon: "◈" },
          { href: "/clubs", labelKey: "nav.clubs", icon: "🏢" },
          { href: "/news", labelKey: "nav.newsAndTips", icon: "📰" },
        ],
      };
    case "coach":
      return {
        primary: COACH_PRIMARY,
        tertiary: COACH_TERTIARY,
        drawerExtras: [
          { href: "/dashboard", labelKey: "nav.dashboard", icon: "◈" },
          ...COACH_DRAWER_EXTRAS,
        ],
      };
    case "admin":
      return {
        primary: [
          { href: "/dashboard", labelKey: "nav.dashboard", icon: "◈" },
          { href: "/training", labelKey: "nav.training", icon: "🎓" },
          { href: "/play", labelKey: "nav.play", icon: "🎾" },
        ],
        tertiary: [
          { href: "/admin", labelKey: "nav.adminPanel", icon: "🔧", badgeKey: "pending" },
          { href: "/settings", labelKey: "nav.settings", icon: "⚙️" },
        ],
        drawerExtras: ADMIN_DRAWER_EXTRAS,
      };
    case "developer":
      return {
        primary: [
          { href: "/dashboard", labelKey: "nav.dashboard", icon: "◈" },
          { href: "/training", labelKey: "nav.training", icon: "🎓" },
          { href: "/play", labelKey: "nav.play", icon: "🎾" },
        ],
        tertiary: [
          { href: "/admin", labelKey: "nav.adminPanel", icon: "🔧", badgeKey: "pending" },
          { href: "/profile", labelKey: "nav.profile", icon: "👤" },
          { href: "/settings", labelKey: "nav.settings", icon: "⚙️" },
        ],
        drawerExtras: DEVELOPER_DRAWER_EXTRAS,
      };
  }
}

export interface SectionCard {
  href: string;
  titleKey: string;
  descKey: string;
  icon: string;
  /** When true, the card is shown greyed-out and is not clickable. */
  disabled?: boolean;
}

export const TRAINING_CARDS: SectionCard[] = [
  { href: "/bookings", titleKey: "training.myCalendar", descKey: "training.myCalendarDesc", icon: "📅" },
  { href: "/group-trainings", titleKey: "training.group", descKey: "training.groupDesc", icon: "👥" },
  { href: "/messages", titleKey: "training.myCoach", descKey: "training.myCoachDesc", icon: "🎓", disabled: true },
  { href: "/profile", titleKey: "training.progress", descKey: "training.progressDesc", icon: "📈", disabled: true },
];

export const PLAY_CARDS: SectionCard[] = [
  { href: "/find-match", titleKey: "play.findMatch", descKey: "play.findMatchDesc", icon: "🎯" },
  { href: "/matches", titleKey: "play.myMatches", descKey: "play.myMatchesDesc", icon: "🎾" },
  { href: "/match-requests", titleKey: "play.requests", descKey: "play.requestsDesc", icon: "📨" },
  { href: "/members", titleKey: "play.partners", descKey: "play.partnersDesc", icon: "👤" },
];
