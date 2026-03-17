import React, { useState } from "react";
import { storiesAPI } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import StoryViewer from "./StoryViewer";
import CreateStoryModal from "./CreateStoryModal";

export default function StoriesRow({ currentUser }) {
  const [viewingGroup, setViewingGroup] = useState(null); // { stories, startIndex }
  const [showCreate, setShowCreate] = useState(false);

  const { data: response } = useQuery({
    queryKey: ["stories"],
    queryFn: () => storiesAPI.list({ is_active: true, sort: "-created_at", limit: 50 }),
    refetchInterval: 30000,
  });

  const rawStories = response?.data || response?.stories || [];

  // Filter to active (within 24h)
  const now = Date.now();
  const stories = rawStories.filter(s => !s.expires_at || new Date(s.expires_at).getTime() > now);

  // Group by author
  const authorMap = {};
  stories.forEach(s => {
    if (!authorMap[s.author_email]) {
      authorMap[s.author_email] = { email: s.author_email, name: s.author_name, stories: [] };
    }
    authorMap[s.author_email].stories.push(s);
  });
  const groups = Object.values(authorMap);

  // Check if current user has a story
  const myStory = groups.find(g => g.email === currentUser?.email);

  return (
    <>
      <div className="py-3 -mx-4 px-4 overflow-x-auto hide-scrollbar">
        <div className="flex gap-3">
          {/* Add story button */}
          <button
            onClick={() => setShowCreate(true)}
            className="shrink-0 flex flex-col items-center gap-1.5"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border-2 border-dashed border-indigo-300 flex items-center justify-center relative overflow-hidden">
              {myStory ? (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                  {currentUser?.full_name?.[0]?.toUpperCase() || "U"}
                </div>
              ) : (
                <Plus className="w-6 h-6 text-indigo-500" />
              )}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Your Story</span>
          </button>

          {/* Other stories */}
          {groups.filter(g => g.email !== currentUser?.email).map(group => (
            <button
              key={group.email}
              onClick={() => setViewingGroup({ stories: group.stories, startIndex: 0 })}
              className="shrink-0 flex flex-col items-center gap-1.5"
            >
              <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold border-2 border-white text-sm">
                  {group.name?.[0]?.toUpperCase() || "U"}
                </div>
              </div>
              <span className="text-[10px] text-slate-500 font-medium max-w-[56px] truncate">{group.name?.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {viewingGroup && (
          <StoryViewer
            stories={viewingGroup.stories}
            startIndex={viewingGroup.startIndex}
            onClose={() => setViewingGroup(null)}
          />
        )}
        {showCreate && (
          <CreateStoryModal currentUser={currentUser} onClose={() => setShowCreate(false)} />
        )}
      </AnimatePresence>
    </>
  );
}