/**
 * Curated reading lists
 * These are hardcoded for simplicity and SEO purposes.
 * Books are matched by genre or can be explicitly listed by slug.
 */

export interface CuratedList {
  slug: string;
  title: string;
  description: string;
  longDescription?: string;
  // Match books by genre (OR logic - any matching genre)
  genres?: string[];
  // Or explicitly list book slugs
  bookSlugs?: string[];
  // Display options
  icon?: string;
  color?: string;
}

export const CURATED_LISTS: CuratedList[] = [
  // Genre-based lists
  {
    slug: "best-fantasy-books",
    title: "Best Fantasy Books",
    description: "Epic worlds, magical adventures, and legendary quests.",
    longDescription:
      "Dive into extraordinary worlds filled with magic, mythical creatures, and epic adventures. From classic high fantasy to modern urban fantasy, these books will transport you to realms beyond imagination.",
    genres: ["Fantasy", "Epic Fantasy", "Urban Fantasy", "High Fantasy"],
    icon: "🐉",
    color: "from-purple-500 to-indigo-600",
  },
  {
    slug: "must-read-mysteries",
    title: "Must-Read Mysteries",
    description: "Gripping whodunits and detective stories that keep you guessing.",
    longDescription:
      "Love a good puzzle? These mystery novels will have you racing to uncover the truth. From cozy mysteries to hard-boiled detective fiction, each book offers twists and turns that will keep you guessing until the last page.",
    genres: ["Mystery", "Crime", "Thriller", "Detective"],
    icon: "🔍",
    color: "from-slate-600 to-slate-800",
  },
  {
    slug: "romance-novels",
    title: "Heartwarming Romance",
    description: "Love stories that will make your heart flutter.",
    longDescription:
      "Whether you prefer slow burns or instant connections, historical settings or contemporary meet-cutes, these romance novels deliver all the feels. Get ready for butterflies, swoons, and happily-ever-afters.",
    genres: ["Romance", "Contemporary Romance", "Historical Romance", "Romantic Comedy"],
    icon: "💕",
    color: "from-pink-500 to-rose-600",
  },
  {
    slug: "science-fiction-essentials",
    title: "Science Fiction Essentials",
    description: "Mind-bending futures and technological wonders.",
    longDescription:
      "Explore the frontiers of human imagination with these science fiction masterpieces. From space operas to dystopian futures, these books challenge our understanding of technology, society, and what it means to be human.",
    genres: ["Science Fiction", "Sci-Fi", "Space Opera", "Dystopian"],
    icon: "🚀",
    color: "from-cyan-500 to-blue-600",
  },
  {
    slug: "literary-fiction",
    title: "Literary Fiction Gems",
    description: "Beautifully written stories that explore the human condition.",
    longDescription:
      "For readers who appreciate exquisite prose and deep character exploration. These literary fiction works offer profound insights into life, relationships, and society through masterful storytelling.",
    genres: ["Literary Fiction", "Contemporary Fiction", "Literary"],
    icon: "📖",
    color: "from-amber-500 to-orange-600",
  },
  {
    slug: "thriller-suspense",
    title: "Edge-of-Your-Seat Thrillers",
    description: "Heart-pounding suspense that will keep you up all night.",
    longDescription:
      "Can't stop, won't stop reading. These thrillers deliver non-stop tension, unexpected twists, and protagonists in perilous situations. Perfect for readers who love their books fast-paced and pulse-pounding.",
    genres: ["Thriller", "Suspense", "Psychological Thriller"],
    icon: "😰",
    color: "from-red-500 to-red-700",
  },
  {
    slug: "historical-fiction",
    title: "Historical Fiction Favorites",
    description: "Journey through time with these captivating stories.",
    longDescription:
      "Travel back in time through the pages of these historical fiction novels. Experience pivotal moments in history, meet fascinating characters, and gain new perspectives on the events that shaped our world.",
    genres: ["Historical Fiction", "Historical", "History"],
    icon: "🏛️",
    color: "from-stone-500 to-stone-700",
  },
  {
    slug: "cozy-reads",
    title: "Cozy Comfort Reads",
    description: "Warm, feel-good books perfect for relaxing.",
    longDescription:
      "Sometimes you need a book that feels like a warm hug. These cozy reads offer comfort, charm, and gentle stories that will leave you feeling content. Perfect companions for rainy days and quiet evenings.",
    genres: ["Cozy Mystery", "Women's Fiction", "Cozy"],
    icon: "☕",
    color: "from-orange-400 to-amber-500",
  },
  // Theme-based lists
  {
    slug: "books-about-books",
    title: "Books About Books",
    description: "For readers who love reading about reading.",
    longDescription:
      "Meta-reading at its finest! These novels celebrate the love of literature, featuring bookshops, libraries, and characters who share our passion for the written word.",
    genres: ["Books About Books", "Literary Fiction"],
    icon: "📚",
    color: "from-emerald-500 to-teal-600",
  },
  {
    slug: "debut-novels",
    title: "Stunning Debut Novels",
    description: "First-time authors who made an unforgettable impression.",
    longDescription:
      "Discover fresh voices in fiction. These debut novels announced the arrival of exciting new talents in the literary world. Each one showcases a unique perspective and storytelling style.",
    genres: ["Debut", "Contemporary Fiction"],
    icon: "⭐",
    color: "from-yellow-400 to-amber-500",
  },
  {
    slug: "book-club-picks",
    title: "Book Club Favorites",
    description: "Discussion-worthy reads perfect for your next meeting.",
    longDescription:
      "Looking for your book club's next read? These novels offer rich themes, complex characters, and plenty to discuss. Each book will spark meaningful conversations and diverse opinions.",
    genres: ["Book Club", "Literary Fiction", "Contemporary Fiction"],
    icon: "👥",
    color: "from-violet-500 to-purple-600",
  },
  {
    slug: "page-turners",
    title: "Unputdownable Page-Turners",
    description: "Books so gripping you'll lose track of time.",
    longDescription:
      "Warning: these books may cause sleep deprivation. Once you start, you won't be able to stop. Fast-paced, compelling, and absolutely addictive storytelling awaits.",
    genres: ["Thriller", "Mystery", "Suspense", "Page-Turner"],
    icon: "⚡",
    color: "from-indigo-500 to-purple-600",
  },
];

/**
 * Get a curated list by slug
 */
export function getCuratedList(slug: string): CuratedList | undefined {
  return CURATED_LISTS.find((list) => list.slug === slug);
}

/**
 * Get all curated list slugs (for static generation)
 */
export function getAllListSlugs(): string[] {
  return CURATED_LISTS.map((list) => list.slug);
}
