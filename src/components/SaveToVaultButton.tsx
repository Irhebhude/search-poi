import { useState, useEffect } from "react";
import { BookOpen, Plus, Check, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface SaveToVaultButtonProps {
  query: string;
  answer: string;
  sources?: any[];
}

interface Vault {
  id: string;
  name: string;
  slug: string;
}

const SaveToVaultButton = ({ query, answer, sources = [] }: SaveToVaultButtonProps) => {
  const [open, setOpen] = useState(false);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [newVaultName, setNewVaultName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !user) return;
    api.from("knowledge_vaults").select("id, name, slug").eq("user_id", user.id).then(({ data }) => {
      setVaults((data || []) as Vault[]);
    });
  }, [open, user]);

  const createVaultAndSave = async () => {
    if (!user || !newVaultName.trim()) return;
    setSaving(true);
    const slug = newVaultName.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").slice(0, 50) + "-" + Math.random().toString(36).slice(2, 6);
    
    const { data: vault, error } = await api.from("knowledge_vaults").insert({
      user_id: user.id,
      name: newVaultName.trim(),
      slug,
    }).select("id").single();

    if (error || !vault) {
      toast({ title: "Error", description: "Failed to create vault.", variant: "destructive" });
      setSaving(false);
      return;
    }

    await saveToVault(vault.id);
    setNewVaultName("");
  };

  const saveToVault = async (vaultId: string) => {
    setSaving(true);
    const { error } = await api.from("knowledge_vault_items").insert({
      vault_id: vaultId,
      query,
      answer,
      sources: sources as any,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to save to vault.", variant: "destructive" });
    } else {
      setSaved(true);
      toast({ title: "Saved!", description: "Added to your Knowledge Vault." });
      setTimeout(() => { setSaved(false); setOpen(false); }, 1500);
    }
    setSaving(false);
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors"
        title="Save to Knowledge Vault"
      >
        {saved ? <Check className="w-3.5 h-3.5 text-[hsl(142,70%,50%)]" /> : <BookOpen className="w-3.5 h-3.5" />}
        {saved ? "Saved!" : "Save"}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 glass rounded-xl border border-border/30 p-3 z-50 shadow-lg">
          <p className="text-xs font-semibold text-foreground mb-2">Save to Knowledge Vault</p>
          
          {vaults.length > 0 && (
            <div className="space-y-1 mb-3 max-h-32 overflow-y-auto">
              {vaults.map(v => (
                <button
                  key={v.id}
                  onClick={() => saveToVault(v.id)}
                  disabled={saving}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-foreground hover:bg-accent/20 transition-colors"
                >
                  {v.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-1.5">
            <input
              type="text"
              value={newVaultName}
              onChange={(e) => setNewVaultName(e.target.value)}
              placeholder="New vault name..."
              className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-muted/30 text-foreground outline-none border border-border/30 focus:border-primary/50"
            />
            <button
              onClick={createVaultAndSave}
              disabled={saving || !newVaultName.trim()}
              className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaveToVaultButton;
