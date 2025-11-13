// Forum Types
export interface ForumPost {
  id: string;
  user_id: string;
  model: string;
  title: string;
  content: string;
  image_urls: string[];
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
}

export interface ForumPostWithUser extends ForumPost {
  profiles?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface ForumComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ForumCommentWithUser extends ForumComment {
  profiles?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface PostLike {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface CreateForumPostData {
  model: string;
  title: string;
  content: string;
  image_urls?: string[];
}

export interface CreateCommentData {
  post_id: string;
  content: string;
}

