export type Platform = 'Android' | 'iOS' | 'Web' | 'PC' | 'macOS';
export type ReleaseStatus = 'Available' | 'Coming Soon' | 'Updated' | 'In Beta';

export interface GameRequirements {
  min_android?: string;
  target_android?: string;
  storage?: string;
  ram?: string;
  internet?: string;
}

export interface Release {
  id: string;
  game_id: string;
  version_name: string;
  version_code: number;
  release_date: string;
  release_notes: string;
  apk_filename: string;
  original_filename?: string;
  apk_file_size: number;
  apk_download_url: string;
  min_sdk: number;
  target_sdk: number;
  is_published: boolean;
  download_count: number;
  created_at: string;
  game_title?: string;
}

export interface Game {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  description: string;
  genre: string[];
  platforms: Platform[];
  status: ReleaseStatus;
  featured: boolean;
  cover_image: string;
  banner_image?: string;
  screenshots: string[];
  trailer_url?: string;
  features: string[];
  controls: string[];
  requirements: GameRequirements;
  developer: string;
  created_at: string;
  updated_at: string;
  latest_release?: Release;
}

export interface User {
  id: string;
  username: string;
  role: 'superadmin' | 'admin';
}

export type ProductCategory = 'Websites' | 'Web Applications' | 'Mobile Applications' | 'Games' | 'Custom Software';
export type ProductPlatform = 'Web' | 'Android' | 'iOS' | 'Desktop' | 'Cross-platform';
export type ProductStatus = 'Draft' | 'Published';

export interface Product {
  id: string;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  category: ProductCategory;
  cover_image: string;
  gallery?: string[];
  technologies: string[];
  project_url?: string;
  github_url?: string;
  play_store_url?: string;
  apk_download_url?: string;
  platform: ProductPlatform;
  status: ProductStatus;
  featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

export interface DashboardStats {
  total_games: number;
  published_games: number;
  total_releases: number;
  total_downloads: number;
  total_products?: number;
  published_products?: number;
  draft_products?: number;
}


// Media & Asset Manager (Phase 4.3.6)
export type MediaBucket = 'game-assets' | 'product-assets' | 'release-apks';

export interface MediaReference {
  type: 'game' | 'product' | 'release';
  id: string;
  title: string;
  field: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  path: string;
  bucket: MediaBucket;
  size: number;
  contentType: string;
  createdAt: string;
  updatedAt: string;
  url: string | null;
  visibility: 'public' | 'private';
  is_referenced: boolean;
  is_protected: boolean;
  referenced_by: MediaReference[];
}

export interface MediaStats {
  total_assets: number;
  image_assets: number;
  game_images: number;
  product_images: number;
  apk_releases: number;
  total_storage_bytes: number;
  storage_by_bucket: Record<
    MediaBucket,
    { count: number; bytes: number; visibility: 'public' | 'private' }
  >;
}
