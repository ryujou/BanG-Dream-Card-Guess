import { useEffect, useState } from "react";
import type { Community } from "../../../shared/types";
import { api } from "../../lib/api";
import { communityError, normalizeCommunity, type CommunityContent } from "./model";

export function useCommunity(enabled = true) {
  const [data, setData] = useState<CommunityContent | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setError("");
    api<Community>("/api/community")
      .then(value => { if (active) setData(normalizeCommunity(value)); })
      .catch(error => { if (active) setError(communityError(error)); });
    return () => { active = false; };
  }, [enabled]);
  return { data, error, loading: enabled && !data && !error };
}
