export interface QueueScoreEntry {
  id?: string;
  username: string;
  score: number;
  duration: number;
  at: number;
}

export interface NoteShooterScoreEntry {
  id: string;
  player_id: string;
  player_name: string;
  levels: string;
  difficulty: number;
  fps: number;
  win: number;
  ranks: string;
  duration: number;
  kuma_kill: number;
  kuma_live: number;
  max_combo: number;
  life: number;
  life_lost: number;
  boss_ratio: number;
  bullet_ratio: number;
  item_ratio: number;
  final_score: number;
  full_combo: number;
  create_time: string;
  at: number;
  user_rank?: number;
}

export interface QueueScoreState {
  total: number;
  top: QueueScoreEntry[];
  recent: QueueScoreEntry[];
}

export interface NoteShooterScoreState {
  total: number;
  leaderboard: Array<{
    id: string;
    username: string;
    playerId: string;
    score: number;
    duration: number;
    max_combo: number;
    full_combo: number;
    rank: string;
    level: string;
    difficulty: number;
    at: number;
  }>;
  recent: NoteShooterScoreState["leaderboard"];
}
