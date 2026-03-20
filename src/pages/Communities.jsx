import React, { useState } from "react"; 
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; 
 import { Link } from "react-router-dom"; 
 import { communitiesAPI, authAPI } from "@/api/apiClient"; 
 import { Users, Plus, Search, TrendingUp, Loader2 } from "lucide-react"; 
 import { Input } from "@/components/ui/input"; 
 import { Button } from "@/components/ui/button"; 
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"; 
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; 
 import { Textarea } from "@/components/ui/textarea"; 
 import { toast } from "sonner"; 
 import { motion } from "framer-motion"; 
 
 const COMMUNITY_CATEGORIES = [ 
   { id: "fashion", label: "Fashion", emoji: "👗" }, 
   { id: "tech", label: "Tech", emoji: "💻" }, 
   { id: "fitness", label: "Fitness", emoji: "💪" }, 
   { id: "food", label: "Food", emoji: "🍕" }, 
   { id: "art", label: "Art", emoji: "🎨" }, 
   { id: "music", label: "Music", emoji: "🎵" }, 
   { id: "gaming", label: "Gaming", emoji: "🎮" }, 
   { id: "travel", label: "Travel", emoji: "✈️" }, 
   { id: "diy", label: "DIY", emoji: "🛠️" }, 
 ]; 
 
 export default function Communities() { 
   const [search, setSearch] = useState(""); 
   const [createOpen, setCreateOpen] = useState(false); 
   const [newCommunity, setNewCommunity] = useState({ name: "", description: "", category: "tech" }); 
   const queryClient = useQueryClient(); 
 
   const { data: currentUser } = useQuery({ 
     queryKey: ["currentUser"], 
     queryFn: () => authAPI.me(), 
   }); 
 
  const { data: communitiesData, isLoading } = useQuery({ 
    queryKey: ["communities"], 
    queryFn: async () => {
      const res = await communitiesAPI.list({ limit: 50 });
      // The API returns { communities: [...], pagination: {...} }
      return res.communities || res.data || res || [];
    },
  }); 

  const communities = Array.isArray(communitiesData) ? communitiesData : (communitiesData?.communities || []);
 
   // Note: current backend doesn't have a specific membership filter endpoint yet
   // We'll treat communities where the user is the owner as 'joined' for now
   // This will need adjustment if membership status is tracked separately in backend
   const joinedIds = new Set(communities.filter(c => c.owner_email === currentUser?.email).map(c => c._id || c.id)); 
 
   const createMutation = useMutation({ 
     mutationFn: async () => { 
       await communitiesAPI.create({ 
         ...newCommunity, 
         owner_email: currentUser.email, 
       }); 
     }, 
     onSuccess: () => { 
       toast.success("Community created!"); 
       setCreateOpen(false); 
       setNewCommunity({ name: "", description: "", category: "tech" }); 
       queryClient.invalidateQueries({ queryKey: ["communities"] }); 
     }, 
   }); 
 
   const filtered = search 
     ? communities.filter(c => c.name?.toLowerCase().includes(search.toLowerCase())) 
     : communities; 
 
   const myCommunities = communities.filter(c => joinedIds.has(c._id || c.id) || c.owner_email === currentUser?.email); 
   const discoverCommunities = filtered.filter(c => !joinedIds.has(c._id || c.id) && c.owner_email !== currentUser?.email); 
 
   return ( 
     <div className="max-w-4xl mx-auto px-4 py-6"> 
       <div className="flex items-center justify-between mb-6"> 
         <h1 className="text-2xl font-bold text-slate-900">Communities</h1> 
         <Dialog open={createOpen} onOpenChange={setCreateOpen}> 
           <DialogTrigger asChild> 
             <Button className="bg-indigo-600 hover:bg-indigo-700 rounded-xl"> 
               <Plus className="w-4 h-4 mr-1.5" /> Create 
             </Button> 
           </DialogTrigger> 
           <DialogContent className="rounded-2xl"> 
             <DialogHeader> 
               <DialogTitle>Create Community</DialogTitle> 
             </DialogHeader> 
             <div className="space-y-4 pt-4"> 
               <div className="space-y-2">
                 <label className="text-sm font-medium">Name</label>
                 <Input 
                   placeholder="Community name" 
                   value={newCommunity.name} 
                   onChange={(e) => setNewCommunity(p => ({ ...p, name: e.target.value }))} 
                   className="rounded-xl"
                 /> 
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-medium">Description</label>
                 <Textarea 
                   placeholder="What is this community about?" 
                   value={newCommunity.description} 
                   onChange={(e) => setNewCommunity(p => ({ ...p, description: e.target.value }))} 
                   className="rounded-xl min-h-[100px]"
                 /> 
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-medium">Category</label>
                 <Select value={newCommunity.category} onValueChange={(v) => setNewCommunity(p => ({ ...p, category: v }))}> 
                   <SelectTrigger className="rounded-xl"><SelectValue placeholder="Category" /></SelectTrigger> 
                   <SelectContent className="rounded-xl"> 
                     {COMMUNITY_CATEGORIES.map(c => ( 
                       <SelectItem key={c.id} value={c.id}>{c.emoji} {c.label}</SelectItem> 
                     ))} 
                   </SelectContent> 
                 </Select> 
               </div>
               <Button 
                 onClick={() => createMutation.mutate()} 
                 disabled={!newCommunity.name.trim() || createMutation.isPending} 
                 className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl py-6 text-base font-bold shadow-lg shadow-indigo-100" 
               > 
                 {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} 
                 Create Community 
               </Button> 
             </div> 
           </DialogContent> 
         </Dialog> 
       </div> 
 
       <div className="relative mb-8"> 
         <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /> 
         <Input 
           placeholder="Search communities..." 
           value={search} 
           onChange={(e) => setSearch(e.target.value)} 
           className="pl-9 h-12 rounded-xl shadow-sm border-slate-200" 
         /> 
       </div> 
 
       {/* My Communities */} 
       {myCommunities.length > 0 && ( 
         <div className="mb-10"> 
           <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
             <Users className="w-5 h-5 text-indigo-500" /> My Communities
           </h2> 
           <div className="grid sm:grid-cols-2 gap-4"> 
             {myCommunities.map((c) => ( 
               <CommunityCard key={c._id || c.id} community={c} joined /> 
             ))} 
           </div> 
         </div> 
       )} 
 
       {/* Discover */} 
       <div> 
         <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"> 
           <TrendingUp className="w-5 h-5 text-green-500" /> Discover 
         </h2> 
         {isLoading ? (
           <div className="grid sm:grid-cols-2 gap-4">
             {[1, 2, 3, 4].map(i => (
               <div key={i} className="h-40 bg-slate-100 animate-pulse rounded-2xl"></div>
             ))}
           </div>
         ) : discoverCommunities.length === 0 ? ( 
           <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200"> 
             <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
             <p className="text-slate-500 font-medium">No communities to discover</p> 
           </div> 
         ) : ( 
           <div className="grid sm:grid-cols-2 gap-4"> 
             {discoverCommunities.map((c) => ( 
               <CommunityCard key={c._id || c.id} community={c} /> 
             ))} 
           </div> 
         )} 
       </div> 
     </div> 
   ); 
 } 
 
 function CommunityCard({ community, joined = false }) { 
   const catEmoji = COMMUNITY_CATEGORIES.find(c => c.id === community.category)?.emoji || "👥"; 
 
   return ( 
     <Link to={`/CommunityDetail?id=${community._id}`}> 
       <motion.div 
         whileHover={{ y: -4 }} 
         className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-xl transition-all h-full shadow-sm" 
       > 
         <div className="h-28 bg-gradient-to-br from-indigo-400 via-purple-400 to-pink-400 relative"> 
           {community.cover_image && <img src={community.cover_image} alt="" className="w-full h-full object-cover" />} 
           {joined && ( 
             <div className="absolute top-3 right-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-bold uppercase tracking-wider text-indigo-600 shadow-sm"> 
               Joined 
             </div> 
           )} 
         </div> 
         <div className="p-5 -mt-6 relative"> 
           <div className="w-12 h-12 rounded-xl bg-white shadow-md border border-slate-100 flex items-center justify-center text-xl mb-3"> 
             {catEmoji} 
           </div> 
           <h3 className="text-base font-bold text-slate-900 truncate">{community.name}</h3> 
           <p className="text-xs text-slate-500 line-clamp-2 mt-1.5 leading-relaxed">{community.description}</p> 
           <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-tight"> 
             <span className="flex items-center gap-1">
               <Users className="w-3.5 h-3.5" /> 
               {community.member_count || 0} members 
             </span>
           </div> 
         </div> 
       </motion.div> 
     </Link> 
   ); 
 } 
