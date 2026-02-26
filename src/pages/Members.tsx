import { useState, useMemo } from "react";
import { TEAM_PERSONS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Users, GripVertical, PlusCircle, Search, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTeamPersons, buildTeamToPersonsMap } from "@/hooks/useTeamPersons";
import { useTeams } from "@/hooks/useTeams";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { getTeamColors, getTeamDotColor, getTeamDotStyle } from "@/lib/team-colors";
import { PersonName } from "@/components/PersonName";

export default function Members() {
  const { toast } = useToast();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const queryClient = useQueryClient();

  const { data: allTeamPersons = [] } = useTeamPersons(true);
  const { data: teams = [] } = useTeams();

  // Build maps
  const { teamToPersons, allMembers, assignedMembers, allWallets } = useMemo(() => {
    const map = buildTeamToPersonsMap(allTeamPersons);

    // All unique members (master list) from DB + static
    const allPersons = new Set<string>();
    Object.values(TEAM_PERSONS).forEach(members =>
      members.forEach(p => { if (p !== "Team") allPersons.add(p); })
    );
    allTeamPersons.forEach(tp => allPersons.add(tp.person_name));

    // CSB shows all members
    map.set("CSB", Array.from(allPersons).sort());

    // Members already assigned to a non-CSB team
    const assignedMembers = new Set<string>();
    for (const [t, members] of map.entries()) {
      if (t === "CSB") continue;
      members.forEach(p => assignedMembers.add(p));
    }

    return {
      teamToPersons: map,
      allMembers: Array.from(allPersons).sort(),
      assignedMembers,
      allWallets: ["CSB", ...teams],
    };
  }, [allTeamPersons, teams]);

  // ---- Create new team ----
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");

  const handleAddTeam = async () => {
    const name = newTeamName.trim().toUpperCase();
    if (!name || name.length < 2) {
      toast({ title: "Invalid name", description: "Team name must be at least 2 characters.", variant: "destructive" });
      return;
    }
    if (allWallets.includes(name)) {
      toast({ title: "Team exists", description: `Team ${name} already exists.`, variant: "destructive" });
      return;
    }
    // Insert into teams table (empty team)
    const { error } = await supabase.from("teams").insert({ name });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Team created", description: `Team ${name} created. You can add members later.` });
    setNewTeamName("");
    setAddTeamOpen(false);
    queryClient.invalidateQueries({ queryKey: ["teams_list"] });
  };

  const handleDeleteTeam = async (team: string) => {
    // Delete all members from this team
    await supabase.from("team_persons").delete().eq("team", team);
    // Delete from teams table
    const { error } = await supabase.from("teams").delete().eq("name", team);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Team deleted", description: `Team ${team} removed.` });
    queryClient.invalidateQueries({ queryKey: ["team_persons"] });
    queryClient.invalidateQueries({ queryKey: ["teams_list"] });
  };

  // ---- Master member add (CSB card) ----
  const [masterAddOpen, setMasterAddOpen] = useState(false);
  const [masterNewName, setMasterNewName] = useState("");

  const handleMasterAdd = async () => {
    const name = masterNewName.trim().toUpperCase();
    if (!name || name.length < 2) {
      toast({ title: "Invalid name", description: "Name must be at least 2 characters.", variant: "destructive" });
      return;
    }
    if (allMembers.includes(name)) {
      toast({ title: "Already exists", description: `${name} is already a member.`, variant: "destructive" });
      return;
    }
    // Add to CSB team in team_persons so they exist in the system
    const { error } = await supabase.from("team_persons").insert({ team: "CSB", person_name: name });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Member added", description: `${name} added to the organization.` });
    setMasterNewName("");
    setMasterAddOpen(false);
    queryClient.invalidateQueries({ queryKey: ["team_persons"] });
  };

  // Master member delete: remove from ALL teams
  const handleMasterDelete = async (person: string) => {
    const { error } = await supabase.from("team_persons").delete().eq("person_name", person);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Member removed", description: `${person} removed from all teams.` });
    queryClient.invalidateQueries({ queryKey: ["team_persons"] });
  };

  // ---- Team-level quick add member ----
  const [quickAddTeam, setQuickAddTeam] = useState<string | null>(null);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddPopoverOpen, setQuickAddPopoverOpen] = useState(false);

  const handleQuickAdd = async (team: string) => {
    const name = quickAddName.trim().toUpperCase();
    if (!name || name.length < 2) {
      toast({ title: "Invalid name", description: "Name must be at least 2 characters.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("team_persons").insert({ team, person_name: name });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Member added", description: `${name} added to Team ${team}.` });
    setQuickAddName("");
    setQuickAddTeam(null);
    queryClient.invalidateQueries({ queryKey: ["team_persons"] });
  };

  // Delete member from a specific team
  const handleDeleteFromTeam = async (person: string, team: string) => {
    const { error } = await supabase
      .from("team_persons")
      .delete()
      .eq("person_name", person)
      .eq("team", team);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Member removed", description: `${person} removed from Team ${team}.` });
    queryClient.invalidateQueries({ queryKey: ["team_persons"] });
  };

  // ---- Drag and drop ----
  const [dragPerson, setDragPerson] = useState<{ name: string; fromTeam: string } | null>(null);

  const handleDragStart = (person: string, fromTeam: string) => {
    if (!isAdmin) return;
    setDragPerson({ name: person, fromTeam });
  };

  const handleDrop = async (toTeam: string) => {
    if (!dragPerson || !isAdmin) return;
    if (dragPerson.fromTeam === toTeam || toTeam === "CSB") {
      setDragPerson(null);
      return;
    }

    const { error: delErr } = await supabase
      .from("team_persons")
      .delete()
      .eq("person_name", dragPerson.name)
      .eq("team", dragPerson.fromTeam);

    if (delErr) {
      toast({ title: "Error", description: delErr.message, variant: "destructive" });
      setDragPerson(null);
      return;
    }

    const existing = allTeamPersons.find(tp => tp.person_name === dragPerson.name && tp.team === toTeam);
    if (!existing) {
      const { error: insErr } = await supabase
        .from("team_persons")
        .insert({ team: toTeam, person_name: dragPerson.name });
      if (insErr) {
        toast({ title: "Error", description: insErr.message, variant: "destructive" });
        setDragPerson(null);
        return;
      }
    }

    toast({ title: "Member moved", description: `${dragPerson.name} moved to ${toTeam}.` });
    setDragPerson(null);
    queryClient.invalidateQueries({ queryKey: ["team_persons"] });
  };

  const [csbSearch, setCsbSearch] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Team Members</h2>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Manage members across all teams. Drag to move between teams." : "View members across all teams."}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={addTeamOpen} onOpenChange={setAddTeamOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" /> New Team
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Create New Team</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Team Name</Label>
                  <Input
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value.toUpperCase())}
                    placeholder="e.g. FFF"
                    className="h-9 text-sm"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Team will be created empty. Add members anytime.</p>
                <Button onClick={handleAddTeam} className="w-full" size="sm">Create Team</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* ===== MASTER CARD (CSB) ===== */}
      {(() => {
        const masterMembers = (teamToPersons.get("CSB") ?? []);
        const dotColor = getTeamDotColor("CSB");
        return (
          <Card className="border-2 border-primary/20 bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <span className={`h-3.5 w-3.5 rounded-full ${dotColor}`} style={getTeamDotStyle("CSB")} />
                  <Users className="h-5 w-5 text-primary" />
                  <span className="font-semibold">All Members</span>
                  <Badge variant="outline" className="text-[10px] font-medium uppercase tracking-wider">Master</Badge>
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{masterMembers.length}</Badge>
                  {isAdmin && (
                    <Dialog open={masterAddOpen} onOpenChange={setMasterAddOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
                          <Plus className="h-3 w-3" /> Add Member
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-sm">
                        <DialogHeader>
                          <DialogTitle>Add New Member</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Name (initials)</Label>
                            <Input
                              value={masterNewName}
                              onChange={e => setMasterNewName(e.target.value.toUpperCase())}
                              placeholder="e.g. ABC"
                              className="h-9 text-sm"
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground">New member will be available across the entire app. Assign to teams separately.</p>
                          <Button onClick={handleMasterAdd} className="w-full" size="sm">Add Member</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {masterMembers.length > 0 && (
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={csbSearch}
                    onChange={e => setCsbSearch(e.target.value)}
                    placeholder="Search members..."
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              )}
              {(() => {
                const filtered = csbSearch.trim()
                  ? masterMembers.filter(p => p.toLowerCase().includes(csbSearch.trim().toLowerCase()))
                  : masterMembers;
                return filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{csbSearch.trim() ? "No matches" : "No members"}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {filtered.sort().map(person => (
                      <div key={person} className="group flex items-center gap-1">
                        <PersonName name={person} linkable={false} />
                        {isAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                className="ml-0.5 rounded p-0.5 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                                title={`Remove ${person} from all teams`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove {person}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove {person} from ALL teams across the entire app. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleMasterDelete(person)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        );
      })()}

      {/* ===== TEAM CARDS ===== */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Teams</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {allWallets.filter(t => t !== "CSB").map(team => {
            const members = (teamToPersons.get(team) ?? []).sort();
            const dotColor = getTeamDotColor(team);

            return (
              <Card
                key={team}
                className={`border transition-colors ${dragPerson && dragPerson.fromTeam !== team ? "ring-2 ring-primary/20" : ""}`}
                onDragOver={e => { if (!isAdmin) return; e.preventDefault(); }}
                onDrop={() => handleDrop(team)}
              >
                <CardHeader className="pb-2 px-3 pt-3">
                  <CardTitle className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} style={getTeamDotStyle(team)} />
                      Team {team}
                    </span>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{members.length}</Badge>
                      {isAdmin && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Team {team}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove Team {team} and unassign its {members.length} member(s). Members will remain in the master list.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteTeam(team)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  {members.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No members</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {members.map(person => (
                        <div
                          key={person}
                          draggable={isAdmin}
                          onDragStart={() => handleDragStart(person, team)}
                          className={`group flex items-center gap-1 ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""}`}
                        >
                          {isAdmin && (
                            <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                          <PersonName name={person} team={team} linkable={false} className="w-full justify-center text-center" />
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteFromTeam(person, team)}
                              className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                              title={`Remove ${person} from ${team}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {isAdmin && (
                    <Dialog open={quickAddTeam === team} onOpenChange={(open) => { if (!open) { setQuickAddTeam(null); setQuickAddName(""); } }}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground mt-2 w-full hover:text-foreground" onClick={() => setQuickAddTeam(team)}>
                          <Plus className="h-3 w-3" /> Add member
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-xs">
                        <DialogHeader>
                          <DialogTitle>Add Member to Team {team}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Select member</Label>
                            <Popover open={quickAddPopoverOpen} onOpenChange={setQuickAddPopoverOpen}>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-between h-9 text-sm font-normal">
                                  {quickAddName || "Select member..."}
                                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[100] bg-popover" align="start">
                                <Command>
                                  <CommandInput placeholder="Search person..." />
                                  <CommandList>
                                    <CommandEmpty>No person found.</CommandEmpty>
                                    <CommandGroup>
                                      {allMembers.filter(p => !assignedMembers.has(p)).map(person => (
                                        <CommandItem
                                          key={person}
                                          value={person}
                                          onSelect={(val) => { setQuickAddName(val.toUpperCase()); setQuickAddPopoverOpen(false); }}
                                          className="text-xs"
                                        >
                                          {person}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <Button onClick={() => handleQuickAdd(team)} className="w-full" size="sm">Add Member</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
